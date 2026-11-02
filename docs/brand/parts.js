// Shared vector parts for the Slyyce logo and banner. Colours are the app's brand tokens.
const C = { sky: '#3BA8FF', night: '#0E1712', canopy: '#18261D', vine: '#2A3D31', mango: '#FFB627', leaf: '#2FBF71', melon: '#FF4D6D', cream: '#F7F2E7', rindDark: '#1C7A47', flesh: '#FF3D5E', fleshDeep: '#E5294C', seed: '#1A120E' };

// Watermelon half-slice (flat edge up), centred at (0,0), radius r. Returns SVG markup.
function melonHalf(r, id) {
  const seeds = [[-0.55, 0.22], [-0.25, 0.42], [0.05, 0.5], [0.35, 0.4], [0.6, 0.2], [-0.05, 0.2], [0.3, 0.12], [-0.35, 0.1]]
    .map(([x, y]) => `<path d="M0,${-r * 0.045} C${r * 0.03},${-r * 0.01} ${r * 0.025},${r * 0.04} 0,${r * 0.05} C${-r * 0.025},${r * 0.04} ${-r * 0.03},${-r * 0.01} 0,${-r * 0.045}Z" fill="${C.seed}" transform="translate(${x * r},${y * r}) rotate(${x * 30})"/>`).join('');
  const half = (k) => `M${-r * k},0 A${r * k},${r * k} 0 0 0 ${r * k},0 Z`;
  return `<defs><radialGradient id="${id}-f" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="${C.flesh}"/><stop offset="1" stop-color="${C.fleshDeep}"/></radialGradient></defs>
  <path d="${half(1)}" fill="${C.rindDark}"/>
  <path d="${half(0.94)}" fill="${C.leaf}"/>
  <path d="${half(0.86)}" fill="${C.cream}"/>
  <path d="${half(0.8)}" fill="url(#${id}-f)"/>
  ${seeds}`;
}

// Melon half cut along a diagonal: two pieces pushed apart along the cut's normal, plus a glowing blade streak.
function slicedMelon(r, id, { gap = r * 0.09, angle = -38, streak = 1.9, cutY = r * 0.42, spin = 7 } = {}) {
  const a = angle * Math.PI / 180;
  const nx = -Math.sin(a), ny = Math.cos(a); // normal to the cut
  const L = r * 3;
  const line = (side) => `M${-L * Math.cos(a) + side * nx * L},${-L * Math.sin(a) + side * ny * L} L${L * Math.cos(a) + side * nx * L},${L * Math.sin(a) + side * ny * L} L${L * Math.cos(a)},${L * Math.sin(a)} L${-L * Math.cos(a)},${-L * Math.sin(a)} Z`;
  const s = r * streak;
  return `<defs>
    <clipPath id="${id}-a"><path d="${line(-1)}"/></clipPath>
    <clipPath id="${id}-b"><path d="${line(1)}"/></clipPath>
    <linearGradient id="${id}-s" x1="0" x2="1"><stop offset="0" stop-color="${C.mango}" stop-opacity="0"/><stop offset=".55" stop-color="${C.mango}"/><stop offset=".8" stop-color="#FFF4D6"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></linearGradient>
    <filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${r * 0.05}"/></filter>
  </defs>
  <g transform="translate(${-nx * gap},${-ny * gap}) rotate(${-spin} 0 ${cutY})"><g clip-path="url(#${id}-a)"><g transform="translate(0,${-cutY})">${melonHalf(r, id + 'a')}</g></g></g>
  <g transform="translate(${nx * gap},${ny * gap}) rotate(${spin * 0.6} 0 ${cutY})"><g clip-path="url(#${id}-b)"><g transform="translate(0,${-cutY})">${melonHalf(r, id + 'b')}</g></g></g>
  <g transform="rotate(${angle})">
    <rect x="${-s}" y="${-r * 0.035}" width="${s * 2}" height="${r * 0.07}" rx="${r * 0.035}" fill="url(#${id}-s)" filter="url(#${id}-glow)" opacity=".9"/>
    <rect x="${-s}" y="${-r * 0.012}" width="${s * 2}" height="${r * 0.024}" rx="${r * 0.012}" fill="url(#${id}-s)"/>
  </g>`;
}

// Juice droplets scattered around a point.
function drops(list, color) {
  return list.map(([x, y, rr, rot = 0]) => `<path d="M0,${-rr * 1.6} C${rr * 0.9},${-rr * 0.4} ${rr},${rr * 0.3} 0,${rr} C${-rr},${rr * 0.3} ${-rr * 0.9},${-rr * 0.4} 0,${-rr * 1.6}Z" fill="${color}" transform="translate(${x},${y}) rotate(${rot})"/>`).join('');
}

// Citrus wheel slice.
function citrus(r, rind, flesh, pith = C.cream) {
  const seg = Array.from({ length: 10 }, (_, i) => {
    const a0 = (i / 10) * Math.PI * 2 + 0.06, a1 = ((i + 1) / 10) * Math.PI * 2 - 0.06, rr = r * 0.8;
    return `<path d="M0,0 L${Math.cos(a0) * rr},${Math.sin(a0) * rr} A${rr},${rr} 0 0 1 ${Math.cos(a1) * rr},${Math.sin(a1) * rr} Z" fill="${flesh}"/>`;
  }).join('');
  return `<circle r="${r}" fill="${rind}"/><circle r="${r * 0.88}" fill="${pith}"/>${seg}<circle r="${r * 0.08}" fill="${pith}"/>`;
}

const fontFace = `@font-face { font-family: 'Rajdhani'; src: url('Rajdhani-Bold.ttf') format('truetype'); font-weight: 700; }`;
if (typeof module !== 'undefined') module.exports = { C, melonHalf, slicedMelon, drops, citrus, fontFace };
