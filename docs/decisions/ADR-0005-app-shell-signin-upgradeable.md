# ADR-0005: Upgradeable Contracts, Email/Wallet Sign-in, Paid Rounds, App Shell, Slyce Name

Status: Accepted
Date: 2026-10-15

## Context

The user asked for upgradeable, stricter and better-tested contracts. They also asked for sign-in with email or wallet, a fee to start each round, an app-style UI instead of a landing page, and the name Slyce everywhere.

## Decision

1. **UUPS proxies.** `SlyceShop`, `SlyceTournament` and the new `SlyceArcade` inherit `SlyceBase` (OpenZeppelin 5.6.1 upgradeable). The base provides `UUPSUpgradeable`, `Ownable2StepUpgradeable` (renounce disabled), `PausableUpgradeable` and `ReentrancyGuardTransient`. State lives in ERC-7201 namespaces (`slyce.storage.*`). Implementations call `_disableInitializers()`. Only the owner can upgrade. Use a multisig owner in production.
2. **Stricter rules.**
   - All token moves are checked by balance delta, which rejects fee-on-transfer tokens.
   - Bounds on prices, quantities, fees, durations, sponsorships and scores, plus an optional entrant cap.
   - Tournament cancellation with full refunds.
   - Contract-wide `liabilities` accounting. `rescue` can never take player funds.
   - Claims and refunds still work while paused.
3. **Paid rounds.** `SlyceArcade.play(maxFee)` charges `playFee` (default 1 G$, owner-set, max 100 G$, may be 0) to the treasury. The arena starts a round only after that transaction confirms. Approval covers 10 rounds.
4. **Sign-in.** Reown AppKit 1.8.24 replaces RainbowKit and offers email (embedded wallet) and external wallets. Every app route is behind `SignInGate`. With no backend, sign-in means a connected account on Celo; there is no server session.
5. **App shell.** `/` redirects to `/play`, and the PWA `start_url` is `/play`. The landing page, sidebar and drawer are gone; the app uses a top bar (G$ balance, account) and a bottom tab bar.
6. **Name (superseded by ADR-0011).** The workspace and packages were named `slyce`, `@slyce/web` and `@slyce/shared`. The local folder name `GoodSlice` was unchanged.

## Consequences

- Upgradeability means players trust the owner key. Fixes no longer need new addresses.
- Each round costs one wallet confirmation plus gas. Email users get gas through GoodDollar after verifying.
- Signed-in E2E flows need a real wallet and are verified manually.

## Evidence

- `contracts/test/` (unit, fuzz, invariant, upgrade, Celo fork), `@openzeppelin/upgrades-core` 1.46.0 validation, `docs/research/reown-appkit.md`

## Supersedes

ADR-0004 items 1 (RainbowKit) and 2 (non-upgradeable contracts).
