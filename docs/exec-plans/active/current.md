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
- [x] Production rollout (2026-11-09): signer `0x3Ae85054B61fb3Af7F319e8b610516d7b6317756` set on both proxies; mainnet simulation accepts a signed save and refuses unsigned and tampered ones. Steps used:
  1. `cast wallet new` → set `SCORE_SIGNER_PRIVATE_KEY` on Render, then redeploy.
  2. Check: `POST https://slyce-setp.onrender.com/api/v1/score-tickets` with `{"address":"0x…"}` returns 201.
  3. Deploy the web app (works in both modes).
  4. Upgrade the proxies: `PROXY=<arcade> CONTRACT=Arcade` and `PROXY=<tournament> CONTRACT=Tournament` with `script/Upgrade.s.sol`. Behaviour is unchanged while the signer is 0.
  5. `cast send <arcade|tournament> "setScoreSigner(address)" <signer address>` on both.
  6. Play a round on a phone and confirm the save and tournament submit go through.
- [ ] Phase 2: deterministic arena and server replay

## Blockers

None. Remaining: confirm a real round saves on a phone.

## Acceptance criteria

- With the signer set, unsigned `submitGame` and `submitScore` revert.
- A real round saves and submits without extra prompts beyond the wallet confirmation.
- An implausible score is refused with a clear message.

## Required verification

`forge test`, upgrade-safety validate, backend `pnpm test`, web `pnpm typecheck` and `pnpm test`, root `pnpm lint` and `pnpm format:check`, then an on-device round after rollout.

## Rollback

`setScoreSigner(0)` on both contracts restores unsigned saving immediately.

## Additional active workstream — Shop and profile experience (2026-11-14)

### Objective

Make `/shop` a more memorable storefront, redesign the Profile arcade wallet card, and let players inspect and equip their owned cosmetics in a loadout modal. Apply the borderless surface rule across player and admin product UI, using color, spacing, depth and focus rings for definition. Use the pinned lucide-react icons consistently across the app UI.

### Scope and progress

- [x] Add category navigation and visual previews tailored to blades, fruit, boards and extra lives without changing authoritative pricing, ownership or purchase behavior.
- [x] Redesign the Profile wallet card and add a native, keyboard-dismissable loadout dialog with equip controls.
- [x] Replace UI emoji/glyph pictograms with the shared Lucide icon component and retain the direct Lucide imports in the admin UI.
- [x] Apply borderless card, button and navigation styling across shared, Profile, Shop and Admin UI surfaces.
- [ ] Complete web type checking and visual acceptance.

### Acceptance criteria

- Shop remains usable at mobile and desktop widths and shows only contract-listed or already-owned items.
- Wallet balances and purchase/equip state remain authoritative from their existing sources.
- Loadout dialog opens from Profile, closes by Escape, backdrop or close button, and supports equipping owned cosmetics.
- UI icons render from the pinned `lucide-react` 0.468.0 package.

### Verification and blocker

- `git diff --check` is required after implementation.
- `apps/web` type checking is blocked locally: `pnpm` is unavailable, and `npm run typecheck` reports missing Next.js, React, lucide-react and other declared modules. No install or lockfile changes were made.
- Browser visual acceptance remains pending; do not use the user's browser. Resume by restoring the project dependencies, running `pnpm --filter @slyyce/web typecheck`, then asking the user to review `/shop` and `/profile` in their browser.
