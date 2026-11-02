import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicPlayer } from '../../features/public-player';
export const metadata: Metadata = { title: 'Player', description: 'A Slyyce player’s record: XP, best score, games, streak and G$ earned.' };
export default function PlayerPage() { return <main id="main" className="stats-page"><Suspense><PublicPlayer /></Suspense></main>; }
