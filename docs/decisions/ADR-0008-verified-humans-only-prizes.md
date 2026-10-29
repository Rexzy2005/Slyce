# ADR-0008: Prize Tournaments Are for GoodDollar-Verified Humans

Status: Accepted
Date: 2026-10-29

## Context

Prize pools are real G$, and bots or multi-wallet farmers could drain them. GoodBuilders Season 5 lists "Identity SDK: use GoodDollar identity in a meaningful way, such as rewarding only verified humans."

## Decision

- `SlyceTournament.setIdentity(GoodDollar Identity)` turns on an entry gate: `enter` requires `getWhitelistedRoot(msg.sender) != 0`.
- Entries are tracked per root identity, so wallets linked to the same human get one entry per tournament.
- `Deploy.s.sol` sets the gate from `IDENTITY`. Production Identity is `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`.
- The Tournament page checks the same condition and sends unverified players to `/get-gd` (face verification + UBI claim).

## Consequences

- Entering costs ~20k more gas.
- Playing rounds stays open to everyone. Only prize competition requires verification.
- Fork-tested against the real Identity contract with a recent verified UBI claimer.
