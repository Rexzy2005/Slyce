# ADR-0017: Player nicknames

Status: Accepted
Date: 2026-11-12

## Context

The leaderboard and profiles identify players by wallet address, which people can't recognise. The owner wants players to choose a nickname. Without proof of ownership, anyone could rename someone else or claim a name for them.

## Decision

- **Storage.** The backend stores one nickname per wallet in `PlayerNickname` (`address` PK, `nickname`, unique lowercase `nicknameKey`). Migration: `20261112120000_player_nicknames`.
- **Proof of ownership.** To save a name, the player signs `Set my Slyyce nickname\nAddress: <lowercase address>\nNickname: <name>\nTime: <ISO time>`. The backend verifies the signature with a Celo public client (`verifyMessage`, which also accepts smart-contract wallets) and accepts signatures up to 10 minutes old. Signing is free: silent for Magic email accounts, one prompt for external wallets.
- **Rules.** 3–16 letters, numbers or underscores. Unique regardless of letter case. Staff-like names (admin, slyyce, gooddollar, moderator, support, official, team, staff, system, owner) are reserved, alone or with an `_` suffix. Renaming frees the old name.
- **API.**
  - `GET /api/v1/nicknames?address=` and `POST /api/v1/nicknames {address, nickname, issuedAt, signature}`. A taken name returns 409; an invalid name, bad signature or expired request returns 422.
  - `GET /api/v1/chain/leaderboard` includes `nickname` for each entry.
- **App.** The nickname is set on the Profile page, and shows on the leaderboard (falling back to the short address) and on public player pages.

## Rationale

A signature is the cheapest proof of wallet ownership that needs no gas and no extra login. Unique lowercase keys stop look-alike names that differ only in letter case.

## Consequences

### Positive

- Players recognise each other, and nobody can set a name for someone else.

### Negative

- **There is no moderation beyond the format rules and the reserved list.** Offensive names have to be removed by hand, by deleting the row in Supabase.
- **The live database needs the migration** before nicknames work.

## Evidence

`backend/test/nicknames.test.ts` (real signatures, forged rename, case-insensitive uniqueness, expiry, HTTP) and `apps/web/tests/unit/nickname.test.ts`, which pin the same signed text on both sides.
