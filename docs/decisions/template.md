# ADR-XXXX: <Decision Title>

Status: Proposed
Date: YYYY-MM-DD

## Context

Describe the architectural problem or decision that must be resolved.

Include only the information required to understand:

- why the decision exists
- what part of Slyyce is affected
- what constraints matter
- what would remain ambiguous if no decision were recorded

Do not repeat the full product or architecture documentation.

---

## Decision

State exactly what Slyyce will do.

The decision must be specific enough that implementation does not need to guess.

Example:

> Slyyce will use a runtime-specific wallet adapter. MiniPay will use its injected provider with automatic connection, while standard web will use the approved wallet connector/UI stack.

Avoid vague language such as:

> Use the best available approach.

---

## Rationale

Explain why this option was selected.

Focus on the factors that actually drove the decision, such as:

- official platform requirements
- compatibility
- security
- maintainability
- performance
- reduced coupling
- deterministic behavior
- operational simplicity
- implementation risk

Keep this concise.

---

## Consequences

Record the meaningful consequences of the decision.

Include relevant:

### Positive

- benefits introduced by the decision

### Negative

- trade-offs
- limitations
- added complexity
- migration cost
- operational constraints

Remove either subsection if it adds no value.

---

## Evidence

Reference the research or authoritative project information supporting this decision.

Prefer repository references such as:

- `docs/research/<file>.md`
- `docs/PROJECT.md`
- `ARCHITECTURE.md`

When the decision depends directly on external requirements, include the relevant official source link if it is not already preserved in the referenced research document.

Do not copy large portions of source material into the ADR.

---

## Alternatives Considered

Include only serious alternatives that were evaluated or that future developers are likely to reconsider.

For each alternative, state briefly why it was not selected.

Example:

### Alternative A

Rejected because `<reason>`.

### Alternative B

Rejected because `<reason>`.

Remove this section when no meaningful alternative needs to be preserved.

---

## Open Questions

List unresolved issues that affect this decision.

Do not accept a security-sensitive ADR while a critical unresolved question remains unless the unresolved portion is explicitly outside the accepted scope.

Remove this section when there are no open questions.

---

## Related Files

List the implementation or documentation areas directly affected.

Example:

- `ARCHITECTURE.md`
- `apps/web/lib/web3/`
- `docs/research/minipay.md`
- `docs/exec-plans/active/current.md`

Keep the list focused.

---

## Supersedes

`ADR-XXXX: <Previous Decision>`

Include only when this ADR replaces an earlier decision.

Otherwise remove this section.

---

## Superseded By

`ADR-XXXX: <New Decision>`

Add this only when this ADR is later replaced.

Otherwise remove this section.