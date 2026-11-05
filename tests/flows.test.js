// Spelverloop van begin tot eind (forge-test). Case-ID's staan in forge-work/test-plan.md.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { open, startGame, provincePoint, SAVE_KEY } = require('./helpers');

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
