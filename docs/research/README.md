# Slyyce Research Registry

## Frontend baseline research

The completed [dependency research](dependency-baseline.md) informed [ADR-0001](../decisions/ADR-0001-frontend-stack.md). The ADR controls frontend baseline choices; the [active execution plan](../exec-plans/active/current.md) records its planning authorization and next milestone. Research remains supporting evidence, with integration findings still partially verified. Accepted conclusions flow into ADRs; implementation follows those decisions rather than treating research proposals as architecture authority.

The ADR source field names `docs/research/frontend-dependency-baseline.md`; the actual research file is `docs/research/dependency-baseline.md`, linked above. No duplicate research file is required.

## GoodDollar

[gooddollar.md](gooddollar.md): Celo addresses per environment, decimals, citizen-sdk 1.2.7 API, and test-environment notes.

[reown-appkit.md](reown-appkit.md): AppKit 1.8.24 email/wallet sign-in, Celo embedded-wallet support, dashboard requirements.

## 1. Purpose

This directory stores durable, verified research for third-party technologies and integrations used by Slyyce.

Research exists here so developers and coding agents do not repeatedly:

- search for the same information
- rely on previous chat sessions
- implement from memory
- copy outdated examples
- mix APIs from incompatible package versions
- guess security-sensitive integration behavior

This directory is not a general knowledge base.

Only store research that materially affects implementation, architecture, security, compatibility, testing, or deployment.

---

## 2. Source Priority

Use sources in this order:

1. Official vendor/project documentation
2. Official API or SDK reference
3. Official framework documentation
4. Official package documentation
5. Official release notes or migration guides
6. Official source repository when documentation does not answer the question

Use third-party sources only when official sources are insufficient.

Examples of lower-priority sources:

- blogs
- tutorials
- Stack Overflow
- forum posts
- community articles
- generated examples
- unofficial GitHub repositories

If a third-party source is required, clearly label it as non-authoritative and explain why it was needed.

Never treat AI-generated text as an authoritative source.

---

## 3. Research Categories

Create separate research files for meaningful integration domains.

Expected files may include:

```text
docs/research/
├── README.md
├── dependency-baseline.md
├── nextjs.md
├── tailwind.md
├── phaser.md
├── wagmi-viem.md
├── wallet-ui.md
├── minipay.md
├── gooddollar.md
├── celo.md
├── serwist-pwa.md
├── tanstack-query.md
├── zustand.md
└── testing.md
```

Do not create a file merely because a technology exists.

Create a research file when the information is:

- version-sensitive
- integration-sensitive
- security-sensitive
- likely to be reused
- likely to prevent implementation mistakes
- relevant to an architectural decision

Related technologies may share one research file when their compatibility is tightly coupled.

Example:

```text
wagmi + viem
```

may reasonably live together.

---

## 4. Required Research Format

Every research file must begin with:

```markdown
# <Technology or Integration>

Status: Verified | Partially Verified | Blocked
Last verified: YYYY-MM-DD
Relevant versions: <version or range>
Official sources:
- <official URL>
- <official URL>
```

Then organize findings using only the sections that are useful.

Recommended structure:

```markdown
## Verified Findings

## Compatibility

## Slyyce Implementation Requirements

## Known Constraints

## Open Questions

## Architecture Impact
```

Do not add empty sections.

---

## 5. Verification Rules

A statement may be marked **Verified** only when an authoritative source supports it.

Before recording a finding:

1. identify the technology and relevant version
2. locate the current official documentation
3. verify that the documentation applies to the selected version
4. verify the exact behavior Slyyce depends on
5. record the source
6. record the verification date

Do not generalize beyond what the source supports.

Example:

If documentation confirms a feature for version 3, do not assume the same API exists in version 2.

If documentation describes a capability but not its implementation constraints, record only the confirmed capability.

---

## 6. Version Discipline

Version-sensitive findings must identify the version they apply to.

Use:

```text
Relevant versions: wagmi 2.x, viem 2.x
```

or, when exact versions have been selected:

```text
Relevant versions:
- wagmi 2.19.5
- viem 2.38.5
```

Do not write:

```text
Uses wagmi
```

when the finding depends on a specific major version.

If a package version later changes:

1. re-check affected research
2. update the verification date
3. update findings that changed
4. review related architecture decisions
5. update implementation if necessary

Old findings must not silently remain authoritative after incompatible upgrades.

---

## 7. Dating Rules

Every research document must contain:

```text
Last verified: YYYY-MM-DD
```

Update this date only when the relevant official sources were actually checked again.

Do not change the date merely because the file was edited for formatting.

For individual findings with different verification dates, annotate them when necessary:

```text
Verified: 2026-10-07
```

The purpose of the date is to expose potentially stale integration knowledge.

---

## 8. Research Status

Use one of three document statuses.

### Verified

Use when all implementation-critical findings in the document have been confirmed against authoritative sources.

```text
Status: Verified
```

### Partially Verified

Use when some important behavior is confirmed but unresolved questions remain.

```text
Status: Partially Verified
```

List unresolved items under:

```markdown
## Open Questions
```

### Blocked

Use when implementation depends on information that cannot currently be confirmed.

```text
Status: Blocked
```

State:

- what is missing
- why it matters
- what must be resolved before implementation

Never convert uncertainty into an implementation assumption merely to remove a blocker.

---

## 9. Recording Findings

Write findings as concise implementation facts.

Preferred:

```markdown
- MiniPay must use its injected wallet provider.
- The MiniPay runtime must not display the standard wallet picker.
```

Avoid:

```markdown
MiniPay is an exciting mobile wallet ecosystem with many useful capabilities...
```

Research documentation exists to reduce implementation uncertainty, not to teach the technology from first principles.

Record only information Slyyce needs.

---

## 10. Source Links

Every material external finding must be traceable to an authoritative source.

Prefer linking directly to the relevant documentation page rather than a documentation homepage.

Example:

```markdown
## Official Sources

- MiniPay wallet connection:
  https://docs.minipay.xyz/...
```

Do not copy large sections of vendor documentation into the repository.

Record:

- the relevant conclusion
- the implementation implication
- the source

The external documentation remains the canonical source for vendor behavior.

---

## 11. Distinguish Facts from Decisions

Research answers:

> What does the external technology actually support or require?

Architecture decisions answer:

> Given those facts, what will Slyyce do?

Do not confuse the two.

Example research finding:

```text
Framework A supports options X and Y.
```

Example architectural decision:

```text
Slyyce will use option X because it satisfies MiniPay compatibility and reduces duplicate wallet configuration.
```

The first belongs in:

```text
docs/research/
```

The second belongs in:

```text
docs/decisions/
```

---

## 12. Linking Research to Decisions

When research causes or materially supports an architectural decision, link both documents.

In the research file:

```markdown
## Architecture Impact

This research resulted in:

- `docs/decisions/ADR-0003-wallet-strategy.md`
```

In the decision record:

```markdown
## Evidence

See:

- `docs/research/minipay.md`
- `docs/research/wagmi-viem.md`
```

This creates the chain:

```text
Official Documentation
        ↓
Verified Research
        ↓
Architecture Decision
        ↓
Implementation
```

Future developers must be able to understand not only what was chosen, but why.

---

## 13. Research That Changes Architecture

If new official documentation invalidates an existing architecture assumption:

1. do not silently change the implementation
2. update the relevant research document
3. identify the affected decision record
4. create or update the appropriate architecture decision
5. update `ARCHITECTURE.md` if the accepted architecture changes
6. update `docs/CURRENT_STATE.md` if implementation is currently affected
7. update the active execution plan when current work changes

Research alone does not automatically override an accepted Slyyce architectural decision.

The conflict must be resolved explicitly.

---

## 14. Dependency Compatibility Research

Before installing or upgrading important dependencies, verify compatibility between directly coupled packages.

Examples include:

```text
Next.js
↕
React

wagmi
↕
viem
↕
wallet UI library

Next.js bundler
↕
Serwist

GoodDollar SDK
↕
viem/wagmi

MiniPay requirements
↕
wallet stack
```

Record important compatibility constraints in:

```text
docs/research/dependency-baseline.md
```

The package manifest and lockfile become the authoritative installed-version state after dependencies are installed.

Research explains why those versions were selected.

---

## 15. Security-Sensitive Research

Use stricter verification for:

- wallet authentication
- blockchain transactions
- token handling
- contract addresses
- chain IDs
- signing behavior
- GoodDollar identity
- UBI claims
- MiniPay wallet behavior
- authentication/session behavior
- PWA security-sensitive configuration
- private/server key handling

For these topics:

- prefer current official documentation
- verify network/environment carefully
- verify contract addresses independently where applicable
- verify units and decimals
- verify package-version-specific APIs
- record unresolved ambiguity instead of guessing

Security-sensitive implementation must never rely solely on an old code sample.

---

## 16. Blockchain Address Verification

When recording blockchain addresses, include:

```markdown
Network:
Environment:
Contract:
Address:
Official source:
Verified:
```

Example structure:

```markdown
Network: Celo
Environment: Production
Contract: G$ Token
Address: <address>
Official source: <URL>
Verified: YYYY-MM-DD
```

Do not copy an address from:

- chat history
- screenshots
- unofficial tutorials
- random repositories

when an authoritative source exists.

Environment-specific addresses must remain clearly distinguished.

---

## 17. API and SDK Research

When researching an API or SDK, capture only implementation-critical information such as:

- initialization
- supported environment
- authentication requirements
- required parameters
- returned values relevant to Slyyce
- known constraints
- error behavior relevant to application handling
- version compatibility

Do not copy the vendor's entire API reference.

Implementation code must still be checked against installed types and actual package exports.

Documentation research and compiler verification complement each other.

---

## 18. Research Before Coding

For version-sensitive integrations, the expected workflow is:

```text
Task requires external integration
        ↓
Check docs/research/
        ↓
Is relevant research current?
        |
   +----+----+
   |         |
  Yes        No
   |         |
   |         v
   |    Verify official docs
   |         |
   |         v
   |    Update research
   |         |
   +----+----+
        |
        v
Inspect installed package/API
        |
        v
Implement
        |
        v
Verify
```

Do not browse external documentation unnecessarily when current repository research already answers the question and the installed version has not changed.

This keeps agent context and research cost low.

---

## 19. Research During Coding

If implementation reveals behavior that differs from the research:

Do not force the code to match the document.

Instead:

1. stop and investigate the mismatch
2. inspect installed dependency types/source where appropriate
3. verify current official documentation
4. determine whether:
   - the research is outdated
   - the package version differs
   - the implementation assumption is wrong
   - the vendor documentation is ambiguous
5. update the research
6. update any affected architectural decision

Repository documentation must reflect reality.

---

## 20. Research Maintenance

Research is not automatically permanent.

Review a research file when:

- a related dependency is upgraded
- an external SDK introduces a major release
- an integration begins failing unexpectedly
- official documentation changes materially
- a deployment environment changes
- an architecture decision relying on it is reconsidered

Do not periodically rewrite research without a reason.

Verification should be triggered by meaningful implementation risk.

---

## 21. Avoiding Documentation Noise

Do not store:

- generic explanations
- copied tutorials
- introductory framework material
- large code examples already available in official docs
- obvious TypeScript syntax
- information discoverable instantly from installed types unless it represents an important project constraint
- temporary debugging notes
- individual coding-session commentary

Store only durable information that helps prevent future mistakes or repeated research.

---

## 22. Research File Example

Use this pattern when creating a new research file:

```markdown
# MiniPay Integration

Status: Partially Verified
Last verified: YYYY-MM-DD
Relevant versions:
- <dependency/version>

Official sources:
- <official URL>

## Verified Findings

- <concise verified fact>
- <concise verified fact>

## Compatibility

- <relevant compatibility constraint>

## Slyyce Implementation Requirements

- <what implementation must do because of the verified findings>

## Known Constraints

- <confirmed limitation>

## Open Questions

- <unresolved implementation-critical question>

## Architecture Impact

Related decisions:

- `docs/decisions/<decision-file>.md`
```

Remove sections that are not needed.

---

## 23. Relationship to Other Repository Documents

Use repository documents according to their responsibility:

```text
docs/PROJECT.md
→ What Slyyce must do

ARCHITECTURE.md
→ How Slyyce is structured

docs/research/
→ Verified facts about external technologies

docs/decisions/
→ Why Slyyce selected a particular approach

docs/exec-plans/
→ How current implementation work will be executed

docs/CURRENT_STATE.md
→ What is actually implemented now

docs/handoffs/
→ What another developer needs to continue unfinished work
```

Do not duplicate full content between these documents.

Link them instead.

---

## 24. Research Completion Standard

A research task is complete when:

1. the implementation-critical question is clearly defined
2. current authoritative documentation has been checked
3. the applicable version/environment is identified
4. the finding is stated without unsupported inference
5. official sources are recorded
6. the verification date is recorded
7. compatibility implications are documented
8. unresolved questions remain explicitly visible
9. architecture-impacting conclusions link to the appropriate decision record

Research is not complete merely because a useful-looking code example was found.
