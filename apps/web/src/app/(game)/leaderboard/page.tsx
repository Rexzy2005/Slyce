import type { Metadata } from 'next';
import { PageHeading } from '../../../components/ui';
import { Leaderboard } from '../../../features/leaderboard';
export const metadata: Metadata = { title: 'Leaderboard' };
export default function LeaderboardPage() { return <><PageHeading eyebrow="LEADERBOARD" title="Top slicers" /><Leaderboard /></>; }
