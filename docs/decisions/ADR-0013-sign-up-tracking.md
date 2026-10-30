# ADR-0013: Sign-up Tracking by Wallet Signature

Status: Accepted
Date: 2026-10-31

## Context

Operators want to count everyone who signs up, including people who never transact, and see growth over time. Reown AppKit handles email, social and wallet sign-in on the client, so our backend never sees a sign-in. ADR-0012 covers only on-chain activity.

## Decision

- After sign-in, the app shows a one-tap "Finish signing up" prompt. The player signs the existing backend wallet challenge (`/api/v1/auth/wallet/challenge` + `/verify`). The signature is free: no fee, no transaction. The backend creates the `Player` and `Wallet` on first verification, and that row is the sign-up.
- Signatures are checked with a Celo public client (`verifyMessage`) when an RPC is configured, so smart-account signatures from embedded email wallets (ERC-1271/6492) work as well as plain wallets. The request schema accepts signatures of 65 bytes or longer.
- `Wallet.signInMethod` (`email` | `social` | `wallet`) is reported by the app from AppKit's `embeddedWalletInfo.authProvider`. It is not verified and is used only for reporting.
- Emails are not stored (product decision 2026-10-31).
- `GET /api/v1/admin/players/growth?days=N` (administrator only) returns totals, 24 h / 7 d / 30 d counts, a by-method split, and a gap-free daily UTC series with a running total.

## Consequences

- One extra tap for new players. Players who skip it, or clear storage on a device that never confirmed, are not counted.
- Sign-ups cannot be faked without the wallet's key.
- Migration `20261031120000_wallet_sign_in_method` adds `Wallet.signInMethod` and a `Player.createdAt` index. Render applies it in `preDeployCommand`.
