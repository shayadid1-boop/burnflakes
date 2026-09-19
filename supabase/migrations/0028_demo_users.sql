-- 0028 (19.9): two test people so Shay can see the system through other eyes.
--
-- The addresses are plus-addresses on Shay's own mailbox: gmail delivers anything after the "+"
-- to the same inbox, so the login links arrive at him, while the system treats them as two
-- separate people. No fake mailbox, no password invented for someone else — he sets each
-- password himself the first time he signs in.
--
-- They are marked attending = false so they never count in the member total, the dues or the
-- shift share; they exist only to look at screens. Deleting them later removes nothing real.

insert into members (first_name, last_name, email, is_active, notes)
values ('בדיקה', 'חבר', 'shayadid1+member@gmail.com', true, 'משתמש בדיקה — חבר רגיל'),
       ('בדיקה', 'ראש מחלקה', 'shayadid1+lead@gmail.com', true, 'משתמש בדיקה — ראש מחלקה')
on conflict (camp_id, first_name, last_name) do update set email = excluded.email, notes = excluded.notes;

insert into event_members (event_id, member_id, role, tier, attending, participation_share)
select '00000000-0000-0000-0000-000000002026', m.id,
       case when m.last_name = 'ראש מחלקה' then 'dept_lead'::member_role else 'member'::member_role end,
       'core', false, 0
  from members m
 where m.first_name = 'בדיקה' and m.last_name in ('חבר', 'ראש מחלקה')
on conflict (event_id, member_id) do update set role = excluded.role, attending = false, participation_share = 0;

-- the test lead gets ארט, a department with real budget lines and expenses to look at.
-- Geva stays its lead too — a department may have more than one.
insert into department_leads (event_id, department_id, event_member_id)
select '00000000-0000-0000-0000-000000002026',
       (select id from departments where slug = 'art'),
       em.id
  from event_members em join members m on m.id = em.member_id
 where em.event_id = '00000000-0000-0000-0000-000000002026'
   and m.first_name = 'בדיקה' and m.last_name = 'ראש מחלקה'
on conflict do nothing;
