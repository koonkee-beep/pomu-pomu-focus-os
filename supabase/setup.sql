-- Run once in the Supabase SQL Editor for the POMU POMU project.
-- No service-role key is needed in the website.
begin;

create table if not exists public.pomu_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.pomu_snapshots enable row level security;
revoke all on public.pomu_snapshots from public, anon, authenticated;
grant select on public.pomu_snapshots to authenticated;
drop policy if exists pomu_read_own on public.pomu_snapshots;
create policy pomu_read_own on public.pomu_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

-- Only this function can write. Ownership comes from the verified auth JWT,
-- never a user_id supplied by a browser. Direct table writes are not granted.
create or replace function public.pomu_write_snapshot(p_expected_revision bigint, p_payload jsonb)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  next_revision bigint;
begin
  if actor is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0
    or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload->'tasks') is distinct from 'array'
    or jsonb_typeof(p_payload->'inbox') is distinct from 'array'
    or jsonb_typeof(p_payload->'parking') is distinct from 'array'
    or jsonb_typeof(p_payload->'focusMinutes') is distinct from 'object'
    or octet_length(p_payload::text) > 2097152 then
    raise exception 'Invalid or oversized list' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.pomu_snapshots(user_id, payload)
      values (actor, p_payload)
      on conflict (user_id) do nothing
      returning revision into next_revision;
  else
    update public.pomu_snapshots
      set payload = p_payload, revision = revision + 1, updated_at = now()
      where user_id = actor and revision = p_expected_revision
      returning revision into next_revision;
  end if;
  -- NULL means another device saved first. The client must resolve the conflict.
  return next_revision;
end;
$$;
revoke all on function public.pomu_write_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.pomu_write_snapshot(bigint, jsonb) to authenticated;
commit;
