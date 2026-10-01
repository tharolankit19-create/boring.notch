revoke all privileges on table
  public.notchsignal_purchases,
  public.notchsignal_webhook_events,
  public.notchsignal_events,
  public.notchsignal_releases
from anon, authenticated;

grant select, insert, update, delete on table
  public.notchsignal_purchases,
  public.notchsignal_webhook_events,
  public.notchsignal_events,
  public.notchsignal_releases
to service_role;

revoke all privileges on sequence public.notchsignal_events_id_seq
from anon, authenticated;

grant usage, select on sequence public.notchsignal_events_id_seq
to service_role;
