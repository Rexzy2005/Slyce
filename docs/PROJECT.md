# Slyyce Project Specification

## 1. Purpose

This repository contains **Slyyce**, renamed from Slyce on 2026-10-29.

Product tagline:

> Swipe. Slice. Stack your G$.

Use **Slyyce** as the product name and `@slyyce/` as the workspace package scope. The existing repository folder name is unchanged.

Slyyce is a mobile-first game where players slice objects through swipe-based gameplay, earn scores, compete in tournaments, acquire gameplay items, and interact with the GoodDollar G$ token.

The application must combine conventional off-chain gameplay with limited, explicit blockchain interactions.

---

## 0. Current Product Decisions (2026-10-29)

See ADR-0005: players must sign in (email or wallet) before any app screen; every round costs an on-chain G$ play fee (SlyceArcade); the app opens directly into `/play` with app-style navigation (no landing page). Where this file says otherwise (e.g. §5 "playing a round" is off-chain, §7 public landing), ADR-0005 governs.

## 2. Primary Product Strategy

The product must ship first as:

1. A responsive website.
2. An installable Progressive Web App.
3. ~~MiniPay Mini App~~ (removed by ADR-0004; PWA only).

A separate native iOS or Android application is not part of the initial implementation.

The web application must provide one shared product experience across:

- mobile browsers
- desktop browsers
- installed PWA
- ~~MiniPay~~ (removed by ADR-0004)

Platform-specific wallet behavior may differ where required.

---

## 3. Core Product Principle

Gameplay must remain off-chain.

Blockchain transactions are reserved for actions involving real G$ movement or claims.

A normal gameplay round must not require a blockchain transaction.

The server must never sign transactions on behalf of players.

---

## 4. Player Blockchain Actions

The player may sign blockchain transactions for these product actions:

### Receive G$

- Claim GoodDollar UBI.
- Claim tournament prizes.
- Claim eligible streak rewards.
- Claim sponsored-event prizes where applicable.

### Spend G$

- Buy gameplay power-ups.
- Buy cosmetic items such as skins or blade trails.
- Purchase a continue after an eligible game-over state.
- Enter a tournament.

Purchases and tournament entries should use the G$ token integration defined by the smart-contract layer.

The frontend must never simulate successful token movement when no confirmed blockchain transaction exists.

---

## 5. Off-Chain Actions

The following remain off-chain:

- playing a round
- calculating/displaying live gameplay state
- recording gameplay input
- displaying scores
- leaderboard browsing
- consuming inventory during gameplay
- normal UI navigation
- retrieving application data

Inventory ownership originates from verified purchases, but using an owned gameplay item during a round does not itself require another blockchain transaction.

---

## 6. Primary User Flows

The product must support these major flows.

### Play

1. Player opens the game.
2. A round is created.
3. The client receives the required round information.
4. Player completes swipe-based gameplay.
5. Client submits the required gameplay/input log.
6. Server independently verifies/replays the round.
7. Verified score becomes eligible for the appropriate leaderboard.

### Shop Purchase

1. Player views available items.
2. Product shows current G$ price and ownership state.
3. Player initiates purchase.
4. Wallet requests transaction approval.
5. Frontend waits for blockchain confirmation.
6. Backend/indexer detects the purchase event.
7. Inventory is updated.
8. Frontend refreshes inventory.

Do not optimistically grant purchased inventory before authoritative confirmation.

### Tournament Entry

1. Player views the current tournament.
2. Product shows entry requirements, prize information and remaining time.
3. Player initiates entry.
4. Required G$ transaction is submitted.
5. Confirmed entry becomes associated with the player's tournament participation.
6. Player submits eligible gameplay runs.
7. Verified tournament scores determine ranking.

### Prize Claim

1. Backend determines eligible winners.
2. Claim information becomes available to the frontend.
3. Player sees claimable reward state.
4. Player initiates the claim transaction.
5. Contract validates the claim.
6. Frontend reflects confirmed claimed state.

### GoodDollar UBI

The Get G$ experience must expose the supported GoodDollar identity and UBI-claim workflow.

Future token-swap functionality must not be treated as implemented unless its production integration is explicitly approved.

---

## 7. Required Product Screens

The initial product includes these application areas.

### Public Landing and Arcade Entry

The / route is a dedicated public landing page, separate from the gaming interface. Its primary Launch game action opens the /play lobby. The lobby opens /play/arena, a separate wooden chopping-board canvas page with a HUD and display controls. The landing introduces Slyyce without mounting wallet providers or displaying the arcade navigation.

The gaming interface exposes Play, Daily Tournament, Shop, Leaderboard, Rewards, Get G$ and Profile. Its header provides Connect wallet (RainbowKit). The arena is visually dominant. Account and G$ balance remain available through the wallet/profile interfaces.

### Game

Must provide:

- full-screen or game-focused canvas
- current score
- lives/state required by gameplay
- available power-up controls
- responsive touch interaction

### Game Over

Must provide relevant actions such as:

- final score
- best score
- play again
- eligible continue action
- score/account-related action where required

### Shop

Must show:

- available gameplay items
- cosmetic items
- G$ prices
- owned quantities/state
- purchase actions

### Tournament

Must show:

- current tournament
- current pool/prize information
- entry cost
- time remaining
- entry state
- user's best eligible run
- entry action

### Leaderboard

Must support the required leaderboard scopes:

- today
- this week
- all time

### Rewards

Must show:

- claimable tournament prizes
- claimable streak rewards
- lock/unlock state where applicable
- claim state
- claim action

### Get G$

Must support the approved GoodDollar flows, including:

- identity state
- UBI eligibility
- UBI claim
- next eligible claim information where available

### Profile

Must expose relevant player information such as:

- wallet/account
- owned cosmetics
- inventory-related state where appropriate
- transaction/activity history
- blockchain explorer links where applicable

---

## 8. Gameplay Integrity

The browser must not be trusted as the authoritative source of final scores.

Each round must use deterministic data sufficient for server-side replay.

Client and server must share the same deterministic gameplay rules where required, including:

- seeded random behavior
- scoring rules
- simulation rules required for score verification

The client submits input events and relevant item usage.

The server independently validates the round.

A manipulated client must not be able to create an authoritative score simply by submitting a claimed score value.

---

## 9. Frontend Product Responsibilities

The frontend owns the user experience for:

- responsive application UI
- game rendering and interaction
- wallet connection state
- MiniPay-specific wallet behavior
- G$ balance presentation
- transaction initiation
- transaction progress and failure states
- GoodDollar identity/claim interaction
- backend API consumption
- inventory presentation
- tournament presentation
- leaderboard presentation
- reward claims
- PWA installation experience
- offline/static-shell behavior
- player-visible errors

The frontend must clearly distinguish:

- disconnected
- connecting
- ready
- awaiting wallet approval
- transaction submitted
- confirming
- confirmed
- synchronization pending
- successful
- failed
- rejected
- insufficient balance

Exact implementation details belong in `ARCHITECTURE.md` and the relevant verified research documents.

---

## 10. Backend Product Boundary

The backend is responsible for authoritative application data and verification, including:

- player/session handling
- round creation
- round completion
- deterministic score verification
- leaderboard data
- inventory data
- item-use validation
- reward data
- purchase/event indexing
- tournament entry indexing
- payout preparation
- scheduled tournament close operations

The frontend must consume backend results through documented interfaces rather than reproduce backend authority locally.

---

## 11. Expected API Surface

The build specification defines these initial backend capabilities:

- player authentication/session establishment
- create/start round
- finish/verify round
- retrieve leaderboard
- retrieve inventory
- consume inventory item
- retrieve rewards
- retrieve shop items

The exact request/response schemas belong in `docs/API_CONTRACTS.md` or the architecture documentation once confirmed by implementation.

Do not invent missing schemas in UI components.

---

## 12. Smart Contract Product Boundary

The initial product uses two primary application contracts:

### Shop

Responsible for receiving eligible G$ purchases and emitting authoritative purchase events.

### Tournament

Responsible for:

- tournament entry
- sponsored funding where applicable
- posting result roots
- prize claims
- tournament-related fund accounting

Contract code, deployment and security review are separate responsibilities from the frontend.

The frontend must consume confirmed contract interfaces and deployed addresses from configuration.

Do not duplicate contract business logic in the UI.

---

## 13. GoodDollar

G$ is the product's blockchain currency.

The product uses GoodDollar for:

- player balances
- purchases
- tournament participation
- eligible prize payouts
- UBI claims
- identity-related verification where required

All GoodDollar-specific implementation behavior must follow verified research in `docs/research/`.

Do not implement GoodDollar behavior from memory or assumptions.

---

## 14. MiniPay

**Superseded by ADR-0004 (2026-10-15): MiniPay is out of scope; the product ships as a web app and PWA.** The original requirement follows for history.

MiniPay is a first-class distribution environment, not a secondary compatibility target.

The same web application must function correctly when opened inside MiniPay.

MiniPay-specific wallet, transaction, testing, listing and compatibility requirements must come from verified current official MiniPay documentation recorded in `docs/research/`.

Do not assume normal desktop-wallet behavior applies inside MiniPay.

---

## 15. PWA Requirements

The application must be installable as a PWA.

Required product behavior includes:

- application manifest
- app icons
- standalone/fullscreen-style installed experience as appropriate
- portrait-oriented mobile gameplay
- cached application shell/static game assets where appropriate
- useful repeat-load behavior on weak networks
- installation guidance where supported

Dynamic authoritative data must not become stale because of inappropriate offline caching.

Examples include:

- balances
- scores
- leaderboard data
- inventory
- prices
- rewards
- transaction state

---

## 16. Visual Direction

The product uses the **Night Market** visual direction.

### Base Colors

- Night: `#0E1712`
- Canopy: `#18261D`
- Vine: `#2A3D31`
- Cream: `#F7F2E7`
- Mist: `#A7B3AA`

### Action Colors

- Mango: `#FFB627`
- Leaf: `#2FBF71`
- Watermelon/Melon: `#FF4D6D`
- Sky: `#3BA8FF`
- Ember: `#E5383B`

### Semantic Meaning

- Mango → primary/spending actions
- Leaf → earnings/rewards
- Sky → G$ values and relevant links
- Watermelon/Melon → combos, streaks and highlights
- Ember → danger, bombs, errors and transaction failures
- Cream → primary text
- Mist → secondary text

Do not use Ember as the normal color for an action that spends G$.

The game itself should remain visually dominant over surrounding interface chrome.

Accessibility and readable contrast must be maintained.

Detailed component/design rules belong in the frontend/design documentation rather than this file.

---

## 17. Performance Requirements

The product is mobile-first.

Frontend decisions must account for:

- mid-range Android devices
- iPhone
- desktop/laptop browsers
- touch accuracy
- weak or expensive mobile networks
- limited device resources

The game should target smooth gameplay and avoid unnecessary application work during active play.

Large game/runtime dependencies should not unnecessarily affect unrelated application routes.

---

## 18. Security Principles

The product deals with real blockchain assets.

Therefore:

- the client is not trusted as an authority
- private keys must never exist in client code
- secrets must not be exposed through public environment configuration
- blockchain results must not be inferred from button clicks
- transaction failure/rejection must be handled explicitly
- backend score verification must not trust client-provided score values
- production contract addresses must come from controlled configuration
- security-sensitive integration behavior must follow current verified documentation

Smart contracts handling real funds require testing and external review before production use.

---

## 19. Testing Expectations

Critical money-moving flows require stronger verification than ordinary UI flows.

Frontend testing must eventually cover at least:

- purchase flow
- tournament entry
- prize claim
- insufficient G$ balance
- rejected transaction
- failed transaction
- wallet behavior
- MiniPay behavior
- responsive mobile layout
- game/client integration
- API failure states

Gameplay verification must prove that identical deterministic inputs produce compatible results between the client and server/shared simulation.

Actual testing strategy and commands belong in the testing documentation.

---

## 20. Deployment Environments

The product must progress through distinct environments rather than jumping directly to production.

### Test Environment

Used for:

- contract testing
- frontend integration
- transaction testing
- complete user-flow testing without production funds

### Staging

Used for:

- end-to-end integration on the intended production blockchain environment using non-production GoodDollar configuration where specified
- real-device testing
- tournament testing
- indexer/replay validation
- payout validation

### Production

Uses:

- production G$
- reviewed production contracts
- production configuration
- monitoring
- public contract/payout information
- production MiniPay distribution

Environment-specific addresses and configuration must never be scattered through application source code.

---

## 21. Product Completion Standard

A screen existing does not mean the feature is complete.

A frontend capability is complete only when the required combination of these is satisfied:

- usable UI exists
- responsive states exist
- loading/error/empty states exist
- required API integration exists
- required wallet integration exists
- transaction lifecycle is handled where applicable
- authoritative state is synchronized
- relevant tests pass
- production build succeeds
- known external dependency gaps are documented

Mocked behavior must be explicitly identified as mocked.

Do not present placeholders, mocks or simulated blockchain outcomes as production-complete functionality.

---

## 22. Scope Control

This document defines product requirements, not detailed implementation instructions.

Do not place the following here unless they become product requirements:

- package versions
- framework-specific implementation snippets
- exact wallet-hook APIs
- detailed folder structures
- deployment commands
- temporary workarounds
- agent instructions
- session notes

Those belong in:

- `ARCHITECTURE.md`
- `docs/research/`
- `docs/decisions/`
- `docs/exec-plans/`
- `docs/handoffs/`

This separation is intentional so product requirements remain stable while implementation details evolve.
