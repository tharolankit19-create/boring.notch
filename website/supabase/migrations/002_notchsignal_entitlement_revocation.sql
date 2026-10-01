create or replace function public.notchsignal_set_payment_status(
  p_payment_id text,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded','refunded','disputed') then
    raise exception 'Unsupported NotchSignal payment status: %', p_status;
  end if;

  update public.notchsignal_purchases
  set payment_status = case
    when payment_status = 'refunded' and p_status = 'succeeded' then payment_status
    else p_status
  end
  where payment_id = p_payment_id;
end;
$$;

revoke all on function public.notchsignal_set_payment_status(text,text) from public;
grant execute on function public.notchsignal_set_payment_status(text,text) to service_role;
