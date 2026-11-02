import type { Metadata } from 'next';
import { PublicStats } from '../../features/public-stats';
export const metadata: Metadata = { title: 'Live stats', description: 'Slyyce live stats: games played, G$ paid to players and prize pools.' };
export default function StatsPage() { return <main id="main" className="stats-page"><PublicStats /></main>; }
