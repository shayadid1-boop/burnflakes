-- 0038 (4.10): "I paid" could be pressed three times and sent the treasurer three 1,500 ₪ reports,
-- and nothing stopped a member reporting more than the dues. Three guards, all in the database so
-- no amount of clicking (or two phones at once) gets past them:
--   1. one report waiting at a time per member — while one is pending, pressing again returns it
--      instead of making a new one;
--   2. never more than what is still owed on the camp dues (dues − confirmed − already pending);
--   3. a unique index as the last line, so even two requests in the same instant cannot both land.
-- A second group charge (if one is ever opened) is a separate fund with its own dues, and is
-- checked against that fund's amount, not this one.

-- the duplicates already made by the bug: keep each member's earliest pending report, cancel the rest
update payments p
   set status = 'cancelled',
       notes = trim(both ' ' from coalesce(p.notes, '') || ' בוטל אוטומטית: דיווח כפול')
 where p.status = 'pending'
   and exists (
     select 1 from payments q
      where q.event_member_id = p.event_member_id and q.fund_id = p.fund_id and q.status = 'pending'
        and (q.created_at, q.id) < (p.created_at, p.id));

create unique index if not exists payments_one_pending_per_member
  on payments (event_member_id, fund_id) where status = 'pending';

create or replace function report_payment(p_event uuid, p_amount numeric, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_em uuid; v_fund uuid; v_id uuid; v_due numeric; v_paid numeric; v_left numeric;
begin
  v_em := my_event_member_id(p_event);
  if v_em is null then raise exception 'not a member of this event'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'הסכום צריך להיות גדול מאפס'; end if;
  select id into v_fund from funds where event_id = p_event and key = 'camp_dues';
  if v_fund is null then raise exception 'דמי הקמפ עוד לא נקבעו'; end if;

  -- serialize this member's reports, so three fast clicks are handled one after another
  perform pg_advisory_xact_lock(hashtext(v_em::text));

  -- already waiting for the treasurer: hand back that report, make nothing new
  select id into v_id from payments
   where event_member_id = v_em and fund_id = v_fund and status = 'pending' limit 1;
  if v_id is not null then return v_id; end if;

  select coalesce(sum(amount_due), 0) into v_due from v_member_charges where event_member_id = v_em and fund_id = v_fund;
  select coalesce(sum(amount), 0) into v_paid from payments where event_member_id = v_em and fund_id = v_fund and status = 'confirmed';
  v_left := v_due - v_paid;
  if v_left <= 0 then raise exception 'דמי הקמפ כבר שולמו במלואם'; end if;
  if p_amount > v_left then raise exception 'אפשר לדווח עד % ₪ — זה מה שנשאר מדמי הקמפ', v_left; end if;

  insert into payments (event_id, fund_id, event_member_id, amount, method, status, paid_at, notes)
  values (p_event, v_fund, v_em, p_amount, 'paybox', 'pending', current_date, p_notes) returning id into v_id;
  return v_id;
end $$;
grant execute on function report_payment(uuid, numeric, text) to authenticated;
