-- 0020 (16.9): clear the scratch scenarios and seed the six Shay wants to compare.
-- All six share the same build: 500 m² shade, 5 breakfasts, 5 dinners, 2025 prices from the cost catalog.
-- They differ in two things only: how many members (35 / 40 / 45) and whether the retreat happens
-- (a fundraiser income line of 10,000 ₪, which lowers the dues per member).

-- 1) the approved scenario keeps its budget and gets a clear name; every other scenario goes
update scenarios set name = 'תרחיש בסיס'
 where event_id = '00000000-0000-0000-0000-000000002026' and status = 'approved';
delete from scenarios
 where event_id = '00000000-0000-0000-0000-000000002026' and status <> 'approved';

-- 2) the shade line carried "460 מ״ר" in its name; the area is a parameter, so drop it from the label
update cost_items set name_he = 'רשת צל + הקמה'
 where name_he = 'רשת צל + הקמה 460 מ"ר';

-- 3) the six scenarios
do $$
declare
  v_event uuid := '00000000-0000-0000-0000-000000002026';
  v_fund  uuid := (select id from departments where slug = 'fundraiser');
  v record; v_id uuid;
  p_members uuid := (select id from scenario_parameters where key = 'member_count');
  p_shade   uuid := (select id from scenario_parameters where key = 'shade_area_sqm');
  p_break   uuid := (select id from scenario_parameters where key = 'breakfast_count');
  p_dinner  uuid := (select id from scenario_parameters where key = 'dinner_count');
begin
  for v in select * from (values (35, false), (40, false), (45, false), (35, true), (40, true), (45, true))
                         as t(members, retreat) loop
    insert into scenarios (event_id, name, description, status)
    values (
      v_event,
      v.members || ' חברים · ' || case when v.retreat then 'עם ריטריט' else 'בלי ריטריט' end,
      '500 מ״ר הצללה · 5 ארוחות בוקר · 5 ארוחות ערב · מחירי 2025'
        || case when v.retreat then ' · הכנסה של 10,000 ₪ מהריטריט' else '' end,
      'draft')
    returning id into v_id;

    -- start from the catalog defaults, then set the four parameters that define this scenario
    insert into scenario_parameter_values (scenario_id, parameter_id, value)
      select v_id, id, default_value from scenario_parameters;
    update scenario_parameter_values set value = to_jsonb(v.members) where scenario_id = v_id and parameter_id = p_members;
    update scenario_parameter_values set value = to_jsonb(500)       where scenario_id = v_id and parameter_id = p_shade;
    update scenario_parameter_values set value = to_jsonb(5)         where scenario_id = v_id and parameter_id = p_break;
    update scenario_parameter_values set value = to_jsonb(5)         where scenario_id = v_id and parameter_id = p_dinner;

    if v.retreat then
      insert into scenario_income_lines (scenario_id, fund_kind, department_id, name_he, amount, notes)
      values (v_id, 'fundraiser', v_fund, 'ריטריט — אירוע גיוס', 10000, 'הכנסה נטו שמפחיתה את דמי הקמפ');
    end if;

    perform compute_scenario(v_id);
  end loop;
end $$;
