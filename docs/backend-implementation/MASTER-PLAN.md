# SLYCE
# MASTER PLAN: BACKEND & ADMIN DASHBOARD ENGINEERING

**Document:** `MASTER-PLAN.md`  
**Project:** SLYCE  
**Scope:** Backend Infrastructure, Database, Admin Dashboard, Game Integration, Challenge and Bounty Management, Leaderboards, Rewards, and GoodDollar Verification  
**Status:** Authoritative Engineering Specification  
**Audience:** Software Engineers, System Engineers, Backend Developers, Frontend Developers, QA Engineers, DevOps Engineers, and AI Coding Agents  
**Primary Repository:** Existing SLYCE monorepo  
**Backend Deployment:** Render  
**Database:** Supabase PostgreSQL  
**ORM:** Prisma  
**Frontend:** Existing Next.js application  
**Document Authority:** This document defines the approved scope, architecture constraints, engineering standards, and acceptance requirements for the project.

---

# 1. PROJECT OVERVIEW

## 1.1 Background

SLYCE is an existing game project that requires a persistent backend and an administrative dashboard to manage players, gameplay records, leaderboards, challenges, bounties, rewards, and related operational activities.

The existing application includes game functionality and Web3 integration. However, the availability, completeness, and reliability of existing persistence mechanisms, gameplay records, tournament logic, and administrative capabilities must be established through a repository audit before implementation.

The objective is to introduce a reliable backend and administrative management system without unnecessarily rebuilding, disrupting, or replacing existing game functionality.

The implementation must preserve the existing application's architecture where practical and introduce new components only where required.

## 1.2 Primary Objective

Build an independently deployable backend within the existing repository, a secure administrative dashboard within the existing Next.js application, and a centralized Supabase PostgreSQL database that serves as the persistent source of truth for SLYCE application data.

The backend must be deployed on Render and use Prisma for database access and version-controlled schema migrations.

The administrative dashboard must allow authorized administrators to manage challenges, bounties, leaderboards, player records, reward approvals, and other supported operational functions without requiring code changes for ordinary content-management operations.

The game must retrieve published challenges and bounties from the backend and submit eligible gameplay events and participation records through authenticated, validated API endpoints.

## 1.3 Project Outcomes

The completed system must provide:

1. An independently deployable backend located in `/backend`.
2. A secure, persistent PostgreSQL database hosted on Supabase.
3. Prisma ORM, migrations, and generated Prisma Client.
4. A protected administrative dashboard integrated into the existing Next.js application.
5. Administrative forms for creating, editing, previewing, publishing, pausing, and archiving challenges and bounties.
6. A configurable custom challenge builder that allows administrators to define supported challenge logic through the dashboard.
7. Persistent global and game-mode leaderboards.
8. Persistent bounty-specific leaderboards.
9. Server-validated gameplay sessions, scores, challenge progress, and bounty participation.
10. Admin-approved and manually distributed challenge and bounty rewards.
11. Integration with the official GoodDollar identity-verification system.
12. Auditable administrative actions and reward decisions.
13. Automated tests and documented deployment procedures.
14. A clear implementation workflow governed by `DEVELOPMENT-PLAN.md` and `PROGRESS-TRACKER.md`.

---

# 2. SCOPE AND BOUNDARIES

## 2.1 Included in Scope

The implementation includes:

- Repository and architecture audit.
- Backend scaffolding and deployment configuration.
- Supabase PostgreSQL integration.
- Prisma schema design and migrations.
- Authentication and authorization.
- Player profiles and wallet associations.
- GoodDollar verification-state integration.
- Gameplay sessions and score persistence.
- Global, game-mode, and bounty-specific leaderboards.
- Challenge and bounty lifecycle management.
- Configurable challenge rules engine.
- Challenge and bounty participation tracking.
- Administrative dashboard and supporting interfaces.
- Reward eligibility, approval, rejection, and manual distribution tracking.
- Administrative audit logs.
- API contracts and request validation.
- Security controls and data-access policies.
- Unit, integration, and end-to-end testing.
- Deployment, monitoring, troubleshooting, and operational documentation.

## 2.2 Excluded Unless Explicitly Approved

The following are not automatically included in this implementation:

- Rebuilding the existing game or replacing its game engine.
- Replacing the existing wallet connection system.
- Developing an independent facial-verification or biometric identity system.
- Automatic on-chain reward payouts.
- A new token, cryptocurrency, or reward asset.
- Arbitrary execution of administrator-supplied JavaScript, Python, SQL, or other code.
- A general-purpose visual programming platform unrelated to supported game mechanics.
- Replacing existing smart contracts without a separate engineering decision.
- Introducing a separate frontend application solely for administration.
- Replacing the existing monorepo structure.
- Adding unnecessary infrastructure or microservices.
- Treating unverified existing functionality as production-ready.

Any expansion beyond the approved scope must be documented, assessed for security and operational implications, and approved before implementation.

## 2.3 Existing-System Preservation

Before making changes, the development team must inspect the actual repository and identify:

- Existing Next.js application structure.
- Existing package manager and workspace configuration.
- Current game engine and gameplay lifecycle.
- Existing score calculation and persistence mechanisms.
- Existing tournament or competition features.
- Wallet connection and authentication implementation.
- Existing GoodDollar SDK integration.
- Existing smart-contract interfaces and network configuration.
- Existing shared packages, types, and UI components.
- Current environment variables and deployment assumptions.
- Existing tests, linting, type-checking, and build commands.

The implementation must reuse compatible existing functionality rather than creating duplicate systems.

No existing feature may be removed or fundamentally altered without establishing why the change is necessary and checking its impact on dependent functionality.

---

# 3. SYSTEM ARCHITECTURE

## 3.1 High-Level Architecture

The system consists of four principal components:

1. Existing Next.js application.
2. Independently deployable backend service.
3. Supabase PostgreSQL database.
4. Existing game and Web3 integrations.

The logical request flow is:

Administrator or player → Next.js application → Render backend API → Prisma Client → Supabase PostgreSQL.

The game retrieves published content through the backend API and submits validated gameplay records to the backend.

The backend is responsible for authentication verification, authorization, validation, business rules, persistence, and administrative operations.

The database is the persistent source of truth for application-managed records. Existing blockchain contracts remain authoritative for their own on-chain state.

## 3.2 Repository Structure

The intended structure is:

    slyce/
    ├── apps/
    │   └── web/
    │       └── src/
    │           └── ... existing Next.js application
    ├── backend/
    │   ├── src/
    │   │   ├── config/
    │   │   ├── routes/
    │   │   ├── controllers/
    │   │   ├── services/
    │   │   ├── repositories/
    │   │   ├── middleware/
    │   │   ├── validators/
    │   │   ├── policies/
    │   │   ├── jobs/
    │   │   ├── utils/
    │   │   ├── app.ts
    │   │   └── server.ts
    │   ├── prisma/
    │   │   ├── schema.prisma
    │   │   ├── migrations/
    │   │   └── seed.ts
    │   ├── tests/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── .env.example
    ├── docs/
    │   └── backend-implementation/
    │       ├── MASTER-PLAN.md
    │       ├── DEVELOPMENT-PLAN.md
    │       └── PROGRESS-TRACKER.md
    ├── package.json
    ├── pnpm-workspace.yaml
    └── ... existing repository files

This is a target structure, not a requirement to create every directory immediately. Actual paths and package configuration must be reconciled with the repository audit.

The existing package manager and workspace conventions must be preserved.

## 3.3 Backend Technology

The backend should use:

- TypeScript.
- Node.js, using a currently supported LTS release compatible with the project's dependencies and Render.
- A suitable HTTP framework, preferably Fastify or the framework already established by the repository.
- Prisma ORM.
- Supabase-hosted PostgreSQL.
- A schema-validation library such as Zod, if compatible with existing dependencies.
- Structured application logging.
- Automated tests.
- Environment-based configuration.
- Explicit API versioning.

Do not introduce multiple overlapping frameworks or validation libraries without a concrete need.

The final framework choice must be recorded during the repository audit.

## 3.4 Frontend Integration

The existing Next.js application will contain the administrative dashboard.

The dashboard must use a centralized API client to communicate with the backend.

The frontend must not import Prisma Client or connect directly to PostgreSQL.

The frontend must not contain database passwords, privileged API secrets, or server-only credentials.

Client-side validation is useful for usability but does not replace server-side validation.

The backend must independently enforce every security-sensitive rule, including administrative permissions, challenge publication, score acceptance, reward approval, and player eligibility.

## 3.5 Backend Deployment Independence

The backend must be deployable as an independent service from the repository's `/backend` directory.

Render must be configured with the appropriate working directory, build command, start command, environment variables, health-check endpoint, and migration procedure.

The backend must not require the Next.js development server to remain running.

The backend must start successfully in its own deployment environment and expose a health-check endpoint.

If the repository uses pnpm workspaces, the deployment configuration must account for workspace-level dependencies and lockfiles rather than assuming `/backend` can be installed independently without preparation.

---

# 4. DATABASE AND PRISMA REQUIREMENTS

## 4.1 Database Principles

Supabase PostgreSQL will be the primary persistent database for application-managed data.

Prisma will define the application data models and provide the database-access layer.

The implementation must maintain:

- Referential integrity.
- Appropriate uniqueness constraints.
- Foreign-key relationships.
- Explicit transaction boundaries.
- Appropriate indexes.
- Consistent timestamps.
- Controlled deletion behavior.
- Data validation.
- Migration history.
- Auditable changes where required.

Do not treat client-side state, browser storage, or in-memory collections as authoritative persistent records.

## 4.2 Prisma Schema

The primary Prisma schema must be located at:

    backend/prisma/schema.prisma

The schema must define the database models, relations, enums, indexes, unique constraints, and other supported database mappings required by the implementation.

Generated Prisma Client must be used only in server-side backend code.

Database model names and API-facing names should remain consistent and understandable.

Avoid unnecessary denormalization. Where denormalized leaderboard snapshots or aggregate statistics are introduced for performance, define how they are updated, reconciled, and verified against authoritative records.

## 4.3 Migration Policy

All production schema changes must be version-controlled Prisma migrations.

Development migrations must be created using the Prisma CLI, normally through:

    pnpm exec prisma migrate dev

The exact command must be adapted to the repository's workspace configuration.

Production migrations must use:

    pnpm exec prisma migrate deploy

The command must run in the correct backend package context and use the appropriate production database connection.

The production deployment procedure must not use `prisma db push` as its normal schema-management mechanism.

The team must never manually modify the production database schema in a way that leaves Prisma migration history inconsistent.

Every migration must be reviewed for:

- Data loss.
- Locking or downtime risks.
- Backward compatibility.
- Index creation cost.
- Foreign-key effects.
- Rollback or recovery strategy.
- Application compatibility during deployment.

Destructive migrations require explicit review and a recovery plan.

## 4.4 Database Connection Management

The backend must use environment-provided database connection strings.

Use a suitable Supabase PostgreSQL connection method for the deployment environment.

Where persistent application connections are used, choose the appropriate Supabase connection endpoint or pooler configuration. Direct connections may be appropriate for migration operations, depending on the environment and connection support.

The implementation must distinguish application runtime connections from migration connections when required.

Connection pooling, connection limits, timeouts, and transient connection failures must be handled deliberately.

Database connection strings must never be committed to source control.

## 4.5 Required Logical Data Domains

The following are required logical data domains. Exact Prisma models and table names must be finalized during the database-design phase after reviewing existing game functionality.

### A. Players and Wallets

Store player profiles and their associated wallet addresses.

Required capabilities include:

- Stable internal player identifiers.
- Wallet-address normalization and uniqueness rules.
- Multiple wallet associations where supported.
- Player status.
- Creation and update timestamps.
- Relevant game statistics or references to statistics.
- Administrative restrictions where justified.
- Wallet ownership verification.

Wallet addresses must not automatically be treated as unique human identities.

The design must distinguish a player record from individual wallet addresses and from any confirmed GoodDollar root identity.

### B. GoodDollar Verification

Store the minimum metadata needed to integrate with the official GoodDollar verification system.

Required information may include:

- Associated player or wallet.
- Verification state.
- Confirmed root-identity reference, when available.
- Last successful verification check.
- Last attempted check.
- Relevant status or error classification.
- Timestamps.

Do not store facial images, biometric templates, or unnecessary sensitive identity information.

The official GoodDollar system remains the authority for its verification status.

### C. Gameplay Sessions

Persist relevant game sessions and the associated player, game mode, timing, outcome, and score records.

Required fields depend on the actual game implementation.

Where applicable, track:

- Session identifier.
- Player identifier.
- Game mode.
- Start and end timestamps.
- Completion status.
- Final validated score.
- Relevant score breakdown.
- Session verification status.
- Applicable game or scoring version.
- Submission and processing status.

The backend must not assume that all existing gameplay modes generate identical data.

### D. Leaderboards

Persist the records required to calculate and display the main leaderboard and game-mode-specific leaderboards.

Leaderboard entries must be associated with authoritative gameplay records wherever possible.

The system must support:

- Global rankings.
- Per-game-mode rankings.
- Historical ranking information where required.
- Tie-breaking rules.
- Invalidated or disqualified records.
- Season or competition boundaries when applicable.
- Deterministic ordering.
- Pagination.

The team must establish whether rankings are calculated directly from gameplay records, maintained through aggregate tables, or produced through a combination of both.

Any cached or materialized ranking data must have a reliable reconciliation strategy.

### E. Challenges

Store challenge definitions and their lifecycle information.

Required capabilities include:

- Draft creation.
- Editing.
- Validation.
- Preview.
- Publishing.
- Scheduling.
- Pausing.
- Archiving.
- Eligibility rules.
- Reward configuration.
- Rule definitions.
- Version history.
- Participation and completion records.

Published challenge versions must remain identifiable after the challenge is edited.

Existing participants must not silently inherit incompatible rules from a newly edited challenge version.

### F. Challenge Rules

Store structured challenge-rule definitions and versioned configurations.

Rule configurations must be validated against an explicit schema.

The backend must reject unknown operators, unsupported events, invalid actions, recursive structures, oversized configurations, and malformed values.

Challenge rules must not execute arbitrary code supplied by administrators.

### G. Bounties

Store bounty definitions and their lifecycle information.

Required capabilities include:

- Drafting.
- Editing.
- Previewing.
- Publishing.
- Scheduling.
- Pausing.
- Closing.
- Archiving.
- Eligibility requirements.
- Participation limits.
- Submission requirements where applicable.
- Reward configuration.
- Review requirements.
- Leaderboard configuration.
- Bounty-specific ranking records.

Each bounty must have an independent identifier and must be able to reference its own participation records and leaderboard results.

### H. Challenge and Bounty Participation

Persist participation records for individual players and the relevant challenge or bounty.

Records must support:

- Enrollment or entry.
- Progress.
- Completion.
- Failure or disqualification.
- Submission evidence where applicable.
- Eligibility status.
- Completion timestamps.
- Applicable rules version.
- Reward eligibility.
- Administrative review status.

Unique constraints must prevent duplicate participation records where only one record is allowed per player and activity.

Where repeated attempts are supported, each attempt must be explicitly identified.

### I. Reward Approval and Distribution

The system must distinguish reward eligibility, administrative approval, and actual distribution.

Required capabilities include:

- Eligible reward records.
- Pending review.
- Approval.
- Rejection.
- Recorded rejection reasons where appropriate.
- Approved reward amount and asset.
- Approving administrator.
- Approval timestamp.
- Manual distribution status.
- Distribution evidence.
- Transaction reference where available.
- Confirmation timestamp.
- Audit history.

The system must never claim that a reward was paid simply because an administrator approved it.

### J. Administrative Accounts and Audit Logs

Maintain an administrative identity and authorization model.

Record important actions, including:

- Challenge creation and publication.
- Bounty creation and publication.
- Rule changes.
- Reward approval and rejection.
- Manual distribution confirmation.
- Player restrictions.
- Administrative permission changes.
- Sensitive settings changes.

Audit records must include the actor, action, target, timestamp, and relevant before-and-after information where appropriate.

Do not include passwords, access tokens, secret keys, or unnecessary sensitive information in logs.

### K. Supporting Operational Data

Additional models may be required for:

- Idempotency keys.
- API event processing.
- Background-job state.
- Integration health.
- Scheduled publishing.
- Leaderboard snapshots.
- Seasons.
- Administrative notifications.
- External transaction reconciliation.

Add these only when the actual architecture requires them.

## 4.6 Data Retention and Deletion

The system must define retention and deletion behavior for player records, gameplay records, audit logs, submissions, and integration metadata.

Where records must be retained for audit or reward reconciliation, deletion of a player profile must not silently destroy required financial or operational history.

Use appropriate anonymization, restriction, or controlled deletion policies when required.

---

# 5. BACKEND API ARCHITECTURE

## 5.1 API Principles

The backend must expose documented, versioned HTTP APIs.

Use `/api/v1` as the proposed initial API prefix unless an existing convention must be preserved.

The API must provide stable request and response contracts for the Next.js dashboard and the game.

The backend must enforce authentication, authorization, input validation, business rules, and persistence for all relevant operations.

## 5.2 Required API Domains

The API must provide logical endpoint groups for:

- Authentication and session verification.
- Player profiles and wallet associations.
- GoodDollar verification status.
- Gameplay sessions and score submissions.
- Main and game-mode leaderboards.
- Challenge retrieval and administration.
- Challenge participation and progress.
- Bounty retrieval and administration.
- Bounty participation and submissions.
- Bounty leaderboards.
- Reward eligibility and approvals.
- Manual distribution records.
- Administrative dashboard metrics.
- Audit logs.
- Health and readiness checks.

These groups describe API responsibilities, not a requirement to create a separate controller for every operation.

## 5.3 Public and Administrative Endpoints

Separate public/player-facing operations from administrative operations through explicit authorization policies.

Examples of player-facing operations include:

- Retrieving currently published challenges.
- Retrieving currently published bounties.
- Retrieving public leaderboard results.
- Starting or joining an eligible activity.
- Submitting valid gameplay events.
- Retrieving the authenticated player's progress.

Administrative operations include:

- Creating or editing challenges.
- Creating or editing bounties.
- Publishing or pausing activities.
- Reviewing submissions.
- Approving or rejecting rewards.
- Confirming manual distributions.
- Managing supported player restrictions.
- Reviewing audit logs and operational metrics.

Public endpoints must never expose draft content, private player data, administrative metadata, or unapproved reward information.

## 5.4 Request Validation

All incoming request bodies, query parameters, and route parameters must be validated on the server.

Validation must cover:

- Required fields.
- Types and formats.
- String lengths.
- Numeric boundaries.
- Enum values.
- Date and schedule validity.
- Reward amounts.
- Participation limits.
- Rule configuration schemas.
- Identifier formats.
- Request sizes.

Reject malformed requests with consistent, documented error responses.

Do not trust values merely because the frontend form generated them.

## 5.5 API Error Handling

Use a consistent error-response format.

Errors should contain:

- A stable machine-readable code.
- A safe, understandable message.
- Optional field-validation details.
- A request or correlation identifier where useful.

Do not expose stack traces, SQL details, internal paths, secret values, or raw database errors in production responses.

## 5.6 Pagination and Filtering

Administrative listing endpoints must support suitable pagination and filtering.

Examples include:

- Players.
- Challenges.
- Bounties.
- Leaderboard entries.
- Reward approvals.
- Participation records.
- Audit logs.

Large collections must not be loaded entirely into memory or returned in one unbounded request.

The API must enforce maximum page sizes and sensible query limits.

## 5.7 Idempotency and Duplicate Requests

Security-sensitive operations must handle retries safely.

Examples include:

- Score submission.
- Challenge completion.
- Bounty submission.
- Reward approval.
- Manual distribution confirmation.
- Processing externally observed transaction events.

Use unique constraints, idempotency keys, state-transition checks, or other appropriate mechanisms.

A repeated request must not create duplicate reward approvals, duplicate completion records, or duplicate distribution records.

---

# 6. ADMINISTRATIVE DASHBOARD

## 6.1 General Requirements

The dashboard must be implemented within the existing Next.js application.

It must provide a protected administrative interface for managing SLYCE operations.

The interface must use the existing project's design system, components, styling conventions, and state-management approach wherever practical.

The dashboard must not become a separate application unless a later architectural decision explicitly requires one.

Every page must use real backend data once the corresponding backend feature is available.

Mock data may be used during isolated UI development only when clearly identified and removed or disabled before production acceptance.

## 6.2 Dashboard Overview

The overview page should display relevant operational information, including:

- Registered players.
- Players with associated wallets.
- GoodDollar verification statistics.
- Active gameplay sessions, where recorded.
- Published challenges.
- Published bounties.
- Challenge and bounty participation.
- Pending reward approvals.
- Manual distributions awaiting confirmation.
- Leaderboard summaries.
- Recent administrative activity.
- Backend or integration health information where available.

Metrics must have explicit definitions.

For example, registered players, connected wallets, verified identities, active players, and completed sessions are different measurements and must not be conflated.

Only display metrics that can be calculated from reliable data.

## 6.3 Player Management

The dashboard should allow authorized administrators to:

- Search and filter player records.
- View associated wallet addresses.
- Inspect verification status.
- View gameplay and participation history.
- View relevant leaderboard results.
- Inspect reward eligibility and distribution records.
- Apply supported restrictions where authorized.
- Review relevant administrative history.

Access to private information must be restricted according to role and operational necessity.

Administrative restrictions must be enforced by the backend and reflected in relevant gameplay or submission rules.

## 6.4 Challenge Management

The dashboard must allow administrators to:

- Create a challenge.
- Edit a draft.
- Configure rules and eligibility.
- Configure rewards.
- Preview the challenge.
- Validate the challenge.
- Publish it.
- Schedule publication where supported.
- Pause or close it.
- Archive it.
- View participation and completion statistics.
- Inspect challenge progress.
- Review reward eligibility and approval status.

The challenge form must submit its data to the backend.

The backend must validate and persist the challenge in Supabase through Prisma.

The game must retrieve the challenge from the backend only when it is eligible for public display.

## 6.5 Bounty Management

The dashboard must allow administrators to:

- Create a bounty.
- Configure its description and objectives.
- Configure eligibility requirements.
- Set participation limits.
- Define start and end times.
- Configure scoring or ranking rules.
- Configure submission requirements.
- Configure the reward.
- Preview and validate the bounty.
- Publish, pause, close, or archive it.
- Inspect participant records.
- Review submissions where applicable.
- View its dedicated leaderboard.
- Inspect reward eligibility and approval records.

Bounty creation must not require direct database access.

The form must communicate with the backend API and receive a clear success or validation response.

## 6.6 Leaderboard Management

The dashboard must display and manage leaderboard-related information appropriate to the administrator's permissions.

Required capabilities include:

- Global leaderboard inspection.
- Game-mode leaderboard inspection.
- Bounty-specific leaderboard inspection.
- Filtering by activity or period where supported.
- Inspecting a player's underlying score record.
- Identifying disqualified or invalidated entries.
- Viewing historical results where retained.
- Reviewing the rule or scoring version that produced a ranking.

Administrative correction of a score must be controlled, justified, and audited.

Do not allow administrators to silently edit rankings without recording the action and its reason.

## 6.7 Reward Administration

The dashboard must include a reward review workflow.

Administrators must be able to inspect eligible rewards and relevant evidence, approve or reject a reward, and record the subsequent manual distribution.

The interface must distinguish:

- Pending review.
- Approved.
- Rejected.
- Awaiting manual distribution.
- Distribution submitted or reported.
- Confirmed distributed.
- Failed or disputed, where applicable.

Approval and distribution confirmation are separate actions.

The dashboard must not automatically claim that funds have moved on-chain or reached a recipient when no reliable confirmation exists.

## 6.8 Dashboard User Experience

The dashboard must provide:

- Clear navigation.
- Loading states.
- Empty states.
- Validation messages.
- Error handling.
- Confirmation for destructive or high-impact actions.
- Appropriate success feedback.
- Accessible form labels and controls.
- Responsive layouts.
- Pagination for large datasets.
- Clear status indicators.

A successful interface action must reflect a confirmed backend result, not an optimistic assumption that a database operation succeeded.

---

# 7. CUSTOM CHALLENGE BUILDER

## 7.1 Objective

The challenge builder must allow administrators to create new challenge definitions and configure new combinations of supported gameplay conditions and actions from the dashboard.

Routine challenge creation must not require source-code changes or a new deployment.

The system must distinguish configurable challenge logic from entirely new game mechanics.

## 7.2 Supported Rule Model

The backend must define a structured challenge-rule schema.

A rule may consist of:

- An eligible gameplay event.
- Conditions.
- Counters or accumulated values.
- Thresholds.
- Time constraints.
- Required repetitions.
- Eligibility conditions.
- Completion criteria.
- Failure criteria.
- Supported actions.
- Reward-eligibility outcomes.

The exact event and action catalogue must be based on gameplay events that the existing game can reliably produce or that the backend can authoritatively verify.

Do not invent game events that the existing game does not implement.

## 7.3 Visual Rule Builder

The dashboard should provide a visual form or rule builder for supported conditions.

Administrators should be able to combine conditions using explicitly supported logical operators.

The interface must validate rule structure before saving.

The backend must perform the same validation independently.

## 7.4 Rule Execution

Rule evaluation must occur in a trusted execution environment.

The system must not execute arbitrary JavaScript, Python, SQL, shell commands, or other administrator-supplied executable code.

Challenge definitions must be data interpreted by a controlled rule engine.

The engine must enforce limits on:

- Configuration size.
- Number of conditions.
- Rule depth.
- Supported operators.
- Supported events.
- Supported actions.
- Numeric ranges.
- Execution time.
- Event-processing frequency.

The engine must prevent unsupported operations and unsafe recursive configurations.

## 7.5 Challenge Versioning

Every published challenge must have an identifiable rules version.

When a published challenge is edited, the system must create or publish a new version according to its lifecycle rules.

Existing participation records must retain the version against which they were evaluated.

The system must explicitly define whether a new version affects existing participants, new participants only, or both through a controlled migration.

## 7.6 Event Processing

Gameplay events used to evaluate challenges must be validated and processed safely.

The event-processing system must prevent duplicate events from producing duplicate progress.

Event records should have stable identifiers where possible.

The system must define how late-arriving events, retries, invalid events, and failed evaluations are handled.

If event processing is asynchronous, processing status and retry behavior must be observable.

## 7.7 Future Extension

New game events, operators, or actions may be added through code when the game introduces new capabilities.

The objective is to make challenge definitions configurable within the capabilities of the supported rules engine, not to promise that arbitrary new mechanics can be created without engineering work.

---

# 8. BOUNTY SYSTEM

## 8.1 Bounty Lifecycle

The bounty lifecycle should support:

- Draft.
- Scheduled.
- Published.
- Active.
- Paused.
- Closed.
- Archived.

Any additional states must have clear meanings and permitted transitions.

The backend must validate transitions rather than allowing arbitrary status changes.

A closed or archived bounty must not accept new participation unless an explicitly authorized reopening process permits it.

## 8.2 Eligibility

Bounties may define eligibility requirements such as:

- Player status.
- Wallet association.
- GoodDollar verification status.
- Start and end dates.
- Participation limits.
- Previous completion requirements.
- Supported game-mode requirements.
- Other explicitly implemented conditions.

The backend must evaluate eligibility when a player enters or submits the bounty and again at appropriate security-sensitive transitions.

The dashboard must clearly communicate configured requirements.

## 8.3 Bounty Leaderboards

Each leaderboard-enabled bounty must have its own ranking context.

Bounty rankings must not be mixed with the global game leaderboard unless explicitly configured as a separate presentation.

The bounty leaderboard must support:

- Eligible participant records.
- Validated scores or progress.
- Configured ranking criteria.
- Tie-breaking rules.
- Disqualification handling.
- Historical results.
- Pagination.
- Closed-bounty final standings.

The system must define whether a bounty is ranked by a single final score, accumulated progress, completion time, or another supported metric.

Bounty ranking rules must be validated and preserved for the applicable bounty version.

## 8.4 Bounty Submissions

Where a bounty requires a submission, the system must support the relevant submission metadata and evidence references.

Submission processing must include:

- Submission validation.
- Eligibility checks.
- Duplicate handling.
- Review status.
- Approval or rejection where required.
- Audit history.
- Reward-eligibility updates.

File uploads, if required, must use an explicitly approved storage architecture with access controls, size limits, and content restrictions.

Do not store large binary evidence directly in PostgreSQL without an established reason.

---

# 9. LEADERBOARD AND SCORING SYSTEM

## 9.1 Authoritative Scores

The backend must not blindly trust scores supplied by the browser.

The implementation must establish which gameplay outcomes can be independently verified and how score submissions are validated.

Where the game can provide trusted, verifiable session events, the backend should calculate or validate the final score using the authoritative rules.

Where full server-side gameplay simulation is not practical, the system must document the trust limitations and apply appropriate validation and abuse controls.

A client-submitted score must not automatically become an authoritative reward-eligibility decision.

## 9.2 Main Leaderboards

The system must support:

- A global leaderboard.
- Separate game-mode leaderboards where the existing game has distinct modes.
- Historical rankings or seasonal leaderboards where required.
- Deterministic ranking order.
- Defined tie-breaking rules.
- Invalidated or disqualified entries.
- Efficient pagination.

Whether the global leaderboard combines scores across different game modes must be explicitly defined. Scores with incomparable units must not be combined arbitrarily.

## 9.3 Bounty Leaderboards

Bounty-specific leaderboards must be independently scoped and must use the applicable bounty ranking rules.

The backend must enforce eligibility and prevent participation in a closed bounty unless reopening is explicitly supported.

## 9.4 Ranking Calculation

The database and backend must define:

- Ranking metric.
- Ranking direction.
- Tie-breaking order.
- Validity rules.
- Score correction behavior.
- Disqualification behavior.
- Time-window or season behavior.
- Historical retention.
- Cache invalidation or aggregate refresh behavior.

If rankings are stored in aggregate tables, they must be reproducible from authoritative gameplay and participation records.

## 9.5 Score Corrections

Score corrections must require an authorized administrative action or an explicitly defined automated validation process.

Corrections must preserve the original record or its audit history.

The system must record the reason, actor, timestamp, and affected ranking context.

---

# 10. REWARDS AND MANUAL DISTRIBUTION

## 10.1 Reward Policy

All challenge and bounty rewards must require administrative approval.

Approved rewards will be distributed manually during this implementation phase.

The system must track the reward lifecycle without assuming that approval automatically transfers funds.

Automatic on-chain payout integration is outside the current scope unless separately approved.

## 10.2 Reward Lifecycle

The logical reward workflow is:

1. A player satisfies a challenge or bounty requirement.
2. The backend validates the relevant eligibility and completion records.
3. The system creates or updates the reward-eligibility record.
4. The reward enters the pending administrative review queue.
5. An authorized administrator reviews the record and available evidence.
6. The administrator approves or rejects the reward.
7. An approved reward awaits manual distribution.
8. An authorized administrator records the distribution details.
9. The distribution is confirmed or marked as unresolved, failed, or disputed as appropriate.
10. The system retains the complete audit history.

## 10.3 Approval Controls

Reward approval must be a server-authorized operation.

The backend must verify:

- The reward exists.
- The associated activity is valid.
- The player remains eligible under the applicable rules.
- The reward has not already been approved or rejected.
- The requested state transition is allowed.
- The administrator has the required permission.

Repeated requests must not produce duplicate approvals or distributions.

The amount and reward asset must come from validated, persisted reward configuration or an explicitly authorized correction process.

An administrator must not be able to bypass validation by changing the amount in a client request.

## 10.4 Manual Distribution Records

A manual distribution record should include:

- Reward reference.
- Player reference.
- Approved amount.
- Reward asset or denomination.
- Distribution method, where relevant.
- Administrator recording the distribution.
- Timestamp.
- Evidence or transaction reference where available.
- Distribution status.
- Notes or exception details where appropriate.

The system must distinguish between a distribution reported by an administrator and one independently verified through an authoritative external source.

## 10.5 Auditability

Reward approval and distribution actions must be auditable.

The system must preserve enough history to answer:

- Who approved the reward?
- Why was it approved or rejected?
- What amount and asset were approved?
- Who recorded the distribution?
- When was it recorded?
- What evidence or reference was provided?
- Was the distribution confirmed?
- Were any subsequent corrections made?

---

# 11. AUTHENTICATION, AUTHORIZATION, AND SECURITY

## 11.1 Authentication Architecture

The application already uses wallet connectivity and Web3-related integrations. The final authentication implementation must be established through the repository audit.

The recommended direction is:

- Wallet-based authentication for Web3 players where appropriate.
- Supabase Auth for administrator identities.
- Backend-side token verification and authorization.
- Secure, explicitly validated associations between authenticated users, internal player records, and wallet addresses.

The final design must avoid maintaining competing, inconsistent authentication systems.

Connecting a wallet alone must not grant administrator privileges.

## 11.2 Authentication Requirements

The backend must:

- Verify the authenticity and validity of authentication credentials.
- Reject expired or invalid credentials.
- Bind protected actions to the authenticated principal.
- Enforce permissions on every protected endpoint.
- Prevent cross-player access to private records.
- Use appropriate session and token lifetimes.
- Avoid logging credentials.
- Handle revoked or invalidated access appropriately.

If wallet-signature authentication is implemented, use a secure challenge-response protocol with nonces, expiration, replay protection, and appropriate domain or origin binding.

Do not accept an arbitrary wallet address supplied in a request as proof of ownership.

## 11.3 Administrative Roles

The initial role model may include:

- `super_admin`
- `admin`
- `reviewer`

Exact permissions must be documented before implementation.

Suggested separation:

**Super administrator**
- Manage administrative roles.
- Configure sensitive settings.
- Perform explicitly authorized high-impact actions.

**Administrator**
- Manage challenges and bounties.
- Publish content.
- Review players and gameplay records.
- Manage reward approvals within assigned permissions.

**Reviewer**
- Review submissions and reward eligibility.
- Approve or reject only where explicitly permitted.
- No unrestricted access to administrative settings or role management.

High-impact actions must use explicit authorization checks.

If a role is not permitted to perform an action, the backend must reject the request even if the frontend exposes the relevant control.

## 11.4 Secrets Management

Production secrets must be stored in the appropriate environment configuration for Render and other approved services.

Never commit:

- Production database credentials.
- Authentication secrets.
- Private keys.
- Service-role keys.
- Administrative credentials.
- API tokens.
- Private environment files.

Only public configuration values may be exposed to the browser.

## 11.5 API Security

The backend must implement appropriate controls for:

- Rate limiting.
- Request validation.
- CORS.
- Authentication.
- Authorization.
- Resource ownership.
- Request-size limits.
- Secure error handling.
- Sensitive-data logging restrictions.
- Abuse prevention.
- Idempotency.
- Security-relevant audit events.

CORS is not an authentication mechanism.

## 11.6 Database Access

Prisma database access must remain server-side.

The backend should use a database role with the minimum privileges required for its responsibilities.

If Supabase Row Level Security is part of the final architecture, its policies must be explicitly designed and tested. Direct client access to sensitive tables must not be permitted by default.

The team must decide whether application access is exclusively through the backend or whether selected tables are intentionally exposed through Supabase client APIs.

Any use of privileged Supabase credentials must remain server-side and must not bypass authorization checks in application code.

## 11.7 Abuse Prevention

The system must consider:

- Replayed gameplay submissions.
- Duplicate participation.
- Fake score submissions.
- Unauthorized reward claims.
- Repeated verification requests.
- Automated challenge farming.
- Attempts to bypass eligibility.
- Unauthorized administrator actions.
- Concurrent requests that could produce duplicate state changes.

Controls must be proportional to the actual risk and existing game mechanics.

---

# 12. GOODDOLLAR INTEGRATION

## 12.1 Integration Principle

SLYCE must use the official GoodDollar identity-verification functionality rather than building an independent facial-verification system.

The existing SDK integration must be audited before any implementation changes.

Compatible existing SDKs, wallet flows, and contract interactions should be reused.

## 12.2 Verification Responsibilities

The integration must:

- Check the official verification state where supported.
- Initiate the official verification flow where appropriate.
- Refresh or re-check status after the flow returns.
- Persist the minimum required verification metadata.
- Associate confirmed verification information with the correct player or wallet.
- Handle service failures and unavailable networks safely.
- Expose a clear verification status to authorized application workflows.

## 12.3 Verification States

The application should distinguish states such as:

- Unverified.
- Pending.
- Verified.
- Expired or no longer valid, if the official integration exposes this state.
- Verification service unavailable.
- Verification check failed.

A network error or RPC failure must not automatically be interpreted as proof that a user is unverified.

Unknown or unavailable states must be represented honestly and handled according to the applicable feature-access policy.

## 12.4 Wallet and Root Identity Handling

Wallet addresses must not be treated as unique human identities.

Where supported by the official GoodDollar integration, SLYCE should retrieve and persist the confirmed root-identity association or equivalent authoritative reference.

The application must not invent its own identity-linking rules or claim that the official service prevents every possible duplicate verification attempt unless that behavior has been established by the relevant official documentation and testing.

SLYCE may apply its own eligibility and abuse-prevention policies, but those policies must remain distinct from GoodDollar's identity-verification authority.

## 12.5 Privacy

Do not store facial images, biometric templates, or unnecessary sensitive identity information.

Only persist information necessary for verification-state checks, eligibility enforcement, auditability, and legitimate product functionality.

## 12.6 Integration Testing

Tests must cover:

- Successful verification.
- Unverified users.
- Pending or incomplete flows.
- Wallet association changes.
- Unavailable RPC or SDK services.
- Invalid or stale responses.
- Retry behavior.
- Unsupported networks.
- Official root-identity lookup where available.

Any wallet or MiniPay compatibility assumptions must be tested against the actual integration rather than inferred from the existence of a wallet connection.

---

# 13. GAME INTEGRATION

## 13.1 General Principle

The backend must integrate with the existing game without introducing unnecessary changes to its gameplay runtime.

The game should obtain published challenges and bounties from the backend and submit relevant gameplay events through the documented API.

The game must not need database credentials or direct database access.

## 13.2 Published Content

The game must retrieve only content that:

- Has been successfully published.
- Is within its configured schedule.
- Has not been closed or archived.
- Is visible to the requesting player under the applicable visibility rules.

The backend must enforce these conditions regardless of the client implementation.

## 13.3 Gameplay Events

The game integration must identify the relevant events that support:

- Session creation.
- Session completion.
- Score submission.
- Challenge progress.
- Challenge completion.
- Bounty participation.
- Bounty progress.
- Bounty submission.
- Reward eligibility.

The actual event catalogue must be derived from the existing game's real behavior.

Events must be versioned or structured consistently enough for the backend to validate them.

## 13.4 Offline and Retry Behavior

Where the existing game can retry submissions or operate under unstable connectivity, the integration should support safe retries.

A retry must not duplicate scores, challenge progress, bounty participation, or reward eligibility.

The backend must distinguish an accepted event from an event that is pending processing or has failed validation.

## 13.5 Compatibility

API changes must be coordinated with the frontend and game.

Breaking changes must be versioned or introduced through a controlled compatibility process.

The implementation must not silently change score meanings or challenge behavior for active participants.

---

# 14. ADMINISTRATIVE METRICS AND OBSERVABILITY

## 14.1 Dashboard Metrics

Administrative metrics must be derived from actual persisted records.

Possible metrics include:

- Total registered players.
- Distinct player records with wallets.
- Confirmed GoodDollar verification states.
- Active and completed gameplay sessions.
- Published and active challenges.
- Published and active bounties.
- Challenge participation and completion.
- Bounty participation.
- Pending reward approvals.
- Approved rewards awaiting distribution.
- Confirmed manual distributions.

Definitions must be documented to prevent inconsistent counts.

## 14.2 Operational Logging

The backend must use structured logs with suitable timestamps, severity levels, and correlation identifiers.

Logs should support troubleshooting of:

- API errors.
- Database connection failures.
- Migration failures.
- Verification integration errors.
- Invalid gameplay submissions.
- Challenge evaluation failures.
- Reward-state conflicts.
- Deployment startup failures.

Logs must not contain credentials or unnecessary sensitive information.

## 14.3 Health Checks

Provide a health endpoint that confirms the backend process is operational.

Where appropriate, provide a separate readiness check that verifies required dependencies without exposing secrets or sensitive database details.

Health endpoints must not disclose internal configuration.

## 14.4 Error Monitoring

The deployment must provide sufficient visibility into service failures and repeated errors.

If an external monitoring service is introduced, its data collection, cost, privacy implications, and environment configuration must be assessed.

Do not introduce a paid monitoring dependency without an explicit need or approval.

---

# 15. DEPLOYMENT AND ENVIRONMENT MANAGEMENT

## 15.1 Environments

The implementation should distinguish:

- Local development.
- Testing or staging, if available.
- Production.

Environment-specific settings must not be mixed.

Production must use the intended production database and external service configuration.

Development and test environments must not accidentally modify production records.

## 15.2 Render Deployment

The backend deployment must specify:

- Correct repository and branch.
- Backend root directory or equivalent build context.
- Node.js version.
- Installation command.
- Build command.
- Prisma Client generation.
- Migration execution procedure.
- Start command.
- Health-check path.
- Environment variables.
- Appropriate runtime settings.

The actual commands must follow the repository's package-manager and workspace conventions.

## 15.3 Deployment Migrations

Production migrations must be executed through the approved deployment procedure using committed Prisma migrations.

The procedure must prevent application startup from racing against required schema changes.

Where deployment involves breaking schema changes, use a staged migration strategy compatible with the current and incoming application versions.

Do not automatically run destructive migration commands during production deployment.

## 15.4 Environment Variables

The final environment-variable list must be documented in the backend `.env.example` and deployment documentation.

Variables may include:

- `DATABASE_URL`
- `DIRECT_URL`, if required by the selected Supabase connection arrangement.
- `NODE_ENV`
- `PORT`
- `CORS_ORIGINS`
- Authentication configuration.
- Supabase authentication or server-side credentials where required.
- GoodDollar integration configuration.
- Logging and monitoring configuration.

These are proposed names, not confirmation that every variable is currently required.

Each variable must have a clear purpose, and secrets must never be populated with real production values in committed examples.

## 15.5 Database Recovery

The project must document:

- Supabase backup availability.
- Recovery responsibilities.
- Migration recovery procedures.
- Data restoration risks.
- Operational response to accidental data modification.

A migration rollback must not be assumed safe merely because a previous application version exists.

---

# 16. ENGINEERING STANDARDS

## 16.1 General Standards

All implementation work must follow established software-engineering principles.

The codebase must prioritize:

- Correctness.
- Security.
- Maintainability.
- Readability.
- Testability.
- Separation of concerns.
- Explicit data contracts.
- Consistent error handling.
- Controlled complexity.
- Compatibility with the existing repository.

## 16.2 TypeScript

Use TypeScript for new backend code and existing TypeScript frontend code where applicable.

Avoid unnecessary use of `any`.

Define explicit types for domain entities, API contracts, rule configurations, and state transitions.

Do not use frontend TypeScript types as a substitute for backend runtime validation.

## 16.3 Separation of Concerns

Keep HTTP handling, business logic, data access, and validation logically separated.

Controllers or route handlers should not become large repositories of business logic.

Business rules should not depend on presentation components.

Database access must be centralized through the approved server-side data-access layer.

Do not introduce abstraction layers that add complexity without improving testability, consistency, or maintainability.

## 16.4 Dependency Management

Reuse existing compatible dependencies.

Do not install a new library when the current project already provides an appropriate solution.

New dependencies must be justified by functionality, security, compatibility, maintenance, and deployment requirements.

Keep package versions compatible with the established Node.js and package-manager configuration.

## 16.5 Configuration

Use environment-based configuration with validation during startup.

Missing required production configuration must cause a clear startup failure rather than an unsafe default.

Never use production secrets as development defaults.

## 16.6 Code Quality

The project must pass its applicable:

- Type checks.
- Lint checks.
- Unit tests.
- Integration tests.
- Production build.
- Database migration validation.

The exact commands must be established during the repository audit.

Existing unrelated failures must be recorded separately rather than concealed or incorrectly attributed to the new implementation.

## 16.7 Documentation

Technical documentation must describe actual implemented behavior.

Do not claim an endpoint, integration, database model, security mechanism, or deployment workflow exists until it has been implemented and verified.

Update the relevant orchestration document when a material architectural decision changes.

---

# 17. TESTING AND QUALITY ASSURANCE

## 17.1 Testing Strategy

The implementation must include appropriate unit, integration, and end-to-end tests.

Tests must cover normal operation, invalid inputs, unauthorized access, concurrency, retry behavior, and relevant failure cases.

## 17.2 Database Tests

Verify:

- Prisma schema validity.
- Migration creation and execution.
- Referential integrity.
- Unique constraints.
- Foreign-key behavior.
- Transaction behavior.
- Duplicate-request protection.
- Query filtering and pagination.
- Compatibility with the selected Supabase connection configuration.

## 17.3 API Tests

Verify:

- Successful requests.
- Invalid request bodies.
- Missing or invalid credentials.
- Unauthorized administrative operations.
- Invalid state transitions.
- Database failures.
- Duplicate requests.
- Rate limits.
- Consistent error responses.

## 17.4 Dashboard Tests

Verify:

- Protected access.
- Correct API integration.
- Form validation.
- Draft creation.
- Preview and publication.
- Editing and archiving.
- Leaderboard display.
- Reward approval and rejection.
- Manual distribution tracking.
- Loading and error states.
- Permission-dependent controls.

## 17.5 Challenge Engine Tests

Verify:

- Valid rule configurations.
- Invalid operators and actions.
- Unsupported event types.
- Threshold and counter behavior.
- Duplicate events.
- Rule-version compatibility.
- Scheduling.
- Eligibility.
- Completion conditions.
- Resource limits.
- Safe handling of malformed configurations.

## 17.6 Leaderboard Tests

Verify:

- Global ranking.
- Game-mode ranking.
- Bounty-specific ranking.
- Tie-breaking.
- Invalidated scores.
- Duplicate score submissions.
- Pagination.
- Historical results.
- Concurrent submissions.
- Consistency between authoritative records and any stored aggregates.

## 17.7 Reward Tests

Verify:

- Eligibility generation.
- Approval permissions.
- Rejection handling.
- Duplicate approval protection.
- Manual distribution recording.
- Duplicate distribution prevention.
- Audit-history completeness.
- Distinction between approval and confirmed distribution.

## 17.8 Security Tests

Verify:

- Player access isolation.
- Administrative role enforcement.
- Token validation.
- Wallet ownership validation where applicable.
- Rate limiting.
- Input validation.
- Secret exposure prevention.
- CORS configuration.
- Access restrictions for private database records.
- Challenge-rule execution safety.

---

# 18. IMPLEMENTATION GOVERNANCE

## 18.1 Authoritative Documents

Exactly three primary orchestration documents govern this work:

1. `MASTER-PLAN.md`
2. `DEVELOPMENT-PLAN.md`
3. `PROGRESS-TRACKER.md`

This document defines the approved objectives, architectural boundaries, security rules, and acceptance requirements.

`DEVELOPMENT-PLAN.md` defines the ordered implementation phases, dependencies, deliverables, and phase-specific acceptance criteria.

`PROGRESS-TRACKER.md` records the actual implementation status, completed work, test evidence, blockers, decisions, and next actions.

These files must remain synchronized.

## 18.2 Change Control

A change that materially affects architecture, security, data integrity, API contracts, or scope must be evaluated before implementation.

The relevant decision must be recorded in the master plan or the applicable decision section.

The development plan must be updated when the implementation sequence or dependencies change.

The progress tracker must reflect the actual state of the codebase.

## 18.3 Coding-Agent Rules

Any AI coding agent working on this project must:

1. Read the three orchestration documents before making changes.
2. Audit the relevant existing code before proposing replacements.
3. Preserve existing functionality unless a change is approved.
4. Work in the order defined by the development plan.
5. Avoid implementing later phases prematurely.
6. Use Prisma migrations for schema changes.
7. Keep privileged credentials server-side.
8. Validate all untrusted inputs.
9. Write and run appropriate tests.
10. Report actual results rather than claiming unverified success.
11. Update the progress tracker after meaningful implementation work.
12. Document blockers instead of silently bypassing them.
13. Avoid creating duplicate functionality that already exists.
14. Avoid unnecessary dependencies and architectural complexity.
15. Never invent files, endpoints, database models, SDK capabilities, or existing behavior.
16. Distinguish proposed functionality from implemented and verified functionality.

## 18.4 Completion Reporting

At the end of each implementation phase, report:

- What was implemented.
- Files created or modified.
- Database changes and migrations.
- Tests executed and their actual results.
- Known limitations.
- Outstanding issues.
- Whether the phase acceptance criteria are satisfied.
- The next authorized task.

A phase must not be marked complete when its required verification remains outstanding.

---

# 19. ACCEPTANCE CRITERIA

The project is considered complete only when all applicable criteria below are verified.

## 19.1 Backend and Infrastructure

- [ ] The backend exists within `/backend`.
- [ ] The backend deploys independently to Render.
- [ ] The production service starts successfully.
- [ ] Health checks operate correctly.
- [ ] Supabase PostgreSQL connectivity is verified.
- [ ] Prisma Client is generated and used by the backend.
- [ ] Version-controlled migrations run successfully.
- [ ] Production secrets are not exposed to the browser or source control.
- [ ] API validation and error handling are consistent.

## 19.2 Authentication and Security

- [ ] Player and administrator authentication flows are defined and implemented.
- [ ] Administrative permissions are enforced server-side.
- [ ] Connecting a wallet alone does not grant administrator privileges.
- [ ] Unauthorized users cannot access protected records or actions.
- [ ] Sensitive configuration remains server-side.
- [ ] Relevant security and abuse-prevention tests pass.

## 19.3 Database and Persistence

- [ ] Player and wallet associations persist correctly.
- [ ] GoodDollar verification metadata persists appropriately.
- [ ] Gameplay sessions and validated scores persist.
- [ ] Leaderboard records or their authoritative source records persist.
- [ ] Challenges and challenge versions persist.
- [ ] Bounties and participation records persist.
- [ ] Reward approvals and manual distribution records persist.
- [ ] Audit records are retained for required administrative operations.
- [ ] Database constraints prevent relevant duplicate records.

## 19.4 Administrative Dashboard

- [ ] Authorized administrators can access the dashboard.
- [ ] The overview uses actual backend data.
- [ ] Player records can be inspected.
- [ ] Challenges can be created, edited, validated, published, paused, and archived as supported.
- [ ] Bounties can be created, edited, validated, published, paused, closed, and archived as supported.
- [ ] Forms communicate with the Render backend.
- [ ] Invalid forms receive meaningful validation feedback.
- [ ] Draft content is not exposed as published content.
- [ ] Operational errors are presented clearly.

## 19.5 Challenge and Bounty Systems

- [ ] Challenge definitions are configurable from the dashboard.
- [ ] The rule engine rejects invalid or unsafe configurations.
- [ ] Published challenge versions remain identifiable.
- [ ] Participation and completion records persist.
- [ ] Bounty-specific ranking rules are supported.
- [ ] Bounty-specific leaderboards are isolated from unrelated ranking contexts.
- [ ] Closed activities enforce their lifecycle restrictions.
- [ ] Duplicate event processing does not duplicate progress or reward eligibility.

## 19.6 Leaderboards

- [ ] Global leaderboard results are persistent and reproducible.
- [ ] Separate game-mode leaderboards exist where applicable.
- [ ] Bounty-specific leaderboards operate correctly.
- [ ] Ranking and tie-breaking rules are documented.
- [ ] Invalidated or disqualified entries are handled consistently.
- [ ] Pagination works for large datasets.
- [ ] Ranking records remain consistent with authoritative gameplay data.

## 19.7 Rewards

- [ ] Challenge and bounty reward eligibility is tracked.
- [ ] Reward approval is a separate administrative action.
- [ ] Approval and rejection are permission-controlled.
- [ ] Manual distribution is recorded separately from approval.
- [ ] Duplicate approvals and duplicate distribution records are prevented.
- [ ] Reward actions are auditable.
- [ ] The system does not falsely claim that unverified payments have succeeded.

## 19.8 GoodDollar Integration

- [ ] The existing official SDK integration has been audited.
- [ ] Supported verification states are handled correctly.
- [ ] RPC or service failures are not incorrectly treated as verification failures.
- [ ] Wallet and root-identity associations are handled according to official capabilities.
- [ ] No independent biometric-verification system has been introduced.
- [ ] Sensitive verification data is not unnecessarily stored.

## 19.9 Release Quality

- [ ] Required unit tests pass.
- [ ] Required integration tests pass.
- [ ] Required end-to-end tests pass.
- [ ] Type checks pass.
- [ ] Lint checks pass.
- [ ] Production builds succeed.
- [ ] Deployment and migration procedures are documented.
- [ ] Remaining limitations are explicitly documented.
- [ ] All acceptance criteria are supported by actual verification evidence.

---

# 20. FINAL ENGINEERING PRINCIPLES

The following principles are mandatory throughout the project:

**1. One authoritative application database.**  
Supabase PostgreSQL is the persistent source of truth for SLYCE application records managed by this backend.

**2. One controlled backend boundary.**  
The dashboard and game communicate with the backend API rather than accessing PostgreSQL directly.

**3. Prisma-managed schema evolution.**  
Production schema changes are version-controlled, reviewed, and executed through migrations.

**4. Server-side enforcement.**  
Authentication, authorization, score validation, eligibility, challenge evaluation, and reward-state transitions are enforced by trusted backend logic.

**5. Configurable, bounded challenge logic.**  
Administrators can configure supported challenge behavior without executing arbitrary code.

**6. Persistent and auditable competition data.**  
Global, game-mode, and bounty-specific leaderboards must be reproducible from authoritative records and governed by explicit ranking rules.

**7. Explicit reward approval.**  
Challenge and bounty rewards require administrator approval and manual distribution tracking. Approval does not imply payment.

**8. Official identity verification.**  
GoodDollar remains the authority for its own verification state. SLYCE must not create a competing biometric-verification system.

**9. Preserve the existing game.**  
Existing gameplay, wallet connectivity, SDK integrations, and shared packages must be audited and reused wherever appropriate.

**10. No fabricated progress.**  
Features, migrations, tests, and deployments must only be described as completed when their implementation and verification are confirmed.

**11. Incremental implementation.**  
Development must follow the approved phases, respect dependencies, and maintain working, testable software throughout the process.

**12. Controlled scope.**  
Any material departure from this specification requires an explicit engineering decision and corresponding documentation update.

---

# END OF MASTER PLAN