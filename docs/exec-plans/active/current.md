# Active Execution Plan — Frontend and Backend Integration Readiness

## Backend foundation (2026-10-27)

P1 is verified. Added an independently runnable `@slyce/backend` workspace package under `backend/` using Node 24 and the built-in Node HTTP server. The built-in server was selected because the repository audit found no existing backend framework and the P1 phase did not authorize a new dependency; this keeps the service independently deployable and avoids changing application behavior.

Implemented:

- validated `NODE_ENV`, `HOST`, and `PORT` configuration
- structured JSON logging without secrets
- centralized JSON error responses
- `GET /healthz` liveness endpoint
- `GET /readyz` returning an explicit not-ready response until P2 database integration
- backend build and test scripts
- two backend tests covering configuration rejection and HTTP routes
- `render.yaml` and `backend/README.md` deployment instructions

Verification on 2026-10-27: backend build passed, two backend tests passed, live `/healthz` smoke test returned HTTP 200, workspace typecheck passed, and `git diff --check` passed. No database or production migration was run.

Next gate: P2 database and Prisma. Add Prisma only after reviewing the Supabase connection requirements and designing the initial schema; do not expose feature endpoints against the current foundation.

## Database and Prisma foundation (2026-10-27)

P2 is implemented but not fully verified because no authorized development Supabase credentials are available. Prisma 7.10.1 is pinned, using the official Prisma 7 configuration pattern: `DATABASE_URL` for runtime access and `DIRECT_URL` for CLI/migrations. The schema is in `backend/prisma/schema.prisma`; the initial migration was generated from an empty schema and reviewed structurally. Global leaderboard snapshots use an empty-string mode sentinel so PostgreSQL uniqueness constraints remain effective. `backend/src/database.ts` provides the server-only Prisma client boundary without opening a connection during startup. The reusable official findings are recorded in `docs/research/prisma-supabase.md`.

Verified: Prisma schema validation, Prisma Client generation, backend TypeScript build, three backend tests, and migration SQL generation. Not verified: connectivity, `migrate dev`, `migrate deploy`, schema recreation against PostgreSQL, or readiness against a live database. P2 was verified on 2026-10-27 against the authorized development Supabase database: Prisma connected, the initial migration was applied, and `prisma migrate status` reported the database schema up to date.

## Authentication and security foundation (2026-10-27)

P3 security groundwork is implemented. Backend configuration now validates CORS origins, request-size limits, and rate-limit settings. The HTTP boundary applies an origin allowlist, handles preflight requests, rejects oversized requests, and applies a fixed-window client limiter. `backend/src/security.ts` defines explicit authenticated principals, bearer-token extraction, verifier-based authentication, administrator role checks, and player ownership checks. No request treats a wallet address as proof of authentication.

ADR-0006 now records the accepted administrator boundary: Supabase Auth bearer tokens are verified server-side and administrator access requires a normalized email in `ADMIN_EMAILS`. The existing Reown/AppKit player UX remains unchanged, but player token/session mapping and player-record association remain pending because wallet connection alone is not backend authentication. Protected feature endpoints remain absent until their handlers and persistence rules are implemented.

Supabase Auth configuration is represented by `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `ADMIN_EMAILS`; no service-role key is required for token verification.

## API contract foundation (2026-10-27)

P4 contract infrastructure is implemented in `backend/src/api/`. Versioned `/api/v1` route groups, stable success/error envelope schemas, server-side Zod validation, cursor/limit pagination conventions, idempotency-key validation, and public/player/administrator route inventory are now defined. `docs/API_CONTRACTS.md` documents the wire conventions and preserves the provisional frontend boundary.

No feature handler was enabled and no fabricated data is returned. Authentication and database verification remain prerequisites for the first protected service route.

Verification on 2026-10-27: backend build and six backend tests passed, workspace typecheck passed, and `git diff --check` passed.

The P4 gate is now complete. Supabase bearer verification is wired into the HTTP boundary, `GET /api/v1/session` is protected, and verified player/admin principals are persisted through the Prisma principal-store boundary. Verification on 2026-10-27: backend build and 10 tests passed, workspace typecheck passed, and `git diff --check` passed. P5 admin dashboard foundation is next.

## Admin dashboard foundation (P5)

Added a responsive `/admin` operations console using Slyce’s existing Night Market tokens, typography, lucide icons, and local shadcn-style composable surfaces. The admin gate sends a Supabase email-link sign-in request, verifies the resulting bearer session through the backend `/api/v1/session` route, and denies accounts not mapped to an administrator principal by the server-side `ADMIN_EMAILS` allowlist. Dashboard metrics and operational queues remain explicit empty states; no fake data is shown. Web typecheck and production Next.js/Serwist build passed on 2026-10-27. P6 player records and GoodDollar verification integration is next; browser/device acceptance remains unverified.

## Player records foundation (P6)

Added typed player profile and administrator player-list contracts, cursor pagination, Prisma-backed player/wallet/GoodDollar-state repository mapping, and protected `GET /api/v1/players/me` and `GET /api/v1/admin/players` routes. GoodDollar state is exposed only as persisted data; no external verification claim or invented fallback is made. Wallet association mutations remain unavailable until ownership verification is approved.

Verification on 2026-10-27: backend build and 11 tests passed, and `git diff --check` passed. GoodDollar SDK execution and device/MiniPay verification remain blocked by the documented research gates.

## Gameplay foundation (P7, in progress)

Added the first safe P7 slice without treating local practice scores as authoritative:

- versioned gameplay session, score-submission, and result schemas
- server-side bounds for game mode, rules version, input digest, score, and breakdown values
- ownership, lifecycle, expiry, and rules-version checks for gameplay submissions
- SHA-256 input-digest helper and seeded session descriptor boundary
- Prisma-backed session persistence and idempotent score submission storage
- score records remain `PENDING` until an authoritative verifier promotes them
- explicit deterministic verifier interface; no practice-runtime implementation is connected
- deterministic leaderboard ranking and pagination helpers using score, submission time, then score ID
- focused service tests covering session creation, invalid score rejection, and pending submission state

Verification on 2026-10-27: backend build and 15 tests passed, and `git diff --check` passed.

P7 is not complete. The current Phaser runtime remains practice-only, so no gameplay routes, leaderboard snapshots, or reward eligibility have been enabled. The next gate is approval and implementation of the deterministic rules/replay verifier behind the new interface.

P7 progress update: added a Prisma-backed verified-leaderboard repository and public `GET /api/v1/leaderboards` route. It filters by verification state, invalidation state, game mode, and UTC period, then applies deterministic ranking and offset pagination. The route remains read-only and returns no practice scores; authoritative verifier implementation is still required before verified rows can be created.

P7 verifier update: approved and implemented the separate `verified-fruit-slice-v1` ruleset. It uses a seeded 30-second target schedule, normalized pointer-segment collisions, three lives, the existing fruit/combo values, and deterministic bombs. Replay inputs are persisted with pending scores; digest, replay, and claimed-score verification can promote a pending score transactionally or reject it. The current practice client remains intentionally unconnected.

P7 route update: added authenticated `POST /api/v1/gameplay/rounds` and idempotent `POST /api/v1/gameplay/rounds/:roundId/finish`. Only the approved verified ruleset can create sessions; finish submissions are replay-verified before returning `VERIFIED`. The web app still uses Reown wallet sign-in while the backend requires Supabase bearer authentication, so no identity bridge was invented.

P7 authentication/client update: added a separate standard Celo wallet challenge session with five-minute single-use nonce, request-Origin binding, signature verification, persisted wallet/player association, and short-lived HMAC session tokens. The web arena now exposes a separate verified mode that signs the challenge, records normalized replay inputs, and submits the server-checked score. Practice mode is unchanged.

## GoodDollar verification status

The official GoodDollar Identity, UBI, and token documentation was rechecked on 2026-10-27. The standard Celo web flow parses the documented return parameters, removes them from the URL, and re-checks status through the pinned SDK. The backend independently reads the configured Identity contract, persists minimal wallet/environment/root/timestamp observations, and the admin dashboard counts unique verified roots. MiniPay is intentionally out of scope; the backend record is an on-chain observation rather than a replacement for wallet authentication.

Mobile header and borderless surface update (2026-10-15): mobile logo stays left, hamburger is right, and wallet control lives inside the right-hand slide menu. Desktop wallet remains in the header. The drawer releases its native modal before the standard wallet picker opens, avoiding a body-portal trapped behind the dialog. Unavailable-wallet explanations remain inside the drawer. Card borders were removed across landing/lobby/shared panels; color surfaces preserve separation and keyboard focus outlines remain. No dependencies or browser use. Verification: strict TypeScript, all 11 targeted drawer/wallet/balance tests and git diff checks pass. Real-device layout and wallet portal interaction remain unverified.

## Landing, lobby and mobile navigation

2026-10-15: replaced the lobby and public landing with new Night Market layouts. Mobile game navigation now uses a sliding native dialog below 721px with a close button, Escape/native focus containment, route dismissal and body scroll restoration; desktop keeps its sidebar. Lobby balance uses the existing WalletContext and never shows cached values when disconnected, offline, wrong-network or errored. Rajdhani 500/700 now applies to the entire site, wallet typography and offline fallback. No new dependencies or integration behavior. Strict TypeScript, all 65 unit tests across 19 files and git diff checks pass. Browser/device and fresh production-build verification remain pending; lint execution was blocked by the environment sandbox.

## Season 5 ship (2026-10-15)

Objective: playable practice game, G$ shop and tournaments via repo contracts, GoodDollar claim, PWA-only (ADR-0003, ADR-0004).
Progress: implementation and local verification are complete (see CURRENT_STATE.md).
Blockers: mainnet deployment needs the owner's key and gas; Vercel env setup; real-device wallet testing.
Acceptance: deployed contracts configured in Vercel; a purchase, a tournament entry and a GoodDollar claim succeed on a phone.

## 1. Objective

Prepare Slyce for professional frontend implementation by establishing a verified technical baseline, scaffolding the frontend correctly, and creating the minimum architecture required for later feature work.

This plan covers the transition from documentation-only state to a working frontend foundation.

The goal is not to build every product feature immediately.

The goal is to produce a stable, verified foundation that future implementation can extend without architectural rework.

---

## Settings simplification and ready UI (2026-10-15)

User restricted settings to difficulty, sound on/off and fruit selection. Implemented those options through a typed configure-preview bridge command; no scored gameplay rules changed. Ready screen shows current mode/fruit count and one primary action. Site-wide icon wrapper now uses lucide-react 0.468.0, matching verified prior Lucide asset revision. User-owned installation of exact 0.468.0 was observed during the run. The agent did not run installation commands or edit the lockfile; no browser use. Strict TypeScript and all 58 unit tests across 17 files pass.

## Pause settings (2026-10-15)

Added a pause-only Settings entry and accessible native modal with sound toggle, volume, sound cue previews, fullscreen and control guidance. The dialog is outside the touch-canceling board so mobile settings can scroll normally. Dismissal keeps the game paused; volume is session-scoped. Unit regression covers opening, retained volume and dismissal without resume. No browser verification authorized. Pause-settings verification: strict TypeScript, all eight arena unit tests and git diff checks pass. Native dialog rendering, focus behavior and device interaction remain unverified in a real browser.

## Arena UI cleanup (2026-10-15)

Removed the settings/sound card and duplicate bottom lobby/wallet controls at user request. Kept the quick gameplay controls and one header lobby link. Fixed desktop HUD grid columns to prevent auto-placement wrapping. Updated unit and E2E expectations. TypeScript, all seven arena unit tests and git diff checks pass; browser execution remains prohibited.

## Arena gesture/header follow-up (2026-10-15)

User reported page scrolling during mobile slicing and disliked the header. Reworked the header into compact lobby/title/status and stat cards. Added board-wide touch-action/overscroll rules and a non-passive touchmove handler with unmount cleanup, preserving Phaser input propagation and outside-board scrolling. Added a regression test for cancellation, propagation and cleanup. TypeScript, git diff checks and all seven arena unit tests pass after rerunning one initial timeout. No PC-browser use; real-device verification remains pending.

## Arena mobile UI refinement (2026-10-15)

User priority: mobile-first UI polish only. Do not use the user’s PC browser for inspection or testing. No installs or server startup. Implemented a four-button quick-control dock outside settings, 44px+ control targets, stable viewport sizing, safe-area padding, portrait/short-landscape layouts, flexible ready/error overlays, and simplified expandable sound settings. Desktop retains a 1440px cap. Gameplay and integration boundaries are unchanged. 2026-10-15 verification: strict TypeScript and git diff checks pass. The main Vitest run passed 45 tests but two workers timed out before startup; rerunning those two files separately passed all nine tests. All 54 tests passed across these runs, not in one clean suite run. No browser, device or fresh production-build verification was performed for this UI revision. Visual/device acceptance remains explicitly unverified under the no-browser constraint.

## 2. Current Phase

Status: **Phase 15 verification in progress: typechecks, 45 unit tests and production/worker build pass; browser/security acceptance pending**

Dependency research and ADR creation are complete. [ADR-0001](../../decisions/ADR-0001-frontend-stack.md) governs the approved exact frontend baseline. Its declared status is **Proposed**; the user explicitly directed that its approved baseline choices control implementation planning. This plan records that authorization without changing the ADR status or resolving its gates.

Current stage:

```text
Repository orchestration
        ↓
Technical verification
        ↓
Dependency baseline
        ↓
Application scaffold
        ↓
Core architecture
        ↓
First verified frontend foundation
```

On 2026-10-07 the user authorized implementation of all unblocked foundation areas immediately, using the accepted exact baseline and pnpm. The agent must not install/remove/upgrade/resolve packages, create a lockfile, or run a development/application server. The user owns installation and server startup. Code may proceed before graph verification; acceptance still requires it. See [ADR-0002](../../decisions/ADR-0002-workspace-package-manager.md). All six ADR-0001 integration gates remain unchanged.

### Immediate next implementation milestone

Authorized implementation scope (code now written; verification remains pending):

1. Write exact package manifests from ADR-0001; exclude deferred GoodDollar packages. The user alone generates the lockfile with pnpm install.
2. After user installation, inspect the resolved dependency graph, including wagmi/core/connectors and critical transitives, and perform the ADR-required security/audit review before integration acceptance. User direction allows source implementation before this verification; no peer bypass or version substitution is authorized.
3. Establish the Next.js App Router foundation, strict TypeScript and Tailwind configuration.
4. Establish linting, typecheck, unit-test, production-build (including the Serwist worker build), and end-to-end-test infrastructure.
5. Establish the existing client/server, API, wallet/runtime, React–Phaser, shared deterministic-package, state-ownership and static-only PWA boundaries.
6. Run the foundation quality gates; record actual results and stop at unresolved integration gates in section 20. A scaffold does not prove MiniPay or GoodDollar integration.

---

## 3. Scope

This execution plan includes:

- verify third-party integration requirements
- confirm compatible dependency versions
- record reusable research
- record required architecture decisions
- scaffold the monorepo/workspace
- scaffold the Next.js frontend
- establish TypeScript configuration
- establish design tokens and base styling
- establish frontend providers
- establish environment validation
- establish API boundary
- establish Web3 boundary
- establish MiniPay runtime detection boundary
- establish game-runtime boundary
- establish shared deterministic package boundary
- establish testing infrastructure
- establish baseline quality checks
- confirm production build succeeds

This plan does not include complete implementation of:

- full Phaser gameplay
- final visual design for every screen
- production authentication
- full GoodDollar UBI integration
- production tournament contracts
- backend replay engine
- event indexer
- payout generation
- production deployment

Those become separate execution plans or later phases.

---

## 4. Required Reading Before Work

Before modifying application code, read:

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `ARCHITECTURE.md`
4. `docs/CURRENT_STATE.md`
5. this execution plan
6. relevant files under `docs/research/`
7. [ADR-0001](../../decisions/ADR-0001-frontend-stack.md) and other applicable decisions under `docs/decisions/`

Do not depend on previous chat-session context.

---

## 5. Phase 1 — Verify Technical Baseline

Status: **Complete for dependency research and documentation-level version lock; integration verification remains gated**

Phase 1 reverification (2026-10-07): rechecked official documentation, exact publisher metadata and the six compatibility chains against ADR-0001. No approved version changes are proposed. Reinspected GoodDollar SDK artifacts with publisher hash verification. The research includes per-row verification dates, compatibility constraints, stale guidance, and all six unresolved ADR gates. Exact pins are documented; there is no package-manager lockfile and no resolved-tree or runtime verification. The historical stop was superseded by the user’s implementation authorization; package installation remains user-owned.

Research was recorded on 2026-10-07 in [dependency-baseline.md](../../research/dependency-baseline.md) and informed [ADR-0001](../../decisions/ADR-0001-frontend-stack.md). Core direct peers/engines were checked; no installation, lockfile generation, scaffolding or application verification has occurred. The earlier research-review checkpoint is complete for baseline planning.

The research scope below is retained as the completed research record; do not repeat stack selection. Unresolved integration and runtime verification remains tracked in section 20 and the ADR.

Required areas:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Phaser
- wagmi
- viem
- standard-browser wallet UI
- TanStack Query
- Zustand
- GoodDollar
- MiniPay
- Celo
- Serwist/PWA integration
- Zod
- Vitest
- Playwright

For each relevant integration, record:

- selected version
- compatibility constraints
- official source
- relevant implementation requirements
- verification date

Store reusable results under:

```text
docs/research/
```

### Phase 1 Acceptance Criteria

- [x] Required technologies have been checked against current official documentation.
- [ ] Full integration compatibility has been confirmed (core direct peer/engine intersection checked; SDK/MiniPay and runtime verification pending).
- [x] No package version was selected purely from memory.
- [x] Reverified exact versions and all six compatibility chains; retained ADR-0001 pins and documented unresolved integration evidence.
- [x] Relevant findings are recorded in `docs/research/`.
- [x] Known conflicts are documented rather than silently resolved.
- [x] Frontend baseline choices are recorded in ADR-0001 and authorized for implementation planning; its six integration gates remain unresolved.

---

## 6. Phase 2 — Establish Dependency Baseline

Status: **Source foundation written; runtime/acceptance checks pending**

Manifests implement the exact baseline governed by ADR-0001. Installation remains user-owned. The research is supporting evidence, not an alternative version authority.

The baseline must include only dependencies required for the first implementation phase.

Avoid speculative packages.

Required categories:

### Application

- Next.js
- React
- TypeScript

### Styling

- Tailwind CSS

### Server/Remote State

- TanStack Query

### Local UI State

- Zustand

### Validation

- Zod

### Game

- Phaser

### Blockchain

- wagmi
- viem
- approved standard-browser wallet UI

### External Integrations

- GoodDollar SDK adoption is blocked by ADR-0001 gate 6; do not install GoodDollar packages in the foundation baseline
- MiniPay-compatible wallet integration

### PWA

- Serwist integration compatible with the selected Next.js bundler

### Testing

- Vitest
- Playwright
- supporting test utilities only where required

Do not install packages merely because they may be useful later.

### Phase 2 Acceptance Criteria

- [x] Frontend baseline versions are selected in ADR-0001.
- [ ] Resolved dependency graph is inspected and verified before feature work; direct peer research alone is insufficient.
- [x] Package manifest reflects the approved baseline.
- [ ] Lockfile is generated and committed.
- [x] No unnecessary major dependencies are introduced.
- [x] Frontend dependency choices and constraints are documented in ADR-0001.

---

## 7. Phase 3 — Scaffold Repository

Status: **Source foundation written; runtime/acceptance checks pending**

Create the initial workspace structure.

Target high-level structure:

```text
slyce/
├── apps/
│   └── web/
│
├── packages/
│   ├── shared/
│   └── contracts/
│
├── docs/
│
├── AGENTS.md
└── ARCHITECTURE.md
```

The frontend implementation begins under:

```text
apps/web/
```

Shared deterministic game logic belongs under:

```text
packages/shared/
```

Contract work belongs under:

```text
packages/contracts/
```

Do not move frontend-specific application code into `packages/shared/`.

### Phase 3 Acceptance Criteria

- [ ] Workspace installs successfully.
- [x] Workspace boundaries are clear.
- [ ] Application package can run independently.
- [ ] Shared package can be imported without circular dependencies.
- [x] Repository structure matches the architecture.
- [x] No placeholder architecture contradicts `ARCHITECTURE.md`.

---

## 8. Phase 4 — Scaffold Web Application

Status: **Source foundation written; runtime/acceptance checks pending**

Create the Next.js App Router application.

Establish:

- root layout
- global stylesheet
- base metadata
- route structure
- font loading
- providers boundary
- error handling boundary
- loading strategy
- environment validation
- base configuration

Initial routes should exist for:

```text
/
 /play
 /tournament
 /shop
 /leaderboard
 /rewards
 /get-gd
 /profile
```

At this stage, routes may contain intentional minimal shells.

Do not pretend placeholder route content represents completed features.

### Phase 4 Acceptance Criteria

- [ ] Application starts locally.
- [ ] Every required initial route resolves.
- [x] No route contains unnecessary duplicated infrastructure.
- [x] Client components are used only where browser behavior requires them.
- [x] Production build succeeds.
- [x] TypeScript strict mode is enabled.
- [x] No type errors remain.

---

## 9. Phase 5 — Establish Design Foundation

Status: **Source foundation written; runtime/acceptance checks pending**

Implement the Night Market design tokens from the product specification.

Required color tokens:

```text
Night    #0E1712
Canopy   #18261D
Vine     #2A3D31
Mango    #FFB627
Leaf     #2FBF71
Melon    #FF4D6D
Sky      #3BA8FF
Ember    #E5383B
Cream    #F7F2E7
Mist     #A7B3AA
```

Preserve semantic usage:

- Mango → primary/spending actions
- Leaf → earning/rewards
- Sky → G$ values and relevant links
- Melon → highlights/combo/streak states
- Ember → errors/danger
- Cream → primary text
- Mist → secondary text

Establish reusable primitives only where they immediately benefit implementation.

Avoid prematurely building a large design-system library.

### Phase 5 Acceptance Criteria

- [x] Design tokens exist in one canonical location.
- [x] Required colors are not scattered as repeated literals.
- [x] Typography is established.
- [ ] Base mobile layout is functional.
- [ ] Core contrast remains readable.
- [ ] Initial UI works at a minimum 360-pixel viewport width.

---

## 10. Phase 6 — Establish Provider Architecture

Status: **Source foundation written; runtime/acceptance checks pending**

Create the application provider composition.

Expected responsibilities include:

- TanStack Query
- Web3/wallet configuration
- supported UI-level providers

Provider setup must remain centralized.

Do not wrap the application in unnecessary client providers.

Conceptual structure:

```text
Root Layout
    |
    v
Application Providers
    |
    +-- Query Provider
    |
    +-- Web3 Provider
    |
    +-- other confirmed providers only
```

### Phase 6 Acceptance Criteria

- [x] Provider composition exists in one clear boundary.
- [ ] Query client behavior is configured correctly.
- [x] Web3 configuration is not duplicated.
- [ ] Server-only modules do not leak into client bundles.
- [x] Client boundaries remain narrow.

---

## 11. Phase 7 — Establish Environment Configuration

Status: **Source foundation written; runtime/acceptance checks pending**

Create a validated environment/configuration layer.

Separate:

### Browser-safe values

Examples:

- active public network
- public RPC endpoint
- WalletConnect/Reown project identifier
- public G$ contract address
- Shop contract address
- Tournament contract address
- public application URL

### Server-only values

Examples:

- database URL
- session secret
- results-signer private key
- privileged server configuration

Use runtime validation.

Application modules should consume the validated configuration layer rather than calling `process.env` throughout the codebase.

### Phase 7 Acceptance Criteria

- [x] `.env.example` exists.
- [x] No secret values are committed.
- [x] Public and server-only values are clearly separated.
- [ ] Invalid required configuration fails clearly.
- [x] Production addresses are not scattered through UI components.

---

## 12. Phase 8 — Establish API Boundary

Status: **Source foundation written; runtime/acceptance checks pending**

Create a typed application API layer.

Initial capabilities must correspond to:

- authentication/session
- start round
- finish round
- leaderboard
- inventory
- inventory use
- rewards
- shop items

Use runtime validation at external response boundaries where appropriate.

UI components should consume feature hooks/services rather than raw `fetch()` calls.

Provide a clean separation between:

```text
UI
 ↓
Feature hooks
 ↓
API abstraction
 ↓
HTTP implementation
```

A development mock implementation may exist if backend endpoints are unavailable, but:

- it must be explicitly identified as mock behavior
- it must not fake blockchain transaction success
- it must be replaceable without modifying feature UI

### Phase 8 Acceptance Criteria

- [x] API interface exists.
- [x] HTTP implementation boundary exists.
- [x] Response validation strategy exists.
- [x] UI does not scatter raw request logic.
- [x] Mock behavior, if used, is clearly marked.
- [x] Missing backend schemas are not invented silently.

---

## 13. Phase 9 — Establish Wallet/Web3 Boundary

Status: **Source foundation written; runtime/acceptance checks pending**

Create centralized Web3 infrastructure for:

- network configuration
- supported wallet connectors
- wallet/account state
- MiniPay detection
- G$ balance reads
- contract configuration
- transaction lifecycle primitives
- block explorer links
- token unit helpers

Feature UI must not directly manage low-level connector configuration.

Required runtime distinction:

```text
MiniPay
    → injected provider
    → automatic connection
    → no generic wallet picker

Standard Web/PWA
    → approved wallet selection flow
    → supported connectors
```

Exact implementation must follow verified installed versions.

### Phase 9 Acceptance Criteria

- [x] MiniPay detection is centralized.
- [x] Standard-web wallet behavior is centralized.
- [x] Wallet runtime state is normalized for feature consumption.
- [x] Chain configuration has one canonical source.
- [x] Contract addresses have one canonical source.
- [x] G$ unit conversion avoids floating-point arithmetic.
- [x] No production transaction is simulated locally.

---

## 14. Phase 10 — Establish Transaction State Model

Status: **Source foundation written; runtime/acceptance checks pending**

Implement reusable transaction lifecycle handling.

Required conceptual states:

```text
idle
preparing
awaiting_wallet
submitted
confirming
confirmed
synchronizing
success
rejected
failed
```

Do not represent all transaction behavior with a single loading boolean.

Normalize common failure categories where practical:

- user rejection
- insufficient balance
- wrong network
- RPC/network failure
- contract revert
- synchronization timeout/failure

### Phase 10 Acceptance Criteria

- [x] Transaction lifecycle model exists.
- [x] Rejected and failed states are distinguishable.
- [x] Blockchain confirmation is distinguishable from backend synchronization.
- [x] Transaction components/hooks can be reused by shop, tournament, and rewards.
- [x] No feature grants authoritative state based solely on transaction submission.

---

## 15. Phase 11 — Establish Phaser Boundary

Status: **Source foundation written; runtime/acceptance checks pending**

Create the browser-only game host without implementing full gameplay.

Required foundation:

- client-only Phaser loading
- game lifecycle management
- resize behavior
- visibility handling
- typed React ↔ Phaser bridge
- clean teardown

Initial bridge contract should support only confirmed needs.

Example game-to-React events:

- ready
- score changed
- lives changed
- power-up used
- game over
- error

Example React-to-game commands:

- start
- pause
- resume
- activate power-up

Do not implement frame-level React synchronization.

### Phase 11 Acceptance Criteria

- [ ] Phaser never executes during server rendering.
- [ ] Phaser initializes on the play route.
- [ ] Game runtime tears down cleanly.
- [ ] Resize handling works.
- [x] Visibility pause/resume behavior exists.
- [x] Bridge is typed.
- [x] React is not updated every frame.

---

## 16. Phase 12 — Establish Shared Deterministic Package

Status: **Source foundation written; runtime/acceptance checks pending**

Create the shared package boundary required for deterministic replay.

Initial package may contain only contracts/interfaces until gameplay rules are implemented.

Expected eventual ownership includes:

- seeded RNG
- deterministic scoring
- replay-compatible input types
- deterministic game-event types
- shared simulation rules

Do not invent final gameplay mechanics solely to fill this package.

If backend/game rules remain undefined, establish the boundary and types needed without fabricating behavior.

### Phase 12 Acceptance Criteria

- [x] Shared package exists.
- [ ] Web application can import it.
- [x] Package does not depend on React or Phaser.
- [x] Deterministic domain code remains framework-independent.
- [x] No duplicate scoring implementation exists.

---

## 17. Phase 13 — Establish PWA Foundation

Status: **Source foundation written; runtime/acceptance checks pending**

Implement the initial PWA infrastructure according to the selected Next.js/Serwist integration.

Required baseline:

- manifest
- application icons
- installable metadata
- portrait-oriented application configuration where appropriate
- service-worker integration
- static asset caching strategy
- explicit protection against stale authoritative API data

Static resources may be cached where appropriate.

Do not cache authoritative mutable data such as:

- wallet balances
- inventory
- shop prices
- rewards
- leaderboard
- tournament state
- authentication state
- transaction state

### Phase 13 Acceptance Criteria

- [ ] Manifest resolves correctly.
- [x] Service-worker configuration matches the actual Next.js bundler.
- [x] Static-shell strategy is defined.
- [ ] Mutable authoritative APIs are not cached incorrectly.
- [ ] Installed application can load its intended shell.
- [x] PWA configuration does not break production build.

---

## 18. Phase 14 — Establish Testing Baseline

Status: **Source foundation written; runtime/acceptance checks pending**

Set up:

- unit testing
- integration testing where appropriate
- Playwright end-to-end testing

Initial tests should prioritize architectural boundaries rather than superficial snapshot coverage.

Minimum foundation tests should cover:

- MiniPay detection
- runtime wallet branching
- environment validation
- API response validation
- transaction-state transitions
- critical route availability
- Phaser host lifecycle where practical

### Phase 14 Acceptance Criteria

- [x] Unit test command works.
- [ ] End-to-end test command works.
- [x] Initial meaningful tests pass.
- [x] No test suite depends unnecessarily on production services.
- [x] Critical architecture boundaries have at least baseline verification.

---

## 19. Phase 15 — Final Foundation Verification

Status: **In progress: compiler, unit and build checks pass; browser/security checks pending**

Run the complete repository quality gate.

Required checks:

```text
format
lint
typecheck
unit tests
integration tests where configured
production build
targeted end-to-end tests
```

Also verify:

- no committed secrets
- no accidental production private configuration
- no unexplained type suppression
- no unnecessary dependency duplication
- no invalid client/server imports
- no architecture violations introduced during scaffolding

### Phase 15 Acceptance Criteria

- [ ] Formatting passes.
- [ ] Lint passes.
- [x] Typecheck passes.
- [x] Tests pass.
- [x] Production build succeeds.
- [ ] Required routes load.
- [x] Repository documentation reflects actual state.
- [x] Remaining blockers are explicitly documented.
- [x] No known implementation is represented as complete when still mocked.

---

## 20. Known Blockers / Open Dependencies

### ADR-0001 integration gates — stop boundaries

The six [ADR-0001 gates](../../decisions/ADR-0001-frontend-stack.md#deferred--unresolved-gates) remain unresolved and block their respective implementation areas:

1. MiniPay session authentication.
2. GoodDollar SDK/documentation drift.
3. GoodDollar identity inside MiniPay, including verification and claim behavior.
4. GoodDollar non-production/test environment.
5. MiniPay/browser/WebView support floor.
6. GoodDollar package adoption.

Codex must stop at each affected boundary until its gate is resolved. Do not invent authentication, signing, SDK, environment or browser-support workarounds; do not install GoodDollar packages. Foundation structure and infrastructure are authorized and now written, but no gate is waived by that milestone or by existing phase checklists. Preserve interfaces without pretending blocked integrations work. ADR-required real-device and integration verification remains pending.

### MiniPay Authentication

Production MiniPay server authentication remains unresolved.

The frontend architecture must preserve a separate MiniPay-compatible authentication path.

Do not invent this protocol.

### Backend API Schemas

The build specification defines endpoint responsibilities but does not fully define all production request/response schemas.

Do not fabricate authoritative backend contracts without coordination.

Frontend mocks/interfaces may be used for development when clearly marked.

### Deployed Application Contracts

Production Shop and Tournament addresses do not yet exist in the current repository state.

Contract-dependent functionality must remain environment/configuration driven.

### Final Game Rules

Full deterministic gameplay/scoring rules have not yet been implemented.

Do not invent server-authoritative rules merely to complete scaffolding.

---

## 21. Progress

Juice/slash refinement (2026-10-09): added kiwi, lemon, apple and peach, centralized fruit skin/flesh/juice colors, bounded resampled/tapered blade trails that fade after release, and translucent board splatters with fading wet highlights. Splatter groups persist 35 seconds, cap at 40, and clear with preview lifecycle. TypeScript and 52 tests pass; Chrome visual check confirmed lingering stains. No scoring/backend behavior changed. Mobile performance remains pending.

Airborne fruit (2026-10-09): user requested bottom-up throws and a maximum arena width. Implemented a 1440px cap, staggered visual waves of intact melon/orange/plum, constant-acceleration arcs and rotation, swipe-oriented split impulses preserving momentum, bounded lifetimes/counts and resize reset. No authoritative score/life rules added. Strict TypeScript and 49 unit tests pass, including apex, viewport containment, refresh-rate independence and split momentum. Chrome reloaded the runtime and rendered the new airborne fruit. Real touch/long-session performance acceptance remains pending.

Arena composition refinement (2026-10-09): aligned HUD/board viewport proportions and ready-screen positioning to arena.png, moved wallet/lobby links below the board, and collapsed secondary controls/audio. Desktop Chrome inspection on the user-started server verifies preview entry, controls disclosure, pause and clean preview exit. TypeScript and all 46 unit tests pass. Existing generated artwork and typography are approximations, not pixel-exact reference assets. Mobile acceptance remains pending.

Reference playground/effects (2026-10-09): implemented a standalone full-width arena layout, generated walnut/brass board and transparent fruit artwork, compact HUD with unknown authoritative readings, interactive cosmetic cutting preview, bounded juice/trail/half effects, and opt-in synthesized click/swipe/cut/splash/boom/fail/success/combo audio with mute/volume/cleanup. Art source and exact prompts are recorded in research/playground-assets.md. Effects are not verified rounds. All 45 unit tests across 14 files and the final production build with strict TypeScript pass. The generated worker has 223 precache URLs (8.65 MB), including both new WebP assets. Browser visual, touch and audible sound acceptance remain pending.

Lobby/board update (2026-10-09): replaced Phantom Guardians with licensed self-hosted Space Grotesk; /play now serves the lobby and /play/arena the dedicated wooden canvas. Added bridge-driven HUD, renderer pause/resume, fullscreen with failure handling, help and unavailable inventory state. No game rules or authoritative readings invented. Updated route coverage and added control/HUD tests. Final Next.js/Serwist build and strict typecheck pass; all 40 unit tests pass, with focused session/cache rechecks passing. Built HTML confirms lobby/canvas separation. Browser visual and device acceptance remain pending.

UI continuation (2026-10-09): implemented official locally bundled Lucide icons with upstream license, finite reduced-motion-aware fruit/slice/card animations, refined Night Market home/cards/install treatment, route-specific empty-state icons and active-link scrolling in mobile navigation. Removed the user-facing em dash from metadata; application source scan is clear. Added Playwright acceptance cases for reduced motion and mobile active-link visibility. Architecture and whitespace checks pass. Application typecheck passes. Next.js/Serwist production builds pass. All 35 unit tests passed across retries (34 in the single-worker suite, 1 isolated after its worker-startup timeout). A clean combined suite pass is not claimed. Browser verification remains pending. Integration gates and undefined authoritative gameplay/backend requirements remain unchanged.

End-to-end continuation (2026-10-07): added retryable transaction confirmation without duplicate submission, replacement-receipt identity checks, API cancellation propagation, offline balance suppression, and renderer-independent DOM host lifecycle with failed-initialization cleanup. Added regression coverage; 35 tests and application/worker/shared typechecks pass. Gameplay/backend input and a user-started browser-test URL were requested and remain pending. The source of truth still contains no authoritative mechanics or backend protocol; those features remain blocked rather than invented.


Research checkpoint (2026-10-07): official dependency research completed and recorded.

Current checkpoint (2026-10-07): implementation authorized without agent installation or server startup. Exact pnpm manifests, all eight routes, Night Market tokens/UI, providers, validated configuration, API/HTTP interfaces, runtime-specific wallet adapters, transaction controller/hook, browser-only Phaser host, shared replay interfaces, PWA/static fallback and tests are written. No authoritative service, gameplay or payment flow is represented as operational. A root npm package-lock.json appeared during work, locking only TypeScript; it was left unchanged and is not a resolved pnpm workspace graph.

Verification update: user installation is complete. Both wallet providers now narrow a centralized active-network discriminated union before invoking wagmi; each has one chain and its own configured transport. Application/worker/shared typechecks, all 35 Vitest tests, source architecture/whitespace checks and Next/Serwist production build pass. All direct installed versions match manifests; wagmi resolves core 2.22.1 and connectors 6.2.0. Generated worker inspection confirms all 214 precache entries are static chunks/icons/offline HTML. Browser/device checks remain pending without a user-started server. Security audit execution was refused by the Windows sandbox; no result is claimed. Standard ESLint/formatter pins remain unapproved.

Current overall progress:

- [x] Research and ADR-controlled exact baseline.
- [x] Source foundations for Phases 2–14 (runtime acceptance incomplete).
- [x] Explicit unavailable API/auth/GoodDollar/game states; no fake successful integrations.
- [x] Provisional frontend contracts recorded in [API_CONTRACTS.md](../../API_CONTRACTS.md).
- [x] Dependency-free source checks, shared typecheck and targeted core checks.
- [x] User installation and generated pnpm lockfile; direct pins and critical wagmi internals inspected.
- [ ] Complete resolved-tree security audit (shell execution blocked).
- [x] App/worker/shared typechecks, 45 Vitest tests and production/worker build.
- [ ] Browser E2E, PWA offline/update and real-device wallet checks.
- [ ] Approved standard lint/formatter tools and exact pnpm toolchain pin.
- [ ] Resolve ADR-0001 integration gates, authoritative backend schemas, game rules and contract deployments before affected integrations.

Exact next implementation area: run browser/PWA tests against a user-started server and address any runtime defects; complete the security audit. Then implement the approved backend session/round contracts and shared deterministic gameplay rules when supplied. Do not invent those requirements. No further application feature requiring those authorities is currently safe to activate.

---

## 22. Definition of Done

This execution plan is complete only when:

1. the verified dependency baseline exists
2. reusable external research is recorded
3. required architecture decisions are recorded
4. the monorepo/workspace exists
5. the Next.js application runs
6. required routes exist
7. design tokens are established
8. validated configuration exists
9. API boundaries exist
10. wallet/Web3 boundaries exist
11. MiniPay runtime branching exists
12. transaction lifecycle infrastructure exists
13. Phaser can be mounted through the approved bridge
14. the shared deterministic package boundary exists
15. PWA infrastructure is operational
16. baseline tests exist and pass
17. lint/typecheck/build pass
18. `docs/CURRENT_STATE.md` reflects actual implementation
19. unresolved integration dependencies are documented
20. another developer or coding agent can continue without previous chat context

Do not close this plan based solely on scaffold generation.

## Landing and arcade separation (2026-10-09)

User requested a dedicated public landing page and a Launch game entry into the gaming interface. Implemented / as a standalone marketing page and the existing seven game routes under a shared (game) route-group layout, preserving URLs. Query/Web3/RainbowKit providers now live only in that layout. The arcade header exposes Connect wallet on standard web and preserves automatic MiniPay connection/status. Missing wallet configuration is explained on demand, never simulated. The /play composition prioritizes the arena with tournament/shop side panels. Integration gates remain unchanged. Added landing-to-arcade navigation acceptance coverage. Production/Serwist builds, regenerated application typecheck and the full 38-test unit suite pass, including three new wallet-control tests. Built HTML confirms the landing has Launch game without the arcade shell, while /play contains the arcade shell and wallet control. Browser launch was refused with spawn EPERM; visual/E2E acceptance remains pending.
