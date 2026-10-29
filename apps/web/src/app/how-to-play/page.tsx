import type { Metadata } from 'next';
import { HowToPlay } from '../../features/how-to-play';
export const metadata: Metadata = { title: 'How to play', description: 'Slice fruit, earn XP, reach milestones for G$, and compete in bounties on Celo.' };
export default function HowToPlayPage() { return <main id="main" className="stats-page"><HowToPlay /></main>; }
