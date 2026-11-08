# Active Execution Plan - Signed scores (ADR-0015, phase 1)

## Objective

Rewards and tournament scores accept only backend-signed results tied to a one-time round ticket.

## Scope

- Contracts: Arcade v2.1.0 and Tournament v1.4.0 (`SlyceBase` ScoreAuth namespace).
- Backend: `ScoreSigningService` and the `/api/v1/score-tickets` routes.
- App: ticket queue, plus signed save and submit at game over.

Out of scope: phase 2 deterministic replay.

## Progress

- [x] Contracts, tests (8 signed-score tests, including a backend-made signature vector), upgrade-safety validation
- [x] Backend service, routes, config (`SCORE_SIGNER_PRIVATE_KEY`), tests
- [x] App: ticket prefetch and claim, signed `submitSignedGame` and `submitSignedScore`, Compete page guidance, tests
- [ ] Production rollout (owner), in this order:
  1. `cast wallet new` → set `SCORE_SIGNER_PRIVATE_KEY` on Render, then redeploy.
  2. Check: `POST https://slyce-setp.onrender.com/api/v1/score-tickets` with `{"address":"0x…"}` returns 201.
  3. Deploy the web app (works in both modes).
  4. Upgrade the proxies: `PROXY=<arcade> CONTRACT=Arcade` and `PROXY=<tournament> CONTRACT=Tournament` with `script/Upgrade.s.sol`. Behaviour is unchanged while the signer is 0.
  5. `cast send <arcade|tournament> "setScoreSigner(address)" <signer address>` on both.
  6. Play a round on a phone and confirm the save and tournament submit go through.
- [ ] Phase 2: deterministic arena and server replay

## Blockers

The rollout needs the owner keystore (`slyce-owner`) and Render access.

## Acceptance criteria

- With the signer set, unsigned `submitGame` and `submitScore` revert.
- A real round saves and submits without extra prompts beyond the wallet confirmation.
- An implausible score is refused with a clear message.

## Required verification

`forge test`, upgrade-safety validate, backend `pnpm test`, web `pnpm typecheck` and `pnpm test`, root `pnpm lint` and `pnpm format:check`, then an on-device round after rollout.

## Rollback

`setScoreSigner(0)` on both contracts restores unsigned saving immediately.
