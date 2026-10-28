# GoodBuilders Season 5 — Slyce Application Draft

Draft for the team to edit. Numbers marked **(proposed)** are targets to agree with the GoodBuilders team. Contract addresses are filled in after the real-G$ deployment.

## Product

Slyce is a mobile-first fruit-slicing arcade PWA on Celo. Players sign in with email (embedded wallet) or any wallet, play quick rounds, and compete in a daily G$ prize tournament.

## What value it creates, and how G$ supports it

- **G$ is the game economy, not only checkout.** Every round costs 1 G$, and while the daily tournament is open that G$ goes straight into its prize pool (`SlyceArcade` → `SlyceTournament`). The best scores win the pool and claim it on-chain.
- **UBI → play → win loop.** New players verify with GoodDollar inside the app (`/get-gd`), claim daily G$ UBI and receive gas from the GoodDollar faucet. That G$ funds their rounds; winners take G$ home.
- **Spend:** cosmetic blade trails in G$ (`SlyceShop`). Sponsors and the team can top up any prize pool (`sponsor`).

## Why users come back (beyond rewards)

- A new daily tournament with a live, growing prize pool and a deadline.
- The daily GoodDollar UBI claim brings players back once a day; claiming and playing happen in the same app.
- Personal bests per difficulty, combos, and blade cosmetics to show off.
- Server-verified scores and leaderboards from the Slyce backend (deterministic replay).

## Season goals (proposed)

| Metric | 2 weeks | End of season |
| --- | --- | --- |
| GoodDollar-verified players | 100 | 1,000 |
| Weekly active players | 50 | 400 |
| D7 retention | 20% | 30% |
| Paid rounds (`SlyceArcade.totalRounds`) | 2,000 | 50,000 |
| G$ routed into prize pools | 2,000 G$ | 50,000 G$ |
| G$ paid out to winners (`PrizeClaimed`) | 1,500 G$ | 40,000 G$ |
| Daily tournaments run | 14 | 90 |

## Verifiable on-chain data (Celo mainnet, 42220)

Real G$: `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`

| Contract | Address |
| --- | --- |
| SlyceArcade | _fill after deploy_ |
| SlyceTournament | _fill after deploy_ |
| SlyceShop | _fill after deploy_ |

Events to track: `RoundPaid`, `PoolFundedByPlay`, `Entered`, `ScoreSubmitted`, `ResultsPosted`, `PrizeClaimed`, `Purchased`.

## Two-week targets (first cycle)

1. Real-G$ contracts live; daily tournament running every day.
2. Onboarding funnel: sign-in → GoodDollar verify → first paid round. Measure and fix drop-off.
3. Tournament results posted from backend-verified scores instead of self-reported ones.

## Commitment

Two-week targets, weekly 1:1s, every Demo Day, and progress updates on Flow State for the full season.
