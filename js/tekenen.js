'use strict';
/* ================= kaart opbouwen (canvas) ================= */
// De kaart wordt één keer naar een buffer getekend; schuiven en zoomen gaan via een CSS-transform (GPU)
// en pas als je stilstaat of buiten de buffer komt, wordt opnieuw getekend.
const stage = $('stage'), baseC = $('base'), overC = $('over');
const bctx = baseC.getContext('2d', {alpha:false}), octx = overC.getContext('2d');
const hitCtx = document.createElement('canvas').getContext('2d');
const SEA_COL = '#0A1117', LAND_BG = '#161F27';
const FONT_UI = "'Barlow Condensed','Arial Narrow',sans-serif";
let PATH = {}, BBOX = {}, FILL = {}, BACK = null, OUTL = null, LABELS = [], WARSET = new Set();
let mapDirty = true, baseDirty = true, overDirty = true, labelsDirty = false, CVL = 0;
const DIRTYP = new Set();
const BASE_MS = isTouch ? 900 : 350;
function bboxOf(d){
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const re = /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g; let m;
  while((m = re.exec(d))){ const x = +m[1], y = +m[2]; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
// Kaartpaden: 'M x y l dx dy ... z' (compact). Per zoomniveau een vereenvoudigde versie (LOD).
const LOD_STEP = [0, 0.6, 1.5, 3.5, 8];
let RINGS = {}, LODP = [], LODB = [], LODO = [], LODALL = [], BACKR = null, OUTLR = null;
function parseRings(d){
  const rings = []; const re = /[Mlz]|-?\d*\.?\d+/g; let m, cur = null, x = 0, y = 0, mode = '', buf = [];
  while((m = re.exec(d))){
    const t = m[0];
    if(t === 'M'){ mode = 'M'; buf = []; continue; }
    if(t === 'l'){ mode = 'l'; continue; }
    if(t === 'z'){ if(cur && cur.length >= 6) rings.push(new Float32Array(cur)); cur = null; continue; }
    buf.push(+t);
    if(buf.length === 2){
      if(mode === 'M'){ x = buf[0]; y = buf[1]; cur = [x, y]; }
      else { x += buf[0]; y += buf[1]; cur.push(x, y); }
      buf = [];
    }
  }
  return rings;
}
function simplified(rings, step){
  const p = new Path2D();
  for(const r of rings){
    let lx = r[0], ly = r[1], n = 1;
    const pts = [lx, ly];
    for(let i = 2; i < r.length; i += 2){
      const x = r[i], y = r[i+1];
      if(Math.abs(x - lx) + Math.abs(y - ly) < step) continue;
      pts.push(x, y); lx = x; ly = y; n++;
    }
    if(n < 3) continue;
    p.moveTo(pts[0], pts[1]);
    for(let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i+1]);
    p.closePath();
  }
  return p;
}
// landsgrenzen in korte stukjes, elk met een eigen kader: bij het bijwerken van één provincie
// tekenen we alleen de stukjes in de buurt, niet de hele wereldgrens (Canada alleen is al 65.000 punten)
let OCH = [], HDCH = {};
function chunksOf(rings, step, sc){
  const out = [], f = sc || 1;
  for(const r of rings){
    let lx = r[0], ly = r[1]; const pts = [lx*f, ly*f];
    for(let i = 2; i < r.length; i += 2){ const x = r[i], y = r[i+1]; if(step && Math.abs(x - lx) + Math.abs(y - ly) < step) continue; pts.push(x*f, y*f); lx = x; ly = y; }
    pts.push(pts[0], pts[1]);
    for(let s0 = 0; s0 < pts.length - 2; s0 += 96){
      const e = Math.min(pts.length, s0 + 98), p = new Path2D(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for(let i = s0; i < e; i += 2){ const x = pts[i], y = pts[i+1]; if(i === s0) p.moveTo(x, y); else p.lineTo(x, y); if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
      out.push({b:[x0, y0, x1, y1], p});
    }
  }
  return out;
}
function strokeChunks(ctx, list, x0, y0, x1, y1){ for(const ch of list){ const b = ch.b; if(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue; ctx.stroke(ch.p); } }
function outlineNear(ctx, x0, y0, x1, y1, hd, lvl){
  if(hd){
    for(const c in HD.o){
      const ob = HD.o[c][1]; if(ob[2] < x0 || ob[0] > x1 || ob[3] < y0 || ob[1] > y1) continue;
      strokeChunks(ctx, HDCH[c] ||= chunksOf(parseRings(HD.o[c][0]), 0, HD.g), x0, y0, x1, y1);
    }
  } else { const l = Math.max(0, lvl ?? CVL); strokeChunks(ctx, OCH[l] ||= chunksOf(OUTLR, l ? LOD_STEP[l] : 0), x0, y0, x1, y1); }
}
function lodLevel(){ let l = 0; for(let i = 1; i < LOD_STEP.length; i++) if(LOD_STEP[i] <= 0.8*V.k) l = i; return l; }
function lodPaths(l){
  if(LODP[l]) return LODP[l];
  if(l === 0){ LODP[0] = PATH; return PATH; }
  const o = {};
  for(const p of PIDS) o[p] = simplified(RINGS[p], LOD_STEP[l]);
  LODB[l] = simplified(BACKR, LOD_STEP[l]); LODO[l] = simplified(OUTLR, LOD_STEP[l]);
  return LODP[l] = o;
}
function lodAll(l){
  if(LODALL[l]) return LODALL[l];
  const paths = lodPaths(l), all = new Path2D();
  for(const p of PIDS) all.addPath(paths[p]);
  return LODALL[l] = all;
}
function buildMap(){
  PATH = {}; BBOX = {}; FILL = {}; RINGS = {}; LODP = []; LODB = []; LODO = []; LODALL = []; OCH = [];
  for(const p of PIDS){ PATH[p] = new Path2D(P[p].d); BBOX[p] = P[p].b || bboxOf(P[p].d); RINGS[p] = parseRings(P[p].d); }
  BACK = new Path2D(DATA.backdrop); OUTL = new Path2D(DATA.outline);
  BACKR = parseRings(DATA.backdrop); OUTLR = parseRings(DATA.outline);
  LODB[0] = BACK; LODO[0] = OUTL;
  for(let l = 1; l < LOD_STEP.length; l++){ lodPaths(l); lodAll(l); }
  mapDirty = true; baseDirty = true; overDirty = true;
}
// ligt een provincie in het stuk kaart dat nu in de buffer staat?
function inBuf(p){
  const b = BBOX[p], bw = baseC.width / Q, bh = baseC.height / Q;
  const x0 = CV.cx - bw/2*CV.k, x1 = CV.cx + bw/2*CV.k, y0 = CV.cy - bh/2*CV.k, y1 = CV.cy + bh/2*CV.k;
  return !(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1);
}
let POLSTALE = true;
function setFill(p){
  const c = G ? G.ctrl[p] : P[p].c;
  const occ = G && P[p].c !== c;
  FILL[p] = shade(colorOf(c), JIT[p] + (occ ? -0.12 : 0));
  if(G && CV){ if(inBuf(p)){ DIRTYP.add(p); labelsDirty = true; } } else mapDirty = true;
}
function setCtrl(p, c){
  const prev = G.ctrl[p];
  if(prev === c) return;
  G.ctrl[p] = c; CTRLV++; POLSTALE = true; (G.hold ||= {})[p] = G.day;
  if(!ownDirty){ const a = OWN[prev]; if(a){ const i = a.indexOf(p); if(i >= 0) a.splice(i, 1); } (OWN[c] ||= []).push(p); NBDAY = -1; }
  setFill(p);
}
function allFills(){ for(const p of PIDS) setFill(p); baseDirty = true; ownDirty = true; }
function computePolitical(){
  WARSET = new Set();
  if(G) for(const p of PIDS){ const c = G.ctrl[p]; if(c !== G.player && atWar(G.player, c)) WARSET.add(p); }
  const acc = {};
  for(const p of PIDS){
    const c = G ? G.ctrl[p] : P[p].c;
    const w = Math.sqrt(P[p].ar || 1);
    const a = acc[c] ||= {x:0, y:0, w:0, ar:0, ps:[]};
    a.x += P[p].a[0]*w; a.y += P[p].a[1]*w; a.w += w; a.ar += P[p].ar || 0; a.ps.push(p);
  }
  LABELS = [];
  const kf = MAPNAME === 'world' ? 0.075 : 0.085, minFs = MAPNAME === 'world' ? 2.6 : 5.5;
  for(const c in acc){
    const a = acc[c], cx = a.x/a.w, cy = a.y/a.w;
    let best = a.ps[0], bd = Infinity;
    for(const p of a.ps){ const d = (P[p].a[0]-cx)**2 + (P[p].a[1]-cy)**2; if(d < bd){ bd = d; best = p; } }
    const inside = bd < 900;
    LABELS.push({x: inside ? cx : P[best].a[0], y: inside ? cy : P[best].a[1], fs: clamp(Math.sqrt(a.ar)*kf, minFs, 30), t: cname(c).toUpperCase()});
  }
  mapDirty = false; POLSTALE = false;
}
/* terreinpatronen (vaste schermgrootte): bergen = driehoekjes, heuvels = boogjes, woestijn = puntjes, moeras = streepjes */
let TPAT = null;
function terrainPatterns(){
  const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x); return bctx.createPattern(c, 'repeat'); };
  return {
    m: mk(22, 18, x => { x.strokeStyle = 'rgba(0,0,0,.30)'; x.lineWidth = 1.3; x.lineJoin = 'round'; x.beginPath(); x.moveTo(3, 12); x.lineTo(7.5, 5); x.lineTo(12, 12); x.moveTo(13, 17); x.lineTo(16.5, 11.5); x.lineTo(20, 17); x.stroke(); }),
    h: mk(20, 16, x => { x.strokeStyle = 'rgba(0,0,0,.24)'; x.lineWidth = 1.2; x.beginPath(); x.arc(7, 11, 4, Math.PI, 0); x.stroke(); }),
    d: mk(12, 12, x => { x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(2, 3, 1.4, 1.4); x.fillRect(8, 8, 1.4, 1.4); }),
    w: mk(16, 10, x => { x.strokeStyle = 'rgba(0,0,0,.26)'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(2, 5); x.lineTo(9, 5); x.moveTo(8, 9); x.lineTo(14, 9); x.stroke(); })
  };
}
let TPAT_S = 0;
function terrainScale(s){
  TPAT ||= terrainPatterns();
  if(TPAT_S === s) return; TPAT_S = s;
  const m = new DOMMatrix().scale(Q/s);
  for(const k in TPAT) if(TPAT[k].setTransform) TPAT[k].setTransform(m);
}
function fillTerrain(ctx, p, path){
  const t = TER[p]; if(!t) return;
  ctx.fillStyle = TPAT[t]; ctx.fill(path, 'evenodd');
}
let HATCH = null, OWNPAT = null, HATCHCB = false;
function ownPattern(){
  const c = document.createElement('canvas'); c.width = c.height = 10;
  const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.arc(5, 5, 1.6, 0, Math.PI*2); x.fill();
  return bctx.createPattern(c, 'repeat');
}
function hatchPattern(){
  const c = document.createElement('canvas'); c.width = c.height = 9;
  const x = c.getContext('2d');
  HATCHCB = SET.cb;
  x.strokeStyle = SET.cb ? 'rgba(0,0,0,.85)' : 'rgba(212,85,63,.6)'; x.lineWidth = 2.6;
  x.beginPath(); x.moveTo(-1, 10); x.lineTo(10, -1); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(7, 11); x.lineTo(11, 7); x.stroke();
  return bctx.createPattern(c, 'repeat');
}

/* ---- buffers en resolutie ---- */
const OS = 0.15;                     // extra rand rond het scherm in de buffer
let Q = 1, Q2 = 1, CW = 0, CH = 0, CV = null, lastBase = 0, lastWheel = 0;
function sizeCanvases(){
  CW = stage.clientWidth || innerWidth; CH = stage.clientHeight || innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 3);
  const bw = Math.round(CW*(1 + 2*OS)), bh = Math.round(CH*(1 + 2*OS));
  Q = clamp(Math.sqrt((isTouch ? 9e6 : 16e6) / (bw*bh)), 0.75, dpr);       // pixelbudget voor de kaartbuffer
  Q2 = clamp(Math.sqrt(6e6 / (CW*CH)), 0.85, Math.min(dpr, isTouch ? 2 : 3));     // en voor de bovenlaag (wordt elk beeld opnieuw getekend)
  baseC.width = Math.round(bw*Q); baseC.height = Math.round(bh*Q);
  baseC.style.width = bw + 'px'; baseC.style.height = bh + 'px';
  baseC.style.left = Math.round(-OS*CW) + 'px'; baseC.style.top = Math.round(-OS*CH) + 'px';
  overC.width = Math.round(CW*Q2); overC.height = Math.round(CH*Q2);
  baseDirty = true; overDirty = true;
}
function renderBase(coarse){
  if(!DATA || !CW) return;
  if(mapDirty || POLSTALE) computePolitical();
  baseDirty = false; CV = {cx:V.cx, cy:V.cy, k:V.k}; lastBase = performance.now(); DIRTYP.clear(); labelsDirty = false;
  const bw = baseC.width / Q, bh = baseC.height / Q;
  const ctx = bctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = SEA_COL; ctx.fillRect(0, 0, baseC.width, baseC.height);
  const s = Q / V.k, tx = bw/2*Q - V.cx*s, ty = bh/2*Q - V.cy*s;
  ctx.setTransform(s, 0, 0, s, tx, ty);
  const px = V.k;
  const vx0 = V.cx - bw/2*V.k, vx1 = V.cx + bw/2*V.k, vy0 = V.cy - bh/2*V.k, vy1 = V.cy + bh/2*V.k;
  ctx.lineJoin = 'miter'; ctx.miterLimit = 2;
  // zeeroutes over de oceaan: dunne stippellijn, zodat je ziet waar je kunt oversteken
  if(LONG.size){
    ctx.strokeStyle = 'rgba(140,185,220,.13)'; ctx.lineWidth = 0.9*px; ctx.setLineDash([3*px, 5*px]); ctx.beginPath();
    for(const r of ROUTES){
      if(!LONG.has(ek(r[0], r[1]))) continue;
      if(Math.max(r[2], r[4]) < vx0 || Math.min(r[2], r[4]) > vx1 || Math.max(r[3], r[5]) < vy0 || Math.min(r[3], r[5]) > vy1) continue;
      ctx.moveTo(r[2], r[3]); ctx.lineTo(r[4], r[5]);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // ingezoomd (en niet te veel kaart in beeld): scherpe data; anders vereenvoudigde versie per zoomniveau
  const hd = !!HD && V.k < 0.8 && (vx1 - vx0)*(vy1 - vy0) < 1.4e6;
  const lv = hd ? 0 : Math.min(LOD_STEP.length - 1, lodLevel() + (coarse ? 1 : 0)), LP = lodPaths(lv);
  CVL = hd ? -1 : lv; if(coarse && !hd) baseDirty = true;
  ctx.fillStyle = LAND_BG; ctx.fill(LODB[lv], 'evenodd');
  ctx.strokeStyle = '#070C10'; ctx.lineWidth = 0.6*px; ctx.stroke(LODB[lv]);
  const vis = [], vp = [];
  for(const p of PIDS){
    const b = BBOX[p];
    if(b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
    const path = hd ? hdPath(p) : LP[p];
    vis.push(p); vp.push(path);
    ctx.fillStyle = FILL[p]; ctx.fill(path, 'evenodd');
  }
  if(V.k < 1.4){ terrainScale(s); for(let i = 0; i < vis.length; i++) fillTerrain(ctx, vis[i], vp[i]); }
  if(G && SET.cb){   // eigen land: stippen, zodat je het zonder kleur herkent
    OWNPAT ||= ownPattern(); if(OWNPAT.setTransform) OWNPAT.setTransform(new DOMMatrix().scale(Q/s));
    ctx.fillStyle = OWNPAT; const me0 = G.player;
    for(let i = 0; i < vis.length; i++) if(G.ctrl[vis[i]] === me0) ctx.fill(vp[i], 'evenodd');
  }
  if(G && enemiesOf(G.player).length){
    if(!HATCH || HATCHCB !== SET.cb) HATCH = hatchPattern();
    if(HATCH && HATCH.setTransform) HATCH.setTransform(new DOMMatrix().scale(Q/s));
    ctx.fillStyle = HATCH;
    const me = G.player;
    for(let i = 0; i < vis.length; i++){ const c = G.ctrl[vis[i]]; if(c !== me && atWar(me, c)) ctx.fill(vp[i], 'evenodd'); }
  }
  ctx.strokeStyle = 'rgba(4,8,11,.55)'; ctx.lineWidth = (hd ? 0.9 : 0.6)*px;
  if(vis.length > 250 && !hd) ctx.stroke(lodAll(lv));
  else for(const path of vp) ctx.stroke(path);
  ctx.strokeStyle = SET.cb ? '#F4F4F0' : '#04080B'; ctx.lineWidth = (SET.cb ? 3.2 : 1.5)*px;
  outlineNear(ctx, vx0, vy0, vx1, vy1, hd, lv);
  // rivierovergangen: blauw streepje dwars op de lijn tussen twee provincies
  if(V.k < 0.45){
    ctx.strokeStyle = 'rgba(110,170,230,.55)'; ctx.lineCap = 'round';
    for(const k in RIV){
      const i = k.indexOf('|'), a = P[k.slice(0, i)].a, b = P[k.slice(i+1)].a;
      const mx = (a[0]+b[0])/2, my = (a[1]+b[1])/2;
      if(mx < vx0 || mx > vx1 || my < vy0 || my > vy1) continue;
      const dx = b[0]-a[0], dy = b[1]-a[1], L = Math.hypot(dx, dy) || 1, h = (RIV[k] === 2 ? 7 : 5)*px;
      ctx.lineWidth = (RIV[k] === 2 ? 2.4 : 1.6)*px;
      ctx.beginPath(); ctx.moveTo(mx - dy/L*h, my + dx/L*h); ctx.lineTo(mx + dy/L*h, my - dx/L*h); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  // landnamen in schermruimte
  ctx.setTransform(Q, 0, 0, Q, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for(const l of LABELS){
    const fs = Math.min(64, l.fs / V.k);
    if(fs < 7.5) continue;
    const sx = (l.x - V.cx)/V.k + bw/2, sy = (l.y - V.cy)/V.k + bh/2;
    if(sx < -300 || sx > bw + 300 || sy < -60 || sy > bh + 60) continue;
    ctx.font = '700 ' + fs.toFixed(1) + 'px ' + FONT_UI;
    ctx.lineWidth = Math.max(1.5, fs*0.14); ctx.strokeStyle = 'rgba(5,9,12,.55)'; ctx.strokeText(l.t, sx, sy);
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.fillText(l.t, sx, sy);
  }
  baseC.style.transform = '';
}
function paintProvinces(){
  // alleen veranderde provincies (met buren, binnen hun kader) opnieuw in de buffer tekenen
  const ctx = bctx, bw = baseC.width / Q, bh = baseC.height / Q;
  const s = Q / CV.k, tx = bw/2*Q - CV.cx*s, ty = bh/2*Q - CV.cy*s, px = CV.k;
  const hd = CVL < 0 && !!HD, LP = lodPaths(Math.max(0, CVL)), me = G.player, pathOf = q => hd ? hdPath(q) : LP[q];
  ctx.setTransform(s, 0, 0, s, tx, ty); ctx.lineJoin = 'miter'; ctx.miterLimit = 2;
  if(HATCH && HATCH.setTransform) HATCH.setTransform(new DOMMatrix().scale(Q/s));
  for(const p of DIRTYP){
    const b = BBOX[p], pad = 2*px;
    ctx.save(); ctx.beginPath(); ctx.rect(b[0]-pad, b[1]-pad, b[2]-b[0]+2*pad, b[3]-b[1]+2*pad); ctx.clip();
    const group = [p, ...ADJ[p]].filter(q => { const bb = BBOX[q]; return !(bb[2] < b[0]-pad || bb[0] > b[2]+pad || bb[3] < b[1]-pad || bb[1] > b[3]+pad); });
    for(const q of group){
      ctx.fillStyle = FILL[q]; ctx.fill(pathOf(q), 'evenodd');
      if(CV.k < 1.4){ terrainScale(s); fillTerrain(ctx, q, pathOf(q)); }
      const c = G.ctrl[q];
      if(SET.cb && c === me){ OWNPAT ||= ownPattern(); if(OWNPAT.setTransform) OWNPAT.setTransform(new DOMMatrix().scale(Q/s)); ctx.fillStyle = OWNPAT; ctx.fill(pathOf(q), 'evenodd'); }
      if(c !== me && atWar(me, c)){ if(!HATCH || HATCHCB !== SET.cb) HATCH = hatchPattern(); ctx.fillStyle = HATCH; ctx.fill(pathOf(q), 'evenodd'); }
    }
    ctx.strokeStyle = 'rgba(4,8,11,.55)'; ctx.lineWidth = (hd ? 0.9 : 0.6)*px;
    for(const q of group) ctx.stroke(pathOf(q));
    ctx.strokeStyle = SET.cb ? '#F4F4F0' : '#04080B'; ctx.lineWidth = (SET.cb ? 3.2 : 1.5)*px;
    outlineNear(ctx, b[0]-pad, b[1]-pad, b[2]+pad, b[3]+pad, hd);
    ctx.restore();
  }
  DIRTYP.clear();
}
function baseTransform(){
  if(!CV) return null;
  const f = CV.k / V.k, tx = (CV.cx - V.cx)/V.k, ty = (CV.cy - V.cy)/V.k;
  if(f === 1 && tx === 0 && ty === 0){ baseC.style.transform = ''; return {f, tx, ty, still:true}; }
  baseC.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + f.toFixed(4) + ')';
  return {f, tx, ty, still:false};
}

/* ================= camera ================= */
const V = {cx:575, cy:475, k:1};
let REM = 16, viewDirty = true;
const cw = () => CW || innerWidth;
const chh = () => CH || innerHeight;
function kFit(){ return Math.max(W/cw(), H/chh()) * 1.03; }
function clampView(){ V.k = clamp(V.k, 0.04, kFit()*1.45); V.cx = clamp(V.cx, 0, W); V.cy = clamp(V.cy, 0, H); }
function applyView(){ viewDirty = true; overDirty = true; }
// soepel naar een nieuwe camerastand (ease-out, 380 ms); met instant=true meteen
let TW = null;
function tweenView(cx, cy, k, instant){
  const t = {cx, cy, k};
  const save = {cx:V.cx, cy:V.cy, k:V.k};
  Object.assign(V, t); clampView(); const tgt = {cx:V.cx, cy:V.cy, k:V.k}; Object.assign(V, save);
  if(instant || !CV || (Math.abs(tgt.cx - V.cx) < 1e-6 && Math.abs(tgt.cy - V.cy) < 1e-6 && Math.abs(tgt.k - V.k) < 1e-9)){ Object.assign(V, tgt); TW = null; clampView(); applyView(); baseDirty = true; return; }
  TW = {from:{cx:V.cx, cy:V.cy, k:V.k}, to:tgt, t0:performance.now(), ms:380};
}
function tweenStep(now){
  if(!TW) return false;
  const a = Math.min(1, (now - TW.t0) / TW.ms), e = 1 - Math.pow(1 - a, 3);
  const lk = Math.exp(Math.log(TW.from.k) + (Math.log(TW.to.k) - Math.log(TW.from.k)) * e);   // zoom logaritmisch
  V.k = lk; V.cx = TW.from.cx + (TW.to.cx - TW.from.cx) * e; V.cy = TW.from.cy + (TW.to.cy - TW.from.cy) * e;
  applyView();
  if(a >= 1){ TW = null; clampView(); baseDirty = true; }
  return true;
}
function fitBox(x0, y0, x1, y1, pad, instant){
  const dockH = ($('dock').offsetHeight || 60);
  const k = Math.max((x1-x0)/cw(), (y1-y0)/Math.max(120, chh() - dockH*1.2)) * (pad || 1.12);
  tweenView((x0+x1)/2, (y0+y1)/2 + dockH*0.4*k, k, instant);
}
function fitAll(instant){ tweenView(W/2, H/2 + 10, kFit(), instant); }
function fitCountry(c){
  const ps = PIDS.filter(p => (G ? G.ctrl[p] : P[p].c) === c);
  if(!ps.length) return;
  const cap = CN[c].cap;
  const near = ps.filter(p => dist(p, cap)*KM < 2600);
  const use = near.length ? near : ps;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of use){ const [x,y] = P[p].a; x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y); }
  const m = Math.max(40, 300/KM);
  fitBox(x0-m, y0-m, x1+m, y1+m, 1.1);
}
// vredesconferentie: zet het verslagen land in het vrije deel van het scherm, naast of boven de kaart met eisen
function fitConf(e){
  const ps = baseOf(e); if(!ps.length) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const p of ps){ const [x, y] = P[p].a; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const m = Math.max(30, 200/KM); x0 -= m; y0 -= m; x1 += m; y1 += m;
  const wide = cw() >= 900, cardW = Math.min(25*REM, cw() - 32) + 40, cardH = Math.min(chh()*0.6, 36*REM) + 5*REM;
  const aw = wide ? cw() - cardW : cw() - 32, ah = wide ? chh() - 9*REM : Math.max(120, chh() - cardH - 4*REM);
  const k = Math.max((x1 - x0)/aw, (y1 - y0)/ah) * 1.08;
  const sx = wide ? aw/2 : cw()/2, sy = wide ? chh()/2 - 2*REM : 3.5*REM + ah/2;
  tweenView((x0 + x1)/2 - (sx - cw()/2)*k, (y0 + y1)/2 - (sy - chh()/2)*k, k);
}
function zoomAt(clientX, clientY, f){
  TW = null;
  const r = stage.getBoundingClientRect();
  const ox = clientX - r.left - r.width/2, oy = clientY - r.top - r.height/2;
  const sx = V.cx + ox*V.k, sy = V.cy + oy*V.k;
  V.k = clamp(V.k / f, 0.04, kFit()*1.45);
  V.cx = sx - ox*V.k; V.cy = sy - oy*V.k;
  clampView(); applyView();
}
const toScreen = (x, y) => [(x - V.cx)/V.k + CW/2, (y - V.cy)/V.k + CH/2];
function toMap(clientX, clientY){
  const r = stage.getBoundingClientRect();
  return [V.cx + (clientX - r.left - CW/2)*V.k, V.cy + (clientY - r.top - CH/2)*V.k];
}
function provinceAt(clientX, clientY){
  if(!DATA) return null;
  const [mx, my] = toMap(clientX, clientY);
  for(let i = PIDS.length - 1; i >= 0; i--){
    const p = PIDS[i], b = BBOX[p];
    if(mx < b[0] || mx > b[2] || my < b[1] || my > b[3]) continue;
    if(hitCtx.isPointInPath((HD && HDP[p]) || PATH[p], mx, my, 'evenodd')) return p;
  }
  return null;
}

/* ================= invoer ================= */
const ptrs = new Map();
let moved = 0, multi = false, box = null, dragOrd = null, lpTimer = 0, lpDone = false, lastTap = null;
function ownStackAt(x, y){
  if(!G || G.over || UI.target) return null;
  const h = hitAt(x, y);
  if(h && h.ctr){ const g = GROUPS[h.ctr]; if(g && g.c === G.player) return {kind:'land', g}; }
  if(h && h.air){ const g = AGROUPS[h.air]; if(g && g.c === G.player) return {kind:'air', g}; }
  // ruimer voor vingers: ook de provincie zelf telt als je daar geselecteerde troepen hebt
  if(h && h.p && UI.sel.size){
    const ids = [...UI.sel].filter(id => { const u = unitById(id); return u && u.loc === h.p; });
    if(ids.length) return {kind:'land', g:{ids, key:null}};
  }
  return null;
}
overC.addEventListener('pointerdown', e => {
  if(e.button !== 0 && e.pointerType === 'mouse') return;
  ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
  clearTimeout(lpTimer); lpDone = false;
  if(ptrs.size === 1){
    moved = 0; multi = false; dragOrd = null;
    box = (e.shiftKey && e.pointerType === 'mouse' && G && !G.over) ? {x0:e.clientX, y0:e.clientY, x1:e.clientX, y1:e.clientY} : null;
    if(!box){
      const st = ownStackAt(e.clientX, e.clientY);
      if(st){
        const sel = st.kind === 'land' ? UI.sel : UI.selAir;
        // slepen vanaf een geselecteerde stapel = bevel geven (anders schuift de kaart)
        if(st.g.ids.some(id => sel.has(id))) dragOrd = {kind:st.kind, key:st.g.key};
        // lang vasthouden = stapel toevoegen aan de selectie
        if(st.kind === 'land') lpTimer = setTimeout(() => {
          if(moved > 8 || ptrs.size !== 1) return;
          lpDone = true; UI.selAir = new Set(); UI.info = null;
          st.g.ids.forEach(id => UI.sel.add(id));
          try{ navigator.vibrate && navigator.vibrate(12); }catch(_){}
          toast(UI.sel.size + ' divisies geselecteerd', 'good', 'sel'); renderAll();
        }, 430);
      }
    }
  } else { multi = true; box = null; dragOrd = null; UI.dragTo = null; $('boxSel').hidden = true; clearTimeout(lpTimer); }
});
overC.addEventListener('pointermove', e => {
  if(!ptrs.has(e.pointerId)){ if(e.pointerType === 'mouse') hover(e); return; }
  const prev = ptrs.get(e.pointerId);
  if(box){
    box.x1 = e.clientX; box.y1 = e.clientY;
    moved += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    const b = $('boxSel'); b.hidden = false;
    b.style.left = Math.min(box.x0, box.x1) + 'px'; b.style.top = Math.min(box.y0, box.y1) + 'px';
    b.style.width = Math.abs(box.x1 - box.x0) + 'px'; b.style.height = Math.abs(box.y1 - box.y0) + 'px';
    return;
  }
  if(ptrs.size === 1){
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    moved += Math.abs(dx) + Math.abs(dy);
    if(moved > 8) clearTimeout(lpTimer);
    if(dragOrd && moved > 6){
      if(!overC.hasPointerCapture(e.pointerId)) try{ overC.setPointerCapture(e.pointerId); }catch(_){}
      const r = stage.getBoundingClientRect();
      UI.dragTo = {x:e.clientX - r.left, y:e.clientY - r.top, p:provinceAt(e.clientX, e.clientY)};
      HOVER = UI.dragTo.p; overDirty = true; hideTip();
      ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
      return;
    }
    if(moved > 6){
      if(!overC.hasPointerCapture(e.pointerId)) try{ overC.setPointerCapture(e.pointerId); }catch(_){}
      overC.classList.add('dragging'); TW = null;
      V.cx -= dx*V.k; V.cy -= dy*V.k; clampView(); applyView();
      hideTip(); HOVER = null;
    }
  } else if(ptrs.size === 2){
    const pts = [...ptrs.values()];
    const other = pts.find(p => p !== prev) || pts[1];
    const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
    const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    if(d0 > 0) zoomAt((e.clientX + other.x)/2, (e.clientY + other.y)/2, d1/d0);
    moved += 20;
  }
  ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
});
function hitAt(x, y){
  const r = stage.getBoundingClientRect();
  const sx = x - r.left, sy = y - r.top;
  for(let i = HITS.length - 1; i >= 0; i--){
    const h = HITS[i];
    if(sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1) return h.kind === 'air' ? {air:h.key, loc:h.loc} : {ctr:h.key, loc:h.loc};
  }
  const p = provinceAt(x, y);
  return p ? {p} : {sea:true};
}
const ptrUp = e => {
  const had = ptrs.has(e.pointerId);
  ptrs.delete(e.pointerId);
  clearTimeout(lpTimer);
  if(!ptrs.size) overC.classList.remove('dragging');
  const dOrd = dragOrd; dragOrd = null;
  if(UI.dragTo){ UI.dragTo = null; HOVER = null; overDirty = true; }
  if(!had || e.type === 'pointercancel') return;
  if(lpDone){ lpDone = false; return; }
  if(dOrd && moved > 6 && !multi){
    const p = provinceAt(e.clientX, e.clientY);
    if(p){ if(dOrd.kind === 'air') orderAir(p); else orderMove(p); }
    return;
  }
  if(box){
    const b = box; box = null; $('boxSel').hidden = true;
    if(moved > 8){ boxSelect(b); return; }
  }
  if(ptrs.size || multi || moved > (e.pointerType === 'mouse' ? 6 : 12)) return;
  if(e.pointerType !== 'mouse'){
    const now = performance.now();
    if(lastTap && now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30){
      lastTap = null; zoomAt(e.clientX, e.clientY, 1.9); return;   // dubbel tikken = inzoomen
    }
    lastTap = {t: now, x: e.clientX, y: e.clientY};
  }
  const h = hitAt(e.clientX, e.clientY);
  if(!h) return;
  if(h.air) onAirGroup(h.air, e);
  else if(h.ctr) onCounter(h.ctr, e);
  else if(h.p) onProvince(h.p, e);
  else onSea();
};
overC.addEventListener('pointerup', ptrUp);
overC.addEventListener('pointercancel', ptrUp);
overC.addEventListener('pointerleave', e => { if(e.pointerType === 'mouse'){ hideTip(); if(HOVER){ HOVER = null; overDirty = true; } } });
stage.addEventListener('wheel', e => { e.preventDefault(); lastWheel = performance.now(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0017)); if(e.pointerType !== 'touch'){ tipT = 0; hover(e); } }, {passive:false});   // na zoomen ligt er een andere provincie onder de muis
stage.addEventListener('pointerleave', () => { hideTip(); if(HOVER){ HOVER = null; overDirty = true; } });
overC.addEventListener('contextmenu', e => {
  e.preventDefault();
  if(!G || G.over) return;
  const h = hitAt(e.clientX, e.clientY);
  const p = h && (h.p || h.loc);
  if(!p) return;
  if(UI.selAir.size) orderAir(p);
  else if(UI.sel.size) orderMove(p);
});
addEventListener('keydown', e => {
  if(!G || G.over) return;
  // knoppen en invoervelden houden hun eigen toetsen (spatie drukt een knop in)
  if(e.key !== 'Escape' && e.target.closest && e.target.closest('button,input,select,textarea,[contenteditable]')) return;
  if(e.code === 'Space'){ e.preventDefault(); togglePause(); }
  else if(e.key >= '1' && e.key <= '4'){ G.speed = +e.key; if(!cardOpen()) G.paused = false; renderBar(); }
  else if(e.key === 'Escape'){ clearSel(); UI.target = null; UI.info = null; UI.sheet = null; renderAll(); }
  else if(e.key === 'm' || e.key === 'M'){ const on = !(SET.sound || SET.music); setSound(on); setMusic(on); sheetSig = ''; toast(on ? 'Geluid aan' : 'Geluid uit', '', 'mute'); }
});
function boxSelect(b){
  const r = stage.getBoundingClientRect();
  const x0 = Math.min(b.x0, b.x1) - r.left, x1 = Math.max(b.x0, b.x1) - r.left, y0 = Math.min(b.y0, b.y1) - r.top, y1 = Math.max(b.y0, b.y1) - r.top;
  const ids = [];
  for(const g of Object.values(GROUPS)){
    if(g.c !== G.player) continue;
    if(g.sx >= x0 && g.sx <= x1 && g.sy >= y0 && g.sy <= y1) ids.push(...g.ids);
  }
  UI.sel = new Set(ids); UI.selAir = new Set(); UI.info = null; renderAll();
}
function onSea(){
  if(!G){ UI.pick = null; renderAll(); return; }
  if(UI.target){ UI.target = null; renderAll(); return; }
  clearSel(); UI.info = null; renderAll();
}
function onCounter(key, e){
  if(!G || G.over) return;
  const g = GROUPS[key];
  if(!g) return;
  if(g.c !== G.player || UI.target || UI.selAir.size){ onProvince(g.loc, e); return; }
  if(e.shiftKey){ g.ids.forEach(id => UI.sel.add(id)); }
  else {
    const same = g.ids.length && g.ids.every(id => UI.sel.has(id)) && UI.sel.size === g.ids.length;
    UI.sel = same ? new Set() : new Set(g.ids);
  }
  UI.selAir = new Set(); UI.info = null; renderAll();
}
function onAirGroup(key, e){
  if(!G || G.over) return;
  const g = AGROUPS[key];
  if(!g) return;
  if(g.c !== G.player || UI.target){ onProvince(g.loc, e); return; }
  if(UI.selAir.size && !e.shiftKey && g.ids.every(id => UI.selAir.has(id))){ UI.selAir = new Set(); }
  else { if(!e.shiftKey) UI.selAir = new Set(); g.ids.forEach(id => UI.selAir.add(id)); }
  UI.sel = new Set(); UI.info = null; renderAll();
}
function onProvince(p, e){
  if(!G){ UI.pick = P[p].c; renderAll(); return; }
  if(G.over) return;
  if(UI.target){
    if(UI.target === 'drop'){
      let n = 0;
      for(const id of UI.sel){ const u = unitById(id); if(u && canDrop(u, p)){ doDrop(u, p); n++; } }
      if(n){ toast(n + (n === 1 ? ' divisie parachutisten' : ' divisies parachutisten') + ' landen in ' + P[p].n, 'good'); UI.target = null; renderAll(); }
      else toast('Kies een gemarkeerde vijandelijke provincie binnen ' + PARA_KM + ' km', 'war', 'bad');
      return;
    }
    if(validTarget(G.player, UI.target, p)){ doSpecial(G.player, UI.target, p); UI.target = null; renderAll(); }
    else toast(UI.target === 'bunker' ? 'Kies een eigen provincie' : 'Geen geldig doel binnen bereik', 'war', 'bad');
    return;
  }
  if(UI.selAir.size){ orderAir(p); return; }
  if(UI.sel.size){ orderMove(p); return; }
  const mine = G.units.filter(u => u.c === G.player && u.loc === p);
  if(mine.length){ UI.sel = new Set(mine.map(u => u.id)); UI.info = null; renderAll(); return; }
  UI.info = (UI.info === p) ? null : p; UI.confirm = null; renderAll();
}
function orderMove(p){
  if(UI.hintN < 4){ UI.hintN++; try{ localStorage.setItem('ve_hint_sel', UI.hintN); }catch(e){} }
  let ok = 0, fail = 0, atk = 0;
  const gid = G.nid++, goers = [], routes = {};
  PATHV++;
  for(const id of UI.sel){
    const u = unitById(id); if(!u) continue;
    if(u.air) continue;
    u.man = true; u.wt = null;
    if(u.loc === p){ u.path = []; u.att = null; u.prog = 0; u.g = null; ok++; continue; }
    if(!(u.loc in routes)) routes[u.loc] = findPath(u.c, u.loc, p, true);
    const path = routes[u.loc] && routes[u.loc].slice();
    if(!path){ fail++; continue; }
    if(u.path[0] !== path[0] || u.att) u.prog = 0;
    u.path = path; u.att = null; u.g = gid; ok++; goers.push(u);
    atk += atkPlain(u) * (G.ctrl[path[0]] !== u.c ? seaMul(u, u.loc, path[0]) : 1);
  }
  if(ok) sfx(G.ctrl[p] !== G.player && atWar(G.player, G.ctrl[p]) ? 'attack' : 'order');
  // verwachting tonen bij een aanval op een verdedigde provincie
  const tc = G.ctrl[p];
  if(goers.length && tc !== G.player && atWar(G.player, tc)){
    const o = battleOdds(goers, p);
    toast((o.n ? 'Aanval ' : 'Opmars naar ') + P[p].n + ': ' + oddsTxt(o), !o.n || o.r >= 1 ? 'good' : 'war', 'odds');
  }
  if(!ok && fail){
    const c = G.ctrl[p];
    toast(c !== G.player && !atWar(G.player, c) ? 'Je bent niet in oorlog met ' + cname(c) : 'Daar kunnen je divisies niet komen', 'war', 'bad');
    if(c !== G.player && !atWar(G.player, c)){ UI.info = p; clearSel(); }
  }
  renderAll();
}
function clearSel(){ UI.sel = new Set(); UI.selAir = new Set(); }
function togglePause(){ if(!G || G.over) return; if(cardOpen()){ toast('Neem eerst een beslissing', '', 'beslis'); return; } G.paused = !G.paused; if(!G.paused) UI.winShown = false; renderBar(); }

/* ================= tooltip ================= */
let tipT = 0, HOVER = null;
function hover(e, kp){
  const now = performance.now(); if(!kp && now - tipT < 50) return; tipT = now;
  const p = kp || provinceAt(e.clientX, e.clientY);
  if(p !== HOVER){ HOVER = p; overDirty = true; }
  if(!p){ hideTip(); return; }
  const c = G ? G.ctrl[p] : P[p].c;
  const tip = $('tip');
  let h = '<b>' + esc(P[p].n) + '</b> <span class="mut">· ' + esc(cname(c));
  if(G && P[p].c !== c) h += ' (bezet)';
  h += '</span>';
  if(G && c !== G.player && atWar(G.player, c)) h += ' <span class="warc">oorlog</span>';
  if(G && UI.selAir.size){
    const w = airById([...UI.selAir][0]);
    if(w){ const km = Math.round(distKm(w.base, p)); h += ' <span class="' + (km <= AIR[w.t].range ? 'okc' : 'warc') + '">' + km + ' km</span>'; }
  }
  if(G && TER[p]) h += ' <span class="mut">· ' + TER_NM[TER[p]] + '</span>';
  if(STAR[p] >= 2) h += ' ' + starsH(STAR[p]) + (CITY[p] && !CAPS.has(p) ? ' <span class="mut">' + esc(CITY[p]) + '</span>' : '');
  if(G && UI.sel.size && !UI.selAir.size && c !== G.player && atWar(G.player, c)){
    const o = selOdds(p);
    h += ' <span class="' + (!o.n || o.r >= 1 ? 'okc' : 'warc') + '">' + esc(oddsTxt(o)) + '</span>';
  }
  tip.innerHTML = h; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14, y = e.clientY + 16;
  if(x + r.width + 12 > innerWidth) x = e.clientX - r.width - 12;
  if(y + r.height + 12 > innerHeight) y = e.clientY - r.height - 12;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function hideTip(){ $('tip').hidden = true; }

/* toetsenbord op de kaart: pijltjes kiezen de buurprovincie in die richting, Enter werkt als een klik */
let KP = null;
const KDIR = {ArrowRight:[1, 0], ArrowLeft:[-1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1]};
function kbStart(){
  if(G && CN[G.player] && P[CN[G.player].cap]) return CN[G.player].cap;
  const r = stage.getBoundingClientRect();
  return provinceAt(r.left + r.width/2, r.top + r.height/2) || PIDS[0];
}
function kbNext(p, [dx, dy]){
  const [x0, y0] = P[p].a;
  let best = null, bs = Infinity;
  const pick = (list, minCos) => {
    for(const q of list){
      if(q === p || !P[q]) continue;
      const vx = P[q].a[0] - x0, vy = P[q].a[1] - y0, d = Math.hypot(vx, vy) || 1, cos = (vx*dx + vy*dy)/d;
      if(cos < minCos) continue;
      const s = d * (2 - cos);
      if(s < bs){ bs = s; best = q; }
    }
  };
  pick(ADJ[p] || [], 0.35);
  if(!best) pick(PIDS, 0.5);   // geen buur in die richting (eiland, kust): de dichtstbijzijnde provincie
  return best;
}
function kbFocus(p){
  KP = p; HOVER = p; overDirty = true;
  const r = stage.getBoundingClientRect();
  let [sx, sy] = toScreen(P[p].a[0], P[p].a[1]);
  if(sx < 40 || sy < 60 || sx > r.width - 40 || sy > r.height - 120){ tweenView(P[p].a[0], P[p].a[1], V.k, true); [sx, sy] = toScreen(P[p].a[0], P[p].a[1]); }
  hover({clientX: r.left + sx, clientY: r.top + sy}, p);
  $('mapLive').textContent = $('tip').textContent;
}
overC.addEventListener('keydown', e => {
  if(!DATA || e.altKey || e.ctrlKey || e.metaKey) return;
  if(KDIR[e.key]){ e.preventDefault(); const q = KP && P[KP] ? kbNext(KP, KDIR[e.key]) : kbStart(); if(q) kbFocus(q); }
  else if(e.key === 'Enter'){ e.preventDefault(); if(!KP || !P[KP]){ kbFocus(kbStart()); return; } onProvince(KP, e); kbFocus(KP); }
  else if(e.key === '+' || e.key === '=' || e.key === '-'){
    e.preventDefault();
    const r = stage.getBoundingClientRect(), [sx, sy] = KP && P[KP] ? toScreen(P[KP].a[0], P[KP].a[1]) : [r.width/2, r.height/2];
    zoomAt(r.left + sx, r.top + sy, e.key === '-' ? 1/1.5 : 1.5);
    if(KP && P[KP]) setTimeout(() => kbFocus(KP), 0);
  }
});
overC.addEventListener('focus', () => { if(KP && P[KP]) kbFocus(KP); });
overC.addEventListener('blur', () => { hideTip(); if(HOVER === KP){ HOVER = null; overDirty = true; } });

/* ================= symbolen: één set silhouetten voor kaart én menu's ================= */
const SIL = {
  inf:  {p:'M8.6 6.4a3.4 3.4 0 0 1 6.8 0v.5H8.6zM7.4 6.7h9.2v1.2H7.4zM10.1 9.6a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 1 0-3.8 0zM8.4 12.2h7.2l1 5.2H7.4zM8.6 17.4h2.6l-.4 4.6H8.2zM12.8 17.4h2.6l.4 4.6h-2.6zM17.3 3.2l1 .2-1.5 13.9-1-.1z'},
  mot:  {p:'M2.5 9.5h5.2l2.6 3.4v4.6H2.5zM11 6.5h10.5v11H11zM2.5 16.3h19v2H2.5zM3.8 19a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 1 0-4.6 0zM14.6 19a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 1 0-4.6 0z', d:'M3.6 10.7h3.6l1.7 2.3H3.6zM5.3 19a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0zM16.1 19a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0z'},
  tank: {p:'M4.8 12.2h14.6l1.8 3.3H3zM8 8.6h6.8l1.1 3.6H7.1zM15.6 9.4h6.6v1.5h-6.6zM4.2 15.5h15.6a2.9 2.9 0 0 1 0 5.8H4.2a2.9 2.9 0 0 1 0-5.8z', d:'M4.4 18.4a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0zM8.2 18.4a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0zM12 18.4a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0zM15.8 18.4a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z'},
  art:  {p:'M9.2 13.4 20.4 5.6l1.1 1.6-11.2 7.8zM6.6 10.2l4.6-2.6 1.4 5-4.6 1.6zM9 17.8l11.6 3 .4 1.5L8.6 19.6zM3.8 17.3a4.3 4.3 0 1 0 8.6 0 4.3 4.3 0 1 0-8.6 0z', d:'M6.6 17.3a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0z'},
  mar:  {p:'M9.6 4.3a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0zM10.9 6.4h2.2v13h-2.2zM7.4 8.8h9.2v1.9H7.4zM3 13.4h2.5c.4 3.4 3 5.8 6.5 6 3.5-.2 6.1-2.6 6.5-6H21c-.4 5-4.2 8.4-9 8.6-4.8-.2-8.6-3.6-9-8.6z', d:'M11 4.3a1 1 0 1 0 2 0 1 1 0 1 0-2 0z'},
  para: {p:'M2.6 10.2a9.4 7.6 0 0 1 18.8 0c-1.6-1-3.1-1-4.7 0-1.6-1-3.1-1-4.7 0-1.6-1-3.1-1-4.7 0-1.6-1-3.1-1-4.7 0zM3.4 10.6l.9-.5 7.2 7.3-.8.6zM20.6 10.6l-.9-.5-7.2 7.3.8.6zM11.5 10h1v7h-1zM10.9 17.9a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0zM10.2 19.2h3.6l.3 3.2h-4.2z'},
  aa:   {p:'M4.5 18.5h15v3h-15zM8.6 14.6h6.8l1 3.9H7.6zM11.4 15.3 18.2 3.6l1.5.9-6.8 11.7zM8.6 15.3l6.8-11.7 1.5.9-6.8 11.7z'},
  fi:   {p:'M12 1.8l1.4 5.8 8.4 4.3v2l-8.4-1.9-.6 6.2 3.1 2.3v1.7L12 21.1l-3.9 1.1v-1.7l3.1-2.3-.6-6.2-8.4 1.9v-2l8.4-4.3z'},
  cas:  {p:'M12 2.2l1.3 4.6h8.2v2.6l-7.9 1.5-.5 6.2 2.8 2.1v1.6L12 19.8l-3.9 1v-1.6l2.8-2.1-.5-6.2-7.9-1.5V6.8h8.2zM5 12.2a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0zM15.8 12.2a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0z'},
  bo:   {p:'M11 1.8h2l.7 17.4L12 21.6l-1.7-2.4zM1.2 10h21.6v2.6H1.2zM4.2 8.2h1.9v4.6H4.2zM7.6 8.2h1.9v4.6H7.6zM14.5 8.2h1.9v4.6h-1.9zM17.9 8.2h1.9v4.6h-1.9zM7.6 18.2h8.8v1.9H7.6z'},
  // economie & acties
  fab:  {p:'M2.5 21V10.5l5.5 3.4v-3.4l5.5 3.4V7.6l2.2-2.1h1.8V3h2.8v18z', d:'M5 16h2v2H5zM9.5 16h2v2h-2zM14 16h2v2h-2z'},
  rocket:{p:'M12 1.8c2.8 2.3 3.9 5.8 3.9 9.6v6.4H8.1v-6.4c0-3.8 1.1-7.3 3.9-9.6zM8.1 12.6 4.8 16.4v3l3.3-1.6zM15.9 12.6l3.3 3.8v3l-3.3-1.6zM10.3 18.4h3.4L12 22.6z', d:'M10.6 8.6a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0z'},
  tech: {p:'M8.6 2.5h6.8v1.8h-1.1v5.1l5.4 10a1.8 1.8 0 0 1-1.6 2.6H5.9a1.8 1.8 0 0 1-1.6-2.6l5.4-10V4.3H8.6z', d:'M7.4 15.4h9.2l1.8 3.4H5.6z'},
  sabot:{p:'M9.2 8.6h5.6v13.2H9.2zM8.4 6.6h7.2v2.4H8.4zM12 6.6V4.2c0-1.6 1.2-2.4 2.6-2.4', d:'M9.2 12h5.6v1.2H9.2zM9.2 16h5.6v1.2H9.2z'},
  blitz:{p:'M13.6 1.8 4.4 13.4h6.2l-1.2 8.8 9.4-12h-6.4z'},
  mobil:{p:'M3 9.4h3.6l9-5.4v16l-9-5.4H3zM6.4 15.4h3l1.4 5.8H7.6zM18 8.2c1.4.9 2.2 2.3 2.2 3.8s-.8 2.9-2.2 3.8l-.9-1.4c.9-.6 1.4-1.4 1.4-2.4s-.5-1.8-1.4-2.4z'},
  bunker:{p:'M2.5 21v-7.2C2.5 8.6 6.8 5 12 5s9.5 3.6 9.5 8.8V21z', d:'M7.4 12.6h9.2v2.2H7.4z'},
  // spelbegrippen
  steun:{p:'M5 2.5h1.8v19H5zM6.8 3.5h12.5l-2.9 4.4 2.9 4.4H6.8z'},
  agr:  {p:'M12 2.2 22.6 20.8H1.4z', d:'M11 9h2v6h-2zM11 16.6h2v2h-2z'},
  leger:{p:'M3.6 7.4a2.9 2.9 0 0 1 5.8 0v.4H3.6zM2.8 7.6h7.4v1H2.8zM5 10a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM3.6 12.2h5.8l.8 4.4H2.8zM3.8 16.6h2.1l-.3 4.4H3.5zM7.1 16.6h2.1l.3 4.4H7.4zM14.6 7.4a2.9 2.9 0 0 1 5.8 0v.4h-5.8zM13.8 7.6h7.4v1h-7.4zM16 10a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM14.6 12.2h5.8l.8 4.4h-7.4zM14.8 16.6h2.1l-.3 4.4h-2.1zM18.1 16.6h2.1l.3 4.4h-2.1zM9.1 5.4a2.9 2.9 0 0 1 5.8 0v.4H9.1zM8.3 5.6h7.4v1H8.3zM10.5 8a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM10.6 10.2h2.8v3.2h-2.8z'},
  bevel:{p:'M13.6 1.8 4.4 13.4h6.2l-1.2 8.8 9.4-12h-6.4z'},
  prov: {p:'M12 1.8a7 7 0 0 1 7 7c0 5.2-7 13.4-7 13.4S5 14 5 8.8a7 7 0 0 1 7-7z', d:'M9.6 8.8a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0z'},
  doel: {p:'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z', d:'M12 5.4a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 1 0 0-13.2z', e:'M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 1 0 0-6.8z'},
  oorlog:{p:'M2.5 2.5 5.4 2.8 15 12.4 12.4 15 2.8 5.4zM11 15.4 15.4 11l1.3 1.3-4.4 4.4zM14.4 16.2l1.8-1.8 4 4-1.8 1.8zM19.2 20.6a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0zM21.5 2.5 18.6 2.8 9 12.4l2.6 2.6 9.6-9.6zM13 15.4 8.6 11l-1.3 1.3 4.4 4.4zM9.6 16.2l-1.8-1.8-4 4 1.8 1.8zM4.8 20.6a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 1 0 2.8 0z'},
  vrede:{p:'M5 2h10l4.5 4.5V22H5z', d:'M7.6 8h8.8v1.4H7.6zM7.6 11h8.8v1.4H7.6zM7.6 14h5.6v1.4H7.6zM13.5 18.5a2 2 0 1 0 4 0 2 2 0 1 0-4 0z'},
  wit:  {p:'M5 2.5h1.8v19H5zM6.8 3.5h12.5v8.8H6.8z'},
  medaille:{p:'M8 1.8h3l1 4.4L13 1.8h3l-2.4 7a6.5 6.5 0 1 1-3.2 0z', d:'M12 11.4l1.2 2.4 2.6.3-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.3z'},
  stop: {p:'M6 6h12v12H6z'},
  check:{p:'M9.4 16.2 4.8 11.6 3.2 13.2l6.2 6.2L21 7.8l-1.6-1.6z'},
  gen:  {p:'M12 2 14.4 7l5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z'},
  berg: {p:'M1.5 20.5 8.5 8l3.2 5.4L15 7.5l7.5 13z'},
  heuvel:{p:'M1.5 19.5c2.5-6 6-9 9.5-9s6 2 7.5 5c1.2-.8 2.4-1.2 4-1v5z'},
  woest:{p:'M1.5 20c3-3.4 7-4.4 10.5-2.8 3.5-1.6 7.5-.6 10.5 2.8zM14.4 7.6a3.4 3.4 0 1 0 6.8 0 3.4 3.4 0 1 0-6.8 0zM3 15.6c2.4-2.6 5.2-3.2 7.6-2l-1 1c-2-.6-3.8 0-5.4 1.6z'},
  moeras:{p:'M2 15h8v1.8H2zM12 15h10v1.8H12zM5 19h9v1.8H5zM8 8.5l1.2-4h1l1.2 4zM14 10.5l1-3h.9l1 3z'},
  stad: {p:'M2.5 21V11h5V6.5h4V3h5v7h5v11z', d:'M4.5 13h1.6v1.6H4.5zM9 9h1.6v1.6H9zM13.4 5.6H15v1.6h-1.6zM18 12.6h1.6v1.6H18zM13.4 9.6H15v1.6h-1.6z'},
  rivier:{p:'M2 9c3-2.4 5-2.4 8 0s5 2.4 8 0l2-1.2v2.2c-3 2.4-5.4 2.4-8.4 0s-4.6-2.4-7.6 0L2 11.2zM2 14c3-2.4 5-2.4 8 0s5 2.4 8 0l2-1.2V15c-3 2.4-5.4 2.4-8.4 0s-4.6-2.4-7.6 0L2 16.2z'},
  info: {p:'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z', d:'M11 10h2v7h-2zM11 6.6h2v2h-2z'},
  tijd: {p:'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z', d:'M11 6h2v6.4l4 2.4-1 1.7-5-3z'},
  zwaard:{p:'M18.6 2.2h3.2v3.2L11 16.2l1.6 1.6-1.4 1.4-1.6-1.6-3 3-2.4-2.4 3-3-1.6-1.6 1.4-1.4 1.6 1.6z'},
  schild:{p:'M12 1.8 20.5 5v6.6c0 5-3.6 9-8.5 10.6-4.9-1.6-8.5-5.6-8.5-10.6V5z'},
  dood: {p:'M12 2.2c4.6 0 8 3.2 8 7.4 0 2.6-1.4 4.5-3.2 5.6V19h-2.2v-2h-1.6v2h-2v-2H9.4v2H7.2v-3.8C5.4 14.1 4 12.2 4 9.6c0-4.2 3.4-7.4 8-7.4z', d:'M7.4 9.6a2 2 0 1 0 4 0 2 2 0 1 0-4 0zM12.6 9.6a2 2 0 1 0 4 0 2 2 0 1 0-4 0z'},
  vlag: {p:'M5 2.5h1.8v19H5zM6.8 3.5c3-1 5 1 8 0s3.5-.4 4.5.2v8.6c-1-.6-2.4-.9-4.5-.2-3 1-5-1-8 0z'}
};

/* NAVO-stijl eenheidssymbolen: kader met teken — de taal van echte stafkaarten */
// het gekleurde fiche of het icoonvak is zelf het kader, zoals op HOI4-fiches
SIL.ster = {p: SIL.gen.p};
const NATO = {
  inf: {s:['M4.4 7.9 19.6 16.1', 'M19.6 7.9 4.4 16.1']},
  mot: {s:['M4.6 6.9 19.4 14.1', 'M19.4 6.9 4.6 14.1'], f:['M6.8 17.9a1.45 1.45 0 1 0 2.9 0 1.45 1.45 0 1 0-2.9 0z', 'M14.3 17.9a1.45 1.45 0 1 0 2.9 0 1.45 1.45 0 1 0-2.9 0z']},
  tank:{s:['M5 12a7 3.7 0 1 0 14 0 7 3.7 0 1 0-14 0']},
  art: {f:['M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 1 0 0-6.4z']},
  aa:  {s:['M4.8 16.2Q12 5 19.2 16.2']},
  mar: {s:['M12 9.6v6.2', 'M9.2 11.3h5.6', 'M7.6 13q4.4 4.6 8.8 0'], f:['M12 6.6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3z']},
  para:{s:['M5.4 13.6Q12 5.8 18.6 13.6', 'M5.4 13.6 12 17.2', 'M18.6 13.6 12 17.2']}
};
const NP = {};
function natoPath(t){ if(NP[t]) return NP[t]; const n2 = NATO[t]; return NP[t] = {s:(n2.s || []).map(d => new Path2D(d)), f:(n2.f || []).map(d => new Path2D(d))}; }
function drawNato(ctx, t, cx, cy, size, ink){
  const p = natoPath(t), k = size/24;
  ctx.save(); ctx.translate(cx - 12*k, cy - 12*k); ctx.scale(k, k);
  ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ink || '#fff';
  for(const q of p.s) ctx.stroke(q);
  ctx.fillStyle = ink || '#fff';
  for(const q of p.f) ctx.fill(q);
  ctx.restore();
}
const natoIc = (t, cls) => { const n2 = NATO[t]; return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (n2.s || []).map(d => '<path d="' + d + '"/>').join('') + (n2.f || []).map(d => '<path fill="currentColor" stroke="none" d="' + d + '"/>').join('') + '</svg>'; };
const SILP = {};
function silPath(k){ if(SILP[k]) return SILP[k]; const s = SIL[k]; return SILP[k] = {p:new Path2D(s.p), d:s.d ? new Path2D(s.d) : null, e:s.e ? new Path2D(s.e) : null}; }
// teken silhouet k gecentreerd op (cx, cy), 'size' px groot; details in de plaatkleur
function drawSil(ctx, k, cx, cy, size, plate, ink){
  if(NATO[k]){ drawNato(ctx, k, cx, cy, size, ink); return; }
  const s = silPath(k);
  ctx.save(); ctx.translate(cx - size/2, cy - size/2); ctx.scale(size/24, size/24);
  ctx.fillStyle = ink || '#fff'; ctx.fill(s.p);
  if(s.d){ ctx.fillStyle = plate; ctx.fill(s.d); }
  if(s.e){ ctx.fillStyle = ink || '#fff'; ctx.fill(s.e); }
  ctx.restore();
}
// hetzelfde silhouet als inline SVG voor de interface
const ic = (k, cls) => { if(NATO[k]) return natoIc(k, cls); const s = SIL[k]; if(!s) return ''; return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="' + s.p + '"/>' + (s.d ? '<path class="icd" d="' + s.d + '"/>' : '') + (s.e ? '<path fill="currentColor" d="' + s.e + '"/>' : '') + '</svg>'; };

/* ================= tekenen: bovenlaag (canvas) ================= */
let GROUPS = {}, AGROUPS = {}, HITS = [], FX = [];
const SEG = 26;
const circ = (cx, cy, r) => 'M' + (cx+r) + ' ' + cy + 'A' + r + ' ' + r + ' 0 1 1 ' + (cx-r) + ' ' + cy + 'A' + r + ' ' + r + ' 0 1 1 ' + (cx+r) + ' ' + cy + 'Z';
const rct = (x, y, w, h) => 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'Z';
const mk = o => ({f:(o.f||[]).map(d => new Path2D(d)), s:(o.s||[]).map(d => new Path2D(d)), w:(o.w||[]).map(d => new Path2D(d))});
const ICON = {
  inf:  mk({f:[circ(0,-3.6,1.9)], s:['M0 -1.4V2.3M0 2.3L-2.4 5.4M0 2.3L2.4 5.4M-2.8 0.1H2.8']}),
  mot:  mk({f:[rct(-6,-3,7.4,5.4), 'M1.9 -1.2H4.3L6.2 1.1V2.4H1.9Z'], w:[circ(-3.4,3.6,1.5), circ(3.6,3.6,1.5)]}),
  tank: mk({f:[rct(-5.8,0.2,11.6,3.8), rct(-3.2,-3,5.8,3)], s:['M2.2 -1.7L6.6 -2.8']}),
  art:  mk({s:[circ(-2.2,2.4,2.5), 'M-1.4 1.6L5.8 -4.6M-5.6 5.2H2.6']}),
  mar:  mk({s:[circ(0,-4.4,1.2), 'M0 -3.2V4.8M-2.8 -1.2H2.8M-5 1.2Q-4.4 5 0 5Q4.4 5 5 1.2']}),
  para: mk({s:['M-5.2 -1Q0 -7 5.2 -1M-5.2 -1L0 3.2L5.2 -1'], f:[circ(0,4,1.3)]}),
  aa:   mk({s:['M-5 5H5M-3.4 5L-0.6 -5M0.6 5L3.4 -5'], f:[rct(-2.4,2,4.8,2.4)]})
};
const PLANE = {
  fi:  mk({f:['M0 -6.5L1.3 -1.5L6.2 1.4V2.6L1.2 1.3L0.8 4.3L2.4 5.6V6.3L0 5.6L-2.4 6.3V5.6L-0.8 4.3L-1.2 1.3L-6.2 2.6V1.4L-1.3 -1.5Z']}),
  cas: mk({f:['M0 -6L1.1 -2.4H6.6V-0.6L1.1 0.4L0.8 4.2L2.6 5.2V6L0 5.4L-2.6 6V5.2L-0.8 4.2L-1.1 0.4L-6.6 -0.6V-2.4H-1.1Z', circ(-3.8,1.6,.9), circ(3.8,1.6,.9)]}),
  bo:  mk({f:['M0 -6.5L1.4 -2.4L7 0.2V1.8L1.3 0.8L1 4.2L3 5.4V6.3L0 5.6L-3 6.3V5.4L-1 4.2L-1.3 0.8L-7 1.8V0.2L-1.4 -2.4Z', rct(-4.6,-0.4,1.3,2.6), rct(3.3,-0.4,1.3,2.6)]})
};
function drawIcon(ctx, ic){
  ctx.fillStyle = '#fff'; for(const p of ic.f) ctx.fill(p);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; for(const p of ic.s) ctx.stroke(p);
  for(const p of ic.w){ ctx.fillStyle = '#1a1f24'; ctx.fill(p); ctx.lineWidth = .8; ctx.stroke(p); }
}
function drawStars(ctx, x, y, n, hot, u){
  const r = 3.7*u, gap = 7.8*u, w = n*gap + 3.4*u, h = 10.5*u;
  ctx.fillStyle = 'rgba(10,15,20,.8)'; rrect(ctx, x - w/2, y - h/2, w, h, h/2); ctx.fill();
  ctx.fillStyle = hot ? '#E8C054' : 'rgba(232,237,230,.78)';
  for(let i = 0; i < n; i++){
    const cx = x - (n - 1)*gap/2 + i*gap;
    ctx.beginPath();
    for(let k = 0; k < 10; k++){ const a = -Math.PI/2 + k*Math.PI/5, rr = k % 2 ? r*0.45 : r; ctx.lineTo(cx + rr*Math.cos(a), y + 0.4*u + rr*Math.sin(a)); }
    ctx.closePath(); ctx.fill();
  }
}
const PLATE = {};
const plateCol = c => PLATE[c] ||= shade(colorOf(c), -0.12);
function rrect(ctx, x, y, w, h, r){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
const hpCol = hp => hp > 60 ? '#73B06C' : hp > 30 ? '#E3A23C' : '#D4553F';
let tgtCache = {key:'', list:[]};
function targetSet(){
  if(!G || !UI.target || UI.target === 'blitz' || UI.target === 'mobil') return [];
  const key = UI.target + ':' + G.day + ':' + [...UI.sel].join(',');
  if(tgtCache.key !== key){
    if(UI.target === 'drop') buildIdx();
    tgtCache = {key, list: PIDS.filter(p => validTarget(G.player, UI.target, p))};
  }
  return tgtCache.list;
}
function drawHighlights(){ overDirty = true; }
function fx(p, kind){ FX.push({p, kind, t0:performance.now()}); overDirty = true; }

function renderOver(){
  overDirty = false;
  const ctx = octx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overC.width, overC.height);
  HITS = [];
  if(!DATA || !CW) return;
  const px = V.k;
  // --- markeringen in kaartruimte ---
  ctx.setTransform(Q2/V.k, 0, 0, Q2/V.k, (CW/2 - V.cx/V.k)*Q2, (CH/2 - V.cy/V.k)*Q2);
  ctx.lineJoin = 'round';
  if(HOVER && (!isTouch || UI.dragTo)){ ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(PATH[HOVER], 'evenodd'); }
  // afgesneden gebied (eigen en vijandelijk): oranje waas
  if(G && OOSP.length){
    ctx.fillStyle = 'rgba(240,150,46,.2)'; ctx.strokeStyle = 'rgba(240,150,46,.8)'; ctx.lineWidth = 1.2*px; ctx.setLineDash([4*px, 3*px]);
    for(const p of OOSP){ const c = G.ctrl[p]; if(c === G.player || atWar(G.player, c)){ ctx.fill(PATH[p], 'evenodd'); ctx.stroke(PATH[p]); } }
    ctx.setLineDash([]);
  }
  const tset = targetSet();
  if(tset.length){
    ctx.fillStyle = 'rgba(227,162,60,.22)'; ctx.strokeStyle = '#E3A23C'; ctx.lineWidth = 1.4*px;
    for(const p of tset){ ctx.fill(PATH[p], 'evenodd'); ctx.stroke(PATH[p]); }
  }
  const sel = !G && UI.pick ? CPROV[UI.pick] : (G && UI.info ? [UI.info] : []);
  if(sel.length){
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8*px;
    for(const p of sel){ ctx.fill(PATH[p], 'evenodd'); ctx.stroke(PATH[p]); }
  }
  // vredesconferentie: wat je eist licht goud op, de rest van je bezetting gaat terug
  if(G && UI.conf && cardOpen()){
    ctx.lineWidth = 1.6*px;
    for(const p of UI.conf.occ){ const on = UI.conf.sel.has(p); ctx.fillStyle = on ? 'rgba(227,162,60,.42)' : 'rgba(255,255,255,.07)'; ctx.strokeStyle = on ? '#E3A23C' : 'rgba(255,255,255,.4)'; ctx.fill(PATH[p], 'evenodd'); ctx.stroke(PATH[p]); }
  }
  // --- alles verder in schermruimte ---
  ctx.setTransform(Q2, 0, 0, Q2, 0, 0);
  const now = performance.now();
  const drawFx = () => {
    FX = FX.filter(f => now - f.t0 < 1200);
    for(const f of FX){
      if(!P[f.p]) continue;
      const a = (now - f.t0)/1200, [x, y] = toScreen(P[f.p].a[0], P[f.p].a[1]);
      const r = (0.15 + 1.55*a) * REM * 1.5;
      ctx.globalAlpha = 1 - a;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fillStyle = f.kind === 'para' ? 'rgba(255,255,255,.28)' : f.kind === 'bunker' ? 'rgba(150,190,210,.35)' : f.kind === 'spawn' || f.kind === 'cap' ? 'rgba(115,176,108,.3)' : f.kind === 'loss' ? 'rgba(212,85,63,.3)' : 'rgba(255,168,60,.5)';
      ctx.strokeStyle = f.kind === 'para' ? '#fff' : f.kind === 'bunker' ? '#BFE0F0' : f.kind === 'spawn' || f.kind === 'cap' ? '#B4E6AC' : f.kind === 'loss' ? '#E88070' : '#FFD08A';
      ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };
  if(!G){ drawFx(); return; }
  const me = G.player;
  const vis = c => c === me || atWar(me, c);
  const onScreen = (x, y, m) => x > -m && x < CW + m && y > -m && y < CH + m;
  // zeeroutes van wat geselecteerd is
  const locs = new Set();
  if(UI.info) locs.add(UI.info);
  for(const id of UI.sel){ const u = unitById(id); if(u) locs.add(u.loc); }
  if(locs.size){
    ctx.strokeStyle = '#E3A23C'; ctx.lineWidth = 1.8; ctx.setLineDash([2, 6]); ctx.lineCap = 'round'; ctx.beginPath();
    const seen = new Set();
    for(const l of locs) for(const i of (RTOUCH[l] || [])){
      if(seen.has(i)) continue; seen.add(i);
      const r = ROUTES[i], a = toScreen(r[2], r[3]), b = toScreen(r[4], r[5]);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  const u1 = REM / 16 * (V.k > 1.8 ? 0.92 : 1.05);   // schermpixels per fiche-eenheid, iets kleiner ver uitgezoomd
  // --- landgroepen ---
  const groups = {};
  for(const u of G.units){
    if(!vis(u.c)) continue;
    const a = P[u.loc].a;
    let key, x = a[0], y = a[1];
    if(u.att && u.air){ const b = P[u.att].a; key = u.loc + '^' + u.att; x = b[0]; y = b[1] - 10*u1*V.k; }
    else if(u.att){ const b = P[u.att].a; key = u.loc + '!' + u.att; x += (b[0]-a[0])*0.3; y += (b[1]-a[1])*0.3; }
    else if(u.path.length){ const b = P[u.path[0]].a; key = u.loc + '>' + u.path[0]; x += (b[0]-a[0])*u.prog; y += (b[1]-a[1])*u.prog; }
    else key = u.loc;
    key = u.c + ':' + key;
    const g = groups[key] ||= {key, c:u.c, loc:u.loc, n:0, ty:{}, hp:0, x:0, y:0, ids:[], sel:false, path:null, drop:u.air ? u.att : null};
    g.n++; g.hp += u.hp; g.x += x; g.y += y; g.ids.push(u.id);
    g.ty[u.t] = (g.ty[u.t]||0) + 1;
    if(SUP[u.loc] === 0) g.oos = (g.oos || 0) + 1;
    if(u.man) g.man = true;
    if(UI.sel.has(u.id)) g.sel = true;
    if(u.c === me && u.path.length && (!g.path || u.path.length > g.path.length)) g.path = u.path;
  }
  GROUPS = groups;
  // --- luchtgroepen ---
  const ag = {};
  for(const w of G.air){
    if(!vis(w.c)) continue;
    const foe = w.c !== me;
    if(foe && w.z === w.base) continue;
    const at = foe ? w.z : w.base;
    const key = w.c + ':' + at + ':' + w.t;
    const g = ag[key] ||= {key, c:w.c, loc:at, t:w.t, n:0, hp:0, ids:[], sel:false, zones:{}};
    g.n++; g.hp += w.hp; g.ids.push(w.id);
    if(UI.selAir.has(w.id)) g.sel = true;
    if(w.zone && w.zone !== w.base) g.zones[w.zone] = 1;
  }
  AGROUPS = ag;
  const ord = {fi:0, cas:1, bo:2};
  const alist = Object.values(ag).sort((a,b) => (a.c === me) - (b.c === me));
  for(const g of alist){
    const [x, y] = toScreen(P[g.loc].a[0], P[g.loc].a[1]), foe = g.c !== me;
    g.sx = x + (foe ? 0 : 20*u1); g.sy = y - (foe ? 22 : 26 + ord[g.t]*23)*u1;
  }
  // --- plaatsing zonder overlap (in schermpixels) ---
  const list = Object.values(groups).sort((a,b) => (a.sel - b.sel) || (a.c === me) - (b.c === me));
  // rooster: zoekt dezelfde (eerst geplaatste) overlapper als een lijst doorlopen, maar zonder alles met alles te vergelijken
  const GWc = 64, GHc = 25*u1, grid = new Map(); let maxW = 34, nPl = 0;
  const gk = (x, y) => x * 65536 + y;
  const place = o => { o._pi = nPl++; const k = gk(Math.floor(o.sx / GWc), Math.floor(o.sy / GHc)); let a = grid.get(k); if(!a) grid.set(k, a = []); a.push(o); if(o.w > maxW) maxW = o.w; };
  const overlap = g => {
    const rx = Math.ceil((maxW + g.w)/2*u1 / GWc), cx = Math.floor(g.sx / GWc), cy = Math.floor(g.sy / GHc);
    let hit = null;
    for(let i = cx - rx; i <= cx + rx; i++) for(let j = cy - 1; j <= cy + 1; j++){
      const a = grid.get(gk(i, j)); if(!a) continue;
      for(const o of a) if((!hit || o._pi < hit._pi) && Math.abs(o.sx - g.sx) < (o.w + g.w)/2*u1 && Math.abs(o.sy - g.sy) < 25*u1) hit = o;
    }
    return hit;
  };
  for(const g of alist) place({sx:g.sx + 6*u1, sy:g.sy, w:34});
  for(const g of list){
    g.types = UTYPES.filter(t => g.ty[t]);
    g.w = 4 + SEG * g.types.length;
    [g.sx, g.sy] = toScreen(g.x/g.n, g.y/g.n);
    g.px = g.x/g.n; g.py = g.y/g.n;
    if(!onScreen(g.sx, g.sy, 80)) continue;
    for(let k=0; k<6; k++){
      const hit = overlap(g);
      if(!hit) break;
      g.sy = hit.sy + 25*u1;
    }
    place(g);
  }
  // --- luchtzones ---
  const Rz = ZONE_KM / KM / V.k;
  const zoneCol = shade(colorOf(me), 0.4);
  const drawnZ = {};
  for(const g of alist){
    const A = toScreen(P[g.loc].a[0], P[g.loc].a[1]);
    if(g.c !== me){
      if(drawnZ['f' + g.loc]) continue; drawnZ['f' + g.loc] = 1;
      ctx.beginPath(); ctx.arc(A[0], A[1], Rz*0.8, 0, Math.PI*2); ctx.fillStyle = 'rgba(212,85,63,.07)'; ctx.fill();
      continue;
    }
    // missiezones: rustig doelmerkje; de volle cirkel alleen als het eskader geselecteerd is
    for(const z in g.zones){
      const B = toScreen(P[z].a[0], P[z].a[1]);
      ctx.strokeStyle = zoneCol; ctx.globalAlpha = g.sel ? .8 : .35; ctx.lineWidth = 1.4; ctx.setLineDash([2, 5]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
      if(drawnZ[z]) continue;
      drawnZ[z] = 1;
      if(g.sel){
        ctx.beginPath(); ctx.arc(B[0], B[1], Rz, 0, Math.PI*2);
        ctx.fillStyle = zoneCol; ctx.globalAlpha = .1; ctx.fill(); ctx.globalAlpha = 1;
        ctx.setLineDash([7, 5]); ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.globalAlpha = .9; drawSil(ctx, 'doel', B[0], B[1], 13*u1, '#0E151C', zoneCol); ctx.globalAlpha = 1;
    }
    if(g.sel){
      ctx.beginPath(); ctx.arc(A[0], A[1], AIR[g.t].range / KM / V.k, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // --- marsroutes: jouw bevelen vol en gestreept; die van de generaal gedimd, in één keer getekend ---
  const arrowCol = shade(colorOf(me), 0.5);
  const destSeen = {}, strongL = [];
  const dimP = new Path2D(), dimH = new Path2D(); let nDim = 0;
  const head = (pp, e, d, hs) => { const ang = Math.atan2(e[1]-d[1], e[0]-d[0]); pp.moveTo(e[0], e[1]); pp.lineTo(e[0] - hs*Math.cos(ang - .45), e[1] - hs*Math.sin(ang - .45)); pp.lineTo(e[0] - hs*Math.cos(ang + .45), e[1] - hs*Math.sin(ang + .45)); pp.closePath(); };
  for(const g of list){
    if(g.drop){
      const A = toScreen(P[g.loc].a[0], P[g.loc].a[1]);
      ctx.strokeStyle = '#fff'; ctx.globalAlpha = .9; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo((A[0]+g.sx)/2, Math.min(A[1], g.sy) - 40*u1, g.sx, g.sy); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    if(!g.path) continue;
    const pts = [[g.sx, g.sy]];
    let x0 = g.sx, x1 = g.sx, y0 = g.sy, y1 = g.sy;
    const n = Math.min(14, g.path.length);
    for(let k = 0; k < n; k++){ const q = g.path[k], p = toScreen(P[q].a[0], P[q].a[1]); pts.push(p); if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0]; if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1]; }
    if(x1 < -20 || x0 > CW + 20 || y1 < -20 || y0 > CH + 20) continue;   // buiten beeld
    if(g.sel || g.man){ strongL.push([g, pts]); continue; }
    dimP.moveTo(pts[0][0], pts[0][1]); for(let k = 1; k < pts.length; k++) dimP.lineTo(pts[k][0], pts[k][1]);
    head(dimH, pts[pts.length-1], pts[pts.length-2] || pts[0], 5.5);
    nDim++;
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if(nDim){
    ctx.strokeStyle = arrowCol; ctx.fillStyle = arrowCol; ctx.lineWidth = 1.5;
    ctx.globalAlpha = .3; ctx.stroke(dimP); ctx.globalAlpha = .5; ctx.fill(dimH); ctx.globalAlpha = 1;
  }
  for(const [g, pts] of strongL){
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for(let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = arrowCol; ctx.lineWidth = 2.6; ctx.setLineDash([9, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = arrowCol; ctx.beginPath(); head(ctx, pts[pts.length-1], pts[pts.length-2] || pts[0], 7); ctx.fill();
    const fin = g.path[g.path.length-1];
    if(!destSeen[fin]){
      destSeen[fin] = 1;
      const A = toScreen(P[fin].a[0], P[fin].a[1]);
      ctx.strokeStyle = arrowCol; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(A[0], A[1], 7*u1, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(A[0], A[1], 2.5*u1, 0, Math.PI*2); ctx.fill();
    }
  }
  // --- sterren: steden die tellen voor de overgave (vijand altijd, de rest als je inzoomt) ---
  if(G){
    const myWar = enemiesOf(me).length > 0;
    for(const p of STARP){
      const c = G.ctrl[p], war = c !== me && atWar(me, c);
      if(!war && !(c === me && myWar)) continue;
      const bb = P[p].b; if(bb && (bb[2] - bb[0]) / V.k < 26*u1 && (bb[3] - bb[1]) / V.k < 26*u1) continue;   // te klein in beeld: niet tekenen
      const A = toScreen(P[p].a[0], P[p].a[1]);
      if(!onScreen(A[0], A[1], 30)) continue;
      drawStars(ctx, A[0], A[1] + 17*u1, STAR[p], war, u1);
    }
  }
  // --- divisiefiches ---
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for(const g of list){
    if(!onScreen(g.sx, g.sy, 60)) continue;
    const hp = Math.max(0, Math.min(100, g.hp / g.n)), foe = g.c !== me, x0 = -g.w/2;
    ctx.save(); ctx.translate(g.sx, g.sy); ctx.scale(u1, u1);
    // fiche: plaat in landskleur, wit silhouet per troepsoort, aantal ernaast, sterktebalk eronder
    const col = plateCol(g.c);
    rrect(ctx, x0 - 0.5, -10, g.w + 1, 23.5, 5.5); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();   // goedkope schaduw
    rrect(ctx, x0, -11, g.w, 22, 5); ctx.fillStyle = col; ctx.fill();
    rrect(ctx, x0 + 1.5, -9.5, g.w - 3, 7, 3.5); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
    rrect(ctx, x0, -11, g.w, 22, 5);
    ctx.lineWidth = g.sel ? 2.4 : foe ? 1.8 : 1.1; ctx.strokeStyle = g.sel ? '#fff' : foe ? '#E0533D' : 'rgba(0,0,0,.7)'; ctx.stroke();
    if(g.oos){   // afgesneden van bevoorrading
      rrect(ctx, x0 - 3, -14, g.w + 6, 28, 7); ctx.setLineDash([3, 2.5]); ctx.strokeStyle = '#F0962E'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.font = '700 12.5px ' + FONT_UI; ctx.textAlign = 'left';
    g.types.forEach((t, i) => {
      const sx = x0 + 2 + i*SEG;
      if(i){ ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, -7); ctx.lineTo(sx, 7); ctx.stroke(); }
      drawSil(ctx, t, sx + 8.5, 0, 15, col);
      ctx.fillStyle = '#fff'; ctx.fillText(String(g.ty[t]), sx + 16.5, 1);
    });
    ctx.textAlign = 'center';
    if(hp < 97){
      rrect(ctx, x0 + 3, 12.5, g.w - 6, 3, 1.5); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
      rrect(ctx, x0 + 3, 12.5, (g.w - 6)*hp/100, 3, 1.5); ctx.fillStyle = hpCol(hp); ctx.fill();
    }
    ctx.restore();
    HITS.push({kind:'ctr', key:g.key, loc:g.loc, x0:g.sx + (x0 - 6)*u1, x1:g.sx + (x0 + g.w + 6)*u1, y0:g.sy - 16*u1, y1:g.sy + 18*u1});
  }
  // --- eskaders ---
  for(const g of alist){
    if(!onScreen(g.sx, g.sy, 60)) continue;
    const hp = Math.max(0, Math.min(100, g.hp / g.n)), foe = g.c !== me;
    ctx.save(); ctx.translate(g.sx, g.sy); ctx.scale(u1, u1);
    const col = plateCol(g.c);
    rrect(ctx, -11, -9, 34, 21.5, 10.5); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
    rrect(ctx, -10.5, -10, 33, 20, 10); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = g.sel ? 2.4 : foe ? 1.8 : 1.1; ctx.strokeStyle = g.sel ? '#fff' : foe ? '#E0533D' : 'rgba(0,0,0,.7)'; ctx.stroke();
    drawSil(ctx, g.t, 0, 0, 16, col);
    ctx.fillStyle = '#fff'; ctx.font = '700 12px ' + FONT_UI; ctx.textAlign = 'left'; ctx.fillText(String(g.n), 10, 1); ctx.textAlign = 'center';
    if(hp < 97){
      rrect(ctx, -6, 11.5, 24, 2.6, 1.3); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
      rrect(ctx, -6, 11.5, 24*hp/100, 2.6, 1.3); ctx.fillStyle = hpCol(hp); ctx.fill();
    }
    ctx.restore();
    HITS.push({kind:'air', key:g.key, loc:g.loc, x0:g.sx - 12*u1, x1:g.sx + 28*u1, y0:g.sy - 14*u1, y1:g.sy + 14*u1});
  }
  // --- sleepbevel ---
  if(UI.dragTo){
    const D = UI.dragTo, srcs = [];
    if(UI.selAir.size){ for(const g of alist) if(g.ids.some(id => UI.selAir.has(id))) srcs.push(g); }
    else for(const g of list) if(g.ids.some(id => UI.sel.has(id))) srcs.push(g);
    let tx = D.x, ty = D.y;
    if(D.p){ [tx, ty] = toScreen(P[D.p].a[0], P[D.p].a[1]); }
    ctx.lineCap = 'round'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.setLineDash([8, 5]);
    for(const g of srcs){ ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(tx, ty); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(tx, ty, 9*u1, 0, Math.PI*2); ctx.lineWidth = 2.4; ctx.stroke();
    if(D.p){
      let lab = P[D.p].n;
      const c = G.ctrl[D.p];
      if(c !== me && !atWar(me, c)) lab += ' · geen oorlog';
      else if(c !== me && !UI.selAir.size){
        lab += ' · ' + oddsTxt(selOdds(D.p));
      }
      ctx.font = '700 ' + (13*u1).toFixed(1) + 'px ' + FONT_UI; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const lw = ctx.measureText(lab).width, lx = Math.max(lw/2 + 8, Math.min(CW - lw/2 - 8, tx)), ly = Math.max(24*u1, ty - 13*u1);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(5,9,12,.85)'; ctx.strokeText(lab, lx, ly);
      ctx.fillStyle = '#fff'; ctx.fillText(lab, lx, ly);
      ctx.textBaseline = 'middle';
    }
  }
  // --- gevechten ---
  for(const b of G.battles){
    if(b.att !== me && b.def !== me) continue;
    const A = toScreen(P[b.from].a[0], P[b.from].a[1]), B = toScreen(P[b.t].a[0], P[b.t].a[1]);
    const x = b.air ? B[0] : (A[0]+B[0])/2, y = b.air ? B[1] + 12*u1 : (A[1]+B[1])/2;
    if(!onScreen(x, y, 30)) continue;
    const mine = Math.max(0, Math.min(1, b.att === me ? b.r : 1 - b.r));
    ctx.save(); ctx.translate(x, y); ctx.scale(u1, u1);
    const tt = performance.now()/1000;
    ctx.beginPath(); ctx.arc(0, 0, 10.5 + Math.sin(tt*5)*1.2, 0, Math.PI*2); ctx.strokeStyle = 'rgba(227,162,60,.45)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fillStyle = '#10171D'; ctx.fill(); ctx.strokeStyle = '#E3A23C'; ctx.lineWidth = 1.4; ctx.stroke();
    drawSil(ctx, 'oorlog', 0, -.5, 13, '#10171D');
    rrect(ctx, -12, 11, 24, 3, 1.5); ctx.fillStyle = '#D4553F'; ctx.fill();
    rrect(ctx, -12, 11, 24*mine, 3, 1.5); ctx.fillStyle = '#73B06C'; ctx.fill();
    ctx.restore();
  }
  drawFx();
}
