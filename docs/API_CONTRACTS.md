# Slyyce API contracts

Status: Backend contracts implemented through P10; practice mode remains local and unverified.

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
- `GET /api/v1/rewards?status=<status>` — authenticated player reward history, including approval and separately recorded distribution state.
- `GET /api/v1/admin/rewards?status=<status>` — administrator reward queue with cursor pagination.
- `POST /api/v1/admin/rewards/:rewardId/review` — reviewer approval or rejection. Rejections require a reason and repeated review is rejected.
- `POST /api/v1/admin/rewards/:rewardId/distributions` — administrator-only manual distribution record. Confirmation requires a transaction reference or evidence and never initiates an automatic payout.
- `GET /api/v1/admin/metrics` — administrator-only persisted operational summary. Player counts use `Player` rows, verified GoodDollar users are distinct non-null root identities for the configured environment, active sessions are unexpired `CREATED` or `STARTED` sessions, and reward states are reported separately.
- `GET /api/v1/admin/audit-logs?action=<action>&entityType=<type>&search=<text>` — administrator-only cursor-paginated audit history. Search covers entity identifiers and recorded reasons; response actors expose display name/email but no authentication subject or sensitive before/after payload.
- `GET /readyz` — returns ready only after a successful database query; failures return `503` without database credentials or internal error details.

Wallet association mutations remain unavailable until wallet ownership authentication is approved. GoodDollar observation refreshes use the official on-chain Identity contract and never store facial or biometric data. Unknown and not-yet-enabled routes remain unavailable rather than returning fabricated data.

## Wire conventions

- Errors use `{ error: { code, message, requestId?, fields? } }`.
- Schema-validation failures return HTTP 400 with `validation_error` and field-scoped messages; malformed client input is not reported as an internal server failure.
- Listing endpoints use `cursor` and `limit`; the default limit is 25 and the maximum is 100.
- Sensitive mutations require an `Idempotency-Key` header containing 16–255 non-whitespace characters.
- Request bodies, query parameters, and route parameters are validated server-side.
- Prisma remains server-only; the Next.js app communicates through the backend API.
- Gameplay score submissions require `Idempotency-Key` and include `inputDigest`, claimed `score`, and the ordered `replayInputs` array. The claimed score is never trusted without deterministic replay verification.

## Authentication boundary

Player and administrator routes require a verified backend principal. A wallet address or frontend connection state is never accepted as authentication. The player-record routes use the verified Supabase principal and persist only the approved internal record mapping.
Standard Celo web gameplay uses the separate wallet challenge session for players. Challenges are nonce-based, five-minute, single-use, origin-bound, and replay-protected. This does not grant administrator privileges and does not apply to MiniPay.

GoodDollar uses the configured Celo RPC and environment Identity contract. The standard web client refreshes this endpoint after the official SDK status check; MiniPay is out of scope.
