# ADR-0006: Backend authentication boundary

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The existing web application exposes wallet connection state through Reown AppKit/Wagmi. The backend requires authenticated player and administrator principals. Supabase Auth is now configured for bearer-token verification, with an explicit administrator email allowlist in backend environment configuration.

The repository's verified integration research also records that MiniPay prohibits message signing merely for site access/authentication. Therefore, treating a connected wallet address as a backend session or unconditionally introducing SIWE would be unsafe and would conflict with the current integration evidence.

## Decision

P3 introduces a server-side authentication boundary, not a new credential protocol:

- Backend code represents an authenticated principal explicitly as a player or administrator.
- Protected code must obtain a principal from a token verifier and enforce ownership or administrator role checks on the server.
- A wallet address supplied in a request is never accepted as proof of identity.
- Administrator privileges are never derived from wallet connection or public client state.
- Supabase Auth verifies bearer tokens and the backend maps allowlisted email identities to administrator principals.
- The existing Reown/AppKit player UX remains unchanged. A wallet address alone is not a backend credential; player token/session mapping and database player association remain required before player mutations are enabled.
- Standard Celo web gameplay uses a separate origin-bound wallet challenge session with a five-minute nonce, one-time consumption, signature verification, persisted wallet association, and short-lived HMAC token. It is not used for administrator privileges and is not enabled for MiniPay.

The backend security foundation therefore provides authorization policies, CORS, request limits, rate limiting, and safe error handling without exposing protected mutations before authentication is configured.

## Consequences

- Administrator authentication has a real verifier boundary and allowlist enforcement.
- Feature endpoints remain blocked until their route handlers and player record mapping are implemented.
- Any future verifier must map external subjects to internal `Player` or `AdminAccount` records and enforce expiry/revocation before returning a principal.

## Evidence

- `docs/research/dependency-baseline.md` records the MiniPay authentication conflict and explicitly leaves the session protocol unresolved.
- `docs/backend-implementation/MASTER-PLAN.md` section 11 requires backend token verification, ownership checks, role enforcement, and no privilege from wallet connection alone.
- `backend/src/supabase-auth.ts` implements Supabase Auth token verification and administrator email mapping.
