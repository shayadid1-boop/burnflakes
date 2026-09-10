#!/usr/bin/env bash
# Apply every supabase/migrations/NNNN_*.sql not yet recorded in public._migrations, in order. Idempotent.
set -euo pipefail
: "${DB_URL:?SUPABASE_DB_URL secret is missing}"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now());"
for f in $(ls supabase/migrations/*.sql | sort); do
  name=$(basename "$f")
  if psql "$DB_URL" -Atc "select 1 from public._migrations where name='$name'" | grep -q 1; then
    echo "skip   $name"; continue
  fi
  echo "apply  $name"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
  psql "$DB_URL" -q -c "insert into public._migrations (name) values ('$name');"
done
echo "done. applied migrations:"; psql "$DB_URL" -Atc "select name from public._migrations order by name"
