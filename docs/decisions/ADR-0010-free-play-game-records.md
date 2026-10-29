# ADR-0010: Free-to-Play Game Records with G$ Milestone Rewards

Status: Accepted
Date: 2026-10-29

## Context

The team adopted a play-to-earn model like other GoodBuilders games: free play, every game recorded on-chain, XP, G$ rewards for milestones, bounties and public profiles. Scores come from the player's device.

## Decision

`SlyceArcade` v2.0 (in-place UUPS upgrade, storage appended), with the round fee set to 0:
- `submitGame(score, bestCombo, fruits)` records the game on-chain and updates XP (score ÷ 10), best score, games played and the daily streak. The score cap is 100,000, with one submission per 20 seconds per player.
- **Milestone G$:** 500 / 1,000 / 2,500 / 5,000 points pay 5 / 15 / 40 / 100 G$. Only GoodDollar-verified humans are paid, **once per milestone per day per root identity**. Payments come from a pot funded with `fundRewards`, and an unfunded milestone is skipped while the game is still recorded.
- Each submission also keeps bounties (auto-rolling tournaments, ADR-0009) running. Bounty prize pools are now funded by the team and sponsors.
- The app adds "Save on Celo" on game over, on-chain profile stats, a public `/player` profile and a `/how-to-play` page.

## Consequences

- Without backend-signed scores, a verified cheater can claim at most 160 G$ per day. The owner can pause, lower rewards or drain the pot.
- **Follow-up:** require backend replay-verified signatures (`RESULTS_SIGNER_PRIVATE_KEY`) before scaling rewards.
- Gas per saved game, fork-measured: ~111k without a reward, ~430k with one (the G$ transfer dominates).
