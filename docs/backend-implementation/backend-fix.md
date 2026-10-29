# SLYYCE: Complete Codebase Remediation and Admin Authentication Specification

> **Superseded authentication decision (2026-10-29):** The repository owner replaced the Reown administrator-auth migration requirement with the dedicated backend-only administrator email/password design in `do-this-instead.md`. The admin panel now uses the seeded `AdminAccount` password hash and opaque `AdminSession` cookie described there. Reown remains the player-facing wallet/email connection provider; it is not an administrator-auth prerequisite.

## 1. Project Objective

Perform a comprehensive review and remediation of the existing SLYYCE codebase, covering gameplay integrity, backend security, wallet authentication, challenge and bounty management, reward distribution, leaderboards, admin authentication, admin dashboard functionality, database integrity, and production readiness.

The coding agent is embedded directly in the SLYYCE codebase. It must inspect the repository, implement fixes, run the available tests, and verify the results. This is an implementation task, not merely an audit or a request for recommendations.

The objective is to make SLYYCE secure, consistent, reliable, maintainable, and ready for production without unnecessarily rebuilding working features.

## 2. Mandatory Implementation Rules

1. Inspect the repository structure, application architecture, database schema, authentication provider, API routes, environment configuration, and existing tests before editing.
2. Reuse the existing architecture, libraries, conventions, and authentication infrastructure wherever practical.
3. Fix root causes rather than introducing superficial workarounds.
4. Make changes incrementally and test each major area.
5. Preserve existing user accounts, wallet records, challenge progress, rewards, and administrative records.
6. Never reset a database, delete production data, or introduce destructive migrations to simplify implementation.
7. Never weaken authentication, authorization, gameplay verification, replay protection, or reward validation to make tests pass.
8. Do not invent API contracts, environment variables, database fields, or third-party capabilities. Verify them against the codebase.
9. If an issue is already fixed, verify it and avoid unnecessary rewrites.
10. Never claim that a test, build, migration, or integration succeeded unless it was actually executed and its result inspected.
11. Keep changes focused and compatible with the existing application.
12. If credentials, external services, or infrastructure access prevent complete verification, implement what can safely be completed and document the exact blocker.

## 3. Admin Authentication: Reuse the Main Game's Authentication

### 3.1 Objective

Replace the current admin-specific OTP login flow with the existing authentication methods used by the SLYYCE main game, including wallet connection and email authentication where supported by the current provider.

Do not create a separate authentication system unnecessarily. First inspect how the main game authenticates users, verifies identities, manages sessions, and communicates with the backend.

The admin panel must use the existing authentication experience while restricting administrative access to an email allowlist controlled by the backend.

### 3.2 Backend Environment Configuration

Use a single environment variable containing a comma-separated list of authorized administrator emails.

```env
SLYCE_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

The example addresses above are placeholders. Configure the actual approved addresses through the deployment environment.

Requirements:

- Read `SLYCE_ADMIN_EMAILS` exclusively from trusted server-side configuration for authorization.
- Parse the comma-separated value into an array.
- Trim whitespace around each entry.
- Normalize email casing consistently before comparison.
- Ignore empty entries created by redundant commas or surrounding whitespace.
- Reject access if the variable is missing, malformed, or produces an empty allowlist.
- Do not hardcode administrator email addresses in application logic.
- Do not expose the authoritative server configuration through API responses or client bundles.
- Update the example environment file and deployment documentation.

If a public frontend variable is useful for displaying an admin-specific interface, keep it separate from the authoritative server configuration. The frontend allowlist must never determine actual authorization.

### 3.3 Authentication and Authorization Flow

Implement the following sequence:

1. The administrator opens the SLYYCE admin panel.
2. The administrator authenticates through the existing main-game wallet or email authentication flow.
3. The server validates the provider session or token using the provider's trusted verification mechanism.
4. The server obtains the authenticated identity from the verified provider response or trusted server-side session.
5. The server confirms that the email is verified.
6. The server normalizes the verified email and compares it against the parsed `SLYCE_ADMIN_EMAILS` array.
7. If the email matches an authorized entry and the authentication session is valid, grant administrative access.
8. Otherwise, deny access without exposing sensitive information.

A wallet connection alone must not grant administrator privileges. If wallet authentication does not establish a verified email identity, the administrator must complete the existing email authentication flow or another supported identity-verification step before receiving admin access.

Never trust a client-submitted email, wallet address, local-storage flag, or client-side role as proof of administrator identity.

### 3.4 Protect Every Administrative Operation

Apply authorization checks to every protected admin page and backend endpoint, including:

- Player management.
- Challenge and bounty creation and editing.
- Reward management and distribution.
- Dashboard statistics.
- Administrative configuration.
- Any existing moderation, status, or operational controls.

Enforce authorization on the server, not merely in frontend route guards or hidden UI elements.

A normal player must not gain access by editing browser storage, changing request bodies, forging headers, altering a wallet address, or calling an endpoint directly.

If the existing architecture supports a trusted server-side session, use its established mechanism. Keep session cookies HTTP-only and appropriately configured for secure transport and cross-site request protection. Do not introduce a new session implementation without first assessing the existing provider.

### 3.5 Session Revocation and Allowlist Changes

- Enforce the existing session-expiration policy or the documented 30-day maximum, if applicable.
- Ensure expired or revoked sessions cannot access protected endpoints.
- Ensure administrators removed from `SLYCE_ADMIN_EMAILS` lose access according to the defined authorization policy.
- Do not rely on a role or allowlist result cached indefinitely in the browser.
- Recheck administrative authorization server-side for protected requests.
- Keep logout behavior consistent with the main game's authentication flow.
- Do not automatically reactivate suspended or disabled accounts.
- Ensure authentication failures fail closed.

### 3.6 Remove the Old Admin OTP Flow Safely

Remove the old admin-specific OTP flow only after the replacement authentication method works.

Before removing it:

- Identify every route, callback, component, middleware, and environment variable that depends on the old flow.
- Preserve OTP functionality still used by the main game.
- Update login and logout interfaces.
- Remove obsolete admin-specific code only when it is no longer referenced.
- Update tests and documentation.
- Verify that existing users and gameplay sessions are not unintentionally disrupted.

### 3.7 Required Authentication Tests

Test at least:

- The first configured admin email can access the admin panel.
- The second configured admin email can access the admin panel.
- Additional configured emails work without code changes.
- An authenticated user with an unlisted email is denied.
- An unverified email is denied.
- A client-supplied authorized email cannot bypass identity verification.
- A wallet-only session without a verified email is denied admin access.
- Invalid and expired sessions are denied.
- Missing or empty allowlist configuration denies access.
- Whitespace and email casing are normalized consistently.
- Every protected API endpoint rejects unauthorized requests.
- Removing an email from the allowlist prevents subsequent unauthorized access.
- The main game's normal login and gameplay remain functional.

## 4. Gameplay Integrity and Reward Verification

Review the complete gameplay session, submission, scoring, challenge progress, and reward pipeline.

### Required work

- Trace how sessions begin, progress, finish, and submit results.
- Identify client-provided fields used to calculate scores, rankings, challenge progress, eligibility, or rewards.
- Investigate whether `input.breakdown` or equivalent client-provided values can influence authoritative challenge evaluation.
- Ensure scoring and reward eligibility depend on validated server-side data or a trusted verification process.
- Treat submitted scores, counters, timestamps, and breakdowns as untrusted until validated.
- Verify session ownership, completion, sequence, replay data, and applicable timing constraints.
- Reject malformed, incomplete, duplicated, tampered, or replayed submissions.
- Prevent a gameplay session from being reused to claim multiple rewards improperly.
- Preserve intended gameplay rules while closing integrity gaps.

If complete server-side replay verification is not feasible with the existing architecture, implement the strongest compatible validation and document the remaining limitation. Do not describe client-reported results as independently verified.

## 5. Admin Dashboard and Metric Rendering

Inspect the admin dashboard, especially `apps/web/src/app/admin/page.tsx` and related components.

### Required work

- Investigate the reported issue where a `Metric` component or equivalent dashboard element may return an `OperationsPanel` for a particular label.
- Restore the intended metric-card rendering.
- Render operational panels in their correct locations.
- Separate reusable metric components from operational panels.
- Ensure statistics come from appropriate data sources rather than hardcoded values.
- Implement loading, empty, and error states.
- Ensure responsive layout and appropriate authorization.
- Test the dashboard with populated, empty, and unavailable datasets.

Do not hide broken components or hardcode statistics to bypass rendering issues.

## 6. Wallet Authentication and Nonce Replay Protection

Review wallet connection, signature verification, nonce generation, and authentication.

### Required work

- Verify signatures against the intended wallet address and expected message.
- Include the appropriate domain, application context, nonce, and expiration information in signed messages.
- Generate nonces securely and associate them with the correct authentication attempt.
- Enforce expiration and single-use behavior.
- Make nonce consumption atomic to prevent concurrent reuse.
- Prevent replay attacks, cross-user nonce reuse, and address substitution.
- Normalize wallet addresses consistently where appropriate.
- Never trust a wallet address solely because it appears in a request body.
- Return safe, consistent errors for invalid signatures, expired nonces, and reused nonces.

Add tests that attempt concurrent consumption of the same nonce and confirm that only the permitted request succeeds.

## 7. Challenge and Bounty Scheduling

Review scheduling logic across challenges, competitions, and bounties.

### Required work

- Identify every place where start dates, end dates, active status, submission deadlines, and eligibility windows are evaluated.
- Establish consistent rules for upcoming, active, and completed states.
- Use server-side time for authoritative decisions and handle timezones consistently.
- Define and test exact start and end boundaries.
- Ensure UI, APIs, background jobs, leaderboards, and reward eligibility checks use compatible rules.
- Prevent participation and reward claims outside permitted windows.
- Handle invalid, missing, or contradictory schedule values safely.
- Ensure scheduled status updates do not conflict with request-time validation.

## 8. Concurrent Challenge Progress and Duplicate Rewards

Review progress tracking, completion detection, and reward issuance.

### Required work

- Keep progress correct when multiple submissions arrive concurrently.
- Prevent duplicate completion events and repeated reward claims.
- Use transactions, unique constraints, atomic updates, or equivalent database mechanisms.
- Make reward issuance idempotent so retries cannot create duplicate rewards.
- Associate progress with the correct player, challenge, and eligible session.
- Prevent partial failures from leaving progress and rewards inconsistent.
- Handle retries without double-counting.
- Check for duplicate issuance through background jobs, APIs, and manual admin actions.

Add regression tests for concurrent submissions, duplicate requests, and transaction failures.

## 9. Leaderboard and Ranking Accuracy

Review leaderboard queries and ranking calculations, including bounty rankings.

### Required work

- Calculate ranks across the complete eligible dataset rather than only the current page.
- Verify sorting, pagination, ties, and rank calculations.
- Ensure displayed ranks match backend ranking rules.
- Prevent duplicate records from inflating scores or rankings.
- Apply challenge, bounty, time-period, and player-status filters consistently.
- Exclude ineligible records where required.
- Optimize large queries without changing ranking semantics.

Test ties and players whose ranks cross pagination boundaries.

## 10. Reward Precision and Financial Correctness

Review reward calculations, storage, aggregation, display, and distribution.

### Required work

- Determine the exact denomination and precision of every reward asset.
- Avoid JavaScript floating-point arithmetic for values requiring exact token precision.
- Use integer base units, a suitable decimal arithmetic library, or another compatible representation.
- Validate token decimals, conversions, rounding, and amount boundaries.
- Prevent negative, malformed, overflowing, or unexpectedly rounded amounts.
- Keep representations consistent across the database, APIs, admin panel, leaderboards, and wallet-facing interfaces.
- Ensure retries and partial failures cannot produce duplicate payouts.
- Associate blockchain transactions with the correct reward record and transaction status.

Do not change existing token denominations or stored values without a verified migration and compatibility plan.

## 11. Audit Logging and Player Account Status

Review administrative actions and player status enforcement.

### Required work

- Record important administrative actions, including changes to players, challenges, bounties, rewards, and relevant configuration.
- Include the authenticated actor, action, affected resource, timestamp, and appropriate before-and-after information.
- Never log passwords, private keys, authentication secrets, or unnecessary sensitive information.
- Prevent routine administrative workflows from modifying or erasing audit records.
- Enforce suspended, disabled, and deleted player status across gameplay, submissions, leaderboards, wallet-linked actions, and reward claims.
- Prevent stale sessions from bypassing account-status changes.
- Define safe handling of historical rewards and records associated with suspended or deleted users.
- Preserve transaction history and auditability.

## 12. API Validation, Errors, and Rate Limiting

Review API route security and error handling.

### Required work

- Validate request bodies, query parameters, path parameters, and relevant headers.
- Reject malformed input and unexpected fields where appropriate.
- Use consistent HTTP status codes and error formats.
- Avoid exposing stack traces, SQL details, secrets, or internal infrastructure information.
- Distinguish authentication failures, authorization failures, validation errors, conflicts, missing resources, and unexpected failures.
- Apply rate limits to authentication, OTP requests where still used, wallet signature verification, gameplay submissions, and reward claims.
- Ensure rate limiting works across the actual deployment architecture.
- Do not trust spoofable client IP headers.
- Avoid excessively restrictive limits that break legitimate gameplay.
- Ensure failed operations do not leave partially applied database changes.

## 13. Database and Leaderboard Performance

Inspect expensive queries, repeated lookups, and database access patterns.

### Required work

- Identify N+1 queries, unnecessary full-table reads, repeated requests, and inefficient aggregations.
- Review pagination and add indexes only when supported by query patterns and evidence.
- Check indexes and constraints for wallet addresses, nonces, challenge participation, progress, rewards, and frequently queried fields.
- Use database-side filtering and aggregation where appropriate.
- Preserve ranking and ordering semantics.
- Review connection handling and transaction boundaries.
- Keep optimizations compatible with the existing database and deployment environment.

## 14. GoodDollar Integration and Environment Configuration

Review the GoodDollar-related integration and relevant environment variables.

### Required work

- Trace how verification is performed and how it affects gameplay, eligibility, and rewards.
- Verify through the intended trusted integration rather than client-provided verification flags.
- Apply consistent rules wherever the integration is used.
- Handle missing configuration, timeouts, invalid responses, and provider failures safely.
- Do not grant privileged access or rewards merely because a verification service is unavailable.
- Identify required variables and their consumers.
- Keep secrets server-side and out of client bundles and committed files.
- Update example environment files and documentation when configuration changes.
- Never fabricate credentials.

If external credentials prevent full testing, complete local validation and document the exact remaining verification requirement.

## 15. API Route Inventory and Contract Consistency

Compare actual API routes against the documented route inventory.

### Required work

- Discover routes implemented in the repository.
- Identify missing, obsolete, duplicated, or incorrectly documented routes.
- Verify HTTP methods, authentication, authorization, validation, responses, and error behavior.
- Ensure administrative mutations enforce server-side authorization, including the new email allowlist.
- Update route documentation and tests when behavior changes.
- Do not add endpoints solely to make documentation appear complete.

## 16. Admin Panel Feature Completion

Inspect existing administrative workflows for players, challenges, bounties, rewards, and other implemented features.

### Required work

- Ensure player search, filtering, pagination, account status, and permitted management actions work correctly.
- Ensure challenge and bounty creation, editing, scheduling, activation, and deactivation validate and persist correctly.
- Ensure reward workflows use trusted server-side data.
- Require confirmation for sensitive or irreversible actions.
- Provide accurate success and failure feedback.
- Record relevant mutations in the audit trail.
- Implement loading, empty, validation, and network-error states.
- Display controls appropriate to the authenticated administrator's permissions.
- Ensure the panel displays real data rather than placeholders.

## 17. Database Migrations and Data Safety

Treat schema changes as production-sensitive operations.

### Required work

- Inspect existing migrations and the current schema before modifying them.
- Create forward migrations for required changes.
- Preserve existing records and relationships.
- Account for existing data before introducing new constraints.
- Avoid destructive resets, table drops, and irreversible transformations.
- Validate migration behavior against an appropriate development or test database.
- Document deployment order and compatibility requirements.
- Do not execute production migrations unless the environment and authorization explicitly permit it.
- If existing data conflicts with a proposed constraint, document and safely resolve the conflict rather than deleting records.

## 18. Automated Testing Requirements

Inspect the existing test framework and add or update tests that fit the current architecture.

At minimum, cover:

- Gameplay submission validation and trusted score calculation.
- Tampered and replayed gameplay submissions.
- Admin authentication through the existing provider.
- Both configured admin emails and additional allowlist entries.
- Unauthorized and unverified email rejection.
- Missing and empty allowlist configuration.
- Expired sessions and invalid tokens.
- Direct requests to protected admin APIs.
- Wallet signature validation and atomic nonce consumption.
- Challenge and bounty schedule boundaries.
- Concurrent progress updates and duplicate reward prevention.
- Leaderboard rankings, ties, filters, and pagination.
- Reward precision and rounding.
- Suspended or disabled player enforcement.
- API validation, authorization, rate limiting, and error handling.
- GoodDollar verification failures.
- Admin workflows and audit logging.
- Migration safety and data integrity.

Use existing project tools and conventions. Introduce new testing infrastructure only when justified.

## 19. Execution Order

Implement the work in this order, adjusting only when repository dependencies require it:

1. Inspect the repository, architecture, scripts, schema, authentication provider, and existing tests.
2. Implement the new admin authentication flow using the existing game authentication provider and `SLYCE_ADMIN_EMAILS`.
3. Add server-side authorization to every protected admin route and remove the old admin-specific OTP flow safely.
4. Fix gameplay verification and reward integrity.
5. Fix wallet nonce replay protection.
6. Standardize challenge and bounty scheduling.
7. Fix concurrent progress and duplicate reward issuance.
8. Correct leaderboard ranking across pagination.
9. Fix reward precision and denomination handling.
10. Implement audit logging and player-status enforcement.
11. Fix the dashboard metric-rendering issue.
12. Improve API validation, errors, and rate limiting.
13. Address database and leaderboard performance issues.
14. Verify GoodDollar integration and environment configuration.
15. Reconcile API route documentation and contracts.
16. Complete and test existing admin workflows.
17. Implement and validate safe migrations.
18. Run regression tests, type checks, linting, production builds, and other relevant project checks.

Keep each change focused, reviewable, and compatible with existing functionality.

## 20. Definition of Done

The remediation is complete only when:

- All identified issues are fixed or their blockers are explicitly documented.
- Admin authentication reuses the main game's existing authentication provider.
- Administrative access is restricted by the server-side `SLYCE_ADMIN_EMAILS` allowlist.
- The allowlist supports any reasonable number of email addresses without application-code changes.
- Unverified identities, unauthorized users, and invalid sessions cannot access protected admin functionality.
- Every protected backend endpoint enforces authorization.
- Wallet-only authentication does not independently grant admin privileges.
- The main game's existing authentication and gameplay continue to work.
- Gameplay results and rewards cannot be trusted solely because the client reports them.
- Wallet nonces cannot be successfully reused.
- Scheduling, progress tracking, and reward issuance behave consistently under retries and concurrency.
- Leaderboard positions and reward amounts are calculated correctly.
- Player status is enforced across relevant endpoints.
- The admin dashboard and management workflows operate against real data.
- API validation, error handling, and rate limiting are implemented appropriately.
- Database changes preserve existing data and have a safe migration path.
- Relevant tests, type checks, linting, and builds have been executed where supported.
- Failed checks, external integration requirements, and remaining security risks are documented.
- No successful test, deployment, or migration is claimed without evidence.

## 21. Required Final Implementation Report

After completing the work, provide a report containing:

### A. Summary
Explain what was fixed and the resulting state of the application.

### B. Changes Made
Group changes by admin authentication, gameplay integrity, wallet security, challenges and bounties, rewards, leaderboards, admin panel, API security, and infrastructure.

### C. Files Changed
List the important changed files and explain the purpose of each.

### D. Environment and Deployment
Document the required server-side variable:

`SLYCE_ADMIN_EMAILS=admin1@example.com,admin2@example.com`

Explain how to configure the actual approved addresses in each deployment environment. Do not expose secret values.

### E. Database and Configuration
Identify migrations, configuration changes, compatibility considerations, and deployment steps.

### F. Verification Results
List the exact commands executed and their actual outcomes, including tests, type checks, linting, and builds. Clearly distinguish passing checks, failures, and checks that could not be run.

### G. Remaining Issues
Document unresolved defects, external dependencies, missing credentials, unverified integrations, and remaining security risks. Explain the impact and next action required.

### H. Readiness Assessment
State whether the application is ready for further testing, staging, or production deployment, including any conditions that must be satisfied first.

## Final Instruction

Start by examining the existing SLYYCE codebase and implement the remediation directly. Do not stop after producing an audit, checklist, or recommendations. Do not ask me to supply files already accessible in the environment.

Preserve working functionality, avoid unnecessary rewrites, and verify every change using the tools and tests available in the repository.

If an issue cannot be resolved safely with the available code, configuration, or credentials, explain the precise blocker and leave the system in a safe state rather than fabricating a solution or claiming completion.
