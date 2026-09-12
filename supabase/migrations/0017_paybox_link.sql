-- 0017: "pay camp dues" from the app. The event carries the PayBox group link; a member reports "I paid" which creates a
-- pending payment (amount = what they owe) that the treasurer confirms in the treasury screen.
alter table events add column if not exists payment_link text;
alter table events add column if not exists payment_link_label text not null default 'PayBox';
update events set payment_link = 'https://links.payboxapp.com/787IIUOln6b' where id = '00000000-0000-0000-0000-000000002026' and payment_link is null;

create or replace function report_payment(p_event uuid, p_amount numeric, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_em uuid; v_fund uuid; v_id uuid;
begin
  v_em := my_event_member_id(p_event);
  if v_em is null then raise exception 'not a member of this event'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select id into v_fund from funds where event_id = p_event and key = 'camp_dues';
  if v_fund is null then select id into v_fund from funds where event_id = p_event and from_members limit 1; end if;
  if v_fund is null then raise exception 'no dues fund yet — the treasurer must approve a budget first'; end if;
  insert into payments (event_id, fund_id, event_member_id, amount, method, status, paid_at, notes)
  values (p_event, v_fund, v_em, p_amount, 'paybox', 'pending', current_date, p_notes) returning id into v_id;
  return v_id;
end $$;
grant execute on function report_payment(uuid, numeric, text) to authenticated;
