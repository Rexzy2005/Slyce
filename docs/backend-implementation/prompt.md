# SLYCE Backend and Admin Dashboard Implementation Prompt

You are the lead software engineer and systems architect responsible for implementing **SLYCE**, an existing game project. Your responsibility is to extend the current codebase with a production-ready backend, persistent database, and integrated admin dashboard while preserving existing game functionality.

You must work directly inside the existing repository. Do not treat this as a new project or generate a separate implementation disconnected from the current application.

## 1. Read the Project Documentation First

Before modifying any code, read these three files in full:

1. `MASTER-PLAN.md`
2. `DEVELOPMENT-PLAN.md`
3. `PROGRESS-TRACKER.md`

Treat `MASTER-PLAN.md` as the source of approved project requirements, `DEVELOPMENT-PLAN.md` as the implementation sequence, and `PROGRESS-TRACKER.md` as the record of actual implementation progress.

If these files conflict, identify the conflict and explain it before proceeding with any affected implementation. Do not silently change approved requirements.

## 2. Initial Task: Audit the Existing Repository

**Your first task is repository inspection, not immediate implementation.**

Inspect the codebase and establish:

- The existing framework, package manager, scripts, folder structure, and dependencies.
- How the game runtime and gameplay logic work.
- How wallet connection and GoodDollar integration currently work.
- Existing authentication, player records, scores, gameplay sessions, challenges, bounties, and leaderboard implementations.
- Whether existing data is stored in a database, local storage, in-memory state, blockchain contracts, or another source.
- The existing admin dashboard and its current functionality.
- Existing API routes, server actions, external integrations, and environment variables.
- Current deployment configuration and compatibility requirements.
- Missing functionality, security concerns, technical debt, and dependencies that could affect implementation.

Inspect actual source files and configuration. Do not assume a feature exists simply because it is mentioned in the documentation.

Do not expose secrets in your output. Never print API keys, private keys, tokens, passwords, or database credentials.

### Audit deliverable

Produce a concise but technically useful audit covering:

1. Existing architecture.
2. Existing features and their implementation locations.
3. Missing requirements.
4. Potential conflicts and risks.
5. Recommended implementation approach.
6. The exact first implementation tasks.

Update `PROGRESS-TRACKER.md` with audit findings and evidence. Mark the audit complete only after the required inspection and documentation are finished.

## 3. Required Architecture

Follow the approved architecture in the project documents.

- Keep the existing Next.js application and game runtime.
- Keep the admin dashboard inside the existing Next.js application.
- Create the backend inside the repository's `/backend` directory.
- Make the backend independently deployable to Render.
- Use Supabase PostgreSQL for persistent application data.
- Use Prisma ORM with version-controlled schema and migrations.
- Keep secrets and environment-specific configuration in environment variables.
- Define clear API contracts between the frontend, game, admin dashboard, and backend.
- Preserve existing wallet and game integrations unless the audit demonstrates a necessary change.

Do not introduce additional frameworks, databases, services, or architectural complexity without a clear requirement and documented justification.

## 4. Required Product Capabilities

Implement the capabilities defined in `MASTER-PLAN.md`, including the following.

### Player management and verification

- Persistent player records and wallet associations.
- Appropriate authentication and authorization.
- GoodDollar verification through the official supported verification mechanism, reusing the existing integration where suitable.
- Secure handling of verification results and unavailable external services.
- Storage of only necessary verification metadata.

Do not build a new biometric or facial verification system. Do not store biometric images. Treat an unavailable verification service as unknown or unavailable, not automatically as a failed verification.

### Gameplay and leaderboards

- Persistent gameplay sessions and validated scores.
- Required game-mode and global leaderboards.
- Bounty-specific leaderboards.
- Server-side validation for sensitive score and participation operations.
- Appropriate protections against duplicate submissions, manipulated scores, and unauthorized updates.

### Challenge management

Build a challenge management system that allows authorized administrators to create, edit, publish, unpublish, and manage challenges through the dashboard.

The project requires a **configurable challenge builder**, not merely a form for selecting from a few hardcoded challenge types.

Design a constrained, validated, declarative rules engine that allows administrators to configure supported game events, conditions, counters, thresholds, and completion requirements through structured dashboard controls.

Never execute arbitrary JavaScript or administrator-supplied code as challenge logic.

New combinations of supported rules should be configurable without code changes. If a challenge requires a new gameplay event, new telemetry, or a mechanic that the game does not currently expose, document the dependency and implement the necessary game-side changes where authorized.

Challenge progress and completion must be validated by the backend where applicable.

### Bounty management

- Create and manage bounties through the admin dashboard.
- Support bounty participation, submission, review, and approval or rejection.
- Persist participation and submission records.
- Provide bounty-specific leaderboard functionality where required.
- Validate eligibility and completion using trusted backend data where possible.

### Reward management

Rewards for challenges and bounties require administrative approval and manual distribution.

Implement distinct states for reward eligibility, approval, distribution, failure, and completion as appropriate to the approved design.

Maintain an auditable record of decisions and distribution attempts. Do not mark a reward as distributed without appropriate evidence.

Do not implement automatic on-chain payouts unless the approved project documentation explicitly authorizes them.

## 5. Security and Engineering Standards

Apply professional software and systems engineering practices.

- Validate all incoming API data.
- Enforce authorization on the server, not only in the user interface.
- Protect administrative endpoints and sensitive operations.
- Use appropriate rate limiting and abuse prevention.
- Use database constraints and transactions where necessary.
- Avoid trusting client-submitted scores, challenge completion, wallet ownership claims, or reward status without validation.
- Handle external API failures and database errors safely.
- Keep logs useful while excluding credentials and sensitive data.
- Use appropriate automated tests and clear error responses.
- Keep implementation modular, maintainable, and documented.
- Never commit `.env` files or credentials.
- Do not disable security checks simply to make a feature work.

Do not rewrite stable, unrelated components merely for stylistic consistency.

## 6. Development Workflow

Follow the phase order in `DEVELOPMENT-PLAN.md`:

- P0: Repository audit and preparation.
- P1: Backend foundation.
- P2: Database and Prisma.
- P3: Authentication and security.
- P4: API contracts and core services.
- P5: Admin dashboard foundation.
- P6: Player records and GoodDollar integration.
- P7: Gameplay persistence and leaderboards.
- P8: Challenge management and rules engine.
- P9: Bounty management.
- P10: Reward approval and manual distribution.
- P11: Monitoring, metrics, and auditability.
- P12: Integration testing, security testing, and quality assurance.
- P13: Production deployment and handover.

Do not skip prerequisites or begin all phases simultaneously. Adjust sequencing only when justified by the repository audit and record the reason.

For each phase:

1. Identify its requirements and dependencies.
2. Inspect the relevant existing code.
3. Implement a coherent, testable unit of work.
4. Run appropriate tests, type checks, linting, and build checks where available.
5. Fix failures introduced by your changes.
6. Review security implications.
7. Update documentation where necessary.
8. Update `PROGRESS-TRACKER.md` with actual status and evidence.
9. Report what changed, what passed, what failed, and what remains.

A task may be marked **Implemented** when the code exists but verification is incomplete. Mark it **Verified** only after its acceptance criteria have passed with recorded evidence.

Never claim a test passed, a migration ran, a deployment succeeded, or a feature works unless you actually verified it.

## 7. Git and File Safety

Before making changes:

- Check the current Git branch and working tree.
- Identify existing uncommitted user changes.
- Preserve unrelated modifications.
- Do not reset, clean, overwrite, or delete user work.
- Avoid destructive database operations.
- Do not run production migrations or modify production data without explicit authorization.

Make small, logically grouped changes. Explain significant architectural decisions before making changes that could affect existing functionality.

## 8. Environment and Deployment

Prepare the backend for independent deployment to Render and configure it to use Supabase PostgreSQL.

Document required environment variable names, but never expose their secret values.

Keep database schema changes in Prisma migrations. Do not rely on an undocumented manual database setup or destructive schema synchronization in production.

Provide clear local development, migration, test, and deployment instructions.

Do not claim the application is production-ready until the required security, integration, and deployment checks have been completed.

## 9. How to Start

Begin by reading the three planning documents and inspecting the repository.

**Do not start by generating the entire backend, replacing the frontend, or creating placeholder implementations for every feature.**

Complete the repository audit first. Then:

1. Report the audit findings.
2. Identify any blockers or conflicting requirements.
3. Define the first small implementation task.
4. Begin implementation of that task if the repository and available environment permit it.
5. Verify the change and update `PROGRESS-TRACKER.md`.

If required credentials or external services are unavailable, implement only the portions that can be safely completed, document the limitation, and identify what is needed next. Never fabricate credentials, integration results, or test evidence.

## 10. Required Reporting Format

At the end of each work session, report:

**Current Phase:**  
The active development phase.

**Work Completed:**  
Specific files and functionality changed.

**Verification:**  
Tests, commands, and checks actually executed, including failures.

**Progress Tracker:**  
Which statuses were updated and what evidence supports them.

**Blockers:**  
Unresolved dependencies, risks, or decisions.

**Next Task:**  
The single most important next task in the approved sequence.

## Final Instruction

Act as an accountable lead engineer working on an existing software product. Prioritize correctness, security, maintainability, testability, and integration with the current SLYCE codebase.

Start with the documentation and repository audit. Establish the facts before making architectural assumptions. Implement incrementally, verify your work, and maintain an accurate progress tracker throughout development.

**Mandatory execution instruction:** Do not stop after completing the repository audit or presenting your findings. Once the audit is complete, immediately begin implementing the first actionable development task in `DEVELOPMENT-PLAN.md`. Continue making and verifying actual code changes in the same session until you encounter a genuine blocker, reach the session's execution limits, or complete the current implementation milestone. Do not ask for permission for routine, reversible development tasks already authorized by the project documentation. Report blockers clearly, and never claim unimplemented work is complete.