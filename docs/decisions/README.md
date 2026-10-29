# Slyce Architecture Decision Records

## Decision Index

| Decision | Declared status | Planning role |
| --- | --- | --- |
| [ADR-0001 — Frontend Dependency Baseline](ADR-0001-frontend-stack.md) | Proposed | Controlling frontend baseline for implementation planning by explicit user direction; six integration gates remain unresolved. |
| [ADR-0002 — pnpm Workspace Ownership](ADR-0002-workspace-package-manager.md) | Accepted | Explicit user choice of pnpm; user owns installation/server startup while source implementation proceeds. |
| [ADR-0003 — Local Practice Rounds](ADR-0003-local-practice-rounds.md) | Accepted | Device-local, unverified practice scoring until authoritative rules and replay exist. |
| [ADR-0004 — Contracts, GoodDollar SDK, PWA-only](ADR-0004-contracts-gooddollar-pwa.md) | Accepted (partly superseded by ADR-0005) | SlyceShop/SlyceTournament, operator-posted results, citizen-sdk 1.2.7, MiniPay removed; agent installs authorized. |
| [ADR-0005 — Upgradeable contracts, sign-in, paid rounds, app shell](ADR-0005-app-shell-signin-upgradeable.md) | Accepted | UUPS + strict contracts, SlyceArcade play fee, Reown AppKit email/wallet sign-in, app-style shell, Slyce rename. |
| [ADR-0006 — Drop balance-delta checks for G$](ADR-0006-gd-transfer-gas.md) | Accepted | Halves gas per payment (G$ balanceOf ≈160k gas); token fixed at init. |
| [ADR-0007 — Play fees fund the daily prize pool](ADR-0007-play-fees-fund-prize-pool.md) | Accepted | Arcade routes each G$ round fee into the open prize tournament; winners claim it. |
| [ADR-0008 — Verified humans only for prizes](ADR-0008-verified-humans-only-prizes.md) | Accepted | GoodDollar Identity gate on tournament entry; one entry per human. |
| [ADR-0009 — Automatic prize tournaments](ADR-0009-automatic-tournaments.md) | Accepted | Paid rounds start the next tournament when none is open; no daily admin step. |
| [ADR-0010 — Free play, game records, G$ milestones](ADR-0010-free-play-game-records.md) | Accepted | Arcade v2: on-chain games, XP, streaks, daily-capped milestone G$ for verified humans. |

The statuses above match their ADRs exactly. The [active execution plan](../exec-plans/active/current.md) records the user-authorized implementation scope; agent installation/server startup remain prohibited. Supporting research is [dependency-baseline.md](../research/dependency-baseline.md), not the nonexistent `frontend-dependency-baseline.md` named in the ADR source field.

## 1. Purpose

This directory stores durable architectural decisions for Slyce.

Decision records exist so future developers and coding agents can understand:

- what was decided
- why it was decided
- which alternatives were considered
- what evidence supported the decision
- what parts of the system are affected
- whether the decision is still active

Do not rely on previous chat sessions or undocumented reasoning for important architectural choices.

---

## 2. What Requires a Decision Record

Create an ADR when a decision materially affects architecture, integration strategy, security, or future implementation choices.

Examples include:

- framework selection
- dependency strategy
- wallet architecture
- MiniPay integration strategy
- authentication strategy
- GoodDollar integration strategy
- state ownership
- React ↔ Phaser boundaries
- deterministic game architecture
- API boundary design
- contract interaction strategy
- PWA architecture
- deployment architecture
- security-sensitive patterns
- major data-flow decisions

Do not create ADRs for:

- routine component implementation
- minor refactors
- naming choices
- formatting
- small UI changes
- temporary debugging decisions
- implementation details that can change freely without architectural impact

---

## 3. File Naming

Use sequential ADR numbers.

Format:

```text
ADR-0001-short-decision-name.md
ADR-0002-short-decision-name.md
ADR-0003-short-decision-name.md
```

Examples:

```text
ADR-0001-frontend-stack.md
ADR-0002-wallet-strategy.md
ADR-0003-minipay-authentication.md
ADR-0004-game-state-boundaries.md
```

Numbers must never be reused.

---

## 4. Decision Status

Each ADR must use one of these statuses:

```text
Proposed
Accepted
Rejected
Superseded
Deprecated
```

### Proposed

The decision is under consideration.

Implementation should not treat it as final unless explicitly allowed by the active execution plan.

### Accepted

The decision is approved and should guide implementation.

### Rejected

The approach was considered and intentionally not selected.

### Superseded

A newer ADR replaces this decision.

The ADR must reference its replacement.

### Deprecated

The decision is no longer recommended but may still exist in the current implementation.

---

## 5. Required ADR Structure

Every ADR must contain:

```markdown
# ADR-XXXX: Decision Title

Status: Proposed | Accepted | Rejected | Superseded | Deprecated
Date: YYYY-MM-DD

## Context

## Decision

## Rationale

## Consequences

## Evidence

## Related Files
```

Add these sections only when needed:

```markdown
## Alternatives Considered

## Open Questions

## Supersedes

## Superseded By
```

Keep ADRs concise.

---

## 6. Context

The `Context` section explains the problem being solved.

Include only information necessary to understand why the decision exists.

Good:

```text
MiniPay and standard-browser wallet flows have different connection requirements, so a single generic wallet flow would create incorrect behavior.
```

Avoid long project summaries.

---

## 7. Decision

The `Decision` section states exactly what Slyce will do.

It must be specific enough that implementation does not need to guess.

Good:

```text
Slyce will use a runtime-specific wallet adapter. MiniPay will use the injected provider with automatic connection, while standard web will use the approved wallet UI and connector stack.
```

Avoid:

```text
We will use the best wallet approach.
```

---

## 8. Rationale

The `Rationale` section explains why the selected approach is preferred.

Use concise reasons such as:

- official integration requirements
- compatibility
- security
- maintainability
- performance
- reduced coupling
- deterministic behavior
- operational simplicity

Do not repeat the entire Context section.

---

## 9. Evidence

Architectural decisions must be traceable to their supporting information.

Reference relevant repository research:

```text
docs/research/minipay.md
docs/research/gooddollar.md
docs/research/wagmi-viem.md
```

When applicable, also reference:

- official documentation
- package compatibility findings
- existing project requirements
- current implementation constraints

Do not copy large research sections into the ADR.

Link to them.

---

## 10. Research-to-Decision Flow

Use this flow:

```text
Official Documentation
        ↓
docs/research/
        ↓
docs/decisions/
        ↓
ARCHITECTURE.md
        ↓
Execution Plan
        ↓
Implementation
```

Research determines what external systems support.

ADRs determine what Slyce chooses to do.

---

## 11. Relationship to ARCHITECTURE.md

`ARCHITECTURE.md` describes the currently accepted architecture.

ADRs explain why important architectural choices were made.

When an accepted ADR changes the target architecture:

1. create or update the ADR
2. update `ARCHITECTURE.md`
3. update the active execution plan if current work changes
4. update `docs/CURRENT_STATE.md` if implemented state is affected

Do not leave the architecture document and accepted decisions contradictory.

---

## 12. Relationship to Research

Research files contain verified external facts.

ADR files contain Slyce decisions based on those facts.

Example:

```text
Research:
MiniPay requires automatic wallet connection.

Decision:
Slyce will use a dedicated MiniPay wallet adapter and will not render the standard wallet picker inside MiniPay.
```

Do not turn research findings directly into implementation without checking whether an architectural decision is required.

---

## 13. Relationship to Execution Plans

ADRs define direction.

Execution plans define work.

An ADR should not contain detailed task checklists.

Instead:

```text
ADR:
Use a runtime-specific wallet adapter.

Execution plan:
- create adapter interface
- implement MiniPay adapter
- implement standard-web adapter
- add tests
```

---

## 14. Relationship to Current State

An accepted ADR does not mean the decision has already been implemented.

Use:

```text
docs/CURRENT_STATE.md
```

to describe what currently exists.

Example:

```text
ADR-0002 is accepted.
Wallet adapter implementation is still pending.
```

Do not confuse architectural intent with implementation status.

---

## 15. Changing an Existing Decision

Do not silently edit an accepted ADR so that its original decision disappears.

If a decision materially changes:

1. create a new ADR
2. mark the old ADR as `Superseded`
3. reference the new ADR under `Superseded By`
4. reference the old ADR under `Supersedes` in the new record
5. update `ARCHITECTURE.md`
6. update affected research or execution plans if required

Git history exists, but ADR relationships should still make the evolution obvious.

---

## 16. Rejected Alternatives

Record alternatives only when they were serious candidates or when future developers are likely to reconsider them.

Example:

```markdown
## Alternatives Considered

### wagmi v3 with the current wallet UI stack

Rejected because the selected wallet UI version is not confirmed compatible with wagmi v3.

### Custom wallet UI

Rejected because it creates unnecessary implementation and maintenance work for the current product scope.
```

Do not list every possible alternative.

---

## 17. Security-Sensitive Decisions

Security-sensitive decisions require stronger evidence.

Examples:

- authentication
- wallet connection
- transaction construction
- private-key handling
- session handling
- contract permissions
- GoodDollar identity
- MiniPay authentication

For these ADRs:

- reference current official documentation
- identify unresolved assumptions
- avoid accepting the ADR if critical behavior remains unverified

If required evidence is missing, keep the ADR `Proposed` or mark the issue as blocked.

---

## 18. Version-Sensitive Decisions

When a decision depends on specific dependency versions, state them.

Example:

```text
This decision applies to the currently approved wagmi 2.x + viem 2.x wallet stack.
```

If the dependency baseline changes materially, review the ADR.

Do not assume an old architectural decision remains valid across major dependency upgrades.

---

## 19. Decision Quality Standard

A useful ADR must let a future developer answer:

- What problem existed?
- What did Slyce choose?
- Why was this option selected?
- What evidence supports it?
- What trade-offs were accepted?
- Which parts of the system are affected?
- Is the decision still active?

If the ADR cannot answer these questions, it is incomplete.

---

## 20. Context Efficiency

Keep ADRs short.

Prefer:

```text
Context
Decision
Rationale
Consequences
Evidence
```

over long narrative documents.

Do not duplicate:

- research documents
- product requirements
- execution plans
- source code

Reference them instead.

The purpose of an ADR is to preserve the decision, not every conversation that led to it.

---

## 21. Initial Decisions Expected

ADR-0001 now exists in the index above. Other decisions may be required only when work reaches an actual unresolved architectural choice; the following filenames are examples, not a mandate to duplicate choices already governed by ADR-0001:

```text
ADR-0002-wallet-strategy.md
ADR-0003-minipay-authentication-strategy.md
ADR-0004-react-phaser-state-boundary.md
ADR-0005-pwa-service-worker-strategy.md
```

Create them only after the supporting research exists.

Do not create accepted decisions based on assumptions.

---

## 22. Rule for Coding Agents

Before making a change that conflicts with an accepted ADR:

1. stop
2. inspect the ADR and its evidence
3. determine whether circumstances have materially changed
4. verify relevant external documentation if needed
5. create a superseding ADR if the architecture genuinely needs to change

Do not silently override an accepted decision because another approach appears preferable.
