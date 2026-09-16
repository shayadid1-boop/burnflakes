-- 0022 (16.9): Shay went over the auto-flagged production volunteers.
-- Niv's installation is a Burnflakes thing, not a Midburn production department, so the three
-- people listed under it do not get the shift credit. That leaves four who do:
-- אופיר שני (מרפאה) · משה כגן (מחלקת תנועה) · רוני גילה (מחלקת תנועה) · עדי שבתאי (מיצב).
update event_members
   set production_volunteer = false
 where event_id = '00000000-0000-0000-0000-000000002026'
   and btrim(coalesce(volunteer_dept, '')) = 'מיצב ניב';
