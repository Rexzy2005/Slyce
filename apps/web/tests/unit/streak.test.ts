import { expect, it } from 'vitest';
import { liveStreak, utcDay, type PlayerStats } from '../../src/game/game-records';
const stats = (streak: number, lastDay: number): PlayerStats => ({ xp: 0n, bestScore: 0, games: 3, streak, lastDay, earned: 0n, lastSubmit: 0 });
it('shows the streak as it stands today and what a save today would make it', () => {
  const today = 20761;
  expect(liveStreak(stats(2, today), today)).toEqual({ current: 2, savedToday: true, next: 2 });
  expect(liveStreak(stats(2, today - 1), today)).toEqual({ current: 2, savedToday: false, next: 3 });
  expect(liveStreak(stats(5, today - 3), today)).toEqual({ current: 0, savedToday: false, next: 1 });
  expect(liveStreak(undefined, today)).toEqual({ current: 0, savedToday: false, next: 1 });
  expect(utcDay(Date.UTC(2026, 10, 3, 23, 59))).toBe(20760);
});

it('names milestones by position and finds the highest one reached', async () => {
  const { milestoneName, topMilestone } = await import('../../src/game/game-records');
  const milestones = [{ score: 500, reward: 0n }, { score: 1000, reward: 0n }, { score: 2500, reward: 0n }];
  expect(milestones.map(m => milestoneName(milestones, m))).toEqual(['Sharp Starter', 'Juice Master', 'Orchard Hero']);
  expect(topMilestone(milestones, 1200)?.score).toBe(1000);
  expect(topMilestone(milestones, 400)).toBeUndefined();
});
