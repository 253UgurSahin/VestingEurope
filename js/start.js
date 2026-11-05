'use strict';
/* ================= laden, opslaan, wisselen ================= */
async function switchMap(name, force){
  if(MAPNAME === name && !force && DATA) return;
  UI.loading = true; UI.pick = null; stripSig = null; renderAll();
  try{
    await loadMap(name);
    UI.loading = false; UI.err = null;
    G = null; allFills(); fitAll(true);
  }catch(err){
    UI.loading = false; UI.err = String(err.message || err);
  }
  stripSig = null; renderAll();
}
let saveFailed = false;
function autosave(){
  if(!G || G.over) return;
  try{
    const cur = localStorage.getItem(SAVE_KEY);
    if(cur) localStorage.setItem(SAVE_KEY + '.bak', cur);   // vorige versie als reserve
    localStorage.setItem(SAVE_KEY, JSON.stringify({map:MAPNAME, G}));
    saveFailed = false;
  }catch(e){
    if(!saveFailed){ saveFailed = true; toast('Opslaan lukt niet (opslag vol of geblokkeerd in privémodus): je voortgang blijft alleen in dit venster', 'war', 'save'); }
  }
}
// is dit een bruikbaar opgeslagen spel voor de geladen kaart? Repareert kleine gebreken, weigert kapotte data
function validSave(s){
  if(!s || typeof s !== 'object' || !s.G || typeof s.G !== 'object' || s.G.v !== 5 || !MAPS[s.map]) return false;
  const g = s.G;
  if(!g.ctrl || !g.nations || !Array.isArray(g.units) || !CN[g.player]) return false;
  if(!PIDS.every(p => p in g.ctrl && CN[g.ctrl[p]])) return false;
  if(!CIDS.every(c => g.nations[c] && typeof g.nations[c] === 'object')) return false;
  if(!Number.isFinite(g.day) || g.day < 0) return false;
  g.units = g.units.filter(u => u && P[u.loc] && CN[u.c] && Number.isFinite(u.hp) && (u.tp in ITEMS || FIXT[u.tp] || !u.tp));
  g.air = Array.isArray(g.air) ? g.air.filter(w => w && P[w.base] && CN[w.c] && AIR[w.t]) : [];
  for(const u of g.units){ if(!(u.hp > 0 && u.hp <= 100)) u.hp = clamp(u.hp || 100, 1, 100); if(!Array.isArray(u.path)) u.path = []; if(!Number.isFinite(u.prog)) u.prog = 0; }
  g.opt = {help:optClean(g.opt && g.opt.help), ai:optClean(g.opt && g.opt.ai)}; g.assisted = g.opt.help > 0 || g.opt.ai < 0;
  { const al = {}; if(g.allies && typeof g.allies === 'object' && !Array.isArray(g.allies)) for(const c of Object.keys(g.allies)) if(c !== g.player && CN[c] && g.nations[c] && g.nations[c].alive && Number.isFinite(g.allies[c])) al[c] = g.allies[c]; g.allies = al; }
  { const cd = {}; if(g.allyCd && typeof g.allyCd === 'object' && !Array.isArray(g.allyCd)) for(const c of Object.keys(g.allyCd)) if(CN[c] && Number.isFinite(g.allyCd[c])) cd[c] = g.allyCd[c]; g.allyCd = cd; }
  { const jo = {}; if(g.joined && typeof g.joined === 'object' && !Array.isArray(g.joined)) for(const k of Object.keys(g.joined)){ const [x, y] = k.split('>'); if(CN[x] && CN[y] && g.allies[x] != null && Number.isFinite(g.joined[k])) jo[k] = g.joined[k]; } g.joined = jo; }
  g.fac ||= {}; g.dmg ||= {}; g.forts ||= {}; g.wars ||= {}; g.battles = []; g.frac = Number.isFinite(g.frac) ? g.frac : 0;
  for(const p of PIDS) if(!Number.isFinite(g.fac[p])) g.fac[p] = 0;
  for(const k of Object.keys(g.wars)){ const [a, b] = k.split('|'); if(!CN[a] || !CN[b] || a === b) delete g.wars[k]; }
  if(!Number.isFinite(g.nid)) g.nid = g.units.reduce((m, u) => Math.max(m, u.id || 0), 0) + 1;
  if(!Number.isFinite(g.speed) || g.speed < 1 || g.speed > 4) g.speed = 1;
  return true;
}
function autosaveIdle(){ if(window.requestIdleCallback) requestIdleCallback(() => autosave(), {timeout:2000}); else setTimeout(autosave, 0); }
async function loadSaved(s0){
  const s = s0 || readSave();
  if(!s || !s.G || s.G.v !== 5 || !MAPS[s.map]){ toast('Opgeslagen spel kon niet worden geladen', 'war'); return; }
  try{
    UI.loading = true; renderAll();
    await loadMap(s.map);
    UI.loading = false;
    if(!validSave(s)){ UI.loading = false; toast('Dit opgeslagen spel hoort bij een oude ' + MAPS[s.map].name.toLowerCase() + 'kaart of is beschadigd en kan niet worden geladen', 'war'); renderAll(); return; }
    const prevG = G;
    G = s.G; G.paused = true;
    // kaartverbindingen kunnen veranderd zijn: routes die niet meer bestaan worden geschrapt
    for(const u of G.units || []){
      let ok = true, x = u.loc;
      for(const nx of u.path || []){ if(!ADJ[x] || !ADJ[x].includes(nx)){ ok = false; break; } x = nx; }
      if(!ok){ u.path = []; u.prog = 0; }
      if(u.att && !(ADJ[u.loc] || []).includes(u.att) && !u.air) u.att = null;
    }
    try{ onGameLoaded(true); }
    catch(err){ G = prevG; onError(err, 'laden'); if(G) onGameLoaded(false); else { allFills(); fitAll(); renderAll(); } }
  }catch(err){ UI.loading = false; toast('Opgeslagen spel kon niet worden geladen', 'war'); renderAll(); }
}
/* een spel als bestand bewaren en weer laden (voor als de browser zijn gegevens wist, of op een ander apparaat) */
function exportGame(){
  if(!G) return;
  try{
    const name = 'vesting-europa-' + G.player + '-dag' + Math.floor(G.day) + '.json';
    const body = JSON.stringify({app:'vesting-europa', format:1, exported:new Date().toISOString(), map:MAPNAME, G});
    const url = URL.createObjectURL(new Blob([body], {type:'application/json'}));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Spel bewaard als bestand: ' + name, 'good');
  }catch(e){ toast('Bewaren als bestand lukt niet in deze browser', 'war'); }
}
async function importGameFile(file){
  if(!file) return;
  if(file.size > 5 * 1024 * 1024){ toast('Dit bestand is te groot voor een spel van Vesting Europa', 'war'); return; }
  let o;
  try{ o = JSON.parse(await file.text()); }catch(e){ toast('Dit bestand is geen geldig spelbestand (het is geen JSON)', 'war'); return; }
  if(!o || o.app !== 'vesting-europa' || !o.G || typeof o.G !== 'object' || !MAPS[o.map]){ toast('Dit bestand is geen spel van Vesting Europa', 'war'); return; }
  if(o.G.v !== 5){ toast('Dit spel komt van een andere versie van Vesting Europa en kan niet worden geladen', 'war'); return; }
  await loadSaved({map:o.map, G:o.G});
  if(G) autosave();   // meteen ook in deze browser bewaren
}
$('importFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; importGameFile(f); });
function clearToasts(){ $('toasts').innerHTML = ''; }
function toPick(){
  clearToasts();
  G = null; UI.pick = null; UI.sheet = null; UI.target = null; UI.info = null; UI.confirm = null; UI.winShown = false; clearSel();
  allFills(); fitAll(); stripSig = null; renderAll();
}
function onGameLoaded(focus){
  clearToasts(); warsChanged(); ownDirty = true; POWC = null; AIRBY = null;
  clearSel(); UI.info = null; UI.target = null; UI.sheet = null; UI.confirm = null; UI.winShown = false;
  KP = null;   // toetsenbord op de kaart begint weer bij de eigen hoofdstad
  RZ = ZONE_KM / KM; computeSupply(true); polInit();
  allFills(); stripSig = null; sheetSig = '';
  if(focus) fitCountry(G.player);
  renderAll();
  if(G.day === 0) toast('Welkom in ' + cname(G.player) + '. Begin met de eerste stappen onderaan', '');
}
addEventListener('visibilitychange', () => { if(document.hidden) autosave(); });
addEventListener('pagehide', () => autosave());

/* ================= hoofdlus ================= */
let lastT = performance.now(), lastOver = 0, lastUI = 0, lastPaint = 0, overCost = 0, FT = 16;
let ERRN = 0;
function onError(err, where){
  ERRN++;
  try{ console.error('[Vesting Europa] ' + where + ':', err); }catch(_){}
  if(ERRN <= 3){
    if(G && !G.over){ G.paused = true; try{ autosave(); }catch(_){} }
    toast('Er ging iets mis (' + where + '). Het spel is gepauzeerd en opgeslagen; speel verder of herlaad de pagina.', 'war', 'err');
  }
}
addEventListener('error', e => onError(e.error || e.message, 'fout'));
addEventListener('unhandledrejection', e => onError(e.reason, 'belofte'));
function frame(t){
  try{ frameBody(t); }catch(err){ onError(err, 'spellus'); }
  requestAnimationFrame(frame);
}
function frameBody(t){
  const dt = Math.min(0.25, (t - lastT)/1000); FT = FT*0.9 + Math.min(250, t - lastT)*0.1; lastT = t;
  if(G && !G.paused && !G.over){ advance(dt * DPS[G.speed]); overDirty = true; }
  if(DATA && CW){
    const tweening = tweenStep(t);
    const tr = baseTransform();
    const interacting = ptrs.size > 0 || t - lastWheel < 180 || tweening;
    if(!CV) renderBase();
    else if(tr && !tr.still){
      const out = Math.abs(tr.tx) > OS*CW*0.85 || Math.abs(tr.ty) > OS*CH*0.85 || tr.f < 0.7 || tr.f > 1.25;
      if(!interacting) renderBase();
      else if(out && t - lastBase > 120) renderBase(true);
    }
    else if(baseDirty && !interacting) renderBase();
    else if(mapDirty && !interacting && t - lastBase > BASE_MS) renderBase();
    else if(DIRTYP.size && !interacting && tr && tr.still && t - lastPaint > (CV.k > 1.2 ? 500 : 220)){ if(DIRTYP.size > 60) renderBase(); else paintProvinces(); lastPaint = t; }
    else if(labelsDirty && !interacting && t - lastBase > ((G && !G.paused) ? 60000 : 1500)) renderBase();
    if(FX.length) overDirty = true;
    const overMs = (G && !G.paused) ? (isTouch ? 50 : 33) * (overCost > 8 || FT > 45 ? (FT > 70 ? 2.5 : 1.6) : 1) : 0;
    if((overDirty || viewDirty) && t - lastOver >= overMs){ const t1 = performance.now(); renderOver(); overCost = overCost*0.8 + (performance.now() - t1)*0.2; lastOver = t; viewDirty = false; }
  }
  if(t - lastUI > 300){ renderBar(); renderStrip(); renderSheet(); renderEnd(); renderCard(); lastUI = t; }
}
function measure(){ REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
new ResizeObserver(() => { measure(); sizeCanvases(); if(DATA){ clampView(); applyView(); } }).observe(stage);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { baseDirty = true; overDirty = true; });

// offline spelen en installeren: alleen waar service workers bestaan (https of localhost); in een claude.ai-pagina bestaan ze niet
if('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });

window.claude?.hot?.snapshot(() => ({G, V:{...V}, map:MAPNAME, diff:UI.diff}));
async function boot(data){
  measure(); sizeCanvases();
  requestAnimationFrame(t => { lastT = t; frame(t); });
  const saved = data && data.G && data.G.v === 5 && data.map && MAPS[data.map] ? data : null;
  if(data && typeof data.diff === 'number') UI.diff = data.diff;
  UI.loading = true; renderAll();
  try{
    await loadMap(saved ? saved.map : 'europe');
    UI.loading = false;
    if(saved && validSave(saved)){
      G = saved.G; onGameLoaded(false);
      if(saved.V){ Object.assign(V, saved.V); clampView(); applyView(); }
    } else { allFills(); fitAll(true); renderAll(); }
  }catch(err){ UI.loading = false; UI.err = String(err.message || err); renderAll(); }
}
if(window.claude?.hot?.ready) window.claude.hot.ready(boot);
else boot(window.claude?.hot?.data ?? {});
window.__VE = { V, get errs(){ return ERRN; }, orderMove: p => orderMove(p), view: () => { clampView(); applyView(); }, dbgHit: (x, y) => [hitAt(x, y), ownStackAt(x, y)], get groups(){ return GROUPS; }, toScreen: (x, y) => toScreen(x, y), sup: p => SUP[p], cap: c => armyCap(c), get hd(){ return !!HD; }, get cvl(){ return CVL; }, fitAll: () => fitAll(), renderBase: () => { const t = performance.now(); renderBase(); return performance.now() - t; }, get G(){ return G; }, newGame: (c, d, o) => { newGame(c, d ?? 1, o); onGameLoaded(true); }, get D(){ return D(); }, advance: d => advance(d), UI, declare, switchMap, doDrop, orderAir, unitById, meterOf, settle, resolveCard, dealInfo, playerDeal, occBy, starSum, cardOpen, get STAR(){ return STAR; },
  get MAP(){ return {P, CIDS, PIDS, CN, KM, provinces:P, adj:ADJ}; } };
