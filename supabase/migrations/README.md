Migrations run automatically by GitHub Actions (.github/workflows/db.yml) via supabase/migrate.sh.
Naming: NNNN_description.sql, applied in order once; applied names are recorded in public._migrations.
0000 = baseline schema (copy of ../schema.sql), 0001-0003 = 2025/2022/2026 data. New changes go in new files, never edit applied ones.
