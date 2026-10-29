import type { Difficulty } from './preview-settings';
/**
 * Local practice rules (ADR-0003). Scores are unverified, stay on this device and never
 * become leaderboard, tournament or reward results.
 */
export const startingLives = 3;
export const fruitPoints = 10;
export const comboMinimum = 3;
export const comboBonusPerFruit = 5;
export const bombChance: Record<Difficulty, number> = { easy: .08, normal: .14, hard: .2 };
export type GameOverCause = 'bomb' | 'lives';
export interface PracticeState {
  readonly score: number;
  readonly lives: number;
  /** Fruit cut during the current swipe. */
  readonly swipeCuts: number;
  readonly bestCombo: number;
  /** Fruit sliced this round. */
  readonly fruits: number;
  readonly over: GameOverCause | null;
}
export function newPractice(): PracticeState { return { score: 0, lives: startingLives, swipeCuts: 0, bestCombo: 0, fruits: 0, over: null }; }
export function cutFruit(state: PracticeState): PracticeState {
  if (state.over) return state;
  return { ...state, score: state.score + fruitPoints, swipeCuts: state.swipeCuts + 1, fruits: state.fruits + 1 };
}
/** Ends a swipe; three or more fruit in one swipe award a combo bonus. */
export function endSwipe(state: PracticeState): { state: PracticeState; combo: number; bonus: number } {
  const combo = state.swipeCuts;
  const bonus = !state.over && combo >= comboMinimum ? combo * comboBonusPerFruit : 0;
  return { state: { ...state, score: state.score + bonus, swipeCuts: 0, bestCombo: bonus ? Math.max(state.bestCombo, combo) : state.bestCombo }, combo, bonus };
}
export function missFruit(state: PracticeState): PracticeState {
  if (state.over) return state;
  const lives = Math.max(0, state.lives - 1);
  return { ...state, lives, over: lives === 0 ? 'lives' : null };
}
export function cutBomb(state: PracticeState): PracticeState { return state.over ? state : { ...state, over: 'bomb' }; }
