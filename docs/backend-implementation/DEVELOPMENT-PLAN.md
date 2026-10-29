 # SLYYCE
# DEVELOPMENT PLAN: BACKEND & ADMIN DASHBOARD

**Document:** `DEVELOPMENT-PLAN.md`  
**Project:** SLYYCE
**Status:** Implementation Roadmap  
**Authority:** Governed by `MASTER-PLAN.md`  
**Progress Tracking:** Governed by `PROGRESS-TRACKER.md`  
**Backend Deployment:** Render  
**Database:** Supabase PostgreSQL  
**ORM:** Prisma  
**Frontend:** Existing Next.js application  
**Backend Location:** `/backend`

---

# 1. PURPOSE

This document defines the implementation sequence for the SLYYCE backend, database, administrative dashboard, game integration, leaderboard system, challenge engine, bounty management, reward workflows, and GoodDollar verification integration.

It converts the requirements in `MASTER-PLAN.md` into actionable engineering phases.

Each phase must have:

- Defined objectives.
- Specific implementation tasks.
- Required deliverables.
- Dependencies.
- Verification requirements.
- Explicit completion criteria.

Development must proceed incrementally. A phase must not be marked complete until its required deliverables have been implemented and verified.

This document defines the intended development order, not a claim that any phase has already been completed.

# 2. IMPLEMENTATION PRINCIPLES

## 2.1 Repository-First Development

Before creating or modifying source files, inspect the existing repository.

Identify existing functionality, dependencies, package-manager conventions, application routes, game mechanics, wallet integrations, and deployment assumptions.

Do not replace existing components merely because a new implementation is easier to build independently.

## 2.2 Dependency-Driven Implementation

Implement foundational components before the features that depend on them.

For example:

- Database models must exist before dependent persistence endpoints can be completed.
- Authentication and authorization must exist before protected administrative operations are exposed.
- Gameplay event contracts must be defined before challenge progress can be evaluated reliably.
- Reward eligibility must be established before approval workflows are implemented.
- API contracts must be agreed upon before frontend and backend integrations are considered complete.

## 2.3 Incremental Verification

Every phase must include relevant testing and verification.

Do not postpone all testing until the end of the project.

## 2.4 No Premature Feature Completion

A frontend form connected to a mock API does not constitute a completed backend feature.

A successful database write does not prove that permissions, validation, duplicate-request handling, or business rules are correct.

A successful build does not prove that production deployment works.

The progress tracker must distinguish implementation, testing, and production verification.

## 2.5 Documentation Synchronization

When a material architectural decision changes:

1. Update `MASTER-PLAN.md`.
2. Update this development plan if the implementation sequence or dependencies change.
3. Update `PROGRESS-TRACKER.md` to record the decision and resulting work.

---

# 3. PHASE OVERVIEW

The project will be implemented through the following phases.

| Phase | Name | Primary Outcome |
|---|---|---|
| 0 | Repository Audit and Preparation | Verified understanding of the existing system |
| 1 | Backend Foundation | Independently runnable `/backend` service |
| 2 | Database and Prisma | Versioned schema and working database access |
| 3 | Authentication and Security | Enforced player and administrator permissions |
| 4 | API Contracts and Core Services | Stable backend interfaces and business-service foundation |
| 5 | Administrative Dashboard Foundation | Protected dashboard integrated with the backend |
| 6 | Player Records and GoodDollar Integration | Persistent player and verification data |
| 7 | Gameplay Persistence and Leaderboards | Validated sessions, scores, and persistent rankings |
| 8 | Challenge Management and Rules Engine | Configurable challenges and rule evaluation |
| 9 | Bounty Management | Bounty lifecycle, submissions, and bounty leaderboards |
| 10 | Reward Approval and Distribution | Auditable manual reward workflows |
| 11 | Operational Metrics and Auditability | Reliable administrative insights and operational records |
| 12 | Integration, Security, and Quality Assurance | Verified end-to-end functionality |
| 13 | Production Deployment and Handover | Production-ready release and operational documentation |

The phases may overlap only when their dependencies are satisfied and the overlap is explicitly recorded in the progress tracker.

---

# 4. PHASE 0: REPOSITORY AUDIT AND PREPARATION

## 4.1 Objective

Establish an accurate understanding of the existing SLYYCE codebase before implementation.

## 4.2 Tasks

### Repository Structure

- Inspect the repository root and workspace configuration.
- Identify the existing Next.js application.
- Identify package-manager and lockfile conventions.
- Review existing TypeScript configuration.
- Identify shared packages and reusable utilities.
- Review existing build, lint, and test commands.

### Game Architecture

- Identify the current game engine and runtime.
- Locate gameplay session handling.
- Identify score calculation and submission flows.
- Identify existing game modes and tournament functionality.
- Determine which scores or gameplay records currently persist.
- Identify relevant game events that can support challenge evaluation.

### Web3 and Identity

- Inspect wallet connection and provider configuration.
- Inspect existing GoodDollar SDK integration.
- Identify relevant contract interfaces and chain configuration.
- Determine existing authentication assumptions.
- Identify available wallet identity and verification-state APIs.

### Deployment and Configuration

- Inspect current deployment configuration.
- Identify existing environment variables without exposing their values.
- Determine whether the repository is already configured for monorepo deployment.
- Identify any existing backend code or database integrations.
- Record existing operational limitations.

### Baseline Verification

Run the repository's existing applicable checks.

Record baseline failures separately so that existing problems are not incorrectly attributed to new implementation work.

## 4.3 Deliverables

- Verified repository structure.
- Existing-system inventory.
- Dependency and package-manager inventory.
- Existing gameplay and score-flow description.
- Existing wallet and GoodDollar integration assessment.
- Baseline build and test results.
- List of architectural questions requiring resolution.

## 4.4 Completion Criteria

- [ ] Relevant existing source code has been inspected.
- [ ] Existing functionality has been identified.
- [ ] Package-manager and workspace conventions are understood.
- [ ] Existing persistence limitations are documented.
- [ ] Required gameplay events have been identified or marked unresolved.
- [ ] Baseline build and test results are recorded.
- [ ] Implementation risks and open decisions are documented.

**Gate:** Do not begin substantial backend or database implementation until the repository audit has established the actual system boundaries.

---

# 5. PHASE 1: BACKEND FOUNDATION

## 5.1 Objective

Create a maintainable backend service inside `/backend` that can run independently of the Next.js application and be deployed to Render.

## 5.2 Tasks

- Establish the backend package and TypeScript configuration.
- Configure the runtime and compatible Node.js version.
- Select the HTTP framework based on the repository audit.
- Create application initialization and server entry points.
- Establish routing and middleware conventions.
- Add environment-variable loading and validation.
- Add structured logging.
- Add centralized error handling.
- Implement health and readiness endpoints as appropriate.
- Configure development scripts.
- Configure production build and start scripts.
- Establish the backend test structure.
- Confirm workspace compatibility.

## 5.3 Engineering Requirements

- The backend must not depend on the Next.js development server.
- Configuration must be loaded through environment variables.
- Startup must fail clearly when mandatory configuration is missing.
- Production errors must not expose stack traces or secrets.
- Health endpoints must not expose internal credentials.
- The backend must support a configurable port compatible with Render.

## 5.4 Deliverables

- Runnable `/backend` service.
- Validated configuration module.
- Health endpoint.
- Structured logging and error handling.
- Development and production scripts.
- Initial backend tests.

## 5.5 Completion Criteria

- [ ] Backend starts locally.
- [ ] Backend builds successfully.
- [ ] Health endpoint returns the expected response.
- [ ] Invalid mandatory configuration is handled safely.
- [ ] Existing application functionality remains intact.
- [ ] Backend is structurally ready for database integration.

**Gate:** Do not implement feature endpoints against an unstable backend foundation.

---

# 6. PHASE 2: DATABASE AND PRISMA

## 6.1 Objective

Establish the database schema, Prisma integration, and migration workflow for all required application data.

## 6.2 Tasks

### Database Configuration

- Configure the Supabase PostgreSQL connection.
- Establish the appropriate runtime connection and pooling strategy.
- Configure a separate migration connection if required.
- Validate connection behavior in the intended deployment environment.
- Document required environment variables.

### Prisma Setup

- Add Prisma to the backend package.
- Create `backend/prisma/schema.prisma`.
- Configure Prisma Client generation.
- Establish the migration directory and workflow.
- Add database-related scripts.
- Configure test database access.

### Schema Design

Design and review the initial models for:

- Players.
- Wallet associations.
- GoodDollar verification metadata.
- Gameplay sessions.
- Gameplay scores or score records.
- Leaderboard-related records or aggregates.
- Challenges and challenge versions.
- Challenge rules and participation.
- Bounties and bounty versions where required.
- Bounty participation and submissions.
- Reward eligibility and approvals.
- Manual reward distributions.
- Administrative identities and audit logs.

Add supporting models only when required by the agreed architecture.

### Data Integrity

- Define foreign-key relationships.
- Define unique constraints.
- Define enum values and lifecycle states.
- Add required indexes.
- Define deletion and retention behavior.
- Define timestamps and update behavior.
- Identify transaction boundaries.

### Migration Workflow

- Generate migrations for schema changes.
- Review migration SQL.
- Test migrations against a development database.
- Verify the schema can be recreated from migration history.
- Document production migration execution.

## 6.3 Deliverables

- Initial reviewed Prisma schema.
- Version-controlled migrations.
- Generated Prisma Client.
- Validated database configuration.
- Database scripts and documentation.
- Schema and relationship verification results.

## 6.4 Completion Criteria

- [x] Prisma schema validates.
- [x] Prisma Client generates successfully.
- [x] Development migrations run successfully.
- [x] Database constraints are verified.
- [x] Required indexes and relationships are defined.
- [x] Production migration commands are documented.
- [x] No production secrets are committed.
- [x] Runtime and migration connection behavior is understood.

**Gate:** Dependent application features must use the approved Prisma models rather than introducing ad hoc database access.

---

# 7. PHASE 3: AUTHENTICATION AND SECURITY

## 7.1 Objective

Establish the authentication and authorization controls required to protect player data and administrative operations.

## 7.2 Tasks

### Authentication Design

- Finalize the player authentication approach.
- Finalize administrator authentication through the selected Supabase Auth integration or approved alternative.
- Define token verification and session handling.
- Define how authenticated users map to internal player records.
- Define how authenticated wallets are associated with players.
- Define credential expiration and invalidation behavior.

### Authorization

- Define administrative roles and permissions.
- Implement backend authorization middleware or equivalent policies.
- Protect administrative routes.
- Enforce player ownership of private resources.
- Prevent unauthorized role escalation.
- Restrict sensitive reward operations.

### Security Controls

- Implement request validation conventions.
- Configure CORS for approved origins.
- Establish rate-limiting rules.
- Apply request-size limits.
- Prevent sensitive information from appearing in logs.
- Establish safe error responses.
- Define idempotency requirements for sensitive operations.

### Wallet Security

Where wallet-signature authentication is required:

- Implement nonce-based challenge-response.
- Validate signatures.
- Enforce expiry.
- Prevent replay.
- Verify ownership before accepting wallet associations.

### Administrative Access

- Establish the initial administrator-provisioning procedure.
- Prevent public self-registration from granting administrator privileges.
- Verify permissions on the backend for every protected action.

## 7.3 Deliverables

- Authentication integration.
- Authorization policies.
- Administrative role model.
- Protected route mechanism.
- Security configuration.
- Authentication and authorization tests.

## 7.4 Completion Criteria

- [ ] Protected endpoints reject unauthenticated requests.
- [ ] Unauthorized roles cannot perform restricted actions.
- [ ] Player data access is correctly scoped.
- [ ] Wallet ownership is verified where applicable.
- [ ] Invalid and expired credentials are rejected.
- [ ] Replay protection is implemented where required.
- [ ] Secrets are excluded from client bundles and logs.
- [ ] Security tests pass.

**Gate:** Do not expose administrative mutations or reward operations before the required authorization controls are active.

---

# 8. PHASE 4: API CONTRACTS AND CORE SERVICES

## 8.1 Objective

Establish consistent backend API contracts and business-service patterns before completing dashboard and gameplay integration.

## 8.2 Tasks

- Define the API versioning convention.
- Establish the request and response format.
- Define validation and error-response standards.
- Establish pagination and filtering conventions.
- Define service and repository responsibilities.
- Establish transaction and idempotency patterns.
- Define the initial route groups.
- Document API contracts in the master implementation documentation or the relevant sections of the existing three orchestration files.
- Create API tests for the shared infrastructure.

## 8.3 Required API Domains

The planned API must cover:

- Players and wallet associations.
- GoodDollar verification.
- Gameplay sessions and scores.
- Global and game-mode leaderboards.
- Challenge administration and retrieval.
- Challenge participation and progress.
- Bounty administration and retrieval.
- Bounty participation and submissions.
- Bounty leaderboards.
- Reward eligibility and approval.
- Manual distribution records.
- Administrative metrics.
- Audit logs.
- Health and readiness.

The final endpoint list must follow the approved data model and existing application requirements.

## 8.4 Deliverables

- Consistent API response conventions.
- Initial route and service structure.
- Validation patterns.
- Pagination and error-handling patterns.
- API contract documentation.
- Core infrastructure tests.

## 8.5 Completion Criteria

- [ ] API conventions are documented.
- [ ] Authentication is integrated into protected routes.
- [ ] Validation is performed on the server.
- [ ] Error responses are consistent.
- [ ] Pagination is defined for listing endpoints.
- [ ] Sensitive operations have appropriate idempotency controls.
- [ ] Core API tests pass.

**Gate:** The frontend and backend must agree on API contracts before a feature is considered integrated.

---

# 9. PHASE 5: ADMINISTRATIVE DASHBOARD FOUNDATION

## 9.1 Objective

Integrate a secure administrative dashboard into the existing Next.js application.

## 9.2 Tasks

### Dashboard Structure

- Establish the administrative route structure.
- Implement the shared dashboard layout.
- Implement sidebar and header navigation.
- Integrate the approved authentication strategy.
- Protect administrative routes.
- Establish role-aware navigation.
- Reuse existing UI components and design conventions.

### API Integration

- Create a centralized API client.
- Configure the backend base URL.
- Integrate the required authentication headers or credentials.
- Establish response parsing and error handling.
- Add loading and empty states.
- Add consistent form-submission feedback.

### Shared Components

Create reusable components for:

- Data tables.
- Search and filters.
- Pagination.
- Status indicators.
- Confirmation dialogs.
- Form fields.
- Error messages.
- Loading indicators.
- Summary metrics.

### Initial Dashboard Pages

Implement the initial page structure for:

- Overview.
- Players.
- Leaderboards.
- Challenges.
- Bounties.
- Rewards.
- Settings or administrative operations where required.

Pages that depend on unfinished backend capabilities may be scaffolded, but must not be represented as production-complete.

## 9.3 Deliverables

- Protected dashboard layout.
- Centralized API client.
- Shared administrative components.
- Initial dashboard navigation.
- Page scaffolding.
- Frontend integration tests.

## 9.4 Completion Criteria

- [ ] Authorized administrators can access the dashboard.
- [ ] Unauthorized users cannot access protected administrative operations.
- [ ] The dashboard can communicate with the backend.
- [ ] API failures produce understandable feedback.
- [ ] Existing game routes remain functional.
- [ ] Dashboard pages use the existing design system.
- [ ] No privileged database credentials are exposed to the browser.

**Gate:** Feature-specific dashboard work must use the established layout and API integration patterns.

---

# 10. PHASE 6: PLAYER RECORDS AND GOODDOLLAR INTEGRATION

## 10.1 Objective

Establish persistent player records, wallet associations, and official GoodDollar verification-state integration.

## 10.2 Tasks

### Player Records

- Implement player record creation and retrieval.
- Define the internal player identifier.
- Implement wallet association management.
- Normalize wallet-address handling.
- Enforce relevant uniqueness constraints.
- Define player status and supported administrative restrictions.
- Implement authorized player lookup and filtering.

### GoodDollar Integration

- Audit the existing GoodDollar SDK integration.
- Reuse compatible existing functionality.
- Implement verification-state retrieval.
- Implement the official verification flow where needed.
- Refresh status after verification returns.
- Persist necessary verification metadata.
- Handle unavailable services and RPC failures.
- Implement root-identity lookup where supported by the official integration.

### Administrative Player Views

- Display player details.
- Display wallet associations.
- Display verification status.
- Display relevant gameplay and participation records when available.
- Display supported player restrictions.

### Security and Privacy

- Prevent unauthorized player-data access.
- Avoid unnecessary sensitive identity storage.
- Distinguish unknown verification state from confirmed unverified state.
- Ensure administrative restrictions are enforced by the backend.

## 10.3 Deliverables

- Persistent player and wallet records.
- GoodDollar integration.
- Verification-state handling.
- Player-management API.
- Player-management dashboard.
- Relevant integration tests.

## 10.4 Completion Criteria

- [ ] Player records persist correctly.
- [ ] Wallet associations are validated.
- [ ] GoodDollar status is retrieved through the supported official integration.
- [ ] Verification-state changes are persisted appropriately.
- [ ] Service failures are handled safely.
- [ ] Sensitive identity information is not unnecessarily stored.
- [ ] Administrative player views use real backend data.

**Gate:** Features requiring verification status must rely on the documented official integration rather than an invented verification mechanism.

---

# 11. PHASE 7: GAMEPLAY PERSISTENCE AND LEADERBOARDS

## 11.1 Objective

Implement persistent gameplay records and trustworthy global, game-mode, and bounty-compatible ranking foundations.

## 11.2 Tasks

### Gameplay Audit

- Confirm how the existing game starts and ends sessions.
- Identify score-generation logic.
- Identify supported game modes.
- Identify score units and ranking semantics.
- Identify possible score-validation mechanisms.
- Determine how existing tournaments and competitions relate to the new backend.

### Session Persistence

- Implement session creation where required.
- Implement session completion.
- Persist the relevant gameplay metadata.
- Associate sessions with authenticated players.
- Handle incomplete and abandoned sessions.
- Define duplicate-session and retry behavior.

### Score Validation

- Define the trusted score-generation or validation strategy.
- Reject malformed or impossible scores according to the actual game rules.
- Prevent duplicate score processing.
- Preserve score and scoring-version metadata where necessary.
- Record invalidated or disqualified scores.

### Leaderboards

- Implement the global leaderboard.
- Implement separate game-mode leaderboards where applicable.
- Define tie-breaking rules.
- Implement pagination.
- Implement historical records or seasons where required.
- Establish the authoritative ranking calculation.
- Add aggregates or caches only when justified.
- Ensure aggregates can be reconciled against authoritative records.

### Game Integration

- Integrate the game with the backend API.
- Submit relevant session and score records.
- Handle failures and retries.
- Prevent retries from creating duplicate records.
- Preserve existing gameplay functionality.

## 11.3 Deliverables

- Persistent gameplay session records.
- Validated score-processing service.
- Global leaderboard API.
- Game-mode leaderboard API where applicable.
- Leaderboard dashboard.
- Updated game integration.
- Ranking and score-validation tests.

## 11.4 Completion Criteria

- [ ] Gameplay sessions persist.
- [ ] Score submissions are validated.
- [ ] Duplicate submissions do not create duplicate authoritative records.
- [ ] Global rankings are reproducible.
- [ ] Game-mode rankings follow documented rules.
- [ ] Tie-breaking is deterministic.
- [ ] Historical or invalidated records are handled correctly.
- [ ] Dashboard leaderboards display real backend data.
- [ ] Existing game functionality remains operational.

**Gate:** Do not use leaderboard scores as reward-eligibility evidence until the relevant validation and ranking rules are implemented.

---

# 12. PHASE 8: CHALLENGE MANAGEMENT AND RULES ENGINE

## 12.1 Objective

Allow administrators to create and publish configurable game challenges from the dashboard, with progress evaluated by a controlled backend rules engine.

## 12.2 Tasks

### Challenge Data Model

- Finalize challenge lifecycle states.
- Implement challenge creation and editing.
- Implement draft persistence.
- Implement rule configuration storage.
- Implement challenge versioning.
- Implement eligibility and scheduling.
- Implement reward configuration.
- Define publishing and archiving transitions.

### Challenge Forms

Build forms for:

- Challenge name and description.
- Objectives.
- Eligibility.
- Start and end times.
- Supported game modes.
- Completion criteria.
- Difficulty or classification where relevant.
- Reward configuration.
- Rule configuration.

The actual fields must match the implemented challenge capabilities.

### Rule Builder

- Define supported gameplay events.
- Define supported conditions and operators.
- Define supported counters and thresholds.
- Define supported completion actions.
- Implement structured rule validation.
- Implement the visual rule builder.
- Provide rule previews.
- Reject unsupported or unsafe rule definitions.

### Rule Engine

- Evaluate eligible gameplay events.
- Track challenge progress.
- Enforce version-specific rules.
- Prevent duplicate progress updates.
- Handle event retries.
- Handle invalid or late-arriving events.
- Track completion and failure states.
- Generate reward-eligibility records when applicable.

### Publication and Retrieval

- Implement publishing and scheduling.
- Ensure drafts are not publicly retrievable.
- Ensure paused or closed challenges follow their defined rules.
- Expose currently eligible published challenges through the backend API.
- Integrate the game with the challenge retrieval API.

### Administrative Views

- Challenge list.
- Create and edit forms.
- Rule builder.
- Preview.
- Participation details.
- Completion statistics.
- Publication status.
- Reward-eligibility information.

## 12.3 Deliverables

- Challenge management API.
- Challenge persistence and versioning.
- Configurable rule schema.
- Visual challenge builder.
- Backend rule evaluator.
- Challenge participation records.
- Game integration.
- Administrative challenge views.
- Rule-engine tests.

## 12.4 Completion Criteria

- [ ] Administrators can create and edit drafts.
- [ ] Invalid rule configurations are rejected.
- [ ] Valid rules are evaluated by trusted backend logic.
- [ ] Published challenges are retrievable by the game.
- [ ] Drafts are not exposed publicly.
- [ ] Existing participation retains the correct rule version.
- [ ] Duplicate events do not duplicate progress.
- [ ] Challenge completion is persisted correctly.
- [ ] Challenge reward eligibility is recorded for later review.

**Gate:** New challenge definitions must be supported by the actual game event catalogue and rule engine.

---

# 13. PHASE 9: BOUNTY MANAGEMENT

## 13.1 Objective

Implement a complete bounty-management workflow with independent bounty participation, configurable ranking rules, and bounty-specific leaderboards.

## 13.2 Tasks

### Bounty Data Model

- Implement bounty creation and editing.
- Define bounty lifecycle states.
- Implement eligibility configuration.
- Implement scheduling.
- Implement participation limits.
- Implement ranking configuration.
- Implement submission requirements where applicable.
- Implement reward configuration.
- Preserve applicable bounty rule versions.

### Bounty Dashboard

- Implement bounty listing and filtering.
- Implement creation and editing forms.
- Implement validation and preview.
- Implement publishing and scheduling.
- Implement pause, close, and archive actions.
- Display participant counts and status.
- Display submissions and review status where applicable.

### Participation and Submissions

- Implement player entry or enrollment.
- Enforce eligibility.
- Persist participation.
- Track progress and completion.
- Support required submissions.
- Prevent duplicate participation where prohibited.
- Handle closing and reopening according to the approved lifecycle.

### Bounty Leaderboards

- Implement bounty-specific leaderboard retrieval.
- Enforce the bounty's ranking rules.
- Track eligible participants.
- Implement tie-breaking.
- Handle invalidated or disqualified entries.
- Preserve final standings after closure.
- Keep bounty rankings isolated from unrelated leaderboards.

### Game Integration

- Retrieve published bounties.
- Display eligible bounty content.
- Submit participation and relevant progress.
- Handle API failures and retries.
- Display bounty leaderboard results.

## 13.3 Deliverables

- Bounty API.
- Bounty data models.
- Administrative bounty forms.
- Participation and submission workflows.
- Bounty-specific leaderboard service.
- Game integration.
- Bounty tests.

## 13.4 Completion Criteria

- [ ] Administrators can manage the bounty lifecycle.
- [ ] Published bounties are retrievable by the game.
- [ ] Eligibility is enforced server-side.
- [ ] Participation and submissions persist.
- [ ] Bounty-specific leaderboards follow their configured rules.
- [ ] Closed bounties preserve their final standings.
- [ ] Duplicate participation and submission rules are enforced.
- [ ] Reward eligibility can be generated from valid bounty outcomes.

**Gate:** Bounty rewards must enter the common reward-approval workflow rather than bypassing it.

---

# 14. PHASE 10: REWARD APPROVAL AND MANUAL DISTRIBUTION

## 14.1 Objective

Implement a secure, auditable workflow for reviewing, approving, rejecting, and manually recording the distribution of challenge and bounty rewards.

## 14.2 Tasks

### Reward Eligibility

- Define the reward-eligibility data model.
- Connect valid challenge completions to reward eligibility.
- Connect valid bounty outcomes to reward eligibility.
- Validate the applicable reward configuration.
- Prevent duplicate eligibility records where prohibited.

### Approval Workflow

- Implement the pending-review queue.
- Implement reward-detail views.
- Implement approval.
- Implement rejection.
- Record administrator identity and timestamps.
- Record rejection reasons where applicable.
- Enforce permissions.
- Prevent invalid or repeated transitions.

### Manual Distribution

- Implement the approved-rewards queue.
- Implement distribution-record creation.
- Record approved amount and asset.
- Record the administrator responsible.
- Record distribution evidence or transaction reference where available.
- Support confirmation and exception statuses.
- Prevent duplicate distribution records.

### Audit Trail

- Record all relevant reward transitions.
- Record the actor, timestamp, target, and outcome.
- Preserve relevant historical information.
- Protect audit records from unauthorized modification.

### Dashboard Integration

- Implement reward queues.
- Implement approval and rejection controls.
- Implement distribution recording.
- Implement status filters.
- Implement evidence and reference display.
- Clearly distinguish approved rewards from confirmed distributions.

## 14.3 Deliverables

- Reward eligibility service.
- Reward approval API.
- Manual distribution API.
- Reward dashboard.
- Audit integration.
- Reward workflow tests.

## 14.4 Completion Criteria

- [ ] Eligible rewards are recorded.
- [ ] Administrative approval is required.
- [ ] Unauthorized approval attempts are rejected.
- [ ] Rejections are recorded.
- [ ] Distribution is recorded separately from approval.
- [ ] Duplicate operations are prevented.
- [ ] Audit history is complete.
- [ ] The interface never misrepresents approval as successful payment.

**Gate:** Automatic on-chain payout functionality must not be introduced as an incidental part of this phase.

---

# 15. PHASE 11: OPERATIONAL METRICS AND AUDITABILITY

## 15.1 Objective

Provide reliable administrative metrics and operational visibility using actual backend data.

## 15.2 Tasks

- Implement dashboard summary endpoints.
- Define metric calculations.
- Implement recent administrative activity.
- Add relevant player, challenge, bounty, and reward statistics.
- Add audit-log retrieval with pagination and filtering.
- Add backend health information.
- Add appropriate integration-error visibility.
- Optimize expensive queries where needed.
- Verify metric consistency against authoritative records.

## 15.3 Deliverables

- Dashboard metrics API.
- Operational summary components.
- Audit-log views.
- Documented metric definitions.
- Query and performance tests.

## 15.4 Completion Criteria

- [ ] Dashboard metrics use persisted records.
- [ ] Metric definitions are explicit.
- [ ] Distinct players are not confused with wallet counts.
- [ ] Verification status is counted correctly.
- [ ] Reward statuses are counted correctly.
- [ ] Audit records can be searched and paginated.
- [ ] Sensitive information is not exposed through metrics or logs.

**Gate:** Metrics must not be presented as authoritative if their underlying records are incomplete or unreliable.

---

# 16. PHASE 12: INTEGRATION, SECURITY, AND QUALITY ASSURANCE

## 16.1 Objective

Verify that the complete system works across the Next.js application, Render backend, Supabase database, game, and external integrations.

## 16.2 Tasks

### End-to-End Workflows

Test the complete flow for:

- Administrator authentication.
- Player authentication.
- Player and wallet association.
- GoodDollar verification-state retrieval.
- Gameplay session persistence.
- Score submission and ranking.
- Challenge creation and publication.
- Challenge participation and completion.
- Bounty creation and publication.
- Bounty participation and leaderboard updates.
- Reward eligibility.
- Reward approval and rejection.
- Manual distribution recording.
- Administrative audit history.

### Security Testing

- Test role enforcement.
- Test player data isolation.
- Test unauthorized resource access.
- Test invalid request payloads.
- Test duplicate requests.
- Test rule-engine limits.
- Test sensitive configuration handling.
- Test rate limits and error responses.

### Reliability Testing

- Test database connection failures.
- Test API timeouts and retries.
- Test unavailable GoodDollar services.
- Test invalid or stale integration responses.
- Test concurrent score submissions.
- Test concurrent reward operations.
- Test failed challenge-event processing.
- Test migration failures in a safe environment.

### Performance and Usability

- Review large leaderboard queries.
- Review administrative listing queries.
- Verify pagination.
- Review index usage.
- Test dashboard loading and error states.
- Identify bottlenecks under realistic expected usage.

### Regression Testing

Run existing relevant game and application tests.

Verify that wallet connection, gameplay, and existing supported features remain functional.

## 16.3 Deliverables

- Unit-test results.
- Integration-test results.
- End-to-end test results.
- Security-test results.
- Regression-test results.
- Known-issues list.
- Release-readiness assessment.

## 16.4 Completion Criteria

- [ ] Critical end-to-end workflows pass.
- [ ] Required automated tests pass.
- [ ] Type checks and lint checks pass.
- [ ] Production build succeeds.
- [ ] Security-sensitive workflows are tested.
- [ ] Known limitations are documented.
- [ ] No unresolved critical issue blocks release.

**Gate:** Do not proceed to production release with unresolved critical security or data-integrity defects.

---

# 17. PHASE 13: PRODUCTION DEPLOYMENT AND HANDOVER

## 17.1 Objective

Deploy the backend and associated database changes safely and provide sufficient documentation for ongoing maintenance.

## 17.2 Tasks

### Production Preparation

- Verify production environment variables.
- Verify Supabase connectivity.
- Review database privileges.
- Confirm backup and recovery arrangements.
- Verify CORS origins.
- Verify authentication configuration.
- Review rate limits and operational logging.
- Confirm the production API URL.
- Confirm frontend API configuration.

### Render Deployment

- Configure the backend service.
- Configure the correct build context.
- Configure dependency installation.
- Configure Prisma Client generation.
- Configure production migrations.
- Configure the start command.
- Configure health checks.
- Verify deployment logs.
- Verify the deployed service responds correctly.

### Database Migration

- Review pending migrations.
- Confirm compatibility with the deployed application.
- Run migrations through the approved deployment procedure.
- Verify the resulting schema.
- Verify critical data-access operations.

### Frontend Integration

- Configure the production backend URL.
- Verify authentication.
- Verify CORS.
- Verify the dashboard can retrieve data.
- Verify the game can retrieve published content.
- Verify score and participation submissions.

### Operational Handover

Document:

- Deployment procedure.
- Migration procedure.
- Required environment variables.
- Health-check behavior.
- Troubleshooting.
- Recovery procedures.
- Known limitations.
- External integration dependencies.
- Administrative onboarding and permission assignment.

## 17.3 Deliverables

- Deployed Render backend.
- Verified Supabase database configuration.
- Production frontend integration.
- Migration and deployment instructions.
- Operational handover documentation.
- Final release assessment.

## 17.4 Completion Criteria

- [ ] Backend is deployed and healthy.
- [ ] Database connectivity is verified.
- [ ] Migrations are applied successfully.
- [ ] Administrative authentication works in production.
- [ ] Challenge and bounty management works in production.
- [ ] Leaderboards use persistent backend data.
- [ ] Reward approval and manual distribution workflows work.
- [ ] GoodDollar integration behaves correctly under supported conditions.
- [ ] Critical production workflows are verified.
- [ ] Recovery and troubleshooting procedures are documented.

---

# 18. CROSS-PHASE ENGINEERING REQUIREMENTS

The following requirements apply throughout the implementation.

## 18.1 Database Integrity

Every feature that writes persistent data must define its transaction boundaries, constraints, and duplicate-request behavior.

A successful HTTP response must correspond to the documented operation outcome.

## 18.2 Authorization

All sensitive operations must be protected at the backend, regardless of the frontend's visibility controls.

## 18.3 Rule-Engine Safety

The challenge builder must operate on validated configuration data, not arbitrary executable code.

## 18.4 Score Integrity

Client-submitted scores must be validated according to the established gameplay trust model.

## 18.5 Reward Integrity

Eligibility, approval, and distribution must remain distinct states.

## 18.6 Observability

Errors, failed operations, and external integration failures must be visible enough to support investigation without exposing sensitive data.

## 18.7 Compatibility

Existing gameplay and wallet functionality must be regression-tested whenever related integration points change.

## 18.8 Documentation

Update the orchestration documents whenever implementation reveals a material change in assumptions, dependencies, or technical decisions.

---

# 19. DEVELOPMENT WORKFLOW

## 19.1 Before Starting a Task

The developer or coding agent must:

1. Read `MASTER-PLAN.md`.
2. Read this `DEVELOPMENT-PLAN.md`.
3. Read `PROGRESS-TRACKER.md`.
4. Identify the current authorized phase.
5. Review the relevant existing code.
6. Confirm the task's dependencies are satisfied.
7. Identify the relevant acceptance criteria.

## 19.2 While Implementing

The developer or coding agent must:

1. Make changes within the authorized scope.
2. Follow existing repository conventions.
3. Avoid unnecessary refactoring.
4. Validate all untrusted inputs.
5. Keep privileged credentials server-side.
6. Write tests for relevant behavior.
7. Run applicable checks.
8. Record blockers as soon as they are discovered.
9. Avoid marking unverified work as complete.

## 19.3 After Implementing

The developer or coding agent must:

1. Review the resulting changes.
2. Run relevant tests.
3. Run applicable type checks and lint checks.
4. Verify database migrations where relevant.
5. Confirm that acceptance criteria are satisfied.
6. Record the changed files.
7. Update `PROGRESS-TRACKER.md`.
8. Record any changed architectural decisions.
9. State the next actionable task.

## 19.4 Phase Completion

A phase may be marked `COMPLETED` only when its acceptance criteria have been verified.

If implementation is complete but testing is outstanding, the phase must remain in review or another accurate non-completed state.

If an external dependency blocks verification, record the blocker explicitly.

---

# 20. PROGRESS TRACKING REQUIREMENTS

`PROGRESS-TRACKER.md` must contain:

- Current phase.
- Current task.
- Overall status.
- Task-level statuses.
- Completed deliverables.
- Files created or modified.
- Tests executed and actual results.
- Migration status where applicable.
- Outstanding issues.
- Blockers.
- Material decisions.
- Next actionable task.

Use the following task statuses consistently:

- `NOT STARTED`
- `IN PROGRESS`
- `BLOCKED`
- `IN REVIEW`
- `COMPLETED`

The progress tracker must describe the actual repository state, not the intended future state.

Do not mark a phase complete simply because all planned files exist.

---

# 21. PRIORITIZATION RULES

When implementation choices must be prioritized, apply the following order:

1. Security and data integrity.
2. Correctness of existing functionality.
3. Database and API foundations.
4. Authentication and authorization.
5. Core persistent gameplay records.
6. Challenge and bounty functionality.
7. Leaderboards and reward workflows.
8. Administrative metrics and usability improvements.
9. Optional optimizations and enhancements.

A visually complete dashboard must not take priority over secure authorization, reliable persistence, or correct reward handling.

A complex challenge builder must not be implemented before the event model and supported rule semantics are established.

Leaderboard caching must not be introduced before ranking correctness is verified.

Production deployment must not bypass required migration or security checks.

---

# 22. FINAL DEVELOPMENT RULES

1. Follow the phase order unless a dependency-based change is explicitly justified.
2. Audit existing code before modifying it.
3. Preserve compatible existing functionality.
4. Use `/backend` for the independently deployed backend service.
5. Use Supabase PostgreSQL and Prisma for backend-managed persistent data.
6. Use version-controlled Prisma migrations for production schema changes.
7. Keep the Next.js dashboard as a frontend client of the backend API.
8. Enforce security-sensitive rules on the backend.
9. Persist validated gameplay and participation records.
10. Use structured, bounded challenge rules.
11. Maintain independent bounty leaderboards.
12. Require administrator approval for challenge and bounty rewards.
13. Record manual distributions separately from approvals.
14. Use the official GoodDollar verification integration.
15. Test duplicate requests, concurrent operations, and failure conditions.
16. Keep the three orchestration documents synchronized.
17. Never report unverified work as completed.
18. Never bypass security or migration controls to make a task appear finished.
19. Document material blockers and unresolved decisions.
20. Require verified acceptance criteria before declaring a phase complete.

---

# 23. DEFINITION OF PROJECT COMPLETION

The implementation is complete when the applicable acceptance criteria in `MASTER-PLAN.md` have been satisfied and verified, the backend and frontend operate together in the intended deployment environment, required data persists correctly, security controls are enforced, reward workflows are auditable, and operational documentation is available.

Completion must be supported by actual implementation and test evidence.

The existence of source files, successful compilation alone, or a deployed but unverified service does not constitute project completion.

---

# END OF DEVELOPMENT PLAN