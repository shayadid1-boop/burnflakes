-- =====================================================================
-- Burnflakes camp budget — Supabase / PostgreSQL schema (MVP v0.3 — simplified after decisions of 7.9.2026)
-- Run in: Supabase Dashboard -> SQL Editor (one file, top to bottom)
-- =====================================================================
create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type member_tier      as enum ('core', 'second_year', 'semi_core', 'friend', 'partner');
create type ticket_status    as enum ('unknown', 'allocation', 'self_bought', 'needs_volunteer', 'no_ticket');
create type member_role      as enum ('admin', 'dept_lead', 'member');   -- admin = camp manager = treasurer (decision: one role)
create type quantity_driver  as enum ('fixed', 'per_member', 'per_sqm', 'per_meal', 'per_day', 'param');
create type scenario_status  as enum ('draft', 'approved', 'archived');
create type expense_status   as enum ('pending', 'approved', 'reimbursed', 'settled', 'rejected');
create type paid_from        as enum ('member_pocket', 'camp_account', 'advance');
create type payment_method   as enum ('paybox', 'bit', 'bank_transfer', 'cash', 'offset');
create type payment_status   as enum ('pending', 'confirmed', 'cancelled');
create type fund_kind        as enum ('camp_dues', 'storage', 'container', 'fundraiser', 'donation', 'sponsorship', 'sale', 'carryover', 'other');

-- ---------- core reference ----------
create table camps (                                 -- multi-camp from day one (decision 9): every root table carries camp_id
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_he     text not null,
  created_at  timestamptz not null default now()
);
insert into camps (id, slug, name_he) values ('00000000-0000-0000-0000-00000000c001', 'burnflakes', 'ברנפלקס');

create table events (
  id          uuid primary key default gen_random_uuid(),
  camp_id     uuid not null default '00000000-0000-0000-0000-00000000c001' references camps(id),
  name        text not null,
  year        int  not null,
  starts_on   date,
  ends_on     date,
  status      text not null default 'planning',      -- planning | active | closed
  created_at  timestamptz not null default now()
);

create table departments (
  id          uuid primary key default gen_random_uuid(),
  camp_id     uuid not null default '00000000-0000-0000-0000-00000000c001' references camps(id),
  slug        text not null,
  name_he     text not null,
  kind        text not null default 'internal' check (kind in ('internal', 'fundraiser')),  -- fundraiser = has incomes too (party, retreat)
  sort_order  int  not null default 100,
  is_active   boolean not null default true,
  unique (camp_id, slug)
);

create table members (
  id            uuid primary key default gen_random_uuid(),
  camp_id     uuid not null default '00000000-0000-0000-0000-00000000c001' references camps(id),
  auth_user_id  uuid unique,                          -- links to auth.users when the member logs in
  first_name    text not null,
  last_name     text,
  phone         text,                                 -- for WhatsApp automations later
  email         text,
  is_active     boolean not null default true,       -- false = left the camp for good (still in history)
  notes         text,
  created_at    timestamptz not null default now(),
  unique (camp_id, first_name, last_name)
);

create table member_private (                        -- restricted columns (admin only via RLS): needed only for Midburn ticketing export
  member_id     uuid primary key references members(id) on delete cascade,
  national_id   text,
  updated_at    timestamptz not null default now()
);

create table event_members (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references events(id) on delete cascade,
  member_id           uuid not null references members(id),
  tier                member_tier not null default 'core',
  role                member_role not null default 'member',
  participation_share numeric(6,4) not null default 1,  -- 1 = full member; 0.8148 = Einat-style partial
  attending           boolean not null default true,     -- false = on the list (container fund) but not coming this year
  ticket_status       ticket_status not null default 'unknown',
  volunteer_dept      text,                                -- Midburn volunteering department (ברנפלקס / מחלקת תנועה / מיצב ...)
  lead_area           text,                                -- free text from the roster ("סלון", "ע. מסיבה", "מרפאה")
  notes               text,
  unique (event_id, member_id)
);

create table event_milestones (                      -- the Gantt: meetings, build days, event days, decompression
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references events(id) on delete cascade,
  day       date not null,
  title     text not null,
  kind      text not null default 'camp',            -- camp | midburn | build | teardown | fundraiser | other
  notes     text
);

create table department_leads (
  event_id        uuid not null references events(id) on delete cascade,
  department_id   uuid not null references departments(id),
  event_member_id uuid not null references event_members(id),
  primary key (event_id, department_id, event_member_id)
);

create table event_departments (                     -- which departments exist this year (2022 had "build crew", 2025 had "installation")
  event_id       uuid not null references events(id) on delete cascade,
  department_id  uuid not null references departments(id),
  primary key (event_id, department_id)
);

create table vendors (
  id       uuid primary key default gen_random_uuid(),
  camp_id     uuid not null default '00000000-0000-0000-0000-00000000c001' references camps(id),
  name     text not null,
  contact  text,
  notes    text,
  unique (camp_id, name)
);

-- ---------- scenario engine ----------
create table scenario_parameters (
  id            uuid primary key default gen_random_uuid(),
  camp_id     uuid not null default '00000000-0000-0000-0000-00000000c001' references camps(id),
  key           text not null unique,                 -- member_count, shade_type, gift_level ... (global key; camp_id scopes the row)
  label_he      text not null,
  value_type    text not null check (value_type in ('number', 'enum', 'boolean')),
  default_value jsonb not null,
  sort_order    int not null default 100
);

create table scenario_parameter_options (            -- the choices of an enum parameter
  id            uuid primary key default gen_random_uuid(),
  parameter_id  uuid not null references scenario_parameters(id) on delete cascade,
  value         text not null,
  label_he      text not null,
  sort_order    int not null default 100,
  unique (parameter_id, value)
);

create table cost_items (                            -- the catalog of "things the camp pays for"
  id                uuid primary key default gen_random_uuid(),
  camp_id     uuid not null default '00000000-0000-0000-0000-00000000c001' references camps(id),
  department_id     uuid not null references departments(id),
  name_he           text not null,
  quantity_driver   quantity_driver not null default 'fixed',
  driver_param_key  text references scenario_parameters(key),   -- which parameter drives the quantity
  base_quantity     numeric(12,2) not null default 1,
  unit_cost         numeric(12,4) not null default 0,
  applies_when      jsonb,        -- e.g. {"shade_type": "net"} -> line exists only when the option is chosen
  notes             text,
  is_active         boolean not null default true,
  unique (department_id, name_he)
);

create table cost_item_option_overrides (            -- "if gift_level = premium then unit_cost = X"
  id             uuid primary key default gen_random_uuid(),
  cost_item_id   uuid not null references cost_items(id) on delete cascade,
  parameter_key  text not null references scenario_parameters(key),
  option_value   text not null,
  unit_cost      numeric(12,2),
  quantity       numeric(12,2),
  unique (cost_item_id, parameter_key, option_value)
);

create table scenarios (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,
  description text,
  status      scenario_status not null default 'draft',
  cloned_from uuid references scenarios(id),
  created_by  uuid references event_members(id),
  created_at  timestamptz not null default now(),
  computed_at timestamptz
);

create table scenario_parameter_values (
  scenario_id   uuid not null references scenarios(id) on delete cascade,
  parameter_id  uuid not null references scenario_parameters(id),
  value         jsonb not null,
  primary key (scenario_id, parameter_id)
);

create table scenario_line_items (                   -- the computed budget of one scenario
  id             uuid primary key default gen_random_uuid(),
  scenario_id    uuid not null references scenarios(id) on delete cascade,
  cost_item_id   uuid references cost_items(id),
  department_id  uuid not null references departments(id),
  name_he        text not null,
  quantity       numeric(12,2) not null default 1,
  unit_cost      numeric(12,4) not null default 0,
  amount         numeric(12,2) generated always as (quantity * unit_cost) stored,
  is_override    boolean not null default false,     -- true = typed by hand, compute_scenario() leaves it alone
  unique (scenario_id, cost_item_id)
);

create table scenario_income_lines (                 -- planned income of a scenario that is NOT member dues (dues are derived)
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenarios(id) on delete cascade,
  fund_kind    fund_kind not null default 'fundraiser',
  department_id uuid references departments(id),      -- the fundraiser department this income belongs to
  name_he      text not null,
  amount       numeric(12,2) not null default 0,
  notes        text
);

-- ---------- the approved plan + execution ----------
create table budget_lines (                          -- frozen copy of the approved scenario
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references events(id) on delete cascade,
  department_id         uuid not null references departments(id),
  cost_item_id          uuid references cost_items(id),
  name_he               text not null,
  planned_amount        numeric(12,2) not null,
  scenario_line_item_id uuid references scenario_line_items(id),
  unique (event_id, department_id, name_he)
);

create table budget_income_lines (                   -- frozen copy of the approved scenario's planned income
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  fund_kind    fund_kind not null,
  department_id uuid references departments(id),
  name_he      text not null,
  planned_amount numeric(12,2) not null
);

create table expenses (                              -- single source of truth for money spent
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references events(id) on delete cascade,
  department_id         uuid not null references departments(id),
  budget_line_id        uuid references budget_lines(id),
  vendor_id             uuid references vendors(id),
  description           text not null,
  amount                numeric(12,2) not null check (amount >= 0),
  expense_date          date,
  paid_by_event_member_id uuid references event_members(id),   -- who fronted the money
  paid_by_name          text,                                   -- free text until matched (2025 import)
  paid_from             paid_from not null default 'member_pocket',
  status                expense_status not null default 'pending',
  has_receipt           boolean not null default false,               -- photo goes to the treasurer on WhatsApp
  payout_id             uuid,                                   -- set when reimbursed
  created_by            uuid references event_members(id),
  notes                 text,
  created_at            timestamptz not null default now()
);

-- ---------- money in / money out ----------
create table funds (                                 -- a collection round: camp dues, storage, container...
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  key            text not null,
  name_he        text not null,
  kind           fund_kind not null,
  in_refund_pool boolean not null default true,      -- does surplus of this fund get returned per person?
  from_members   boolean not null default true,      -- true = collected from members by tariff (payments); false = external income (incomes)
  unique (event_id, key)
);

create table fee_rules (                             -- how much each tier owes a fund
  fund_id  uuid not null references funds(id) on delete cascade,
  tier     member_tier not null,
  amount   numeric(12,2) not null,
  primary key (fund_id, tier)
);

create table member_charge_overrides (               -- exceptions ("Gili: at least 500")
  fund_id          uuid not null references funds(id) on delete cascade,
  event_member_id  uuid not null references event_members(id) on delete cascade,
  amount_due       numeric(12,2) not null,
  reason           text,
  primary key (fund_id, event_member_id)
);

create table payments (                              -- money that came IN from a member
  id                          uuid primary key default gen_random_uuid(),
  event_id                    uuid not null references events(id) on delete cascade,
  fund_id                     uuid not null references funds(id),
  event_member_id             uuid not null references event_members(id),
  amount                      numeric(12,2) not null,
  method                      payment_method not null,
  status                      payment_status not null default 'confirmed',
  paid_at                     date,
  received_by_event_member_id uuid references event_members(id),   -- "transferred to Niv by Bit"
  external_ref                text,                                -- PayBox / Bit transaction id (automation)
  notes                       text,
  created_at                  timestamptz not null default now()
);

create table payouts (                               -- money that went OUT to a member (refund / reimbursement)
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  event_member_id  uuid not null references event_members(id),
  amount           numeric(12,2) not null,
  method           payment_method not null,
  status           payment_status not null default 'pending',
  paid_at          date,
  notes            text,
  created_at       timestamptz not null default now()
);
alter table expenses add constraint expenses_payout_fk foreign key (payout_id) references payouts(id);

-- ---------- income that does not come from member tariffs ----------
create table incomes (                               -- money IN that is not a member tariff payment
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  fund_id         uuid not null references funds(id),          -- category: fundraiser / donation / sponsorship / sale / carryover
  department_id   uuid references departments(id),             -- a fundraiser department (party, retreat) or a department that sold something
  source_name     text,                                        -- "מסיבת גיוס פברואר", "עיריית ...", "מכירת מקרר ישן"
  amount          numeric(12,2) not null,
  received_at     date,
  method          payment_method,
  status          payment_status not null default 'confirmed',
  received_by_event_member_id uuid references event_members(id),
  external_ref    text,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ---------- shift board (per department) ----------
create table shift_roles (                           -- a kind of duty a department staffs: "ברמן/ית", "איש קרח", "ניקיון"
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  department_id  uuid not null references departments(id),
  name_he        text not null,
  description_he text,                               -- what the duty is (from the shifts sheet notes)
  slots_per_shift int not null default 1,
  starts_at      time,
  ends_at        time,
  budget_amount  numeric(12,2),                      -- e.g. dinner team: 400 ₪ per meal
  unique (event_id, department_id, name_he)
);

create table shifts (                                -- one role on one day (or a named one-off: "העמסת המשאית")
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  department_id  uuid not null references departments(id),
  shift_role_id  uuid references shift_roles(id),
  day            date not null,
  title_he       text,                               -- optional override ("ארוחת ערב איטלקית")
  slots          int not null default 1,
  starts_at      time,
  ends_at        time,
  notes          text,
  unique (event_id, department_id, shift_role_id, day, title_he)
);

create table shift_assignments (
  shift_id         uuid not null references shifts(id) on delete cascade,
  event_member_id  uuid not null references event_members(id) on delete cascade,
  status           text not null default 'assigned', -- assigned | confirmed | swapped | no_show
  primary key (shift_id, event_member_id)
);
alter table expenses add column shift_id uuid references shifts(id);   -- dinner-team groceries land on the meal's shift

create or replace view v_shift_board as
select s.event_id, s.day, d.slug as department, d.name_he as department_name,
       coalesce(s.title_he, r.name_he) as shift, s.slots,
       count(a.event_member_id) as filled,
       string_agg(m.first_name || ' ' || coalesce(m.last_name, ''), ', ' order by m.first_name) as people
from shifts s
join departments d on d.id = s.department_id
left join shift_roles r on r.id = s.shift_role_id
left join shift_assignments a on a.shift_id = s.id
left join event_members em on em.id = a.event_member_id
left join members m on m.id = em.member_id
group by s.id, d.slug, d.name_he, d.sort_order, r.name_he
order by s.day, d.sort_order;

-- ---------- automation infrastructure ----------
create table notifications (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid references events(id) on delete cascade,
  event_member_id  uuid references event_members(id),
  channel          text not null default 'whatsapp',
  template_key     text not null,                    -- payment_reminder, refund_sent ...
  payload          jsonb,
  status           text not null default 'queued',   -- queued | sent | failed
  scheduled_for    timestamptz,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

create table integration_inbox (                     -- raw webhooks from payment apps, processed later
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  external_id  text,
  payload      jsonb not null,
  processed_at timestamptz,
  received_at  timestamptz not null default now(),
  unique (provider, external_id)
);

create table audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_id      uuid,
  action      text not null,
  actor       uuid,
  diff        jsonb,
  at          timestamptz not null default now()
);

-- =====================================================================
-- Business logic
-- =====================================================================

-- read one parameter value of a scenario (falls back to the parameter default)
create or replace function scenario_param(p_scenario uuid, p_key text) returns jsonb language sql stable as $$
  select coalesce(v.value, p.default_value)
  from scenario_parameters p
  left join scenario_parameter_values v on v.parameter_id = p.id and v.scenario_id = p_scenario
  where p.key = p_key
$$;

-- (re)compute all non-override lines of a scenario from the cost item catalog
create or replace function compute_scenario(p_scenario uuid) returns void language plpgsql as $$
declare
  ci record; v_qty numeric; v_unit numeric; v_param jsonb; v_ok boolean; k text; val jsonb; ov record;
begin
  delete from scenario_line_items where scenario_id = p_scenario and is_override = false;

  for ci in select * from cost_items where is_active loop
    -- 1. does this line apply under the chosen options?
    v_ok := true;
    if ci.applies_when is not null then
      for k, val in select * from jsonb_each(ci.applies_when) loop
        if scenario_param(p_scenario, k) <> val then v_ok := false; end if;
      end loop;
    end if;
    if not v_ok then continue; end if;

    -- 2. quantity from the driver
    v_qty := ci.base_quantity;
    if ci.quantity_driver <> 'fixed' and ci.driver_param_key is not null then
      v_param := scenario_param(p_scenario, ci.driver_param_key);
      v_qty := ci.base_quantity * (v_param #>> '{}')::numeric;
    end if;
    v_unit := ci.unit_cost;

    -- 3. option overrides (e.g. gift_level = premium)
    for ov in select o.* from cost_item_option_overrides o where o.cost_item_id = ci.id loop
      if scenario_param(p_scenario, ov.parameter_key) = to_jsonb(ov.option_value) then
        v_unit := coalesce(ov.unit_cost, v_unit);
        v_qty  := coalesce(ov.quantity, v_qty);
      end if;
    end loop;

    insert into scenario_line_items (scenario_id, cost_item_id, department_id, name_he, quantity, unit_cost)
    values (p_scenario, ci.id, ci.department_id, ci.name_he, v_qty, v_unit)
    on conflict (scenario_id, cost_item_id) do nothing;   -- keeps manual overrides
  end loop;

  update scenarios set computed_at = now() where id = p_scenario;
end $$;

-- scenario summary: total per department, grand total, dues per full member
create or replace view v_scenario_summary as
with totals as (
  select s.id as scenario_id, s.event_id, s.name, coalesce(sum(li.amount), 0) as total,
         coalesce((select sum(amount) from scenario_income_lines i where i.scenario_id = s.id), 0) as other_income
  from scenarios s left join scenario_line_items li on li.scenario_id = s.id
  group by s.id
)
select t.*,
       (scenario_param(t.scenario_id, 'buffer_pct') #>> '{}')::numeric as buffer_pct,
       (scenario_param(t.scenario_id, 'member_count') #>> '{}')::numeric as member_count,
       coalesce((scenario_param(t.scenario_id, 'buffer_amount') #>> '{}')::numeric, 0) as buffer_amount,
       round((t.total * (1 + (scenario_param(t.scenario_id, 'buffer_pct') #>> '{}')::numeric / 100)
              + coalesce((scenario_param(t.scenario_id, 'buffer_amount') #>> '{}')::numeric, 0)
              - t.other_income)
             / nullif((scenario_param(t.scenario_id, 'member_count') #>> '{}')::numeric, 0), 2) as dues_per_member
from totals t;

create or replace view v_scenario_by_department as
select li.scenario_id, d.slug, d.name_he as department, sum(li.amount) as amount
from scenario_line_items li join departments d on d.id = li.department_id
group by li.scenario_id, d.slug, d.name_he, d.sort_order order by d.sort_order;

-- freeze an approved scenario into budget_lines
create or replace function approve_scenario(p_scenario uuid) returns void language plpgsql as $$
declare v_event uuid;
begin
  select event_id into v_event from scenarios where id = p_scenario;
  update scenarios set status = 'archived' where event_id = v_event and status = 'approved' and id <> p_scenario;
  update scenarios set status = 'approved' where id = p_scenario;
  delete from budget_lines where event_id = v_event;
  delete from budget_income_lines where event_id = v_event;
  insert into budget_income_lines (event_id, fund_kind, department_id, name_he, planned_amount)
  select v_event, fund_kind, department_id, name_he, amount from scenario_income_lines where scenario_id = p_scenario;
  insert into budget_lines (event_id, department_id, cost_item_id, name_he, planned_amount, scenario_line_item_id)
  select v_event, department_id, cost_item_id, name_he, amount, id from scenario_line_items where scenario_id = p_scenario;
end $$;

-- planned vs actual per department
create or replace view v_department_budget_vs_actual as
select e.id as event_id, d.slug, d.name_he as department, d.kind,
       coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0) as planned,
       coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0) as actual,
       coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.department_id = d.id), 0) as income_planned,
       coalesce((select sum(amount) from incomes i where i.event_id = e.id and i.department_id = d.id and i.status = 'confirmed'), 0) as income_actual
from events e join departments d on d.camp_id = e.camp_id where d.is_active order by d.sort_order;

-- what each member owes each fund (rule by tier, unless an override exists)
create or replace view v_member_charges as
select em.event_id, f.id as fund_id, f.key as fund_key, em.id as event_member_id,
       round(coalesce(o.amount_due, fr.amount * em.participation_share), 2) as amount_due
from event_members em
join funds f on f.event_id = em.event_id and em.attending
left join fee_rules fr on fr.fund_id = f.id and fr.tier = em.tier
left join member_charge_overrides o on o.fund_id = f.id and o.event_member_id = em.id;

-- THE ledger: replaces the "תשלומים" sheet
create or replace view v_member_ledger as
with pool as (   -- surplus of the refund pool = everything collected into pooled funds - all expenses
  select e.id as event_id,
         coalesce((select sum(p.amount) from payments p join funds f on f.id = p.fund_id
                   where p.event_id = e.id and p.status = 'confirmed' and f.in_refund_pool), 0)
       + coalesce((select sum(i.amount) from incomes i join funds f on f.id = i.fund_id
                   where i.event_id = e.id and i.status = 'confirmed' and f.in_refund_pool), 0)
       - coalesce((select sum(x.amount) from expenses x where x.event_id = e.id and x.status <> 'rejected'), 0) as surplus,
         (select sum(participation_share) from event_members em where em.event_id = e.id and em.attending) as total_shares
  from events e
),
per_member as (
  select em.id as event_member_id, em.event_id, m.first_name, m.last_name, em.tier, em.participation_share,
    coalesce((select sum(c.amount_due) from v_member_charges c join funds f on f.id = c.fund_id
              where c.event_member_id = em.id and f.in_refund_pool), 0) as due,
    coalesce((select sum(p.amount) from payments p join funds f on f.id = p.fund_id
              where p.event_member_id = em.id and p.status = 'confirmed' and f.in_refund_pool), 0) as paid,
    coalesce((select sum(x.amount) from expenses x where x.paid_by_event_member_id = em.id
              and x.paid_from = 'member_pocket' and x.status <> 'rejected'), 0) as fronted,
    coalesce((select sum(po.amount) from payouts po where po.event_member_id = em.id and po.status = 'confirmed'), 0) as paid_out
  from event_members em join members m on m.id = em.member_id
)
select pm.*,
       round(pool.surplus * pm.participation_share / nullif(pool.total_shares, 0), 2) as surplus_share,
       -- positive = member still owes the camp, negative = camp owes the member (refund)
       round(pm.due - pm.paid - pm.fronted - pool.surplus * pm.participation_share / nullif(pool.total_shares, 0) + pm.paid_out, 2) as balance
from per_member pm join pool on pool.event_id = pm.event_id;

-- the balance sheet of an event: every shekel in, by category, and every shekel out, by department
create or replace view v_event_balance as
select e.id as event_id, 'income' as side, f.kind::text as category, f.name_he as name,
       coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.fund_kind = f.kind), 0) as planned,
       coalesce((select sum(amount) from payments p where p.fund_id = f.id and p.status = 'confirmed'), 0)
     + coalesce((select sum(amount) from incomes i where i.fund_id = f.id and i.status = 'confirmed'), 0) as actual
from events e join funds f on f.event_id = e.id
union all
select e.id, 'expense', d.slug, d.name_he,
       coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0),
       coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0)
from events e join departments d on d.is_active;

create or replace view v_fundraiser_net as              -- a fundraiser department: planned & actual income, cost, net
select e.id as event_id, d.id as department_id, d.name_he,
  coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.department_id = d.id), 0) as income_planned,
  coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0)        as cost_planned,
  coalesce((select sum(amount) from incomes i where i.event_id = e.id and i.department_id = d.id and i.status = 'confirmed'), 0) as income_actual,
  coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0) as cost_actual
from events e join departments d on d.camp_id = e.camp_id and d.kind = 'fundraiser' and d.is_active;

-- management dashboard: one row per event with the macro numbers
create or replace view v_management_dashboard as
select e.id as event_id, e.name, e.year,
  (select sum(planned_amount) from budget_lines b where b.event_id = e.id)                                        as planned_total,
  (select sum(amount) from expenses x where x.event_id = e.id and x.status <> 'rejected')                        as actual_total,
  (select sum(p.amount) from payments p join funds f on f.id = p.fund_id
    where p.event_id = e.id and p.status = 'confirmed' and f.in_refund_pool)                                      as collected_total,
  (select sum(i.amount) from incomes i where i.event_id = e.id and i.status = 'confirmed')                        as other_income_total,
  (select sum(actual) from v_event_balance b where b.event_id = e.id and b.side = 'income')
  - (select sum(actual) from v_event_balance b where b.event_id = e.id and b.side = 'expense')                    as net_result,
  (select sum(c.amount_due) from v_member_charges c join funds f on f.id = c.fund_id
    where c.event_id = e.id and f.in_refund_pool)                                                                 as expected_total,
  (select count(*) from v_member_ledger l where l.event_id = e.id and l.paid < l.due)                            as members_not_fully_paid,
  (select sum(-balance) from v_member_ledger l where l.event_id = e.id and l.balance < 0)                        as refunds_owed_total,
  (select count(*) from v_department_budget_vs_actual d where d.event_id = e.id and d.actual > d.planned)        as departments_over_budget
from events e;

-- the balance sheet of an event: every shekel in, by category, and every shekel out, by department
create or replace view v_event_balance as
select e.id as event_id, 'income' as side, f.kind::text as category, f.name_he as name,
       coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.fund_kind = f.kind), 0) as planned,
       coalesce((select sum(amount) from payments p where p.fund_id = f.id and p.status = 'confirmed'), 0)
     + coalesce((select sum(amount) from incomes i where i.fund_id = f.id and i.status = 'confirmed'), 0) as actual
from events e join funds f on f.event_id = e.id
union all
select e.id, 'expense', d.slug, d.name_he,
       coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0),
       coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0)
from events e join departments d on d.is_active;

create or replace view v_fundraiser_net as              -- a fundraiser department: planned & actual income, cost, net
select e.id as event_id, d.id as department_id, d.name_he,
  coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.department_id = d.id), 0) as income_planned,
  coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0)        as cost_planned,
  coalesce((select sum(amount) from incomes i where i.event_id = e.id and i.department_id = d.id and i.status = 'confirmed'), 0) as income_actual,
  coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0) as cost_actual
from events e join departments d on d.camp_id = e.camp_id and d.kind = 'fundraiser' and d.is_active;

-- management dashboard: one row per event with the macro numbers
create or replace view v_management_dashboard as
select e.id as event_id, e.name, e.year,
  (select sum(planned_amount) from budget_lines b where b.event_id = e.id)                                        as planned_total,
  (select sum(amount) from expenses x where x.event_id = e.id and x.status <> 'rejected')                        as actual_total,
  (select sum(p.amount) from payments p join funds f on f.id = p.fund_id
    where p.event_id = e.id and p.status = 'confirmed' and f.in_refund_pool)                                      as collected_total,
  (select sum(i.amount) from incomes i where i.event_id = e.id and i.status = 'confirmed')                        as other_income_total,
  (select sum(actual) from v_event_balance b where b.event_id = e.id and b.side = 'income')
  - (select sum(actual) from v_event_balance b where b.event_id = e.id and b.side = 'expense')                    as net_result,
  (select sum(c.amount_due) from v_member_charges c join funds f on f.id = c.fund_id
    where c.event_id = e.id and f.in_refund_pool)                                                                 as expected_total,
  (select count(*) from v_member_ledger l where l.event_id = e.id and l.paid < l.due)                            as members_not_fully_paid,
  (select sum(-balance) from v_member_ledger l where l.event_id = e.id and l.balance < 0)                        as refunds_owed_total,
  (select count(*) from v_department_budget_vs_actual d where d.event_id = e.id and d.actual > d.planned)        as departments_over_budget
from events e;

-- the balance sheet of an event: every shekel in, by category, and every shekel out, by department
create or replace view v_event_balance as
select e.id as event_id, 'income' as side, f.kind::text as category, f.name_he as name,
       coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.fund_kind = f.kind), 0) as planned,
       coalesce((select sum(amount) from payments p where p.fund_id = f.id and p.status = 'confirmed'), 0)
     + coalesce((select sum(amount) from incomes i where i.fund_id = f.id and i.status = 'confirmed'), 0) as actual
from events e join funds f on f.event_id = e.id
union all
select e.id, 'expense', d.slug, d.name_he,
       coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0),
       coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0)
from events e join departments d on d.is_active;

create or replace view v_fundraiser_net as              -- a fundraiser department: planned & actual income, cost, net
select e.id as event_id, d.id as department_id, d.name_he,
  coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.department_id = d.id), 0) as income_planned,
  coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0)        as cost_planned,
  coalesce((select sum(amount) from incomes i where i.event_id = e.id and i.department_id = d.id and i.status = 'confirmed'), 0) as income_actual,
  coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0) as cost_actual
from events e join departments d on d.camp_id = e.camp_id and d.kind = 'fundraiser' and d.is_active;

-- management dashboard: one row per event with the macro numbers
create or replace view v_management_dashboard as
select e.id as event_id, e.name, e.year,
  (select sum(planned_amount) from budget_lines b where b.event_id = e.id)                                        as planned_total,
  (select sum(amount) from expenses x where x.event_id = e.id and x.status <> 'rejected')                        as actual_total,
  (select sum(p.amount) from payments p join funds f on f.id = p.fund_id
    where p.event_id = e.id and p.status = 'confirmed' and f.in_refund_pool)                                      as collected_total,
  (select sum(i.amount) from incomes i where i.event_id = e.id and i.status = 'confirmed')                        as other_income_total,
  (select sum(actual) from v_event_balance b where b.event_id = e.id and b.side = 'income')
  - (select sum(actual) from v_event_balance b where b.event_id = e.id and b.side = 'expense')                    as net_result,
  (select sum(c.amount_due) from v_member_charges c join funds f on f.id = c.fund_id
    where c.event_id = e.id and f.in_refund_pool)                                                                 as expected_total,
  (select count(*) from v_member_ledger l where l.event_id = e.id and l.paid < l.due)                            as members_not_fully_paid,
  (select sum(-balance) from v_member_ledger l where l.event_id = e.id and l.balance < 0)                        as refunds_owed_total,
  (select count(*) from v_department_budget_vs_actual d where d.event_id = e.id and d.actual > d.planned)        as departments_over_budget
from events e;

-- the balance sheet of an event: every shekel in, by category, and every shekel out, by department
create or replace view v_event_balance as
select e.id as event_id, 'income' as side, f.kind::text as category, f.name_he as name,
       coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.fund_kind = f.kind), 0) as planned,
       coalesce((select sum(amount) from payments p where p.fund_id = f.id and p.status = 'confirmed'), 0)
     + coalesce((select sum(amount) from incomes i where i.fund_id = f.id and i.status = 'confirmed'), 0) as actual
from events e join funds f on f.event_id = e.id
union all
select e.id, 'expense', d.slug, d.name_he,
       coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0),
       coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0)
from events e join departments d on d.is_active;

create or replace view v_fundraiser_net as              -- a fundraiser department: planned & actual income, cost, net
select e.id as event_id, d.id as department_id, d.name_he,
  coalesce((select sum(planned_amount) from budget_income_lines b where b.event_id = e.id and b.department_id = d.id), 0) as income_planned,
  coalesce((select sum(planned_amount) from budget_lines b where b.event_id = e.id and b.department_id = d.id), 0)        as cost_planned,
  coalesce((select sum(amount) from incomes i where i.event_id = e.id and i.department_id = d.id and i.status = 'confirmed'), 0) as income_actual,
  coalesce((select sum(amount) from expenses x where x.event_id = e.id and x.department_id = d.id and x.status <> 'rejected'), 0) as cost_actual
from events e join departments d on d.camp_id = e.camp_id and d.kind = 'fundraiser' and d.is_active;

-- management dashboard: one row per event with the macro numbers
create or replace view v_management_dashboard as
select e.id as event_id, e.name, e.year,
  (select sum(planned_amount) from budget_lines b where b.event_id = e.id)                                        as planned_total,
  (select sum(amount) from expenses x where x.event_id = e.id and x.status <> 'rejected')                        as actual_total,
  (select sum(p.amount) from payments p join funds f on f.id = p.fund_id
    where p.event_id = e.id and p.status = 'confirmed' and f.in_refund_pool)                                      as collected_total,
  (select sum(i.amount) from incomes i where i.event_id = e.id and i.status = 'confirmed')                        as other_income_total,
  (select sum(actual) from v_event_balance b where b.event_id = e.id and b.side = 'income')
  - (select sum(actual) from v_event_balance b where b.event_id = e.id and b.side = 'expense')                    as net_result,
  (select sum(c.amount_due) from v_member_charges c join funds f on f.id = c.fund_id
    where c.event_id = e.id and f.in_refund_pool)                                                                 as expected_total,
  (select count(*) from v_member_ledger l where l.event_id = e.id and l.paid < l.due)                            as members_not_fully_paid,
  (select sum(-balance) from v_member_ledger l where l.event_id = e.id and l.balance < 0)                        as refunds_owed_total,
  (select count(*) from v_department_budget_vs_actual d where d.event_id = e.id and d.actual > d.planned)        as departments_over_budget
from events e;

-- ---------- Row Level Security (skeleton; policies refined in week 3) ----------
alter table expenses enable row level security;
alter table payments enable row level security;
alter table payouts enable row level security;
alter table member_private enable row level security;   -- admin-only policy in week 3
