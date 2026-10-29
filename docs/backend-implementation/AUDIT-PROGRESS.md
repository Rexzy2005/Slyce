# Slyyce Remediation Audit Progress

This file is the chronological evidence log for implementing `backend-fix.md`. The active strategy and acceptance criteria live in `docs/exec-plans/active/current.md`.

## Status summary

- Overall status: **In progress**
- Current phase: **Administrator login repair and branded access UI**
- Production mutations performed: **Administrator seed account created; repeat seed was idempotent**
- Database migrations performed during remediation: **Admin password/session migration applied successfully after resolving pre-existing schema drift**
- Last updated: **2026-10-29**

## Progress ledger

| Date | Area | Status | Evidence / outcome | Next action |
| --- | --- | --- | --- | --- |
| 2026-10-29 | Review intake and execution plan | Complete | Read `backend-fix.md`, repository instructions, architecture, current state, active plan, auth ADR/research, schema, route inventory, auth boundaries, dashboard, and package scripts. Replaced the completed historical active plan with the remediation plan. | Establish the unmodified quality baseline and complete the authentication provider decision. |
| 2026-10-29 | Confirmed defect reconciliation | Complete | Confirmed separate admin Supabase OTP, `ADMIN_EMAILS` name mismatch, absent explicit verified-email check, broken dashboard `Metric`, client breakdown entering challenge evaluation, non-conditional nonce consumption, inconsistent schedule checks, unsafe Decimal-to-Number reward conversions, incomplete player-status enforcement, and placeholder admin workflows. | Convert findings into focused implementation slices with regression tests. |
| 2026-10-29 | Reown AppKit 1.8.24 inspection | Complete | Inspected the installed AppKit configuration, hooks, controllers, and authentication-related types. The game enables AppKit email/external-wallet connection but no SIWX authentication. `useAppKitAccount` exposes display/account state, not a credential the Slyyce backend currently verifies. The inspection does not justify replacing Supabase administrator OTP. | Provider migration is deferred separately until an official backend-verifiable Reown identity flow is selected and acceptance-tested. |
| 2026-10-29 | Reown administrator-auth migration | Superseded by owner | `do-this-instead.md` explicitly replaces the Reown administrator-auth requirement. Reown AppKit remains unchanged for player wallet/email connection and is not used as the admin credential. |
| 2026-10-29 | Owner-authored replacement decision | Complete | `do-this-instead.md` supersedes the Reown administrator migration. Reown remains unchanged for the game; administrator access is now a dedicated backend-owned seeded email/password system. |
| 2026-10-29 | Dedicated administrator authentication | Implemented | Added `AdminSession`, salted scrypt password hashes, idempotent `admin:seed`, 30-day HttpOnly cookie sessions, rotation/revocation, live allowlist/role/active checks, login rate limiting, generic failures, and cookie CSRF enforcement. Removed the admin-only Supabase OTP UI/dependencies and preserved Reown player configuration. | Run full tests and apply the reviewed migration in the authorized database. |
| 2026-10-29 | Administrator seed attempt | Blocked by local connection trust | The seed command was run with the configured backend environment and reached the database, but Node rejected the database TLS chain as self-signed before any account read/write. No password or account data was logged and no seed mutation occurred. | Run the same seed command from the authorized Render backend shell/connection where the production certificate chain is trusted; do not disable TLS verification. |
| 2026-10-29 | PostgreSQL TLS certificate-chain remediation | Complete for the existing database client | Root cause was a malformed local `SUPABASE_CA_CERT` placeholder while the Supabase pooler presented a chain signed by Supabase's private CA. `pg` now receives the verified CA PEM with `rejectUnauthorized: true`; URL `sslmode`/`sslrootcert` parameters are removed when the programmatic TLS object is used, and Prisma CLI writes the CA to a mode-600 temporary file for `verify-full` migrations. The seed created the administrator account on the first successful run and returned `already_exists` on the repeat run. |
| 2026-10-29 | Administrator login migration repair | Complete | The reviewed migration initially detected an already-existing `AdminAccount.passwordHash` column and failed before creating `AdminSession`. The migration was made idempotent, the failed record was marked rolled back, and `db:migrate:deploy` completed successfully. `db:migrate:status` now reports the database schema is up to date. |
| 2026-10-29 | Branded administrator access UI | Complete | Rebuilt the admin gate as a responsive Slyyce operator screen with brand lockup, control-room messaging, secure password affordances, accessible loading/error states, mobile layout, and no hardcoded administrator email. |
| 2026-10-29 | Baseline quality checks | Complete | Architecture/static checks, core checks, whitespace checks, backend build, and backend/web/shared/worker typechecks passed. A root-scoped Vitest invocation incorrectly discovered backend and Playwright files and is not counted as a web result. Workspace dependencies were restored from the existing frozen lockfile without changing the dependency specification. | Run the web suite from its package scope during final verification. |
| 2026-10-29 | Administrator authorization hardening | Complete | Added strict, normalized `SLYCE_ADMIN_EMAILS` parsing; production rejects missing, empty, and malformed allowlists. Dedicated admin sessions recheck allowlist membership, active status, and `ADMIN`/`SUPER_ADMIN` role on every request. | Apply the reviewed migration and run the seed process in the authorized deployment. |
| 2026-10-29 | Verified gameplay trust boundary | Complete | Removed client breakdown persistence from verified submissions and changed challenge evaluation to consume only `ScoreVerificationService` output. Regression coverage submits forged counters and proves the deterministic verifier's zero counters are used. Backend build, 22 server tests, and `git diff --check` pass. | Make wallet nonce consumption atomic and prove only one concurrent consumer succeeds. |
| 2026-10-29 | Wallet challenge atomicity | Complete | Replaced read-then-update consumption with `updateMany` conditioned on nonce, `consumedAt: null`, and `expiresAt > now`. Only the transaction that updates exactly one row can load and return the challenge. Concurrent regression coverage proves one success and one rejection. Backend build and all 23 server tests pass. | Standardize schedule boundaries for challenges and bounties. |
| 2026-10-29 | Challenge and bounty scheduling | Complete | Added one half-open activity-window rule: `startsAt <= now < endsAt`. Published discovery excludes rows exactly at `endsAt`; challenge and bounty joins enforce the same rule; challenge gameplay evaluation skips future/expired activities. Exact start/end boundary coverage was added. Backend build and all 24 server tests pass. | Make progress and reward transitions atomic under concurrency. |
| 2026-10-29 | Concurrent progress and reward issuance | Complete | Challenge evaluation now reloads state, computes progress, transitions completion, and creates its reward inside a serializable transaction with bounded `P2034` retry. Bounty review now conditionally claims only `PENDING` submissions before updating participation or creating a reward. Concurrent approval coverage proves one successful review and one reward. Backend build and the complete 47-test backend suite pass. | Verify leaderboard rank and pagination consistency under ties and concurrent data changes. |
| 2026-10-29 | Leaderboard consistency | Complete | Bounty leaderboards now include only approved, completed participations. Page ranks use the count of every eligible row preceding the cursor instead of restarting at one. Ordering remains completion time, join time, then ID. Regression coverage proves ranks continue across a page boundary and ineligible rows are excluded. Backend build and 33 focused bounty/server tests pass. | Replace unsafe token amount conversions with exact representations. |
| 2026-10-29 | Reward precision | Complete | Challenge and bounty reward amounts now enter and leave the API as positive base-10 integer strings with a 78-digit bound matching `Decimal(78,0)`. Prisma decimals are serialized with `toString()` instead of `Number()`/`toNumber()`. Existing stored denomination is unchanged. Regression coverage preserves a 78-digit value and rejects numeric/oversized payloads. Backend build, the complete 48-test suite, and the focused 25-test server suite pass. | Enforce player account status centrally and review audit coverage. |
| 2026-10-29 | Player session status enforcement | Complete | Wallet bearer verification now reloads an active wallet and its current player status on every request. Tokens issued before a player becomes `SUSPENDED` or `DELETED` are rejected immediately. Focused regression coverage exercises both transitions; backend build and all 26 focused server tests pass. | Complete mutation audit coverage alongside the remaining administrator workflows. |
| 2026-10-29 | Administrator metric rendering | Complete | Replaced the broken `Metric` implementation that returned the entire `OperationsPanel` for one label and `null` for every other label. Each metric now renders its own accessible card. Web/worker typecheck, `git diff --check`, and the focused Vitest regression pass. | Replace remaining dashboard placeholders with protected operational workflows and authoritative data. |
| 2026-10-29 | Render rate-limit deployment review | In progress | Render's current guidance says public services receive the real client IP through `X-Forwarded-For`, and its platform statement specifies the first value as the real client IP. The current parser already uses that first value. The limiter remains process-local, counts health checks, and has no endpoint-specific authentication/gameplay buckets, so the complete abuse-control requirement is not yet satisfied. | Exclude health probes, add sensitive-operation buckets without breaking gameplay, and document the single-instance/distributed-store deployment boundary. |

## Baseline architecture findings

### Authentication

- Player UI: Reown AppKit/Wagmi connection with email-created embedded wallets or external wallets.
- Verified gameplay: Slyyce wallet challenge, signed message, persisted nonce, and HMAC player token.
- Administrator UI: backend email/password form with an accessible show/hide control.
- Administrator backend: seeded scrypt password hash, opaque 30-day HttpOnly session cookie, CSRF/origin checks for cookie mutations, and normalized `SLYCE_ADMIN_EMAILS` membership.
- Integration gap: wallet connection alone supplies no trusted email proof and must never confer administrator access.

### Gameplay and rewards

- Deterministic replay verification exists and derives an authoritative score/breakdown.
- The finish route now passes only the verifier-derived breakdown into challenge evaluation; forged client counters have regression coverage.
- Unique reward links already exist for challenge and bounty participation, but concurrent completion/issuance behavior requires transactional regression tests and likely atomic claims.

### Wallet authentication

- Challenges include address, chain, origin, random nonce, issued/expiry information, and a signed message.
- `consume` now uses a conditional single-winner update, with concurrent regression coverage proving one nonce cannot be consumed twice.

### Dashboard

- `Metric` now renders every supplied metric card; remaining placeholder management workflows still require implementation.
- Real metrics/audit endpoints exist, while the page still contains hardcoded date/season/system text, placeholders, and disabled management navigation.

### Data and precision

- Prisma stores reward/rule amounts as `Decimal(78,0)`.
- Challenge/bounty service views convert those values through JavaScript `Number`, which cannot represent the complete supported range exactly.
- Player status values exist (`ACTIVE`, `SUSPENDED`, `DELETED`) but are not centrally enforced across player operations.

## Authentication decision gate

The admin replacement will not trust `useAppKitAccount().email`, browser storage, wallet address, or a client-submitted identity field. The acceptable replacement must provide a token or signed session that the backend can validate independently and from which it can obtain a verified email.

Required replacement path, pending provider verification:

1. Configure Reown Authentication/SIWX in the existing AppKit instance.
2. Reuse AppKit’s email/wallet sign-in UX for both players and administrators.
3. Verify the Reown session through its supported trusted backend mechanism.
4. Require a verified email for admin evaluation; wallet-only sessions remain player-only.
5. Apply `SLYCE_ADMIN_EMAILS` and active-admin checks on every protected request.

If official/current Reown behavior cannot establish verified email server-side for this package/project configuration, the current admin OTP flow remains in place until a safe provider bridge is approved. It will not be removed merely to satisfy UI consistency.

## Verification evidence

Verified on 2026-10-29:

- backend TypeScript build: pass;
- complete compiled backend suite: 52 passed, 0 failed;
- backend, web, worker, and shared typechecks: pass;
- architecture/static, core, whitespace, and diff checks: pass;
- focused forged-breakdown regression: included in the passing server suite.

Still pending for the final quality gate: correctly scoped full web Vitest, production web build, Prisma validation/generation after schema work, and any browser/provider acceptance that requires live credentials.

## Open blockers and dependencies

1. The required Reown administrator-auth migration needs a supported server-verification contract plus configured-project browser acceptance. This blocks completion of `backend-fix.md`, although the current Supabase-protected administrator flow remains secure while replacement work is pending.
2. Real Reown email/wallet acceptance requires configured Reown project access and browser interaction.
3. Render must redeploy the repaired migration and frontend bundle before the live URL reflects these fixes; the authorized database now reports no pending migrations.
4. GoodDollar denomination and provider failure behavior require official-source revalidation before precision/integration changes.

## Exact next action

Complete administrator mutation workflows and audit coverage, then finish deployment-aware rate limiting for authentication, gameplay submission, and reward mutation endpoints.
