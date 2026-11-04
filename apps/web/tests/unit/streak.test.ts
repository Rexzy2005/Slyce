import { expect, it } from 'vitest';
import { liveStreak, utcDay, type PlayerStats } from '../../src/game/game-records';
const stats = (streak: number, lastDay: number): PlayerStats => ({ xp: 0n, bestScore: 0, games: 3, streak, lastDay, earned: 0n });
it('shows the streak as it stands today and what a save today would make it', () => {
  const today = 20761;
  expect(liveStreak(stats(2, today), today)).toEqual({ current: 2, savedToday: true, next: 2 });
  expect(liveStreak(stats(2, today - 1), today)).toEqual({ current: 2, savedToday: false, next: 3 });
  expect(liveStreak(stats(5, today - 3), today)).toEqual({ current: 0, savedToday: false, next: 1 });
  expect(liveStreak(undefined, today)).toEqual({ current: 0, savedToday: false, next: 1 });
  expect(utcDay(Date.UTC(2026, 10, 3, 23, 59))).toBe(20760);
});
