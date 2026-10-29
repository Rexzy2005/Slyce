# ADR-0002: pnpm workspace ownership

- Status: Accepted
- Date: 2026-10-07
- Basis: explicit user implementation instruction

## Context

The workspace was documentation-only. The user now requests implementation while retaining control of dependency installation and server execution.

## Decision

Use pnpm for the Slyce workspace. The original package names were `@slyce/web` and `@slyce/shared`; ADR-0011 supersedes those names with `@slyyce/web` and `@slyyce/shared`. Keep exact approved direct versions from ADR-0001 and dependency research; the internal shared dependency uses workspace:0.0.0. Do not create an unused contracts package.

The user owns dependency installation and application-server startup for this implementation run. The agent writes manifests but must not run package installation/removal/upgrades/resolution, fabricate a lockfile, or start a server. The user generates pnpm-lock.yaml with pnpm install. No exact pnpm release has been approved, so no packageManager version is invented.

## Rationale

This follows explicit user ownership and the existing workspace boundaries without selecting unapproved versions or blocking independent source work.

## Consequences

Code may be written before dependency resolution at the user's explicit direction. This supersedes the previous execution-plan sequencing requirement to inspect the resolved graph before any feature code; it does not waive graph/audit, typecheck, build or runtime acceptance. No production integration is considered verified until those checks pass. ADR-0001's six integration gates are unchanged.

Zustand is not added yet: no currently implemented local UI state needs a shared store. ESLint/formatter packages also have no approved exact pins; use the narrow checked-in architecture/whitespace checks and strict TypeScript for now, and retain standard lint/formatter selection as an open tooling item.

## Evidence

Explicit user instruction on 2026-10-07; [active plan](../exec-plans/active/current.md) preserves the authorized scope and verification constraints.

## Related Files

[ADR-0001](ADR-0001-frontend-stack.md), [workspace manifest](../../package.json), [architecture](../../ARCHITECTURE.md).
