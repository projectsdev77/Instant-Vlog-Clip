-- Account storage: each signed-in user's drafts (one row per vlog) and their
-- files (voice audio, own song, the finished video) in a private bucket.
-- Original clips are never stored here; they stay on the user's device.

create table if not exists public.vlogs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,                         -- the app's project id
  title text not null default '',
  step text not null default 'clips',       -- where the draft is in the flow
  cover text,                               -- small JPEG data URL for the card
  data jsonb not null,                      -- the draft: project (current edit + saved versions) and clip details
  video_bytes bigint,                       -- the latest finished video, if any
  video_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.vlogs enable row level security;

drop policy if exists "own vlogs: read" on public.vlogs;
drop policy if exists "own vlogs: add" on public.vlogs;
drop policy if exists "own vlogs: change" on public.vlogs;
drop policy if exists "own vlogs: delete" on public.vlogs;
create policy "own vlogs: read" on public.vlogs for select to authenticated using (user_id = auth.uid());
create policy "own vlogs: add" on public.vlogs for insert to authenticated with check (user_id = auth.uid());
create policy "own vlogs: change" on public.vlogs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own vlogs: delete" on public.vlogs for delete to authenticated using (user_id = auth.uid());

-- Files live under <user id>/<vlog id>/... in a private bucket. 50 MB per file
-- is the most the free Supabase plan allows; a finished 60 s vlog is ~15-20 MB.
insert into storage.buckets (id, name, public, file_size_limit)
values ('vlogs', 'vlogs', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "own vlog files: read" on storage.objects;
drop policy if exists "own vlog files: add" on storage.objects;
drop policy if exists "own vlog files: change" on storage.objects;
drop policy if exists "own vlog files: delete" on storage.objects;
create policy "own vlog files: read" on storage.objects for select to authenticated
  using (bucket_id = 'vlogs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own vlog files: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'vlogs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own vlog files: change" on storage.objects for update to authenticated
  using (bucket_id = 'vlogs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own vlog files: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'vlogs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Account space per plan, in bytes. Edit the numbers in the table editor
-- (e.g. a few MB to try the "space full" message while developing).
create table if not exists public.storage_limits (
  plan text primary key,                    -- 'free' | 'pro'
  bytes bigint not null
);
insert into public.storage_limits (plan, bytes) values
  ('free', 2147483648),                     -- 2 GB
  ('pro', 53687091200)                      -- 50 GB
on conflict (plan) do nothing;
alter table public.storage_limits enable row level security;
-- No policies: read through my_storage() below.

-- The signed-in user's space: bytes used by their files and their plan's limit.
create or replace function public.my_storage()
returns json
language sql
stable
security definer
set search_path = public, storage
as $$
  with me as (select auth.uid() as id),
  plan as (
    select case when exists (
      select 1 from public.subscriptions s, me
      where s.user_id = me.id and s.plan = 'pro' and s.status in ('active', 'trialing', 'past_due')
    ) then 'pro' else 'free' end as name
  )
  select json_build_object(
    'used', coalesce((
      select sum(coalesce((o.metadata ->> 'size')::bigint, 0))
      from storage.objects o, me
      where o.bucket_id = 'vlogs' and (storage.foldername(o.name))[1] = me.id::text
    ), 0),
    'limit', (select l.bytes from public.storage_limits l, plan where l.plan = plan.name),
    'plan', (select name from plan)
  )
  where auth.uid() is not null;
$$;

revoke all on function public.my_storage() from public, anon;
grant execute on function public.my_storage() to authenticated;
