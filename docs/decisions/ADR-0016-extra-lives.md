# ADR-0016: Extra lives as a consumable shop item

Status: Accepted
Date: 2026-11-11

## Context

The owner wants players to buy extra lives with G$: 3 lives per purchase at 100 G$ each, bought as often as they like, and blocked in tournaments. SlyceShop records purchase counts but has no notion of using an item up. Lives used must not come back when a player clears their phone, and the round that used one must be identifiable so it can be kept out of tournaments.

## Decision

- **Shop item.** `401` ("3 extra lives") is listed with `maxPerWallet = 0`, so it can be bought repeatedly, at 300 G$ (`contracts/script/ListCosmetics.s.sol`; reprice with `setItem`). Lives owned = `SlyceShop.purchased(player, 401) × 3`, read on-chain.
- **Using a life.** The backend records each life in the `ExtraLifeUse` table (`address`, `useNumber`, `ticket`). The unique pair `(address, useNumber)` stops two simultaneous uses from spending the same life.
  - `GET /api/v1/extra-lives?address=` returns `{owned, used, available}`.
  - `POST /api/v1/extra-lives/use {address, token}` spends one life on the round identified by its ADR-0015 ticket. It returns 409 `no_extra_lives` when none are left, and 422 for a bad ticket.
  - The service needs `SCORE_SIGNER_PRIVATE_KEY`, `SLYYCE_SHOP_ADDRESS` and an RPC URL.
- **Game.** At zero lives, the arena pauses and offers "Use an extra life (N left)" for 8 seconds, then ends the round. Continuing gives 1 life and a cleared board. `GameResult.extraLivesUsed` counts the lives used.
- **Tournaments.** The game-over screen doesn't offer a tournament submit for a continued round, and `/score-tickets/finish` refuses a tournament signature for any ticket with a recorded use (`extra_life_round`). Continued rounds still save normally and count for XP, streaks and milestones.

## Rationale

The purchase stays on-chain and auditable without a contract upgrade. Usage needs only one small table. Reusing the round ticket ties each use to a specific round, which is what the tournament rule needs.

## Consequences

### Positive

- No contract change, and the price can be changed with one owner call.
- Lives can't be restored by clearing local storage, and they can't be double-spent.

### Negative

- **Anyone can spend a player's lives.** Round tickets are issued without authentication, so someone could request a ticket for another player's address and use up that player's lives. Nobody gains from it, but adding wallet authentication would close the gap.
- **The live database needs the `20261111120000_extra_life_uses` migration.**
- **Extra lives depend on the backend.** If it's down, players can't use one and the round simply ends.

## Evidence

- `backend/test/extra-lives.test.ts`: 3 lives per pack; 5 simultaneous uses spend only 3; tournament refusal; HTTP routes.
- `apps/web/tests/unit/game-session.test.tsx`: the continue and decline flows.
