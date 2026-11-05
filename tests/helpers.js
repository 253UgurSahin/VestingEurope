// Gedeelde hulp voor de tests: een kleine webserver op deze map en een browser die het spel opent.
'use strict';
const { before, after } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const SAVE_KEY = 'vesting-europa-v5';
const env = { base: null, browser: null };
let server;

before(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  env.base = 'http://127.0.0.1:' + server.address().port + '/';
  env.browser = await chromium.launch();
});
after(async () => { await env.browser?.close(); server?.close(); });

// opent het spel. errors: paginafouten, console-fouten en antwoorden van 400 of hoger
// sw: true laat de service worker toe (offline spelen); standaard staat hij uit, zodat andere tests niet door zijn cache lopen
async function open(t, { storage, viewport, mobile, route, init, device, sw, base } = {}) {
  const ctx = await env.browser.newContext({ serviceWorkers: sw ? 'allow' : 'block', ...(device ? { ...require('playwright').devices[device] } : { viewport: viewport || { width: 1280, height: 800 }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) }) });
  if (route) await ctx.route(route[0], route[1]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !(route && /Failed to load resource/.test(m.text()))) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  if (init) await page.addInitScript(init);
  if (storage) await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, storage);
  await page.goto(base || env.base);
  await page.waitForFunction(() => window.__VE && !window.__VE.UI.loading && (window.__VE.MAP.PIDS.length > 0 || window.__VE.UI.err));
  t.after(() => ctx.close());
  return { page, errors };
}
// start een spel zonder het startscherm, gepauzeerd zodat de tests de tijd zelf bepalen
const startGame = (page, c = 'nl') => page.evaluate(c => { window.__VE.newGame(c, 1); window.__VE.G.paused = true; return window.__VE.G.player; }, c);
// schermpositie van een provincie (haar labelpunt)
const provincePoint = (page, p) => page.evaluate(p => {
  const a = window.__VE.MAP.P[p].a, [x, y] = window.__VE.toScreen(a[0], a[1]), r = document.getElementById('stage').getBoundingClientRect();
  return [r.left + x, r.top + y];
}, p);

module.exports = { env, open, startGame, provincePoint, SAVE_KEY };
