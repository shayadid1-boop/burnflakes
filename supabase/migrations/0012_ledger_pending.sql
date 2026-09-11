-- 0012: pending (not yet approved) expenses do not count in the ledger — neither as fronted money nor in the surplus pool.
-- (QA 11.9: a pending expense already showed as 'to refund'.) Only approved / reimbursed / closed expenses count.
create or replace view v_member_ledger as
with pool as (   -- surplus of the refund pool = everything collected into pooled funds - all expenses
  select e.id as event_id,
         coalesce((select sum(p.amount) from payments p join funds f on f.id = p.fund_id
                   where p.event_id = e.id and p.status = 'confirmed' and f.in_refund_pool), 0)
       + coalesce((select sum(i.amount) from incomes i join funds f on f.id = i.fund_id
                   where i.event_id = e.id and i.status = 'confirmed' and f.in_refund_pool), 0)
       - coalesce((select sum(x.amount) from expenses x where x.event_id = e.id and x.status not in ('pending', 'rejected')), 0) as surplus,
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
              and x.paid_from = 'member_pocket' and x.status not in ('pending', 'rejected')), 0) as fronted,
    coalesce((select sum(po.amount) from payouts po where po.event_member_id = em.id and po.status = 'confirmed'), 0) as paid_out
  from event_members em join members m on m.id = em.member_id
)
select pm.*,
       round(pool.surplus * pm.participation_share / nullif(pool.total_shares, 0), 2) as surplus_share,
       -- positive = member still owes the camp, negative = camp owes the member (refund)
       round(pm.due - pm.paid - pm.fronted - pool.surplus * pm.participation_share / nullif(pool.total_shares, 0) + pm.paid_out, 2) as balance
from per_member pm join pool on pool.event_id = pm.event_id;
alter view v_member_ledger set (security_invoker = true);
revoke select on v_member_ledger from anon, authenticated;
