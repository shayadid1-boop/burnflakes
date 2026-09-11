-- 0014: shifts module (11.9 decisions)
-- 1) departments that are not departments: "installation / kids room" was a one-off 2025 installation, "clinic" does not exist.
--    Deactivated (history stays; inactive departments leave the menus and are not computed in new scenarios). Their 2025 cost items are deactivated too.
update departments set is_active = false where slug in ('installation', 'clinic');
update cost_items set is_active = false where department_id in (select id from departments where slug in ('installation', 'clinic'));
update shift_roles set department_id = (select id from departments where slug = 'misc')
 where department_id in (select id from departments where slug in ('installation', 'clinic'));
update shifts set department_id = (select id from departments where slug = 'misc')
 where department_id in (select id from departments where slug in ('installation', 'clinic'));
delete from department_leads where department_id in (select id from departments where slug in ('installation', 'clinic'));
delete from event_departments where department_id in (select id from departments where slug in ('installation', 'clinic'));

-- 2) production volunteers: a member who volunteers in a Midburn production department this year.
alter table event_members add column if not exists production_volunteer boolean not null default false;
update event_members set production_volunteer = true
 where volunteer_dept is not null and btrim(volunteer_dept) not in ('', 'ברנפלקס');

-- 3) fair-share settings per event
alter table events add column if not exists volunteer_shift_credit integer not null default 1;      -- shifts credited to a production volunteer
alter table events add column if not exists volunteers_count_in_total boolean not null default false; -- credits are added to the pool before dividing

-- 4) fair share: how many shifts each attending member should take
create or replace view v_shift_fair_share as
with pool as (
  select e.id as event_id,
         coalesce((select sum(s.slots) from shifts s where s.event_id = e.id), 0) as total_slots,
         (select count(*) from event_members em where em.event_id = e.id and em.attending) as attendees,
         (select count(*) from event_members em where em.event_id = e.id and em.attending and em.production_volunteer) as volunteers,
         e.volunteer_shift_credit, e.volunteers_count_in_total
  from events e
)
select event_id, total_slots, attendees, volunteers, volunteer_shift_credit, volunteers_count_in_total,
       case when attendees > 0
            then ceil((total_slots + case when volunteers_count_in_total then volunteers * volunteer_shift_credit else 0 end)::numeric / attendees)
            else 0 end as target_per_member
from pool;
alter view v_shift_fair_share set (security_invoker = true);

create or replace view v_member_shift_count as
select em.id as event_member_id, em.event_id, m.first_name, m.last_name, em.attending, em.production_volunteer,
       (select count(*) from shift_assignments a join shifts s on s.id = a.shift_id where a.event_member_id = em.id) as taken,
       case when em.production_volunteer then e.volunteer_shift_credit else 0 end as credit,
       f.target_per_member,
       greatest(0, f.target_per_member
         - (select count(*) from shift_assignments a where a.event_member_id = em.id)
         - case when em.production_volunteer then e.volunteer_shift_credit else 0 end) as remaining
from event_members em
join members m on m.id = em.member_id
join events e on e.id = em.event_id
join v_shift_fair_share f on f.event_id = em.event_id
where em.attending;
alter view v_member_shift_count set (security_invoker = true);

-- 5) admins may change the fair-share settings (events already admin-writable via admin_all); nothing else needed.
grant select on v_shift_fair_share, v_member_shift_count to authenticated;
