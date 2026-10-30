# ADR-0012: Admin Users and Transactions from On-chain Activity

Status: Accepted
Date: 2026-10-30

## Context

Operators need to see every player and every transaction in `/admin`. Player activity happens on the Celo contracts (ADR-0010): saved games, milestone rewards, shop purchases, tournament entries, sponsorships, scores, prize claims and refunds. Email and wallet sign-in run through Reown AppKit, so a sign-in without any transaction never reaches the backend or the chain.

The forno RPC rejects `eth_getLogs` ranges over 5,000 blocks (verified 2026-10-30). Its logs include `blockTimestamp`, which viem 2.57.3 formats.

## Decision

- The backend indexes logs of the Arcade, Tournament and Shop proxies from `SLYYCE_CONTRACTS_START_BLOCK` in 5,000-block chunks. It keeps the index in memory: the chain is the source of truth, and the index is rebuilt after each restart.
- `GET /api/v1/admin/chain/users` and `GET /api/v1/admin/chain/transactions` are administrator-only. They sync on request (throttled to once every 15 s, at most 200 chunks per request) and return cursor-paginated rows plus a summary.
- "Users" means wallets that sent at least one indexed transaction. Admin configuration events are not listed.
- Config: `SLYYCE_ARCADE_ADDRESS`, `SLYYCE_TOURNAMENT_ADDRESS`, `SLYYCE_SHOP_ADDRESS`, `SLYYCE_CONTRACTS_START_BLOCK`, and `CHAIN_RPC_URL` (falls back to `GOODDOLLAR_RPC_URL`). Without addresses, the endpoints return 503 and the admin page says so.

## Consequences

- No database migration, and no new dependency (viem was already a backend dependency).
- A cold start rescans from the start block. That is about 22 requests (~5 s) at launch and grows by about 17 requests per day. Persisting the index in Postgres is the follow-up once the rescan becomes slow.
- Sign-ins that never transact are visible only in the Reown dashboard.
