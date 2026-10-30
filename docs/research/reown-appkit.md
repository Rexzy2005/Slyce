# Reown AppKit (email + wallet sign-in) — Verified Findings

Verified: 2026-10-15. Packages: `@reown/appkit` 1.8.24, `@reown/appkit-adapter-wagmi` 1.8.24, `@wagmi/core` 2.22.1 (wagmi 2.19.5, viem 2.57.3).

## Sources

- Next.js App Router + wagmi setup: https://docs.reown.com/appkit/next/core/installation
- Options: https://docs.reown.com/appkit/react/core/options
- Embedded-wallet chain support (Blockchain API): https://docs.reown.com/cloud/blockchain-api
- Installed type definitions (`@reown/appkit-controllers` 1.8.24 `TypeUtil.d.ts`)

## Findings

- Peer requirements of the adapter: `wagmi >=2.19.5`, `viem >=2.55.13`, `@wagmi/core >=2.21.2`. `@wagmi/core` is pinned to 2.22.1, the version wagmi 2.19.5 already resolves.
- Email login creates a non-custodial embedded wallet. Embedded wallets only transact on Blockchain API chains, and **Celo Mainnet (eip155:42220) is listed**.
- `Features` in 1.8.24 include `email`, `emailShowWallets`, `socials`, `connectMethodsOrder`, `swaps`, `onramp` and `analytics`. There are also dashboard-controlled `RemoteFeatures`, so **email login must be enabled in the Reown dashboard** for the project, and the app domain must be allowlisted there.
- Hooks: `useAppKit().open()` (optionally `{ view: 'Account' | 'Networks' }`). Hooks throw if called before `createAppKit`.
- `createAppKit` runs during Next pre-rendering (no `window`), so the app passes an explicit `NEXT_PUBLIC_APP_URL` for metadata.
- Under `exactOptionalPropertyTypes`, `WagmiAdapter` is not assignable to AppKit's adapter parameter type (`namespace`/`adapterType` are optional). The app checks those fields at runtime instead of casting.
- New email wallets hold no CELO. GoodDollar's faucet (`@goodsdks/citizen-sdk` `ClaimSDK.claim`/`triggerFaucet`) tops up verified users, falling back to GoodDollar's API when the wallet cannot pay gas.

## AppKit analytics

Verified: 2026-10-31. Applies to the installed `@reown/appkit` and `@reown/appkit-adapter-wagmi` 1.8.24.

- AppKit 1.8.24 exposes the `features.analytics` option. Slyyce opts in with `features.analytics: true` in `apps/web/src/web3/appkit-provider.tsx`.
- Existing Reown projects must have **AppKit Analytics API** enabled under the project’s Settings → APIs. Reown’s [Analytics guide](https://docs.reown.com/cloud/analytics) places project metrics under Analytics → User Activity; team MAUs are under Usage.
- Reown’s [existing-project setup instructions](https://reown.com/blog/appkit-analytics) require dashboard activation. The repository setting alone cannot turn on that project-level API.
- Reown analytics counts AppKit activity; it does not populate Slyyce’s admin player records. The admin panel’s “Players on Celo” count is based on wallets that used deployed contracts.
