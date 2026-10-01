create or replace function public.notchsignal_current_release()
returns table (
  version text,
  storage_object text,
  sha256 text,
  release_notes text,
  source_url text,
  minimum_macos text,
  architectures text[]
)
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    r.version,
    r.storage_object,
    r.sha256,
    r.release_notes,
    r.source_url,
    r.minimum_macos,
    r.architectures
  from public.notchsignal_releases r
  where r.is_current = true
    and exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'notchsignal-releases'
        and o.name = r.storage_object
    )
  order by r.created_at desc
  limit 1;
$$;

revoke all on function public.notchsignal_current_release()
  from public, anon, authenticated;

grant execute on function public.notchsignal_current_release()
  to service_role;
