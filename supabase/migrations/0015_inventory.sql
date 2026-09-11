-- 0015: warehouse / inventory (11.9). Camp-level (carries over between years), everyone reads, admin + any department lead edits.
create table if not exists inventory_items (
  id          uuid primary key default gen_random_uuid(),
  camp_id     uuid not null default '00000000-0000-0000-0000-00000000c001' references camps(id),
  name_he     text not null,
  category    text,                                   -- free text: מטבח / הצללה / חשמל / ...
  quantity    numeric(12,2) not null default 1,
  unit        text not null default 'יח׳',
  location    text,                                   -- box / shelf / container
  condition   text not null default 'ok',             -- ok | repair | discard
  notes       text,
  updated_by  uuid references members(id),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (camp_id, name_he)
);
create index if not exists inventory_items_search on inventory_items using gin (to_tsvector('simple', coalesce(name_he,'') || ' ' || coalesce(category,'') || ' ' || coalesce(location,'') || ' ' || coalesce(notes,'')));

-- is the current user a lead of any department in an open event (or admin)?
create or replace function is_any_lead() returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from department_leads dl join event_members em on em.id = dl.event_member_id
    join events e on e.id = dl.event_id
    where em.member_id = my_member_id() and e.status <> 'closed')
$$;

alter table inventory_items enable row level security;
create policy read_all on inventory_items for select to authenticated using (true);
create policy lead_manage on inventory_items for all to authenticated using (is_any_lead()) with check (is_any_lead());
grant select, insert, update, delete on inventory_items to authenticated;
revoke all on inventory_items from anon;
grant execute on function is_any_lead() to authenticated;
