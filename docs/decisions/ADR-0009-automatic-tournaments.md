# ADR-0009: Automatic Prize Tournaments

Status: Accepted
Date: 2026-10-29

## Context

ADR-0007 needed the owner to create a prize tournament by hand every day. That doesn't scale, and the pool sits closed whenever the owner forgets.

## Decision

- `SlyceTournament.setAutoRoll(duration)` (owner) sets a fixed tournament length.
- `ensurePrizeTournament()` starts a free prize tournament of that length when none is open. Anyone can call it, and the parameters are fixed.
- `SlyceArcade.play` calls it on every paid round. The Tournament page offers a "Start the next tournament" button.
- Contracts v1.3.0, deployed as an in-place UUPS upgrade (`script/EnableAutoRoll.s.sol`). Storage is appended within the ERC-7201 namespace.

## Consequences

- No daily admin transaction is needed. A paid round costs ~365k gas (fork-measured).
- Ending a tournament still needs the operator to post results (`scripts/tournament-results.ts`, then `postResults`) so winners can claim.
