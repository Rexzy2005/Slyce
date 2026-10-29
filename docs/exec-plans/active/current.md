# Active Execution Plan - Backend Review Remediation

## Objective

Implement every applicable finding in `docs/backend-implementation/backend-fix.md` without weakening authentication, gameplay authority, financial precision, or deployment safety. Each slice must include focused regression coverage and be recorded in `docs/backend-implementation/AUDIT-PROGRESS.md`.

## Current status

- Overall: **In progress**
- Current phase: **Phase 14 - dedicated administrator authentication and full verification**
- Completed: baseline audit, safe admin authorization hardening, authoritative gameplay breakdown fix, atomic wallet nonce consumption, scheduling correctness, concurrent progress/reward issuance, leaderboard consistency, financial precision
- Production mutations: none
- Database migrations during this remediation: none

## Phases

1. **Baseline and reconciliation - complete**
   - Reconcile review claims against code, schema, tests, and deployment configuration.
   - Establish typecheck, build, test, architecture, and formatting baselines.
2. **Authentication and authorization - complete for the owner-approved dedicated admin flow**
   - Normalize and validate `SLYCE_ADMIN_EMAILS`.
   - Require a provider-verified email before granting administrator authority.
   - Preserve disabled administrator state across subsequent logins.
   - Replace the superseded Supabase OTP/Reown admin requirement with a backend-only seeded email/password flow, opaque 30-day sessions, live allowlist checks, and CSRF protection.
3. **Gameplay trust boundary - complete**
   - Never persist or consume client breakdown counters as authoritative verified-game data.
   - Evaluate challenges only from deterministic verifier output.
4. **Wallet challenge atomicity - complete**
   - Replace read-then-write nonce consumption with a conditional single-winner claim.
   - Add concurrent consumption regression coverage.
5. **Scheduling correctness - complete**
   - Centralize half-open activity windows and apply them consistently to lists, joins, and evaluation.
6. **Concurrent progress and reward issuance - complete**
   - Make challenge/bounty progress updates and reward creation transactionally idempotent.
   - Prove single completion and single reward under concurrency.
7. **Leaderboard consistency - complete**
   - Preserve stable deterministic ranks and pagination under ties and concurrent submissions.
8. **Financial precision - complete**
   - Remove unsafe `Decimal` to JavaScript `Number` conversions for token-denominated values.
   - Keep wire values exact and document units.
9. **Player status and audit policy**
   - Enforce suspended/deleted status at a central authorization boundary.
   - Audit sensitive administrator operations without leaking secrets.
10. **Administrator workflows and dashboard**
    - Repair metric rendering and replace placeholders with supported operational workflows.
    - Keep unavailable operations explicit rather than simulated.
11. **API and abuse controls**
    - Reconcile contracts, error envelopes, CORS behavior, and rate-limit scopes.
12. **GoodDollar integration**
    - Revalidate official behavior, units, and failure states before changing integration code.
13. **Schema, migrations, and performance**
    - Add only reviewed migrations and indexes required by the completed fixes.
14. **Reown administrator-auth migration and full verification**
    - Complete the owner-approved dedicated admin replacement and verify it end to end.
    - Keep the game’s Reown wallet/email connection flow unchanged.
    - Run all builds, typechecks, unit/integration tests, static checks, and production-safe validation.
    - Update current state, research, ADRs, operations docs, and the audit ledger.

## Quality gates for every phase

- The failing behavior has a regression test.
- The fix uses a server-owned source of truth.
- Concurrency-sensitive behavior is atomic or protected by a database constraint and tested.
- Exact integer/token values do not pass through floating-point conversion.
- Documentation states what was actually verified and what remains pending.
- `git diff --check` passes.

## Stop conditions

- Do not replace Supabase administrator OTP with display-only Reown email/account state.
- Do not run production migrations or mutate production data without explicit authorization.
- Do not weaken administrator access, CORS, or signature validation to resolve deployment symptoms.
- Do not mark the review complete until every finding is implemented, rejected with evidence, or recorded as an external acceptance dependency.

## Exact next action

Run the complete backend/web verification suite, validate the Prisma migration, and record the remaining deployment-only steps (seed, migration, and browser acceptance).
