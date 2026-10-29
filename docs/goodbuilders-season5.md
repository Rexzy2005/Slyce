# GoodBuilders Season 5 — Slyyce Application

Draft following the Season 5 application structure. **(proposed)** numbers are to be aligned with the GoodBuilders team on Flow State. Fill in the `_TODO_` items before submitting.

## 1. Product

**Slyyce** is a mobile-first fruit-slicing arcade, an installable PWA on Celo mainnet built for everyday people, not crypto users. Players sign in with **email** (an embedded wallet is created automatically) or any wallet, play for free, save each game on Celo for XP, earn G$ for score milestones once verified, and compete in G$ bounties.

- Live app: _TODO: Vercel URL_
- Live on-chain stats (no sign-in): _TODO: Vercel URL_/stats
- Code: https://github.com/Rexzy2005/Slyyce

## 2. G$ integration

| Integration | How it works in Slyyce |
| --- | --- |
| **Face verification + UBI claim button** | The `/get-gd` tab runs GoodDollar verification and the daily UBI claim in-app (`@goodsdks/citizen-sdk`). New wallets get gas from the GoodDollar faucet. |
| **Identity SDK, used meaningfully** | G$ rewards and bounty entry are only for GoodDollar-verified humans, checked on-chain. Each identity is counted once, even across linked wallets. |
| **Rewards in G$ (play-to-earn)** | Free to play. Every round saved on Celo earns XP, and score milestones pay G$ (500 → 5, 1,000 → 15, 2,500 → 40, 5,000 → 100 G$), once per day per verified human, from a sponsor-funded pot. |
| **Bounties in G$** | Time-limited competitions that restart automatically, with G$ prize pools funded by Slyyce and sponsors. Winners claim on-chain. Blade cosmetics are sold in G$. |

## 3. Your product in action — one player's week

1. **Monday:** Ada signs in with her email and plays a free round. She saves it on Celo and earns her first XP.
2. **Tuesday:** she verifies with GoodDollar in under a minute, claims her daily G$, and hits the 1,000-point milestone for 20 G$.
3. **Wed–Sat:** she keeps her daily streak going, chases the next milestone, and joins this week's bounty.
4. **Sunday:** she places in the top three and claims her bounty prize, then buys a blade trail with G$ and shares her public profile.

**Reason to return (beyond rewards):** daily streaks, rising XP and personal bests, a bounty that always has a live leaderboard and countdown, the daily UBI claim in the same app, and quick, satisfying rounds on a phone.

**Goal (proposed):** 25% of verified players return each week.

**Use:** G$ is spent on cosmetics and sponsored into bounty pools.

**Goal (proposed):** 20,000 G$ used in-game over the season.

**Earn:** milestone rewards for verified humans, bounty prizes, and daily UBI claimed in-app.

**Goal (proposed):** 500 unique verified players earn G$ in-game over the season.

**Ideas:**
- G$ streak bonuses via **Superfluid streams**.
- A share of shop revenue to the **GoodDollar UBI Pool**.
- **GoodCollective** community bounty pools.
- Referral rewards for verified friends.
- Backend replay-verified scores for bigger rewards.

## 4. Season goals (proposed)

| Metric | 2 weeks | End of season |
| --- | --- | --- |
| GoodDollar-verified players | 100 | 1,000 |
| Weekly retention (verified) | 20% | 25% |
| Games recorded on Celo (`GameRecorded`) | 2,000 | 50,000 |
| G$ earned by players (`MilestoneRewarded` + `PrizeClaimed`) | 2,000 G$ | 50,000 G$ |
| Unique verified players earning G$ | 30 | 500 |
| Bounties run | 14 | 90 |

## 5. Season plan (two-week milestones)

1. Real-G$ contracts live, daily tournament every day, `/stats` public.
2. Winners decided from **server-verified scores**, using deterministic replay in the Slyyce backend.
3. Onboarding funnel (sign-in → verify → first round) measured and improved.
4. Streak rewards and referral rewards for verified humans.
5. Superfluid-streamed prizes; sponsor pools for community events.
6. A UBI Pool fee share, then a final Demo Day.

## 6. Data

- Chain: Celo mainnet (42220). G$: `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`.
- Contracts:
  - SlyceArcade `0xACbB0ABF3Cb485b64eB2707CF8E4B69AC25C43A6`
  - SlyceTournament `0xA4964F4D3143142a509932FF6EaB04005e319Baa`
  - SlyceShop `0x091606F02607222D5DF21DBf3C25939102528Cc1`

  All are UUPS proxies, owned by `0x3d642691BB7Dd4Fa1B37079010E8d96573fc69A3`.
- Tracking: the public `/stats` page reads contract state live. Events to index: `GameRecorded`, `MilestoneRewarded`, `Entered`, `ScoreSubmitted`, `ResultsPosted`, `PrizeClaimed`, `Purchased`.

## 7. Team

_TODO: names, roles and weekly hours._ We commit to two-week targets, weekly 1:1s, every Demo Day and progress updates on Flow State for the full season.
