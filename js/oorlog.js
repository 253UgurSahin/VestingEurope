'use strict';
/* ================= oorlogsverloop: sterren, overgavemeter, laatste verzet, overgave en vrede ================= */
// Elke provincie heeft 1 tot 3 sterren: hoofdstad en wereldsteden 3, grote steden 2, de rest 1.
// Hoe meer sterren een land kwijt is, hoe voller zijn overgavemeter. Lage oorlogssteun vult hem sneller.
const TRUCE = 365;
const truceLeft = (a, b) => Math.max(0, ((G.truce || {})[wk(a, b)] || 0) - G.day);
const starOf = p => STAR[p] || 1;
const starSum = ps => { let s = 0; for(const p of ps) s += STAR[p] || 1; return s; };
// het grondgebied waarmee een land de oorlog in ging; in vrede gewoon wat het nu heeft
function baseOf(c){ const n = nat(c); return n.base && n.base.length ? n.base : owned(c); }
function baseTick(){ for(const c of CIDS){ const n = nat(c); if(n.alive && !enemiesOf(c).length) n.base = owned(c).slice(); } }
const surrLim = c => 0.5 + 0.3 * clamp(nat(c).ws, 0, 100) / 100 + (c === G.player ? (D().meSurr || 0) : 0);   // 50% bij geen steun, 80% bij volle steun; jij houdt het op lagere niveaus langer vol
// het hart van een land: het samenhangende stuk (over land en korte zeeroutes) met de hoofdstad;
// overzees gebied telt voor een vijfde, anders kan een land met verre eilanden nooit capituleren
const MAINC = new WeakMap();
function mainW(c){
  const b = baseOf(c), hit = MAINC.get(b);
  if(hit && hit.n === b.length) return hit;
  const inB = new Set(b), seen = new Set(), cap = CN[c].cap;
  let best = null, bs = -1;
  for(const p of b){
    if(seen.has(p)) continue;
    const comp = [p]; seen.add(p);
    for(let i = 0; i < comp.length; i++) for(const n of ADJ[comp[i]]) if(inB.has(n) && !seen.has(n)){ seen.add(n); comp.push(n); }
    const sc = comp.includes(cap) ? Infinity : starSum(comp);
    if(sc > bs){ bs = sc; best = comp; }
  }
  const main = new Set(best || []), w = new Float64Array(b.length); let tot = 0;
  for(let i = 0; i < b.length; i++){ w[i] = (STAR[b[i]] || 1) * (main.has(b[i]) ? 1 : 0.2); tot += w[i]; }
  const res = {n: b.length, w, tot};
  MAINC.set(b, res);
  return res;
}
let METC = {day:-1, m:{}};
function meterOf(c){
  if(METC.day !== G.day || METC.v !== CTRLV || METC.w !== WARV || METC.g !== G) METC = {day:G.day, v:CTRLV, w:WARV, g:G, m:{}};
  let r = METC.m[c]; if(r === undefined) r = METC.m[c] = meterOf0(c); return r;
}
function meterOf0(c){
  if(!G.nations[c] || !alive(c) || !enemiesOf(c).length) return 0;
  const b = baseOf(c), m = mainW(c);
  let lost = 0;
  for(let i = 0; i < b.length; i++) if(G.ctrl[b[i]] !== c) lost += m.w[i];
  if(!m.tot) return 0;
  const base = lost / m.tot / surrLim(c);
  // kansloos: een vijand die vele malen sterker is laat de meter sneller vollopen (tot +30%);
  // na een half jaar oorlog tegen een overmacht van 4× of meer ook zonder landverlies (onderhandelen wordt dan zinvol)
  let ep = 0, old = 0; for(const e of enemiesOf(c)){ ep += armyPow(e); old = Math.max(old, G.day - (G.wars[wk(c, e)] ?? G.day)); }
  const ratio = ep / Math.max(1, armyPow(c));
  if(base <= 0.05) return base + (old >= 180 ? clamp((ratio - 4) / 12, 0, 0.35) : 0);
  return base + clamp((ratio - 2.5) / 10, 0, 0.3);
}
const pct = m => Math.max(0, Math.min(100, Math.round(100*m)));
const occBy = (a, b) => baseOf(b).filter(p => G.ctrl[p] === a);   // wat a bezet van het gebied van b
// welke bezette provincies de verliezer afstaat: tot zijn meterstand (in sterren), grensprovincies eerst
function pickDeal(ps, frac, gainer){
  if(!ps.length || frac <= 0) return [];
  const lim = Math.min(1, frac) * starSum(ps) + 1e-6, home = new Set(baseOf(gainer));
  const sc = p => (ADJ[p].some(q => home.has(q)) ? 10 : 0) + starOf(p);
  const out = []; let s = 0;
  for(const p of ps.slice().sort((x, y) => sc(y) - sc(x))){ const v = starOf(p); if(s + v <= lim){ out.push(p); s += v; } }
  return out;
}
const plist = ps => ps.length <= 3 ? ps.map(p => P[p].n).join(', ') : ps.slice(0, 2).map(p => P[p].n).join(', ') + ' en ' + (ps.length - 2) + ' andere';
// troepen die na een vrede op vreemd gebied staan, trekken terug naar het dichtstbijzijnde eigen gebied
function relocate(c){
  const own = owned(c);
  for(const u of G.units){
    if(u.c !== c || G.ctrl[u.loc] === c) continue;
    let best = null, bd = Infinity;
    for(const q of own){ const d2 = dist(u.loc, q); if(d2 < bd){ bd = d2; best = q; } }
    if(best){ u.loc = best; u.path = []; u.att = null; u.air = false; u.prog = 0; u.g = null; } else u.dead = true;
  }
  if(G.units.some(u => u.dead)){ G.units = G.units.filter(u => !u.dead); for(const id of [...UI.sel]) if(!unitById(id)) UI.sel.delete(id); }
  for(const w of G.air) if(w.c === c && G.ctrl[w.base] !== c){ const nb = spawnLoc(c, "air"); if(nb){ w.base = nb; w.z = nb; w.zone = null; } }
}
// statistiek: hoe oorlogen eindigen (voor de balans, niet in beeld)
function endLog(k, a, b){ const d = G.day - (G.wars[wk(a, b)] ?? G.day); const e = (G.ends ||= {})[k] ||= [0, 0]; e[0]++; e[1] += d; }
// vredesverdrag: a houdt keepA (uit het gebied van b), b houdt keepB (uit dat van a); de rest gaat terug.
// Daarna geldt een verdrag van een jaar.
function settle(a, b, keepA, keepB, days){
  const kA = new Set(keepA || []), kB = new Set(keepB || []);
  const ba = baseOf(a).slice(), bb = baseOf(b).slice();
  for(const p of bb) if(G.ctrl[p] === a && !kA.has(p)) setCtrl(p, b);
  for(const p of ba) if(G.ctrl[p] === b && !kB.has(p)) setCtrl(p, a);
  nat(a).base = ba.filter(p => !kB.has(p)).concat([...kA]);
  nat(b).base = bb.filter(p => !kA.has(p)).concat([...kB]);
  ownDirty = true;
  makePeace(a, b, true);
  relocate(a); relocate(b);
  (G.truce ||= {})[wk(a, b)] = G.day + (days || TRUCE);
}
function annex(c, by){
  const n = nat(c), me = G.player;
  if(by === me && n.total) annexAE(c, occBy(me, c));
  // wie de provincies nu heeft, houdt ze voorgoed
  for(const p of baseOf(c)){ const k = G.ctrl[p]; if(k !== c && G.nations[k] && nat(k).base && nat(k).base.length && !nat(k).base.includes(p)) nat(k).base.push(p); }
  G.units = G.units.filter(u => u.c !== c);
  G.air = G.air.filter(w => w.c !== c);
  for(const k of Object.keys(G.wars)) if(k.split('|').includes(c)){ const [x, y] = k.split('|'); endLog('ingelijfd', x, y); delete G.wars[k]; }
  if(G.cards) G.cards = G.cards.filter(cd => cd.e !== c);
  const wasFoe = atWar(me, c);
  n.alive = false; n.q = []; n.base = [];
  warsChanged(); if(wasFoe) baseDirty = true;
  if(c === me){ gameOver('lost'); return; }
  if(by === me) G.stats.caps++;
  if(by === me || MAPNAME === 'europe' || MAJORS.has(c)) toast(cname(c) + ' is volledig veroverd' + (by ? ' door ' + (by === me ? 'jou' : cname(by)) : ''), by === me ? 'good' : '');
}
// agressie bij de buren voor gebied dat je in een vrede houdt: een heel land kost zo'n 36
function aeMult(prev){ const me = G.player, w = G.aggr[wk(me, prev)]; return !w ? 1 : w.a === me ? (w.just ? 0.5 : 1.4) : 0.3; }
function aeFor(prev, ps, extra){
  const me = G.player;
  const v = (ps.length ? 36 * starSum(ps) / Math.max(1, starSum(baseOf(prev))) : 0) * aeMult(prev) + (extra || 0);
  const nb = new Set(neighbors(prev)), add = {};
  for(const x of CIDS){
    if(x === me || x === prev || !alive(x) || atWar(x, me)) continue;
    const f = nb.has(x) ? 1 : distKm(CN[x].cap, CN[prev].cap) < AE_R() ? 0.35 : 0;
    if(f) add[x] = v * f;
  }
  return {v, add};
}
function annexAE(prev, ps, extra){ const r = aeFor(prev, ps, extra); for(const x in r.add) addAE(x, r.add[x]); return r.v; }
function aePreview(prev, ps, extra){
  const r = aeFor(prev, ps, extra); let top = 0, who = null;
  for(const x in r.add){ const t = (G.ae[x] || 0) + r.add[x]; if(t > top){ top = t; who = x; } }
  return {v:r.v, top:Math.min(100, top), who};
}
// laatste verzet: bij 75% roept een land de noodtoestand uit, één keer per oorlog
function lastStand(c){
  const n = nat(c), me = G.player;
  n.ls = G.day; n.lsT = G.day + 60;
  n.ws = clamp(n.ws + 8, 0, 100);
  const own = owned(c);
  const front = own.filter(p => ADJ[p].some(q => atWar(c, G.ctrl[q])));
  const spots = front.concat(own.filter(p => !front.includes(p)));
  const k = clamp(Math.round(own.length / 3), 1, 4);
  for(let i = 0; i < k && spots.length; i++) spawn(c, 'mil', spots[i % spots.length]);
  if(c === me){ toast('Noodtoestand: ' + k + ' milities, steden +20% verdediging, steun +8%', 'war', 'ls'); if(spots[0]) fx(spots[0], 'spawn'); }
  else if(atWar(me, c)) toast(cname(c) + ' roept de noodtoestand uit: ' + k + ' milities en zwaar verdedigde steden', 'war', 'ls' + c);
}
// overgave: bij 100% legt het leger de wapens neer
function surrender(c){
  const n = nat(c), me = G.player;
  if(c === me){ G.mySurrCd = G.day + 60; queueCard({k:'mysurr'}); return; }
  const ens = enemiesOf(c).slice();
  n.sur = G.day;
  G.units = G.units.filter(u => u.c !== c);
  G.air = G.air.filter(w => w.c !== c);
  for(const id of [...UI.sel]) if(!unitById(id)) UI.sel.delete(id);
  n.q = []; n.ws = Math.min(n.ws, 35); n.cp = Math.min(n.cp, 20);
  const loud = MAPNAME === 'europe' || MAJORS.has(c);
  for(const e of ens){
    if(e === me) continue;
    const left = owned(c).length;
    if(left <= 1 && MAJORS.has(e) && Math.random() < 0.5){ n.total = 1; continue; }   // een grootmacht lijft soms het laatste restje in
    endLog('overgave', e, c); settle(e, c, occBy(e, c), [], 730);   // een verslagen land krijgt twee jaar om op te krabbelen
    rumpArmy(c);
    if(loud && !ens.includes(me)) toast(cname(c) + ' capituleert voor ' + cname(e), '');
  }
  if(ens.includes(me) && atWar(me, c)){ queueCard({k:'surr', e:c}); toast(cname(c) + ' capituleert: beslis wat er gebeurt', 'good', 'surr' + c); }
}
// na de vrede houdt een verslagen land een klein restleger (zoals Duitsland na 1919)
function rumpArmy(c){
  if(!alive(c) || enemiesOf(c).length || G.units.some(u => u.c === c)) return;
  const own = owned(c), k = clamp(Math.round(own.length / 3), 1, 3);
  for(let i = 0; i < k && own.length; i++) spawn(c, 'inf', own[i % own.length], 70);
}
// jij eist onvoorwaardelijke overgave: de oorlog gaat door tegen milities, tot je het hele land hebt
function fightOn(e){
  const me = G.player, n = nat(e);
  n.total = 1;
  const own = owned(e), k = Math.min(8, own.length);
  for(let i = 0; i < k; i++) spawn(e, 'mil', own[i]);
  for(const x of neighbors(e)) if(x !== me) addAE(x, 8 * aeMult(e));
  toast('Onvoorwaardelijke overgave: verover de rest van ' + cname(e) + '. De buren kijken angstig toe.', 'war');
}
// jij capituleert: elke vijand houdt wat hij bezet, je leger halveert, een jaar verdrag
function capitulateMe(){
  const me = G.player, n = nat(me);
  for(const e of enemiesOf(me).slice()) settle(e, me, occBy(e, me), []);
  const mine = G.units.filter(u => u.c === me).sort((a, b) => a.hp - b.hp);
  const drop = new Set(mine.slice(0, Math.floor(mine.length / 2)).map(u => u.id));
  G.units = G.units.filter(u => !drop.has(u.id));
  n.ws = 45;
  G.stats.capd = (G.stats.capd || 0) + 1;
  clearSel();
  toast('Je capituleert: de vijand houdt wat hij bezet. Een jaar verdrag.', 'war', 'cap-me');
}
// ---- vredesconferentie ----
const REP_COST = 3, DEM_COST = 3;
function confInit(e){
  const me = G.player, occ = occBy(me, e), os = starSum(occ);
  const kills = (G.kill || {})[me + '>' + e] || 0;
  const c = {e, occ, pts: os + Math.min(os, Math.floor(kills / 2)) + 3, kills, sel:new Set(), rep:false, dem:false, preset:null};
  confPreset(c, 'alles');
  return c;
}
const confUsed = c => starSum([...c.sel]) + (c.rep ? REP_COST : 0) + (c.dem ? DEM_COST : 0);
function confPreset(c, k){
  const home = new Set(baseOf(G.player));
  c.sel = new Set(); c.rep = false; c.dem = false;
  if(k === 'alles') c.occ.forEach(p => c.sel.add(p));
  else if(k === 'grens'){ c.occ.filter(p => ADJ[p].some(q => home.has(q))).forEach(p => c.sel.add(p)); c.rep = true; }
  else if(k === 'veilig'){ c.rep = true; c.dem = true; }
  if(k === 'alles' && confUsed(c) + REP_COST <= c.pts) c.rep = true;
  if(confUsed(c) > c.pts) c.dem = false;
  if(confUsed(c) > c.pts) c.rep = false;
  c.preset = k;
}
function repAmount(e){ return Math.round((0.3 * (CN[e].f || 1) + 0.5) * 10) / 10; }
function signConf(c){
  const me = G.player, e = c.e;
  if(!atWar(me, e)) return;
  const sel = [...c.sel].filter(p => G.ctrl[p] === me);
  annexAE(e, sel, c.dem ? 2 : 0);
  let fac = 0;
  if(c.rep){
    fac = repAmount(e);
    const rem = owned(e).filter(p => !sel.includes(p)); let tot = 0; for(const p of rem) tot += G.fac[p];
    const take = Math.min(fac, tot * 0.25);   // hooguit een kwart van wat ze nog hebben; de rest betalen ze af
    if(tot > 0) for(const p of rem) G.fac[p] -= G.fac[p] / tot * take;
    addFac(me, fac);
  }
  if(c.dem) nat(e).demil = G.day + 1095;
  settle(me, e, sel, []);
  rumpArmy(e);
  G.stats.caps++;
  nat(me).ws = clamp(nat(me).ws + 10, 0, 100);
  toast('Vrede getekend met ' + cname(e) + ': ' + (sel.length ? sel.length + (sel.length === 1 ? ' provincie' : ' provincies') : 'geen land') + (fac ? ', ' + NF.format(fac) + ' fabrieken' : '') + (c.dem ? ', ontwapend' : ''), 'good');
}
// ---- onderhandelen: wat accepteert de vijand nu? ----
function dealInfo(e){
  const me = G.player, mE = meterOf(e), mM = meterOf(me), dur = G.day - (G.wars[wk(me, e)] ?? G.day);
  const occ = occBy(me, e), lost = occBy(e, me);
  const keep = mE > mM ? pickDeal(occ, Math.min(0.95, mE), me) : [];
  const white = mE >= mM - 0.05 || (dur > 365 && Math.abs(mE - mM) < 0.3);
  const give = mM > mE + 0.1 ? pickDeal(lost, mM, e) : [];
  return {mE, mM, occ, keep, white, give};
}
function playerDeal(e, kind){
  const me = G.player;
  if(!atWar(me, e)) return false;
  const d = dealInfo(e);
  if(kind === 'keep' && d.keep.length){
    annexAE(e, d.keep); settle(me, e, d.keep, []);
    G.stats.wins++; nat(me).ws = clamp(nat(me).ws + 6, 0, 100);
    toast('Vrede met ' + cname(e) + ': je houdt ' + plist(d.keep), 'good'); return true;
  }
  if(kind === 'white' && d.white){
    settle(me, e, [], []); for(const x of neighbors(e)) addAE(x, -6);
    toast('Witte vrede met ' + cname(e) + ': alles terug naar de oude grenzen', 'good'); return true;
  }
  if(kind === 'give' && d.give.length){
    settle(me, e, [], d.give);
    toast('Vrede met ' + cname(e) + ': je staat ' + plist(d.give) + ' af', 'war'); return true;
  }
  return false;
}
// ---- beslissingskaarten ----
function queueCard(cd){
  G.cards ||= [];
  if(G.cards.some(x => x.k === cd.k && x.e === cd.e)) return;
  cd.day = G.day; G.cards.push(cd);
  sfx(cd.k === 'mysurr' ? 'lose' : 'card');
  if(!G.paused){ G.paused = true; G.cardPause = true; }
  cardSig = '';
}
const cardOpen = () => !!(G && G.cards && G.cards.length);
function resolveCard(choice){
  const cd = G.cards && G.cards[0]; if(!cd) return;
  const me = G.player, e = cd.e;
  if(cd.k === 'surr' && choice === 'conf'){ cd.k = 'conf'; UI.conf = confInit(e); fitConf(e); cardSig = ''; return; }
  if(cd.k === 'conf' && choice === 'back'){ cd.k = 'surr'; UI.conf = null; cardSig = ''; return; }
  G.cards.shift(); cardSig = '';
  const c = UI.conf; UI.conf = null;
  if(cd.k === 'surr' && choice === 'fight' && atWar(me, e)) fightOn(e);
  else if(cd.k === 'conf' && choice === 'sign' && c) signConf(c);
  else if(cd.k === 'mysurr'){
    if(choice === 'yes') capitulateMe();
    else { nat(me).ws = clamp(nat(me).ws + 5, 0, 100); toast('Je vecht door tot het einde', 'war'); }
  }
  else if(cd.k === 'offer' && choice === 'yes' && atWar(me, e)){
    const give = cd.give.filter(p => G.ctrl[p] === me);
    annexAE(e, give); settle(me, e, give, []);
    G.stats.wins++; nat(me).ws = clamp(nat(me).ws + 6, 0, 100);
    toast('Vrede met ' + cname(e) + ': je krijgt ' + plist(give), 'good');
  }
  else if(cd.k === 'demand' && choice === 'yes' && atWar(me, e)){
    const take = cd.take.filter(p => G.ctrl[p] === e);
    settle(me, e, [], take);
    toast('Vrede met ' + cname(e) + ': je staat ' + plist(take) + ' af', 'war');
  }
  else if(cd.k === 'arm' && choice === 'yes' && atWar(me, e)){
    const mine = occBy(me, e);
    annexAE(e, mine); settle(me, e, mine, occBy(e, me));
    toast('Wapenstilstand met ' + cname(e) + ': iedereen houdt wat hij heeft', 'good');
  }
  if(!G.cards.length && G.cardPause){ G.cardPause = false; G.paused = false; }
}
// dagelijks: laatste verzet, overgave en volledige verovering
function warEnds(){
  baseTick();
  const me = G.player;
  for(const c of CIDS){
    if(!alive(c)) continue;
    const n = nat(c), ens = enemiesOf(c);
    if(!owned(c).length){ annex(c, ens[0] || null); continue; }
    if(!ens.length){ if(n.ls || n.sur || n.total){ n.ls = 0; n.sur = 0; n.total = 0; } continue; }
    if(n.sur || n.total) continue;
    const m = meterOf(c);
    if(m >= 0.75 && !n.ls) lastStand(c);
    else if(m >= 1 || (n.ls && m >= 0.6 && owned(c).length <= 1)){ if(c !== me) surrender(c); else if((G.mySurrCd || 0) <= G.day && !cardOpen()) surrender(c); }   // ook: alleen nog de laatste provincie
  }
  if(!G.over && !G.won){
    const share = owned(me).length / PIDS.length;
    if(share >= winShare()){ G.won = true; G.wonDay = G.day; G.paused = true; UI.winShown = true; saveBest(); toast('Overwinning: je beheerst ' + winTxt() + ' van de kaart', 'good'); flash('rgba(227,162,60,.5)'); sfx('win'); achOnWin(); }
    else if(share >= winShare()*0.85 && !G.winNear){ G.winNear = true; toast('Bijna: nog ' + (Math.ceil(PIDS.length*winShare()) - owned(me).length) + ' provincies tot de overwinning (' + Math.round(100*winShare()) + '% van de kaart)', 'good'); }
  }
}
// overwinning: deel van alle provincies; de wereldkaart is veel groter, daar ligt de lat op ruim een derde daarvan
const winShare = () => (D().win || 0.75) * (MAPNAME === 'world' ? 0.3 : 1);
const winTxt = () => winShare() >= 0.75 ? 'driekwart' : winShare() === 0.5 ? 'de helft' : Math.round(100*winShare()) + '%';
// AI-oorlogen eindigen om een reden: onderhandeling of uitputting (overgave loopt via de meter)
function aiEnds(){
  const me = G.player;
  for(const k of Object.keys(G.wars)){
    if(!(k in G.wars)) continue;
    const [a, b] = k.split('|');
    if(a === me || b === me || !alive(a) || !alive(b)) continue;
    if(nat(a).sur || nat(b).sur || nat(a).total || nat(b).total) continue;
    const ma = meterOf(a), mb = meterOf(b);
    const [w, l, mw, ml] = ma <= mb ? [a, b, ma, mb] : [b, a, mb, ma];
    const loud = MAPNAME === 'europe' || MAJORS.has(a) || MAJORS.has(b);
    if(ml >= 0.5 && ml > mw + 0.2 && nat(l).ws < 50 && (nat(w).ws < 45 || Math.random() < 0.25)){
      const deal = pickDeal(occBy(w, l), ml, w);
      if(deal.length){ endLog('onderhandeld', w, l); settle(w, l, deal, []); if(loud) toast('Vrede: ' + cname(l) + ' staat ' + deal.length + (deal.length === 1 ? ' provincie' : ' provincies') + ' af aan ' + cname(w), ''); continue; }
    }
    const quiet = G.day - Math.max(G.wars[k], (G.wlast || {})[k] || 0);
    const noFront = quiet >= 60 && !owned(a).some(p => ADJ[p].some(n => G.ctrl[n] === b));
    if(noFront || (quiet >= 150 && ((nat(a).ws < 40 && nat(b).ws < 40) || G.day - G.wars[k] > 540))){
      endLog('wapenstilstand', a, b); settle(a, b, occBy(a, b), occBy(b, a));
      if(loud) toast('Wapenstilstand: ' + cname(a) + ' en ' + cname(b) + ' zijn uitgeput', '');
    }
  }
}
// kaarten voor jou: vredesvoorstellen, eisen en wapenstilstanden
function aiCards(){
  const me = G.player; G.cardCd ||= {};
  if(cardOpen()) return;
  for(const e of enemiesOf(me)){
    if((G.cardCd[e] || 0) > G.day || nat(e).sur || nat(e).total) continue;
    const k = wk(me, e), dur = G.day - G.wars[k];
    if(dur < 45) continue;
    const mE = meterOf(e), mM = meterOf(me);
    let cd = null;
    if(mE >= 0.4 && mE > mM + 0.15 && nat(e).ws < 55){ const give = pickDeal(occBy(me, e), mE, me); if(give.length) cd = {k:'offer', e, give}; }
    else if(mM >= 0.35 && mM > mE + 0.15){ const take = pickDeal(occBy(e, me), mM, e); if(take.length) cd = {k:'demand', e, take}; }
    // niets meer te halen of vastgelopen: wapenstilstand (ook als er niets bezet is om af te staan, of als jullie elkaar niet kunnen bereiken)
    if(!cd){
      const quiet = G.day - Math.max(G.wars[k], (G.wlast || {})[k] || 0);
      const noFront = !owned(me).some(p => ADJ[p].some(n => G.ctrl[n] === e));
      if(quiet >= 45 && noFront){ const give = occBy(me, e); cd = give.length && mE >= 0.12 ? {k:'offer', e, give} : {k:'arm', e}; }   // geen front meer: wat je bezet houden, of wapenstilstand
      else if(quiet >= 150 && (nat(e).ws < 40 || nat(me).ws < 30 || dur > 300)) cd = {k:'arm', e};
    }
    if(cd){ G.cardCd[e] = G.day + 75; queueCard(cd); return; }
  }
}
function neighbors(c){
  owned(c);
  if(NBDAY !== G.day){ NB = {}; NBDAY = G.day; }
  if(NB[c]) return NB[c];
  const s = new Set();
  for(const p of owned(c)) for(const n of ADJ[p]){ const o = G.ctrl[n]; if(o !== c && !LONG.has(ek(p, n))) s.add(o); }
  return NB[c] = [...s].filter(alive);
}
function declare(a, b, joining){
  if(atWar(a,b) || !alive(a) || !alive(b)) return;
  if(G.truce && truceLeft(a, b) > 0 && a !== G.player) return;   // bestand na capitulatie
  G.wars[wk(a,b)] = G.day;
  if(G.aggr){
    const just = a !== G.player || (G.wg[b] || 0) >= G.day;
    G.aggr[wk(a,b)] = {a, just};
    if(a === G.player && !joining){
      delete G.wg[b];
      for(const x of neighbors(b)) if(x !== a) addAE(x, just ? 4 : 15);
      if(!just) nat(a).ws = clamp(nat(a).ws - 10, 0, 100);
    }
    if(!joining) nat(b).ws = clamp(nat(b).ws + 8, 0, 100);
    delete G.aiJust[a];
  }
  warsChanged();
  if(a === G.player || b === G.player) baseDirty = true;
  const loud = a === G.player || b === G.player || MAPNAME === 'europe' || MAJORS.has(a) || MAJORS.has(b);
  if(b === G.player){ toast(cname(a) + (joining ? ' sluit zich aan tegen jou' : ' verklaart jou de oorlog'), 'war'); G.paused = true; shake(); flash(); sfx('war'); }
  else if(a === G.player){ toast('Je bent in oorlog met ' + cname(b), 'war'); sfx('war'); }
  else if(loud) toast(joining ? cname(a) + ' komt ' + cname(joining) + ' te hulp tegen ' + cname(b) : cname(a) + ' verklaart ' + cname(b) + ' de oorlog', joining && joining === G.player ? 'good' : '');
  if(joining || a === G.player) return;   // tegen de speler werkt de zichtbare agressiemeter, geen dobbelsteen
  // coalitie tussen AI-landen: buren die de agressor vrezen springen bij
  const pa = armyPow(a), pb = armyPow(b);
  if(pa < 0.7*pb) return;
  let chance = D().coal * (a === G.player ? 1.25 : 0.6);
  const pool = new Set([...neighbors(a), ...neighbors(b)]);
  let joined = 0;
  for(const x of pool){
    if(joined >= G.diff + 1) break;
    if(x === a || x === b || x === G.player || atWar(x, a) || enemiesOf(x).length >= 2 || (G.truce && truceLeft(x, a) > 0)) continue;
    if(MAPNAME === 'world' && distKm(CN[x].cap, CN[b].cap) > 2500 && distKm(CN[x].cap, CN[a].cap) > 2500) continue;
    if(Math.random() < chance){ declare(x, a, b); joined++; }
  }
}
function makePeace(a, b, quiet){
  const me = G.player;
  delete G.wars[wk(a,b)]; if(G.aggr) delete G.aggr[wk(a,b)];
  if(G.kill){ delete G.kill[a + '>' + b]; delete G.kill[b + '>' + a]; }
  if(G.wlast) delete G.wlast[wk(a, b)];
  if(G.cards && (a === me || b === me)){ const o = a === me ? b : a; G.cards = G.cards.filter(cd => cd.e !== o); }
  warsChanged();
  if(a === me || b === me) baseDirty = true;
  for(const u of G.units) if(u.att && (u.c === a || u.c === b)){ const o = G.ctrl[u.att]; if(o === a || o === b){ u.att = null; u.air = false; u.path = []; } }
  for(const w of G.air) if(w.zone && (w.c === a || w.c === b)){ const o = G.ctrl[w.zone]; if(o === a || o === b) w.zone = null; }
  if(!quiet && (a === me || b === me || MAPNAME === 'europe')) toast('Vrede tussen ' + cname(a) + ' en ' + cname(b), a === me || b === me ? 'good' : '');
}

/* ================= politiek: agressie, oorlogsdoelen, oorlogssteun, doelen & score ================= */
const COAL_THR = () => D().thr + (MAPNAME === 'world' ? 5 : 0);
const AE_R = () => MAPNAME === 'world' ? 1500 : 1000;
function polInit(){
  G.ae ||= {}; G.wg ||= {}; G.aiJust ||= {}; G.aggr ||= {}; G.stats ||= {lost:0, caps:0, coal:0, wins:0};
  if(G.just === undefined) G.just = null;
  for(const c of CIDS){ const n = nat(c); if(n.ws == null) n.ws = 60; if(n.capX == null) n.capX = 0; }
  if(!G.tmpl) G.tmpl = defTmpl();
  G.cards ||= []; G.kill ||= {}; G.wlast ||= {}; G.cardCd ||= {};
  for(const c of CIDS){ const n = nat(c); delete n.broken; if(!n.base && n.alive) n.base = enemiesOf(c).length ? [...new Set([...owned(c), ...CPROV[c].filter(p => atWar(c, G.ctrl[p]))])] : owned(c).slice(); }
  if(G.cards.length && !G.paused){ G.paused = true; G.cardPause = true; }
  for(const u of G.units) if(!u.tp){ u.tp = FIXT[u.t] ? u.t : 'inf'; }
  TPC = {};
  if(!G.obj) G.obj = makeObjectives();
  if(G.start == null) G.start = {pp: nat(G.player).ppd, share: owned(G.player).length / PIDS.length};
}
const maxAE = () => { let m = 0, who = null; for(const x in G.ae) if(alive(x) && x !== G.player && !atWar(x, G.player) && G.ae[x] > m){ m = G.ae[x]; who = x; } return {m, who}; };
const hotCount = t => CIDS.filter(x => x !== G.player && alive(x) && !atWar(x, G.player) && (G.ae[x] || 0) >= t).length;
function addAE(x, v){ if(x === G.player || !alive(x)) return; G.ae[x] = clamp((G.ae[x] || 0) + v * (v > 0 ? (D().ae || 1) : 1), 0, 100); }
// verovering door de speler: buren van het slachtoffer schrikken; meer bij een verrassingsoorlog, minder als jij werd aangevallen
function aeOnCapture(p, prev){
  const me = G.player, w = G.aggr[wk(me, prev)];
  const mult = !w ? 1 : w.a === me ? (w.just ? 0.5 : 1.4) : 0.3;
  // een heel land veroveren kost ~36 agressie bij zijn buren, ongeacht in hoeveel provincies het verdeeld is
  const per = clamp(45 / Math.max(1, CPROV[prev].length), 1.5, 8);
  const nb = new Set(neighbors(prev));
  for(const x of CIDS){
    if(x === me || x === prev || !alive(x) || atWar(x, me)) continue;
    const add = nb.has(x) ? per : (distKm(CN[x].cap, p) < AE_R() ? per*0.35 : 0);
    if(add) addAE(x, add * mult * 0.4);   // de rest volgt pas als je het gebied in de vrede houdt
  }
}
function coalitionCheck(){
  const thr = COAL_THR(), me = G.player;
  // alleen landen die echt in de buurt liggen (hoofdstad dicht bij jouw gebied) doen mee; maximaal 4
  const mine = owned(me);
  const near = x => { const a = P[CN[x].cap].a; for(const p of mine){ const b = P[p].a; if(Math.hypot(a[0]-b[0], a[1]-b[1])*KM < AE_R()) return true; } return false; };
  const hot = CIDS.filter(x => x !== me && alive(x) && !atWar(x, me) && (G.ae[x] || 0) >= thr && !(G.truce && truceLeft(x, me) > 0) && near(x))
    .sort((a, b) => G.ae[b] - G.ae[a]).slice(0, 4);
  if(hot.length < 3) return;
  G.stats.coal++;
  toast('Coalitie tegen jou: ' + hot.slice(0, 4).map(cname).join(', ') + (hot.length > 4 ? ' e.a.' : '') + ' (agressie ≥ ' + thr + ')', 'war', 'coal');
  for(const x of hot){ declare(x, me, 'coal'); G.aggr[wk(x, me)] = {a:x, just:true, coal:true}; }
  G.paused = true;
}
// oorlogssteun: verdedigen schept eenheid, aanvalsoorlogen en verliezen vreten eraan
function wsTick(){
  for(const c of CIDS){
    const n = nat(c); if(!n.alive) continue;
    const ens = enemiesOf(c);
    let d;
    if(!ens.length) d = (60 - n.ws) * 0.01;
    else {
      let def = false, off = false, first = G.day;
      for(const e of ens){ const k = wk(c, e), w = G.aggr[k]; if(w && w.a === e) def = true; else off = true; if(G.wars[k] < first) first = G.wars[k]; }
      d = (def && n.ws < 70 && !n.ls ? 0.04 : 0) - (off ? 0.05 : 0) - 0.008*ens.length - (G.day - first > 365 ? 0.03 : 0)
        - (n.ls && G.day - n.ls > 20 ? 0.15 : 0);   // na het laatste verzet brokkelt de moed langzaam af
    }
    n.ws = clamp(n.ws + d, 0, 100);
  }
}
const wsMul = c => 0.6 + 0.6*nat(c).ws/100;
// doelen: geven richting en beloning; samen met gebied bepalen ze je score
function makeObjectives(){
  const me = G.player, nb = neighbors(me).filter(alive).sort((a, b) => armyPow(b) - armyPow(a));
  const sh = owned(me).length / PIDS.length;
  const o = [];
  if(nb[0]) o.push({k:'cap', c:nb[0], t:'Neem de hoofdstad van ' + cname(nb[0]) + ' in', r:'+2 fabrieken'});
  o.push({k:'pp', v:+(Math.max(2, nat(me).ppd) * 1.6).toFixed(1), t:'Groei naar ' + NF.format(Math.max(2, nat(me).ppd) * 1.6) + ' productie per dag', r:'Legerlimiet +4'});
  o.push({k:'share', v:Math.min(0.5, Math.max(sh*2.2, sh + 0.04)), t:'Beheers ' + Math.round(100*Math.min(0.5, Math.max(sh*2.2, sh + 0.04))) + '% van de kaart', r:'+50 bevelpunten, +15% oorlogssteun'});
  o.push({k:'win', t:'Win een oorlog: laat een land capituleren of sluit vrede met winst', r:'+20% oorlogssteun'});
  o.push({k:'calm', t:'Geen coalitie tegen je vóór 1 januari 1939', r:'+1 fabriek'});
  return o;
}
function addFac(c, n){   // n in capaciteit
  let left = n;
  for(let i = 0; i < 20 && left > 0.01; i++){ const p = bestFab(c); if(!p) break; const a = Math.min(left, slotFree(p)*FAB_ADD); G.fac[p] += a; left -= a; }
  if(left > 0.01){ const cap = CN[c].cap, p = G.ctrl[cap] === c ? cap : owned(c)[0]; if(p) G.fac[p] += left; }
}
function objCheck(){
  const me = G.player, n = nat(me);
  for(const o of G.obj){
    if(o.done || o.fail) continue;
    let ok = false;
    if(o.k === 'cap') ok = G.ctrl[CN[o.c].cap] === me || (!alive(o.c) && CPROV[o.c].some(p => G.ctrl[p] === me));
    else if(o.k === 'pp') ok = n.ppd >= o.v;
    else if(o.k === 'share') ok = owned(me).length / PIDS.length >= o.v;
    else if(o.k === 'win') ok = G.stats.caps + G.stats.wins > 0;
    else if(o.k === 'calm'){ if(G.stats.coal > 0) o.fail = true; else ok = G.day >= 1096; }
    if(!ok) continue;
    o.done = G.day;
    if(o.k === 'cap') addFac(me, 2*FAB_ADD);
    else if(o.k === 'pp') n.capX += 4;
    else if(o.k === 'share'){ n.cp = Math.min(100, n.cp + 50); n.ws = clamp(n.ws + 15, 0, 100); }
    else if(o.k === 'win') n.ws = clamp(n.ws + 20, 0, 100);
    else if(o.k === 'calm') addFac(me, FAB_ADD);
    toast('Doel behaald: ' + o.t + ' · ' + o.r, 'good');
  }
}
function score(){
  if(!G) return 0;
  const me = G.player, sh = owned(me).length / PIDS.length;
  const done = (G.obj || []).filter(o => o.done).length;
  return Math.max(0, Math.round(sh*1500 + done*150 + G.stats.caps*60 + (G.won ? 500 : 0) - G.stats.lost*3 - (G.stats.capd || 0)*150 - (G.over === 'lost' ? 300 : 0)));
}
const rankOf = s => s >= 1400 ? 'Goud' : s >= 800 ? 'Zilver' : s >= 350 ? 'Brons' : 'Geen medaille';
function saveBest(){
  if(G.assisted) return;   // een spel met extra voordeel of een zwakkere AI telt niet voor records
  try{
    const b = JSON.parse(localStorage.getItem('ve_best') || '{}'), k = MAPNAME + ':' + G.player, s = score();
    if(!b[k] || s > b[k]) b[k] = s;
    localStorage.setItem('ve_best', JSON.stringify(b));
  }catch(e){}
}
const bestOf = (m, c) => { try{ return JSON.parse(localStorage.getItem('ve_best') || '{}')[m + ':' + c] || 0; }catch(e){ return 0; } };
function gameOver(kind){
  G.over = kind; G.paused = true; saveBest(); shake(); flash(); sfx('lose');
  clearSel(); UI.target = null; UI.sheet = null;
  try{ localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_KEY + '.bak'); }catch(e){}   // ook de reserve, anders komt het verloren spel terug
  renderAll();
}

/* ================= meta: onderscheidingen, dagelijkse uitdaging, records ================= */
const ACH = [
  {id:'cap1',   t:'Eerste verovering',     d:'Neem een provincie in',                        ic:'vlag'},
  {id:'win1',   t:'Veldheer',              d:'Laat een land capituleren of win een vrede',  ic:'ster'},
  {id:'army50', t:'Massaleger',            d:'Heb 50 divisies tegelijk op de been',         ic:'leger'},
  {id:'ind50',  t:'Industrieel',           d:'Beheer 50 fabrieken',                          ic:'fab'},
  {id:'calm',   t:'Diplomaat',             d:'Drie jaar zonder coalitie tegen je',           ic:'vrede'},
  {id:'winE',   t:'Overwinning',           d:'Win een spel (elk niveau)',                    ic:'medaille'},
  {id:'winN',   t:'Strateeg',              d:'Win op Normaal of hoger',                      ic:'medaille'},
  {id:'winH',   t:'Meester',               d:'Win op Moeilijk of Zwaar',                     ic:'medaille'},
  {id:'small',  t:'David',                 d:'Win met een land van hoogstens 6 provincies',  ic:'schild'},
  {id:'world',  t:'Wereldmacht',           d:'Win op de wereldkaart',                        ic:'prov'},
  {id:'daily',  t:'Dagtaak',               d:'Voltooi een uitdaging van de dag',             ic:'tijd'},
  {id:'island', t:'Landing',               d:'Neem een provincie in via een zeeroute',       ic:'mar'}
];
const achGet = () => { try{ return JSON.parse(localStorage.getItem('ve_ach') || '{}'); }catch(e){ return {}; } };
function achAward(id){
  const a = achGet(); if(a[id]) return false;
  a[id] = new Date().toISOString().slice(0, 10);
  try{ localStorage.setItem('ve_ach', JSON.stringify(a)); }catch(e){}
  const x = ACH.find(z => z.id === id);
  if(x){ toast('Onderscheiding: ' + x.t + ' · ' + x.d, 'good', 'ach'); sfx('ach'); (G.newAch ||= []).push(id); }
  return true;
}
function achCheck(){
  if(!G || !G.player || !nat(G.player).alive) return;
  const me = G.player, a = achGet();
  if(!a.cap1 && owned(me).some(p => P[p].c !== me)) achAward('cap1');
  if(!a.win1 && G.stats.caps + G.stats.wins > 0) achAward('win1');
  if(!a.army50 && (UCNT[me] || 0) >= 50) achAward('army50');
  if(!a.ind50 && facTot(me) >= 50) achAward('ind50');
  if(!a.calm && G.day >= 1096 && !G.stats.coal) achAward('calm');
}
function achOnWin(){
  const me = G.player, start = CPROV[me].length;
  achAward('winE');
  if(G.diff >= 1 && !G.assisted) achAward('winN');
  if(G.diff >= 2 && !G.assisted) achAward('winH');
  if(start <= 6) achAward('small');
  if(MAPNAME === 'world') achAward('world');
  if(G.daily){ achAward('daily'); try{ const d = JSON.parse(localStorage.getItem('ve_daily') || '{}'); d[G.daily] = Math.max(d[G.daily] || 0, score()); localStorage.setItem('ve_daily', JSON.stringify(d)); }catch(e){} }
}
// uitdaging van de dag: voor iedereen hetzelfde land en niveau, bepaald door de datum
const DAILY_POOL = {
  europe:[['nl','Nederland'],['pl','Polen'],['se','Zweden'],['ro','Roemenië'],['es','Spanje'],['it','Italië'],['gb','Ver. Koninkrijk'],['fr','Frankrijk'],['de','Duitsland'],['cz','Tsjechië'],['hu','Hongarije'],['gr','Griekenland'],['pt','Portugal'],['be','België'],['dk','Denemarken'],['fi','Finland'],['no','Noorwegen'],['at','Oostenrijk'],['ua','Oekraïne'],['rs','Servië']],
  world:[['tur','Turkije'],['bra','Brazilië'],['jpn','Japan'],['egy','Egypte'],['idn','Indonesië'],['arg','Argentinië'],['mex','Mexico'],['ind','India'],['zaf','Zuid-Afrika'],['irn','Iran'],['kor','Zuid-Korea'],['vnm','Vietnam'],['aus','Australië'],['can','Canada'],['esp','Spanje'],['pol','Polen']]
};
function dailyOf(){
  const d = new Date(), key = d.toISOString().slice(0, 10);
  let h = 0; for(const ch of key) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  const map = (h >> 3) % 3 === 0 ? 'world' : 'europe', pool = DAILY_POOL[map];
  const [c, name] = pool[h % pool.length];
  return {key, map, c, name, diff: 1 + ((h >> 8) % 2)};   // Normaal of Moeilijk
}
const dailyDone = () => { try{ return !!JSON.parse(localStorage.getItem('ve_daily') || '{}')[dailyOf().key]; }catch(e){ return false; } };
