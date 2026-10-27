# Frontend Dependency Baseline

Status: Partially Verified
Last verified: 2026-10-27
Relevant versions: Exact pins below, reverified for Phase 1 on 2026-10-07; MiniPay and Celo are runtime/network integrations, not npm version locks.
Official sources:
- [Published npm package metadata](https://registry.npmjs.org/) — version-specific publisher records linked in the tables.
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [RainbowKit installation](https://rainbowkit.com/en-US/docs/installation)
- [Serwist configurator mode](https://serwist.pages.dev/docs/next/config)
- [MiniPay technical reference](https://docs.minipay.xyz/technical-references.md)
- [Celo networks](https://docs.celo.org/learn/network/overview)
- [GoodDollar SDK repository](https://github.com/GoodDollar/GoodSDKs)

## Scope and confidence

This completed research informed [ADR-0001](../decisions/ADR-0001-frontend-stack.md), which now controls the frontend baseline for implementation planning under the authorization recorded in the [active plan](../exec-plans/active/current.md). The ADR declares Proposed; its approved baseline choices are authorized for planning by explicit user direction. The proposal tables and recommendations below preserve the research record, not a separate architecture authority. No package manifest, lockfile or application exists; no packages were installed during this research.

Official documentation, release records, publisher metadata (`version`, `peerDependencies`, `engines`, exports), and selected published SDK source were checked on the date above. Direct peer ranges support the proposed core combination. This does **not** establish a resolved transitive dependency graph, compiler success, production-build success, or real-device integration success. GoodDollar/MiniPay questions below remain open; therefore the whole baseline is partially verified.

## Phase 1 result and version-lock scope

Reverification completed on **2026-10-07**. No newly checked official evidence requires changing an ADR-0001 version. Retain its exact baseline for the proposed installation; TypeScript 5.9.3 and wagmi 2.19.5 remain intentional selections rather than the latest majors. This is a **documentation-level version lock only**, not an npm lockfile, resolved dependency graph or production certification. All package rows and supporting-package findings below were reverified on this date; no selected release has a publisher deprecation flag.

ADR-0001 remains the architecture authority and was not modified. Its declared status is Proposed, while prior user direction designates its approved choices for planning. This Phase 1 task now stops for approval before any installation or implementation.

## Proposed exact baseline

Pin direct dependencies exactly after review; do not use `latest`, caret ranges, peer overrides, or `--legacy-peer-deps` to establish the baseline. The eventual committed manifest and lockfile will own installed versions.

| Area | Package / proposed version | Rationale and official version evidence | Verified |
| --- | --- | --- | --- |
| Runtime | Node.js **24.21.0 LTS** | Current LTS entry in the [Node release index](https://nodejs.org/dist/index.json); satisfies the engine intersection, including Vitest 5. Bundled npm is 11.19.0; package-manager choice still needs review. | 2026-10-07 |
| App Router | `next` **16.4.0** | Current stable [metadata](https://registry.npmjs.org/next/16.4.0); Node >=20.9.0, React/React DOM ^19.0.0 accepted. | 2026-10-07 |
| React | `react` / `react-dom` **19.3.0** each | [React release](https://github.com/facebook/react/releases/tag/v19.3.0), [DOM metadata](https://registry.npmjs.org/react-dom/19.3.0); DOM requires React ^19.3.0. | 2026-10-07 |
| Compiler | `typescript` **5.9.3** | Conservative initial compiler pin: [metadata](https://registry.npmjs.org/typescript/5.9.3), [5.9 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html). Meets Next >=5.1, Zod >=5.5 and selected wagmi/viem requirements. Latest observed is 7.0.2; choosing 5.9.3 is a proposal to limit simultaneous compiler changes, **not** a finding that 7 is incompatible. | 2026-10-07 |
| Types | `@types/react` / `@types/react-dom` **19.3.0**; `@types/node` **24.19.1** | [React](https://registry.npmjs.org/@types%2freact/19.3.0), [DOM](https://registry.npmjs.org/@types%2freact-dom/19.3.0), [Node](https://registry.npmjs.org/@types%2fnode/24.19.1); match runtime major lines. | 2026-10-07 |
| Styling | `tailwindcss` / `@tailwindcss/postcss` **4.3.3**; `postcss` **8.5.29** | [Tailwind](https://registry.npmjs.org/tailwindcss/4.3.3), [plugin](https://registry.npmjs.org/@tailwindcss%2fpostcss/4.3.3), [PostCSS](https://registry.npmjs.org/postcss/8.5.29); use the v4 PostCSS integration. | 2026-10-07 |
| Game | `phaser` **4.2.1** | Current stable [release](https://github.com/phaserjs/phaser/releases/tag/v4.2.1), [metadata](https://registry.npmjs.org/phaser/4.2.1). No React peer coupling. Repo does not lock a Phaser major or contain Phaser 3 code. | 2026-10-07 |
| Wallet hooks | `wagmi` **2.19.5** | Latest published stable 2.x observed; [metadata](https://registry.npmjs.org/wagmi/2.19.5). Deliberately not latest 3.7.7 because RainbowKit requires 2.x. | 2026-10-07 |
| Chain client | `viem` **2.57.3** | Current stable [metadata](https://registry.npmjs.org/viem/2.57.3), compatible with the wallet peers below. | 2026-10-07 |
| Standard-web wallet UI | `@rainbow-me/rainbowkit` **2.2.11** | Proposed UI; [metadata](https://registry.npmjs.org/@rainbow-me%2frainbowkit/2.2.11). Injected wallets and WalletConnect through the shared wagmi configuration; excluded from MiniPay connection UX. | 2026-10-07 |
| Remote state | `@tanstack/react-query` **5.104.1** | [Metadata](https://registry.npmjs.org/@tanstack%2freact-query/5.104.1) accepts React ^18 or ^19; meets wallet stack's >=5 peers. | 2026-10-07 |
| Local UI state | `zustand` **5.0.15** | [Metadata](https://registry.npmjs.org/zustand/5.0.15) accepts React >=18; optional middleware peers need not be added speculatively. | 2026-10-07 |
| Validation | `zod` **4.6.5** | [Metadata](https://registry.npmjs.org/zod/4.6.5), [requirements](https://zod.dev/); TypeScript >=5.5 tested, strict mode required. | 2026-10-07 |
| PWA | `serwist`, `@serwist/next`, `@serwist/cli` **9.5.13** each | [Runtime](https://registry.npmjs.org/serwist/9.5.13), [Next integration](https://registry.npmjs.org/@serwist%2fnext/9.5.13), [CLI](https://registry.npmjs.org/@serwist%2fcli/9.5.13); aligned stable versions for configurator mode. | 2026-10-07 |
| Worker build | `esbuild` **0.28.2** | [Metadata](https://registry.npmjs.org/esbuild/0.28.2); satisfies Serwist CLI >=0.25.0 <1.0.0. | 2026-10-07 |
| Unit tests | `vitest` **5.0.3**, `vite` **8.3.3** | [Vitest](https://registry.npmjs.org/vitest/5.0.3), [Vite](https://registry.npmjs.org/vite/8.3.3). Vite is the test tool dependency, not the Next.js application bundler. | 2026-10-07 |
| End-to-end tests | `@playwright/test` **1.63.0** | [Metadata](https://registry.npmjs.org/@playwright%2ftest/1.63.0); Node >=20, satisfies Next's optional Playwright ^1.51.1 peer. | 2026-10-07 |
| MiniPay | No npm package/version selected; injected EIP-1193 runtime | [Provider reference](https://docs.minipay.xyz/technical-references.md); use existing wagmi/viem stack, auto-connect and omit wallet picker. Minimum wallet/WebView version remains unresolved. | 2026-10-07 |
| Celo | Mainnet **42220** / Sepolia **11142220**; no separate SDK | [Network documentation](https://docs.celo.org/learn/network/overview); canonical Viem definitions and Celo fee handling. Protocol/test environment is not an npm semver. | 2026-10-07 |

For React component tests when added: `@vitejs/plugin-react` **6.1.2** ([metadata](https://registry.npmjs.org/@vitejs%2fplugin-react/6.1.2), Vite ^8), `jsdom` **30.1.2** ([metadata](https://registry.npmjs.org/jsdom/30.1.2), Node ^24.15 accepted), `@testing-library/react` **16.3.3** and `@testing-library/dom` **10.4.2** ([React](https://registry.npmjs.org/@testing-library%2freact/16.3.3), [DOM](https://registry.npmjs.org/@testing-library%2fdom/10.4.2)). React 19 and DOM 10 satisfy their peers. These are supporting test dependencies, not application runtime packages. Do not add optional compiler plugins, coverage/UI packages, or canvas packages without a concrete test need.

## Coupled compatibility and implementation constraints

### Next.js, React, TypeScript, styling, and game

- React 19.3.0 satisfies Next 16.4.0, React DOM, Query, RainbowKit, wagmi and Zustand peer ranges. Keep React and React DOM aligned. [Next installation](https://nextjs.org/docs/app/getting-started/installation) confirms App Router setup, TypeScript >=5.1 and Turbopack as default; Webpack requires explicit flags.
- Lock TypeScript and wagmi patches together and enable strict mode. This follows [wagmi 2.19.5's version-specific TypeScript guidance](https://github.com/wevm/wagmi/blob/wagmi%402.19.5/site/react/typescript.md). No claim of TypeScript 7 incompatibility is made; adopting it instead requires separate compiler/plugin verification.
- Follow [Tailwind's Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs): v4 PostCSS plugin and CSS import, not a copied v3 scaffold. [Browser requirements](https://tailwindcss.com/docs/compatibility) include Chrome 111, Safari 16.4 and Firefox 128. Slyce has no approved minimum WebView/browser matrix; confirm those floors against MiniPay devices before accepting v4 for the target audience.
- Phaser 4.2.1 is a current stable choice for an empty repository. Its release fixes ESM and parent-resize issues. Phaser [ships TypeScript definitions](https://docs.phaser.io/phaser/getting-started/installation); no React wrapper is required. Keep imports browser-only, lazy-load the game route and preserve the deterministic shared-package boundary. Phaser 3.90.0 also exists, but selecting it would need a specific compatibility reason; old Phaser 3 examples are not version-4 evidence. Renderer/performance behavior still needs real-device testing.
- [TanStack Query installation](https://tanstack.com/query/latest/docs/framework/react/installation) supports React 18+. Share its provider with wagmi; retain server/blockchain state there. [Zustand's Next.js guide](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md) requires request-safe stores and matching hydration state; React Server Components should not read/write global stores. Keep Zustand limited to the repository's local-UI responsibilities.

### wagmi, viem, wallet UI, and MiniPay

| Published package | Relevant constraints | Proposed intersection |
| --- | --- | --- |
| RainbowKit 2.2.11 | wagmi ^2.9.0; viem 2.x; React/DOM >=18; Query >=5 | wagmi 2.19.5 / viem 2.57.3 / React 19.3.0 / Query 5.104.1 |
| wagmi 2.19.5 | viem 2.x; React >=18; Query >=5; TS >=5.0.4 | Satisfied by table above |
| wagmi's internal packages | Exact `@wagmi/core` 2.22.1 and `@wagmi/connectors` 6.2.0; connectors require core 2.22.1 and viem 2.x | Let wagmi own these; do not independently install latest core/connectors |

Internal evidence: [core 2.22.1](https://registry.npmjs.org/@wagmi%2fcore/2.22.1), [connectors 6.2.0](https://registry.npmjs.org/@wagmi%2fconnectors/6.2.0).

**ADR-0001 selection, reconfirmed:** RainbowKit 2.2.11 with wagmi 2.19.5 is the standard-web option. Configure SSR and obtain a WalletConnect project ID as described by [RainbowKit](https://rainbowkit.com/en-US/docs/installation). Its unversioned installation command must not pull wagmi 3.

**Alternative checked:** Reown AppKit and its wagmi adapter **1.8.24** ([AppKit metadata](https://registry.npmjs.org/@reown%2fappkit/1.8.24), [adapter metadata](https://registry.npmjs.org/@reown%2fappkit-adapter-wagmi/1.8.24)) also fit wagmi 2.19.5/viem 2.57.3. Although adapter peers have broad lower bounds, [Reown's current Next guide](https://docs.reown.com/appkit/next/core/installation) prescribes wagmi 2.x and describes wagmi 3 support as beta. Do not infer stable wagmi 3 support from permissive peers. This alternative is not selected: ADR-0001 specifies RainbowKit. Do not add or substitute AppKit without a new architectural decision.

MiniPay needs no separate SDK package for the baseline. Its [technical reference](https://docs.minipay.xyz/technical-references.md) specifies an EIP-1193 injected provider and explicitly permits direct Viem usage. [Wallet connection](https://docs.minipay.xyz/getting-started/wallet-connection.html) requires automatic connection and prohibits message signing merely for site access/authentication. Detect `window.ethereum?.isMiniPay === true`, keep the picker out of that runtime, and handle connection errors. Current examples use wagmi 3's `useConnection`; adapt against the pinned wagmi 2 API, not by copying those snippets. The pinned [wagmi 2.19.5 injected connector](https://github.com/wevm/wagmi/blob/wagmi%402.19.5/packages/core/src/connectors/injected.ts) accepts an EIP-1193 provider and requests accounts. Together with MiniPay’s provider documentation this supports provider-level compatibility, not proof of full runtime behavior; this exact app stack has not been exercised in MiniPay.

[Transaction guidance](https://docs.minipay.xyz/technical-references/send-transaction.html) documents Celo `feeCurrency` handling, including different fee adapters for some stablecoins. MiniPay may choose another held stablecoin when the requested fee currency has only a dust balance. Do not assume G$ pays gas or a G$ balance alone makes a purchase possible. Validate the actual G$ contract-call/fee path on-device; no fee-token address is approved by this baseline. The pinned [Viem Celo chain configuration](https://github.com/wevm/viem/blob/viem%402.57.3/src/celo/chainConfig.ts) includes Celo-specific formatters, serializers and fees. Preserve that configuration instead of constructing an Ethereum-only chain object or imposing an unverified legacy transaction type.

### Next.js bundler and Serwist

Retain ADR-0001’s **Turbopack plus Serwist configurator mode** selection. [Official guide](https://serwist.pages.dev/docs/next/config): since 9.4, `@serwist/next/config` generates CLI configuration and a separate worker build runs after Next prerendering. This mode supports both bundlers; a separate `@serwist/turbopack` dependency is unnecessary. Proposed production sequence is `next build && serwist build`.

The classic `withSerwist` integration is tied to Webpack. Do not use it with a default Turbopack build. Serwist 9.5.13's Next >=14 / React >=18 / TS >=5 peers accept this proposal, and Node 24.21.0 meets CLI engines. Configurator mode automatically precaches prerendered routes: explicitly review/disable that with `precachePrerendered: false` where necessary, and use an allowlist for offline shell/assets. Do not copy `defaultCache` blindly over authoritative APIs, RPC, sessions, inventory, prices or rewards. Worker registration, offline behavior and deployment output remain build/runtime acceptance checks.

### Celo and GoodDollar

[Celo network documentation](https://docs.celo.org/learn/network/overview) and [MiniPay overview](https://docs.minipay.xyz/getting-started/overview.html) identify Celo mainnet **42220** and Celo Sepolia **11142220**. Sepolia replaces Alfajores; it is a fresh chain, not inherited state. No chain SDK/ContractKit dependency is required by the Viem approach. The pinned Viem release includes [Celo Sepolia configuration](https://github.com/wevm/viem/blob/viem%402.57.3/src/chains/definitions/celoSepolia.ts). Use canonical chain definitions; public Forno is best-effort/rate-limited, not a production SLA.

| GoodDollar package | Verified state | Proposal | Verified |
| --- | --- | --- | --- |
| `@goodsdks/citizen-sdk` **1.2.7** | [Metadata](https://registry.npmjs.org/@goodsdks%2fcitizen-sdk/1.2.7); published root exports include `IdentitySDK` and `ClaimSDK`. viem/wagmi peers are `*`, not a tested-version matrix. | Exact integration candidate, **defer installation/acceptance** until the MiniPay and environment questions below are resolved. Use the headless boundary already required by architecture. | 2026-10-07 |
| `@goodsdks/react-hooks` **1.0.3** | [Metadata](https://registry.npmjs.org/@goodsdks%2freact-hooks/1.0.3); published hooks use `usePublicClient`/`useWalletClient`, React dependency ^19.1.1, citizen SDK dependency `*`. | Optional later convenience layer. React 19.3 meets its range, but pin citizen SDK explicitly if adopted; avoid an uncontrolled SDK update. | 2026-10-07 |
| `@goodsdks/identity-sdk` **1.0.5** | [Metadata](https://registry.npmjs.org/@goodsdks%2fidentity-sdk/1.0.5); older package name still appears in official examples. | Do not install alongside citizen SDK to make stale snippets work. | 2026-10-07 |
| `@gooddollar/web3sdk-v2` **0.4.47** | [Metadata](https://registry.npmjs.org/@gooddollar%2fweb3sdk-v2/0.4.47); broad native/legacy dependencies, ethers 5.7.2, wagmi 2.x peers and another wallet stack. | Not needed for this proposed web-only headless integration; do not mix in the legacy ethers/useDapp setup. | 2026-10-07 |

GoodDollar's [token integration guide](https://docs.gooddollar.org/for-developers/developer-guides/how-to-integrate-the-gusd-token) describes ERC-677 `transferAndCall` and the receiver callback requirement. This supports investigating the repository's one-transaction design, but does not verify undeployed SliceShop/SliceTournament ABIs or receiver behavior. Token addresses/decimals must be verified per environment before contract work; this baseline intentionally does not approve addresses.

## Official GoodDollar documentation recheck — 2026-10-27

The current official [Identity (Viem/Wagmi)](https://docs.gooddollar.org/for-developers/apis-and-sdks/sybil-resistance/identity-viem-wagmi) page confirms:

- the documented package is `@goodsdks/citizen-sdk`
- identity environments expose production, staging, and development contracts for Celo and Fuse
- `generateFVLink(popupMode?, callbackUrl?, chainId?)` is the documented face-verification handoff
- identity status can be queried through whitelist/expiry methods

The current official [Claim UBI (Viem/Wagmi)](https://docs.gooddollar.org/for-developers/apis-and-sdks/ubi/claim-ubi-viem-wagmi) page still contains older `@goodsdks/identity-sdk/*` imports and documents `checkEntitlement()` as `bigint`, which conflicts with the published `@goodsdks/citizen-sdk` 1.2.7 root exports and inspected result types. The integration must therefore normalize the installed package's actual types behind an adapter; stale examples must not be copied.

The official [MiniPay wallet connection guidance](https://docs.minipay.xyz/getting-started/wallet-connection.html) confirms automatic provider connection and prohibits message signing merely for site access or authentication. It does not confirm that an explicit GoodDollar face-verification signature flow is supported in MiniPay. SDK installation, external verification calls, and claims remain blocked until provider signing policy, mobile callback behavior, supported environment, and real-device acceptance are confirmed.

## Unresolved conflicts and approval gates

1. **MiniPay session authentication — implementation blocker.** Original SIWE expectation conflicts with MiniPay's prohibition on message signing for access/authentication. Auto-connection/address discovery is not proof for a backend session. Preserve the existing separate-auth boundary; backend/security owners must approve a protocol. Research does not invent a replacement.
2. **GoodDollar documentation drift — integration blocker.** The [official claim guide](https://docs.gooddollar.org/for-developers/apis-and-sdks/ubi/claim-ubi-viem-wagmi) installs citizen SDK but imports older identity SDK subpaths and documents `checkEntitlement` as a bigint. Published 1.2.7 instead exports root SDK classes and returns `ClaimEntitlementResult` with `amount` and alternative-chain fields. Consult [version-associated source](https://github.com/GoodDollar/GoodSDKs/tree/b4d67d26f80cd5acc030c953d8074d9e1419b242/packages/citizen-sdk) and the published artifact/types. Normalize the actual result behind the app boundary; do not suppress type errors to fit the old guide. Wildcard peers do not prove full compatibility.
3. **GoodDollar identity inside MiniPay — unresolved.** Published 1.2.7 `generateFVLink` calls the wallet's `signMessage`; the claim flow may invoke face verification. MiniPay's no-sign-for-login rule does not by itself establish whether an explicit identity-verification signature is supported/allowed. Confirm provider signing capability, policy, mobile redirect/callback and claim behavior with official guidance and device validation before declaring Get G$ supported. Never substitute a server/private-key signer.
4. **GoodDollar test environment mismatch — integration blocker.** Published SDK constants support Celo 42220, Fuse 122 and XDC 50, not Celo Sepolia 11142220. Its `production`/`staging`/`development` selectors are protocol environments, not a switch to a Celo testnet. Confirm a supported non-production G$/identity/UBI deployment and funding/fee strategy; do not map mainnet addresses onto Sepolia. Also review SDK alternative-chain claim behavior against MiniPay's Celo-only networks.
5. **Browser/WebView floor — product decision needed.** Tailwind v4's documented browser floors must be accepted and checked on intended MiniPay Android/iOS devices. No minimum MiniPay WebView version was established here. Do not silently downgrade Tailwind or exclude older devices.
6. **GoodDollar package adoption — blocked by ADR-0001.** Citizen SDK 1.2.7 and optional React hooks 1.0.3 are research candidates only. Do not install them until the MiniPay identity and supported-environment gates are resolved and adoption is approved. The six numbered gates here now match ADR-0001.

Existing baseline choices do not need to be reinvented. Further decisions remain necessary for the MiniPay session protocol, GoodDollar adoption/adapter and environment strategy, and the supported browser/WebView matrix. Toolchain implementation still needs a package-manager choice and exact lint/format tool selection; these are not supplied as approved versions by ADR-0001 and must not be guessed. Existing backend schemas, application contract deployments/ABIs, and deterministic gameplay rules also remain future feature dependencies, not problems a dependency lock can solve.

## Compatibility coverage and stale guidance

| Chain | Phase 1 conclusion |
| --- | --- |
| Next.js ↔ React | Next 16.4.0 accepts React/DOM ^19; DOM 19.3.0 accepts React ^19.3.0. Exact pair retained. |
| Next bundler ↔ Serwist | Configurator mode supports Turbopack; aligned 9.5.13 packages and esbuild 0.28.2 satisfy published peers. Worker runs after Next build. |
| wagmi ↔ viem ↔ wallet UI | RainbowKit 2.2.11 + wagmi 2.19.5 + viem 2.57.3 + Query 5.104.1 satisfy direct peers. wagmi 3 is outside RainbowKit’s range. |
| wagmi/viem ↔ MiniPay | Pinned injected connector supports the documented provider contract; MiniPay examples use newer wagmi APIs. Device/session compatibility is not established. |
| wagmi/viem ↔ GoodDollar | SDK/hooks publish wildcard peers; exported Viem-based clients and hooks inspected. API/type compatibility is not compiler-tested, and MiniPay identity/environment gates remain. |
| MiniPay ↔ Celo transactions | Official network IDs and feeCurrency behavior confirmed; canonical Viem Celo chain support present. Actual G$ fee/payment path remains a device-test dependency. |

The original repository specification’s SIWE expectation cannot be applied to MiniPay login; this conflict remains unresolved, not silently redesigned. The repository does not mandate obsolete package majors or Alfajores. External examples using Alfajores, older GoodDollar import paths/bigint entitlement results, wagmi 3 hooks in a wagmi 2 build, Tailwind v3 configuration, or classic Webpack Serwist configuration must not be copied into this baseline. These are stale or mismatched instructions for Slyce, not a claim that every associated package is officially deprecated. Current Celo documentation replaces Alfajores with Sepolia; GoodDollar protocol staging/development remains a separate concern.

### Test-tool compatibility and limits

Vitest 5.0.3 requires Node ^22.12.0, ^24.0.0 or >=26 and Vite ^6.4, ^7 or ^8; Node 24.21.0 / Vite 8.3.3 satisfy both engines and peers. See [Vitest setup](https://vitest.dev/guide/). Use it for shared rules and synchronous units. [Next’s Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest) does not support async Server Component unit testing; use end-to-end coverage there.

Playwright 1.63.0 requires Node >=20. Keep its browser binaries aligned with that package when installation is authorized, and use real browser tests for routes, hydration, Phaser and service-worker behavior. [Playwright installation](https://playwright.dev/docs/intro) documents browser installation and host requirements; browser automation does not substitute for MiniPay-device tests. No browsers were installed during this research.

Supporting types match React 19 and Node 24. Component-test support packages listed above are selected for the official Next/Vitest testing pattern; plugin-react 6.1.2 requires Vite 8, jsdom 30.1.2 accepts Node ^24.15, and Testing Library React 16.3.3 accepts React/DOM 19 with DOM testing library 10.4.2. Optional compiler, canvas and coverage peers are not baseline requirements.

## Verification and exact next action

Research verification completed: every proposed exact version exists in official publisher metadata; selected direct peers/engines were compared; SDK published source/exports were reinspected in memory without installation or execution; citizen-sdk 1.2.7 and react-hooks 1.0.3 tarball SHA-512 hashes matched publisher metadata. All required technologies were covered. Package resolution, security audit of a resolved tree, strict typecheck, lint, unit tests, production build, worker/offline tests and MiniPay device tests were **not run**: there is no application or approved manifest, and installation/scaffolding was explicitly prohibited.

**Historical Phase 1 stop superseded on 2026-10-07:** the user authorized source implementation with the existing exact baseline, while explicitly prohibiting agent installation/dependency resolution and server startup. See [ADR-0002](../decisions/ADR-0002-workspace-package-manager.md), the [active plan](../exec-plans/active/current.md), and [handoff](../handoffs/CURRENT.md) for current work and verification limits. The user generates the lockfile. All six integration gates remain unresolved. Research-level peer compatibility is not production verification.
