# ADR-0006: Drop Balance-Delta Transfer Checks for G$

Status: Accepted
Date: 2026-10-28

## Context

ADR-0005 verified every token transfer by reading the recipient's balance before and after. G$ on Celo is a Superfluid SuperToken: measured on a mainnet fork, `balanceOf` costs ~160k gas and a plain transfer ~205k. The two extra reads made each payment ~450k gas (0.09 CELO at the 200 gwei base fee). New email wallets get only 0.0075 CELO from the development GoodDollar faucet, and 0.3 CELO from the production faucet.

## Decision

`SlyceBase` transfers with OpenZeppelin `SafeERC20` and no balance-delta check (contracts v1.1.0). The token is fixed at initialization with no setter, and only G$ is used. G$ has no transfer fee.

## Consequences

- Measured on a fork after upgrading the deployed proxies: play 452k → 239k gas, buy 462k → 249k, tournament entry 529k → 316k. Storage layout is unchanged, so this is an in-place UUPS upgrade.
- If a future deployment uses a fee-on-transfer token, accounting would be wrong. Such a deployment must restore the checks.

## Evidence

`contracts/test/` (56 tests incl. Celo fork), fork gas measurements against the deployed proxies, `docs/research/gooddollar.md`.
