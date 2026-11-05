'use strict';
/* ================= spelregels ================= */
const UTYPES = ['inf','mot','tank','art','mar','para','aa'];
const ROLE_TXT = {inf:'Front houden', mot:'Snel doorstoten', tank:'Zware aanval', art:'Vuursteun bij aanval', mar:'Aanvallen over zee', para:'Luchtlanding', aa:'Tegen vliegtuigen',
  fi:'Luchtoverwicht', cas:'Steunt gevechten', bo:'Bombardeert industrie', fab:'Alles sneller bouwen', rocket:'Munitie raketaanval',
  t_inf:'+12% infanterie e.a.', t_arm:'+15% pantser & gemot.', t_air:'+15% luchtmacht'};
const UDESC = {inf:'goedkoop, sterk in verdediging', mot:'snel, voor doorbraken', tank:'+60% aanval in open terrein, zwak in bergen en steden', art:'tot +120% tegen bunkers, steden, heuvels en ingegraven troepen',
  mar:'landen zonder straf (gewone troepen −40%)', para:'luchtlanding: verrast verdedigers of snijdt hun aanvoer af', aa:'neemt de vijandelijke luchtsteun weg'};
const AIR = {
  fi: {name:'Jagers',        pp:120, range:750,  desc:'luchtoverwicht boven hun zone'},
  cas:{name:'Grondaanval',   pp:140, range:550,  desc:'steunen gevechten in hun zone'},
  bo: {name:'Bommenwerpers', pp:170, range:1400, desc:'bombarderen industrie in hun zone'}
};
const ZONE_KM = 280, PARA_KM = 480;
const ITEMS = {};
/* ---- divisies bestaan uit bataljons (sterk versimpelde HOI4-divisies) ---- */
const BAT = {
  inf: {name:'Infanterie',    a:1.3, d:2.8, s:30, pp:12, tech:'inf'},
  mot: {name:'Gemotoriseerd', a:1.7, d:2.3, s:55, pp:20, tech:'arm'},
  tank:{name:'Pantser',       a:4.6, d:2.0, s:52, pp:34, tech:'arm'},
  art: {name:'Artillerie',    a:3.6, d:1.3, s:26, pp:18, tech:'inf'},
  mar: {name:'Mariniers',     a:2.0, d:2.3, s:30, pp:20, tech:'inf'},
  para:{name:'Parachutisten', a:2.3, d:2.0, s:30, pp:24, tech:'inf'},
  aa:  {name:'Luchtafweer',   a:0.7, d:2.0, s:50, pp:15, tech:'inf'}
};
const BDESC = {inf:'houdt het front, goedkoop', mot:'snel; in bergen en steden zwak zoals pantser', tank:'tot +60% aanval in open terrein, zwak in bergen, moeras en steden', art:'tot +120% tegen bunkers, steden, heuvels, bergen en ingraven', mar:'landen zonder straf (anderen −40%)', para:'landt achter de linie: verrast (−25%) of snijdt aanvoer af', aa:'per bataljon −5% vijandelijke luchtsteun'};
// vaste ontwerpen (gebruikt door de AI; mariniers en para's ook door jou)
const FIXT = {
  inf: {name:'Infanterie 7-2',    comp:{inf:7, art:2}},
  mot: {name:'Gemotoriseerd 6-2', comp:{mot:6, tank:2}},
  tank:{name:'Pantser 5-4',       comp:{tank:5, mot:3, aa:1}},
  art: {name:'Artillerie 4-5',    comp:{inf:4, art:5}},
  mar: {name:'Mariniers 7-2',     comp:{mar:7, art:2}},
  para:{name:'Para 8',            comp:{para:8}},
  aa:  {name:'Luchtafweer 4-5',   comp:{inf:4, aa:5}},
  mil: {name:'Militie',           comp:{inf:4}, t:'inf'}   // noodtoestand: gratis, licht
};
const totBat = comp => Object.values(comp).reduce((x, y) => x + y, 0);
function domOf(comp){ let best = 'inf', bn = -1; for(const k of UTYPES) if((comp[k] || 0) > bn){ bn = comp[k] || 0; best = k; } return best; }
function autoName(comp){ const d = domOf(comp), rest = totBat(comp) - comp[d]; return BAT[d].name + ' ' + comp[d] + (rest ? '-' + rest : ''); }
const defTmpl = () => [ {name:'Infanterie 7-2', comp:{inf:7, art:2}}, {name:'Pantser 5-4', comp:{tank:5, mot:3, aa:1}}, {name:'Infanterie 5-2', comp:{inf:5, aa:2}} ];
const compByKey = tp => tp[0] === 'p' && tp.length <= 3 ? (G.tmpl[+tp.slice(1)] || G.tmpl[0]).comp : FIXT[tp].comp;
const compOf = u => compByKey(u.tp);
const domOfKey = tp => tp[0] === 'p' && tp.length <= 3 ? domOf(compByKey(tp)) : (FIXT[tp] && FIXT[tp].t) || tp;
function tplCost(tp){ const c = compByKey(tp); let t2 = 0; for(const k in c) t2 += BAT[k].pp * c[k]; return t2; }
// divisiestats per land (met techniek), gecachet; leeggemaakt per dag en bij ontwerp- of techwijziging
let TPC = {};
function tstat(c, tp){
  const m = (TPC[c] ||= {});
  if(m[tp]) return m[tp];
  const comp = compByKey(tp), t = nat(c).tech;
  let ai2 = 0, ar = 0, di = 0, dr = 0, sp = 999;
  for(const k in comp){
    const b2 = BAT[k], n2 = comp[k];
    if(b2.tech === 'arm'){ ar += b2.a*n2; dr += b2.d*n2; } else { ai2 += b2.a*n2; di += b2.d*n2; }
    sp = Math.min(sp, b2.s);
  }
  const tot = totBat(comp) || 1, fq = k => (comp[k] || 0) / tot;
  return m[tp] = { a: ai2*(1 + 0.12*t.inf) + ar*(1 + 0.15*t.arm), d: di*(1 + 0.12*t.inf) + dr*(1 + 0.15*t.arm), s: sp === 999 ? 30 : sp,
    fr: {arm: fq('tank') + fq('mot'), tank: fq('tank'), art: fq('art'), aa: fq('aa'), mar: fq('mar'), para: fq('para')} };
}
for(const t of UTYPES) ITEMS[t] = {name:FIXT[t].name, get pp(){ return tplCost(t); }, kind:'unit'};
for(const i2 of [0, 1, 2]) ITEMS['p' + i2] = {kind:'unit', get name(){ return G && G.tmpl ? G.tmpl[i2].name : 'Ontwerp'; }, get pp(){ return tplCost('p' + i2); }};
for(const t in AIR) ITEMS[t] = {name:AIR[t].name, pp:AIR[t].pp, kind:'air'};
ITEMS.rocket = {name:'Raket', pp:150, kind:'rocket'};
ITEMS.fab = {name:'Fabriek', pp:200, kind:'fab'};
const FAB_ADD = 1.5;   // één fabriek = 1,5 capaciteit = +0,9 productie per dag
/* ---- bouwplekken (zoals HOI4): elke provincie heeft een vast aantal plekken voor fabrieken.
   Dorp 2, grote stad 5, hoofdstad of wereldstad 8; grote provincies +1, piepkleine 1.
   Vol = verder groeien kan alleen met nieuw land. ---- */
let SLOTS = {};
function initSlots(){
  SLOTS = {};
  const ars = PIDS.map(p => P[p].ar || 0).sort((a, b) => a - b), med = ars[ars.length >> 1] || 1, big = ars[Math.floor(ars.length*0.9)] || 1;
  for(const p of PIDS){
    const st = STAR[p] || 1, ar = P[p].ar || 0;
    let n = st >= 3 ? 8 : st === 2 ? 5 : 2;
    if(ar >= big) n++; else if(st === 1 && ar < med*0.15) n = 1;
    SLOTS[p] = n;
  }
}
const facN = p => (G.fac[p] || 0) / FAB_ADD;                     // aantal fabrieken in een provincie
const slotFree = p => Math.max(0, (SLOTS[p] || 0) - facN(p)) || 0;
const FAB_MIN = 0.05;   // ook een restje plek telt: de fabriek vult de plek dan helemaal
const slotSpots = p => { const f = slotFree(p); return f < FAB_MIN ? 0 : Math.ceil(f - FAB_MIN); };   // hoeveel fabrieken er nog bij kunnen
// veroverd land: eerst bezet (weinig opbrengst), na een jaar zonder oorlog met de oude eigenaar geïntegreerd
const INTEG = 365;
const integDays = c => c === G.player ? (D().integ || INTEG) : INTEG;
const heldSince = p => (G.hold || {})[p] ?? -1e9;
const integ0 = p => { const c = G.ctrl[p], o = P[p].c; return o !== c && G.day - heldSince(p) >= integDays(c) && !atWar(c, o); };
// per dag gecachet (bezit en oorlogen veranderen zelden binnen een dag; bij verandering wordt de cache geleegd)
let INTC = {day:-1, v:-1, w:-1, m:{}};
const integ = p => { if(INTC.day !== G.day || INTC.v !== CTRLV || INTC.w !== WARV || INTC.g !== G) INTC = {day:G.day, v:CTRLV, w:WARV, g:G, m:{}}; let r = INTC.m[p]; if(r === undefined) r = INTC.m[p] = integ0(p); return r; };
const yieldOf = p => P[p].c === G.ctrl[p] ? 1 : integ(p) ? 0.75 : 0.4;   // fabrieksopbrengst
const manOf = p => P[p].c === G.ctrl[p] ? 1 : integ(p) ? 0.7 : 0.3;      // mankracht
const provState = p => P[p].c === G.ctrl[p] ? 'kern' : integ(p) ? 'geïntegreerd' : 'bezet';
function integLeft(p){ const c = G.ctrl[p], o = P[p].c; if(o === c || integ(p)) return 0; return atWar(c, o) ? -1 : Math.max(1, Math.ceil(integDays(c) - (G.day - heldSince(p)))); }
// waar komt een nieuwe fabriek? De beste vrije plek: eigen land eerst, liefst niet aan het front
function fabSpots(c){
  const res = {};   // plekken die al door de wachtrij zijn geclaimd
  let loose = 0;
  for(const q of nat(c).q) if(q.k === 'fab'){ if(q.at) res[q.at] = (res[q.at] || 0) + 1; else loose++; }
  let free = 0;   // per provincie tellen zoals een fabriek echt geplaatst wordt (vanaf een halve plek)
  for(const p of owned(c)) free += Math.max(0, slotSpots(p) - (res[p] || 0));
  return free - loose;
}
function bestFab(c, skip){
  let best = null, bs = -1e9;
  for(const p of owned(c)){
    const fr = slotFree(p); if(fr < FAB_MIN || p === skip) continue;
    const front = ADJ[p].some(n => G.ctrl[n] !== c && atWar(c, G.ctrl[n]));
    const sc = yieldOf(p)*10 + (front ? -6 : 0) + (SUP[p] === 0 ? -20 : 0) + (fr >= 0.95 ? 4 : 0) + Math.min(fr, 3)*0.3 + (CN[c].cap === p ? 0.5 : 0);
    if(sc > bs){ bs = sc; best = p; }
  }
  return best;
}
let FTC = {day:-1, m:{}};
function facTot(c){ if(FTC.day !== G.day || FTC.g !== G) FTC = {day:G.day, g:G, m:{}}; const v = FTC.m[c]; if(v != null) return v; let t = 0; for(const p of owned(c)) t += facN(p) * yieldOf(p); return FTC.m[c] = t; }
function slotTot(c){ let u = 0, t = 0; for(const p of owned(c)){ u += facN(p); t += SLOTS[p] || 0; } return [u, t]; }
// luchtmacht: vliegtuigen hebben fabrieken nodig
function airCap(c){ return Math.round((4 + facTot(c)*0.8) * (c === G.player ? (D().meCap || 1) : 1)); }
ITEMS.t_inf = {name:'Wapens', pp:250, kind:'tech', tech:'inf'};
ITEMS.t_arm = {name:'Pantserstaal', pp:300, kind:'tech', tech:'arm'};
ITEMS.t_air = {name:'Luchtvaart', pp:280, kind:'tech', tech:'air'};
const SPECIALS = {
  rocket:{name:'Raketaanval',    cp:10, cd:4,   km:1500, desc:'Kost één raket. Zware schade aan divisies, verwoest industrie.'},
  sabot: {name:'Sabotage',       cp:25, cd:30,  km:900,  desc:'Legt de industrie van een vijandelijke provincie 60 dagen half stil.'},
  blitz: {name:'Blitzoffensief', cp:50, cd:80,           desc:'+35% aanvalskracht voor al je divisies, 15 dagen lang.'},
  mobil: {name:'Mobilisatie',    cp:30, cd:200,          desc:'Legerlimiet 180 dagen lang +30%: meer divisies tegelijk.'},
  bunker:{name:'Bunkerlinie',    cp:20, cd:0,            desc:'Eigen provincie: +20% verdediging per niveau, maximaal 3.'}
};
// moeilijkheid: alle AI-voordelen staan open en bloot in het startmenu
const DIFF = [
  // pp/need/coal/grace/decl/thr: de AI · me*: jouw land (productie, legerlimiet, gevechtskracht) · ae: hoe snel buren schrikken · win: deel van de kaart voor de overwinning
  {name:'Makkelijk', pp:0.75, need:1.5, coal:0.12, grace:300, decl:0.5, thr:75, mePp:1.35, meCap:1.6, meCbt:1.35, aiCap:0.9, meSurr:0.25, integ:180, occ:0.5, ae:0.6, win:0.35, prey:3, fear:1.6, desc:'Jij +35% productie, +60% leger, +35% gevechtskracht, veroverd land na een half jaar geïntegreerd · AI −25% productie, −10% leger · winnen: 35% van Europa, 11% van de wereld'},
  {name:'Normaal',   pp:1.0,  need:1.3, coal:0.3,  grace:150, decl:1,   thr:55, mePp:1.1,  meCap:1.2, meCbt:1.1,  meSurr:0.1, integ:270, occ:0.35, ae:1,   win:0.5,  desc:'Jij +10% productie en gevechtskracht, +20% leger · coalitie bij 55 agressie · winnen: helft van Europa, 15% van de wereld'},
  {name:'Moeilijk',  pp:1.25, need:1.2, coal:0.45, grace:90,  decl:1.3, thr:48, mePp:1,    meCap:1,   meCbt:1,    ae:1.15, win:0.6, desc:'AI +25% productie · coalitie bij 48 agressie · winnen: 60% van Europa, 18% van de wereld'},
  {name:'Zwaar',     pp:1.5,  need:1.1, coal:0.6,  grace:45,  decl:1.6, thr:40, mePp:1,    meCap:1,   meCbt:1,    ae:1.3, win:0.75, desc:'AI +50% productie · coalitie bij 40 agressie · winnen: driekwart van Europa, 23% van de wereld'}
];
const ROMAN = ['I','II','III','IV'];
const DPS = [0, 1.1, 2.4, 5.2, 10.5];
const START = Date.UTC(1936, 0, 1);
const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const NF = new Intl.NumberFormat('nl-NL', {maximumFractionDigits:1});
const SAVE_KEY = 'vesting-europa-v5';
const isTouch = matchMedia('(hover: none)').matches;

/* ================= hulpfuncties ================= */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const rnd = (a,b) => a + Math.random()*(b-a);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// tijd = dagen sinds het begin (geen kalender: het jaartal doet er niet toe)
function fmtDate(day){ const d = Math.floor(day); return 'dag ' + d + (d >= 365 ? ' · jaar ' + (Math.floor(d / 365) + 1) : ''); }
const fmtDay = day => 'Dag ' + Math.floor(day) + (day >= 365 ? ' · jaar ' + (Math.floor(day / 365) + 1) : '');
function hex2rgb(h){ const n = parseInt(h.slice(1),16); return [n>>16&255, n>>8&255, n&255]; }
function shade(hex, t){
  const [r,g,b] = hex2rgb(hex);
  const f = t < 0 ? x => x*(1+t) : x => x + (255-x)*t;
  return '#' + [r,g,b].map(x => Math.round(clamp(f(x),0,255)).toString(16).padStart(2,'0')).join('');
}
const dist = (p,q) => Math.hypot(P[p].a[0]-P[q].a[0], P[p].a[1]-P[q].a[1]);
const distKm = (p,q) => dist(p,q) * KM;
const popE = c => Math.min(CN[c].pop, 160);
const colorOf = c => CN[c].col;
const cname = c => CN[c].name;

/* ================= spelstand ================= */
let G = null;
const UI = { hintN:(()=>{ try{ return +localStorage.getItem('ve_hint_sel') || 0; }catch(e){ return 0; } })(), sel:new Set(), selAir:new Set(), info:null, target:null, sheet:null, pick:null, confirm:null, winShown:false, loading:false, err:null, diff:1 };
let IDX = {};
const wk = ek;
// vijanden per land, opnieuw opgebouwd zodra oorlogen veranderen
let ENS = null, ENL = null;
function warCache(){
  ENS = {}; ENL = {};
  for(const k in G.wars){ const i = k.indexOf('|'), a = k.slice(0, i), b = k.slice(i+1); (ENS[a] ||= new Set()).add(b); (ENS[b] ||= new Set()).add(a); }
  for(const c in ENS) ENL[c] = [...ENS[c]].filter(x => G.nations[x] && G.nations[x].alive);
}
let WARV = 0;
const warsChanged = () => { ENS = null; ENL = null; WARV++; };
const atWar = (a,b) => { if(a === b) return false; if(!ENS) warCache(); const s = ENS[a]; return !!s && s.has(b); };
const nat = c => G.nations[c];
const alive = c => G.nations[c].alive;
const NOEN = [];
const enemiesOf = c => { if(!ENL) warCache(); return ENL[c] || NOEN; };
let OWN = {}, ownDirty = true, NB = {}, NBDAY = -1;
function owned(c){
  if(ownDirty){ OWN = {}; for(const x of CIDS) OWN[x] = []; for(const p of PIDS) OWN[G.ctrl[p]].push(p); ownDirty = false; NBDAY = -1; }
  return OWN[c] || [];
}
const isAI = c => c !== G.player;
const D = () => DIFF[G.diff];

function newGame(player, diff){
  ownDirty = true; warsChanged(); POWC = null; AIRBY = null;
  G = { v:5, map:MAPNAME, diff, day:0, frac:0, speed:1, paused:false, player, over:null, won:false,
        ctrl:{}, fac:{}, dmg:{}, forts:{}, hold:{}, wars:{}, nations:{}, units:[], air:[], nid:1, battles:[], peaceCd:{}, rally:'cap' };
  for(const p of PIDS) G.ctrl[p] = P[p].c;
  for(const c of CIDS){
    const f = CN[c].f, provs = CPROV[c], cap = CN[c].cap;
    const ws = provs.reduce((s,p) => s + Math.sqrt(P[p].ar || 1), 0);
    for(const p of provs) G.fac[p] = (p === cap ? f*0.3 : 0) + f*0.7*Math.sqrt(P[p].ar || 1)/ws;
    G.nations[c] = { alive:true, capB:8, mobil:0, cp:25, q:[], ro:0, tech:{inf:0,arm:0,air:0}, cd:{}, blitz:-1, auto:false, ppd:0 };
  }
  for(const c of CIDS){
    const f = CN[c].f, pe = popE(c);
    const provs = CPROV[c];
    const border = provs.filter(p => ADJ[p].some(n => P[n].c !== c));
    const order = border.length ? border.concat(provs.filter(p => !border.includes(p))) : provs;
    const nInf = Math.max(1, Math.round(pe/9 + f*0.25));
    let k = 0;
    for(let i=0; i<nInf; i++) spawn(c, 'inf', order[k++ % order.length]);
    for(let i=0; i<Math.floor(f/6); i++) spawn(c, 'art', order[k++ % order.length]);
    for(let i=0; i<Math.floor(f/5); i++) spawn(c, 'tank', CN[c].cap);
    for(let i=0; i<Math.floor(f/7); i++) spawn(c, 'mot', CN[c].cap);
    for(let i=0; i<Math.min(6, Math.floor(f/3)); i++) spawnAir(c, 'fi', CN[c].cap);
    for(let i=0; i<Math.min(4, Math.floor(f/7)); i++) spawnAir(c, 'cas', CN[c].cap);
    for(let i=0; i<Math.min(4, Math.floor(f/6)); i++) spawnAir(c, 'bo', CN[c].cap);
  }
  economy(true);
  ownDirty = true; polInit();
}
function spawn(c, tp, loc, hp){ const u = {id:G.nid++, c, tp, t:domOfKey(tp), hp:hp||100, loc, path:[], prog:0, att:null, air:false, dropCd:0}; G.units.push(u); return u; }
function spawnAir(c, t, base){ const w = {id:G.nid++, c, t, base, zone:null, z:base, hp:100}; G.air.push(w); if(AIRBY) (AIRBY[c] ||= []).push(w); return w; }
let UMAP = null, UMAPsrc = null, UMAPlen = -1, UMAPnid = -1;
function unitById(id){
  if(UMAPsrc !== G.units || UMAPlen !== G.units.length || UMAPnid !== G.nid){ UMAP = new Map(); for(const u of G.units) UMAP.set(u.id, u); UMAPsrc = G.units; UMAPlen = G.units.length; UMAPnid = G.nid; }
  return UMAP.get(id) || null;
}
function airById(id){ for(const w of G.air) if(w.id === id) return w; return null; }
// nieuwe troepen: in de hoofdstad zolang daar aanvoer is, anders in de dichtstbijzijnde eigen provincie met ruimte
function stackAt(c){ const m = {}; for(const u of UBY[c] || G.units.filter(v => v.c === c)){ const k = u.path.length ? u.path[u.path.length - 1] : u.loc; m[k] = (m[k] || 0) + 1; } return m; }
function spawnLoc(c, kind){
  const cap = CN[c].cap;
  const start = G.ctrl[cap] === c ? cap : (CPROV[c].find(p => G.ctrl[p] === c) || PIDS.find(p => G.ctrl[p] === c) || null);
  if(!start || kind === 'air' || !G.units) return start;
  const st = stackAt(c), seen = new Set([start]), q = [start];
  for(let i = 0; i < q.length && i < 400; i++){
    const x = q[i];
    if((st[x] || 0) < supCap(x, c) && SUP[x] !== 0) return x;
    for(const n of ADJ[x]) if(!seen.has(n) && G.ctrl[n] === c){ seen.add(n); q.push(n); }
  }
  return start;
}
/* te veel troepen op één plek (bijv. alles net gebouwd in de hoofdstad): wie niets te doen heeft, schuift door naar de
   dichtstbijzijnde eigen provincie met aanvoer over. Troepen die jij zelf ergens neerzette, blijven staan. */
const FRONT_MUL = 1.5;   // aan het front mag het anderhalf keer zo vol: de buren voeden mee
function decongest(c){
  const mine = UBY[c] || []; if(!mine.length) return 0;
  const st = stackAt(c), over = [];
  const isF = k => ADJ[k].some(n => atWar(c, G.ctrl[n]));
  const lim = k => isF(k) ? Math.floor(supCap(k, c) * FRONT_MUL) + 1 : Math.floor(supCap(k, c));   // aan het front één divisie speling (anders schuift er elke beurt iets heen en weer)
  for(const k in st) if(G.ctrl[k] === c && st[k] > lim(k)) over.push(k);
  if(!over.length) return 0;
  let moved = 0;
  for(const p of over){
    let ex = st[p] - lim(p);
    // wie weg mag: gewonden eerst (die herstellen hier toch niet), dan wie niets doet. Aanvallers en jouw eigen bevelen blijven
    const idle = mine.filter(u => u.loc === p && !u.path.length && !u.att && !(c === G.player && u.man) && u.t !== 'para').sort((a, b) => b.hp - a.hp);
    if(!idle.length) continue;
    const seen = new Map([[p, null]]), q = [p], spots = [];
    for(let i = 0; i < q.length && spots.length < ex; i++){
      const x = q[i];
      if(x !== p && SUP[x] !== 0){ const room = lim(x) - (st[x] || 0); for(let r = 0; r < room && spots.length < ex + 8; r++) spots.push(x); }
      for(const n of ADJ[x]) if(!seen.has(n) && G.ctrl[n] === c && !LONG.has(ek(x, n))){ seen.set(n, x); q.push(n); }
    }
    const send = (u, x) => { const path = []; let y = x; while(y !== p){ path.unshift(y); y = seen.get(y); } u.path = path; u.prog = 0; st[x] = (st[x] || 0) + 1; st[p]--; ex--; moved++; };
    while(ex > 0 && idle.length && spots.length){
      const u = idle.pop();   // laagste hp eerst
      let i = 0;
      if(u.hp < 50){ const j = spots.findIndex(x => !isF(x)); if(j >= 0) i = j; }   // gewonden liever naar een rustige plek
      send(u, spots.splice(i, 1)[0]);
    }
  }
  return moved;
}
let UCNT = {}, ACNT = {};
let UBY = {}, UT = {}, AT = {}, POWC = null, AIRBY = null;
function buildIdx(){
  IDX = {}; UCNT = {}; UBY = {}; UT = {}; AT = {}; ACNT = {}; POWC = null; AIRBY = {};
  computeSupply();
  for(const u of G.units){
    (IDX[u.loc] ||= []).push(u); (UBY[u.c] ||= []).push(u);
    UCNT[u.c] = (UCNT[u.c]||0) + 1;
    const t = UT[u.c] ||= {}; t[u.t] = (t[u.t]||0) + 1;
  }
  for(const w of G.air){
    ACNT[w.c] = (ACNT[w.c]||0) + 1; (AIRBY[w.c] ||= []).push(w);
    const t = AT[w.c] ||= {}; t[w.t] = (t[w.t]||0) + 1;
  }
}
const defendersAt = p => (IDX[p] || []).filter(v => v.c === G.ctrl[p]);
const defNow = p => G.units.filter(v => v.loc === p && v.c === G.ctrl[p]);     // actueel, voor de interface

/* ================= gevechtswaarden ================= */
const supMul = u => SUP[u.loc] === 0 ? 0.65 : 1;
/* ---- bevoorrading: verbonden via eigen gebied met je kernland? Zo niet: zwakker, geen herstel, slijtage ---- */
let SUP = {}, OOSP = [];
let CTRLV = 0, SUPV = -1;   // versie van wie wat bezit: bevoorrading hoeft pas opnieuw als die verandert
function computeSupply(force){
  if(!force && SUPV === CTRLV) return;
  SUPV = CTRLV;
  SUP = {}; OOSP = []; const q = [];
  for(const p of PIDS){ const c = G.ctrl[p]; if(P[p].c === c){ SUP[p] = 1; q.push(p); } else SUP[p] = 0; }
  for(let i = 0; i < q.length; i++){ const x = q[i], c = G.ctrl[x]; for(const n of ADJ[x]) if(SUP[n] === 0 && G.ctrl[n] === c){ SUP[n] = 1; q.push(n); } }
  for(const p of PIDS) if(SUP[p] === 0 && alive(G.ctrl[p])) OOSP.push(p);
  overDirty = true;
}
/* ---- legerlimiet: hoeveel divisies je land tegelijk op de been kan houden ---- */
function manCap(pe){ const e = Math.min(pe, 300) + 0.15*Math.max(0, pe - 300); return 4 + 2.2*Math.sqrt(e) + 0.05*e; }
function armyCap(c){ const n = nat(c); return Math.round(((n.capB || 8) * (n.ws == null ? 1 : wsMul(c)) * ((n.mobil || 0) > G.day ? 1.3 : 1) + (n.capX || 0)) * ((n.demil || 0) > G.day ? 0.5 : 1) * (c === G.player ? (D().meCap || 1) : (D().aiCap || 1))); }
function unitsQueued(c){ return nat(c).q.filter(q => (ITEMS[q.k] || {}).kind === 'unit').length; }
const meB = c => c === G.player ? (D().meCbt || 1) : 1;   // hulp voor de speler op lagere niveaus
const atkPlain = u => tstat(u.c, u.tp).a * u.hp/100 * supMul(u) * meB(u.c);
const defPlain = (u,p) => tstat(u.c, u.tp).d * u.hp/100 * supMul(u) * meB(u.c) * (1 + 0.2*(G.forts[p]||0)) * (1 + (u.ent||0)/100) * 1.3 * (STAR[p] >= 2 && (G.nations[u.c].lsT || 0) > G.day ? 1.2 : 1);
/* ---- terrein & rivieren: de aanvaller betaalt (pantser extra in bergen, moeras en steden) ---- */
const TER_NM = {m:'bergen', h:'heuvels', d:'woestijn', w:'moeras'};
/* ---- rollen: wat een divisie kan, volgt uit haar bataljons (de ontwerper doet er dus toe) ----
   pantser: +60% aanval in open terrein bij een volle pantserdivisie, maar zwak in bergen, moeras en steden
   artillerie: kraakt bunkers, steden, heuvels, bergen en ingegraven troepen (tot +120%)
   mariniers: landen vrijwel zonder straf · luchtafweer: neemt de vijandelijke luchtsteun weg */
const FR0 = {arm:0, tank:0, art:0.22, aa:0, mar:0, para:0};
const frOf = u => u.tp ? tstat(u.c, u.tp).fr : FR0;
let FORTC = {day:-1, m:{}};
function fortOf(t){   // is het doel versterkt? (bunker, stad, heuvels/bergen of ingegraven verdedigers)
  if(FORTC.day !== G.day) FORTC = {day:G.day, m:{}};
  let v = FORTC.m[t]; if(v !== undefined) return v;
  v = !!(G.forts[t] || CAPS.has(t) || TER[t] === 'm' || TER[t] === 'h');
  if(!v){ let e = 0, n = 0; for(const d of IDX[t] || []) if(d.c === G.ctrl[t]){ e += d.ent || 0; n++; } v = n > 0 && e/n >= 6; }
  return FORTC.m[t] = v;
}
function atkMods(u, from, t){
  let m = 1; const tr = TER[t], fr = frOf(u), arm = fr.arm, city = CAPS.has(t);
  if(tr === 'm') m *= 0.6 - 0.25*arm;
  else if(tr === 'h') m *= 0.85 - 0.2*arm;
  else if(tr === 'w') m *= 0.8 - 0.3*arm;
  else if(tr === 'd') m *= 1 + 0.15*arm;
  if(city) m *= 0.85 - 0.2*arm;
  if(!tr && !city) m *= 1 + 0.6*fr.tank;                                  // open terrein: pantser breekt door
  if(fr.art && G.ctrl && fortOf(t)) m *= 1 + 1.2*fr.art;                   // artillerie tegen stellingen
  const r = from && !u.air ? RIV[ek(from, t)] : 0;
  if(r) m *= r === 2 ? 0.65 + 0.25*fr.mar : 0.8;
  return m;
}
// aanval over zee: gewone troepen −40% (oceaanoversteek −55%), mariniers vrijwel zonder straf
function seaMul(u, from, t){
  if(!from || u.air || !SEA.has(ek(from, t))) return 1;
  const mf = frOf(u).mar;
  return LONG.has(ek(from, t)) ? 0.45 + 0.65*mf : 0.6 + 0.5*mf;
}
/* ---- frontbreedte (zoals HOI4): per gevecht vechten maar zoveel divisies tegelijk; de rest is reserve en valt in
   als de voorste linie breekt. ---- */
const widthOf = t => { const tr = TER[t]; let w = tr === 'm' || tr === 'w' ? 8 : tr === 'h' ? 10 : 12; if(CAPS.has(t)) w = Math.min(w, 10); return w; };
const uWid = (u, from, t) => 1;
function frontPick(list, W){   // list: [unit, kracht, breedte] → de sterkste die passen
  list.sort((a, b) => b[1] - a[1]);
  const f = []; let w = 0;
  for(const x of list){ if(w + x[2] > W) continue; f.push(x); w += x[2]; if(w >= W) break; }
  return f;
}
/* ---- aanvoer: hoeveel divisies een provincie kan voeden. Meer = slijtage en geen herstel.
   Eigen land 6 + 3 per ster (+4 hoofdstad), bezet land 4 + 2 per ster; bergen, woestijn en moeras −2.
   Een provincie mag de vrije aanvoer van eigen buurprovincies over land voor de helft meegebruiken. ---- */
// zeeoverwicht: havens tegenover een veel zwakkere vijand overzee worden over zee bevoorraad (×2), zodat een landingsleger
// zich kan verzamelen. Alleen voor de sterkste partij: de verdediger van een eiland krijgt dit niet.
let PORTC = {day:-1, m:{}};
function portW(p, c){
  if(PORTC.day !== G.day || PORTC.g !== G || PORTC.v !== WARV) PORTC = {day:G.day, g:G, v:WARV, m:{}};
  const k = p + c; let v = PORTC.m[k]; if(v !== undefined) return v;
  v = false; for(const n of ADJ[p]) if(SEA.has(ek(p, n)) && atWar(c, G.ctrl[n]) && armyPow(c) >= 1.5 * armyPow(G.ctrl[n])){ v = true; break; }
  return PORTC.m[k] = v;
}
let SUPCC = {day:-1, m:{}};
function supCap(p, c){
  if(SUPCC.day !== G.day || SUPCC.g !== G || SUPCC.v !== WARV || SUPCC.c !== CTRLV) SUPCC = {day:G.day, g:G, v:WARV, c:CTRLV, m:{}};
  const k = p + c; let r = SUPCC.m[k]; if(r === undefined) r = SUPCC.m[k] = supCap0(p, c); return r;
}
function supCap0(p, c){
  const st = STAR[p] || 1, tr = TER[p];
  const v = P[p].c === c ? 6 + 3*st + (CN[c] && CN[c].cap === p ? 4 : 0) : integ(p) && G.ctrl[p] === c ? 5 + 3*st : 4 + 2*st;
  return Math.max(3, v - (tr === 'm' || tr === 'd' || tr === 'w' ? 2 : 0)) * (portW(p, c) ? 2 : 1);
}
// verdeel n divisies naar gewicht over provincies, zonder de aanvoer te overschrijden (wat niet past blijft achter)
function capFill(c, wts, n, mul){
  const out = new Map(); let left = n, open = new Map(wts);
  for(let k = 0; k < 5 && left > 0.5 && open.size; k++){
    let W = 0; for(const v of open.values()) W += v;
    if(W <= 0) break;
    let used = 0;
    for(const [p, v] of [...open]){
      const cap = supCap(p, c) * (mul || 1), cur = out.get(p) || 0, add = Math.min(left * v / W, cap - cur);
      out.set(p, cur + add); used += add;
      if(cur + add >= cap - 0.01) open.delete(p);
    }
    left -= used;
  }
  return out;
}
// voorspelling: verhouding + de belangrijkste factoren, voor sleep-label, tooltip en melding
function battleOdds(us, t){
  let a = 0, base = 0, seaN = 0, marN = 0, artB = false, tankB = 0;
  const W = widthOf(t), al = [];
  for(const u of us){
    const i = u.path.indexOf(t), from = i > 0 ? u.path[i-1] : (i === 0 ? u.loc : (ADJ[u.loc].includes(t) ? u.loc : null));
    const sea = seaMul(u, from, t), fr = frOf(u);
    if(sea < 1 || (from && SEA.has(ek(from, t)))){ seaN++; if(fr.mar >= 0.5) marN++; }
    if(fr.art >= 0.2 && fortOf(t)) artB = true;
    if(fr.tank >= 0.3 && !TER[t] && !CAPS.has(t)) tankB++;
    al.push([u, atkPlain(u) * sea * atkMods(u, from, t), uWid(u, from, t), atkPlain(u)]);
  }
  const fa = frontPick(al, W);
  for(const x of fa){ a += x[1]; base += x[3]; }
  const ds = defNow(t);
  const fd = frontPick(ds.map(v => [v, defPlain(v, t), 1]), W);
  let d = fd.reduce((s2, x) => s2 + x[1], 0);
  const tags = [], aT = a;
  // luchtsteun en luchtafweer tellen mee, net als in het echte gevecht
  if(us.length && ds.length){
    const me2 = us[0].c, own2 = G.ctrl[t];
    const aaD = fd.reduce((s2, x) => s2 + (compOf(x[0]).aa || 0), 0)/5, aaA = fa.reduce((s2, x) => s2 + (compOf(x[0]).aa || 0), 0)/5;
    const amA = airMul(me2, own2, t, aaD), amD = airMul(own2, me2, t, aaA);
    a *= amA; d *= amD;
    const air = amA / amD; if(air >= 1.08) tags.push('luchtsteun +' + Math.round(100*(air - 1)) + '%'); else if(air <= 0.92) tags.push('vijandelijke luchtmacht −' + Math.round(100*(1 - air)) + '%');
  }
  if(seaN) tags.push(marN === seaN ? 'landing: mariniers' : 'landing −' + Math.round(100*(1 - (fa.length ? fa.reduce((s2, x) => s2 + seaMul(x[0], x[0].path.indexOf(t) > 0 ? x[0].path[x[0].path.indexOf(t)-1] : x[0].loc, t), 0) / fa.length : 0.5))) + '%');
  if(al.length > fa.length || ds.length > W) tags.push('breedte ' + W + (al.length > fa.length ? ' (' + (al.length - fa.length) + ' reserve)' : ''));
  if(artB) tags.push('artillerie +');
  if(us.length && nat(us[0].c).blitz > G.day) tags.push('blitz +35%');
  if(tankB) tags.push('pantser +');
  if(base > 0 && aT < base*0.97 && (TER[t] && TER[t] !== 'd' || CAPS.has(t) || us.some(u => { const i = u.path.indexOf(t), f = i > 0 ? u.path[i-1] : u.loc; return RIV[ek(f, t)]; }))){
    const tr = TER[t]; if(tr && tr !== 'd') tags.push(TER_NM[tr]);
    if(CAPS.has(t)) tags.push('stad');
    if(us.some(u => { const i = u.path.indexOf(t), f = i > 0 ? u.path[i-1] : u.loc; return RIV[ek(f, t)]; })) tags.push('rivier');
    tags[tags.length - 1] += ' ' + Math.round(100*(aT/base - 1)) + '%';
  }
  if(G.forts[t]) tags.push('bunker +' + 20*G.forts[t] + '%');
  const ent = ds.length ? ds.reduce((s2, v) => s2 + (v.ent || 0), 0) / ds.length : 0;
  if(ent >= 3) tags.push('ingegraven +' + Math.round(ent) + '%');
  const r = d > 0 ? a / d : Infinity;
  return {r, n:ds.length, tags, verdict: !ds.length ? 'onverdedigd' : r >= 2 ? 'verpletterend' : r >= 1.3 ? 'overmacht' : r >= 0.85 ? 'goede kans' : r >= 0.55 ? 'riskant' : 'kansloos'};
}
 // voorspelling voor de huidige selectie naar provincie p (gecachet: padzoeken is niet gratis)
let oddsCache = {k:null, v:null};
function selOdds(p){
  const k = p + '|' + [...UI.sel].join(',') + '|' + G.day;
  if(oddsCache.k === k) return oddsCache.v;
  const routes = {};
  const us = [...UI.sel].map(unitById).filter(Boolean).map(u => ({...u, path: u.loc === p ? [] : (routes[u.loc] ??= (findPath(u.c, u.loc, p, true) || []))}));
  return (oddsCache = {k, v: battleOdds(us, p)}).v;
}
const oddsTxt = o => !o.n ? 'onverdedigd' : NF.format(o.r) + '× ' + o.verdict + (o.tags.length ? ' · ' + o.tags.join(', ') : '');
function airPowTotal(c){ let s = 0; const a = nat(c).tech.air; for(const w of G.air) if(w.c === c) s += w.hp/100 * (w.t === 'fi' ? 1 : 0.6) * (1 + 0.15*a); return s; }
function armyPow(c){
  if(!POWC){
    POWC = {};
    for(const u of G.units){ const ts = tstat(u.c, u.tp); POWC[u.c] = (POWC[u.c]||0) + (ts.a + ts.d)/2 * u.hp/100; }
    for(const w of G.air) POWC[w.c] = (POWC[w.c]||0) + w.hp/100 * (w.t === 'fi' ? 1 : 0.6) * (1 + 0.15*nat(w.c).tech.air) * 3;
  }
  return POWC[c] || 0;
}
function itemCost(c,k){ const it = ITEMS[k]; return it.kind === 'tech' ? it.pp * (nat(c).tech[it.tech] + 1) : it.pp; }
function airSupGlobal(a,b){ let fa = 0, fb = 0; for(const w of G.air) if(w.t === 'fi'){ if(w.c === a) fa += w.hp; else if(w.c === b) fb += w.hp; } return fa+fb > 0 ? fa/(fa+fb) : 0.5; }
let RZ = 60;
function cover(c, p, t){
  let s = 0;
  const list = AIRBY ? (AIRBY[c] || []) : G.air;
  for(const w of list) if(w.c === c && w.t === t && !w.dead && w.hp > 0 && dist(w.z, p) <= RZ) s += Math.min(100, w.hp)/100;
  return s * (1 + 0.15*nat(c).tech.air);
}
function airMul(a, b, p, aaEnemy){
  const fa = cover(a, p, 'fi'), fb = cover(b, p, 'fi');
  const sup = fa+fb > 0 ? fa/(fa+fb) : 0.5;
  const cas = cover(a, p, 'cas') * Math.max(0.25, 1 - 0.25*aaEnemy);
  return 0.85 + 0.3*sup + Math.min(0.5, cas*0.15*(0.4 + 0.6*sup));
}

/* ================= tijd ================= */
const TICK_MS = 14;   // hoeveel ms per beeld de simulatie maximaal mag gebruiken
let LAGT = 0;
function advance(d){
  if(G.frac >= 1.5){ d = 0; LAGT += 1; if(LAGT === 90) toast('Je toestel houdt deze snelheid niet bij: het spel loopt wat trager dan aangegeven', '', 'lag'); } else LAGT = 0;   // achterstand: eerst inhalen, geen nieuwe tijd erbij
  if(d) moveUnits(d);
  G.frac += d;
  const t0 = performance.now();
  while(G.frac >= 1 && !G.over){ G.frac -= 1; G.day++; dailyTick(); if(performance.now() - t0 > TICK_MS) break; }
}
function uSpeed(u, nx){
  let sp = tstat(u.c, u.tp).s / KM * TM * (u.hp < 50 ? 0.8 : 1) * (G.ctrl[nx] !== u.c ? 0.45 : 1) * (SUP[u.loc] === 0 ? 0.8 : 1);
  if(SEA.has(ek(u.loc, nx))) sp *= (u.t === 'mar' ? 1 : 0.6);
  return sp;
}
let FORM = {day:-1}, PATHV = 0, MVC = new WeakMap();   // MVC: tempo per eenheid voor de huidige stap
function moveUnits(d){
  const occ = {};
  for(const u of G.units) if(u.c === G.ctrl[u.loc]) occ[u.loc] = (occ[u.loc]||0) + 1;
  // formaties: eenheden met hetzelfde bevel op dezelfde stap lopen samen, in het tempo van de traagste
  if(FORM.day !== G.day || FORM.v !== PATHV || FORM.n !== G.units.length){
    const form = {}, pend = {};
    for(const u of G.units){
      if(!u.g || u.att || !u.path.length) continue;
      const k = u.g + '|' + u.loc + '|' + u.path[0], sp = uSpeed(u, u.path[0]);
      if(!(k in form) || sp < form[k]) form[k] = sp;
      for(let i = 1; i < u.path.length; i++){ const q = u.path[i]; pend[u.g + '|' + q] = (pend[u.g + '|' + q] || 0) + 1; }
    }
    FORM = {day:G.day, v:PATHV, n:G.units.length, form, pend};
  }
  const form = FORM.form, pend = FORM.pend;
  for(const u of G.units){
    if(u.att || !u.path.length) continue;
    const nx = u.path[0];
    if(!ADJ[u.loc].includes(nx)){ u.path = []; u.prog = 0; continue; }
    const own = G.ctrl[nx];
    if(own !== u.c){
      if(!atWar(u.c, own)){ u.path = []; u.prog = 0; continue; }
      if(occ[nx]){
        // de route liep door eigen gebied dat onderweg verloren ging: niet blind aanvallen, de generaal plant opnieuw
        if(!u.man){ u.path = []; u.prog = 0; u.g = null; continue; }
        // samen aanvallen: wacht (max 6 dagen) op de rest van het bevel dat nog onderweg is
        if(u.g && pend[u.g + '|' + nx] && G.day - (u.wt ?? (u.wt = G.day)) < 6) continue;
        u.att = nx; u.prog = 0; u.wt = null; continue;
      }
    }
    let mc = MVC.get(u);
    if(!mc || mc.d !== G.day || mc.l !== u.loc || mc.n !== nx || mc.v !== FORM.v){
      const sp = u.g ? (form[u.g + '|' + u.loc + '|' + nx] ?? uSpeed(u, nx)) : uSpeed(u, nx);
      mc = {d:G.day, l:u.loc, n:nx, v:FORM.v, step: sp / Math.max(8, SEA.has(ek(u.loc, nx)) ? Math.min(70, dist(u.loc, nx)) : dist(u.loc, nx))}; MVC.set(u, mc);
    }
    u.ent = 0;
    u.prog += d * mc.step;
    if(u.prog >= 1){
      u.prog = 0; u.loc = nx; u.path.shift(); if(!u.path.length){ u.g = null; u.man = false; }
      if(G.ctrl[nx] !== u.c) capture(nx, u.c);
    }
  }
}
let capToast = {n:0, t:0};
function capture(p, c){
  const prev = G.ctrl[p];
  setCtrl(p, c);
  if(c === G.player) fx(p, 'cap'); else if(prev === G.player) fx(p, 'loss');
  if(G.nations[prev]){
    const st = starOf(p);
    if(baseOf(prev).includes(p)) nat(prev).ws = clamp(nat(prev).ws - 0.8*st, 0, 100);   // Warschau kwijt doet meer pijn dan een stuk bos
    nat(c).ws = clamp(nat(c).ws + 0.2*st, 0, 100);
    if(atWar(c, prev)) (G.wlast ||= {})[wk(c, prev)] = G.day;
  }
  if(c === G.player && G.nations[prev]) aeOnCapture(p, prev);
  if(c === G.player){
    const now = performance.now();
    capToast.n = now - capToast.t < 1800 ? capToast.n + 1 : 1; capToast.t = now;
    toast(capToast.n > 1 ? capToast.n + ' provincies ingenomen' : P[p].n + ' ingenomen', 'good', 'cap');
  } else if(prev === G.player){
    toast(P[p].n + ' verloren aan ' + cname(c), 'war', 'lost');
    if(CN[G.player].cap === p){ shake(); flash(); sfx('loss'); } else sfx('lossmin');
  }
  if(c === G.player){ sfx(STAR[p] >= 2 ? 'capbig' : 'cap'); if(G.nations[prev] && (IDX[p] || []).concat(G.units.filter(u => u.c === c && u.att === p)).some(u => u.c === c && SEA.has(ek(u.loc, p)))) achAward('island'); }
}
function dailyTick(){
  RZ = ZONE_KM / KM;
  economy(false);
  wsTick();
  if(G.just && G.day >= G.just.until){ G.wg[G.just.c] = G.day + 180; toast('Oorlogsdoel tegen ' + cname(G.just.c) + ' klaar: 180 dagen geldig', 'good'); G.just = null; }
  if(G.day % 5 === 0){ coalitionCheck(); objCheck(); fsTick(); achCheck(); }
  if(G.day % 10 === 0){ const me = G.player, war = enemiesOf(me).length > 0; for(const x in G.ae) G.ae[x] = Math.max(0, G.ae[x] - (war ? 1.5 : 3)); }
  buildIdx();
  airTick();
  battles();
  warEnds();
  if(G.over) return;
  buildIdx();
  CIDS.forEach((c, i) => {
    if(!alive(c)) return;
    const n = nat(c);
    if(c === G.player){
      const gc = genCfg();
      if(n.auto && (G.day + i) % 2 === 0){ if(gc.prod && n.q.length < 2) aiProduce(c); aiArmy(c); }
      if((G.day + i) % 4 === 0) decongest(c);   // zonder generaal alleen troepen zonder bevel van jou (net gebouwd)
      if(n.auto && gc.act && (G.day + i) % 3 === 0 && n.cp >= 55) aiSpecials(c);   // houdt 25+ bevel over voor oorlogsdoelen
      if(n.auto && gc.air && (G.day + i) % 2 === 0) aiAir(c);
      return;
    }
    if((G.day + i) % 2 === 0){ if(!n.total && ((G.day + i) % 4 === 0 || enemiesOf(c).length)) aiProduce(c); if(MAPNAME !== 'world' || (G.day + i) % 8 === 0 || enemiesOf(c).length) aiArmy(c); if((G.day + i) % 6 === 0) decongest(c); }
    if((G.day + i) % 2 === 0) aiAir(c);
    if((G.day + i) % 3 === 0) aiSpecials(c);
    if((G.day + i*5) % 20 === 0) aiDeclare(c);
  });
  if(G.day % 10 === 0) aiEnds();
  // gestrande troepen (land dat bij een vrede of conferentie van eigenaar wisselde): terug naar eigen gebied
  { const st = new Set(); for(const u of G.units) if(G.ctrl[u.loc] !== u.c && !u.att) st.add(u.c); for(const c of st) relocate(c); }
  if(G.day % 5 === 2) aiCards();
  if(G.day % (MAPNAME === 'world' ? 30 : 10) === 0) autosaveIdle();
}

/* ================= economie ================= */
function economy(initOnly){
  const pp = {}, pe = {};
  for(const c of CIDS){ pp[c] = 0; pe[c] = 0; }
  for(const p of PIDS){
    const c = G.ctrl[p], home = P[p].c === c;
    const y = home ? 1 : integ(p) ? 0.75 : 0.4;
    pp[c] += G.fac[p] * y * ((G.dmg[p]||0) > G.day ? 0.5 : 1);
    pe[c] += PPOP[p] * (home ? 1 : y === 0.75 ? 0.7 : c === G.player ? (D().occ || 0.3) : 0.3);       // mankracht: bezet land levert weinig, geïntegreerd land veel
  }
  for(const c of CIDS){
    const n = nat(c);
    if(!n.alive) continue;
    const mul = isAI(c) ? D().pp : (D().mePp || 1);
    n.ppd = pp[c] * 0.6 * mul * (n.ws != null && n.ws < 20 ? 0.85 : 1);
    // legerlimiet = mankracht (bevolking), niet fabrieken: nieuw land en integratie maken je leger groter
    n.man = pe[c]; n.capB = manCap(pe[c]) + 0.3 * pp[c] / FAB_ADD;   // + een beetje industrie (begrensd door de bouwplekken)
    if(initOnly) continue;
    n.cp = Math.min(100, n.cp + 0.5);
    let head = n.q[0];
    // geen bouwplek meer voor een fabriek in de wachtrij: schrappen (de voortgang gaat naar het volgende item), niet blijven wachten
    while(head && head.k === 'fab' && !(head.at && G.ctrl[head.at] === c && slotFree(head.at) >= FAB_MIN) && !bestFab(c)){
      n.q.shift(); const nx = n.q[0];
      if(nx && head.p) nx.p = Math.min(itemCost(c, nx.k), (nx.p || 0) + head.p);
      if(c === G.player) toast('Fabriek geschrapt: geen bouwplek vrij. Verover of integreer land voor nieuwe plekken' + (head.p && nx ? ' · de voortgang gaat naar het volgende item' : ''), 'war', 'noslot');
      head = n.q[0];
    }
    if(head){
      const it = ITEMS[head.k], cost = itemCost(c, head.k);
      head.p = Math.min(cost, head.p + n.ppd);
      head.wait = false;
      if(head.p >= cost){
        if(it.kind === 'unit' && (UCNT[c] || 0) >= armyCap(c)) head.wait = 'cap';
        else if(it.kind === 'air' && (ACNT[c] || 0) >= airCap(c)) head.wait = 'air';
        else if(it.kind === 'fab' && !(head.at && G.ctrl[head.at] === c && slotFree(head.at) >= FAB_MIN) && !bestFab(c)) head.wait = 'slot';
        else { n.q.shift(); complete(c, head.k, head.at); if(it.kind === 'unit') UCNT[c] = (UCNT[c] || 0) + 1; else if(it.kind === 'air') ACNT[c] = (ACNT[c] || 0) + 1; }
      }
    }
  }
  if(initOnly) return;
  // melding als veroverd land geïntegreerd raakt (meer mankracht en fabrieksopbrengst)
  if(G.day % 10 === 0 && G.player && nat(G.player).alive){
    let ni = 0; for(const p of owned(G.player)) if(P[p].c !== G.player && integ(p)) ni++;
    if(G.intN != null && ni > G.intN) toast((ni - G.intN) + ' veroverde provincie' + (ni - G.intN === 1 ? '' : 's') + ' geïntegreerd: meer mankracht (legerlimiet ' + armyCap(G.player) + ') en fabrieken op 75%', 'good');
    G.intN = ni;
  }
  const contested = new Set();
  for(const u of G.units) if(u.att) contested.add(u.att);
  computeSupply();
  const stack = {}, parked = {};
  for(const u of G.units) if(G.ctrl[u.loc] === u.c){ const k = u.loc; const mv = u.path.length && !u.att; stack[k] = (stack[k] || 0) + (mv ? 0.5 : 1); if(!mv) parked[k] = (parked[k] || 0) + 1; }   // op doortocht: half zo zwaar
  const over = {};
  for(const k in stack){
    const c = G.ctrl[k]; let cap = supCap(k, c);
    if(stack[k] <= cap) continue;
    for(const n of ADJ[k]) if(G.ctrl[n] === c && !SEA.has(ek(k, n))) cap += 0.5 * Math.max(0, supCap(n, c) - (stack[n] || 0));
    if(stack[k] > cap) over[k] = 1.5 * (stack[k] - cap) / stack[k] * (ADJ[k].some(n => atWar(c, G.ctrl[n])) ? 0.5 : 1);   // aan het front gaat de aanvoer voor
  }
  G.over2 = over;
  // waarschuwing voor jou: te veel troepen op één plek (één keer per provincie per 30 dagen)
  if(G.day % 5 === 0 && G.player){ const me = G.player, ov = (G.ovT ||= {}), auto = nat(me).auto; let n = 0;
    for(const k in over){ if(G.ctrl[k] !== me || (ov[k] || 0) > G.day || n >= 2 || (parked[k] || 0) <= supCap(k, me)) continue;
      // met de generaal aan: alleen melden als het jouw eigen bevelen zijn die daar staan (de rest spreidt hij zelf)
      if(auto && !(IDX[k] || []).some(u => u.c === me && u.man && !u.path.length)) continue;
      ov[k] = G.day + 30; n++;
      toast('Te veel troepen in ' + P[k].n + ': ' + parked[k] + ' divisies, aanvoer voor ' + supCap(k, me) + '. Ze slijten en herstellen niet; ' + (auto ? 'geef ze aan de generaal (Generaal-knop) of verspreid ze' : 'verspreid ze'), 'war', 'over' + k); } }
  for(const u of G.units){
    if(!(u.hp <= 100)) u.hp = 100;
    const ov = over[u.loc];
    if(ov && G.ctrl[u.loc] === u.c){ if(u.hp > 35) u.hp = Math.max(35, u.hp - ov); if(!u.path.length && !u.att) u.ent = Math.min(20, (u.ent || 0) + 1); continue; }   // te veel troepen: slijtage, geen herstel
    if(!u.path.length && !u.att){ if(!contested.has(u.loc)) u.ent = Math.min(20, (u.ent || 0) + 1); } else u.ent = 0;   // ingraven: +1% verdediging per dag stilstaan (niet onder vuur)
    if(SUP[u.loc] === 0){ if(u.hp > 30) u.hp = Math.max(30, u.hp - 1.5); continue; }   // afgesneden: slijtage
    if(u.att || u.hp >= 100 || G.ctrl[u.loc] !== u.c || contested.has(u.loc)) continue;
    u.hp = Math.min(100, u.hp + (P[u.loc].c === u.c ? 4 : 2.5));                       // bevoorraad: herstel
  }
}
function complete(c, k, at){
  const n = nat(c), it = ITEMS[k];
  let where = '';
  const loc = spawnLoc(c, it.kind);
  if(it.kind === 'unit' && loc){
    const u = spawn(c, k, loc);
    where = ' · ' + P[loc].n;
    if(c === G.player){
      fx(loc, 'spawn');
      if(G.rally === 'front'){
        const dest = rallyTarget(c);
        if(dest && dest !== loc){ const path = findPath(c, loc, dest, false); if(path){ u.path = path; where = ' · op weg naar ' + P[dest].n; } }
      }
    }
  } else if(it.kind === 'air' && loc){
    spawnAir(c, k, loc); where = ' · basis ' + P[loc].n;
    if(c === G.player) fx(loc, 'spawn');
  } else if(k === 'rocket') n.ro++;
  else if(k === 'fab'){
    const tgt = at && G.ctrl[at] === c && slotFree(at) >= FAB_MIN ? at : bestFab(c);
    if(tgt){ const add = Math.min(1, slotFree(tgt)); G.fac[tgt] += FAB_ADD*add; where = ' · ' + P[tgt].n + ' (' + NF.format(facN(tgt)) + '/' + SLOTS[tgt] + ' plekken, +' + NF.format(FAB_ADD*add*0.6*yieldOf(tgt)) + ' productie per dag)'; }
  }
  else if(it.kind === 'tech'){ n.tech[it.tech] = Math.min(3, n.tech[it.tech] + 1); TPC[c] = null; }
  if(c === G.player){
    sfx('build');
    const msg = it.kind === 'tech' ? it.name + ' ' + ROMAN[n.tech[it.tech]] + ' ontwikkeld'
      : it.kind === 'air' ? it.name + ' gereed' + where
      : it.kind === 'fab' ? 'Nieuwe fabriek' + where
      : it.kind === 'rocket' ? 'Raket gereed (' + n.ro + ' op voorraad)'
      : it.name + ' gereed' + where;
    toast(msg, 'good');
  }
}
function rallyTarget(c){
  const own = owned(c);
  const war = own.filter(p => ADJ[p].some(n => atWar(c, G.ctrl[n])));
  const pool = war.length ? war : own.filter(p => ADJ[p].some(n => G.ctrl[n] !== c));
  if(!pool.length) return null;
  const cnt = {};
  for(const u of G.units) if(u.c === c){ const k = u.path.length ? u.path[u.path.length-1] : u.loc; cnt[k] = (cnt[k]||0) + 1; }
  let best = null, bs = Infinity;
  for(const p of pool){
    let threat = 1;
    for(const n of ADJ[p]) if(G.ctrl[n] !== c && (war.length ? atWar(c, G.ctrl[n]) : true)) threat += (IDX[n]||[]).filter(v => v.c === G.ctrl[n]).length;
    const s = (cnt[p]||0) / threat;
    if(s < bs){ bs = s; best = p; }
  }
  return best;
}

/* ================= luchtmacht ================= */
function airTick(){
  for(const w of G.air){
    if(G.ctrl[w.base] !== w.c){
      const nb = spawnLoc(w.c, "air");
      if(nb){ w.base = nb; w.zone = null; if(w.c === G.player) toast(AIR[w.t].name + ': basis verloren, uitgeweken naar ' + P[nb].n, 'war', 'rebase'); }
      else { w.dead = true; continue; }
    }
    w.z = (w.zone && distKm(w.base, w.zone) <= AIR[w.t].range) ? w.zone : w.base;
    w.eng = false;
  }
  const ws = G.air.filter(w => !w.dead);
  const byC = {};
  for(const w of ws) (byC[w.c] ||= []).push(w);
  for(const a of ws){
    if(a.t !== 'fi' || a.hp <= 0) continue;
    const m = 3.4 * a.hp/100 * (1 + 0.15*nat(a.c).tech.air);
    for(const e of enemiesOf(a.c)) for(const b of (byC[e] || [])){
      if(dist(a.z, b.z) > 2*RZ) continue;
      if(b.hp <= 0) continue;
      b.hp -= m * (b.t === 'fi' ? 1 : 1.5); a.eng = b.eng = true;
    }
  }
  const strikers = ws.filter(w => w.t !== 'fi' && enemiesOf(w.c).length);
  if(strikers.length) for(const u of G.units){
    const na = compOf(u).aa || 0;
    if(!na) continue;
    for(const w of strikers) if(atWar(w.c, u.c) && dist(w.z, u.loc) <= RZ){ w.hp -= 0.5*na; w.eng = true; }
  }
  for(const w of ws){
    if(w.t !== 'bo' || w.hp <= 0 || !atWar(w.c, G.ctrl[w.z])) continue;
    G.dmg[w.z] = Math.max(G.dmg[w.z]||0, G.day + 5);
    { const v = G.ctrl[w.z]; if(G.nations[v]) nat(v).ws = clamp(nat(v).ws - 0.03, 0, 100); }
    for(const d of defendersAt(w.z)) d.hp = Math.min(d.hp, Math.max(5, d.hp - 1.5*w.hp/100));
    if(Math.random() < 0.03) G.fac[w.z] = Math.max(0, G.fac[w.z] - 0.1);
    w.eng = true;
  }
  for(const w of ws){
    if(w.hp <= 0){
      w.dead = true;
      if(w.c === G.player) toast('Eskader ' + AIR[w.t].name.toLowerCase() + ' neergeschoten boven ' + P[w.z].n, 'war', 'airloss');
      UI.selAir.delete(w.id);
    } else if(!w.eng && w.hp < 100) w.hp = Math.min(100, w.hp + 2.5);
  }
  if(G.air.some(w => w.dead)) G.air = G.air.filter(w => !w.dead);
}
function orderAir(p){
  let ok = 0, reb = 0, far = 0;
  for(const id of UI.selAir){
    const w = airById(id); if(!w) continue;
    if(distKm(w.base, p) <= AIR[w.t].range){ w.zone = (p === w.base ? null : p); w.man = !!w.zone; ok++; }
    else if(G.ctrl[p] === G.player){ w.base = p; w.zone = null; w.man = true; reb++; }
    else far++;
  }
  if(reb) toast('Basis verplaatst naar ' + P[p].n, 'good');
  else if(ok) toast('Missiezone: ' + P[p].n, 'good');
  if(far && !ok && !reb) toast('Buiten bereik. Tik een eigen provincie dichterbij om de basis te verplaatsen', 'war', 'bad');
  renderAll();
}

/* ================= gevechten ================= */
let PREVB = {};
function battles(){
  const by = {};
  for(const u of G.units){
    if(!u.att) continue;
    const t = u.att, own = G.ctrl[t];
    if(own === u.c){ u.att = null; u.air = false; continue; }
    if(!atWar(u.c, own) || G.ctrl[u.loc] !== u.c || (!u.air && !ADJ[u.loc].includes(t))){ u.att = null; u.air = false; u.path = []; continue; }
    (by[t] ||= []).push(u);
  }
  G.battles = [];
  for(const t in by){
    const atts = by[t], own = G.ctrl[t];
    const defs = defendersAt(t);
    const main = atts[0].c;
    if(!defs.length){
      for(const a of atts){
        if(a.air){ capture(t, a.c); a.loc = t; a.att = null; a.air = false; a.path = []; continue; }
        a.att = null; if(a.path[0] !== t) a.path = [t]; a.prog = 0.6;
      }
      continue;
    }
    // frontbreedte: alleen de voorste linie vecht (de sterkste die passen), de rest staat klaar
    const W = widthOf(t);
    const fA = frontPick(atts.map(a => [a, atkPlain(a) * (nat(a.c).blitz > G.day ? 1.35 : 1) * seaMul(a, a.loc, t) * atkMods(a, a.loc, t), uWid(a, a.loc, t)]), W);
    const fD = frontPick(defs.map(d => [d, defPlain(d, t) * ((G.shock && G.shock[t] > G.day) ? 0.75 : 1), 1]), W);
    const aaD = fD.reduce((s2, x) => s2 + (compOf(x[0]).aa || 0), 0)/5, aaA = fA.reduce((s2, x) => s2 + (compOf(x[0]).aa || 0), 0)/5;
    const amA = airMul(main, own, t, aaD), amD = airMul(own, main, t, aaA);
    let aPow = 0, dPow = 0, dAtk = 0, artF = 0;
    for(const x of fA){ aPow += x[1] * amA; artF += frOf(x[0]).art; }
    for(const x of fD){ dPow += x[1] * amD; dAtk += atkPlain(x[0]) * amD; }
    // verdediging blokkeert (hoe sterker de stelling, hoe minder er doorkomt), maar terugschieten doen ze met hun aanvalskracht
    const ratio = aPow / Math.max(1e-6, dPow), block = Math.pow(clamp(ratio, 0.2, 1.4), 0.7), ret = Math.pow(clamp(1 / ratio, 0.6, 2.2), 0.3);   // sterke stelling: minder schade erin, iets meer eruit
    // grote overmacht (2:1) voelt als zekere winst: dan ook duidelijk minder eigen verlies
    const crush = ratio >= 2 ? 0.5 : ratio >= 1.4 ? 0.8 : 1;
    const toDef = Math.max(0, aPow * 0.42 * block * rnd(0.8, 1.2)), toAtt = Math.max(0, dAtk * 0.36 * ret * rnd(0.8, 1.2) * crush);
    for(const x of fD) x[0].hp -= toDef / fD.length;
    for(const x of fA) x[0].hp -= toAtt / fA.length;
    // onder vuur: ingraven brokkelt af, en artillerie sloopt de bunkers
    for(const d of defs) d.ent = Math.max(0, (d.ent || 0) - 3);
    if(G.forts[t]){ const fd = (G.fdm ||= {}); fd[t] = (fd[t] || 0) + 0.02 + 0.25 * artF / Math.max(1, fA.length); if(fd[t] >= 1){ fd[t] = 0; G.forts[t]--; if(main === G.player || own === G.player) toast('Bunkerlinie bij ' + P[t].n + ' kapotgeschoten (nog niveau ' + G.forts[t] + ')', own === G.player ? 'war' : 'good'); if(!G.forts[t]) delete G.forts[t]; } }
    for(const a of atts){
      if(a.hp <= 0){ a.dead = true; kill(own, a.c); if(a.c === G.player){ G.stats.lost++; toast('Divisie gesneuveld bij ' + P[t].n, 'war', 'kia'); } }
      else if(a.hp < 20){ a.att = null; a.air = false; a.path = []; }
    }
    let held = 0;
    for(const d of defs){
      if(d.hp <= 0){ d.dead = true; kill(main, d.c); if(d.c === G.player) G.stats.lost++; continue; }
      if(d.hp < 20){
        const opts = ADJ[t].filter(n => G.ctrl[n] === d.c && !by[n]);
        const fall = opts.length ? opts : ADJ[t].filter(n => G.ctrl[n] === d.c);
        if(fall.length){ d.loc = fall[0]; d.path = []; d.prog = 0; d.att = null; }
        else { d.dead = true; kill(main, d.c); if(d.c === G.player){ G.stats.lost++; toast('Divisie omsingeld in ' + P[t].n, 'war', 'kia'); } }
        continue;
      }
      held++;
    }
    const live = atts.filter(a => !a.dead && a.att === t);
    if(!held && live.length){
      const best = live.reduce((x,y) => y.hp > x.hp ? y : x);
      capture(t, best.c);
      // alleen wat de aanvoer aankan trekt de provincie in (de generaal en de AI); de rest blijft staan als reserve. Jouw eigen bevel gaat altijd mee
      const mv = live.filter(a => a.c === best.c).sort((x, y) => (y.man ? 1 : 0) - (x.man ? 1 : 0) || (y.path[0] === t) - (x.path[0] === t) || y.hp - x.hp);
      const lim = Math.max(4, Math.floor(supCap(t, best.c) * FRONT_MUL)); let k = 0;
      for(const a of live){
        if(a.c !== best.c){ a.att = null; a.air = false; continue; }
      }
      for(const a of mv){
        a.att = null; a.air = false;
        if(a.man || k < lim){ a.loc = t; a.prog = 0; if(a.path[0] === t) a.path.shift(); k++; }
        else { a.path = []; a.prog = 0; }
      }
    } else if(live.length){
      G.battles.push({t, from:live[0].loc, att:main, def:own, r: aPow/(aPow + dPow), air:live.some(a => a.air), w:W, fa:fA.length, fd:fD.length, ra:live.length - fA.length, rd:Math.max(0, held - fD.length)});
    }
  }
  if(G.player && G.battles.some(b => (b.att === G.player || b.def === G.player) && !PREVB[b.t])) sfx('battle');
  PREVB = {}; for(const b of G.battles) PREVB[b.t] = 1;
  if(G.units.some(u => u.dead)){
    G.units = G.units.filter(u => !u.dead);
    for(const id of [...UI.sel]) if(!unitById(id)) UI.sel.delete(id);
  }
}
// verloren divisies tellen voor de oorlogspunten van de winnaar en drukken de steun van de verliezer
function kill(k, v){ const key = k + '>' + v; (G.kill ||= {})[key] = (G.kill[key] || 0) + 1; const n = G.nations[v]; if(n) n.ws = clamp(n.ws - 10 / Math.max(10, armyCap(v)), 0, 100); }
function canDrop(u, p){
  return u.t === 'para' && !u.att && !u.path.length && (u.dropCd||0) <= G.day && atWar(u.c, G.ctrl[p]) && distKm(u.loc, p) <= PARA_KM;
}
function doDrop(u, p){
  u.dropCd = G.day + 30;
  const fe = cover(G.ctrl[p], p, 'fi'), fo = cover(u.c, p, 'fi');
  const sup = fe + fo > 0 ? fe/(fe + fo) : 0;
  u.hp = Math.max(25, u.hp - 30*sup);
  buildIdx();
  if(!defendersAt(p).length){
    const before = OOSP.length; capture(p, u.c); u.loc = p; u.path = []; u.att = null;
    computeSupply(true);
    const cut = OOSP.filter(q => atWar(u.c, G.ctrl[q])).length;
    if(u.c === G.player && cut) toast('Luchtlanding: ' + cut + ' vijandelijke provincie' + (cut === 1 ? '' : 's') + ' afgesneden van de aanvoer', 'good');
  }
  else {
    u.att = p; u.air = true; u.path = [];
    for(const d of defendersAt(p)) d.ent = 0;
    (G.shock ||= {})[p] = G.day + 10;
    if(u.c === G.player) toast('Luchtlanding bij ' + P[p].n + ': verdedigers verrast, 10 dagen −25%', 'good');
  }
  fx(p, 'para');
}
