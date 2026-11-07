import { expect, it } from 'vitest';
import { refetchUntil } from '../../src/web3/receipt';
it('re-reads until a lagging node shows the confirmed change', async () => {
  const answers = [0, 0, 1200];
  let calls = 0;
  const refetch = async () => ({ data: answers[Math.min(calls++, answers.length - 1)] });
  expect(await refetchUntil(refetch, score => (score ?? 0) >= 1200, 5, 0)).toBe(true);
  expect(calls).toBe(3);
});
it('gives up after the allowed attempts', async () => {
  let calls = 0;
  expect(await refetchUntil(async () => ({ data: calls++ }), () => false, 3, 0)).toBe(false);
  expect(calls).toBe(3);
});
