'use strict';
const $ = id => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';

/* ================= kaarten ================= */
const MAPS = { europe:{file:'europe.json', hd:'europe-hd.json', name:'Europa', tm:1}, world:{file:'world.json', hd:'world-hd.json', name:'Wereld', tm:1.7} };
let MAPNAME = null, DATA = null, P = {}, ADJ = {}, CN = {}, PIDS = [], CIDS = [], CPROV = {}, W = 1150, H = 950, KM = 4.37, TM = 1;
let STAR = {}, CITY = {}, STARP = [];
let LONG = new Set();   // lange zeeroutes (oceaanoversteek)
let PPOP = {}, TER = {}, RIV = {}, CAPS = new Set(), SEA = new Set(), JIT = {}, MAJORS = new Set(), ROUTES = [], RTOUCH = {};
const CACHE = {};
const ek = (a,b) => a < b ? a+'|'+b : b+'|'+a;
async function loadMap(name){
  if(!CACHE[name]){
    const r = await fetch(MAPS[name].file);
    if(!r.ok) throw new Error('HTTP ' + r.status);
    CACHE[name] = await r.json();
  }
  if(MAPNAME !== name){ setMap(name, CACHE[name]); loadHD(name); }
}
/* scherpe kaartdata voor ingezoomd: wordt na het laden op de achtergrond opgehaald */
const HDCACHE = {}, HDLOAD = {};
let HD = null, HDP = {}, HDO = {}, HDM = null;
function loadHD(name){
  if(HDCACHE[name]){ useHD(name); return; }
  if(HDLOAD[name]) return;
  HDLOAD[name] = true;
  setTimeout(() => fetch(MAPS[name].hd).then(r => r.ok ? r.json() : null).then(d => {
    if(d){ HDCACHE[name] = d; useHD(name); }
  }).catch(() => {}).finally(() => { HDLOAD[name] = false; }), 400);
}
function useHD(name){
  if(MAPNAME !== name) return;
  HD = HDCACHE[name]; HDP = {}; HDO = {}; HDCH = {}; HDM = new DOMMatrix([HD.g, 0, 0, HD.g, 0, 0]);
  if(V.k < 0.8) baseDirty = true;
  // paden alvast in kleine porties opbouwen, zodat inzoomen later niet hapert
  const hd = HD, todo = PIDS.slice(), todoC = Object.keys(HD.o);
  const step = () => {
    if(HD !== hd) return;
    const t = performance.now();
    while(todo.length && performance.now() - t < 6) hdPath(todo.pop());
    // daarna de landsgrenzen in stukjes (voor snel bijwerken na een verovering)
    while(!todo.length && todoC.length && performance.now() - t < 6){ const c = todoC.pop(); HDCH[c] ||= chunksOf(parseRings(HD.o[c][0]), 0, HD.g); }
    if(todo.length || todoC.length) setTimeout(step, 30);
  };
  setTimeout(step, 300);
}
function hdPath(p){
  let x = HDP[p];
  if(!x){ x = new Path2D(); x.addPath(new Path2D(HD.p[p] || ''), HDM); HDP[p] = x; }
  return x;
}
function hdOutline(ctx, x0, y0, x1, y1){
  for(const c in HD.o){
    const o = HD.o[c], b = o[1];
    if(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
    let x = HDO[c];
    if(!x){ x = new Path2D(); x.addPath(new Path2D(o[0]), HDM); HDO[c] = x; }
    ctx.stroke(x);
  }
}
function setMap(name, d){
  MAPNAME = name; DATA = d; HD = null; HDP = {}; HDO = {}; P = d.provinces; ADJ = d.adj; CN = d.countries;
  PIDS = Object.keys(P); CIDS = Object.keys(CN); W = d.w; H = d.h; KM = d.kmpx; TM = MAPS[name].tm; ROUTES = d.routes;
  CPROV = {}; CIDS.forEach(c => CPROV[c] = []); PIDS.forEach(p => CPROV[P[p].c].push(p));
  PPOP = {}; PIDS.forEach(p => PPOP[p] = CN[P[p].c].pop / CPROV[P[p].c].length);   // bevolking per provincie
  TER = d.ter || {}; RIV = {}; for(const [a, b, sz] of (d.riv || [])) RIV[ek(a, b)] = sz;   // terrein en rivierovergangen
  CAPS = new Set(CIDS.map(c => CN[c].cap));                                                   // hoofdsteden = stad
  STAR = {}; CITY = d.city || {};                                                             // sterren: steden die tellen voor de overgave
  for(const p of PIDS) STAR[p] = (d.st && d.st[p]) || 1;
  for(const c of CIDS) STAR[CN[c].cap] = 3;
  STARP = PIDS.filter(p => STAR[p] >= 2);
  initSlots();
  SEA = new Set(ROUTES.map(r => ek(r[0], r[1])));
  LONG = new Set(ROUTES.filter(r => Math.hypot(r[4]-r[2], r[5]-r[3]) * d.kmpx > 500).map(r => ek(r[0], r[1])));
  RTOUCH = {}; ROUTES.forEach((r,i) => { (RTOUCH[r[0]] ||= []).push(i); (RTOUCH[r[1]] ||= []).push(i); });
  JIT = {};
  PIDS.forEach((p,i) => { let h = 7; for(const ch of p) h = (h*131 + ch.charCodeAt(0)) >>> 0; h = (h + i*2654435761) >>> 0; JIT[p] = ((h % 1000)/1000 - .5) * 0.13; });
  MAJORS = new Set(CIDS.slice().sort((a,b) => CN[b].f - CN[a].f).slice(0, name === 'world' ? 14 : 7));
  buildMap();
  V.cx = W/2; V.cy = H/2;
}
