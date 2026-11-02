// Renders a brand HTML page to PNG at its exact art size: node render.mjs <playwright-index> <html> <out.png> [query]
const [, , pw, html, out, query = ''] = process.argv;
const { chromium } = await import(pw);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: Number(process.env.SCALE || 1) });
await page.goto(`file://${html}${query}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.locator('#art').screenshot({ path: out, omitBackground: false });
await browser.close();
