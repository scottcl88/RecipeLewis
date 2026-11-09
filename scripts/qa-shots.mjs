// QA harness: screenshots (desktop/mobile x light/dark) + axe-core against a running app wired to the EMULATORS.
//   node scripts/qa-shots.mjs <baseUrl> <outDir>
// Needs system Chromium. Test accounts are the emulator-only users from scripts/dev-user.mjs.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer-core';

const [base = 'http://127.0.0.1:4173', out = './screenshots'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const axeSource = fs.readFileSync(path.join(os.homedir(), '.openclaw/team-workspaces/shared/scripts/design-qa/node_modules/axe-core/axe.min.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const report = { generatedAt: new Date().toISOString(), shots: [], axe: [] };

async function axe(page, name, theme, width) {
  await page.evaluate(axeSource);
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
  });
  report.axe.push({ name, theme, width, violations: r });
}
async function shot(page, name, theme, width, extra = {}) {
  await sleep(900);
  const file = path.join(out, name + '-' + width + '-' + theme + '.png');
  await page.screenshot({ path: file, fullPage: extra.fullPage ?? true });
  report.shots.push(file);
  if (!extra.noAxe) await axe(page, name, theme, width);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) report.shots.push('HORIZONTAL OVERFLOW at ' + name + ' ' + width);
}
async function login(page, email) {
  await page.goto(base + '/sign-in', { waitUntil: 'domcontentloaded' });
  await page.type('#email', email); await page.type('#password', 'Passw0rd!test');
  await Promise.all([page.waitForFunction(() => location.pathname.startsWith('/recipes'), { timeout: 20000 }), page.click('button[type=submit]')]);
  await sleep(1500);
}

for (const theme of (process.env.THEME ? [process.env.THEME] : ['light', 'dark'])) {
  // anonymous
  const ctx0 = await browser.createBrowserContext();
  const p0 = await ctx0.newPage(); p0.setDefaultNavigationTimeout(120000); p0.setDefaultTimeout(60000);
  await p0.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  for (const w of [375, 1366]) {
    await p0.setViewport({ width: w, height: 800 });
    await p0.goto(base + '/sign-in', { waitUntil: 'domcontentloaded' });
    await shot(p0, 'signin', theme, w);
    if (w === 375) {
      await p0.type('#email', 'nobody@example.test'); await p0.type('#password', 'wrongwrong');
      await p0.click('button[type=submit]'); await p0.waitForSelector('[role=alert]'); await shot(p0, 'signin-error', theme, w);
    }
  }
  await ctx0.close();

  // pending (no claim)
  const ctxP = await browser.createBrowserContext();
  const pp = await ctxP.newPage(); pp.setDefaultNavigationTimeout(120000); pp.setDefaultTimeout(60000);
  await pp.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await pp.setViewport({ width: 375, height: 800 });
  await pp.goto(base + '/sign-in', { waitUntil: 'domcontentloaded' });
  await pp.type('#email', 'pending@example.test'); await pp.type('#password', 'Passw0rd!test'); await pp.click('button[type=submit]');
  await pp.waitForFunction(() => document.body.innerText.includes('Awaiting approval'), { timeout: 20000 });
  await shot(pp, 'awaiting', theme, 375);
  await ctxP.close();

  // admin session: everything else
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(60000);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await page.setViewport({ width: 1366, height: 900 });
  await login(page, 'admin@example.test');
  const widths = [375, 768, 1366, 1920];
  for (const w of widths) {
    await page.setViewport({ width: w, height: 900 });
    if (w === widths[0]) await page.goto(base + '/recipes', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('ul.grid a.card', { timeout: 90000 });
    await sleep(1500);
    await shot(page, 'browse', theme, w, { fullPage: false });
  }
  const hrefs = await page.$$eval('ul.grid a.card', (as) => as.map((a) => a.getAttribute('href')));
  // pick a recipe with a photo and one with legacy html only
  const withImg = await page.$$eval('ul.grid a.card', (as) => as.find((a) => a.querySelector('img'))?.getAttribute('href'));
  const recipe = withImg || hrefs[0];
  for (const w of [375, 1366]) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(base + '/recipes?q=zzzzzz', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.empty'); await shot(page, 'browse-nomatch', theme, w);
    await page.goto(base + recipe, { waitUntil: 'domcontentloaded' }); await sleep(2500); await shot(page, 'recipe', theme, w);
    await page.goto(base + recipe + '/edit', { waitUntil: 'domcontentloaded' }); await sleep(800); await shot(page, 'edit', theme, w);
    await page.goto(base + '/recipes/new', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('button[type=submit]'); await sleep(500);
    await page.click('button[type=submit]'); await page.waitForSelector('.error-summary'); await shot(page, 'new-validation', theme, w);
    await page.goto(base + '/admin', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.member', { timeout: 60000 }); await sleep(500); await shot(page, 'admin', theme, w);
    await page.goto(base + '/profile', { waitUntil: 'domcontentloaded' }); await shot(page, 'profile', theme, w);
    await page.goto(base + '/recipes/does-not-exist', { waitUntil: 'domcontentloaded' }); await sleep(500); await shot(page, 'notfound', theme, w);
  }
  // cooking mode (needs steps: create-less approach: open any recipe and press the button)
  await page.setViewport({ width: 375, height: 800 });
  await page.goto(base + recipe, { waitUntil: 'domcontentloaded' }); await sleep(800);
  const [btn] = await page.$$('xpath/.//button[normalize-space()="Cooking mode"]'); await btn.click(); await sleep(400);
  await shot(page, 'cooking', theme, 375, { fullPage: false });
  // print preview (always light)
  if (theme === 'light') {
    await page.keyboard.press('Escape');
    await page.setViewport({ width: 794, height: 1123 });
    await page.emulateMediaType('print'); await sleep(400);
    await page.screenshot({ path: path.join(out, 'recipe-print.png'), fullPage: true }); report.shots.push(path.join(out, 'recipe-print.png'));
    await page.emulateMediaType('screen');
  }
  // keyboard: tab order sanity on browse
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(base + '/recipes', { waitUntil: 'domcontentloaded' }); await sleep(800);
  const focusOrder = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); focusOrder.push(await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30) + ' | outline:' + cs.outlineStyle + ' ' + cs.outlineWidth; })); }
  report.keyboard = report.keyboard || {}; report.keyboard[theme] = focusOrder;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'qa-report.json'), JSON.stringify(report, null, 2));
const summary = {};
for (const a of report.axe) for (const v of a.violations) summary[v.id + ' (' + v.impact + ')'] = (summary[v.id + ' (' + v.impact + ')'] || 0) + 1;
console.log(JSON.stringify({ shots: report.shots.length, axeRuns: report.axe.length, axeViolationSummary: summary, overflow: report.shots.filter((s) => s.startsWith('HORIZONTAL')) }, null, 2));
