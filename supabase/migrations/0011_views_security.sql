-- 0011: views must respect RLS of the caller (found in QA: anonymous key could read v_management_dashboard).
-- security_invoker = true makes every view run with the caller's permissions, so RLS on the underlying tables applies.
do $$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v.relname);
  end loop;
end $$;
-- and nothing for the anonymous role at all: the app always acts as a logged-in member
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
