import type { PointerInput, ReplayInput } from './index.js';
export type { ReplayInput } from './index.js';

export const verifiedFruitSliceRulesVersion = 'verified-fruit-slice-v1' as const;
export const verifiedFruitSliceGameMode = 'verified-fruit-slice' as const;

const roundDurationMs = 30_000;
const spawnIntervalMs = 1_000;
const targetLifetimeMs = 900;
const startingLives = 3;
const fruitPoints = 10;
const comboMinimum = 3;
const comboBonusPerFruit = 5;
const bombChance = 0.14;

export interface VerifiedFruitSliceTarget {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly bomb: boolean;
  readonly spawnedAt: number;
}

export interface VerifiedFruitSliceResult {
  readonly score: number;
  readonly lives: number;
  readonly bestCombo: number;
  readonly targetsCut: number;
  readonly bombsCut: number;
  readonly gameOverCause: 'bomb' | 'lives' | 'time';
}

export function canonicalReplayInputs(inputs: readonly ReplayInput[]): string {
  return JSON.stringify(inputs);
}

function seedState(seed: string): number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0 || 1;
}

function nextRandom(state: number): { state: number; value: number } {
  let next = state;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { state: next || 1, value: (next || 1) / 4294967296 };
}

export function verifiedFruitSliceTargets(seed: string): VerifiedFruitSliceTarget[] {
  let state = seedState(seed);
  const targets: VerifiedFruitSliceTarget[] = [];
  for (let index = 0; index < roundDurationMs / spawnIntervalMs; index += 1) {
    const x = nextRandom(state); state = x.state;
    const y = nextRandom(state); state = y.state;
    const radius = nextRandom(state); state = radius.state;
    const bomb = nextRandom(state); state = bomb.state;
    targets.push({
      x: 0.12 + x.value * 0.76,
      y: 0.15 + y.value * 0.7,
      radius: 0.055 + radius.value * 0.025,
      bomb: bomb.value < bombChance,
      spawnedAt: index * spawnIntervalMs,
    });
  }
  return targets;
}

function validPointerInput(input: PointerInput): boolean {
  return Number.isInteger(input.elapsedMs)
    && input.elapsedMs >= 0
    && input.elapsedMs <= roundDurationMs
    && Number.isFinite(input.x)
    && input.x >= 0
    && input.x <= 1
    && Number.isFinite(input.y)
    && input.y >= 0
    && input.y <= 1;
}

function distanceToSegment(point: { x: number; y: number }, start: PointerInput, end: PointerInput): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

function cutTargets(targets: Array<VerifiedFruitSliceTarget & { cut: boolean; expired: boolean }>, start: PointerInput, end: PointerInput): Array<VerifiedFruitSliceTarget & { cut: boolean; expired: boolean }> {
  return targets.filter(target =>
    !target.cut
    && !target.expired
    && target.spawnedAt <= end.elapsedMs
    && end.elapsedMs <= target.spawnedAt + targetLifetimeMs
    && distanceToSegment(target, start, end) <= target.radius,
  );
}

export function simulateVerifiedFruitSlice(seed: string, inputs: readonly ReplayInput[]): VerifiedFruitSliceResult {
  const targets = verifiedFruitSliceTargets(seed).map(target => ({ ...target, cut: false, expired: false }));
  let lives = startingLives;
  let score = 0;
  let bestCombo = 0;
  let targetsCut = 0;
  let bombsCut = 0;
  let over: VerifiedFruitSliceResult['gameOverCause'] | null = null;
  let pointerDown: PointerInput | null = null;
  let lastElapsedMs = 0;

  for (const input of inputs) {
    if (input.kind !== 'pointer' || !validPointerInput(input) || input.elapsedMs < lastElapsedMs) {
      throw new Error('Replay inputs must be ordered pointer events with normalized coordinates.');
    }
    lastElapsedMs = input.elapsedMs;
    for (const target of targets) {
      if (!target.cut && !target.expired && target.spawnedAt + targetLifetimeMs < input.elapsedMs) {
        target.expired = true;
        if (!target.bomb) {
          lives -= 1;
          if (lives <= 0) over = 'lives';
        }
      }
    }
    if (over) break;
    if (input.phase === 'down') pointerDown = input;
    if (input.phase === 'up' && pointerDown) {
      const cuts = cutTargets(targets, pointerDown, input);
      let combo = 0;
      for (const target of cuts) {
        target.cut = true;
        combo += 1;
        if (target.bomb) {
          bombsCut += 1;
          over = 'bomb';
          break;
        }
        targetsCut += 1;
        score += fruitPoints;
      }
      if (!over && combo >= comboMinimum) {
        score += combo * comboBonusPerFruit;
        bestCombo = Math.max(bestCombo, combo);
      }
      pointerDown = null;
    }
  }

  if (!over) {
    for (const target of targets) {
      if (!target.cut && !target.expired && !target.bomb) {
        lives -= 1;
        if (lives <= 0) {
          over = 'lives';
          break;
        }
      }
    }
  }

  return { score, lives: Math.max(0, lives), bestCombo, targetsCut, bombsCut, gameOverCause: over ?? 'time' };
}
