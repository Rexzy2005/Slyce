# Slyyce / Slyyce

Mobile-first Next.js frontend foundation. Product rules live in [docs/PROJECT.md](docs/PROJECT.md), boundaries in [ARCHITECTURE.md](ARCHITECTURE.md), dependency choices in [ADR-0001](docs/decisions/ADR-0001-frontend-stack.md), and implementation status in [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

## Workspace

- apps/web: @slyyce/web — App Router, UI, wallet, API, Phaser host and PWA.
- packages/shared: @slyyce/shared — framework-independent replay interfaces; game rules are not implemented.

Use Node 24.21.0 and pnpm. The user runs pnpm install from the root to create the lockfile; the implementation agent must not install dependencies or start a server. Direct dependencies are exact. The lockfile/resolved graph must be reviewed before release. No GoodDollar SDK is included.

Copy .env.example to apps/web/.env.local only when configuring integrations. Empty settings intentionally render an unconnected shell. Selecting a network requires its RPC URL; standard-web wallets also require a Reown project ID. Supply only verified token/contract addresses for that network. Never map mainnet deployments onto Sepolia. See [API contracts](docs/API_CONTRACTS.md) for the deliberately unavailable backend boundary.

## Commands

The user controls pnpm dev or pnpm --filter @slyyce/web start. No test command automatically starts a server.

- pnpm format:check — source whitespace checks; not a full formatter.
- pnpm lint — project architecture/import/dependency checks; not ESLint.
- pnpm typecheck — strict application, worker and shared-package checks.
- pnpm test:core — dependency-light boundary assertions using the approved TypeScript compiler.
- pnpm test — Vitest, non-watch.
- pnpm build — Next/Turbopack production build followed by Serwist worker build.
- pnpm test:e2e — Playwright against a server already started by the user; defaults to http://127.0.0.1:3000. Override PLAYWRIGHT_BASE_URL in the test process when needed.
- pnpm test:pwa — production-only offline/cache test against a production server already started by the user after pnpm build.
- pnpm assets:generate — regenerate checked-in CSS, PNG icons and offline HTML from canonical design tokens.

Playwright requires the browser binary corresponding to its pinned version. Browser support, wallet-device flows and offline behavior remain acceptance checks, not guarantees. Read [the current handoff](docs/handoffs/CURRENT.md) before continuing.
