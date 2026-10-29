# ADR-0011: Slyyce Product Name

Status: Accepted
Date: 2026-10-29

## Context

The product name changes from Slyce to Slyyce. The existing web app, PWA metadata, workspace package names, and project documentation use the former name.

## Decision

Use **Slyyce** in product-facing UI and metadata, and use `slyyce` / `@slyyce/*` for workspace packages. Keep deployed contract names, ABI symbols, storage namespaces, addresses, deployment resource names and URLs, existing environment variable names, and user local-storage keys unchanged because they are compatibility interfaces for live contracts, operations, and returning players.

## Consequences

- New product-facing copy and package references use Slyyce.
- Existing on-chain names such as `SlyceArcade`, `SlyceShop`, and `SlyceTournament` remain as deployed.
- Existing operational names such as the Render service URL and `SLYCE_*` environment variables remain until their separately coordinated migration.
- The former `X-Slyce-CSRF` request header remains accepted during rollout; new clients send `X-Slyyce-CSRF`.
- Existing local-storage keys remain readable so returning players keep device-local settings and scores.
- Repository directory and remote URL are unchanged.
