# Prisma and Supabase PostgreSQL

**Verified:** 2026-10-27  
**Applies to:** `@prisma/client`, `prisma`, and `@prisma/adapter-pg` 7.10.1; Slyce backend

## Findings

- Prisma ORM 7 supports PostgreSQL hosted by Supabase.
- Runtime application traffic and Prisma CLI/migration traffic should use separate connection variables where pooling is involved.
- Slyce uses `DATABASE_URL` for the backend runtime and `DIRECT_URL` for Prisma CLI and migration commands.
- The Prisma schema remains at `backend/prisma/schema.prisma`; configuration is in `backend/prisma.config.ts`, which loads `DIRECT_URL`.
- Production schema changes must use committed Prisma migrations and `prisma migrate deploy`; `prisma db push` is not the production workflow.
- No connection string or credential is stored in this repository. Connectivity and migration execution require an authorized development database.

## Official sources

- Prisma PostgreSQL connector: https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql
- Supabase Prisma guide: https://supabase.com/docs/guides/database/prisma

