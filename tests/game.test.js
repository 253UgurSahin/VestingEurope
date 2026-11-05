// Tests voor Vesting Europa: draaien met `node --test tests/*.test.js` (Node 20+ en Playwright met Chromium).
// Ze starten een kleine webserver op deze map en spelen het spel in een headless browser.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const SAVE_KEY = 'vesting-europa-v5';
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

// opent het spel; errors verzamelt paginafouten en console-fouten
async function open(t, { storage } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [], hosts = new Set();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => hosts.add(new URL(r.url()).host));
  if (storage) await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, storage);
  await page.goto(base);
  await page.waitForFunction(() => window.__VE && window.__VE.MAP.PIDS.length > 0 && !window.__VE.UI.loading);
  t.after(() => ctx.close());
  return { page, errors, hosts };
}
const startGame = (page, c = 'nl') => page.evaluate(c => { window.__VE.newGame(c, 1); return window.__VE.G.player; }, c);
const G = (page, f) => page.evaluate(f);

test('het spel laadt zonder fouten en zonder verzoeken naar andere sites', async t => {
  const { page, errors, hosts } = await open(t);
  await page.waitForTimeout(800);   // ook de scherpe kaart en de lettertypes
  assert.deepEqual(errors, []);
  assert.deepEqual([...hosts], [new URL(base).host]);
  assert.equal(await page.locator('button[data-act="daily"]').count(), 1, 'startscherm met de uitdaging van de dag');
});

test('titel, beschrijving en icoon staan in de head', async t => {
  const { page } = await open(t);
  const head = await page.evaluate(() => ['title', 'meta[name=description]', 'meta[property="og:title"]', 'link[rel=icon]'].filter(q => !document.head.querySelector(q)));
  assert.deepEqual(head, [], 'ontbreekt in <head>');
  assert.equal(await page.title(), 'Vesting Europa');
});

test('een nieuw spel start en de tijd loopt', async t => {
  const { page, errors } = await open(t);
  assert.equal(await startGame(page), 'nl');
  const day0 = await G(page, () => window.__VE.G.day);
  await page.evaluate(() => window.__VE.advance(20));
  assert.ok(await G(page, () => window.__VE.G.day) > day0, 'de dag gaat vooruit');
  assert.deepEqual(errors, []);
});

test('een jaar spelen geeft geen fouten (AI, gevechten, productie)', async t => {
  const { page, errors } = await open(t);
  await startGame(page, 'de');
  await page.evaluate(() => { for (let i = 0; i < 365; i++) window.__VE.advance(1); });
  const s = await G(page, () => ({ day: window.__VE.G.day, errs: window.__VE.errs, owners: new Set(Object.values(window.__VE.G.ctrl)).size }));
  assert.ok(s.day >= 300, 'ongeveer een jaar verder, dag ' + s.day);
  assert.equal(s.errs, 0);
  assert.ok(s.owners > 1);
  assert.deepEqual(errors, []);
});

test('spatie drukt een knop met focus in, en pauzeert alleen op de kaart (A001)', async t => {
  const { page } = await open(t);
  await startGame(page);
  await page.evaluate(() => { window.__VE.G.paused = false; });
  await page.focus('button[data-sheet="prod"]');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !document.getElementById('sheet').hidden);
  assert.equal(await G(page, () => window.__VE.G.paused), false, 'spatie op een knop pauzeert niet');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('sheet').hidden);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Space');
  assert.equal(await G(page, () => window.__VE.G.paused), true, 'spatie zonder focus pauzeert');
});

test('een opgeslagen spel komt terug na herladen', async t => {
  const { page } = await open(t);
  await startGame(page, 'pl');
  await page.evaluate(() => window.__VE.advance(15));
  const day = await G(page, () => window.__VE.G.day);
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));   // slaat op
  await page.reload();
  await page.waitForFunction(() => window.__VE && !window.__VE.UI.loading);
  await page.click('button[data-act="resume"]');   // "Doorgaan" op het startscherm
  await page.waitForFunction(() => window.__VE.G);
  assert.deepEqual(await G(page, () => ({ p: window.__VE.G.player, d: window.__VE.G.day })), { p: 'pl', d: day });
});

test('een kapot opgeslagen spel wordt geweigerd, zonder fouten', async t => {
  for (const bad of ['{niet json', JSON.stringify({ map: 'europe', G: { v: 4 } }), JSON.stringify({ map: 'europe', G: { v: 5, ctrl: {}, nations: {}, units: [], player: 'xx', day: 3 } }), JSON.stringify({ map: 'maan', G: { v: 5 } })]) {
    const { page, errors } = await open(t, { storage: { [SAVE_KEY]: bad } });
    const resume = page.locator('button[data-act="resume"]');
    if (await resume.count()) { await resume.click(); await page.waitForTimeout(300); }   // "Doorgaan" mag er staan, maar laadt niets
    assert.equal(await G(page, () => window.__VE.G), null, 'geen spel geladen uit ' + bad.slice(0, 40));
    assert.deepEqual(errors, []);
  }
});

test('een opgeslagen spel met foute waarden wordt gerepareerd, en de reserve wordt gebruikt', async t => {
  const first = await open(t);
  await startGame(first.page, 'se');
  await first.page.evaluate(() => window.__VE.advance(5));
  const good = await first.page.evaluate(() => { const g = JSON.parse(JSON.stringify(window.__VE.G)); g.speed = 99; g.units[0].hp = -5; g.nid = 'x'; return JSON.stringify({ map: 'europe', G: g }); });
  // de hoofdsleutel is kapot, de reserve (.bak) is bruikbaar maar heeft foute waarden
  const { page, errors } = await open(t, { storage: { [SAVE_KEY]: '{kapot', [SAVE_KEY + '.bak']: good } });
  await page.click('button[data-act="resume"]');
  await page.waitForFunction(() => window.__VE.G);
  const g = await G(page, () => ({ p: window.__VE.G.player, speed: window.__VE.G.speed, hp: window.__VE.G.units.every(u => u.hp > 0 && u.hp <= 100), nid: Number.isFinite(window.__VE.G.nid) }));
  assert.deepEqual(g, { p: 'se', speed: 1, hp: true, nid: true });
  assert.deepEqual(errors, []);
});
