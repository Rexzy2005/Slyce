# Production Deployment and Operations

## Release status

The repository is deployment-ready, but no production deployment is recorded. Release completion requires an authorized operator to supply production credentials, apply migrations, and record the checklist below. Never commit secrets.

## Architecture and configuration

- Frontend: Next.js with public build-time configuration.
- Backend: Render Node service defined by render.yaml.
- Data and authentication: Supabase PostgreSQL and Supabase Auth.
- Runtime data access uses DATABASE_URL; migrations use DIRECT_URL.
- /healthz is liveness; /readyz verifies database readiness and is the Render health check.

Required backend values are NODE_ENV=production, DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAILS, CORS_ORIGINS, and a random AUTH_SESSION_SECRET of at least 32 characters. GoodDollar production observation additionally requires GOODDOLLAR_ENV=production plus a verified GOODDOLLAR_RPC_URL and GOODDOLLAR_IDENTITY_ADDRESS pair. Render supplies PORT.

Set NEXT_PUBLIC_BACKEND_URL to the deployed HTTPS backend origin. Configure all other frontend values from .env.example with production-matching Supabase, network, RPC, Reown, GoodDollar, and contract values. Public variables are embedded at build time and require a frontend redeploy when changed.

## Deployment procedure

1. Confirm an approved Supabase backup or point-in-time recovery window.
2. Review every pending migration. Never use db push or a destructive reset in production.
3. Create or update the Render Blueprint from render.yaml.
4. Enter every sync:false secret in Render and restrict edit access.
5. Run pnpm --filter @slyce/backend deployment:check.
6. Deploy. Render generates Prisma Client and builds, then runs prisma migrate deploy before promotion.
7. Confirm /healthz and /readyz return 200 over HTTPS.
8. Configure the frontend backend URL and matching Supabase/CORS values, then redeploy it.
9. Complete and retain the production verification record.

## Production verification

- [ ] Render deployment and pre-deploy migration succeeded.
- [ ] Prisma migration status reports no pending migration.
- [ ] /healthz and /readyz return 200.
- [ ] An allowlisted administrator authenticates; a non-admin is denied admin routes.
- [ ] Metrics and audit pagination load without sensitive snapshots.
- [ ] Published challenges and bounties are public while drafts remain private.
- [ ] A player verifies a gameplay round and sees persistent ranking data.
- [ ] Participation and evidence ownership restrictions hold.
- [ ] Reward approval and manual distribution evidence remain separate.
- [ ] GoodDollar succeeds when configured and degrades safely when unavailable.
- [ ] CORS rejects an unapproved origin and accepts the production frontend.
- [ ] Logs contain no tokens, secrets, connection strings, or audit snapshots.

## Administration, recovery, and troubleshooting

Add a verified, lowercased administrator email to ADMIN_EMAILS, redeploy, and confirm Supabase Auth returns the same email. Use the least application role required. Removing an email and redeploying revokes new administrator sessions.

- Confirm Supabase backup retention before every schema release.
- Roll back application code by deploying the last known-good commit.
- Treat database migrations as forward-only. Restore an approved backup or deploy a reviewed corrective migration rather than improvising a reverse migration.
- If /readyz fails, stop promotion, inspect Render and Supabase, verify pooler limits and connection values, and do not route traffic until readiness recovers.
- For authentication failures, compare the frontend/backend Supabase project, redirect allowlists, ADMIN_EMAILS, and network health.
- For CORS failures, compare the browser Origin exactly with CORS_ORIGINS; never use a wildcard for authenticated production traffic.
- For GoodDollar failures, preserve core availability and inspect RPC health plus environment/address pairing.

Record the commit, Render deploy ID, migration output, timestamp, operator, correlation information, and remediation for each release or incident. Never record credentials or full connection strings.

## Known limitations

- External production deployment, database connectivity, and device/browser acceptance require authorized accounts and cannot be proven by repository-only checks.
- Manual reward distribution records evidence; it does not execute an on-chain payment.
- GoodDollar support depends on correct Celo configuration and upstream availability.
