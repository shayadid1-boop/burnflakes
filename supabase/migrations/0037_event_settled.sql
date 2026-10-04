-- 0037 (4.10): money for a member works in two separate stages, and the screens now show them apart.
--   1. Before and during the event: everyone pays the same camp dues (1,500 ₪). Nothing is
--      subtracted from it — not money spent out of pocket, not a share of a future surplus.
--   2. After the event, once the treasurer has everything in and approved: each member's
--      out-of-pocket expenses and share of whatever is left over are worked out, and refunds go out.
-- This flag is the switch between the two. The treasurer turns it on from the finance screen.
alter table events add column if not exists settled boolean not null default false;
