import type { Metadata } from 'next';
import { HowToPlay } from '../../features/how-to-play';
export const metadata: Metadata = { title: 'How to play', description: 'Slice fruit, earn XP, reach milestones, claim free G$ daily and compete in tournaments.' };
export default function HowToPlayPage() { return <main id="main" className="stats-page"><HowToPlay /></main>; }
