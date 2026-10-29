# GoodBuilders Season 5 — Slyce Application

Draft following the Season 5 application structure. **(proposed)** numbers are to be aligned with the GoodBuilders team on Flow State. Fill in the `_TODO_` items before submitting.

## 1. Product

**Slyce** is a mobile-first fruit-slicing arcade, an installable PWA on Celo mainnet built for everyday people, not crypto users. Players sign in with **email** (an embedded wallet is created automatically) or any wallet, play 30-second rounds, and compete in a **daily G$ prize tournament**.

- Live app: _TODO: Vercel URL_
- Live on-chain stats (no sign-in): _TODO: Vercel URL_/stats
- Code: https://github.com/Rexzy2005/Slyce

## 2. G$ integration

Slyce uses four of the six Season 5 integration paths:

| Integration | How it works in Slyce |
| --- | --- |
| **Face verification + UBI claim button** | The `/get-gd` tab runs the GoodDollar verification flow and a daily UBI claim inside the app (`@goodsdks/citizen-sdk`). New wallets get CELO for gas from the GoodDollar faucet. |
| **Identity SDK, used meaningfully** | Only GoodDollar-verified humans can enter prize tournaments, checked on-chain via the Identity contract. Each identity gets one entry per tournament, even across linked wallets, so bots and farmers can't drain pools. |
| **Pay in G$, with a purpose** | Every round costs 1 G$, and that G$ goes straight into today's prize pool, not to us. Players pay into a pot they can win. |
| **Rewards in G$** | Daily winners claim the pool on-chain (Merkle claims). Anyone can sponsor a pool in G$. Cosmetic blade trails are sold in G$. |

## 3. Your product in action — one player's week

1. **Monday:** Ada signs in with her email, verifies with GoodDollar in under a minute, and claims her first daily G$. She also gets free gas.
2. **Tue–Sat:** each day she claims UBI and plays a few rounds (1 G$ each), watching today's prize pool grow with every round anyone plays. She posts her best score.
3. **Thursday:** she finishes 2nd and claims 30% of that day's pool in G$.
4. **Weekend:** she spends G$ on a blade trail to show off.

**Reason to return (beyond rewards):** a fresh daily tournament with a live pool and a countdown; the daily UBI claim lives in the same app; personal bests, combos and cosmetics; and quick, satisfying rounds on a phone.

**Goal (proposed):** 25% of verified players return in a given week (W1 → W4 weekly retention ≥ 25%).

**Use:** 1 G$ per round goes into the prize pool; cosmetics are bought in G$; pools can be sponsored in G$.

**Goal (proposed):** 50,000 G$ used in-game over the season (rounds + shop + sponsorship).

**Earn:** top daily scores win the pool, split 50/30/20; plus daily UBI claimed in-app.

**Goal (proposed):** 300 unique verified players win G$ prizes over the season.

**Ideas:**
- Stream prize pools to winners with **G$ Superfluid streams**.
- Route a share of play fees to the **GoodDollar UBI Pool**.
- Community-funded challenge pools via **GoodCollective**.
- Referral rewards for verified friends.

## 4. Season goals (proposed)

| Metric | 2 weeks | End of season |
| --- | --- | --- |
| GoodDollar-verified players | 100 | 1,000 |
| Weekly retention (verified) | 20% | 25% |
| Paid rounds (`SlyceArcade.totalRounds`) | 2,000 | 50,000 |
| G$ routed into prize pools (`PoolFundedByPlay`) | 2,000 G$ | 50,000 G$ |
| Unique prize winners (`PrizeClaimed`) | 20 | 300 |
| Daily tournaments run | 14 | 90 |

## 5. Season plan (two-week milestones)

1. Real-G$ contracts live, daily tournament every day, `/stats` public.
2. Winners decided from **server-verified scores**, using deterministic replay in the Slyce backend.
3. Onboarding funnel (sign-in → verify → first round) measured and improved.
4. Streak rewards and referral rewards for verified humans.
5. Superfluid-streamed prizes; sponsor pools for community events.
6. A UBI Pool fee share, then a final Demo Day.

## 6. Data

- Chain: Celo mainnet (42220). G$: `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`.
- Contracts: SlyceArcade _TODO_, SlyceTournament _TODO_, SlyceShop _TODO_ (see `contracts/README.md`).
- Tracking: the public `/stats` page reads contract state live. Events to index: `RoundPaid`, `PoolFundedByPlay`, `Entered`, `ScoreSubmitted`, `ResultsPosted`, `PrizeClaimed`, `Purchased`.

## 7. Team

_TODO: names, roles and weekly hours._ We commit to two-week targets, weekly 1:1s, every Demo Day and progress updates on Flow State for the full season.
