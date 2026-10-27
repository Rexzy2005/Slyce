# Slyce Current State

Updated: 2026-10-27. Target: GoodDollar Season 5. Web + installable PWA on Vercel with an independently runnable backend foundation (ADR-0004, ADR-0005). Repo/packages renamed to Slyce.

## Backend foundation

- P1 is implemented and verified in `backend/`: Node 24 TypeScript service, validated environment configuration, structured JSON logging, centralized HTTP errors, `/healthz`, `/readyz`, tests, and Render deployment configuration.
- P2 database foundation is implemented and verified against the authorized development Supabase database: the initial migration is applied and `prisma migrate status` reports the schema up to date.
- P3 security foundation is implemented: CORS allowlisting, request-size limits, fixed-window rate limiting, safe security errors, Supabase Auth bearer verification, administrator email allowlisting, and server-side role/ownership authorization primitives.
- P4 API contract and session foundation is verified: versioned `/api/v1` route groups, Zod request validation, stable error envelopes, cursor/limit pagination, idempotency-key validation, protected `GET /api/v1/session`, and principal mapping to Prisma `Player`/`AdminAccount` records.
- P5 admin dashboard foundation is verified: a responsive, branded `/admin` operations console with Supabase email-link access, backend session verification, protected empty states, and no fabricated metrics. Domain management screens remain intentionally disabled until their backend phases are implemented.
- P6 player-record foundation is implemented: authenticated `/api/v1/players/me`, administrator `/api/v1/admin/players`, Prisma-backed player/wallet/GoodDollar-state reads, and typed service boundaries. GoodDollar external verification and wallet-association mutations remain gated by unresolved official integration and ownership verification requirements.
- GoodDollar standard-web verification now parses the official return parameters, removes them from the URL, re-checks status through the pinned Citizen SDK, and records an independent Celo Identity observation through the backend. The backend persists minimal wallet/environment/root/timestamp metadata and the admin dashboard counts unique verified root identities. MiniPay is intentionally out of scope.
- P7 gameplay foundation is in progress: gameplay session and score contracts, input-digest support, ownership/expiry/bounds validation, Prisma session persistence, idempotent pending-score storage, an explicit verifier interface, and deterministic ranking/pagination helpers exist as an isolated service boundary. No authoritative score route or leaderboard persistence is enabled because the current Phaser runtime is practice-only.
- P7 now also has a Prisma-backed public verified-leaderboard route for period filtering, deterministic ranking, display names, and pagination. It returns only scores already promoted to `VERIFIED`; the current practice runtime still cannot produce such records.
- P7 now includes an approved deterministic `verified-fruit-slice-v1` replay simulator, digest checking, pending-score verification/promotion service, persisted replay inputs, authenticated create/finish gameplay routes, and a standard Celo wallet challenge session. The player-facing verified mode is connected separately from practice mode; MiniPay remains out of scope.
- Domain feature endpoints remain unimplemented; authoritative gameplay verification and official GoodDollar integration gates remain open.

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

- Leaderboard: no backend. Tournament scores are self-reported (operator review).
- Streak rewards and power-ups are not implemented.
- Local Node is 22.10; the project needs 24.21.0.
- The low-gas threshold (0.005 CELO) is a product estimate.

## Next action

See `docs/handoffs/CURRENT.md`.
