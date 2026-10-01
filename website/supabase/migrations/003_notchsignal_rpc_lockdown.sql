-- Lock all NotchSignal commerce/release SECURITY DEFINER RPCs to the server-only service role.
-- RLS on the backing tables is intentionally policy-free for browser roles.

revoke all on function public.notchsignal_process_payment(
  text,text,text,text,integer,text,text,text
) from public, anon, authenticated;

revoke all on function public.notchsignal_publish_release(
  text,text,text,text,text,text,text[]
) from public, anon, authenticated;

revoke all on function public.notchsignal_set_payment_status(
  text,text
) from public, anon, authenticated;

grant execute on function public.notchsignal_process_payment(
  text,text,text,text,integer,text,text,text
) to service_role;

grant execute on function public.notchsignal_publish_release(
  text,text,text,text,text,text,text[]
) to service_role;

grant execute on function public.notchsignal_set_payment_status(
  text,text
) to service_role;

create index if not exists notchsignal_events_purchase_id_idx
  on public.notchsignal_events (purchase_id)
  where purchase_id is not null;
