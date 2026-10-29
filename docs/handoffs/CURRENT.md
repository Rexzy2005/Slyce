# Slyyce Current Handoff

Updated: 2026-10-28

## Objective

Complete the external P13 production deployment using the prepared Render/Supabase/frontend procedure.

## Done

See `docs/CURRENT_STATE.md` and `docs/backend-implementation/PROGRESS-TRACKER.md`. The backend currently includes Prisma/Supabase persistence, Supabase admin authentication, origin-bound wallet authentication, deterministic verified gameplay, leaderboards, challenge management/progress, and bounty management/submissions/leaderboards.

## Remaining, in order

1. Correct the Render DATABASE_URL to match the verified runtime connection, redeploy, and require /readyz to return 200.
2. Confirm backup settings and verified GoodDollar values; database migrations are already current.
3. Configure and redeploy the frontend against the production backend. Use the Vercel env vars from `.env.example` with the deployed contract proxies (`contracts/README.md`, Celo mainnet, development G$), and add the Vercel domain in the Reown dashboard.
4. Complete every production verification item and retain deployment evidence.
5. Mark P13 Verified only after those external checks pass.

## Notes

- Use Node 24.21.0 (jsdom tests fail on 22.10).
- The exact local toolchain was restored sufficiently to regenerate Prisma and complete backend/workspace verification without dependency changes.
- Verification evidence: backend build; 43/43 backend tests; production preflight; backend, web, and shared typechecks; architecture, core, whitespace, and diff checks pass.
- Render is live at https://slyce-setp.onrender.com: /healthz returns 200, but /readyz returns 503 database unreachable.
- The same backend DATABASE_URL succeeds in a local read-only Prisma connection check, so inspect the Render value, whitespace/quoting, and redeploy.
- The configured Supabase database is reachable; all seven Prisma migrations are applied and migration status is up to date.
- The three new migrations required quoted PostgreSQL identifiers. The initial failed reward migration was rolled back through Prisma and then applied successfully after correction.
- P12 fixed cross-player bounty evidence submission and duplicate score verification under concurrent retries.
- Next.js is pinned to 16.4.3 (16.4.0 had critical advisories GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr and GHSA-p3m5-59mp-jv5r).
- Frontend launch check on a phone: email sign-in, GoodDollar verify and claim, pay 1 G$ and play, buy a blade, enter a tournament.
- Commits must not include AI co-author lines.
- After a contract change: `forge build && node script/export-abis.mjs`.
