# Slyce backend

The backend is an independently runnable Node.js service. It provides the verified P1 foundation plus P2 Prisma/database and P4 API contract infrastructure; feature handlers remain intentionally disabled until authentication and database verification are complete.

## Local commands

Run from the repository root with Node `24.21.0`:

```text
pnpm --filter @slyce/backend dev
pnpm --filter @slyce/backend build
pnpm --filter @slyce/backend test
```

The default listener is `0.0.0.0:3001`. Set `PORT`, `HOST`, or `NODE_ENV` through the environment. `GET /healthz` returns a liveness response. `GET /readyz` remains `503` until the database integration is implemented in P2.

## Render

Configure a Render web service from the repository root with:

- Build command: `pnpm install --frozen-lockfile && pnpm --filter @slyce/backend build`
- Start command: `pnpm --filter @slyce/backend start`
- Health check path: `/healthz`

The service must provide its own environment variables in Render. Database and authentication variables will be documented when their respective phases are implemented.

Security configuration is provided through `CORS_ORIGINS`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MS`, and `RATE_LIMIT_MAX_REQUESTS`. Production requires an explicit non-empty `CORS_ORIGINS` allowlist.

API contracts and the route inventory are documented in the repository root at `docs/API_CONTRACTS.md`. Domain handlers remain disabled until authentication and persistence prerequisites are verified.

Authentication configuration uses Supabase Auth bearer tokens and an explicit, lowercased `ADMIN_EMAILS` allowlist. The backend verifies the token with Supabase Auth before assigning an administrator principal. The existing Reown/AppKit wallet UX remains the player-facing sign-in experience, but player-to-backend session mapping is still required before player mutations are enabled.

## Database and Prisma

P2 uses Prisma `7.10.1` with PostgreSQL and separates runtime and migration connection variables:

- `DATABASE_URL`: runtime connection. Use a Supabase pooled/session connection appropriate for the Render service.
- `DIRECT_URL`: Prisma CLI/migration connection. Use a direct or session-mode Supabase connection.

Copy `backend/.env.example` to a local, ignored environment file and replace the placeholders with credentials supplied by the project owner. Never commit those values.

The initial schema is `backend/prisma/schema.prisma`, and the reviewed initial migration is under `backend/prisma/migrations/`. Run these commands from the repository root only against an authorized development database:

```text
pnpm --filter @slyce/backend db:validate
pnpm --filter @slyce/backend db:generate
pnpm --filter @slyce/backend db:migrate:dev -- --name <descriptive_name>
pnpm --filter @slyce/backend db:migrate:status
```

Production uses `db:migrate:deploy` with `DIRECT_URL`; it must not use `db push` or destructive reset commands. No database connection or migration was executed while creating P2 because no development database credentials were available.
