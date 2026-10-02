create table if not exists public.notchsignal_access_rate_limits (
  rate_key text primary key,
  last_sent_at timestamptz not null default now(),
  constraint notchsignal_access_rate_key_shape check (rate_key ~ '^[a-f0-9]{64}$')
);

alter table public.notchsignal_access_rate_limits enable row level security;

revoke all privileges on table public.notchsignal_access_rate_limits
from public, anon, authenticated;

grant select, insert, update, delete on table public.notchsignal_access_rate_limits
to service_role;

create or replace function public.notchsignal_claim_access_email(
  p_rate_key text,
  p_window_seconds integer default 600
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean := false;
  v_window integer := greatest(60, least(coalesce(p_window_seconds, 600), 86400));
begin
  if p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  insert into public.notchsignal_access_rate_limits(rate_key, last_sent_at)
  values (p_rate_key, now())
  on conflict (rate_key) do update
    set last_sent_at = excluded.last_sent_at
    where notchsignal_access_rate_limits.last_sent_at
      <= now() - make_interval(secs => v_window)
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.notchsignal_claim_access_email(text, integer)
from public, anon, authenticated;

grant execute on function public.notchsignal_claim_access_email(text, integer)
to service_role;
