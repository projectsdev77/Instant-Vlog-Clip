-- Per-user / per-guest AI usage counters, used to cap cost per day.
-- Only the ai Edge Function (service role) reads or writes this table.

create table if not exists public.ai_usage (
  subject text not null,          -- 'user:<uuid>', 'guest:<id>' or 'ip:<address>'
  day date not null,              -- '1970-01-01' for lifetime counters (guest trial)
  generations int not null default 0,
  revisions int not null default 0,
  calls int not null default 0,
  primary key (subject, day)
);

alter table public.ai_usage enable row level security;
-- No policies: clients can't access it; the service role bypasses RLS.

-- Atomically adds 1 to a counter if it is still under the limit.
-- Returns true when the call is allowed.
create or replace function public.bump_ai_usage(p_subject text, p_day date, p_field text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if p_field not in ('generations', 'revisions', 'calls') then
    raise exception 'unknown counter %', p_field;
  end if;
  insert into ai_usage (subject, day) values (p_subject, p_day) on conflict do nothing;
  execute format(
    'update ai_usage set %1$I = %1$I + 1 where subject = $1 and day = $2 and %1$I < $3 returning true', p_field
  ) into allowed using p_subject, p_day, p_limit;
  return coalesce(allowed, false);
end;
$$;

revoke all on function public.bump_ai_usage(text, date, text, int) from public, anon, authenticated;
