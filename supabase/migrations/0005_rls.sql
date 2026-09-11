-- w1t3: roles & row-level security
-- Three roles (per event, in event_members.role): admin (= treasurer), dept_lead, member.
-- Who am I? The logged-in Supabase user is matched to members by e-mail (magic link).
-- Views run with the owner's rights (aggregate camp budget is visible to every logged-in member — a camp is transparent).

-- ---------- helpers ----------
create or replace function auth_email() returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function my_member_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from members where lower(email) = auth_email() and auth_email() <> '' limit 1
$$;

create or replace function my_event_member_id(p_event uuid) returns uuid language sql stable security definer set search_path = public as $$
  select id from event_members where event_id = p_event and member_id = my_member_id() limit 1
$$;

create or replace function my_role(p_event uuid) returns member_role language sql stable security definer set search_path = public as $$
  select role from event_members where event_id = p_event and member_id = my_member_id() limit 1
$$;

-- admin in any event that is not closed
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_members em join events e on e.id = em.event_id
    where em.member_id = my_member_id() and em.role = 'admin' and e.status <> 'closed')
$$;

-- leads this department in this event (role dept_lead or admin)
create or replace function leads_department(p_event uuid, p_dept uuid) returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from department_leads dl join event_members em on em.id = dl.event_member_id
    where dl.event_id = p_event and dl.department_id = p_dept and em.member_id = my_member_id())
$$;

create or replace function is_attending(p_event uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from event_members where event_id = p_event and member_id = my_member_id() and attending)
$$;

grant execute on function auth_email, my_member_id, is_admin to authenticated, anon;
grant execute on function my_event_member_id(uuid), my_role(uuid), leads_department(uuid, uuid), is_attending(uuid) to authenticated, anon;

-- ---------- enable RLS everywhere ----------
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> '_migrations' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------- read for every logged-in member, write for admin ----------
do $$ declare t text; begin
  foreach t in array array[
    'camps','events','departments','members','event_members','event_milestones','department_leads','event_departments',
    'vendors','scenario_parameters','scenario_parameter_options','cost_items','cost_item_option_overrides',
    'scenarios','scenario_parameter_values','scenario_line_items','scenario_income_lines',
    'budget_lines','budget_income_lines','funds','fee_rules','incomes','shift_roles','shifts','shift_assignments','expenses','legacy_2025_department_actuals'] loop
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ---------- admin only ----------
do $$ declare t text; begin
  foreach t in array array['member_private','member_charge_overrides','notifications','integration_inbox','audit_log'] loop
    execute format('create policy admin_only on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- ---------- money: mine or admin ----------
create policy own_or_admin on payments for select to authenticated
  using (is_admin() or event_member_id = my_event_member_id(event_id));
create policy admin_write on payments for all to authenticated using (is_admin()) with check (is_admin());
create policy own_or_admin on payouts for select to authenticated
  using (is_admin() or event_member_id = my_event_member_id(event_id));
create policy admin_write on payouts for all to authenticated using (is_admin()) with check (is_admin());

-- ---------- expenses: member logs own, dept lead manages own department ----------
create policy member_insert on expenses for insert to authenticated
  with check (
    is_attending(event_id)
    and status = 'pending'
    and paid_by_event_member_id = my_event_member_id(event_id)
    and created_by = my_event_member_id(event_id));
create policy member_edit_own_pending on expenses for update to authenticated
  using (status = 'pending' and created_by = my_event_member_id(event_id))
  with check (status = 'pending' and created_by = my_event_member_id(event_id));
create policy member_delete_own_pending on expenses for delete to authenticated
  using (status = 'pending' and created_by = my_event_member_id(event_id));
create policy lead_manage on expenses for all to authenticated
  using (leads_department(event_id, department_id)) with check (leads_department(event_id, department_id));

-- ---------- incomes: fundraiser department lead can log income ----------
create policy lead_manage on incomes for all to authenticated
  using (department_id is not null and leads_department(event_id, department_id))
  with check (department_id is not null and leads_department(event_id, department_id));

-- ---------- shifts: dept lead opens & assigns, attending members self-register ----------
create policy lead_manage on shift_roles for all to authenticated
  using (leads_department(event_id, department_id)) with check (leads_department(event_id, department_id));
create policy lead_manage on shifts for all to authenticated
  using (leads_department(event_id, department_id)) with check (leads_department(event_id, department_id));
create policy lead_manage on shift_assignments for all to authenticated
  using (exists (select 1 from shifts s where s.id = shift_id and leads_department(s.event_id, s.department_id)))
  with check (exists (select 1 from shifts s where s.id = shift_id and leads_department(s.event_id, s.department_id)));
create policy self_register on shift_assignments for insert to authenticated
  with check (exists (select 1 from shifts s where s.id = shift_id
                      and event_member_id = my_event_member_id(s.event_id) and is_attending(s.event_id)));
create policy self_unregister on shift_assignments for delete to authenticated
  using (exists (select 1 from shifts s where s.id = shift_id and event_member_id = my_event_member_id(s.event_id)));

-- ---------- scenario functions: admin only ----------
create or replace function compute_scenario_checked(p_scenario uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  perform compute_scenario(p_scenario);
end $$;
create or replace function approve_scenario_checked(p_scenario uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  perform approve_scenario(p_scenario);
end $$;
revoke execute on function compute_scenario(uuid), approve_scenario(uuid) from public, anon, authenticated;
grant execute on function compute_scenario_checked(uuid), approve_scenario_checked(uuid) to authenticated;
