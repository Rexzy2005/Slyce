// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cutBomb, cutFruit, endSwipe, missFruit, newPractice, startingLives } from '../../src/game/practice-rules';
import { readBestScore, recordBestScore } from '../../src/game/best-score';
describe('practice rules', () => {
  it('scores fruit and awards a combo bonus for three or more in one swipe', () => {
    let state = cutFruit(cutFruit(newPractice()));
    let result = endSwipe(state);
    expect(result).toMatchObject({ combo: 2, bonus: 0 });
    expect(result.state.score).toBe(20);
    state = cutFruit(cutFruit(cutFruit(result.state)));
    result = endSwipe(state);
    expect(result).toMatchObject({ combo: 3, bonus: 15 });
    expect(result.state).toMatchObject({ score: 65, swipeCuts: 0, bestCombo: 3 });
  });
  it('ends the round when lives run out', () => {
    let state = newPractice();
    for (let i = 1; i < startingLives; i++) state = missFruit(state);
    expect(state).toMatchObject({ lives: 1, over: null });
    state = missFruit(state);
    expect(state).toMatchObject({ lives: 0, over: 'lives' });
    expect(missFruit(state)).toBe(state);
  });
  it('takes a life on a bomb and only ends the round on the last life', () => {
    let state = cutBomb(cutFruit(newPractice()));
    expect(state).toMatchObject({ lives: startingLives - 1, over: null, score: 10 });
    for (let i = 1; i < startingLives; i++) state = cutBomb(state);
    expect(state).toMatchObject({ lives: 0, over: 'bomb' });
    expect(cutFruit(state)).toBe(state);
    expect(endSwipe(state).bonus).toBe(0);
  });
});
describe('best score', () => {
  afterEach(() => window.localStorage.clear());
  it('records only improvements per difficulty', () => {
    expect(readBestScore('normal')).toBeNull();
    expect(recordBestScore('normal', 40)).toEqual({ best: 40, improved: true });
    expect(recordBestScore('normal', 30)).toEqual({ best: 40, improved: false });
    expect(readBestScore('hard')).toBeNull();
  });
});
