create or replace function public.notchsignal_process_payment(
  p_webhook_id text, p_email text, p_payment_id text, p_checkout_session_id text,
  p_amount integer, p_currency text, p_product_id text, p_product_version text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_purchase_id uuid;
begin
  if exists (
    select 1 from public.notchsignal_webhook_events
    where webhook_id = p_webhook_id
  ) then
    return;
  end if;

  insert into public.notchsignal_purchases (
    email, payment_provider, payment_id, checkout_session_id, payment_status,
    amount, currency, product_id, product_version
  ) values (
    lower(trim(p_email)), 'dodo', p_payment_id, p_checkout_session_id, 'succeeded',
    p_amount, upper(p_currency), p_product_id, p_product_version
  )
  on conflict (payment_id) do update set
    email = excluded.email,
    checkout_session_id = coalesce(
      excluded.checkout_session_id,
      notchsignal_purchases.checkout_session_id
    ),
    -- A later payment.succeeded delivery or checkout reconciliation must never
    -- resurrect an entitlement that was explicitly revoked by refund/dispute.
    payment_status = case
      when notchsignal_purchases.payment_status in ('refunded','disputed')
        then notchsignal_purchases.payment_status
      else 'succeeded'
    end,
    amount = excluded.amount,
    currency = excluded.currency,
    product_id = excluded.product_id,
    product_version = excluded.product_version
  returning id into v_purchase_id;

  insert into public.notchsignal_webhook_events(webhook_id, payment_id)
  values (p_webhook_id, p_payment_id);

  insert into public.notchsignal_events(
    event_name, anonymous_session_id, purchase_id, product_version
  ) values (
    'payment_completed', 'payment:' || p_payment_id, v_purchase_id, p_product_version
  );
end;
$$;

revoke all on function public.notchsignal_process_payment(
  text,text,text,text,integer,text,text,text
) from public, anon, authenticated;

grant execute on function public.notchsignal_process_payment(
  text,text,text,text,integer,text,text,text
) to service_role;
