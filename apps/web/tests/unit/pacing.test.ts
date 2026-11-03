import { expect, it } from 'vitest';
import { difficultyPacing, pacingAt } from '../../src/game/preview-settings';
it('starts at the base pacing and gets busier as the score grows, within limits', () => {
  expect(pacingAt('normal', 0)).toEqual(difficultyPacing.normal);
  const at200 = pacingAt('normal', 200), at1000 = pacingAt('normal', 1000), at9000 = pacingAt('normal', 9000);
  expect(at200.delay).toBeLessThan(difficultyPacing.normal.delay);
  expect(at1000.maxFruit).toBe(difficultyPacing.normal.maxFruit + 2);
  expect(at1000.maxWave).toBe(difficultyPacing.normal.maxWave + 1);
  expect(at9000.delay).toBeCloseTo(difficultyPacing.normal.delay * .55);
  expect(at9000.speed).toBeCloseTo(difficultyPacing.normal.speed * 1.15);
  expect(at1000.delay).toBeLessThan(at200.delay);
});
