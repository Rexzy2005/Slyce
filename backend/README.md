# Slyyce backend

The backend is an independently runnable Node.js service providing authenticated player/admin APIs, persisted gameplay verification and leaderboards, challenges, bounties, rewards, and operational visibility.

## Local commands

Run from the repository root with Node `24.21.0`:

```text
pnpm --filter @slyyce/backend dev
pnpm --filter @slyyce/backend build
pnpm --filter @slyyce/backend test
```

The default listener is `0.0.0.0:3001`. Set `PORT`, `HOST`, or `NODE_ENV` through the environment. `GET /healthz` returns a liveness response. `GET /readyz` remains `503` until the database integration is implemented in P2.

## Render

Configure a Render web service from the repository root with:

- Build command: `pnpm install --frozen-lockfile && pnpm --filter @slyyce/backend build`
- Start command: `pnpm --filter @slyyce/backend start`
- Pre-deploy command: deployment:check followed by db:migrate:deploy
- Health check path: /readyz

The service must provide its own environment variables in Render. Deployment, migration, recovery, and verification are documented in docs/operations/PRODUCTION_HANDOVER.md.

Security configuration is provided through `CORS_ORIGINS`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MS`, and `RATE_LIMIT_MAX_REQUESTS`. Production requires an explicit non-empty `CORS_ORIGINS` allowlist.

API contracts and the route inventory are documented in docs/API_CONTRACTS.md.

On-chain activity for `/admin` (ADR-0012): set `SLYYCE_ARCADE_ADDRESS`, `SLYYCE_TOURNAMENT_ADDRESS`, `SLYYCE_SHOP_ADDRESS` and `SLYYCE_CONTRACTS_START_BLOCK` (mainnet: block `81391119`), plus `CHAIN_RPC_URL` or `GOODDOLLAR_RPC_URL`. Without them, `/api/v1/admin/chain/*` returns 503.

Administrator authentication is backend-owned. Configure `SLYCE_ADMIN_EMAILS`, provide `SLYCE_ADMIN_SEED_EMAIL` and `SLYCE_ADMIN_SEED_PASSWORD` only for the one-time seed command, then remove the seed password from the environment. The seed creates an idempotent active `ADMIN` account with a salted scrypt password hash. Login creates a rotated 30-day HttpOnly session cookie; logout revokes it, and every protected request rechecks account status, role, and the current allowlist. The existing Reown/AppKit wallet and email UX remains unchanged for players.

Seed the initial account with:

```text
pnpm --filter @slyyce/backend admin:seed
```

The seed command never prints or returns the password. It fails closed when the seed email is absent from `SLYCE_ADMIN_EMAILS` or the password is missing.

## Database and Prisma

P2 uses Prisma `7.10.1` with PostgreSQL and separates runtime and migration connection variables:

- `DATABASE_URL`: runtime connection. Use a Supabase pooled/session connection appropriate for the Render service.
- `DIRECT_URL`: Prisma CLI/migration connection. Use a direct or session-mode Supabase connection.
- `SUPABASE_CA_CERT`: the PEM contents of the CA certificate downloaded from Supabase Database Settings > SSL Configuration. The backend passes it to `pg` with certificate verification enabled; do not use `rejectUnauthorized=false`.

Copy `backend/.env.example` to a local, ignored environment file and replace the placeholders with credentials supplied by the project owner. Never commit those values.

The initial schema is `backend/prisma/schema.prisma`, and the reviewed initial migration is under `backend/prisma/migrations/`. Run these commands from the repository root only against an authorized development database:

```text
pnpm --filter @slyyce/backend db:validate
pnpm --filter @slyyce/backend db:generate
pnpm --filter @slyyce/backend db:migrate:dev -- --name <descriptive_name>
pnpm --filter @slyyce/backend db:migrate:status
```

Production uses `db:migrate:deploy` with `DIRECT_URL`; it must not use `db push` or destructive reset commands. No database connection or migration was executed while creating P2 because no development database credentials were available.
codex resume 01a18117-4c12-7693-951b-db2269458d8c
