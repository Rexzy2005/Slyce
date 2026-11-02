import { readFile, writeFile } from 'node:fs/promises';
const base = new URL('../', import.meta.url);
const tokens = JSON.parse(await readFile(new URL('apps/web/src/design/tokens.json', base), 'utf8'));
await writeFile(new URL('apps/web/src/design/tokens.css', base), '/* Generated from tokens.json by scripts/generate-assets.mjs. */\n@theme {\n' + Object.entries(tokens).map(([name, value]) => '  --color-' + name + ': ' + value + ';').join('\n') + '\n}\n');
// App icons in apps/web/public/icons are rendered from docs/brand (see docs/brand/README.md), not generated here.
