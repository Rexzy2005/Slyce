'use client';
import Link from 'next/link';
import { Icon } from '../components/icon';
import { useWallet } from '../web3/context';
import { milestoneName, useGameRecords, type Milestone } from '../game/game-records';
/** Rules page, sign-in free. Milestones are read live from the contract. Players get G$ from the daily GoodDollar claim and tournaments, not milestones. */
export function HowToPlay() {
  const wallet = useWallet();
  return <article className="stats how-to-play">
    <Link href="/play" className="brand">slyyce<span className="brand-dot">/</span></Link>
    <h1>How to play</h1>
    <h2>Slice</h2>
    <p>Swipe across fruit to slice it. Each fruit is 10 points, and slicing 3 or more in one swipe adds a combo bonus. You have 3 lives: slicing a bomb or missing a fruit costs one, and the round ends when they're gone. Playing is free.</p>
    <h2>Save your score</h2>
    <p>When a round ends, your score saves automatically as a permanent record, and you earn <strong>1 XP for every 10 points</strong>.</p>
    <h2>Milestones</h2>
    <p>Reach these scores in a single round to earn the milestone's title:</p>
    {wallet.live ? <MilestoneList /> : <p className="muted">Milestones appear here once you're signed in.</p>}
    <h2>Get G$ as a real person</h2>
    <p>Anyone can play for free. Verify once with GoodDollar (a quick face check that takes under a minute, one person per account) to claim free G$, GoodDollar's universal basic income, every day on the <Link href="/get-gd">Get G$</Link> tab, and to enter tournaments for G$ prizes. Already verified? Sign in with that same wallet using the Wallet tab.</p>
    <h2>Bounties</h2>
    <p>Bounties are time-limited competitions with real G$ prize pools. A new one starts automatically when the last ends. Enter on the <Link href="/tournament">Compete</Link> tab, play during the bounty, and submit their best score. When it closes, prizes go to the top finishers, who claim them on the Rewards tab.</p>
    <h2>Daily streak</h2>
    <p>Save at least one score each day to grow your streak. Several rounds on the same day count once, and missing a day starts it again from 1. Days run on UTC time.</p>
    <h2>Your profile</h2>
    <p>Your profile shows your total XP, best score, games played, current daily streak and G$ earned. Profiles are public and shareable: send your profile link to friends.</p>
    <Link className="button" href="/play/arena">Start slicing</Link>
  </article>;
}
function MilestoneList() {
  const records = useGameRecords(undefined);
  if (records.loading) return <p className="loading-state" role="status">Reading milestones…</p>;
  if (!records.milestones.length) return <p className="muted">Milestones are not set yet.</p>;
  return <ul className="milestones">{records.milestones.map((m: Milestone) => <li key={m.score}><span><strong><Icon name="trophy" size={16} /> {milestoneName(records.milestones, m)}</strong></span><strong>{m.score.toLocaleString()} points</strong></li>)}</ul>;
}
