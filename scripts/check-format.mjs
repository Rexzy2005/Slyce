import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set(['.git', 'node_modules', '.next', 'docs', 'coverage', 'test-results', 'playwright-report', 'dist']);
let errors = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    // Foundry vendor libraries, build output and generated Prisma client are not project source.
    if (/^(?:contracts\/(?:lib|out|cache|broadcast)|backend\/src\/generated)/.test(path.relative(root, file).replaceAll('\\', '/'))) continue;
    if (entry.isDirectory()) { await walk(file); continue; }
    if (!/\.(ts|tsx|js|mjs|json|css|yaml|html)$/.test(file)) continue;
    const text = await readFile(file, 'utf8');
    if (!text.endsWith('\n') || /[ \t]+$/m.test(text)) { console.error(path.relative(root, file) + ': missing final newline or trailing whitespace'); errors++; }
  }
}
await walk(root);
if (errors) throw new Error(errors + ' source formatting errors');
console.log('Source whitespace checks passed (not a full code formatter).');
