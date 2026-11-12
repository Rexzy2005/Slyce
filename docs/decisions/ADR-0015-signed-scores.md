# ADR-0015: Backend-signed scores with one-time round tickets

Status: Accepted
Date: 2026-11-08

## Context

Arcade v2.0.0 and Tournament v1.3.0 accept any score the client reports (`submitGame`, `submitScore`), limited only by `maxScore` and a save interval. Anyone can call the contracts directly with a fake score and collect milestone G$ or top a tournament. The existing `verified-fruit-slice-v1` replay verifier (`packages/shared/src/verified-game.ts`) simulates a different, simplified game, so it cannot check arena rounds: the arena (`apps/web/src/game/runtime.ts`) uses `Math.random`, frame timing and screen-size-dependent physics. Making it deterministic and replaying it on the server is the long-term answer and is too large to do before rewards are funded.

## Decision

Phase 1, which this ADR covers:

- **Contracts.** `SlyceBase` gains an ERC-7201 namespace, `slyce.storage.ScoreAuth`, holding `scoreSigner` and `usedTickets`, plus an EIP-712 domain (`name "Slyyce"`, `version "1"`, chain id, proxy address).
  - Arcade v2.1.0 adds `submitSignedGame(score, bestCombo, fruits, ticket, deadline, signature)` over `Game(address player,uint256 ticket,uint32 score,uint32 bestCombo,uint32 fruits,uint64 deadline)`.
  - Tournament v1.4.0 adds `submitSignedScore(id, score, ticket, deadline, signature)` over `TournamentScore(address player,uint256 id,uint256 ticket,uint32 score,uint64 deadline)`.
  - While `scoreSigner` is zero, the old unsigned functions still work. Once the owner sets it, they revert with `SignatureRequired`.
  - Each contract accepts a ticket once.
  - `setScoreSigner(0)` turns signing off.
- **Backend.** `POST /api/v1/score-tickets` issues a stateless ticket: a random 128-bit id plus player and issue time, bound with an HMAC derived from `SCORE_SIGNER_PRIVATE_KEY`. `POST /api/v1/score-tickets/finish` signs the result only if:
  - the ticket is valid, is for this player and is at most 2 hours old (raised from 30 minutes on 2026-11-12, after long rounds on a prefetched ticket were refused; the app now refreshes a ticket older than 3 minutes when a round starts);
  - the score matches the arena's scoring rules (10 points per fruit, plus a 5-point combo bonus per fruit for swipes of 3 or more);
  - the fruit count is at most 6 per second since the ticket was issued, plus 5 seconds of slack.

  Signatures expire after 1 hour. Rejections return 422. No database is used: the contracts enforce single use.
- **App.** The arena keeps one ticket prefetched and claims it when a round starts. At game over, it asks the backend to sign the result and calls the signed function. Which mode applies comes from `scoreSigner()`. With signing on, the Compete page no longer submits a stored best score and points players to the game-over submit.

Phase 2 (planned): make the arena deterministic (seeded RNG, fixed timestep, normalised coordinates), record swipes and replay them on the server before signing.

## Rationale

- **Phase 1 closes the cheapest attacks** (direct contract calls, replayed results, impossible scores) with a small change, and switching it on or off is a single owner call.
- **Stateless tickets avoid a migration**, so production database changes stay out of this step.
- **Prefetching the ticket keeps rounds from waiting on a sleeping backend.**
- **The plausibility bound is deliberately generous** (the arena's fastest pacing is about 4.8 launches per second), so honest players are never rejected.

## Consequences

### Positive

- Milestone G$ and tournament scores need a backend signature that a player cannot forge.
- Each round can be saved once in the Arcade and submitted once to a tournament.

### Negative

- **A modified client can still report believable scores.** Phase 2 is needed for full integrity.
- **Saving and submitting now depend on the backend.** If it is down, scores cannot be saved while signing is on. Fallback: the owner calls `setScoreSigner(0)`.
- **The signer key is a hot key on Render.** If it leaks, rotate it with `setScoreSigner(newAddress)`. A leaked key allows fake scores but no access to funds.
- **The Compete page can no longer submit an older stored best score.**

## Evidence

- `contracts/test/SignedScores.t.sol`, including a vector signed by the backend's `ScoreSigningService` and accepted on-chain.
- `backend/test/score-signing.test.ts`.
- `apps/web/tests/unit/score-tickets.test.ts`.
- Upgrade-safety validation: `@openzeppelin/upgrades-core@1.46.0 validate`, run on 2026-11-08.
