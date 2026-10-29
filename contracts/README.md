# Slyce Contracts

UUPS-upgradeable `SlyceShop`, `SlyceTournament` and `SlyceArcade` on a shared `SlyceBase` (see `docs/decisions/ADR-0005-app-shell-signin-upgradeable.md`). Foundry, Solidity 0.8.28 (Cancun), OpenZeppelin 5.6.1. **Not externally audited. Keep pools small and use a multisig owner.**

| Contract | Purpose |
| --- | --- |
| `SlyceArcade` | `play(maxFee)` charges the per-round G$ fee, which goes into the open daily prize pool (else the treasury). See ADR-0007. |
| `SlyceShop` | Cosmetic blade trails; G$ to treasury; on-chain ownership. |
| `SlyceTournament` | Entry fees, sponsorship, self-reported scores, operator-posted Merkle prizes, cancel + full refunds. |

Safety properties:
- Balance-delta transfer checks.
- Hard bounds on prices, fees, durations and scores.
- ERC-7201 storage.
- Two-step ownership, with renounce disabled.
- Pause blocks new money in but never blocks claims or refunds.
- `rescue` can't touch funds owed to players.

## Current deployment (Celo mainnet, 42220)

Deployed 2026-10-29 with **real G$** (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`), contracts v1.2.0. Owner and treasury: `0x3d642691BB7Dd4Fa1B37079010E8d96573fc69A3`. Play fee 1 G$, which goes into the open prize pool (ADR-0007). Blades 101/102/103 cost 100/100/150 G$. Tournament entry requires a GoodDollar-verified human (Identity `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42`, ADR-0008).

| Contract | Proxy (use in the app) |
| --- | --- |
| SlyceShop | `0x091606F02607222D5DF21DBf3C25939102528Cc1` |
| SlyceTournament | `0xA4964F4D3143142a509932FF6EaB04005e319Baa` |
| SlyceArcade | `0xACbB0ABF3Cb485b64eB2707CF8E4B69AC25C43A6` |

The obsolete development-G$ deployment (2026-10-25) is unused: shop `0x33d52a95…27f153`, tournament `0x5244A368…815056`, arcade `0x5BB9ec89…e698F3`, plus an unused shop at `0x7d21725a…a1ece3`.

Player gas with v1.1.0 (ADR-0006), measured on a Celo fork at a 200 gwei base fee:

| Action | Gas | CELO |
| --- | --- | --- |
| Play a round | 239k | 0.048 |
| Buy a blade | 249k | 0.050 |
| Enter a tournament | 316k | 0.063 |
| Approve G$ (once per 10 rounds) | 51k | 0.010 |

## Setup and test

```bash
cd contracts
forge install --no-git foundry-rs/forge-std@v1.17.0 OpenZeppelin/openzeppelin-contracts@v5.6.1
# Upgradeable library: the npm release is identical and much faster than a recursive clone.
mkdir -p lib/openzeppelin-contracts-upgradeable && curl -sL https://registry.npmjs.org/@openzeppelin/contracts-upgradeable/-/contracts-upgradeable-5.6.1.tgz | tar xz -C lib/openzeppelin-contracts-upgradeable --strip-components=1
forge test                                            # 57 unit/fuzz/invariant/upgrade tests
CELO_RPC_URL=https://forno.celo.org forge test        # + fork test against real G$
forge clean && forge build && npx @openzeppelin/upgrades-core@1.46.0 validate out/build-info   # upgrade safety
```

`lib/` is gitignored. If `forge install` puts `lib/` at the repo root, move it into `contracts/lib/`.

## Deploy (Celo mainnet)

You need CELO for gas. The G$ token must match `NEXT_PUBLIC_GOODDOLLAR_ENV` (`docs/research/gooddollar.md`).

```bash
cast wallet import slyce-owner --interactive          # encrypted keystore; never commit keys
GD_TOKEN=0x... TREASURY=0x... IDENTITY=0xC361A6E67822a0EDc17D899227dd9FC50BD62F42 PLAY_FEE=1000000000000000000 [OWNER=0xMultisig] \
  forge script script/Deploy.s.sol --rpc-url https://forno.celo.org --account slyce-owner --broadcast
```

The script prints three **proxy** addresses. Those are what the app uses. If `OWNER` is set, that account must call `acceptOwnership()` on each contract.

Set these in Vercel (see `.env.example`): `NEXT_PUBLIC_SHOP_ADDRESS`, `NEXT_PUBLIC_TOURNAMENT_ADDRESS`, `NEXT_PUBLIC_ARCADE_ADDRESS`, `NEXT_PUBLIC_GD_ADDRESS`, `NEXT_PUBLIC_GOODDOLLAR_ENV`, `NEXT_PUBLIC_NETWORK=celo`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

Admin calls:

```bash
cast send $ARCADE "setPlayFee(uint128)" <wei> --account slyce-owner --rpc-url $RPC
cast send $SHOP "setItem(uint256,uint128,uint32,bool)" 101 <wei> 1 true --account slyce-owner --rpc-url $RPC
cast send $CONTRACT "pause()" --account slyce-owner --rpc-url $RPC
```

## Upgrade

1. Change the contract, keeping storage in its ERC-7201 struct and only appending fields. Bump `version()`.
2. Run the tests and the upgrades-core validation above.
3. Run: `PROXY=0x... CONTRACT=Shop|Tournament|Arcade forge script script/Upgrade.s.sol --rpc-url $RPC --account slyce-owner --broadcast`.
4. Then: `node script/export-abis.mjs`. Redeploy the web app if the ABI changed.

## Run the daily tournament

Create one every day. It becomes the prize tournament automatically (`PRIZE=1`), and entry is free by default because the pool is funded by play fees:

```bash
TOURNAMENT=0x... DURATION=86400 forge script script/CreateTournament.s.sol --rpc-url https://forno.celo.org --account slyce-owner --broadcast --with-gas-price 205gwei --priority-gas-price 3gwei
```

## Run a tournament

```bash
TOURNAMENT=0x... ENTRY_FEE=10000000000000000000 DURATION=86400 [MAX_ENTRANTS=100] \
  forge script script/CreateTournament.s.sol --rpc-url https://forno.celo.org --account slyce-owner --broadcast
```

It starts 60 seconds after the transaction. After it ends, run this from `apps/web` with Node 24:

```bash
RPC_URL=https://forno.celo.org TOURNAMENT=0x... ID=1 FROM_BLOCK=<creation block> SHARES=50,30,20 node scripts/tournament-results.ts
```

1. Review the ranking. Scores are self-reported.
2. Run the printed `postResults` command.
3. Commit `apps/web/public/tournaments/<id>.json` and redeploy.

If something goes wrong before results, call `cancelTournament(id)`. Every entrant and sponsor can then claim a full refund from the Tournament page.
