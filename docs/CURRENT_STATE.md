# Slyyce Current State

Updated: 2026-11-04. Product name: Slyyce. Target: GoodDollar Season 5. Web + installable PWA on Vercel with an independently runnable backend (ADR-0004, ADR-0005, ADR-0011).

## Backend foundation

- P1 is implemented and verified in `backend/`: Node 24 TypeScript service, validated environment configuration, structured JSON logging, centralized HTTP errors, `/healthz`, `/readyz`, tests, and Render deployment configuration.
- P2 database foundation is implemented and verified against the authorized development Supabase database: the initial migration is applied and `prisma migrate status` reports the schema up to date.
- P3 security foundation is implemented: CORS allowlisting, request-size limits, fixed-window rate limiting, safe security errors, Supabase Auth bearer verification, administrator email allowlisting, and server-side role/ownership authorization primitives.
- P4 API contract and session foundation is verified: versioned `/api/v1` route groups, Zod request validation, stable error envelopes, cursor/limit pagination, idempotency-key validation, protected `GET /api/v1/session`, and principal mapping to Prisma `Player`/`AdminAccount` records.
- P5 admin dashboard foundation is verified: a responsive, branded `/admin` operations console with Supabase email OTP access, backend bearer verification, protected empty states, and no fabricated metrics. Domain management screens remain intentionally disabled until their backend phases are implemented.
- Administrator access uses an accessible two-step email/code modal, prevents automatic user creation, rate-limits repeat requests, persists the Supabase refresh session, and enforces a 30-day client-side maximum-age guard. Supabase must use `{{ .Token }}` in its email template and a 30-day time-boxed session setting for authoritative server-side expiry.
- P6 player-record foundation is implemented: authenticated `/api/v1/players/me`, administrator `/api/v1/admin/players`, Prisma-backed player/wallet/GoodDollar-state reads, and typed service boundaries. GoodDollar external verification and wallet-association mutations remain gated by unresolved official integration and ownership verification requirements.
- GoodDollar standard-web verification now parses the official return parameters, removes them from the URL, re-checks status through the pinned Citizen SDK, and records an independent Celo Identity observation through the backend. The backend persists minimal wallet/environment/root/timestamp metadata and the admin dashboard counts unique verified root identities. MiniPay is intentionally out of scope.
- P7 includes an approved deterministic `verified-fruit-slice-v1` replay simulator, digest checking, persisted replay inputs, authenticated create/finish routes, pending-score verification/promotion, a standard Celo wallet challenge session, and a public verified-score leaderboard. The player-facing verified mode is separate from local practice mode.
- P8 challenge backend is implemented: administrator lifecycle APIs, structured rules, version-bound participation, published retrieval, verified-gameplay progress evaluation, completion persistence, and reward-eligibility creation. Admin/player challenge UI, retry idempotency, scheduling automation, and live-database integration tests remain.
- P9 bounty backend is implemented: administrator lifecycle and submission review APIs, public retrieval, player participation/evidence submission, and bounty-specific leaderboard retrieval. Admin/player bounty UI, complete eligibility enforcement, final-standing snapshots, common reward workflow integration, and live-database integration tests remain.
- P10 reward backend is implemented: player/admin queues, role-gated approval and rejection, separately recorded manual distribution, confirmation evidence, duplicate prevention, and audit logging. The protected dashboard controls, migration deployment, and executable verification remain.
- Production web domain is https://www.slyyce.xyz (apex redirects to www). Backend `CORS_ORIGINS` lists explicit origins; a `*` wildcard is rejected in production because credentialed CORS would expose the admin cookie.
- Admin **Sign-ups** view lists everyone who confirmed sign-in, with a sign-in method split and a 30-day daily growth chart. The sign-up is recorded automatically after sign-in, with no prompt (a free background signature, ADR-0013). The separate "verified mode" leaderboard prompt was removed. Players verified before on a device skip the verification check screen on later visits.
- PWA install: the signed-in app shows an **Install Slyyce** banner (snoozed for 7 days by "Not now"), and Profile has an "Add to home screen" button. They use the native install dialog where the browser offers one (the early `beforeinstallprompt` is captured at the root), Safari Share-menu steps on iPhone, and "open in Chrome/Safari" guidance in in-app browsers (Telegram, WhatsApp, Instagram), which cannot install.
- `/stats` and the admin overview show a **G$ in Slyyce** breakdown from the chain index summary (`byKind`). It covers G$ spent by players (shop, tournament entries, round fees, sponsorships) and G$ paid to players (milestones, prizes, refunds). Reward-pot funding by Slyyce is shown separately.
- Daily streaks: the profile shows the *current* streak (0 once a UTC day is missed, because the contract only resets on the next save) and the game-over screen shows the streak after saving.
- Game over saves the score automatically (one `submitGame` transaction per game, still a wallet prompt where the wallet shows one); "Try saving again" appears after a failed or declined save.
- The public `/stats` page has an "All activity" feed of every player transaction (filterable by type, with links to the public record), served by the public `GET /api/v1/chain/transactions`.
- Admin **Players** and **Transactions** views list every wallet and transaction on the live contracts (games, milestone rewards, purchases, tournament entries/sponsors/scores/claims/refunds), with search, type/wallet filters and explorer links. The overview's two user counts, Players and Verified players, both come from the chain (Identity contract for verification). The backend indexes contract logs in memory (ADR-0012); configured on Render. Tested against a mainnet fork; there is no player activity on mainnet yet.
- P11 implementation is complete: persisted player/game/content/reward metrics, distinct GoodDollar root-identity counts, database-backed readiness, protected filtered/paginated audit retrieval, audit indexing, and responsive admin metrics/audit views with loading/error/empty/search/pagination states. Automated verification passes; target-database performance and browser acceptance remain.
- P12 automated quality assurance is complete: structured validation errors, streamed request-size enforcement, authorization and redaction tests, cross-player bounty isolation, atomic/recoverable score verification, retry-safe score results, and concurrency regression coverage are implemented and verified.
- P13 repository preparation is complete: the Render Blueprint generates Prisma, builds the backend, validates production configuration, deploys migrations before promotion, and uses database-backed readiness. The production handover documents environment, deployment, migration, verification, recovery, troubleshooting, and administrator onboarding.
- The configured Supabase database is reachable and all seven Prisma migrations are applied, including reward workflow integrity, operational audit indexing, and atomic score-verification claim support.
- The Render backend is live at https://slyce-setp.onrender.com and /healthz returns 200. It is not yet healthy for promotion because /readyz returns 503 with database unreachable; the Render DATABASE_URL configuration must be corrected and redeployed.

## Implemented and verified

- **App shell:** `/` redirects to `/play`, and the PWA `start_url` is `/play`. Top bar with G$ balance and account; bottom tabs (Play, Compete, Shop, Get G$, Me). The landing page, sidebar and drawer were removed.
- **Sign-in (Magic, `magic-sdk` 33.13.0, ADR-0014):** an Email/Wallet toggle. Email (one-time code) is the default. The Wallet tab lists detected browser wallets, MetaMask, Coinbase Wallet and "Other wallets" (WalletConnect, when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set). Magic's embedded wallet is wired into wagmi through a custom connector. Every app route sits behind `SignInGate`, Anyone signed in can play (play first, verify later). Unverified players see a dismissible `VerifyBanner`; G$ rewards and tournaments stay verified-only on-chain. Player-facing copy uses plain language with no blockchain terms (the admin console keeps technical terms). When the account is low on network fees, a one-time pop-up per session (then a banner) asks the player to request a free top-up in the team Telegram channel (`apps/web/src/config/links.ts`), with their account ID ready to copy. The Get G$ page also offers GoodDollar's own faucet top-up.
- **Paid rounds:** each round calls `SlyceArcade.play` (default 1 G$). The arena starts only after confirmation. One approval covers 10 rounds.
- **Game (ADR-0003):** practice scoring with lives, bombs, combos, game over and a device-local best.
- **Contracts (UUPS, ADR-0005):** `SlyceShop`, `SlyceTournament` (cancel/refund, liabilities accounting) and `SlyceArcade`. 57 Foundry tests: unit, fuzz (1,000 runs), invariant (256×64), upgrade and a Celo fork test with real G$. Coverage is 96% of lines and 100% of functions. `@openzeppelin/upgrades-core` 1.46.0 validation passes, including V1→V2 layouts.
- **Web integration:** Shop, Tournament (enter, submit score, refund), Rewards (proof-verified claims) and Profile read the proxies. GoodDollar `/get-gd` handles verification, the daily claim and free gas via the faucet.
- **Checks:** typecheck, 70 unit tests in 19 files (Node 24.21.0), lint, format, core, production build with and without full wallet config. Pre-rendered pages show the sign-in screen, and `/` redirects.

## Not verified

- No browser/device testing (the user prohibits use of their PC browser). The Playwright specs were rewritten for the gate but not run.
- Magic sign-in is not yet verified end to end: it needs a real Magic publishable key (`NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY`) with the site's domains allowlisted. The sign-in screen renders, and Magic's iframe loads, with a placeholder key. Face verification, UBI claim and faucet top-up with a Magic wallet are also untested. Magic wallets are new addresses, so anyone who signed in with Reown before must sign in and verify again.
- Contracts are live on Celo mainnet with real G$ (addresses in `contracts/README.md`): Tournament v1.3.0 with 24h auto-rolling prize tournaments, Arcade v2.0.0 with free play, on-chain game records, XP, streaks and G$ milestones for verified humans. The milestone reward pot is intentionally unfunded (0 G$): G$ rewards have not started, and the app says so. Rewards start when the owner calls `fundRewards`. They are not audited.

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
