// Spelverloop van begin tot eind (forge-test). Case-ID's staan in forge-work/test-plan.md.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { env, open, startGame, provincePoint, SAVE_KEY } = require('./helpers');

test('F01-H1 met de muis een land kiezen, niveau wisselen en starten', async t => {
  const { page, errors } = await open(t);
  const [x, y] = await provincePoint(page, await page.evaluate(() => window.__VE.MAP.CN.pl.cap));
  await page.mouse.click(x, y);
  assert.equal(await page.evaluate(() => window.__VE.UI.pick), 'pl');
  await page.locator('#strip button[data-act="diff"]').click();
  await page.locator('#strip button[data-act="start"]').click();
  assert.deepEqual(await page.evaluate(() => ({ p: window.__VE.G.player, d: window.__VE.UI.diff })), { p: 'pl', d: 2 });
  assert.deepEqual(errors, []);
});

test('F01-H2 de wereldkaart laden, een land kiezen en een jaar spelen', async t => {
  const { page, errors } = await open(t);
  await page.locator('#strip button[data-map="world"]').click();
  await page.waitForFunction(() => window.__VE.MAP.PIDS.length > 1000 && !window.__VE.UI.loading);
  const [x, y] = await provincePoint(page, await page.evaluate(() => window.__VE.MAP.CN.bra.cap));
  await page.mouse.click(x, y);
  await page.locator('#strip button[data-act="start"]').click();
  assert.equal(await page.evaluate(() => window.__VE.G.player), 'bra');
  await page.evaluate(() => { for (let i = 0; i < 365; i++) window.__VE.advance(1); });
  assert.equal(await page.evaluate(() => window.__VE.errs), 0);
  assert.deepEqual(errors, []);
});

test('F02-H1 de uitdaging van de dag start met het land van vandaag', async t => {
  const { page, errors } = await open(t);
  const label = await page.locator('#strip button[data-act="daily"]').textContent();
  await page.locator('#strip button[data-act="daily"]').click();
  await page.locator('#strip button[data-act="start"]').click();
  const name = await page.evaluate(() => window.__VE.MAP.CN[window.__VE.G.player].name);
  assert.ok(label.includes(name), label + ' hoort ' + name + ' te noemen');
  assert.ok(await page.evaluate(() => !!window.__VE.G.daily));
  assert.deepEqual(errors, []);
});

test('F03-H1 productie: iets bouwen zet het in de wachtrij, twee keer tikken haalt het eruit', async t => {
  const { page, errors } = await open(t);
  await startGame(page);
  await page.getByRole('button', { name: 'Productie', exact: true }).click();
  const tile = page.locator('#sheet button[data-q]:not([disabled])').first();
  await tile.click();
  await page.waitForFunction(() => document.querySelectorAll('#queue .qb').length === 1);
  const q = page.locator('#queue .qb').first();
  await q.click();   // eerste tik: klaar om te schrappen
  await q.click();   // tweede tik: geschrapt
  await page.waitForFunction(() => document.querySelectorAll('#queue .qb').length === 0);
  assert.deepEqual(errors, []);
});

test('F03-E1 productie: dubbelklikken bouwt twee stuks, zonder fouten', async t => {
  const { page, errors } = await open(t);
  await startGame(page);
  await page.getByRole('button', { name: 'Productie', exact: true }).click();
  await page.locator('#sheet button[data-q]:not([disabled])').first().dblclick();
  await page.waitForFunction(() => document.querySelectorAll('#queue .qb').length >= 1);
  assert.ok(await page.locator('#queue .qb').count() <= 2);
  assert.deepEqual(errors, []);
});

test('F04-H1 oorlog verklaren via de kaart en de strook', async t => {
  const { page, errors } = await open(t);
  await startGame(page, 'nl');
  const [x, y] = await provincePoint(page, await page.evaluate(() => window.__VE.MAP.CN.de.cap));
  await page.mouse.click(x, y);
  await page.locator('#strip button[data-act="decl:de"]').click();
  assert.ok(await page.evaluate(() => 'de|nl' in window.__VE.G.wars), 'Nederland en Duitsland zijn in oorlog');
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__VE.advance(1); });
  assert.equal(await page.evaluate(() => window.__VE.errs), 0);
  assert.deepEqual(errors, []);
});

test('F05-H1 speciale acties staan in het paneel Acties', async t => {
  const { page, errors } = await open(t);
  await startGame(page);
  await page.getByRole('button', { name: 'Speciale acties', exact: true }).click();
  assert.ok(await page.locator('#sheet [data-s]').count() >= 3);
  assert.deepEqual(errors, []);
});

test('F06-H1 instellingen blijven bewaard na herladen', async t => {
  const { page, errors } = await open(t);
  await startGame(page);
  await page.getByRole('button', { name: 'Overzicht', exact: true }).click();
  await page.evaluate(() => { for (const d of document.querySelectorAll('#sheet details')) d.open = true; });
  await page.locator('input[data-set="cb"]').check();
  await page.reload();
  await page.waitForFunction(() => window.__VE && !window.__VE.UI.loading);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('ve_settings'))).cb, true);
  assert.deepEqual(errors, []);
});

test('F07-H1 winnen toont de eindkaart met de score', async t => {
  const { page, errors } = await open(t);
  await startGame(page, 'de');
  await page.evaluate(() => {
    const G = window.__VE.G, me = G.player, ids = Object.keys(G.ctrl).filter(k => G.ctrl[k] !== me);
    for (const k of ids.slice(0, Math.ceil(ids.length * 0.6))) capture(k, me);
    for (let i = 0; i < 6 && !G.won; i++) window.__VE.advance(1);
  });
  assert.equal(await page.evaluate(() => window.__VE.G.won), true);
  await page.waitForSelector('#endcard:not([hidden])');
  assert.match(await page.textContent('#endcard'), /\d/);
  assert.deepEqual(errors, []);
});

test('F07-H2 verliezen toont de eindkaart', async t => {
  const { page, errors } = await open(t);
  await startGame(page, 'nl');
  await page.evaluate(() => {
    const G = window.__VE.G;
    for (const k of Object.keys(G.ctrl)) if (G.ctrl[k] === 'nl') capture(k, 'de');
    G.units = G.units.filter(u => u.c !== 'nl');
    for (let i = 0; i < 15 && !G.over; i++) window.__VE.advance(1);
  });
  assert.equal(await page.evaluate(() => window.__VE.G.over), 'lost');
  await page.waitForSelector('#endcard:not([hidden])');
  assert.deepEqual(errors, []);
});

test('F08-E1 telefoon (390 px): geen horizontaal scrollen, panelen passen in het scherm', async t => {
  const { page, errors } = await open(t, { viewport: { width: 390, height: 844 }, mobile: true });
  await page.locator('#strip button[data-act="daily"]').click();
  await page.locator('#strip button[data-act="start"]').click();
  for (const name of ['Productie', 'Speciale acties', 'Overzicht']) {
    await page.getByRole('button', { name, exact: true }).click();
    const box = await page.evaluate(() => { const r = document.getElementById('sheet').getBoundingClientRect(); return { l: r.left, r: r.right, sw: document.documentElement.scrollWidth }; });
    assert.ok(box.l >= 0 && box.r <= 390 && box.sw <= 390, name + ': ' + JSON.stringify(box));
  }
  assert.deepEqual(errors, []);
});

test('F08-E2 offline: de kaart laadt niet, "Opnieuw" werkt zodra het net terug is', async t => {
  let offline = true;
  const { page, errors } = await open(t, { route: ['**/europe.json', r => offline ? r.abort() : r.continue()] });
  await page.waitForSelector('#strip button[data-act="retry"]');
  offline = false;
  await page.locator('#strip button[data-act="retry"]').click();
  await page.waitForFunction(() => window.__VE.MAP.PIDS.length > 0 && !window.__VE.UI.err);
  assert.equal(await page.locator('#strip button[data-act="daily"]').count(), 1);
  assert.deepEqual(errors, []);
});

test('F08-E3 opslag geblokkeerd (privémodus): het spel werkt en meldt dat opslaan niet lukt', async t => {
  const { page, errors } = await open(t, { init: () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); } });
  await page.locator('#strip button[data-act="daily"]').click();
  await page.locator('#strip button[data-act="start"]').click();
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__VE.advance(1); dispatchEvent(new Event('pagehide')); });
  assert.ok(await page.evaluate(() => window.__VE.G.day) >= 15);
  assert.match(await page.textContent('#toasts'), /Opslaan lukt niet/);
  assert.deepEqual(errors, []);
});

test('F09-H1 een nieuw spel vraagt eerst om bevestiging en laat het oude spel bewaard', async t => {
  const { page, errors } = await open(t);
  await startGame(page, 'pl');
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await page.getByRole('button', { name: 'Overzicht', exact: true }).click();
  await page.locator('#sheet button[data-act="new"]').click();
  assert.ok(await page.evaluate(() => !!window.__VE.G), 'de eerste klik vraagt alleen om bevestiging');
  await page.locator('#sheet button[data-act="new"]').click();
  assert.equal(await page.evaluate(() => window.__VE.G), null);
  assert.ok(await page.evaluate(k => !!localStorage.getItem(k), SAVE_KEY), 'het oude spel blijft te hervatten');
  assert.deepEqual(errors, []);
});

test('F07-E1 een verloren spel komt na herladen niet terug (B001)', async t => {
  const { page, errors } = await open(t);
  await startGame(page, 'nl');
  for (let i = 0; i < 2; i++) await page.evaluate(() => { window.__VE.advance(5); dispatchEvent(new Event('pagehide')); });   // spelstand + reserve
  await page.evaluate(() => {
    const G = window.__VE.G;
    for (const k of Object.keys(G.ctrl)) if (G.ctrl[k] === 'nl') capture(k, 'de');
    G.units = G.units.filter(u => u.c !== 'nl');
    for (let i = 0; i < 15 && !G.over; i++) window.__VE.advance(1);
  });
  assert.equal(await page.evaluate(() => window.__VE.G.over), 'lost');
  await page.reload();
  await page.waitForFunction(() => window.__VE && !window.__VE.UI.loading);
  assert.equal(await page.locator('#strip button[data-act="resume"]').count(), 0, 'geen "Doorgaan" voor het verloren spel');
  assert.deepEqual(errors, []);
});

test('F10-E1 de tabs in de panelen bevatten alleen tabs (B002)', async t => {
  const { page, errors } = await open(t);
  await startGame(page);
  for (const name of ['Productie', 'Speciale acties', 'Overzicht']) {
    await page.getByRole('button', { name, exact: true }).click();
    const bad = await page.evaluate(() => [...document.querySelectorAll('[role="tablist"] > *')].filter(el => el.getAttribute('role') !== 'tab').map(el => el.outerHTML.slice(0, 60)));
    assert.deepEqual(bad, [], name);
    assert.equal(await page.getByRole('tab', { name: 'Productie' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Sluiten' }).count(), 1, 'de sluitknop blijft er');
  }
  assert.deepEqual(errors, []);
});

test('F10-E2 de productiewachtrij heeft een naam die schermlezers voorlezen (B003)', async t => {
  const { page, errors } = await open(t);
  await startGame(page);
  await page.getByRole('button', { name: 'Productie', exact: true }).click();
  await page.locator('#sheet button[data-q]:not([disabled])').first().click();
  assert.equal(await page.getByRole('group', { name: 'Productiewachtrij' }).count(), 1);
  assert.deepEqual(errors, []);
});

test('F08-E4 de foutmelding bij een kaart die niet laadt is in het Nederlands (B004)', async t => {
  const { page, errors } = await open(t, { route: ['**/europe.json', r => r.abort()] });
  await page.waitForSelector('#strip button[data-act="retry"]');
  const txt = await page.textContent('#strip');
  assert.match(txt, /Kaart laden mislukt/);
  assert.doesNotMatch(txt, /Failed|fetch|HTTP/i, txt);
  assert.match(txt, /verbinding/);
  assert.deepEqual(errors, []);
});

test('F11-E2 de Content-Security-Policy staat aan en blokkeert niets van het spel zelf (X001)', async t => {
  const { page, errors } = await open(t, { init: () => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); } });
  const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
  assert.match(csp, /script-src 'self'(;|$)/, 'scripts alleen van de eigen site, zonder unsafe-inline');
  assert.match(csp, /object-src 'none'/);
  await page.locator('#strip button[data-act="daily"]').click();
  await page.locator('#strip button[data-act="start"]').click();
  for (const name of ['Productie', 'Speciale acties', 'Overzicht']) await page.getByRole('button', { name, exact: true }).click();
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__VE.advance(1); });
  await page.focus('#over');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);   // ook de scherpe kaart en de lettertypes
  assert.deepEqual(await page.evaluate(() => window.__csp), [], 'geen geblokkeerde onderdelen');
  // een script dat er toch in komt, wordt tegengehouden
  const ran = await page.evaluate(() => { window.__inj = false; document.getElementById('tip').innerHTML = '<img src=x onerror="window.__inj=true">'; return new Promise(r => setTimeout(() => r(window.__inj), 300)); });
  assert.equal(ran, false, 'een ingevoegd script mag niet draaien');
  assert.ok((await page.evaluate(() => window.__csp)).some(v => v.startsWith('script-src')), 'de browser meldt de blokkade');
  assert.deepEqual(errors.filter(e => !/Content Security Policy|404 /.test(e)), []);
});

test('C001 het startscherm en de pagina zeggen: gratis, geen account, geen aankopen, geen advertenties', async t => {
  const { page, errors } = await open(t);
  await page.waitForSelector('#hero:not([hidden])');
  const hero = await page.textContent('#hero');
  for (const word of [/gratis/i, /geen account/i, /geen aankopen/i, /geen advertenties/i, /op dit apparaat/i]) assert.match(hero, word);
  assert.match(await page.getAttribute('meta[name="description"]', 'content'), /gratis/i);
  // en het klopt: niets naar andere sites, geen cookies
  assert.equal((await page.context().cookies()).length, 0, 'geen cookies');
  assert.deepEqual(errors, []);
});

test('C002 op een iPad zijn alle knoppen minstens 44 px, en niets loopt over het scherm', async t => {
  for (const device of ['iPad Mini', 'iPad Mini landscape']) {
    const { page, errors } = await open(t, { device });
    await startGame(page);
    await page.waitForFunction(() => !document.getElementById('strip').hidden);
    for (const sheet of [null, 'prod', 'spec', 'info']) {
      if (sheet) await page.locator(`button[data-sheet="${sheet}"]`).click();
      await page.evaluate(() => { for (const d of document.querySelectorAll('#sheet details')) d.open = true; });
      const bad = await page.evaluate(() => {
        const out = [];
        for (const e of document.querySelectorAll('button:not(.sw), #sheet .setrow label')) {
          if (!e.offsetParent || e.disabled) continue;
          const r = e.getBoundingClientRect();
          if (r.width < 43.5 || r.height < 43.5) out.push((e.dataset.act || e.dataset.sheet || e.dataset.tab || e.dataset.q || e.id || e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        }
        return out;
      });
      assert.deepEqual(bad, [], `${device}, paneel ${sheet}: te kleine knoppen`);
      // de aan/uit-schakelaars blijven klein om te zien, maar 14 px erboven en eronder raakt een vinger ze nog
      const sw = await page.evaluate(() => [...document.querySelectorAll('.sw')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return document.elementFromPoint(x, y - 20) === e && document.elementFromPoint(x, y + 20) === e; }));
      assert.ok(sw.every(Boolean), `${device}, paneel ${sheet}: schakelaar met te klein raakvlak`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), device + ': horizontaal scrollen');
    }
    assert.deepEqual(errors, [], device);
  }
});

test('C005 eigen spel: voordeel en AI-sterkte kiezen op het startscherm, en ze blijven bewaard', async t => {
  const { page, errors } = await open(t);
  const [x, y] = await provincePoint(page, await page.evaluate(() => window.__VE.MAP.CN.nl.cap));
  await page.mouse.click(x, y);
  const help = page.locator('#strip button[data-act="opt:help"]'), ai = page.locator('#strip button[data-act="opt:ai"]');
  assert.match(await help.textContent(), /standaard/);
  assert.match(await ai.textContent(), /standaard/);
  await help.click(); assert.match(await help.textContent(), /groot/);
  await help.click(); assert.match(await help.textContent(), /geen/);
  await help.click(); assert.match(await help.textContent(), /standaard/);
  await ai.click(); assert.match(await ai.textContent(), /sterker/);
  await help.click();   // groot
  await page.locator('#strip button[data-act="start"]').click();
  assert.deepEqual(await page.evaluate(() => window.__VE.G.opt), { help: 1, ai: 1 });
  await page.evaluate(() => { window.__VE.G.paused = true; dispatchEvent(new Event('pagehide')); });
  await page.reload();
  await page.waitForFunction(() => window.__VE && !window.__VE.UI.loading);
  await page.locator('#strip button[data-act="resume"]').click();
  await page.waitForFunction(() => window.__VE.G);
  assert.deepEqual(await page.evaluate(() => window.__VE.G.opt), { help: 1, ai: 1 }, 'de opties komen terug na hervatten');
  assert.deepEqual(errors, []);
});

test('C005 de opties veranderen de spelwaarden, en een geholpen spel telt niet voor records', async t => {
  const { page, errors } = await open(t);
  const vals = o => page.evaluate(o => { window.__VE.newGame('nl', 1, o); const d = window.__VE.D; return { mePp: d.mePp, meCap: d.meCap, meCbt: d.meCbt, pp: d.pp, assisted: !!window.__VE.G.assisted }; }, o);
  const std = await vals({ help: 0, ai: 0 });
  const big = await vals({ help: 1, ai: 0 }), none = await vals({ help: -1, ai: 0 }), strong = await vals({ help: 0, ai: 1 }), weak = await vals({ help: 0, ai: -1 });
  assert.ok(big.mePp > std.mePp && big.meCap > std.meCap && big.meCbt > std.meCbt && big.pp === std.pp, 'groot voordeel: meer voor jou');
  assert.deepEqual([none.mePp, none.meCap, none.meCbt], [1, 1, 1], 'geen voordeel: alles op 1');
  assert.ok(strong.pp > std.pp && weak.pp < std.pp && strong.mePp === std.mePp, 'AI-sterkte verandert alleen de AI');
  assert.deepEqual([std.assisted, big.assisted, none.assisted, strong.assisted, weak.assisted], [false, true, false, false, true]);
  const rec = o => page.evaluate(o => { localStorage.removeItem('ve_best'); window.__VE.newGame('nl', 1, o); saveBest(); return localStorage.getItem('ve_best'); }, o);
  assert.equal(await rec({ help: 1, ai: 0 }), null, 'een geholpen spel telt niet voor je beste score');
  assert.equal(await rec({ help: 0, ai: -1 }), null, 'zwakkere AI telt ook niet');
  assert.ok(await rec({ help: 0, ai: 0 }), 'een gewoon spel wel');
  assert.ok(await rec({ help: -1, ai: 1 }), 'een moeilijker spel wel');
  assert.deepEqual(errors, []);
});

test('C005 een opgeslagen spel met rare of ontbrekende opties wordt gerepareerd', async t => {
  const first = await open(t);
  await startGame(first.page, 'se');
  const save = await first.page.evaluate(() => JSON.stringify({ map: 'europe', G: JSON.parse(JSON.stringify(window.__VE.G)) }));
  for (const mutate of [g => { g.opt = { help: 99, ai: 'x' }; }, g => { delete g.opt; delete g.assisted; }, g => { g.opt = null; }]) {
    const o = JSON.parse(save); mutate(o.G);
    const { page, errors } = await open(t, { storage: { [SAVE_KEY]: JSON.stringify(o) } });
    await page.locator('#strip button[data-act="resume"]').click();
    await page.waitForFunction(() => window.__VE.G);
    assert.deepEqual(await page.evaluate(() => window.__VE.G.opt), { help: 0, ai: 0 });
    assert.equal(await page.evaluate(() => window.__VE.D.mePp), 1.1, 'het gewone niveau, geen foute waarden');
    assert.deepEqual(errors, []);
  }
});

// C003: een spel als bestand bewaren en weer laden
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const exportGame = async page => {
  await page.getByRole('button', { name: 'Overzicht', exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#sheet button[data-act="export"]').click()]);
  return dl;
};

test('C003 een spel bewaren als bestand', async t => {
  const { page, errors } = await open(t);
  await startGame(page, 'pl');
  await page.evaluate(() => { for (let i = 0; i < 12; i++) window.__VE.advance(1); });
  const dl = await exportGame(page);
  assert.match(dl.suggestedFilename(), /^vesting-europa-pl-dag\d+\.json$/);
  const o = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  assert.equal(o.app, 'vesting-europa');
  assert.equal(o.map, 'europe');
  assert.equal(o.G.player, 'pl');
  assert.ok(o.G.day >= 10);
  assert.deepEqual(errors, []);
});

test('C003 een bestand laden op een schone browser geeft hetzelfde spel terug', async t => {
  const a = await open(t);
  await startGame(a.page, 'se');
  await a.page.evaluate(() => window.__VE.advance(30));
  const day = await a.page.evaluate(() => window.__VE.G.day);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 've-')), 'spel.json');
  await (await exportGame(a.page)).saveAs(file);
  const b = await open(t);   // schone browser: geen opgeslagen spel
  assert.equal(await b.page.locator('#strip button[data-act="resume"]').count(), 0);
  const [chooser] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.locator('#strip button[data-act="import"]').click()]);
  await chooser.setFiles(file);
  await b.page.waitForFunction(() => window.__VE.G);
  assert.deepEqual(await b.page.evaluate(() => ({ p: window.__VE.G.player, d: window.__VE.G.day, paused: window.__VE.G.paused })), { p: 'se', d: day, paused: true });
  assert.ok(await b.page.evaluate(k => !!localStorage.getItem(k), SAVE_KEY), 'het geladen spel is meteen ook in de browser bewaard');
  assert.deepEqual(b.errors, []);
});

test('C003 een fout of verkeerd bestand geeft een duidelijke melding en breekt niets', async t => {
  const bad = [
    ['kapot.json', '{niet json', /geen geldig spelbestand/],
    ['leeg.json', '', /geen geldig spelbestand/],
    ['ander.json', JSON.stringify({ hallo: 1 }), /geen spel van Vesting Europa/],
    ['oud.json', JSON.stringify({ app: 'vesting-europa', map: 'europe', G: { v: 4 } }), /andere versie/],
    ['groot.json', 'x'.repeat(6 * 1024 * 1024), /te groot/],
  ];
  for (const [name, content, msg] of bad) {
    const { page, errors } = await open(t);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#strip button[data-act="import"]').click()]);
    await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
    await page.waitForSelector('#toasts .toast');
    assert.match(await page.textContent('#toasts'), msg, name);
    assert.equal(await page.evaluate(() => window.__VE.G), null, name + ': geen spel geladen');
    assert.equal(await page.locator('#strip button[data-act="import"]').count(), 1, name + ': het startscherm werkt nog');
    assert.deepEqual(errors, [], name);
  }
});

// C004: installeren en offline spelen
const inCache = page => page.evaluate(async () => {
  const names = await caches.keys();
  if (!names.length) return [];
  return (await (await caches.open(names[0])).keys()).map(r => new URL(r.url).pathname);
});

test('C004 het manifest en de iconen kloppen', async t => {
  const { page, errors } = await open(t);
  const href = await page.getAttribute('link[rel="manifest"]', 'href');
  assert.ok(href, 'de pagina verwijst naar een manifest');
  const m = await (await fetch(new URL(href, env.base))).json();
  assert.equal(m.name, 'Vesting Europa');
  assert.equal(m.display, 'standalone');
  assert.equal(m.lang, 'nl');
  assert.ok(m.start_url && m.background_color && m.theme_color);
  const sizes = new Set();
  for (const icon of m.icons) {
    const res = await fetch(new URL(icon.src, new URL(href, env.base)));
    assert.equal(res.status, 200, icon.src);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20), icon.sizes, icon.src + ': echte afmeting klopt met het manifest');
    sizes.add(icon.sizes + (icon.purpose || ''));
  }
  assert.ok([...sizes].some(s => s.startsWith('192x192')) && [...sizes].some(s => s.startsWith('512x512')), 'iconen van 192 en 512 px');
  assert.ok([...sizes].some(s => s.endsWith('maskable')), 'een maskable icoon');
  const touch = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
  assert.match(touch, /\.png$/, 'iOS wil een png als beginschermicoon');
  assert.equal((await fetch(new URL(touch, env.base))).status, 200);
  assert.deepEqual(errors, []);
});

test('C004 na een bezoek werkt het spel zonder internet', async t => {
  const { page, errors } = await open(t, { sw: true });
  await page.waitForFunction(async () => !!navigator.serviceWorker.controller && (await caches.keys()).length > 0, null, { timeout: 30000 });
  await page.waitForFunction(async () => { const n = await caches.keys(); return (await (await caches.open(n[0])).keys()).length >= 25; }, null, { timeout: 30000 });
  const have = await inCache(page);
  const need = await page.evaluate(() => [...document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[rel="manifest"][href]')].map(e => new URL(e.src || e.href).pathname));
  assert.deepEqual(need.filter(p => !have.includes(p)), [], 'alles waar de pagina om vraagt zit in de cache');
  for (const f of ['/europe.json', '/europe-hd.json', '/index.html']) assert.ok(have.includes(f) || (f === '/index.html' && have.includes('/')), f + ' in de cache');
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__VE && window.__VE.MAP.PIDS.length > 0 && !window.__VE.UI.err);
  await startGame(page, 'nl');
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__VE.advance(1); });
  assert.ok(await page.evaluate(() => window.__VE.G.day) >= 15);
  assert.equal(await page.evaluate(() => window.__VE.errs), 0);
  assert.deepEqual(errors, []);
});

test('C004 de wereldkaart werkt offline zodra hij een keer is geladen', async t => {
  const { page, errors } = await open(t, { sw: true });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  await page.locator('#strip button[data-map="world"]').click();
  await page.waitForFunction(() => window.__VE.MAP.PIDS.length > 1000 && !window.__VE.UI.loading);
  await page.waitForFunction(async () => { const n = await caches.keys(); return (await (await caches.open(n[0])).keys()).some(r => r.url.endsWith('/world-hd.json')); }, null, { timeout: 60000 });
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__VE && window.__VE.MAP.PIDS.length > 0);
  await page.locator('#strip button[data-map="world"]').click();
  await page.waitForFunction(() => window.__VE.MAP.PIDS.length > 1000 && !window.__VE.UI.loading && !window.__VE.UI.err);
  assert.deepEqual(errors, []);
});

test('C004 een nieuwe versie van de code komt binnen als je online bent, en geldt daarna ook offline', async t => {
  const http = require('node:http');
  let version = 1;
  const server = http.createServer((req, res) => {   // zoals de gewone server, maar style.css krijgt een versienummer
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(__dirname, '..', rel === '/' ? 'index.html' : rel);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    let body = fs.readFileSync(file);
    if (rel === '/style.css') body = Buffer.concat([body, Buffer.from(`\n/* versie ${version} */`)]);
    const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=3600' });   // ook met een lange browsercache moet de nieuwe versie binnenkomen
    res.end(body);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const { page, errors } = await open(t, { sw: true, base });
  await page.waitForFunction(async () => !!navigator.serviceWorker.controller && (await caches.keys()).length > 0, null, { timeout: 30000 });
  await page.waitForFunction(async () => { const n = await caches.keys(); return (await (await caches.open(n[0])).keys()).length >= 25; }, null, { timeout: 30000 });
  const css = () => page.evaluate(async () => (await (await fetch('style.css')).text()).match(/versie \d+/)[0]);
  assert.equal(await css(), 'versie 1');
  version = 2;
  await page.reload();
  assert.equal(await css(), 'versie 2', 'online komt de nieuwe versie binnen');
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__VE && window.__VE.MAP.PIDS.length > 0);
  assert.equal(await css(), 'versie 2', 'offline geldt de nieuwste versie die is binnengekomen');
  assert.deepEqual(errors, []);
});
