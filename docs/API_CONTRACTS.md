# Slyce API contracts

Status: P7 gameplay and leaderboard contracts; practice mode remains local and unverified.

The backend uses `/api/v1` and defines shared validation/error/pagination infrastructure in `backend/src/api/`.

The user authorized minimum explicit frontend contracts during foundation implementation (2026-10-07). Canonical TypeScript/Zod definitions are in [contracts.ts](../apps/web/src/api/contracts.ts). These describe views needed by the UI, not existing endpoints, database schemas or deployed services.

- Session: anonymous or authenticated player ID/address. Wallet connection alone never produces an authenticated session.
- Round: round ID, opaque seed and rules-version identifier. Finish submits the round and ordered replay inputs, never a claimed final score as proof. Verification returns verified score or rejection.
- Leaderboard: scope today/week/all; player ID, display name, integer score and positive rank.
- Inventory: opaque item ID, name and non-negative integer quantity; item use requires a round and inventory item ID.
- Rewards/shop: opaque IDs, display labels, integer token amounts encoded as strings; token decimals come from the configured contract, not a floating-point assumption.
- Shared replay inputs: integer elapsed milliseconds, normalized pointer coordinates and phases, or inventory-item activation. Unapproved modes must not use these as authoritative scoring inputs.

The approved first verified mode is `verified-fruit-slice` with rules version `verified-fruit-slice-v1`. It uses a 30-second seeded target schedule, normalized segment collision, three lives, 10 points per fruit, a 5-points-per-fruit bonus for swipes cutting at least three fruit, and deterministic bombs using the normal 14% probability. Practice mode remains separate and unverified.

The backend route inventory is in `backend/src/api/route-plan.ts`. It records public, player, and administrator access requirements. Implemented player-record routes are:

- `GET /api/v1/session` — verified Supabase principal and persisted principal mapping.
- `GET /api/v1/players/me` — authenticated player profile, wallet associations, and persisted GoodDollar status.
- `GET /api/v1/admin/players` — administrator-only cursor-paginated player records.
- `POST /api/v1/gooddollar/verification/check` — performs an independent Celo Identity read for a wallet and persists minimal wallet/environment/root/timestamp observation data. The browser callback is not trusted as proof.
- `GET /api/v1/admin/gooddollar/verification-count` — administrator-only count of unique currently verified GoodDollar root identities observed for the configured environment.
- `POST /api/v1/auth/wallet/challenge` — creates a five-minute, single-use Celo wallet challenge bound to the request `Origin`.
- `POST /api/v1/auth/wallet/verify` — verifies the signed challenge, creates or resolves the player wallet association, and returns a short-lived signed backend session token.
- `POST /api/v1/gameplay/rounds` — authenticated player route for creating an approved `verified-fruit-slice-v1` session.
- `POST /api/v1/gameplay/rounds/:roundId/finish` — authenticated, idempotent score submission with replay inputs. The backend verifies the replay before returning `VERIFIED`; invalid or tampered submissions are rejected.
- `GET /api/v1/leaderboards?scope=today|week|all&gameMode=<mode>&limit=<n>&cursor=<offset>` — public verified-score leaderboard. Results include deterministic rank, score, player ID, display name, and an opaque pagination cursor. Pending, rejected, and invalidated scores are excluded.

Wallet association mutations remain unavailable until wallet ownership authentication is approved. GoodDollar observation refreshes use the official on-chain Identity contract and never store facial or biometric data. Unknown and not-yet-enabled routes remain unavailable rather than returning fabricated data.

## Wire conventions

- Errors use `{ error: { code, message, requestId?, fields? } }`.
- Listing endpoints use `cursor` and `limit`; the default limit is 25 and the maximum is 100.
- Sensitive mutations require an `Idempotency-Key` header containing 16–255 non-whitespace characters.
- Request bodies, query parameters, and route parameters are validated server-side.
- Prisma remains server-only; the Next.js app communicates through the backend API.
- Gameplay score submissions require `Idempotency-Key` and include `inputDigest`, claimed `score`, and the ordered `replayInputs` array. The claimed score is never trusted without deterministic replay verification.

## Authentication boundary

Player and administrator routes require a verified backend principal. A wallet address or frontend connection state is never accepted as authentication. The player-record routes use the verified Supabase principal and persist only the approved internal record mapping.
Standard Celo web gameplay uses the separate wallet challenge session for players. Challenges are nonce-based, five-minute, single-use, origin-bound, and replay-protected. This does not grant administrator privileges and does not apply to MiniPay.

GoodDollar uses the configured Celo RPC and environment Identity contract. The standard web client refreshes this endpoint after the official SDK status check; MiniPay is out of scope.
