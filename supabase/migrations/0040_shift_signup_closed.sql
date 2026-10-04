-- 0040 (4.10): the shift board is final, so it starts clean and closed.
--   1. everyone who signed up so far is taken off the 2026 board (the shifts themselves stay);
--   2. a switch on the event — sign-up open or closed. It starts CLOSED; an admin opens it from the
--      shifts screen once the camp has been told. While closed, members cannot take or drop a shift;
--      department leads and admins can still place people by hand.
--   The switch is enforced in the database, not only hidden on the screen.

alter table events add column if not exists shifts_open boolean not null default false;
update events set shifts_open = false where id = '00000000-0000-0000-0000-000000002026';

delete from shift_assignments a
 using shifts s
 where a.shift_id = s.id and s.event_id = '00000000-0000-0000-0000-000000002026';

drop policy if exists self_register on shift_assignments;
create policy self_register on shift_assignments for insert to authenticated
  with check (exists (select 1 from shifts s join events e on e.id = s.event_id
                      where s.id = shift_id and e.shifts_open
                        and event_member_id = my_event_member_id(s.event_id) and is_attending(s.event_id)));
drop policy if exists self_unregister on shift_assignments;
create policy self_unregister on shift_assignments for delete to authenticated
  using (exists (select 1 from shifts s join events e on e.id = s.event_id
                 where s.id = shift_id and e.shifts_open
                   and event_member_id = my_event_member_id(s.event_id)));
