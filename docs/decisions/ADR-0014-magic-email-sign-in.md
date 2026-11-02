# ADR-0014: Magic Email Sign-in, Verified-only Play, Plain-language UI

Status: Accepted (supersedes the Reown AppKit sign-in in ADR-0005)
Date: 2026-11-02

## Context

The product owner asked for three things:
- Replace Reown with Magic.
- Remove blockchain terms from the player app.
- Let only verified people play.

Reown showed wallet choices and crypto UI. The owner also chose email-only sign-in and an app-level gate instead of a contract change (2026-11-02).

## Decision

- **Sign-in:** Magic email one-time code (`magic.auth.loginWithEmailOTP`, Magic's own code dialog), `magic-sdk` pinned at 33.13.0.
  - Magic is created in the browser only, after hydration.
  - It connects to wagmi 2.19.5 through a custom `createConnector` (`apps/web/src/web3/magic.ts`), so contract reads and writes are unchanged.
  - The "already signed in" check times out after 8 s and then counts as signed out.
  - External wallets are no longer offered.
- **Verified-only play:** `VerifiedGate` lets a signed-in player into play routes only when the Arcade's GoodDollar Identity reports them verified. `/get-gd` and `/profile` stay open so they can verify or sign out. The contracts are unchanged, so an unverified wallet can still call `submitGame` directly; it earns XP only, never G$.
- **Plain language:** player-facing text avoids chain, wallet, gas, transaction and contract terms. "Network fees" become an account "top-up". The admin console keeps technical terms.
- **Sign-up tracking (ADR-0013):** unchanged. The method is always `email`. Magic wallets may be smart accounts; the backend already verifies those signatures.

**Update 2026-11-02:** the product owner asked for wallet sign-in back as a secondary option. Below the email form, "I already have a wallet" connects a browser or in-app wallet (wagmi `injected`, for example MetaMask, MiniPay or Valora's browser). If there isn't one, it uses WalletConnect, which is enabled only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set. Wallets on another network are asked to switch. Sign-ups record `signInMethod` as `email` or `wallet` from the connector.

## Consequences

- Config: `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` (validated as `pk_live_`/`pk_test_`) replaces `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. Allowed origins are set in the Magic dashboard.
- The Reown packages were removed. The production precache dropped from about 12.5 MB to 6.3 MB.
- Existing Reown sign-ins map to different addresses. Those players must sign in again, and verify again with GoodDollar for the new address.
- Magic bills per monthly active wallet; the free tier is limited (see docs/research/magic.md).
