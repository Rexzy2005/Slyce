import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
const base = new URL('../', import.meta.url);
const tokens = JSON.parse(await readFile(new URL('apps/web/src/design/tokens.json', base), 'utf8'));
await writeFile(new URL('apps/web/src/design/tokens.css', base), '/* Generated from tokens.json by scripts/generate-assets.mjs. */\n@theme {\n' + Object.entries(tokens).map(([name, value]) => '  --color-' + name + ': ' + value + ';').join('\n') + '\n}\n');
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const kind = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([kind, data])));
  return Buffer.concat([length, kind, data, checksum]);
}
const rgb = hex => [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16));
await mkdir(new URL('apps/web/public/icons/', base), { recursive: true });
for (const size of [192, 512]) {
  const rows = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size, ny = y / size;
    // A bold slash within the maskable safe area. Original code-native brand mark.
    const slash = ny > .24 && ny < .76 && Math.abs(nx - (.66 - (ny - .24) * .62)) < .075;
    const color = rgb(slash ? tokens.mango : tokens.night);
    const offset = y * (size * 3 + 1) + 1 + x * 3;
    color.forEach((value, index) => { rows[offset + index] = value; });
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  await writeFile(new URL('apps/web/public/icons/icon-' + size + '.png', base), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
}
await writeFile(new URL('apps/web/public/offline.html', base), '<!doctype html>\n<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="' + tokens.night + '"><title>Offline · Slyyce</title><link rel="stylesheet" href="/font/typography.css"><style>body{margin:0;min-height:100vh;display:grid;place-content:center;padding:28px;box-sizing:border-box;background:' + tokens.night + ';color:' + tokens.cream + ';font:16px/1.7 var(--font-site)}main{max-width:440px}h1{font-size:38px;line-height:1.1}a{color:' + tokens.mango + ';display:inline-block;padding:12px 0}p{color:' + tokens.mist + '}</style><main><h1>A little pause.</h1><p>You’re offline. Reconnect to load the market and check your wallet, scores and rewards. No account data is stored in this offline page.</p><a href="/">Try again →</a></main></html>\n');
console.log('Generated canonical theme CSS, two PNG icons and the static offline page.');
