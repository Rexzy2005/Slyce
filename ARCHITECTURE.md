# Slyyce Architecture

> 2026-10-15: MiniPay is removed and the app ships as web + PWA only. Application contracts live in `contracts/`. See ADR-0004, which supersedes the MiniPay sections below.

## 1. Purpose

This document defines the target technical architecture and the boundaries that implementation must preserve.

It answers:

- what owns each responsibility
- where authoritative state lives
- how major subsystems communicate
- which boundaries must not be crossed
- how the frontend, game, backend, blockchain, and external integrations fit together

Product behavior belongs in `docs/PROJECT.md`.

Current implementation status belongs in `docs/CURRENT_STATE.md`.

[ADR-0001 — Frontend Dependency Baseline](docs/decisions/ADR-0001-frontend-stack.md) controls frontend technology, exact dependency versions, runtime and bundler choices for implementation planning. Reference it rather than maintaining independent version selections in this document. Research in `docs/research/` supplies supporting evidence and version-specific API details; it does not override the ADR. The [active execution plan](docs/exec-plans/active/current.md) records planning authorization and the remaining implementation gates.

Architectural changes that materially alter this document require a decision record in `docs/decisions/`.

---

## 2. System Overview

Slyyce/Slyyce consists of five primary runtime domains:

1. Web application
2. Game runtime
3. Application backend
4. Shared deterministic simulation
5. Blockchain contracts and external Web3 services

High-level flow:

```text
                         PLAYER
                            |
                            v
                  +-------------------+
                  |   Web / PWA /     |
                  | MiniPay Mini App  |
                  +---------+---------+
                            |
              +-------------+-------------+
              |                           |
              v                           v
        React Application            Phaser Game
              |                           |
              |<------ typed bridge ----->|
              |
      +-------+---------+
      |                 |
      v                 v
 Application API     Web3 Layer
      |                 |
      v                 v
 Backend/Data       Celo / G$
      |             Shop / Tournament
      |
      v
 Shared deterministic
 simulation / scoring
```

The same web application must serve normal browsers, installed PWA usage, and MiniPay.

---

## 3. Repository-Level Boundaries

The target repository is a workspace/monorepo. [ADR-0002](docs/decisions/ADR-0002-workspace-package-manager.md) selects pnpm and records user-owned installation/server startup. The current foundation contains apps/web and packages/shared; packages/contracts is deferred until contract work requires it.

Primary domains:

```text
slyce/
├── apps/
│   └── web/
│       ├── frontend application
│       └── initial Next.js API routes
│
├── packages/
│   ├── shared/
│   │   └── deterministic game rules shared by client and server
│   │
│   └── contracts/
│       └── smart contracts, deployment, and contract tests
│
└── docs/
    └── durable project knowledge
```

The exact internal file structure may evolve.

The ownership boundaries below must remain stable unless deliberately changed.

---

## 4. Web Application

The web application owns:

- routing
- page composition
- responsive UI
- wallet presentation
- MiniPay runtime detection
- transaction initiation
- transaction lifecycle presentation
- API consumption
- player-visible application state
- Phaser mounting
- PWA behavior
- install experience
- GoodDollar client interaction
- error/loading/empty states

The web application must not become authoritative for:

- final verified scores
- blockchain transaction success
- inventory ownership
- tournament eligibility
- prize eligibility
- server session validity
- contract state

Those values must come from their authoritative source.

---

## 5. Rendering Model

The public / landing page has its own server-rendered composition and a Launch game link to the /play lobby. The /play/arena route owns the browser-only canvas, bridge-driven HUD and renderer/display controls; the lobby does not mount Phaser. The arena has a focused (arena) layout with the same centralized providers and wallet boundary; other game routes share the (game) App Router layout, which owns the arcade navigation and client providers. Wallet selection is exposed in the gaming header, with automatic MiniPay connection preserved. The public landing does not mount Query or Web3 providers.


Use the Next.js App Router architecture.

Default to server-rendered/server-capable application structure where practical.

Use client components only where browser state or browser APIs are required, including:

- wallet interaction
- MiniPay injected provider access
- Phaser
- interactive game controls
- PWA installation events
- browser-only APIs
- client-side state stores

Do not mark large application trees as client components merely for convenience.

Keep client-only boundaries narrow.

Phaser must never execute during server rendering.

---

## 6. Application Layers

The frontend should be organized conceptually into these layers:

```text
Routes / Pages
      |
      v
Feature UI
      |
      v
Application hooks/services
      |
      +-------------------+
      |                   |
      v                   v
API client            Web3 client
      |                   |
      v                   v
Backend              Blockchain
```

Pages should primarily compose features.

Pages should not contain:

- raw contract ABIs
- RPC configuration
- transaction encoding logic
- large fetch implementations
- duplicated domain rules
- game simulation logic

Integration complexity belongs behind dedicated modules.

---

## 7. State Ownership

State must have one clear owner.

Do not mirror the same state across several systems without a specific reason.

### Remote Application State

Server-originated state belongs in the remote-data/query layer.

Examples:

- leaderboard
- inventory
- rewards
- shop data
- verified round results
- player server data

Use the query/cache layer for this state.

Do not copy remote server state into Zustand merely to make it globally accessible.

### Blockchain State

Blockchain-originated state belongs in the Web3/query layer.

Examples:

- wallet connection
- account address
- chain
- G$ balance
- transaction receipt
- contract reads

Do not treat locally stored transaction state as proof of blockchain state.

### Local UI State

Local application state may live in a lightweight client store when genuinely shared.

Examples:

- modal state
- temporary UI preferences
- game HUD state required outside Phaser
- selected cosmetic state before persistence
- transient interaction state

### Game Runtime State

High-frequency gameplay state belongs inside Phaser/shared simulation.

Examples:

- object positions
- frame simulation
- swipe collision state
- active entities
- moment-to-moment simulation

Do not push frame-level state through React or Zustand.

---

## 8. Phaser Boundary

Phaser is an isolated browser-only game runtime.

React owns the application.

Phaser owns active gameplay.

Neither should directly reach into the other's internal state.

Communication occurs through a small typed bridge.

Conceptually:

```text
React
  |
  | commands
  v
Bridge
  |
  v
Phaser

Phaser
  |
  | events
  v
Bridge
  |
  v
React
```

Examples of React-to-game commands:

- start round
- pause
- resume
- activate owned power-up
- apply approved configuration

Examples of game-to-React events:

- game ready
- score changed
- lives changed
- power-up consumed
- game over
- fatal game error

Do not emit React updates on every animation frame.

Only publish state needed by the surrounding application.

The bridge should be typed and lifecycle-safe.

Destroy Phaser resources and listeners when the game component unmounts.

---

## 9. Deterministic Game Architecture

Authoritative score verification depends on deterministic replay.

Logic required to reproduce a round must not exist only inside Phaser.

Shared deterministic rules belong in:

```text
packages/shared/
```

This includes, where required:

- seeded random-number generation
- scoring rules
- deterministic spawn decisions
- deterministic simulation rules
- input event types
- replay-compatible power-up behavior

Both browser gameplay and backend replay must consume the same shared rules where determinism matters.

Phaser may handle:

- rendering
- animation
- audio
- visual effects
- pointer capture

Phaser must not create independent authoritative scoring rules that the backend cannot reproduce.

---

## 10. Round Data Flow

The expected round lifecycle is:

```text
Client
  |
  | request round
  v
Backend
  |
  | round ID + seed/configuration
  v
Client / Shared Simulation
  |
  | gameplay + input log
  v
Backend
  |
  | deterministic replay
  v
Verified or Rejected Round
  |
  v
Leaderboard / Tournament State
```

The browser may display a live score.

The backend determines whether the submitted score becomes authoritative.

The client must never submit only a final score as sufficient proof of a valid round.

---

## 11. API Boundary

Frontend/backend communication must pass through a typed application API layer.

UI components must not scatter raw `fetch()` calls throughout the codebase.

The API boundary should provide operations corresponding to product capabilities such as:

- authentication/session
- start round
- finish round
- leaderboard
- inventory
- inventory use
- rewards
- shop items

Runtime validation should be used at external data boundaries where appropriate.

Backend responses must not be assumed valid solely because TypeScript types exist.

Types describe expectations; runtime validation protects the boundary.

---

## 12. Initial Backend Placement

The build specification allows the backend to begin as Next.js route handlers.

This means the initial system may contain both:

```text
apps/web/
├── app/
│   ├── application routes
│   └── api/
│       └── HTTP route handlers
```

Client and server code must still remain logically separated.

Server-only functionality must not enter browser bundles.

Examples of server-only data:

- database credentials
- session secrets
- results-signer private key
- privileged blockchain operations

Route handlers should remain thin.

Complex server logic should be placed in server-only modules rather than accumulated directly inside HTTP handlers.

The backend may later move heavy replay/indexing work to a dedicated service without requiring the frontend architecture to change.

---

## 13. Authentication Boundary

Authentication must be isolated behind an application-level boundary.

The original product specification defines Sign-In with Ethereum for browser session establishment.

MiniPay must not be forced through a generic message-signing flow merely to access or authenticate to the Mini App.

Therefore:

```text
Authentication
├── standard web runtime
│   └── backend-approved wallet/SIWE session flow
│
└── MiniPay runtime
    └── backend-approved MiniPay-compatible session flow
```

Do not couple application components directly to SIWE implementation details.

Until the backend defines the approved MiniPay server-authentication protocol, treat that portion as an explicit unresolved integration dependency.

Do not invent an authentication mechanism.

---

## 14. Wallet Architecture

Wallet behavior depends on runtime environment.

### MiniPay Runtime

When running inside MiniPay:

- use the injected provider
- connect automatically
- expose connection/loading/error state
- do not render the generic desktop wallet picker
- do not render a normal Connect Wallet flow

### Standard Web/PWA Runtime

Outside MiniPay:

- expose the supported normal wallet connection experience
- support the approved injected/WalletConnect strategy
- expose connection and network state

Runtime detection belongs in the Web3 integration layer.

Feature components should consume normalized wallet state instead of repeatedly detecting MiniPay themselves.

Conceptually:

```text
                Wallet Adapter
                     |
        +------------+-------------+
        |                          |
        v                          v
   MiniPay Runtime            Standard Web
 injected provider          supported connectors
```

Exact library APIs and version-specific behavior belong in `docs/research/`.

---

## 15. Web3 Integration Boundary

Blockchain interaction must be centralized.

The Web3 layer owns:

- chain configuration
- RPC/client configuration
- wallet connectors
- MiniPay detection
- contract addresses
- contract ABIs
- transaction construction
- transaction receipt tracking
- token-unit conversion helpers
- explorer URL construction

UI components should call feature-level hooks/services rather than construct raw contract calls themselves.

Do not scatter:

- addresses
- ABIs
- chain IDs
- token decimals
- encoded action values

through page components.

---

## 16. G$ Transaction Model

Slyyce uses GoodDollar G$ for supported value flows.

Purchases and tournament entry are designed around a single-transaction token-and-call flow where supported by the confirmed contracts.

Architecture:

```text
Player Wallet
     |
     | G$ transaction
     v
G$ Token
     |
     | token transfer + callback
     v
Slyyce Contract
     |
     | event
     v
Backend Indexer
     |
     v
Application Database
     |
     v
Frontend Query Refresh
```

A transaction receipt confirms blockchain execution.

It does not automatically prove that asynchronous indexed application state has already synchronized.

The UI must distinguish transaction confirmation from backend synchronization when necessary.

Do not grant inventory locally merely because a wallet transaction was submitted.

---

## 17. Transaction State Machine

Money-moving UI must use an explicit lifecycle.

Conceptually:

```text
idle
  |
  v
preparing
  |
  v
awaiting_wallet
  |
  +----> rejected
  |
  v
submitted
  |
  v
confirming
  |
  +----> failed
  |
  v
confirmed
  |
  v
synchronizing
  |
  v
success
```

Features may omit states that genuinely do not apply.

Do not reduce transaction UX to a single boolean such as `isLoading`.

User cancellation, contract revert, RPC failure, and successful confirmation are different outcomes and must remain distinguishable.

---

## 18. Contract Boundary

The frontend interacts with confirmed contract interfaces.

Primary application contracts are:

```text
SliceShop
SliceTournament
```

The frontend must not own:

- pricing authority
- tournament accounting
- prize-root authority
- claim validation
- administrative operations

Contract addresses must come from environment-aware configuration.

Contract ABIs should have one canonical source inside the client integration layer.

Do not maintain multiple manually divergent copies of the same ABI.

---

## 19. Event Indexing Boundary

Some application state is derived from blockchain events.

Examples include:

- purchases
- tournament entries
- prize claims

The backend indexer is responsible for converting confirmed events into application/database state.

The frontend must not implement an independent authoritative indexer.

After transactions that affect indexed state:

1. wait for the blockchain result
2. trigger/refetch application state
3. tolerate short indexing delay
4. present synchronization state when necessary

Indexer operations must be idempotent on the backend.

---

## 20. Rewards Architecture

Reward eligibility is backend/contract-derived.

Expected flow:

```text
Verified tournament results
        |
        v
Backend computes payouts
        |
        v
Merkle tree/root
        |
        +------> root posted on-chain
        |
        v
Proof stored for player
        |
        v
Frontend receives claim data
        |
        v
Player submits claim
        |
        v
Contract verifies proof
```

The frontend renders proof/claim state supplied by authoritative systems.

It must not calculate a user's authoritative prize independently.

---

## 21. GoodDollar Identity and UBI Boundary

GoodDollar-specific identity and UBI operations belong in a dedicated integration module.

Feature UI should consume normalized application operations such as:

- identity status
- verification availability
- claim eligibility
- next claim time
- claim action

Do not spread SDK-specific calls across components.

GoodDollar behavior is version-sensitive.

Exact SDK APIs, environments, addresses, and transaction behavior must come from verified research in `docs/research/`.

ADR-0001 gates remain unresolved for SDK/documentation drift, identity and claims inside MiniPay, the non-production/test environment, and GoodDollar package adoption. Preserve this integration boundary without installing SDK packages or implementing blocked flows until the applicable gates are resolved.

---

## 22. PWA Architecture

The same Next.js application provides the installable PWA.

The service worker may cache application assets that improve repeat-load performance, including appropriate:

- application shell resources
- game sprites
- audio
- fonts
- static images

Mutable authoritative application data must not be served from a stale offline cache.

Treat data such as the following as network/authoritative state unless an explicitly safe strategy is designed:

- balances
- shop prices
- inventory
- rewards
- leaderboard
- tournament state
- authentication/session state
- transaction state

Service-worker integration must match the actual Next.js bundler used by the repository.

Do not copy a webpack-specific PWA configuration into a Turbopack build or vice versa.

---

## 23. Configuration Architecture

Environment-specific configuration must be centralized.

Configuration categories include:

- active network/environment
- RPC endpoints
- wallet integration configuration
- G$ address
- Shop contract address
- Tournament contract address
- public application URLs
- server-only database/session configuration
- server-only signing credentials

Public and secret configuration must remain explicitly separated.

Browser-exposed configuration must never contain private credentials.

Environment parsing should fail clearly when required values are invalid or missing.

Do not read arbitrary environment variables throughout application components.

Use a validated configuration boundary.

---

## 24. Error Architecture

External systems fail independently.

Errors should be normalized close to their integration boundary.

Relevant error domains include:

- wallet
- transaction
- contract
- RPC
- API
- authentication
- game runtime
- GoodDollar
- MiniPay
- PWA/network

Low-level errors may be logged for diagnostics where safe.

User-facing components should receive actionable normalized error states.

Do not expose secrets, internal stack traces, or sensitive raw payloads to users.

---

## 25. Performance Boundaries

Active gameplay has stricter performance requirements than standard application UI.

Rules:

- load Phaser only when needed
- avoid Phaser in initial bundles for unrelated routes
- do not trigger React rendering at game-frame frequency
- keep game simulation inside the game/shared layer
- minimize React/Phaser bridge traffic
- lazy-load heavy optional integrations where appropriate
- optimize game assets for mobile delivery
- pause/suspend gameplay appropriately when the document loses visibility
- cap unnecessary rendering cost on high-density displays where appropriate

Performance decisions should prioritize mid-range mobile devices and weak networks.

---

## 26. Offline Boundary

Offline support exists to improve resilience, not to create false authoritative state.

Offline-safe behavior may include:

- loading cached static shell
- displaying cached static assets
- showing a clear offline state

Do not allow stale or fabricated online state to appear authoritative.

Actions requiring:

- wallet RPC
- blockchain transactions
- fresh balance
- server verification
- tournament entry
- reward claims

must fail or wait clearly when required connectivity is unavailable.

---

## 27. Security Trust Boundaries

Trust hierarchy:

```text
Client input
    = untrusted

Client-computed score
    = untrusted until replayed

Wallet button interaction
    = not proof of transaction success

Blockchain receipt
    = authoritative for that transaction

Backend verified round
    = authoritative application score

Indexed confirmed event
    = authoritative application inventory/entry state

Server secrets/private keys
    = server only
```

The browser must never receive:

- results-signer private key
- database credentials
- session secrets
- administrative contract credentials

Client validation improves UX.

It is not a substitute for backend or smart-contract validation.

---

## 28. Dependency Direction

Dependencies should flow inward toward stable domain boundaries.

Preferred direction:

```text
UI
 |
 v
Feature/Application Logic
 |
 +------------+
 |            |
 v            v
API         Web3
 |            |
 v            v
Server      Chain
```

And for gameplay:

```text
React UI -----> Game Bridge -----> Phaser
                     |
                     v
              Shared Game Types

Phaser -----------> Shared Rules
Backend Replay ---> Shared Rules
```

Avoid reverse dependencies where low-level infrastructure imports feature UI.

---

## 29. Testing Boundaries

Tests should verify behavior at the layer that owns it.

### Shared Simulation

Verify deterministic behavior and scoring independently.

### Game

Verify bridge behavior and deterministic integration without requiring the entire application where possible.

### API Layer

Verify:

- request behavior
- response validation
- error normalization

### Web3 Layer

Verify:

- transaction construction
- transaction-state handling
- wallet/runtime branching
- contract interaction boundaries

### UI

Verify:

- loading
- error
- empty
- success
- responsive behavior
- user interaction

### End-to-End

Reserve end-to-end coverage for critical flows such as:

- wallet connection
- shop purchase
- tournament entry
- reward claim
- gameplay round submission

Do not use end-to-end tests as the only verification of lower-level domain logic.

---

## 30. Observability Boundary

Production failures must be diagnosable.

Client observability should capture actionable application failures without exposing sensitive data.

Important failure domains include:

- application crashes
- game initialization failures
- API failures
- wallet failures
- transaction failures

Backend monitoring additionally owns scheduled/indexer/result-posting failures.

Observability tooling must not log private credentials or sensitive authentication material.

---

## 31. Architecture Invariants

The following are non-negotiable unless explicitly changed through an architectural decision:

1. One web codebase serves browser, PWA, and MiniPay.
2. Normal gameplay remains off-chain.
3. The server never signs player transactions.
4. Final scores are not trusted from the browser.
5. Deterministic rules required for replay are shared between client and server.
6. Phaser is browser-only and isolated from the React application through a narrow bridge.
7. React must not process frame-level gameplay state.
8. Remote server state is not duplicated into local state stores without justification.
9. Blockchain success is determined from authoritative blockchain state, not UI actions.
10. Indexed application state is refreshed from the backend rather than fabricated optimistically.
11. MiniPay and standard web wallet UX are allowed to differ.
12. Third-party integration details are verified against the versions actually installed.
13. Secrets and privileged signing keys remain server-side.
14. Environment-specific blockchain configuration is centralized.
15. The frontend must not recreate backend or contract authority.
16. Large architectural changes require a documented decision.

---

## 32. Known Architectural Dependencies

The original build specification defines SIWE-based session creation.

Current MiniPay requirements do not permit forcing a generic message-signing flow merely to access or authenticate to the Mini App.

Therefore, the standard-web authentication path and MiniPay authentication path must remain separable.

The backend-approved MiniPay session protocol must be resolved before MiniPay authentication is considered production-complete.

Do not guess this implementation.

ADR-0001 also preserves unresolved GoodDollar identity/claim, SDK/documentation, environment and package-adoption boundaries, plus the MiniPay/browser/WebView support floor. Foundation readiness does not resolve those questions. Stop at the affected integration boundary rather than inventing a workaround; see the ADR for the six controlling gates.

Track the resolution through:

- `docs/research/`
- `docs/decisions/`
- the active execution plan
- `docs/CURRENT_STATE.md` while unresolved