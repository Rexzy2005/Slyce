# ADR-0007: Play Fees Fund the Daily Prize Pool

Status: Accepted
Date: 2026-10-28

## Context

GoodBuilders Season 5 requires a meaningful G$ integration; "only accepting G$ as a payment option doesn't count." Until now, the G$ round fee went only to the treasury.

## Decision

- `SlyceArcade.play` routes the fee into the tournament the owner marked as prize tournament (`SlyceTournament.setPrizeTournament`) while it is open. Otherwise the fee goes to the treasury.
- Only the configured arcade (`setArcade`) can call `creditFromArcade`.
- Routed fees are recorded as sponsorship by the treasury address, so a cancelled tournament refunds them to the treasury. The `balance == liabilities` invariant holds.
- Winners are still posted by the operator as a Merkle root (ADR-0004) and claim G$ on the Rewards tab.
- Contracts v1.2.0. `CreateTournament.s.sol` marks each new tournament as the prize tournament by default (`PRIZE=1`).

## Consequences

- G$ circulates player → prize pool → winners, verifiable on-chain through `RoundPaid(…, prizeTournament)`, `PoolFundedByPlay` and `PrizeClaimed` events.
- One paid round costs ~309k gas with real G$ (fork-measured).
- A daily tournament must be created for routing to apply. Results remain operator-posted from self-reported scores until verified backend scores are wired in.
