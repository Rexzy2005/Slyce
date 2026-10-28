# Slyce Current State

Updated: 2026-10-28. Target: GoodDollar Season 5. Web + installable PWA on Vercel with an independently runnable backend (ADR-0004, ADR-0005). Repo/packages renamed to Slyce.

## Backend foundation

- P1 is implemented and verified in `backend/`: Node 24 TypeScript service, validated environment configuration, structured JSON logging, centralized HTTP errors, `/healthz`, `/readyz`, tests, and Render deployment configuration.
- P2 database foundation is implemented and verified against the authorized development Supabase database: the initial migration is applied and `prisma migrate status` reports the schema up to date.
- P3 security foundation is implemented: CORS allowlisting, request-size limits, fixed-window rate limiting, safe security errors, Supabase Auth bearer verification, administrator email allowlisting, and server-side role/ownership authorization primitives.
- P4 API contract and session foundation is verified: versioned `/api/v1` route groups, Zod request validation, stable error envelopes, cursor/limit pagination, idempotency-key validation, protected `GET /api/v1/session`, and principal mapping to Prisma `Player`/`AdminAccount` records.
- P5 admin dashboard foundation is verified: a responsive, branded `/admin` operations console with Supabase email-link access, backend session verification, protected empty states, and no fabricated metrics. Domain management screens remain intentionally disabled until their backend phases are implemented.
- Administrator email-link access uses an accessible in-product modal with validation, pending/error/success states, focus containment, responsive styling, and origin-derived redirect URLs; no browser prompt or alert remains.
- P6 player-record foundation is implemented: authenticated `/api/v1/players/me`, administrator `/api/v1/admin/players`, Prisma-backed player/wallet/GoodDollar-state reads, and typed service boundaries. GoodDollar external verification and wallet-association mutations remain gated by unresolved official integration and ownership verification requirements.
- GoodDollar standard-web verification now parses the official return parameters, removes them from the URL, re-checks status through the pinned Citizen SDK, and records an independent Celo Identity observation through the backend. The backend persists minimal wallet/environment/root/timestamp metadata and the admin dashboard counts unique verified root identities. MiniPay is intentionally out of scope.
- P7 includes an approved deterministic `verified-fruit-slice-v1` replay simulator, digest checking, persisted replay inputs, authenticated create/finish routes, pending-score verification/promotion, a standard Celo wallet challenge session, and a public verified-score leaderboard. The player-facing verified mode is separate from local practice mode.
- P8 challenge backend is implemented: administrator lifecycle APIs, structured rules, version-bound participation, published retrieval, verified-gameplay progress evaluation, completion persistence, and reward-eligibility creation. Admin/player challenge UI, retry idempotency, scheduling automation, and live-database integration tests remain.
- P9 bounty backend is implemented: administrator lifecycle and submission review APIs, public retrieval, player participation/evidence submission, and bounty-specific leaderboard retrieval. Admin/player bounty UI, complete eligibility enforcement, final-standing snapshots, common reward workflow integration, and live-database integration tests remain.
- P10 reward backend is implemented: player/admin queues, role-gated approval and rejection, separately recorded manual distribution, confirmation evidence, duplicate prevention, and audit logging. The protected dashboard controls, migration deployment, and executable verification remain.
- P11 implementation is complete: persisted player/game/content/reward metrics, distinct GoodDollar root-identity counts, database-backed readiness, protected filtered/paginated audit retrieval, audit indexing, and responsive admin metrics/audit views with loading/error/empty/search/pagination states. Automated verification passes; target-database performance and browser acceptance remain.
- P12 automated quality assurance is complete: structured validation errors, streamed request-size enforcement, authorization and redaction tests, cross-player bounty isolation, atomic/recoverable score verification, retry-safe score results, and concurrency regression coverage are implemented and verified.
- P13 repository preparation is complete: the Render Blueprint generates Prisma, builds the backend, validates production configuration, deploys migrations before promotion, and uses database-backed readiness. The production handover documents environment, deployment, migration, verification, recovery, troubleshooting, and administrator onboarding.
- The configured Supabase database is reachable and all seven Prisma migrations are applied, including reward workflow integrity, operational audit indexing, and atomic score-verification claim support.
- The Render backend is live at https://slyce-setp.onrender.com and /healthz returns 200. It is not yet healthy for promotion because /readyz returns 503 with database unreachable; the Render DATABASE_URL configuration must be corrected and redeployed.

## Implemented and verified

- **App shell:** `/` redirects to `/play`, and the PWA `start_url` is `/play`. Top bar with G$ balance and account; bottom tabs (Play, Compete, Shop, Get G$, Me). The landing page, sidebar and drawer were removed.
- **Sign-in (Reown AppKit 1.8.24):** email (embedded wallet) or external wallet. Every app route sits behind `SignInGate`, and wrong-network wallets are asked to switch to Celo. A low-CELO banner points players to the GoodDollar faucet path.
- **Paid rounds:** each round calls `SlyceArcade.play` (default 1 G$). The arena starts only after confirmation. One approval covers 10 rounds.
- **Game (ADR-0003):** practice scoring with lives, bombs, combos, game over and a device-local best.
- **Contracts (UUPS, ADR-0005):** `SlyceShop`, `SlyceTournament` (cancel/refund, liabilities accounting) and `SlyceArcade`. 57 Foundry tests: unit, fuzz (1,000 runs), invariant (256×64), upgrade and a Celo fork test with real G$. Coverage is 96% of lines and 100% of functions. `@openzeppelin/upgrades-core` 1.46.0 validation passes, including V1→V2 layouts.
- **Web integration:** Shop, Tournament (enter, submit score, refund), Rewards (proof-verified claims) and Profile read the proxies. GoodDollar `/get-gd` handles verification, the daily claim and free gas via the faucet.
- **Checks:** typecheck, 70 unit tests in 19 files (Node 24.21.0), lint, format, core, production build with and without full wallet config. Pre-rendered pages show the sign-in screen, and `/` redirects.

## Not verified

- No browser/device testing (the user prohibits use of their PC browser). The Playwright specs were rewritten for the gate but not run.
- Real email sign-in, face verification, UBI claim and faucet top-up: these need Reown dashboard setup and a real account.
- Contracts are not deployed to mainnet and not audited. The previous non-upgradeable deployment rehearsal is obsolete.

## Known gaps

- Legacy tournament scores are still self-reported and must not be confused with the separate server-verified leaderboard path.
- Challenge and bounty backend capabilities do not yet have their required admin/player interfaces.
- Reward backend workflows exist, but the administrator dashboard does not yet expose their controls.
- The restored exact local toolchain passes Prisma generation, backend compilation, all 43 backend tests, backend/web/shared typechecks, architecture checks, core checks, whitespace checks, and git diff --check.
- Production smoke testing remains blocked until Render /readyz returns 200 and the frontend is configured against the deployed backend.
- Streak rewards and power-ups are not implemented.
- Local Node is 22.10; the project needs 24.21.0.
- The low-gas threshold (0.005 CELO) is a product estimate.

## Next action

An authorized operator must deploy Render and the frontend through docs/operations/PRODUCTION_HANDOVER.md, complete the remaining production checklist, and retain deployment evidence.
