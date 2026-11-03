import { fruitKinds, type FruitKind } from './fruit-texture';
export const difficulties = ['easy', 'normal', 'hard'] as const;
export type Difficulty = typeof difficulties[number];
export interface PreviewSettings { difficulty: Difficulty; fruits: FruitKind[] }
/** Local practice pacing only. These values never govern scored or paid rounds. */
export const difficultyPacing = {
  easy: { maxFruit: 3, maxWave: 2, delay: 1.65, speed: .8 },
  normal: { maxFruit: 6, maxWave: 3, delay: 1.05, speed: 1 },
  hard: { maxFruit: 6, maxWave: 3, delay: .65, speed: 1.25 },
} satisfies Record<Difficulty, { maxFruit: number; maxWave: number; delay: number; speed: number }>;
/**
 * Pacing for the current score: rounds get busier as the player scores, so the game builds instead of plateauing.
 * Launch delay shrinks to 55% by 2,250 points; one extra fruit is allowed on screen at 300 and 800, a bigger wave at 500.
 */
export function pacingAt(difficulty: Difficulty, score: number): { maxFruit: number; maxWave: number; delay: number; speed: number } {
  const base = difficultyPacing[difficulty];
  return {
    maxFruit: base.maxFruit + (score >= 300 ? 1 : 0) + (score >= 800 ? 1 : 0),
    maxWave: base.maxWave + (score >= 500 ? 1 : 0),
    delay: base.delay * Math.max(.55, 1 - score / 5000),
    speed: base.speed * Math.min(1.15, 1 + score / 10000),
  };
}
export function defaultPreviewSettings(): PreviewSettings { return { difficulty: 'normal', fruits: [...fruitKinds] }; }
export function toggleFruit(settings: PreviewSettings, fruit: FruitKind): PreviewSettings {
  if (settings.fruits.includes(fruit)) return settings.fruits.length === 1 ? settings : { ...settings, fruits: settings.fruits.filter(item => item !== fruit) };
  return { ...settings, fruits: [...settings.fruits, fruit] };
}
