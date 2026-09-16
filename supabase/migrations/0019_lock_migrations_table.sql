-- 0019 (16.9): Supabase's Security Advisor flagged public._migrations — the bookkeeping table the
-- GitHub Actions pipeline writes to — as readable through the API. It holds only migration file names,
-- but there is no reason for anyone outside the pipeline to see it. RLS on, no policies, no grants:
-- the service role that runs migrations bypasses RLS, everyone else gets nothing.
-- (Guarded: the table exists only where the pipeline created it.)
do $$
begin
  if to_regclass('public._migrations') is not null then
    execute 'alter table public._migrations enable row level security';
    execute 'revoke all on public._migrations from anon, authenticated';
  end if;
end $$;
