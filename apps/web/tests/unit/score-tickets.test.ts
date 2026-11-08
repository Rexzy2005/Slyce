import { expect, it, vi } from 'vitest';
import { createTicketQueue, type RoundTicket } from '../../src/game/score-tickets';
const ticket = (n: number, issuedAt: number): RoundTicket => ({ token: `t${n}`, ticket: String(n), issuedAt });
it('hands each round a prefetched ticket and fetches the next one', async () => {
  let n = 0; const now = 1_000_000;
  const request = vi.fn(async () => ticket(++n, now));
  const queue = createTicketQueue('0xabc', request, () => now);
  queue.prefetch(); queue.prefetch();
  expect(request).toHaveBeenCalledTimes(1);
  expect((await queue.take())?.ticket).toBe('1');
  expect((await queue.take())?.ticket).toBe('2');
  expect(request).toHaveBeenCalledTimes(3);
});
it('replaces a stale ticket and survives a failed request', async () => {
  let n = 0; let now = 0;
  const request = vi.fn(async () => { n++; if (n === 2) throw new Error('offline'); return ticket(n, now); });
  const queue = createTicketQueue('0xabc', request, () => now);
  queue.prefetch();
  now = 25 * 60_000;
  expect((await queue.take())?.ticket).toBe('3');
  // The prefetch for this round failed, so it asks again rather than playing unchecked.
  expect((await queue.take())?.ticket).toBe('5');
});
