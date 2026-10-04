-- 0036 (4.10): Dar signs in with d.studio.dar@gmail.com, but the roster had her old address
-- (hamtzania@gmail.com), so the system could not match her login to her member record and showed
-- "this email is not on the members list". Her record now carries the address she actually uses;
-- the old one is kept in the notes in case it is needed.
update members
   set notes = trim(both ' ' from coalesce(notes, '') || ' מייל קודם: ' || email),
       email = 'd.studio.dar@gmail.com'
 where first_name = 'דר' and last_name = 'חמצני'
   and lower(coalesce(email, '')) <> 'd.studio.dar@gmail.com';
