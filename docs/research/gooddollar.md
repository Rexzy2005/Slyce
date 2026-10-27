# GoodDollar on Celo — Verified Findings

Verified: 2026-10-27. Package: `@goodsdks/citizen-sdk` 1.2.7 (npm latest, published 2026-07-14).

## Sources

- Core contracts: https://docs.gooddollar.org/for-developers/core-contracts
- Claim SDK guide: https://docs.gooddollar.org/for-developers/apis-and-sdks/ubi/claim-ubi-viem-wagmi
- Package README and `dist/index.d.ts` of `@goodsdks/citizen-sdk@1.2.7` (registry tarball)

## Findings

- All GoodDollar environments (`production`, `staging`, `development`) on Celo are deployed on **Celo mainnet (42220)**. There is no Celo Sepolia deployment, so GoodDollar features require `NEXT_PUBLIC_NETWORK=celo`. Use `development` for test G$.
- Celo addresses from SDK `chainConfigs` (production matches the official docs page):

| Env | G$ token | Identity | UBIScheme |
| --- | --- | --- | --- |
| production | `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` | `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42` | `0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1` |
| staging | `0x61FA0fB802fd8345C06da558240E0651886fec69` | `0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D` | `0x2881d417dA066600372753E73A3570F0781f18cB` |
| development | `0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475` | `0xF25fA0D4896271228193E782831F6f3CFCcF169C` | `0x6B86F82293552C3B9FE380FC038A89e0328C7C5f` |

- G$ uses **18 decimals** on Celo (verified on-chain for production and development via `decimals()`).
- G$ on Celo is an ERC-20 / Superfluid SuperToken. Standard `approve` + `transferFrom` works with OpenZeppelin `SafeERC20` (fork-tested). Its implementation uses post-Cancun opcodes, so Foundry fork tests need `evm_version = "cancun"`.
- SDK API used: `new IdentitySDK({ account, publicClient, walletClient, env })`, `new ClaimSDK({ account, publicClient, walletClient, identitySDK, env })`, `claim.getWalletClaimStatus()` → `not_whitelisted | can_claim | already_claimed` (+ `entitlement`, `nextClaimTime`), `claim.claim()` (returns receipt; redirects to face verification if not whitelisted; may top up gas via the GoodDollar faucet), `identity.generateFVLink(popupMode, callbackUrl, chainId)`, `claim.getDailyStats()`.
- Peer dependencies: `viem` and `wagmi` with `*` ranges. The package lists `tsup` as a runtime dependency, which adds build tooling to the lockfile.
- The ESM build imports named exports from CommonJS `lz-string`. Bundlers (Next) handle this; Vitest needs `server.deps.inline: ['@goodsdks/citizen-sdk']`.
- The docs page shows outdated import paths (`@goodsdks/identity-sdk/...`). The installed package exports everything from `@goodsdks/citizen-sdk`.
- The official Identity contract exposes `getWhitelistedRoot(address)`, `lastAuthenticated(address)`, and `authenticationPeriod()`. A non-zero root is the authoritative root for a connected wallet; verification is current only while `now <= lastAuthenticated + authenticationPeriod * 86400`.
- The official UBI contract requires entitlement checks against the root wallet for connected accounts. Slyce therefore records the root reference and never treats the browser redirect flag as authoritative.
- The backend now performs a read-only Celo RPC check against the configured environment Identity contract, persists only wallet/environment/state/root/timestamps, and counts unique verified root identities for the admin dashboard. No facial or biometric data is stored.
