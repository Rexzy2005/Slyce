# Magic (magic-sdk) research

Verified 2026-11-02 against the installed package and official docs.

- **Package:** `magic-sdk` 33.13.0 (npm latest, published 2026-09-01). It depends on `@magic-sdk/provider` and `@magic-sdk/types` ^33/^27.
  - `@magiclabs/wagmi-connector` 2.3.2 pins `magic-sdk` 29.4.2, so we use a custom wagmi connector instead.
- **Constructor:** `new Magic(publishableKey, { network: { rpcUrl, chainId } })`. `CustomNodeConfiguration` is `{ rpcUrl, chainId?, chainType? }`. Celo is EVM, so a custom node works.
  - Source: https://docs.magic.link/embedded-wallets/sdk/client-side/javascript and https://magic.link/docs/blockchains/other-chains/evm/celo
- **Login:** `magic.auth.loginWithEmailOTP({ email, showUI?: true })` resolves to a DID token. `showUI: true` shows Magic's own code dialog.
  - Events include `email-otp-sent`, `login-throttled` and `invalid-email-otp` (types in `@magic-sdk/provider` `modules/auth.d.ts`).
- **User:**
  - `magic.user.isLoggedIn()` and `logout()` return `PromiEvent<boolean>`.
  - `getInfo()` returns `MagicUserMetadata` with `email` and `wallets.ethereum.publicAddress`. The flat `publicAddress` field was removed in v30.
- **Provider:** `magic.rpcProvider.request({ method, params })` takes JSON-RPC calls. We pass it to wagmi as the connector provider.
- **Pricing (unconfirmed for 2026):** magic.link/pricing lists a $0 Developer plan with 1,000 monthly active wallets and 50,000 signatures, and a $99/month Startup plan. Check the live page before scaling.
- **Unknown:** whether the dashboard shows a confirmation dialog on each transaction by default. Check the "transaction confirmation" setting in the Magic dashboard and test it on a phone.
