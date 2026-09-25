create extension if not exists citext;

create table if not exists public.notchsignal_purchases (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  payment_provider text not null default 'dodo' check (payment_provider = 'dodo'),
  payment_id text not null unique,
  checkout_session_id text unique,
  payment_status text not null check (payment_status in ('succeeded','refunded','disputed')),
  amount integer not null check (amount > 0),
  currency text not null,
  product_id text not null,
  product_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists notchsignal_purchases_email_idx
  on public.notchsignal_purchases (email, created_at desc);

create table if not exists public.notchsignal_webhook_events (
  webhook_id text primary key,
  payment_id text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.notchsignal_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'landing_view','demo_played','pricing_viewed','checkout_started','payment_completed','download_started'
  )),
  anonymous_session_id text not null,
  purchase_id uuid references public.notchsignal_purchases(id) on delete set null,
  product_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.notchsignal_releases (
  version text primary key,
  storage_object text not null unique,
  sha256 text not null,
  release_notes text not null default '',
  source_url text not null,
  minimum_macos text not null default '14.0',
  architectures text[] not null default array['arm64','x86_64'],
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists notchsignal_one_current_release
  on public.notchsignal_releases (is_current) where is_current = true;

alter table public.notchsignal_purchases enable row level security;
alter table public.notchsignal_webhook_events enable row level security;
alter table public.notchsignal_events enable row level security;
alter table public.notchsignal_releases enable row level security;

create or replace function public.notchsignal_process_payment(
  p_webhook_id text, p_email text, p_payment_id text, p_checkout_session_id text,
  p_amount integer, p_currency text, p_product_id text, p_product_version text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_purchase_id uuid;
begin
  if exists (select 1 from public.notchsignal_webhook_events where webhook_id = p_webhook_id) then return; end if;

  insert into public.notchsignal_purchases (
    email,payment_provider,payment_id,checkout_session_id,payment_status,amount,currency,product_id,product_version
  ) values (
    lower(trim(p_email)),'dodo',p_payment_id,p_checkout_session_id,'succeeded',p_amount,upper(p_currency),p_product_id,p_product_version
  )
  on conflict (payment_id) do update set
    email=excluded.email,
    checkout_session_id=coalesce(excluded.checkout_session_id,notchsignal_purchases.checkout_session_id),
    payment_status='succeeded',amount=excluded.amount,currency=excluded.currency,
    product_id=excluded.product_id,product_version=excluded.product_version
  returning id into v_purchase_id;

  insert into public.notchsignal_webhook_events(webhook_id,payment_id) values(p_webhook_id,p_payment_id);
  insert into public.notchsignal_events(event_name,anonymous_session_id,purchase_id,product_version)
    values('payment_completed','payment:'||p_payment_id,v_purchase_id,p_product_version);
end;
$$;
revoke all on function public.notchsignal_process_payment(text,text,text,text,integer,text,text,text) from public;
grant execute on function public.notchsignal_process_payment(text,text,text,text,integer,text,text,text) to service_role;
