# Slyyce Agent Instructions

This repository is the durable source of truth for Slyyce.

Do not depend on prior chat sessions, model memory, or undocumented assumptions. Any information required to continue development across developers, agents, or models must live in the repository.

## 1. Context Routing

Read only the context required for the task.

- Product requirements, behavior, scope, and constraints → `docs/PROJECT.md`
- System architecture, module boundaries, and data flow → `ARCHITECTURE.md`
- Current implemented state, blockers, and known gaps → `docs/CURRENT_STATE.md`
- Current substantial implementation work → `docs/exec-plans/active/current.md`
- Resuming unfinished work → `docs/handoffs/CURRENT.md`
- Existing architectural decisions → `docs/decisions/`
- Verified third-party integration research → `docs/research/`

For small isolated changes, inspect the affected code and only the documentation needed to complete the change correctly.

Do not load unrelated documentation unnecessarily.

---

## 2. Source of Truth

Never invent:

- project requirements
- APIs
- endpoints
- smart contract behavior
- blockchain addresses
- environment variables
- schemas
- package behavior
- authentication behavior
- network configuration
- dependency compatibility

For project-specific behavior, use repository documentation and existing code.

For third-party tools and integrations:

1. Check `docs/research/` first.
2. If the information is missing, stale, or version-sensitive, verify it using the vendor's official documentation.
3. Prefer official documentation over tutorials, blogs, forum posts, generated examples, or third-party repositories.
4. Verify that documentation matches the dependency version used by this repository.
5. If official documentation does not confirm the required behavior, do not guess.

When external research materially affects implementation, record the reusable finding in `docs/research/`.

A research entry should include:

- the verified finding
- official source
- relevant package/API version where applicable
- verification date

If project requirements conflict with current official third-party documentation, do not silently resolve the conflict. Record it and follow an explicit project decision.

---

## 3. Dependency Discipline

The committed package manifests and lockfile define the dependency state of the project.

Do not:

- casually upgrade dependencies
- downgrade dependencies without justification
- change major versions without explicit need
- replace libraries unnecessarily
- copy examples targeting incompatible versions
- regenerate the lockfile without reason

Before using a third-party API, confirm that the implementation matches the installed version.

Use exact dependency versions where required by the project or integration security requirements.

---

## 4. Implementation Discipline

Before modifying code:

1. Inspect the relevant existing implementation.
2. Inspect associated types, tests, utilities, and integration boundaries.
3. Read only the repository documentation required for the task.
4. Determine whether an existing abstraction already solves part of the problem.

Prefer the smallest correct implementation.

Do not:

- perform unrelated refactors
- duplicate existing domain logic
- introduce speculative abstractions
- create unnecessary files
- hardcode values that belong in configuration
- expose secrets or private keys
- suppress type errors simply to make builds pass
- disable lint rules merely to avoid fixing code
- fake external integrations and present them as functional
- claim an implementation works without verification

Keep third-party integrations behind clear typed boundaries where appropriate.

Respect existing architectural boundaries unless the task explicitly changes them.

---

## 5. Execution Plans

Use `docs/exec-plans/active/current.md` for substantial work involving:

- multiple files or modules
- new features
- third-party integrations
- architectural changes
- significant refactors
- work likely to span multiple development sessions

The active execution plan should contain:

- objective
- scope
- implementation steps
- progress
- dependencies
- blockers
- acceptance criteria
- required verification

Keep it synchronized with actual implementation progress.

Do not create or expand an execution plan for trivial isolated changes.

When substantial planned work is fully implemented and verified, move its completed record into `docs/exec-plans/completed/`.

---

## 6. Architectural Decisions

Record durable architectural decisions in `docs/decisions/`.

Create a decision record when introducing or changing something future developers may reasonably reconsider, including:

- framework choices
- dependency strategy
- authentication strategy
- wallet strategy
- state ownership
- API boundaries
- game architecture
- blockchain integration strategy
- data flow
- security-sensitive architecture
- deployment architecture

Do not create decision records for routine implementation details.

Do not silently reverse an accepted architectural decision.

If an existing decision must change, document why.

---

## 7. External Integration Rules

Treat blockchain, wallet, authentication, payment, identity, PWA, and other external integrations as version-sensitive.

Before implementing integration behavior:

1. Check existing repository research.
2. Confirm installed dependency versions.
3. Verify behavior against current official documentation.
4. Confirm network, addresses, transaction format, and API assumptions.
5. Record reusable findings if new research was required.

Do not infer production behavior from outdated examples.

Do not invent fallback behavior for security-sensitive integrations.

If required information is unavailable, surface the dependency or blocker explicitly.

---

## 8. Security Rules

Never:

- commit private keys
- commit secrets
- expose server-only values through public environment variables
- log authentication secrets
- log private credentials
- hardcode production secrets
- bypass validation on external input
- trust client-provided blockchain or game state without required verification

Treat all wallet addresses, API responses, environment variables, and external data as untrusted until validated where appropriate.

Security-sensitive shortcuts require an explicit documented decision.

---

## 9. Verification

Never declare work complete solely because code was generated.

Run the smallest appropriate verification set for the task.

Depending on the change, this may include:

- formatting
- linting
- TypeScript type checking
- unit tests
- integration tests
- end-to-end tests
- production build
- targeted runtime testing

For substantial work, run all repository-required quality checks.

Fix failures caused by the implementation.

If a required verification step cannot be executed, state exactly:

- what was not verified
- why it could not be verified
- what must be done next

Do not report unverified functionality as working.

---

## 10. Current Project State

`docs/CURRENT_STATE.md` describes the meaningful current state of the repository.

Update it when project state materially changes, including when:

- a feature becomes implemented
- an integration becomes operational
- a major capability becomes available
- a blocker appears
- a blocker is resolved
- an important implementation assumption changes
- a feature remains intentionally mocked or incomplete

Do not use `CURRENT_STATE.md` as a chronological development log.

Git history provides detailed change history.

Keep `CURRENT_STATE.md` concise and factual.

---

## 11. Handoff Protocol

When stopping substantial unfinished work, update:

`docs/handoffs/CURRENT.md`

The handoff must contain only what the next developer or agent needs to continue immediately:

- current objective
- completed work
- current working state
- unfinished work
- blockers
- important assumptions
- verification already performed
- exact next action

Do not require the next developer or model to access the previous chat session.

A new developer or agent should be able to resume by reading the repository.

When the handoff becomes obsolete, update or replace it.

---

## 12. Documentation Discipline

Documentation should reduce uncertainty, not create noise.

Do not duplicate the same information across multiple files unless necessary.

Prefer:

- concise facts
- explicit constraints
- exact interfaces
- clear ownership
- links to authoritative internal documents

Avoid:

- long narrative explanations
- generic programming advice
- repeated project descriptions
- speculative future plans presented as requirements
- copying large sections of external documentation

Store information where it logically belongs and reference it from other documents when necessary.

---

## 13. Completion Rule

Before declaring substantial work complete:

1. Confirm the implementation satisfies the active requirement.
2. Confirm it respects existing architecture and decisions.
3. Run required verification.
4. Update the active execution plan.
5. Update `docs/CURRENT_STATE.md` if project state changed.
6. Record any durable architectural decision.
7. Record reusable external research when applicable.
8. Update `docs/handoffs/CURRENT.md` if unfinished work remains.

Do not claim success based solely on generated code.

The repository must remain sufficient for another competent developer or AI coding agent to continue without access to the previous conversation.