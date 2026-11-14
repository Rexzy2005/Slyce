/**
 * Display metadata for SlyceShop item ids. Prices, availability and ownership are read on-chain; ids 101–103 are
 * listed by contracts/script/Deploy.s.sol and the premium range by contracts/script/ListCosmetics.s.sol.
 * Cosmetics change how the game looks, never the score. Power-ups (extra lives) are consumables kept out of
 * tournaments (ADR-0016).
 */
export type ItemCategory = 'blade' | 'fruit' | 'board';
/** Consumable power-ups, bought repeatedly and used up in play (ADR-0016). */
export type PowerUpCategory = 'lives';
export type BladeEffect = 'rainbow' | 'flicker';
export interface BladeLook { readonly glow: number; readonly core: number; readonly effect?: BladeEffect }
/** Replaces every fruit's skin colours; flesh and juice stay true to the fruit. */
export interface FruitSkin { readonly skin: readonly [string, string, string] }
/** Board wood colours (the chopping board's CSS custom properties). */
export interface BoardLook { readonly base: string; readonly light: string; readonly dark: string; readonly grain: string }
interface BaseItem { readonly id: bigint; readonly name: string; readonly description: string; readonly premium?: boolean }
export type CatalogItem =
  | (BaseItem & { readonly category: 'blade'; readonly look: BladeLook })
  | (BaseItem & { readonly category: 'fruit'; readonly look: FruitSkin })
  | (BaseItem & { readonly category: 'board'; readonly look: BoardLook })
  | (BaseItem & { readonly category: 'lives'; readonly look: { readonly lives: number } });
export const extraLivesItemId = 401n;

export const defaultBlade: BladeLook = { glow: 0xffcf72, core: 0xfffdf4 };
export const categoryLabels: Record<ItemCategory | PowerUpCategory, string> = { lives: 'Power-ups', blade: 'Blade trails', fruit: 'Fruit skins', board: 'Boards' };

export const catalogItems: readonly CatalogItem[] = [
  { id: 101n, category: 'blade', name: 'Ember blade', description: 'A hot red trail.', look: { glow: 0xe5383b, core: 0xffd2c4 } },
  { id: 102n, category: 'blade', name: 'Sky blade', description: 'A cool blue trail.', look: { glow: 0x3ba8ff, core: 0xe3f2ff } },
  { id: 103n, category: 'blade', name: 'Leaf blade', description: 'A fresh green slash.', look: { glow: 0x2fbf71, core: 0xdcffe9 } },
  { id: 104n, category: 'blade', premium: true, name: 'Rainbow blade', description: 'A full spectrum on every swipe.', look: { glow: 0xff4fd8, core: 0xffffff, effect: 'rainbow' } },
  { id: 105n, category: 'blade', premium: true, name: 'Lightning blade', description: 'An electric, flickering trail.', look: { glow: 0x7df9ff, core: 0xffffff, effect: 'flicker' } },
  { id: 106n, category: 'blade', premium: true, name: 'Gold blade', description: 'A golden trail for every cut.', look: { glow: 0xffc21a, core: 0xfff6c8 } },
  { id: 107n, category: 'blade', premium: true, name: 'Shadow blade', description: 'Violet glow. Bright edge.', look: { glow: 0x7b2cff, core: 0xe9d8ff } },
  { id: 201n, category: 'fruit', premium: true, name: 'Golden fruit', description: 'A golden finish for every fruit.', look: { skin: ['#fff2a8', '#f2b705', '#8a5a00'] } },
  { id: 202n, category: 'fruit', premium: true, name: 'Neon fruit', description: 'Pink skins with a neon glow.', look: { skin: ['#ffd1f7', '#ff2fb3', '#5a0047'] } },
  { id: 203n, category: 'fruit', premium: true, name: 'Frost fruit', description: 'Cool blue, icy skins.', look: { skin: ['#e8fbff', '#6cc9f0', '#1b4f7a'] } },
  { id: 301n, category: 'board', name: 'Marble board', description: 'White marble with grey veining.', look: { base: '#d9d6cf', light: '#f3f1ec', dark: '#7d7a73', grain: '#a9a59c' } },
  { id: 302n, category: 'board', name: 'Midnight board', description: 'Dark slate that makes fruit pop.', look: { base: '#2a2f3a', light: '#3d4454', dark: '#12151c', grain: '#555e72' } },
  { id: 303n, category: 'board', premium: true, name: 'Bamboo board', description: 'Warm bamboo grain.', look: { base: '#d8b46a', light: '#ecd39a', dark: '#8a6a2c', grain: '#b8924a' } },
  { id: extraLivesItemId, category: 'lives', name: '3 extra lives', description: 'Adds 3 lives in Normal play. Not for tournaments.', look: { lives: 3 } },
];

const equippedKey = (category: ItemCategory) => category === 'blade' ? 'slyce.blade.equipped' : `slyyce.${category}.equipped`;
export function readEquipped(category: ItemCategory): bigint | null {
  try { const value = window.localStorage.getItem(equippedKey(category)); return value && /^\d+$/.test(value) ? BigInt(value) : null; } catch { return null; }
}
export function writeEquipped(category: ItemCategory, id: bigint | null) {
  try { if (id === null) window.localStorage.removeItem(equippedKey(category)); else window.localStorage.setItem(equippedKey(category), id.toString()); } catch { /* Equip lasts for this page only. */ }
}
/** CSS preview for a shop card. */
export function itemPreview(item: CatalogItem): string {
  const hex = (value: number) => '#' + value.toString(16).padStart(6, '0');
  if (item.category === 'blade') return item.look.effect === 'rainbow'
    ? 'linear-gradient(120deg,#ff4f4f,#ffb627,#f9f871,#2fbf71,#3ba8ff,#a259ff)'
    : `linear-gradient(120deg, ${hex(item.look.glow)}, ${hex(item.look.core)})`;
  if (item.category === 'lives') return 'radial-gradient(circle at 35% 30%, #ffb3c1, #e5383b 60%, #7a0f1f)';
  if (item.category === 'fruit') return `radial-gradient(circle at 35% 30%, ${item.look.skin[0]}, ${item.look.skin[1]} 55%, ${item.look.skin[2]})`;
  return `linear-gradient(100deg, ${item.look.base}, ${item.look.light} 45%, ${item.look.base})`;
}
