// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { catalogItems, itemPreview, readEquipped, writeEquipped } from '../../src/features/catalog';
afterEach(() => window.localStorage.clear());
it('lists each shop id once, matching the on-chain listing script', () => {
  const ids = catalogItems.map(item => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual([101n, 102n, 103n, 104n, 105n, 106n, 107n, 201n, 202n, 203n, 301n, 302n, 303n, 401n]);
  for (const item of catalogItems) expect(itemPreview(item)).toMatch(/gradient\(/);
});
it('remembers one equipped item per category, keeping the existing blade key', () => {
  window.localStorage.setItem('slyce.blade.equipped', '102');
  writeEquipped('fruit', 201n);
  expect([readEquipped('blade'), readEquipped('fruit'), readEquipped('board')]).toEqual([102n, 201n, null]);
  writeEquipped('fruit', null);
  expect(readEquipped('fruit')).toBeNull();
});
