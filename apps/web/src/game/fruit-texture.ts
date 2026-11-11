/** Original procedural fruit artwork. Generated once per renderer instance. */
export const fruitKinds = ['melon', 'orange', 'plum', 'kiwi', 'lemon', 'apple', 'peach'] as const;
export type FruitKind = typeof fruitKinds[number];
export const fruitAppearance: Record<FruitKind, { skin: [string, string, string]; flesh: [string, string]; juice: number }> = {
  melon: { skin: ['#a8d749', '#3b852e', '#123b22'], flesh: ['#ff8292', '#b60031'], juice: 0xe93759 },
  orange: { skin: ['#ffd267', '#f98a0b', '#963608'], flesh: ['#ffda64', '#f28a0b'], juice: 0xffa51f },
  plum: { skin: ['#c78dcf', '#753e87', '#24152e'], flesh: ['#ffda64', '#dc721a'], juice: 0xd77643 },
  kiwi: { skin: ['#cfb27b', '#8c6b3c', '#49321c'], flesh: ['#d7ed85', '#57972d'], juice: 0x9dca3c },
  lemon: { skin: ['#fff6a0', '#ecd02b', '#a67b13'], flesh: ['#fff7ab', '#edce3a'], juice: 0xf4d946 },
  apple: { skin: ['#ffb093', '#e93f37', '#811c2c'], flesh: ['#fff9d4', '#e8ca8e'], juice: 0xe9c47d },
  peach: { skin: ['#ffe0a2', '#f99a62', '#bd4b4e'], flesh: ['#ffe3a0', '#f4ac42'], juice: 0xf5a24d },
};
/** `skinColors` (a shop fruit skin) replaces the outer colours of every fruit; flesh stays true to the fruit. */
export function fruitTexture(part: 'whole' | 'upper' | 'lower', kind: FruitKind = 'melon', skinColors?: readonly [string, string, string]): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Fruit artwork could not initialize');
  if (part !== 'whole') { ctx.beginPath(); ctx.rect(0, part === 'upper' ? 0 : 96, 192, 96); ctx.clip(); }
  if (part === 'whole') {
    const skin = ctx.createRadialGradient(61, 46, 4, 105, 110, 103);
    const palette = skinColors ?? fruitAppearance[kind].skin;
    skin.addColorStop(0, palette[0]); skin.addColorStop(.5, palette[1]); skin.addColorStop(1, palette[2]);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(96, 96, 86, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.clip();
    if (kind === 'melon') {
      ctx.strokeStyle = 'rgba(17,63,24,.7)'; ctx.lineWidth = 13;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(96 + i * 17, 8); ctx.bezierCurveTo(96 + i * 46, 64, 96 + i * 46, 129, 96 + i * 17, 184); ctx.stroke(); }
    } else if (kind === 'orange' || kind === 'lemon' || kind === 'kiwi') {
      ctx.fillStyle = 'rgba(120,58,8,.2)';
      for (let i = 0; i < 230; i++) { const a = i * 2.39996, r = 85 * Math.sqrt(i / 230); ctx.beginPath(); ctx.arc(96 + Math.cos(a) * r, 96 + Math.sin(a) * r, 1.2, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(30,9,34,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(92, 12); ctx.bezierCurveTo(118, 70, 119, 135, 96, 180); ctx.stroke();
    }
    const shine = ctx.createRadialGradient(62, 48, 0, 66, 52, 50); shine.addColorStop(0, 'rgba(255,255,230,.5)'); shine.addColorStop(1, 'rgba(255,255,230,0)'); ctx.fillStyle = shine; ctx.fillRect(0, 0, 192, 192); ctx.restore();
    ctx.strokeStyle = '#5a4123'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(96, 15); ctx.quadraticCurveTo(91, 7, 100, 3); ctx.stroke();
    return canvas;
  }
  if (kind !== 'melon') {
    ctx.fillStyle = (skinColors ?? fruitAppearance[kind].skin)[1]; ctx.beginPath(); ctx.arc(96, 96, 87, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffdda0'; ctx.beginPath(); ctx.arc(96, 96, 80, 0, Math.PI * 2); ctx.fill();
    const flesh = ctx.createRadialGradient(60, 55, 5, 96, 96, 78); flesh.addColorStop(0, fruitAppearance[kind].flesh[0]); flesh.addColorStop(1, fruitAppearance[kind].flesh[1]);
    ctx.fillStyle = flesh; ctx.beginPath(); ctx.arc(96, 96, 76, 0, Math.PI * 2); ctx.fill();
    if (kind === 'orange' || kind === 'lemon') {
      ctx.strokeStyle = '#ffe4a6'; ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; ctx.beginPath(); ctx.moveTo(96, 96); ctx.lineTo(96 + Math.cos(a) * 74, 96 + Math.sin(a) * 74); ctx.stroke(); }
    } else if (kind === 'kiwi') {
      ctx.fillStyle = '#f2f1c4'; ctx.beginPath(); ctx.ellipse(96, 96, 18, 27, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 32; i++) { const a = i * Math.PI / 16; ctx.strokeStyle = '#d7e999'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(96 + Math.cos(a) * 23, 96 + Math.sin(a) * 29); ctx.lineTo(96 + Math.cos(a) * 70, 96 + Math.sin(a) * 70); ctx.stroke(); ctx.fillStyle = '#29251b'; ctx.beginPath(); ctx.ellipse(96 + Math.cos(a) * 38, 96 + Math.sin(a) * 43, 2, 3.5, a, 0, Math.PI * 2); ctx.fill(); }
    } else if (kind === 'apple') {
      ctx.fillStyle = '#efdda7'; ctx.beginPath(); ctx.ellipse(96, 96, 22, 39, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#62422b'; for (const x of [85, 107]) for (const y of [79, 110]) { ctx.beginPath(); ctx.ellipse(x, y, 3, 6, -.4, 0, Math.PI * 2); ctx.fill(); }
    } else { ctx.fillStyle = '#8a4723'; ctx.beginPath(); ctx.ellipse(96, 96, 23, 33, -.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#c4853c'; ctx.lineWidth = 3; ctx.stroke(); }
    return canvas;
  }
  const ring = ctx.createRadialGradient(58, 40, 8, 96, 96, 91); ring.addColorStop(0, '#9ad839'); ring.addColorStop(0.75, '#287b2c'); ring.addColorStop(1, '#073925');
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(96, 96, 91, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#bcef80'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(96, 96, 82, 0, Math.PI * 2); ctx.stroke();
  const flesh = ctx.createRadialGradient(65, 58, 3, 102, 103, 85); flesh.addColorStop(0, '#ff8292'); flesh.addColorStop(.4, '#ff355a'); flesh.addColorStop(1, '#b60031');
  ctx.fillStyle = flesh; ctx.beginPath(); ctx.arc(96, 96, 78, 0, Math.PI * 2); ctx.fill();
  for (let ringIndex = 0; ringIndex < 3; ringIndex++) for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6 + ringIndex * .16; const radius = 31 + ringIndex * 17;
    const x = 96 + Math.cos(angle) * radius, y = 96 + Math.sin(angle) * radius;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = '#ffd3b9'; ctx.beginPath(); ctx.ellipse(-1, -1, 3.5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#21152b'; ctx.beginPath(); ctx.ellipse(0, 0, 2.4, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,220,187,.32)'; ctx.lineWidth = 1;
  for (let i = 0; i < 36; i++) { const a = i * Math.PI / 18; ctx.beginPath(); ctx.moveTo(96 + Math.cos(a) * 8, 96 + Math.sin(a) * 8); ctx.lineTo(96 + Math.cos(a) * 25, 96 + Math.sin(a) * 25); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,220,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(96, 96, 87, Math.PI * 1.05, Math.PI * 1.65); ctx.stroke();
  return canvas;
}
/** Original procedural bomb artwork for practice rounds. */
export function bombTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Bomb artwork could not initialize');
  const shell = ctx.createRadialGradient(70, 76, 6, 96, 108, 82);
  shell.addColorStop(0, '#5b6670'); shell.addColorStop(.55, '#232a30'); shell.addColorStop(1, '#090c0e');
  ctx.fillStyle = shell; ctx.beginPath(); ctx.arc(96, 108, 74, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e5383b'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(96, 108, 60, Math.PI * .15, Math.PI * .85); ctx.stroke();
  ctx.fillStyle = '#3b4248'; ctx.fillRect(80, 26, 32, 22);
  ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(96, 28); ctx.quadraticCurveTo(108, 6, 128, 12); ctx.stroke();
  ctx.fillStyle = '#ffb627'; ctx.beginPath(); ctx.arc(130, 12, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(130, 12, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(68, 80, 16, 10, -.7, 0, Math.PI * 2); ctx.fill();
  return canvas;
}
