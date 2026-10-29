'use client';
import Link from 'next/link';
import { gdDecimals } from '../web3/config';
import { useWallet } from '../web3/context';
import { formatTokenAmount } from '../web3/units';
import { useGameRecords, type Milestone } from '../game/game-records';
/** Rules page, sign-in free. Milestone rewards are read live from the contract. */
export function HowToPlay() {
  const wallet = useWallet();
  return <article className="stats how-to-play">
    <Link href="/play" className="brand">slyce<span className="brand-dot">/</span></Link>
    <h1>How to play</h1>
    <h2>Slice</h2>
    <p>Swipe across fruit to slice it. Each fruit is 10 points, and slicing 3 or more in one swipe adds a combo bonus. Avoid bombs: one hit ends the round. Miss three fruit and it's game over. Playing is free.</p>
    <h2>Save your game on Celo</h2>
    <p>When a round ends, tap <strong>Save on Celo</strong>. Your score is recorded on-chain as a permanent record, and you earn <strong>1 XP for every 10 points</strong>. You need to be signed in (email or wallet), plus a little CELO for the network fee. You don't need to verify unless you want G$ rewards.</p>
    <h2>Milestone rewards in G$</h2>
    <p>Reach these scores in a single round to earn G$, each milestone once per day:</p>
    {wallet.live ? <MilestoneList /> : <p className="muted">Live rewards appear here once Celo is connected.</p>}
    <h2>Verify with GoodDollar</h2>
    <p>GoodDollar (G$) is a universal basic income token with real value. To earn G$ rewards and enter bounties, verify once with GoodDollar's identity system (one face, one wallet). It takes under a minute on the <Link href="/get-gd">Get G$</Link> tab, and you can then claim free G$ every day. Without verification you can still play and earn XP, but no G$ is sent to you and you can't enter bounties.</p>
    <h2>Bounties</h2>
    <p>Bounties are time-limited competitions with real G$ prize pools. A new one starts automatically when the last ends. Verified players enter on the <Link href="/tournament">Compete</Link> tab, play during the bounty, and submit their best score. When it closes, prizes go to the top finishers, who claim them on the Rewards tab.</p>
    <h2>Your profile</h2>
    <p>Your profile shows your total XP, best score, games played, current daily streak and G$ earned, all read from Celo. Profiles are public and shareable: send your profile link to friends.</p>
    <Link className="button" href="/play/arena">Start slicing</Link>
  </article>;
}
function MilestoneList() {
  const records = useGameRecords(undefined);
  if (records.loading) return <p className="loading-state" role="status">Reading rewards…</p>;
  if (!records.milestones.length) return <p className="muted">Milestone rewards are not set yet.</p>;
  return <ul className="milestones">{records.milestones.map((m: Milestone) => <li key={m.score}><span>Score {m.score.toLocaleString()}</span><strong className="leaf">{formatTokenAmount(m.reward, gdDecimals)} G$</strong></li>)}</ul>;
}
