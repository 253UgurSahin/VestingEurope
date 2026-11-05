'use strict';
/* ================= AI ================= */
const ROLE = {inf:'hold', aa:'hold', art:'hold', mar:'hold', tank:'shock', mot:'shock', para:'para'};
// productie op basis van wat er ontbreekt
function aiProduce(c){
  const n = nat(c), f = CN[c].f;
  const war = enemiesOf(c);
  const cnt = {}; for(const t of UTYPES) cnt[t] = 0;
  const ut = UT[c] || {}; for(const t of UTYPES) cnt[t] = ut[t] || 0;
  const wcnt = {fi:0, cas:0, bo:0};
  const at = AT[c] || {}; for(const t in wcnt) wcnt[t] = at[t] || 0;
  // jouw generaal bouwt jouw ontwerpen: per rol het ontwerp waarin dat bataljon de hoofdrol heeft
  const tplFor = k => { if(c !== G.player || !G.tmpl) return k; for(let i = 0; i < G.tmpl.length; i++) if(domOf(G.tmpl[i].comp) === k) return 'p' + i; return k; };
  for(const q of n.q){ const kk = q.k[0] === 'p' && q.k.length <= 3 ? domOfKey(q.k) : q.k; if(cnt[kk] != null) cnt[kk]++; else if(wcnt[q.k] != null) wcnt[q.k]++; }
  let divs = UTYPES.reduce((s,t) => s + cnt[t], 0);
  const cap = armyCap(c);
  const own = owned(c);
  const front = own.filter(p => ADJ[p].some(x => war.length ? atWar(c, G.ctrl[x]) : G.ctrl[x] !== c)).length;
  let eAir = 0; const ens = new Set(war);
  for(const e of war) eAir += ACNT[e] || 0;
  const seaFront = war.length > 0 && own.some(p => (RTOUCH[p] || []).some(i => { const r = ROUTES[i], o = r[0] === p ? r[1] : r[0]; return atWar(c, G.ctrl[o]); }));
  const share = t => cnt[t] / Math.max(1, divs);
  // alleen nog vijanden overzee (of een voorbereiding overzee): dan vooral mariniers
  const px = prepOf(c);
  const landFront = own.some(p => ADJ[p].some(x => (war.length ? atWar(c, G.ctrl[x]) : G.ctrl[x] === px) && !SEA.has(ek(p, x))));
  const seaOnly = (war.length || px) && !landFront && own.some(p => ADJ[p].some(x => (war.length ? atWar(c, G.ctrl[x]) : G.ctrl[x] === px)));
  let fabOk0 = null; const fabOk = () => fabOk0 ??= fabSpots(c) > 0;
  let acap0 = null; const acap = () => acap0 ??= airCap(c);
  const airN = () => wcnt.fi + wcnt.cas + wcnt.bo;
  const techK = () => { for(const tk of ['t_arm','t_inf','t_air']) if(n.tech[ITEMS[tk].tech] < 3 && !n.q.some(q => q.k === tk)) return tk; return null; };
  // luchtmacht met een doel: genoeg jagers voor de vijand (of de sterkste buur) en het leger, wat grondaanval, een paar bommenwerpers.
  // Daarboven geen vliegtuig meer: een eskader zonder taak is weggegooide productie
  const at0 = airTarget(c, divs, war, eAir, f);
  const airQ = () => wcnt.fi < at0.fi ? 'fi' : wcnt.cas < at0.cas ? 'cas' : wcnt.bo < at0.bo ? 'bo' : null;
  while(n.q.length < 2){
    let k;
    if(divs < Math.max(3, front*1.5) && divs < cap) k = 'inf';
    else if(war.length && eAir > wcnt.fi*1.3 && wcnt.fi < at0.fi && Math.random() < 0.45) k = 'fi';
    else if(war.length && eAir > 2 && share('aa') < 0.08 && divs < cap) k = 'aa';
    else if(divs >= cap) k = airQ() || (fabOk() ? 'fab' : techK() || (n.ro < 5 && f >= 5 ? 'rocket' : null));
    else {
      const want = [['inf',0.38],['tank',f>=3?0.18:0],['art',0.14],['mot',f>=4?0.1:0],['aa',0.06],['mar',seaOnly?0.5:seaFront?0.08:0],['para',f>=5?0.04:0]];
      let best = 'inf', bd = -1;
      for(const [t,w] of want){ const d = w - share(t); if(d > bd){ bd = d; best = t; } }
      k = best;
      const r = Math.random();
      if(r < 0.12 && wcnt.fi < at0.fi) k = 'fi';
      else if(r < 0.18 && wcnt.cas < at0.cas) k = 'cas';
      else if(r < 0.22 && wcnt.bo < at0.bo) k = 'bo';
      else if(r < 0.30 && !war.length) k = 'fab';
      else if(r < 0.34){ const tk = ['t_inf','t_arm','t_air'][Math.floor(Math.random()*3)]; if(n.tech[ITEMS[tk].tech] < 3 && !n.q.some(q => q.k === tk)) k = tk; }
      else if(r < 0.36 && f >= 7) k = 'rocket';
    }
    if(k === 'fab' && !fabOk()) k = techK() || airQ() || (divs < cap ? 'inf' : null);
    if(wcnt[k] != null && airN() >= acap()) k = fabOk() ? 'fab' : techK() || (divs < cap ? 'inf' : null);
    if(!k) break;
    n.q.push({k: cnt[k] != null ? tplFor(k) : k, p:0});
    if(k === 'fab') fabOk0 = null;
    if(cnt[k] != null){ cnt[k]++; divs++; } else if(wcnt[k] != null) wcnt[k]++;
  }
}
// hoeveel vliegtuigen wil een land? jagers: genoeg tegen de vijand (in oorlog) of de sterkste buur (in vrede), en naar het leger;
// grondaanval vanaf 3 fabrieken, bommenwerpers vanaf 4 (alleen in oorlog). Alles binnen de vliegveldcapaciteit.
function airTarget(c, divs, war, eAir, f){
  const cap = airCap(c);
  let nb = 0; if(!war.length) for(const x of neighbors(c)) if(alive(x)) nb = Math.max(nb, ACNT[x] || 0);
  const fi = Math.round(Math.max(3, 0.3*divs, war.length ? 1.25*eAir : 0.7*nb));
  const cas = f >= 3 && divs >= 8 ? Math.round(0.1*divs) + (war.length ? 1 : 0) : 0;
  const bo = f >= 4 && war.length ? Math.round(0.04*divs) : 0;
  const tot = fi + cas + bo, k = tot > cap ? cap / tot : 1;
  return {fi: Math.floor(fi*k), cas: Math.floor(cas*k), bo: Math.floor(bo*k)};
}
// legerleiding: het hele leger doet mee. Eerst aanvallen waar het kan, dan wordt de rest over het front verdeeld
// (naar dreiging, breedte en kansen); pantser gaat naar de zwakke plekken van de vijand.
function aiArmy(c){
  if(c === G.player) for(const u of UBY[c] || []) if(u.man && !u.path.length && !u.att) u.man = false;   // bevel uitgevoerd: de generaal neemt het weer over
  const mine = (UBY[c] || []).filter(u => c !== G.player || !u.man);   // lopende bevelen van jou gaan voor
  if(!mine.length) return;
  const own = owned(c);
  const auto = c === G.player;
  const ens = enemiesOf(c);
  if(!ens.length){ aiGarrison(c, mine, own); return; }
  const front = own.filter(p => ADJ[p].some(n => atWar(c, G.ctrl[n])));
  if(!front.length){ aiParas(c); if(auto) noFront(ens); aiGarrison(c, mine, own); return; }   // geen front: dan toch de gevaarlijke grenzen bewaken
  const frontSet = new Set(front);
  const BREAK = {}; for(const e of ens) BREAK[e] = meterOf(e);   // breekt de vijand? dan doordrukken
  // vijandelijke provincies langs het front: verdediging, eigen aanvalskracht, waarde
  const TI = {};
  const tinfo = n => {
    let t = TI[n]; if(t) return t;
    let d = 0, a = 0, cnt = 0;
    const dv = [];
    for(const v of IDX[n] || []) if(v.c === G.ctrl[n]){ dv.push(defPlain(v, n)); a += atkPlain(v); cnt++; }
    const W = widthOf(n);
    if(dv.length > W){ dv.sort((x, y) => y - x); for(let i = 0; i < W; i++) d += dv[i]; d *= 1 + 0.04*Math.min(10, dv.length - W); }   // reserves vallen in: iets meer nodig
    else for(const x of dv) d += x;
    return TI[n] = {n, d, a, cnt, st: starOf(n), push: (BREAK[G.ctrl[n]] || 0) >= 0.6, W};
  };
  // tegenkracht rond provincie n: wie daar na een verovering op ons kan inhakken
  const CT = {};
  const ctOf = n => { let v = CT[n]; if(v !== undefined) return v; v = 0; for(const m of ADJ[n]) if(atWar(c, G.ctrl[m])) v += tinfo(m).a * (SEA.has(ek(n, m)) ? 0.5 : 1); return CT[n] = v; };
  const threat = {}, airT = {}, hold = {}, opp = {}, wid = {}, seaF = {};
  for(const f of front){
    let t = 1, o = 0, w = 0, sea = false;
    for(const n of ADJ[f]){
      if(!atWar(c, G.ctrl[n])) continue;
      const ti = tinfo(n), s = SEA.has(ek(f, n)), m = s ? 0.5 : 1;
      t += ti.a * m; w += m; if(s) sea = true;
      o += (ti.st + (ti.push ? 1 : 0)) * m / (1 + ti.d * (s ? 1.8 : 1) / 8);   // waardevol en zwak verdedigd = kans
    }
    let a = 0; for(const e of ens) a += cover(e, f, 'cas') + cover(e, f, 'bo');
    threat[f] = t; airT[f] = a; hold[f] = 0; opp[f] = o; wid[f] = w; seaF[f] = sea;
  }
  for(const u of mine) if(hold[u.loc] !== undefined && !u.path.length && !u.att && ROLE[u.t] === 'hold') hold[u.loc] += defPlain(u, u.loc);
  // 1) gewonden terugtrekken om te herstellen, als het front dat toelaat
  for(const u of mine){
    if(u.att || u.path.length || u.hp >= 50 || !frontSet.has(u.loc)) continue;
    const back = ADJ[u.loc].find(n => G.ctrl[n] === c && !frontSet.has(n) && !LONG.has(ek(u.loc, n)));
    const d = ROLE[u.t] === 'hold' ? defPlain(u, u.loc) : 0;
    if(back && hold[u.loc] - d > threat[u.loc]*0.4){ u.path = [back]; u.prog = 0; hold[u.loc] -= d; }
  }
  // 2) aanvallen: per vijandelijke provincie werken alle aangrenzende frontstukken samen (concentratie),
  //    per doel genoeg voor een duidelijke overmacht, de rest gaat naar het volgende doel
  const engaged = {};
  for(const u of mine) if(u.att) engaged[u.att] = (engaged[u.att] || 0) + atkPlain(u);
  const gc = auto ? genCfg() : null;
  const focus = gc && gc.focus && atWar(c, gc.focus) ? gc.focus : null;
  const need = (auto ? (gc.mode === 'att' ? 1.15 : gc.mode === 'def' ? 1.8 : 1.3) : D().need) * 0.7;   // ×0,7: de verdediging blokkeert, maar schiet terug met minder
  // in de verdediging (vijand duidelijk sterker, of jouw opdracht): eerst het front houden, alleen aanvallen met duidelijke overmacht
  let enP = 0; for(const e of ens) enP += armyPow(e);
  const defensive = gc && gc.mode === 'def' ? true : gc && gc.mode === 'att' ? false : armyPow(c) < enP * 0.9;
  if(focus) for(const f of front) if(ADJ[f].some(n => G.ctrl[n] === focus)) opp[f] = opp[f] * 3 + 1;   // hoofddoel: daar de kansen
  const avail = new Map();   // frontstuk -> vrije troepen en wie blijft staan
  for(const f of front){
    const here = [];
    for(const u of IDX[f] || []) if(u.c === c && !u.att && !u.path.length && u.hp > 50 && u.t !== 'para' && !(auto && u.man)) here.push(u);
    if(!here.length) continue;
    // houders blijven staan: genoeg verdediging tegen wat er tegenover ligt
    const keep = new Set(); let kd = 0;
    for(const h of here.filter(x => x.t === 'inf' || x.t === 'aa').sort((a,b) => defPlain(b, f) - defPlain(a, f))){ if(kd >= threat[f]*(defensive ? 1 : 0.6)) break; keep.add(h); kd += defPlain(h, f); }
    avail.set(f, {here, keep});
  }
  const used = new Set();
  const plans = [], seenT = new Set();
  for(const f of avail.keys()) for(const n of ADJ[f]) if(!seenT.has(n) && atWar(c, G.ctrl[n])){
    seenT.add(n);
    if(gc && gc.mode === 'def' && P[n].c !== c && !((BREAK[G.ctrl[n]] || 0) >= 0.6)) continue;   // opdracht verdedigen: alleen eigen grond terug
    const fs = []; for(const g of ADJ[n]) if(avail.has(g)) fs.push(g);
    let tm = 0; for(const g of fs) tm = Math.max(tm, terrMod(g, n));
    plans.push({n, ti: tinfo(n), fs, tm: tm || 1});
  }
  // lege provincies: snel bezetten, pantser eerst; vanaf een grote stapel met twee man
  for(const pl of plans){
    if(pl.ti.cnt) continue;
    const fs = pl.fs.map(f => [f, avail.get(f).here.filter(x => !used.has(x))]).sort((a,b) => b[1].length - a[1].length);
    const k = fs.length && fs[0][1].length >= 16 ? 2 : 1;
    let sent = 0;
    for(const [f, pool0] of fs){
      if(sent >= k) break;
      const sea = SEA.has(ek(f, pl.n));
      if(sea && !pool0.some(x => x.t === 'mar') && pool0.length < 3) continue;
      while(sent < k){
        const pool = pool0.filter(x => !used.has(x));
        const fast = pool.filter(x => ROLE[x.t] === 'shock').sort((a,b) => BAT[b.t].s - BAT[a.t].s);
        const u = fast[0] || ((pool.length > 1 || threat[f] < 2) ? pool.find(x => x.t === 'inf' || x.t === 'mar') : null);
        if(!u) break;
        if(ctOf(pl.n) > defPlain(u, pl.n) * 2.5 && pl.ti.st < 3) break;   // een val: de vijand staat er in overmacht omheen
        const path = [pl.n];
        if(ROLE[u.t] === 'shock'){
          const deeper = ADJ[pl.n].find(m => m !== f && atWar(c, G.ctrl[m]) && !tinfo(m).cnt && !SEA.has(ek(pl.n, m)) && ctOf(m) <= defPlain(u, m) * 1.5);
          if(deeper) path.push(deeper);
        }
        u.path = path; u.prog = 0; used.add(u); sent++;
      }
    }
    if(sent) continue;
    // niemand naast het doel vrij: iemand van een frontstuk ernaast loopt er via dat stuk naartoe
    for(const g of ADJ[pl.n]){
      if(sent || !frontSet.has(g) || SEA.has(ek(g, pl.n))) continue;
      for(const h of ADJ[g]){
        const a = avail.get(h); if(!a || h === g) continue;
        const pool = a.here.filter(x => !used.has(x));
        if(pool.length < 2 && threat[h] >= 2) continue;
        const u = pool.filter(x => ROLE[x.t] === 'shock').sort((a,b) => BAT[b.t].s - BAT[a.t].s)[0] || pool.find(x => x.t === 'inf' || x.t === 'mar');
        if(!u || (ctOf(pl.n) > defPlain(u, pl.n) * 2.5 && pl.ti.st < 3)) continue;
        u.path = [g, pl.n]; u.prog = 0; used.add(u); sent++; break;
      }
    }
  }
  // verdedigde provincies: zwakst verdedigd (naar waarde) eerst
  const pw = (x, f, n) => atkPlain(x) * seaMul(x, f, n) * atkMods(x, f, n);
  const engW = {};
  const cands = pl => {
    const out = [];
    for(const f of pl.fs){
      const a = avail.get(f), sea = SEA.has(ek(f, pl.n));
      for(const x of a.here){ if(used.has(x) || a.keep.has(x) || x.t === 'aa' || (sea && x.t === 'art')) continue; out.push([x, pw(x, f, pl.n)]); }
    }
    return out;
  };
  const hit = [];
  for(const pl of plans.filter(pl => pl.ti.cnt).sort((a,b) => (focus ? (G.ctrl[b.n] === focus) - (G.ctrl[a.n] === focus) : 0) || a.ti.d/a.tm/(1 + 0.3*(a.ti.st - 1)) - b.ti.d/b.tm/(1 + 0.3*(b.ti.st - 1)))){   // terrein, rivier en stad meegewogen
    const t = pl.ti, cs = cands(pl);
    if(!cs.some(([x]) => x.t !== 'art')) continue;
    const eng = engaged[pl.n] || 0;
    let total = eng; for(const [, v] of cs) total += v;
    // meer divisies dan de verdediger verdelen de klappen: tegen een kleine bezetting is minder kracht nodig (Lanchester)
    const lan = clamp(Math.min(t.cnt, t.W) / Math.max(1, Math.min(cs.length, t.W)), 0.35, 1);
    const min = t.d * need * (t.push ? 0.85 : 1) * lan;
    if(!(total > min || (eng && total > t.d*0.9*lan))) continue;
    // 2:1 geeft veel minder eigen verlies: eerst één doel goed, met wat overblijft het volgende
    const goal = Math.max(min, t.d * 2.2 * lan);
    cs.sort((a,b) => b[1] - a[1]);
    // na de verovering staat de groep zonder ingraven tussen de vijand: genoeg verdediging meenemen, anders niet beginnen
    const ct = ctOf(pl.n), bold = t.push || t.st >= 3;
    let got = eng, real = false, dsum = 0, wu = engW[pl.n] || 0; const go = [];
    for(const [x, v] of cs){ if(got >= goal && real && (bold || dsum*1.5 >= ct)) break; if(wu >= t.W + 2) break; go.push(x); got += v; wu += uWid(x, x.loc, pl.n); dsum += defPlain(x, pl.n) * 0.8; if(x.t !== 'art') real = true; }
    engW[pl.n] = wu;
    if(!bold && dsum*1.5 < ct && !eng) continue;
    for(const x of go){ x.att = pl.n; x.path = []; x.prog = 0; used.add(x); }
    engaged[pl.n] = got; hit.push(pl);
  }
  // wat over is steunt de lopende aanvallen tot 2:1 (de zwakste aanval eerst); de rest blijft als reserve
  if(hit.length && !defensive){
    const pools = new Map(hit.map(pl => [pl, cands(pl).sort((a,b) => b[1] - a[1])]));
    for(;;){
      let best = null, br = 2.2;
      for(const pl of hit){
        const r = engaged[pl.n] / pl.ti.d; if(r >= br || (engW[pl.n] || 0) >= pl.ti.W + 2) continue;
        const cs = pools.get(pl); while(cs.length && used.has(cs[0][0])) cs.shift();
        if(cs.length){ br = r; best = pl; }
      }
      if(!best) break;
      const [x, v] = pools.get(best).shift();
      x.att = best.n; x.path = []; x.prog = 0; used.add(x); engaged[best.n] += v; engW[best.n] = (engW[best.n] || 0) + uWid(x, x.loc, best.n);
    }
  }
  // 3) het hele leger over het front verdelen: verdediging naar dreiging, de rest naar breedte en kansen
  const land = mine.filter(u => u.t !== 'para');
  // grenzen met dreigende buren bewaken: voor jou altijd, de AI alleen als ze iets voorbereidt (anders sterkt elke AI-oorlog af)
  const wb = auto || prepOf(c) ? watchBorders(c, own, true) : {prep: null, w: new Map()}, alloc = front.slice();
  for(const [p, v] of wb.w){
    if(frontSet.has(p)) continue;
    alloc.push(p); threat[p] = 1 + v * (wb.prep && ADJ[p].some(n => G.ctrl[n] === wb.prep) ? 12 : 4); wid[p] = 0.15; opp[p] = 0; airT[p] = 0; seaF[p] = false;
  }
  const allocSet = new Set(alloc);
  let nS = 0; for(const u of land) if(ROLE[u.t] === 'shock') nS++;
  const nH = land.length - nS;
  let sT = 0, sW = 0, sO = 0;
  for(const f of alloc){ sT += threat[f]; sW += wid[f]; sO += opp[f]; }
  const tH = {}, tS = {};
  const wT = defensive ? 0.8 : 0.5, wW = defensive ? 0.2 : 0.3, wO = defensive ? 0 : 0.2;
  for(const f of alloc){ tH[f] = nH * (wT*threat[f]/sT + wW*wid[f]/sW + wO*(sO > 0 ? opp[f]/sO : 1/alloc.length)); tS[f] = 0; }
  // pantser als speerpunten waar de vijand het zwakst is: één speerpunt per ~10 pantserdivisies
  if(nS){
    const K = Math.max(1, Math.min(front.length, Math.ceil(nS / 10)));
    const spear = front.slice().sort((a,b) => opp[b] - opp[a]).slice(0, K);
    let s = 0; for(const f of spear) s += opp[f] + 0.05;
    for(const f of spear) tS[f] = nS * (opp[f] + 0.05) / s;
  }
  // niet meer troepen op een stuk dan de aanvoer aankan (aan het front mag het iets voller: de buren voeden mee)
  for(const f of alloc){ const m = supCap(f, c) * (frontSet.has(f) ? FRONT_MUL : 1), t = tH[f] + tS[f]; if(t > m){ tH[f] *= m/t; tS[f] *= m/t; } }
  const defH = {}, defS = {};
  for(const f of alloc){ defH[f] = tH[f]; defS[f] = tS[f]; }
  for(const u of land){
    const dst = u.path.length ? u.path[u.path.length - 1] : u.loc;
    if(defH[dst] === undefined) continue;
    if(ROLE[u.t] === 'shock') defS[dst]--; else defH[dst]--;
  }
  const movers = [];
  for(const u of land) if(!u.att && !u.path.length && !allocSet.has(u.loc) && u.hp >= 60) movers.push(u);   // achterland (gewonden herstellen eerst)
  // pantser op een frontstuk met weinig kansen schuift door naar een speerpunt
  if(nS){
    let bestO = 0; for(const f of front) if(tS[f] > 0 && opp[f] > bestO) bestO = opp[f];
    for(const f of front){
      if(tS[f] > 0 || opp[f] >= bestO*0.67) continue;
      for(const u of IDX[f] || []) if(u.c === c && ROLE[u.t] === 'shock' && !u.att && !u.path.length && u.hp >= 60 && !(auto && u.man)) movers.push(u);
    }
  }
  // overvolle frontstukken geven troepen af aan stukken die tekortkomen
  for(const f of alloc){
    // alleen bij een echte opstopping (meer dan twee keer het deel plus 6): dan terug tot anderhalf keer
    const hH = tH[f] - defH[f], hS = tS[f] - defS[f];
    let rh = hH > 2*tH[f] + 6 ? Math.floor(hH - 1.5*tH[f] - 3) : 0, rs = hS > 2*tS[f] + 6 ? Math.floor(hS - 1.5*tS[f] - 3) : 0;
    if(!frontSet.has(f)){ rh = Math.max(rh, Math.floor(hH - Math.ceil(tH[f]) - 0.5)); rs = Math.max(rs, Math.floor(hS - tS[f])); }   // bewaakte grens (geen front): overschot gaat meteen naar het front
    if(rh < 1 && rs < 1) continue;
    for(const u of IDX[f] || []){
      if(u.c !== c || u.att || u.path.length || u.hp < 60 || u.t === 'para' || u.t === 'aa' || (auto && u.man)) continue;
      if(ROLE[u.t] === 'shock'){ if(rs > 0){ movers.push(u); rs--; } }
      else if(rh > 0){ movers.push(u); rh--; }
      if(rh < 1 && rs < 1) break;
    }
  }
  // opmars in echelons: het gebied tot twee stappen achter het front is het verzamelgebied. Daar past maar zoveel (aanvoer);
  // wat er niet in past wacht in de rug als reserve, binnen de aanvoer, en schuift op zodra er plek komt
  const stage = new Set(alloc);
  { const q = [...alloc], dd = new Map(q.map(f => [f, 0]));
    for(let i = 0; i < q.length; i++){ const x = q[i], dx = dd.get(x) + 1; if(dx > 2) continue; for(const n of ADJ[x]) if(!dd.has(n) && G.ctrl[n] === c && !LONG.has(ek(x, n))){ dd.set(n, dx); q.push(n); stage.add(n); } } }
  const stDest = stackAt(c);
  let room = 0; const roomAt = new Map();
  for(const p of stage){ const r = (frontSet.has(p) ? Math.floor(supCap(p, c) * FRONT_MUL) + 1 : Math.floor(supCap(p, c))) - (stDest[p] || 0); if(r > 0 && SUP[p] !== 0){ room += r; if(!allocSet.has(p)) roomAt.set(p, r); } }
  let inFlight = 0; for(const u of land) if(u.path.length && !u.att && !stage.has(u.loc) && stage.has(u.path[u.path.length - 1])) inFlight++;
  let budget = Math.max(0, room - inFlight);
  if(auto && land.length > 40 && (G.bigT || 0) <= G.day){
    let fcap = 0; for(const f of front) fcap += Math.floor(supCap(f, c) * FRONT_MUL);
    if(land.length > 2.5 * fcap + 10){ G.bigT = G.day + 120; toast('Generaal: het front (' + front.length + ' provincie' + (front.length === 1 ? '' : 's') + ') voedt hooguit ~' + fcap + ' divisies; de rest staat in reserve. Meer front = een tweede oorlog of een aanval over zee', 'war', 'bigarmy'); }
  }
  if(movers.length && budget > 0){
    movers.sort((a, b) => b.hp - a.hp);
    if(movers.length > budget) movers.length = budget;
    // afstanden over eigen gebied vanaf elk frontstuk dat troepen nodig heeft (stopt zodra alle wachtenden gevonden zijn)
    const needF = alloc.filter(f => defH[f] > 0.25 || defS[f] > 0.25).sort((a,b) => Math.max(defH[b], defS[b]) - Math.max(defH[a], defS[a])).slice(0, 40);
    const locs = new Set(movers.map(u => u.loc));
    const DF = new Map();
    for(const f of needF){
      const dist = new Map([[f, 0]]), par = new Map(), q = [f];
      let left = locs.size - (locs.has(f) ? 1 : 0);
      for(let i = 0; i < q.length && left > 0; i++){
        const x = q[i], dx = dist.get(x) + 1;
        for(const n of ADJ[x]){
          if(dist.has(n) || G.ctrl[n] !== c) continue;
          dist.set(n, dx); par.set(n, x); q.push(n);
          if(locs.has(n)) left--;
        }
      }
      DF.set(f, {dist, par});
    }
    const routes = new Map();
    for(const u of new Set(movers)){
      const shock = ROLE[u.t] === 'shock';
      let best = null, bs = 0;
      for(const f of needF){
        if(f === u.loc) continue;
        const d = DF.get(f).dist.get(u.loc); if(d === undefined) continue;   // geen route (eiland, ingesloten): niet meetellen
        let w = shock ? defS[f] : defH[f];
        if(u.t === 'aa') w += airT[f]; else if(u.t === 'mar' && seaF[f]) w += 2;
        if(w <= 0.25) continue;
        const s = w / (3 + d);
        if(s > bs){ bs = s; best = f; }
      }
      if(!best) continue;
      const key = u.loc + '>' + best;
      let path = routes.get(key);
      if(!path){ path = []; const par = DF.get(best).par; let x = u.loc; while(x !== best){ x = par.get(x); path.push(x); } routes.set(key, path); }
      u.path = path.slice(); u.prog = 0; budget--;
      const from = u.loc;
      if(shock){ defS[best]--; if(defS[from] !== undefined) defS[from]++; }
      else { defH[best]--; if(defH[from] !== undefined) defH[from]++; }
    }
    // wie geen frontstuk kreeg: naar de tweede linie (verzamelgebied met ruimte), zodat de aflossing dichtbij staat
    if(budget > 0 && roomAt.size){
      const rest = movers.filter(u => !u.path.length && !stage.has(u.loc)).slice(0, budget);
      if(rest.length) sendTo(c, rest, roomAt);
    }
  }
  // 5) logistiek: wie te vol staat (ook na een verovering), schuift naar een plek met aanvoer
  decongest(c);
  // 4) parachutisten vlak achter het front klaarzetten
  let pm = 0;
  for(const u of mine){
    if(u.t !== 'para' || u.att || u.path.length || u.hp < 60) continue;
    let dest = null;
    if(frontSet.has(u.loc)) dest = ADJ[u.loc].find(n => G.ctrl[n] === c && !frontSet.has(n)) || null;
    else {
      let nd = Infinity, nf = null;
      for(const f of front){ const k = distKm(u.loc, f); if(k < nd){ nd = k; nf = f; } }
      if(nf && nd > PARA_KM*0.7){ dest = nf; const ins = ADJ[nf].find(n => G.ctrl[n] === c && !frontSet.has(n)); if(ins) dest = ins; }
    }
    if(!dest || dest === u.loc) continue;
    const path = findPath(c, u.loc, dest, false);
    if(path){ u.path = path; u.prog = 0; if(++pm >= 6) break; }
  }
  aiParas(c);
}
// aanvalsmodifier van terrein, rivier en stad voor gewone infanterie (voor de keuze waar de generaal aanvalt)
const TMU = {t:'inf', air:false, tp:null};
const terrMod = (f, n) => atkMods(TMU, f, n);
// opdrachten van de speler aan de generaal
function genCfg(){ return G.gen ||= {mode:'bal', focus:null, prep:null, prod:true, air:true, act:true}; }
// tegen wie bereidt land c zich voor? jouw opdracht, een oorlogsdoel in de maak of klaar; de AI als ze jou de oorlog gaat verklaren
function prepOf(c){
  if(c === G.player){
    const g = genCfg();
    if(g.prep && G.nations[g.prep] && alive(g.prep) && !atWar(c, g.prep)) return g.prep;
    if(G.just && alive(G.just.c) && !atWar(c, G.just.c)) return G.just.c;
    for(const x in G.wg) if(G.wg[x] >= G.day && alive(x) && !atWar(c, x)) return x;
    return null;
  }
  return G.aiJust && G.aiJust[c] != null && alive(G.player) && !atWar(c, G.player) ? G.player : null;
}
// grensprovincies met buren waar het mis kan gaan (niet in oorlog), met gewicht: sterkte, oorlogsplannen, angst, voorbereiding
function watchBorders(c, own, calm){
  const prep = prepOf(c), myP = Math.max(1, armyPow(c)), dz = {}, w = new Map();
  const danger = x => {
    if(dz[x] !== undefined) return dz[x];
    let d = clamp(armyPow(x) / myP, 0.15, 3);
    if(x === prep) d = d*3 + 3;
    else if(c === G.player && G.aiJust && G.aiJust[x] != null) d = d*2 + 2;          // bereidt een oorlog tegen jou voor
    else if(c !== G.player && x === G.player && G.just && G.just.c === c) d = d*2 + 1;   // jij bereidt er een voor
    else if(c === G.player && (G.ae[x] || 0) >= COAL_THR()*0.7) d *= 1.5;               // bang en boos: coalitiegevaar
    else if(G.truce && truceLeft(c, x) > 60) d *= 0.25;                                  // verdrag: rustig
    else if(calm) d = 0;                                                                  // in oorlog: rustige buren kosten geen troepen
    return dz[x] = d;
  };
  for(const p of own){
    let v = 0;
    for(const n of ADJ[p]){ const x = G.ctrl[n]; if(x === c || !G.nations[x] || !alive(x) || atWar(c, x) || !danger(x)) continue; v += danger(x) * (LONG.has(ek(p, n)) ? (x === prep ? 0.5 : 0.08) : SEA.has(ek(p, n)) ? 0.4 : 1); }
    if(v > 0) w.set(p, v);
  }
  return {prep, w};
}
// stuur troepen naar doelprovincies met een tekort (afstand over eigen gebied; wie geen route heeft blijft staan)
function sendTo(c, movers, need){
  const needF = [...need.keys()].filter(f => need.get(f) > 0.25).sort((a,b) => need.get(b) - need.get(a)).slice(0, 40);
  if(!needF.length || !movers.length) return 0;
  const locs = new Set(movers.map(u => u.loc)), DF = new Map();
  for(const f of needF){
    const dist = new Map([[f, 0]]), par = new Map(), q = [f];
    let left = locs.size - (locs.has(f) ? 1 : 0);
    for(let i = 0; i < q.length && left > 0; i++){
      const x = q[i], dx = dist.get(x) + 1;
      for(const n of ADJ[x]){ if(dist.has(n) || G.ctrl[n] !== c) continue; dist.set(n, dx); par.set(n, x); q.push(n); if(locs.has(n)) left--; }
    }
    DF.set(f, {dist, par});
  }
  const routes = new Map(); let moved = 0;
  for(const u of movers){
    let best = null, bs = 0;
    for(const f of needF){
      if(f === u.loc) continue;
      const d = DF.get(f).dist.get(u.loc); if(d === undefined) continue;
      const v = need.get(f); if(v <= 0.25) continue;
      const sc = v / (3 + d); if(sc > bs){ bs = sc; best = f; }
    }
    if(!best) continue;
    const key = u.loc + '>' + best; let path = routes.get(key);
    if(!path){ path = []; const par = DF.get(best).par; let x = u.loc; while(x !== best){ x = par.get(x); path.push(x); } routes.set(key, path); }
    u.path = path.slice(); u.prog = 0; moved++;
    need.set(best, need.get(best) - 1); if(need.has(u.loc)) need.set(u.loc, need.get(u.loc) + 1);
  }
  return moved;
}
/* opmarsplan: bij voorbereiden gaat ~85% van het leger naar de grens met het doelland (eerste linie, wat niet past
   in de tweede linie erachter); overzee naar de havens met een zeeroute erheen, mariniers voorop. De rest bewaakt
   de andere gevaarlijke grenzen. Alles binnen de aanvoer, zodat niemand slijt. */
function prepZones(c, x){
  const B = new Map(), S = new Map();
  for(const p of owned(c)){
    let v = 0, sea = false;
    for(const n of ADJ[p]){
      if(G.ctrl[n] !== x) continue;
      const e = ek(p, n), w = LONG.has(e) ? 0.5 : SEA.has(e) ? 0.7 : 1;
      if(SEA.has(e)) sea = true;
      v = Math.max(v, w * (1 + 0.4*(starOf(n) - 1)) * (TER[n] === 'm' ? 0.6 : 1));
    }
    if(v) B.set(p, {v, sea});
  }
  for(const [p, b] of B) for(const n of ADJ[p]) if(G.ctrl[n] === c && !B.has(n) && !SEA.has(ek(p, n))) S.set(n, Math.max(S.get(n) || 0, b.v * 0.6));
  const T = new Map();   // derde linie: wat niet aan de grens past staat één stap verder klaar
  for(const [p, v] of S) for(const n of ADJ[p]) if(G.ctrl[n] === c && !B.has(n) && !S.has(n) && !SEA.has(ek(p, n))) T.set(n, Math.max(T.get(n) || 0, v * 0.6));
  return {B, S, T};
}
// hoeveel divisies passen er in de opmarszones (binnen de aanvoer)?
function prepFit(c, z){ let f = 0; for(const m of [z.B, z.S, z.T]) for(const p of m.keys()) f += Math.floor(supCap(p, c)); return f; }
function prepPlan(c, x, own, land){
  const {B, S, T} = prepZones(c, x);
  if(!B.size) return null;
  const share = Math.round(land.length * 0.85);
  const bw = new Map(); for(const [p, b] of B) bw.set(p, b.v);
  const need = capFill(c, bw, share, 1);
  let used = 0; for(const v of need.values()) used += v;
  for(const L of [S, T]) if(used < share - 0.5 && L.size){ const n2 = capFill(c, L, share - used); for(const [p, v] of n2){ need.set(p, (need.get(p) || 0) + v); used += v; } }
  const {w} = watchBorders(c, own);
  const rest = new Map(); for(const [p, v] of w) if(!need.has(p)) rest.set(p, v);
  if(rest.size){ const n3 = capFill(c, rest, Math.max(0, land.length - used)); for(const [p, v] of n3) need.set(p, v); }
  return {need, sea: [...B].some(([, b]) => b.sea)};
}
// in vrede: het leger staat aan de grenzen waar het gevaar zit, en marcheert vooraf op naar het land dat je wilt aanvallen
let GARR = {g: null};
function aiGarrison(c, mine, own){
  const land = mine.filter(u => u.t !== 'para');
  if(!land.length) return;
  if(GARR.g !== G) GARR = {g: G};
  const sig = CTRLV + ':' + land.length + ':' + prepOf(c) + ':' + Math.floor(G.day / 30) + ':' + land.filter(u => !u.path.length && !u.att).length;
  if(GARR[c] === sig) return;   // niets veranderd sinds de vorige keer dat er niets te doen was
  // de AI herschikt in vrede eens per maand (tenzij ze een oorlog voorbereidt): rust in het leger en in de rekentijd
  if(c !== G.player && !prepOf(c) && (GARR['t' + c] || -99) > G.day - 30) return;
  GARR['t' + c] = G.day;
  const px = prepOf(c), plan = px ? prepPlan(c, px, own, land) : null;
  const {w} = plan ? {w: plan.need} : watchBorders(c, own);
  if(!w.size){ decongest(c); return; }
  let W = 0; for(const v of w.values()) W += v;
  const need = plan ? new Map(plan.need) : capFill(c, w, land.length);
  for(const u of land){ const d = u.path.length ? u.path[u.path.length - 1] : u.loc; if(need.has(d)) need.set(d, need.get(d) - 1); }
  const movers = [];
  for(const u of land){
    if(u.path.length || u.att || u.hp < 50 || (c === G.player && u.man)) continue;
    if(!need.has(u.loc)) movers.push(u);
    else if(need.get(u.loc) < -Math.max(1, Math.min(3, land.length * w.get(u.loc) / W))){ movers.push(u); need.set(u.loc, need.get(u.loc) + 1); }
  }
  // overzee: mariniers eerst naar de havens; pantser eerst (komt als eerste over land door)
  if(plan) movers.sort((a, b) => plan.sea ? frOf(b).mar - frOf(a).mar : (ROLE[b.t] === 'shock') - (ROLE[a.t] === 'shock'));
  const moved = sendTo(c, movers, need);
  decongest(c);
  if(!moved) GARR[c] = sig;
}
// hoeveel van je leger staat klaar aan de grens met x (of is daarheen onderweg)?
function prepInfo(c, x){
  const z = prepZones(c, x), bp = new Set([...z.B.keys(), ...z.S.keys(), ...z.T.keys()]);
  let tot = 0, at = 0;
  for(const u of G.units){ if(u.c !== c || u.t === 'para') continue; tot++; const d = u.path.length ? u.path[u.path.length - 1] : u.loc; if(bp.has(d)) at++; }
  const fit = z.B.size ? prepFit(c, z) : 0, want = Math.min(tot, fit);
  return {at, tot, fit, want, none: !z.B.size, r: want ? Math.min(1, at / want) : 0};
}
// klaar = het deel van wat er aan de grens past (niet van het hele leger: bij een groot leger past er nooit alles)
function prepReady(c, x){ return prepInfo(c, x).r; }
// wat doet de generaal met je troepen? (voor het overzicht)
function genStatus(c){
  const own = owned(c), front = new Set();
  for(const p of own) if(ADJ[p].some(n => atWar(c, G.ctrl[n]))) front.add(p);
  const reach = new Set(front), q = [...front];
  for(let i = 0; i < q.length; i++) for(const n of ADJ[q[i]]) if(!reach.has(n) && G.ctrl[n] === c){ reach.add(n); q.push(n); }
  const st = {front: front.size, att:0, mv:0, fr:0, rest:0, res:0, stuck:0, man:0};
  for(const u of G.units){
    if(u.c !== c) continue;
    if(u.man){ st.man++; continue; }
    if(u.att) st.att++;
    else if(u.path.length) st.mv++;
    else if(front.has(u.loc)) st.fr++;
    else if(u.hp < 60) st.rest++;
    else if(front.size && !reach.has(u.loc)) st.stuck++;
    else st.res++;
  }
  return st;
}
function genStatusH(c){
  if(!enemiesOf(c).length){
    return '';   // in vrede staat de voorbereiding bij de opdrachten
  }
  const st = genStatus(c);
  if(!st.front) return '<div class="genst"><span class="bad">Geen front: jullie grenzen nergens aan elkaar, ook niet over zee</span></div>';
  const it = (v, t, cls, tip) => v ? '<span' + (cls ? ' class="' + cls + '"' : '') + (tip ? ' title="' + tip + '"' : '') + '><b>' + v + '</b>' + t + '</span>' : '';
  return '<div class="genst">' + it(st.att, 'in de aanval') + it(st.mv, 'onderweg') + it(st.fr, 'houden het front')
    + it(st.rest, 'herstellen', '', 'Gewond in het achterland: ze gaan terug zodra ze weer op sterkte zijn')
    + it(st.res, 'reserve', '', 'Wachten in de rug (binnen de aanvoer) tot er plek is aan het front; wie het dichtst bij staat gaat eerst')
    + it(st.stuck, 'kunnen nergens heen', 'bad', 'Op een eiland of afgesneden: geen route over land naar het front')
    + it(st.man, 'op jouw bevel') + '</div>' + airStatusH(c);
}
// wat doet de luchtmacht van de generaal? (voor het overzicht)
function airStatusH(c){
  const W = G.air.filter(w => w.c === c && !w.dead); if(!W.length) return '';
  const nm = {fi:'jagers', cas:'grondaanval', bo:'bommenwerpers'}, parts = [];
  for(const t of ['fi', 'cas', 'bo']){
    const ws = W.filter(w => w.t === t); if(!ws.length) continue;
    const up = ws.filter(w => w.zone), zones = {}; for(const w of up) zones[w.zone] = (zones[w.zone] || 0) + 1;
    const top = Object.entries(zones).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([z, n]) => esc(P[z].n) + (n < up.length ? ' (' + n + ')' : ''));
    parts.push('<b>' + ws.length + '</b> ' + nm[t] + (up.length ? ' boven ' + top.join(', ') : ' aan de grond'));
  }
  const eng = (G.airEng || {})[c], man = W.filter(w => w.man).length;
  const why = !eng && W.some(w => w.t === 'fi') ? '<span class="bad" title="Gebundeld winnen jagers het luchtgevecht; apart worden ze stuk voor stuk neergeschoten. Hij wacht op versterking (meer jagers in de wachtrij)">vijand sterker in de lucht: hij wacht</span>' : '';
  return '<div class="genst">' + parts.map(p => '<span>' + p + '</span>').join('') + why + (man ? '<span><b>' + man + '</b> op jouw bevel</span>' : '') + '</div>';
}
// opdrachten aan de generaal: houding, hoofddoel, voorbereiden, wat hij nog meer regelt
function genOrdersH(me){
  const g = genCfg(), ens = enemiesOf(me), prep = prepOf(me);
  const seg = (k, l, tip) => '<button class="gseg' + (g.mode === k ? ' on' : '') + '" data-gen="mode:' + k + '" title="' + tip + '">' + l + '</button>';
  let h = '<div class="gord"><span class="gl">Houding</span><span class="gsegs">' + seg('att', 'Aanval', 'Meer en eerder aanvallen, ook met kleinere overmacht') + seg('bal', 'Evenwichtig', 'Aanvallen waar het kan, verdedigen waar het moet') + seg('def', 'Verdediging', 'Front houden; alleen eigen grond terugnemen') + '</span></div>';
  if(ens.length > 1 || g.focus){
    h += '<div class="gord"><span class="gl">Hoofddoel</span><span class="gsegs">' + '<button class="gseg' + (!g.focus || !atWar(me, g.focus) ? ' on' : '') + '" data-gen="focus:">Alle</button>'
      + ens.slice(0, 4).map(e => '<button class="gseg' + (g.focus === e ? ' on' : '') + '" data-gen="focus:' + e + '">' + esc(cname(e)) + '</button>').join('') + '</span></div>';
  }
  if(prep){ const pi = prepInfo(me, prep);
    const txt = pi.none ? '<span class="bad">geen grens met ' + esc(cname(prep)) + ', ook niet over zee: opmars onmogelijk</span>' : esc(cname(prep)) + ' · ' + pct(pi.r) + '% klaar' + (pi.fit < pi.tot ? ' <small>(' + pi.at + ' van de ' + pi.fit + ' die aan de grens passen; ' + (pi.tot - pi.fit) + ' in reserve)</small>' : '');
    h += '<div class="gord"><span class="gl">Voorbereiden</span><span class="gsegs"><span class="gprep">' + txt + '</span>' + (g.prep === prep ? '<button class="gseg" data-gen="prep:" title="Stop met voorbereiden">×</button>' : '') + '</span></div>'; }
  const tg = (k, l) => '<button class="gseg' + (g[k] ? ' on' : '') + '" data-gen="own:' + k + '">' + l + '</button>';
  h += '<div class="gord"><span class="gl">Regelt ook</span><span class="gsegs">' + tg('prod', 'Productie') + tg('air', 'Luchtmacht') + tg('act', 'Acties') + '</span></div>';
  return h;
}
// jouw generaal kan niets: de vijand grenst nergens aan je gebied (ook niet over zee)
function noFront(ens){
  if((G.nfT || 0) > G.day) return;
  G.nfT = G.day + 90;
  toast('Generaal: geen front met ' + ens.slice(0, 2).map(cname).join(' en ') + '. Jullie grenzen nergens aan elkaar, ook niet over zee.', 'war', 'nofront');
}
// parachutisten: lege waardevolle provincies of bijspringen in een krappe aanval
function aiParas(c){
  const paras = (UBY[c] || []).filter(u => u.t === 'para' && !(c === G.player && u.man) && !u.att && !u.path.length && (u.dropCd||0) <= G.day && u.hp > 60);
  if(!paras.length || !enemiesOf(c).length) return;
  const fr = frontier(c, 3);
  const attacking = new Set((UBY[c] || []).filter(v => v.att).map(v => v.att));
  for(const u of paras){
    let best = null, bs = 0;
    for(const p of fr){
      if(!canDrop(u, p)) continue;
      const ds = defendersAt(p);
      const s = ds.length ? (attacking.has(p) ? 1.5 : 0) : 2 + G.fac[p]*2 + (CN[G.ctrl[p]] && CN[G.ctrl[p]].cap === p ? 6 : 0);
      if(s > bs){ bs = s; best = p; }
    }
    if(best && Math.random() < 0.6) doDrop(u, best);
  }
}
// luchtmacht als één vuist: jagers samen boven het brandpunt (gebundeld winnen ze het luchtgevecht), grondaanval alleen waar
// de jagers dekken, bommenwerpers op industrie zonder jagers erboven. Basis schuift mee naar het front. Te zwak in de lucht?
// Dan blijven ze thuis in plaats van stuk voor stuk neergeschoten te worden. Jouw eigen zone-bevelen (man) laat hij staan.
function aiAir(c){
  const all = AIRBY ? (AIRBY[c] || []) : G.air.filter(w => w.c === c);
  const wings = all.filter(w => !w.dead && !(c === G.player && w.man));
  if(!wings.length) return;
  const ens = enemiesOf(c);
  if(!ens.length){ for(const w of wings) w.zone = null; return; }
  const ensSet = new Set(ens), own = owned(c);
  const front = own.filter(p => ADJ[p].some(n => atWar(c, G.ctrl[n])));
  const tA = 1 + 0.15*nat(c).tech.air;
  // vijandelijke jagers: wie hangt er nu rond een plek, en wie kan er binnen een dag zijn (vanaf zijn basis)? Allebei tellen mee:
  // een jager die er nu niet is, komt zodra het gevecht begint
  const eF = []; for(const w of G.air) if(ensSet.has(w.c) && !w.dead && w.t === 'fi' && w.hp > 0) eF.push([w.z, w.base, w.hp/100 * (1 + 0.15*nat(w.c).tech.air)]);
  const EFC = new Map(), reach = AIR.fi.range + 2*ZONE_KM;
  const eFiAt = p => { let v = EFC.get(p); if(v !== undefined) return v; v = 0; for(const [z, b, s] of eF) v += dist(z, p) <= 2*RZ ? s : distKm(b, p) <= reach ? 0.7*s : 0; EFC.set(p, v); return v; };
  const nearE = p => { for(const [z] of eF) if(dist(z, p) <= 2*RZ) return true; return false; };   // nu onder vijandelijke jagers
  const myFi = wings.filter(w => w.t === 'fi' && w.hp >= 40), myFiPow = myFi.reduce((s, w) => s + w.hp/100, 0) * tA;
  // brandpunten: eigen aanvallen zwaar, eigen verdediging, gebombardeerde eigen provincies
  const hot = new Map();
  for(const b of G.battles){ if(b.att === c) hot.set(b.t, (hot.get(b.t) || 0) + 3); else if(b.def === c) hot.set(b.t, (hot.get(b.t) || 0) + 2); }
  for(const u of UBY[c] || []) if(u.att && !hot.has(u.att)) hot.set(u.att, 1.5);
  for(const w of G.air) if(ensSet.has(w.c) && !w.dead && w.t !== 'fi' && G.ctrl[w.z] === c) hot.set(w.z, (hot.get(w.z) || 0) + 2);
  if(!hot.size) for(const f of front) hot.set(f, 1);
  if(!hot.size){ for(const w of wings) w.zone = null; return; }
  // de vuist: de plek waar binnen één zone het meest gebeurt; een tweede vuist als er ver weg nog een brandpunt is en er genoeg eskaders zijn
  const clus = p => { let s = 0; for(const [q, v] of hot) if(dist(p, q) <= RZ) s += v; return s; };
  const hubs = [...hot.keys()].map(p => [p, clus(p)]).sort((a, b) => b[1] - a[1]);
  const H = [hubs[0][0]];
  if(wings.length >= 8){ const h2 = hubs.find(([p]) => dist(p, H[0]) > 2*RZ); if(h2 && h2[1] >= hubs[0][1]*0.4) H.push(h2[0]); }
  // basis dicht bij de vuist (eigen provincie met aanvoer, liefst net achter het front)
  const BC = new Map();
  const baseFor = hub => { let b = BC.get(hub); if(b) return b; let bd = Infinity;
    for(const p of own){ if(SUP[p] === 0) continue; const d = distKm(p, hub) + (front.includes(p) ? 120 : 0); if(d < bd){ bd = d; b = p; } }
    BC.set(hub, b); return b; };
  const hubOf = w => { if(H.length === 1) return H[0]; return H[(w.id % 2 === 0) ? 0 : 1]; };   // vaste verdeling: geen gezwabber tussen de vuisten
  // het gevecht aangaan? alleen als de jagers het luchtgevecht boven de vuist aankunnen (boven eigen land iets eerder).
  // Te zwak: iedereen blijft aan de grond, op een basis buiten het bereik van de vijandelijke jagers, tot er versterking is
  // (met geheugen: wie vecht, houdt vol tot 0,8×; wie thuiszit, gaat pas weer op bij 1,1×. Anders zwabbert de basis heen en weer)
  const AE = (G.airEng ||= {}), was = AE[c] || 0, engage = {}; let any = false;
  for(const h of H){ const e = eFiAt(h), ok = myFiPow >= (was ? 0.8 : 1.1) * e; engage[h] = ok; if(ok) any = true; }
  AE[c] = any ? 1 : 0;
  let safe; const safeBase = hub => { if(safe !== undefined) return safe; safe = null; let bs = Infinity;
    for(const p of own){ if(SUP[p] === 0) continue; const s = eFiAt(p) * 1000 + distKm(p, hub); if(s < bs){ bs = s; safe = p; } }   // zo min mogelijk vijandelijke jagers in bereik, dan zo dicht mogelijk bij de vuist
    return safe; };
  for(const w of wings){
    const hub = hubOf(w), range = AIR[w.t].range;
    if(!engage[hub]){ w.zone = null; if(eFiAt(w.base) > 0){ const sb = safeBase(hub); if(sb && sb !== w.base && eFiAt(sb) < eFiAt(w.base)) w.base = sb; } continue; }
    if(distKm(w.base, hub) > range*0.85){ const nb = baseFor(hub); if(nb && nb !== w.base && distKm(nb, hub) < distKm(w.base, hub)){ w.base = nb; w.zone = null; continue; } }
    const inR = p => distKm(w.base, p) <= range;
    if(w.hp < 40){ w.zone = null; continue; }   // bijkomen op de basis
    if(w.t === 'fi'){
      w.zone = inR(hub) ? hub : null;   // alle jagers samen boven de vuist
    } else if(w.t === 'cas'){
      // grondaanval waar wij aanvallen, alleen onder eigen jagerdekking (zonder dekking wordt hij afgeschoten)
      let best = null, bs = 0;
      for(const [p, v] of hot){ if(!inR(p) || !atWar(c, G.ctrl[p])) continue; const e = eFiAt(p); if(e > myFiPow*1.2 + 0.5) continue; const s = v / (1 + dist(p, hub)/RZ); if(s > bs){ bs = s; best = p; } }
      w.zone = best;
    } else {
      // bommenwerpers: industrie in bereik zonder vijandelijke jagers erboven, dichtbij de vuist eerst
      let best = null, bs = 0;
      for(const p of frontier(c, 5)){ if(!inR(p) || !G.fac[p]) continue; const e = eFiAt(p); if(e > myFiPow*0.8 + 0.5) continue; const s = G.fac[p] / (1 + dist(p, hub)/(2*RZ)); if(s > bs){ bs = s; best = p; } }
      w.zone = best;
    }
  }
}
function aiDeclare(c){
  if(G.day < 90) return;
  if(G.aiJust && G.aiJust[c] != null && G.day > G.aiJust[c] + 150) delete G.aiJust[c];   // verlopen oorlogsdoel
  if(enemiesOf(c).length >= (MAJORS.has(c) ? 2 : 1)) return;
  const my = armyPow(c);
  const share = owned(G.player).length / PIDS.length;
  const feared = share >= 0.12;
  const cands = neighbors(c).filter(x => {
    if(atWar(c,x) || (G.truce && truceLeft(c, x) > 0)) return false;
    if(x === G.player){
      if(G.day < D().grace) return false;
      return my > (feared ? (D().fear || 1.1) : (D().prey || 2)) * armyPow(x);   // op Makkelijk valt de AI je alleen aan met grote overmacht
    }
    return my > 2*armyPow(x);
  });
  if(!cands.length) return;
  cands.sort((a,b) => (b === G.player && feared) - (a === G.player && feared) || armyPow(a) - armyPow(b));
  let ch = (MAJORS.has(c) ? 0.14 : 0.05) * D().decl;
  if(cands[0] === G.player && feared) ch *= 2;
  if(MAPNAME === 'world') ch *= 0.6;
  if(cands[0] === G.player){
    // net als jij moet de AI eerst een oorlogsdoel rechtvaardigen: je ziet het 30 dagen van tevoren aankomen
    const j = G.aiJust[c];
    if(j != null){ if(G.day >= j) declare(c, G.player); return; }
    if(Math.random() < ch){ G.aiJust[c] = G.day + 30; toast(cname(c) + ' rechtvaardigt een oorlog tegen jou (30 dagen)', 'war', 'just' + c); }
    return;
  }
  if(Math.random() < ch) declare(c, cands[0]);
}
function aiSpecials(c){
  const n = nat(c);
  if(!enemiesOf(c).length){
    if(n.cp >= 60 && Math.random() < 0.05){
      const fr = owned(c).filter(p => ADJ[p].some(q => G.ctrl[q] !== c) && (G.forts[p]||0) < 2);
      if(fr.length) doSpecial(c, 'bunker', fr[Math.floor(Math.random()*fr.length)]);
    }
    return;
  }
  const fr = frontier(c, 2);
  const hot = km => {
    let best = null, bs = 0;
    for(const p of fr){
      if(!atWar(c, G.ctrl[p])) continue;
      const ds = defendersAt(p); if(!ds.length) continue;
      if(minDistOwned(c, p) > km) continue;
      const s = ds.reduce((x,v) => x + v.hp, 0); if(s > bs){ bs = s; best = p; }
    }
    return best;
  };
  if(n.ro > 0 && ready(c,'rocket') && Math.random() < 0.5){ const t = hot(SPECIALS.rocket.km); if(t) doSpecial(c,'rocket',t); }
  if(ready(c,'blitz') && (UBY[c] || []).filter(u => u.att).length >= 3 && Math.random() < 0.3) doSpecial(c,'blitz',null);
  if(ready(c,'mobil') && enemiesOf(c).length && (UCNT[c] || 0) >= armyCap(c) - 1 && Math.random() < 0.3) doSpecial(c,'mobil',null);
  if(ready(c,'sabot') && Math.random() < 0.15){
    const t = fr.filter(p => minDistOwned(c,p) <= SPECIALS.sabot.km).sort((a,b) => G.fac[b] - G.fac[a])[0];
    if(t) doSpecial(c,'sabot',t);
  }
}

/* ================= routes ================= */
function findPath(c, from, to, allowEnemy){
  if(from === to) return [];
  const ok = n => G.ctrl[n] === c || (allowEnemy && atWar(c, G.ctrl[n]));
  if(!ok(to)) return null;
  if(allowEnemy){
    // spelersbevel: liefst via eigen gebied, vijandelijk/zee-stappen tellen zwaarder (kleine Dijkstra)
    const dd = {[from]: 0}, prev = {}, done = new Set(), heap = [[0, from]];
    const push = (k, v) => { heap.push([k, v]); let i = heap.length - 1; while(i > 0){ const j = (i - 1) >> 1; if(heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if(heap.length){ heap[0] = last; let i = 0; for(;;){ const l = 2*i + 1, r2 = l + 1; let m = i; if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r2 < heap.length && heap[r2][0] < heap[m][0]) m = r2; if(m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    while(heap.length){
      const x = pop()[1];
      if(done.has(x)) continue; done.add(x);
      if(x === to){ const path = []; let y = to; while(y !== from){ path.push(y); y = prev[y]; } return path.reverse(); }
      for(const n of ADJ[x]){
        if(done.has(n) || !ok(n)) continue;
        const own = G.ctrl[n] === c;
        const w = (own ? 1 : 3.5) + (SEA.has(ek(x, n)) ? 2 : 0) + (n !== to && !own && (IDX[n] || []).some(v => v.c === G.ctrl[n]) ? 6 : 0);
        const nd = dd[x] + w;
        if(dd[n] === undefined || nd < dd[n]){ dd[n] = nd; prev[n] = x; push(nd, n); }
      }
    }
    return null;
  }
  const prev = {[from]: null}, q = [from];
  for(let i=0; i<q.length; i++){
    const x = q[i];
    for(const n of ADJ[x]){
      if(n in prev || !ok(n)) continue;
      prev[n] = x;
      if(n === to){ const path = [n]; let y = x; while(y !== from){ path.unshift(y); y = prev[y]; } return path; }
      q.push(n);
    }
  }
  return null;
}
function minDistOwned(c, p){
  let m = Infinity;
  for(const q of owned(c)){ const d = dist(p,q); if(d < m) m = d; }
  return m * KM;
}
function frontier(c, hops){
  let cur = new Set();
  for(const q of owned(c)) for(const n of ADJ[q]) if(atWar(c, G.ctrl[n])) cur.add(n);
  const all = new Set(cur);
  for(let h = 1; h < hops; h++){ const nx = new Set(); for(const p of cur) for(const n of ADJ[p]) if(!all.has(n) && atWar(c, G.ctrl[n])){ nx.add(n); all.add(n); } cur = nx; }
  return [...all];
}

/* ================= speciale acties ================= */
function ready(c, k){ const n = nat(c), s = SPECIALS[k]; return n.cp >= s.cp && (n.cd[k] || 0) <= G.day && (k !== 'rocket' || n.ro > 0); }
function specStatus(c, k){
  const n = nat(c), s = SPECIALS[k];
  if((n.cd[k]||0) > G.day) return 'Nog ' + Math.ceil(n.cd[k] - G.day) + ' d';
  if(k === 'rocket' && n.ro < 1) return 'Bouw eerst een raket';
  if((k === 'rocket' || k === 'sabot') && !enemiesOf(c).length) return 'Niet in oorlog';
  if(n.cp < s.cp) return 'Te weinig bevelpunten';
  return '';
}
function validTarget(c, k, p){
  if(k === 'drop') return [...UI.sel].some(id => { const u = unitById(id); return u && canDrop(u, p); });
  const s = SPECIALS[k];
  if(k === 'bunker') return G.ctrl[p] === c && (G.forts[p]||0) < 3;
  if(!atWar(c, G.ctrl[p])) return false;
  return minDistOwned(c, p) <= s.km;
}
function doSpecial(c, k, p){
  const n = nat(c), s = SPECIALS[k];
  if(!ready(c,k)) return false;
  if(p && !validTarget(c, k, p)) return false;
  n.cp -= s.cp; n.cd[k] = G.day + s.cd;
  const vic = p ? G.ctrl[p] : null;
  let msg = '';
  if(k === 'rocket'){
    n.ro--; buildIdx();
    const ds = defendersAt(p); let lost = 0;
    for(const d of ds){ const h0 = d.hp; d.hp = Math.max(3, d.hp - 30); lost += h0 - d.hp; d.ent = 0; }
    G.fac[p] = Math.max(0, G.fac[p] - 0.3); G.dmg[p] = G.day + 45;
    fx(p, 'bomb');
    msg = ds.length ? ds.length + ' divisie' + (ds.length === 1 ? '' : 's') + ' samen −' + Math.round(lost) + '% sterkte, ingraven weg, industrie 45 dagen half' : 'industrie 45 dagen half stil';
  } else if(k === 'sabot'){
    G.dmg[p] = G.day + 60; G.fac[p] = Math.max(0, G.fac[p] - 0.15); fx(p, 'bomb');
    msg = NF.format(facN(p)) + ' fabrieken 60 dagen half stil';
  } else if(k === 'blitz'){ n.blitz = G.day + 15; msg = 'al je divisies +35% aanval tot ' + fmtDate(G.day + 15); }
  else if(k === 'mobil'){ const a0 = armyCap(c); n.mobil = G.day + 180; msg = 'legerlimiet ' + a0 + ' → ' + armyCap(c) + ' tot ' + fmtDate(G.day + 180); }
  else if(k === 'bunker'){ G.forts[p] = (G.forts[p]||0) + 1; fx(p, 'bunker'); msg = 'niveau ' + G.forts[p] + ': verdediging +' + 20*G.forts[p] + '% (artillerie van de vijand breekt er doorheen)'; }
  if(c === G.player) toast(s.name + (p ? ' · ' + P[p].n : '') + ': ' + msg, 'good');
  else if(vic === G.player) toast(cname(c) + ': ' + s.name.toLowerCase() + ' op ' + P[p].n, 'war');
  return true;
}
