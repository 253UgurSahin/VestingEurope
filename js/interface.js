'use strict';
/* ================= geluid: synthetisch (WebAudio), geen bestanden nodig ================= */
// instellingen (ook voor latere opties) in één opslagsleutel
const SETTINGS_KEY = 've_settings';
const SET = Object.assign({sound:true, music:true, vol:0.6, cb:false}, (() => { try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }catch(e){ return {}; } })());
function saveSettings(){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(SET)); }catch(e){} }
let AC = null, MASTER = null, MUSIC = null, musicTimer = 0;
const SFX_LAST = {};
const SFX_MIN = {tap:60, cap:140, capbig:300, lossmin:400, loss:600, build:300, battle:3000, order:120, attack:200, card:500, war:600, win:2000, lose:2000, ach:800};
function audioInit(){
  if(AC) return true;
  const Ctx = window.AudioContext || window.webkitAudioContext; if(!Ctx) return false;
  try{ AC = new Ctx(); }catch(e){ return false; }
  MASTER = AC.createGain(); MASTER.gain.value = SET.vol; MASTER.connect(AC.destination);
  if(SET.music) musicStart();
  return true;
}
// de browser staat geluid pas toe na een aanraking: dan pas starten
addEventListener('pointerdown', () => { if(audioInit() && AC.state === 'suspended') AC.resume(); }, {passive:true});
addEventListener('keydown', () => { if(audioInit() && AC.state === 'suspended') AC.resume(); });
addEventListener('visibilitychange', () => { if(!AC) return; if(document.hidden) AC.suspend(); else if(SET.sound || SET.music) AC.resume(); });
function tone(f, t0, dur, type, g, f1){
  const o = AC.createOscillator(), e = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
  if(f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g, t0 + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(e); e.connect(MASTER); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, g, cut){
  const n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for(let i = 0; i < n; i++) d[i] = (Math.random()*2 - 1) * (1 - i/n);
  const s = AC.createBufferSource(), e = AC.createGain(), fl = AC.createBiquadFilter();
  s.buffer = b; fl.type = 'lowpass'; fl.frequency.value = cut || 900;
  e.gain.setValueAtTime(g, t0); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(e); e.connect(MASTER); s.start(t0); s.stop(t0 + dur + 0.02);
}
function sfx(k){
  if(!SET.sound || !AC || AC.state !== 'running') return;
  const now = performance.now(); if(now - (SFX_LAST[k] || -1e9) < (SFX_MIN[k] || 100)) return; SFX_LAST[k] = now;
  const t = AC.currentTime + 0.01;
  switch(k){
    case 'tap': tone(900, t, 0.04, 'triangle', 0.08); break;
    case 'order': tone(660, t, 0.06, 'triangle', 0.1); tone(880, t + 0.06, 0.07, 'triangle', 0.1); break;
    case 'attack': tone(660, t, 0.06, 'triangle', 0.1); tone(880, t + 0.06, 0.07, 'triangle', 0.1); noise(t + 0.02, 0.18, 0.12, 500); break;
    case 'build': noise(t, 0.05, 0.08, 2500); tone(740, t + 0.02, 0.09, 'sine', 0.1); break;
    case 'cap': tone(523, t, 0.08, 'triangle', 0.11); tone(659, t + 0.07, 0.11, 'triangle', 0.11); break;
    case 'capbig': tone(523, t, 0.08, 'triangle', 0.12); tone(659, t + 0.07, 0.08, 'triangle', 0.12); tone(784, t + 0.14, 0.18, 'triangle', 0.13); tone(1568, t + 0.14, 0.3, 'sine', 0.04); break;
    case 'lossmin': tone(440, t, 0.08, 'triangle', 0.09); tone(330, t + 0.08, 0.14, 'triangle', 0.09); break;
    case 'loss': tone(440, t, 0.09, 'sawtooth', 0.07); tone(294, t + 0.09, 0.22, 'sawtooth', 0.07); noise(t, 0.3, 0.16, 300); break;
    case 'war': tone(110, t, 0.35, 'sine', 0.3, 55); noise(t, 0.25, 0.22, 700); tone(165, t + 0.3, 0.3, 'sine', 0.18, 82); break;
    case 'battle': noise(t, 0.22, 0.09, 600); tone(98, t, 0.2, 'sine', 0.12, 60); break;
    case 'card': tone(880, t, 0.35, 'sine', 0.1); tone(1320, t + 0.02, 0.5, 'sine', 0.06); tone(1760, t + 0.04, 0.6, 'sine', 0.03); break;
    case 'ach': tone(784, t, 0.1, 'triangle', 0.1); tone(988, t + 0.1, 0.1, 'triangle', 0.1); tone(1175, t + 0.2, 0.3, 'triangle', 0.12); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i*0.13, i === 3 ? 0.7 : 0.14, 'triangle', 0.13)); [262, 330, 392].forEach(f => tone(f, t + 0.39, 0.9, 'sine', 0.06)); break;
    case 'lose': tone(392, t, 0.25, 'sawtooth', 0.07); tone(311, t + 0.25, 0.25, 'sawtooth', 0.07); tone(233, t + 0.5, 0.7, 'sawtooth', 0.08); noise(t, 0.5, 0.1, 250); break;
  }
}
/* ---- muziek: een rustige, langzaam verschuivende orgeldrone (twee stemmen, laagdoorlaat, zachte zwelling) ---- */
const CHORDS = [[55, 82.41, 110], [49, 73.42, 98], [43.65, 65.41, 87.31], [41.2, 61.74, 82.41]];
function musicStart(){
  if(MUSIC || !AC) return;
  const g = AC.createGain(), fl = AC.createBiquadFilter(), lfo = AC.createOscillator(), lg = AC.createGain();
  g.gain.value = 0; fl.type = 'lowpass'; fl.frequency.value = 260; fl.Q.value = 0.7;
  lfo.frequency.value = 0.07; lg.gain.value = 60; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
  const voices = CHORDS[0].map((f, i) => { const o = AC.createOscillator(), e = AC.createGain(); o.type = i === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = i ? (i === 1 ? -6 : 7) : 0; e.gain.value = i === 0 ? 0.5 : 0.22; o.connect(e); e.connect(fl); o.start(); return o; });
  fl.connect(g); g.connect(MASTER);
  g.gain.setTargetAtTime(0.09, AC.currentTime, 4);
  MUSIC = {g, voices, i:0};
  const next = () => { if(!MUSIC) return; MUSIC.i = (MUSIC.i + 1) % CHORDS.length; const ch = CHORDS[MUSIC.i]; MUSIC.voices.forEach((o, k) => o.frequency.setTargetAtTime(ch[k], AC.currentTime, 2.5)); musicTimer = setTimeout(next, 18000 + Math.random()*8000); };
  musicTimer = setTimeout(next, 18000);
}
function musicStop(){ if(!MUSIC) return; clearTimeout(musicTimer); const m = MUSIC; MUSIC = null; m.g.gain.setTargetAtTime(0, AC.currentTime, 0.8); setTimeout(() => { try{ m.voices.forEach(o => o.stop()); }catch(e){} }, 3000); }
function setSound(on){ SET.sound = on; saveSettings(); }
function setMusic(on){ SET.music = on; saveSettings(); if(!AC) return; if(on) musicStart(); else musicStop(); }
function setVol(v){ SET.vol = clamp(v, 0, 1); saveSettings(); if(MASTER) MASTER.gain.setTargetAtTime(SET.vol, AC.currentTime, 0.05); }
/* ================= meldingen ================= */
const toastKeys = {};
// korte fysieke feedback: schudden bij verlies, flits bij oorlog of overwinning
function shake(){ const s = $('stage'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
function flash(col){ const f = $('flash'); f.style.setProperty('--fc', col || 'rgba(212,85,63,.55)'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
function toast(msg, kind, key){
  const host = $('toasts');
  if(key && toastKeys[key] && toastKeys[key].isConnected){
    toastKeys[key].lastChild.textContent = msg; toastKeys[key].className = 'toast glass' + (kind ? ' ' + kind : ''); clearTimeout(toastKeys[key]._t);
    toastKeys[key]._t = setTimeout(() => fade(toastKeys[key]), 3200);
    return;
  }
  const el = document.createElement('div');
  el.className = 'toast glass' + (kind ? ' ' + kind : '');
  const TK = {cap:'vlag', lost:'vlag', kia:'dood', airloss:'dood', odds:'zwaard', coal:'agr', sel:'leger', ls:'schild', pts:'ster'};
  const icn = TK[key] || (key && key.startsWith('just') ? 'agr' : key && key.startsWith('ls') ? 'schild' : key && key.startsWith('surr') ? 'vlag' : kind === 'war' ? 'oorlog' : kind === 'good' ? 'check' : 'info');
  el.innerHTML = ic(icn) + '<span></span>'; el.lastChild.textContent = msg;
  host.appendChild(el);
  while(host.children.length > 2) host.firstChild.remove();
  el._t = setTimeout(() => fade(el), 3600);
  if(key) toastKeys[key] = el;
}
function fade(el){ if(!el) return; el.classList.add('out'); setTimeout(() => el.remove(), 420); }

/* ================= balk ================= */
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.6" height="14" rx="1"/><rect x="13.9" y="5" width="3.6" height="14" rx="1"/></svg>';
function renderBar(){
  const pb = $('playBtn');
  const running = G && !G.paused && !G.over;
  pb.innerHTML = running ? ICON_PAUSE : ICON_PLAY;
  pb.classList.toggle('pulse', !!(G && G.paused && !G.over));
  pb.disabled = !G || !!G.over;
  $('date').textContent = G ? fmtDay(G.day) : (MAPNAME ? MAPS[MAPNAME].name : 'Laden…');
  const lit = G ? G.speed : 0;
  [...$('speedBtn').querySelectorAll('i')].forEach((i,k) => i.classList.toggle('lit', k < lit));
  $('speedBtn').disabled = !G;
  $('myDot').style.background = G ? colorOf(G.player) : '#8E9CA5';
  for(const b of document.querySelectorAll('[data-sheet]')){ b.classList.toggle('on', UI.sheet === b.dataset.sheet); b.disabled = !G || !!G.over; }
  const wb = $('warBtn');
  const ens = G && !G.over ? enemiesOf(G.player) : [];
  const ms = ens.map(c => pct(meterOf(c)));
  const wsig = ens.map((c, i) => c + ':' + ms[i]).join(',');
  if(wb.dataset.sig !== wsig){
    wb.dataset.sig = wsig;
    wb.hidden = !ens.length;
    wb.title = ens.length ? 'In oorlog met ' + ens.map((c, i) => cname(c) + ' (geeft op ' + ms[i] + '%)').join(', ') : '';
    wb.setAttribute('aria-label', wb.title || 'Oorlogen');
    wb.innerHTML = ic('oorlog')
      + ens.slice(0, 4).map((c, i) => '<span class="mring" style="--m:' + ms[i] + '"><span class="cdot" style="background:' + colorOf(c) + '"></span></span>').join('')
      + (ens.length > 4 ? '<span class="more">+' + (ens.length - 4) + '</span>' : '');
  }
  renderQueue();
  renderStatus();
}
$('playBtn').addEventListener('click', togglePause);
$('speedBtn').addEventListener('click', () => { if(!G) return; G.speed = G.speed % 4 + 1; renderBar(); });
$('warBtn').addEventListener('click', () => { if(!G) return; UI.sheet = UI.sheet === 'info' ? null : 'info'; sheetSig = ''; renderAll(); });
for(const b of document.querySelectorAll('[data-sheet]')){
  b.addEventListener('click', () => {
    if(!G) return;
    UI.sheet = UI.sheet === b.dataset.sheet ? null : b.dataset.sheet;
    UI.target = null; sheetSig = ''; renderAll();
  });
}


const SI = { pp:ic('fab'), cp:ic('bevel'), dv:ic('leger'), air:ic('fi'), ws:ic('steun'), ae:ic('agr') };
let statusSig = '';
function renderStatus(){
  const el = $('status');
  if(!G || G.over){ if(!el.hidden){ el.hidden = true; statusSig = ''; } return; }
  const n = nat(G.player), me = G.player;
  const divs = UCNT[me] != null ? UCNT[me] : G.units.filter(u => u.c === me).length;
  const wings = ACNT[me] != null ? ACNT[me] : G.air.filter(w => w.c === me).length;
  const cap = armyCap(me), full = divs >= cap, aeM = maxAE(), aeHot = hotCount(COAL_THR()*0.8) >= 2, mM = meterOf(me);
  const h = '<span class="cdot" style="background:' + colorOf(me) + '"></span><span class="nm">' + esc(cname(me)) + '</span>'
    + '<span class="st" title="Productie per dag: hiermee bouw je alles. Komt uit je fabrieken.">' + SI.pp + NF.format(n.ppd) + '<small>per dag</small></span>'
    + '<span class="st' + (full ? ' low' : '') + '" title="Divisies / legerlimiet. De limiet groeit met je bevolking en fabrieken, ook veroverde.">' + SI.dv + divs + '/' + cap + '<small>leger</small></span>'
    + '<span class="st' + (n.ws < 25 ? ' low' : '') + '" title="Oorlogssteun: bepaalt je legerlimiet. Stijgt als je wordt aangevallen, daalt bij aanvalsoorlogen, verlies en bombardementen. Lage steun: je geeft sneller op.">' + SI.ws + Math.round(n.ws) + '%<small>steun</small></span>'
    + (mM >= 0.4 ? '<span class="st low" title="Overgavemeter: bij 100% kun je capituleren of doorvechten">' + ic('vlag') + pct(mM) + '%<small>overgave</small></span>' : '')
    + (aeM.m >= 1 ? '<span class="st' + (aeHot ? ' low' : '') + '" title="Agressie: hoe bang andere landen voor je zijn. Bij ' + COAL_THR() + '+ bij 3 landen tegelijk volgt een coalitie.">' + SI.ae + Math.round(aeM.m) + '/' + COAL_THR() + '<small>agressie</small></span>' : '')
    + '<span class="st" title="Bevelpunten: groeien vanzelf, voor speciale acties">' + SI.cp + Math.floor(n.cp) + '<small>bevel</small></span>';
  el.hidden = false;
  if(h !== statusSig){ statusSig = h; el.innerHTML = h; }
}
$('status').addEventListener('click', () => { if(!G) return; UI.sheet = UI.sheet === 'info' ? null : 'info'; sheetSig = ''; renderAll(); });

/* ================= wachtrij ================= */
const SVGI = (inner, fill) => '<svg viewBox="0 0 24 24" ' + (fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') + '>' + inner + '</svg>';
const QICON = {
  inf:  SVGI('<circle cx="12" cy="5" r="2.6"/><path d="M12 8.5c-2 0-3.2 1.2-3.2 3.2V15h2v6h2.4v-6h2v-3.3c0-2-1.2-3.2-3.2-3.2z"/>', 1),
  mot:  SVGI('<rect x="2" y="7" width="12" height="9" rx="1"/><path d="M14 10h4l3 3.5V16h-7z"/><circle cx="6.5" cy="17.5" r="2.2" fill="#10171D" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="17.5" r="2.2" fill="#10171D" stroke="currentColor" stroke-width="1.6"/>', 1),
  tank: SVGI('<rect x="2.5" y="13" width="19" height="6" rx="3"/><rect x="7" y="8.5" width="9" height="4.5" rx="1.2"/><path d="M15.5 10h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', 1),
  art:  SVGI('<circle cx="8" cy="15" r="4"/><path d="M9.5 13.5L21 4M3 20.5h12"/>'),
  mar:  SVGI('<circle cx="12" cy="4.5" r="1.8"/><path d="M12 6.3V21M8 10h8M4 14c0 4 4 7 8 7s8-3 8-7"/>'),
  para: SVGI('<path d="M3 11a9 9 0 0 1 18 0M3 11l9 7 9-7M12 18v3"/>'),
  aa:   SVGI('<path d="M3 20h18M7 20l3-15M14 20l3-15"/><rect x="8" y="14" width="8" height="3" rx="1"/>'),
  fi:   SVGI('<path d="M12 2l1.6 7 7.4 4v2l-7.4-2-.6 5 2.5 2v1.5L12 20.5 8.5 21.5V20l2.5-2-.6-5L3 15v-2l7.4-4z"/>', 1),
  cas:  SVGI('<path d="M12 2.5l1.3 4.5H21v2.5l-7.7 1.5-.5 6 2.7 2v1.5L12 19.8l-3.5 1v-1.5l2.7-2-.5-6L3 9.5V7h7.7z"/><circle cx="6.5" cy="13" r="1.4"/><circle cx="17.5" cy="13" r="1.4"/>', 1),
  bo:   SVGI('<path d="M12 2.5l1.3 6 8.2 3.5v2.5l-8.2-1.5-.5 5 2.7 2v1.6L12 20.6l-3.5 1v-1.6l2.7-2-.5-5-8.2 1.5V12l8.2-3.5z"/><circle cx="7" cy="17.5" r="1.4"/><circle cx="17" cy="17.5" r="1.4"/>', 1),
  rocket:SVGI('<path d="M12 2c2.6 2.2 3.6 5.4 3.6 9v6h-7.2v-6c0-3.6 1-6.8 3.6-9z"/><path d="M8.4 13l-3 3.5V19l3-1.5zM15.6 13l3 3.5V19l-3-1.5zM10.5 18h3l-1.5 4z"/>', 1),
  fab:  SVGI('<path d="M3 20V11l5 3v-3l5 3V8l3-4h3v16z"/><path d="M3 20h18"/>'),
  tech: SVGI('<path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4A1.5 1.5 0 0 0 19 19l-5-10V3"/><path d="M7.5 15h9"/>')
};
const qIcon = k => ic(ITEMS[k].kind === 'tech' ? 'tech' : ITEMS[k].kind === 'unit' ? domOfKey(k) : k);
let qArm = -1, qArmT = 0, qSig = '';
function renderQueue(){
  const host = $('queue');
  if(!G || G.over){ if(qSig !== ''){ host.innerHTML = ''; qSig = ''; } return; }
  const n = nat(G.player);
  if(qArm >= 0 && performance.now() - qArmT > 2500) qArm = -1;
  let acc = 0, h = '';
  n.q.forEach((q, i) => {
    const it = ITEMS[q.k], cost = itemCost(G.player, q.k);
    acc += cost - q.p;
    const days = Math.ceil(acc / Math.max(0.1, n.ppd));
    const nm = it.kind === 'tech' ? it.name + ' ' + ROMAN[n.tech[it.tech] + 1] : it.name;
    h += '<button class="qb glass' + (q.wait ? ' wait' : '') + (qArm === i ? ' arm' : '') + '" data-i="' + i + '" title="' + nm + ' · ' + (q.wait === 'air' ? 'luchtmachtlimiet bereikt: meer fabrieken nodig' : q.wait === 'slot' ? 'geen bouwplek vrij: verover of integreer land' : q.wait ? 'legerlimiet bereikt: meer mankracht nodig (verover en integreer land) of Mobilisatie' : '~' + days + ' d') + (q.at ? ' · ' + P[q.at].n : '') + ' · tik 2× om te annuleren" aria-label="' + nm + '">'
      + '<span class="fill" style="height:' + Math.round(100*q.p/cost) + '%"></span>' + qIcon(q.k)
      + '<span class="d">' + (q.wait ? '!' : days) + '</span></button>';
  });
  if(h === qSig) return;
  qSig = h; host.innerHTML = h;
}
$('queue').addEventListener('pointerup', e => {
  const b = e.target.closest('.qb'); if(!b || !G) return;
  const i = +b.dataset.i;
  if(qArm === i){ nat(G.player).q.splice(i, 1); qArm = -1; }
  else { qArm = i; qArmT = performance.now(); }
  qSig = null; renderQueue(); sheetSig = '';
});

/* ================= contextstrook ================= */
const INTRO = [
  ['Fabrieken bouwen alles', 'Meer fabrieken = sneller bouwen, maar elke provincie heeft beperkte <b>bouwplekken</b>. Nieuw land = nieuwe plekken en meer mankracht.', ['fab','tijd','inf']],
  ['Bevel geven', 'Tik een stapel en sleep naar een doel. Je ziet meteen je kans.', ['leger','zwaard','berg']],
  ['Oorlog met beleid', '<b>Rechtvaardig</b> een oorlog voor halve agressie. Neem steden met <b>sterren</b> in tot de vijand opgeeft.', ['vrede','ster','vlag']],
  ['Haal je doelen', 'Doelen en score staan in <b>Overzicht</b>. Speel zo lang je wilt.', ['doel','medaille','vlag']]
];
let stripSig = null, stripPress = false;
/* ---- eerste stappen: spelen in plaats van uitleggen. Vier dingen die je doet, met een vinkje zodra het gelukt is ---- */
const FS = [
  {k:'prod', t:'Bouw iets', s:'Open Productie en tik een tegel', ic:'fab', done: () => nat(G.player).q.length > 0},
  {k:'order', t:'Geef een bevel', s:'Tik je stapel, dan een provincie', ic:'leger', done: () => G.units.some(u => u.c === G.player && (u.man || u.path.length))},
  {k:'war', t:'Kies een doel', s:'Tik een buurland: Rechtvaardig', ic:'vrede', done: () => !!G.just || Object.keys(G.wg || {}).some(x => G.wg[x] >= G.day) || enemiesOf(G.player).length > 0},
  {k:'gen', t:'Zet de generaal aan', s:'Hij regelt de rest', ic:'gen', done: () => !!nat(G.player).auto}
];
const fsDone = () => FS.every(f => f.done());
const fsOpen = () => G && !G.over && !UI.winShown && !UI.target && !UI.selAir.size && !UI.sel.size && !UI.info && !cardOpen() && !G.fsHide && G.day < 365 && !fsDone();
function fsH(){
  const n = FS.filter(f => f.done()).length;
  return '<div class="fsrow"><span class="fst"><b>Eerste stappen</b><small>' + n + '/' + FS.length + '</small></span>'
    + FS.map(f => '<button class="fsb' + (f.done() ? ' done' : '') + '" data-act="fs:' + f.k + '" title="' + f.s + '">' + ic(f.done() ? 'check' : f.ic) + '<span>' + f.t + '<small>' + f.s + '</small></span></button>').join('')
    + '<button class="btn sm ghost" data-act="fs:hide" aria-label="Verbergen">×</button></div>';
}
function fsTick(){   // beloning als alles gelukt is (één keer)
  if(!G || G.fsRew || !fsDone()) return;
  G.fsRew = 1; nat(G.player).cp = Math.min(100, nat(G.player).cp + 15);
  toast('Eerste stappen gezet: +15 bevelpunten. Verder gaat het vanzelf: de generaal regelt het leger, jij kiest de oorlogen', 'good', 'fs');
}
function readSave(){
  for(const k of [SAVE_KEY, SAVE_KEY + '.bak']){ try{ const s = localStorage.getItem(k); if(s){ const o = JSON.parse(s); if(o && o.G && o.map) return o; } }catch(e){} }
  return null;
}
function renderStrip(){
  const el = $('strip');
  let h = '';
  if(UI.err){
    h = '<div class="txt"><b>Kaart laden mislukt</b><span class="mut" title="' + esc(UI.err) + '">Controleer je internetverbinding en probeer het opnieuw.</span></div><div class="acts"><button class="btn" data-act="retry">Opnieuw</button></div>';
  } else if(UI.loading || !DATA){
    h = '<div class="txt"><b>Kaart laden…</b></div>';
  } else if(!G){
    const save = readSave();
    const seg = '<div class="segrow">'
      + Object.keys(MAPS).map(m => '<button class="btn sm' + (MAPNAME === m ? ' pri' : '') + '" data-map="' + m + '">' + MAPS[m].name + '</button>').join('')
      + '<button class="btn sm" data-act="diff" title="Moeilijkheid">' + DIFF[UI.diff].name + '</button>'
      + (UI.pick && !UI.dailyKey ? '<button class="btn sm" data-act="opt:help" title="Jouw voordeel: productie, legerlimiet en gevechtskracht boven op het niveau. Geen is zonder extra; bij groot telt je score niet voor records.">Jouw voordeel: ' + OPT_HELP[UI.opt.help] + '</button><button class="btn sm" data-act="opt:ai" title="Sterkte van de computerlanden: 20% minder of 25% meer productie. Bij zwakker telt je score niet voor records.">AI: ' + OPT_AI[UI.opt.ai] + '</button>' : '')
      + '</div>';
    if(UI.pick){
      const c = UI.pick, cc = CN[c];
      const divs = Math.max(1, Math.round(popE(c)/9 + cc.f*0.25)) + Math.floor(cc.f/5) + Math.floor(cc.f/6) + Math.floor(cc.f/7);
      const best = bestOf(MAPNAME, c);
      h = '<div class="sel"><span class="sb"><span class="cdot big" style="background:' + colorOf(c) + '"></span><b style="font:700 1.25rem var(--f-ui)">' + esc(cname(c)) + '</b></span>'
        + '<span class="chips"><span class="chip2" title="Provincies">' + ic('prov') + CPROV[c].length + '</span><span class="chip2" title="Fabrieken">' + ic('fab') + Math.round(cc.f/FAB_ADD) + '</span><span class="chip2" title="Divisies bij de start">' + ic('leger') + divs + '</span>'
        + (best ? '<span class="chip2" title="Je beste score met dit land">' + ic('medaille') + best + '</span>' : '') + '</span>'
        + '<span class="hint2">' + ic('info') + DIFF[UI.diff].name + ': ' + DIFF[UI.diff].desc + '</span></div>'
        + '<div class="acts">' + seg + '<button class="btn pri" data-act="start">' + ic('vlag') + 'Speel</button></div>';
    } else {
      h = '<div class="txt"><b>Kies je land</b><span class="mut">Tik een land op de kaart</span><span class="hint2">' + DIFF[UI.diff].name + ': ' + DIFF[UI.diff].desc + '</span></div><div class="acts">' + seg + '</div>';
      { const dl = dailyOf();
        h += '<div class="acts"><button class="btn sm' + (dailyDone() ? '' : ' pri') + '" data-act="daily" title="Elke dag hetzelfde land en niveau voor iedereen">' + ic('tijd') + 'Uitdaging van vandaag: ' + esc(dl.name) + ' (' + MAPS[dl.map].name + ') · ' + DIFF[dl.diff].name + (dailyDone() ? ' ✓' : '') + '</button></div>'; }
      if(save && save.G && save.G.player && save.map && MAPS[save.map]) h += '<div class="acts"><button class="btn" data-act="resume">Doorgaan: ' + esc((CACHE[save.map] ? CACHE[save.map].countries[save.G.player].name : save.G.player)) + ', ' + fmtDate(save.G.day) + '</button></div>';
      h += '<div class="acts"><button class="btn sm" data-act="import" title="Een spel laden dat je eerder als bestand hebt bewaard">Spel laden uit bestand</button></div>';
    }
  } else if(UI.intro){
    const [t, x, icons] = INTRO[UI.intro - 1];
    h = '<div class="intro"><span class="iicons">' + icons.map(k => ic(k)).join('') + '</span><span class="ib2"><b>' + t + '</b><span>' + x + '</span><span class="dots">' + INTRO.map((_, i) => '<i' + (i === UI.intro - 1 ? ' class="on"' : '') + '></i>').join('') + '</span></span></div>'
      + '<div class="acts"><button class="btn sm" data-act="introSkip">Overslaan</button><button class="btn sm pri" data-act="introNext">' + (UI.intro < INTRO.length ? 'Volgende' : 'Begin') + '</button></div>';
  } else if(G.over || UI.winShown){
    h = '';
  } else if(fsOpen()){
    h = fsH();
  } else if(UI.target){
    const nm = UI.target === 'drop' ? 'Luchtlanding' : SPECIALS[UI.target].name;
    const how = UI.target === 'bunker' ? 'Tik een eigen provincie'
      : UI.target === 'drop' ? 'Tik een gemarkeerde provincie. Onverdedigd = direct ingenomen.'
      : 'Tik een gemarkeerde provincie';
    h = '<div class="txt"><b>' + nm + '</b><span class="mut">' + how + '</span></div><div class="acts"><button class="btn" data-act="cancelT">Annuleer</button></div>';
  } else if(UI.selAir.size){
    const ws = [...UI.selAir].map(airById).filter(Boolean);
    const t = ws[0] ? ws[0].t : 'fi';
    const hp = Math.round(ws.reduce((s,w) => s + w.hp, 0) / Math.max(1, ws.length));
    const zn = ws[0] && ws[0].zone ? esc(P[ws[0].zone].n) : 'Boven de basis';
    h = '<div class="sel"><span class="sico">' + ic(t) + '</span><span class="sb"><b>' + ws.length + '× ' + AIR[t].name + '</b>' + meter(hp, 100, hp > 60 ? 'ok' : hp > 30 ? 'warn' : 'hot')
      + '<span class="chip2">' + ic('doel') + zn + '</span><span class="chip2">' + ic('prov') + AIR[t].range + ' km</span></span></div>'
      + '<div class="acts"><button class="btn sm" data-act="airhome" title="Terug naar de basis">' + ic('stad') + 'Basis</button><button class="btn sm pri" data-act="clear">' + ic('check') + 'Klaar</button></div>';
  } else if(UI.sel.size){
    const us = [...UI.sel].map(unitById).filter(Boolean);
    const cnt = {}; for(const u of us) cnt[u.t] = (cnt[u.t]||0) + 1;
    const hp = Math.round(us.reduce((s,u) => s + u.hp, 0) / Math.max(1, us.length));
    const moving = us.some(u => u.path.length || u.att);
    const paras = us.filter(u => u.t === 'para');
    const paraReady = paras.filter(u => !u.att && !u.path.length && (u.dropCd||0) <= G.day);
    const types = UTYPES.filter(t => cnt[t]);
    const chips = types.map(t => '<button class="uchip" data-act="tt:' + t + '"' + (types.length > 1 ? ' title="' + BAT[t].name + ' uit de selectie halen"' : ' disabled title="' + BAT[t].name + '"') + '>' + ic(t) + '<b>' + cnt[t] + '</b>' + (types.length > 1 ? '<i>×</i>' : '') + '</button>').join('');
    const oos = us.filter(u => SUP[u.loc] === 0).length;
    const nAuto = nat(G.player).auto, manual = us.filter(u => u.man).length;
    h = '<div class="sel"><span class="sb"><b>' + us.length + (us.length === 1 ? ' divisie' : ' divisies') + '</b>' + meter(hp, 100, hp > 60 ? 'ok' : hp > 30 ? 'warn' : 'hot') + (oos ? '<span class="chip2 oos" title="Afgesneden van bevoorrading">' + ic('prov') + oos + '</span>' : '') + '</span>'
      + '<span class="chips">' + chips + '</span>'
      + (UI.hintN < 4 ? '<span class="hint2">' + ic('zwaard') + (isTouch ? 'Tik of sleep naar een doel' : 'Klik of sleep naar een doel') + '</span>' : '') + '</div><div class="acts">';
    if(nAuto && manual) h += '<button class="btn sm" data-act="toai" title="Laat de auto-generaal deze troepen weer besturen">' + ic('gen') + 'Generaal</button>';
    if(paras.length){
      const cd = paras.reduce((m,u) => Math.max(m, (u.dropCd||0) - G.day), 0);
      h += paraReady.length && enemiesOf(G.player).length ? '<button class="btn sm pri" data-act="drop">' + ic('para') + 'Landing</button>'
        : '<button class="btn sm" disabled title="' + (!enemiesOf(G.player).length ? 'Alleen in oorlog' : 'Weer klaar over ' + Math.ceil(cd) + ' dagen') + '">' + ic('para') + (!enemiesOf(G.player).length ? '—' : Math.ceil(cd) + ' d') + '</button>';
    }
    h += '<button class="btn sm" data-act="front" title="Verdeel deze troepen over je frontprovincies">' + ic('schild') + 'Front</button>';
    h += (moving ? '<button class="btn sm" data-act="halt">' + ic('stop') + 'Stop</button>' : '') + '<button class="btn sm pri" data-act="clear">' + ic('check') + 'Klaar</button></div>';
  } else if(UI.info){
    const p = UI.info, c = G.ctrl[p], core = P[p].c, me = G.player;
    const TI = {m:'berg', h:'heuvel', d:'woest', w:'moeras'};
    let chips = '<span class="chip2" title="Eigenaar"><span class="cdot" style="background:' + colorOf(c) + '"></span>' + esc(cname(c)) + (core !== c ? ' (bezet)' : '') + '</span>';
    if(TER[p]) chips += '<span class="chip2" title="Terrein: aanvallen hier is zwaarder">' + ic(TI[TER[p]]) + TER_NM[TER[p]] + '</span>';
    if(CAPS.has(p)) chips += '<span class="chip2" title="Stad: aanvallen −20%">' + ic('stad') + 'stad</span>';
    if(STAR[p] >= 2) chips += '<span class="chip2 starc" title="Sterren: tellen mee voor de overgave van het land">' + starsH(STAR[p]) + (CITY[p] && !CAPS.has(p) ? esc(CITY[p]) : '') + '</span>';
    chips += '<span class="chip2" title="Fabrieken / bouwplekken">' + ic('fab') + NF.format(Math.round(facN(p)*10)/10) + '/' + SLOTS[p] + '</span>';
    if(core !== c){ const il = integLeft(p); chips += '<span class="chip2' + (il ? '' : ' good') + '" title="Bezet land levert 40% productie en 30% mankracht; geïntegreerd 75% en 70%. Integreren: een jaar houden zonder oorlog met de oude eigenaar.">' + (il === 0 ? 'geïntegreerd' : il < 0 ? 'bezet · oorlog' : 'bezet · ' + il + ' d') + '</span>'; }
    if(G.forts[p]) chips += '<span class="chip2" title="Bunkerlinie">' + ic('bunker') + G.forts[p] + '</span>';
    if(c === me){ const nu = (IDX[p] || []).filter(u => u.c === me).length, sc = supCap(p, me), ov = G.over2 && G.over2[p];
      chips += '<span class="chip2' + (ov ? ' hot' : '') + '" title="Aanvoer: zoveel divisies kan deze provincie voeden' + (ov ? '. Te vol: slijtage en geen herstel' : '') + '. Frontbreedte hier: ' + widthOf(p) + '">' + ic('prov') + nu + '/' + sc + '</span>'; }
    if((G.dmg[p]||0) > G.day) chips += '<span class="chip2 hot" title="Beschadigd: halve productie">' + ic('rocket') + '</span>';
    if(c !== me && atWar(me, c)){ const n = defNow(p).length; chips += '<span class="chip2 hot" title="Vijandelijke divisies">' + ic('oorlog') + n + '</span><span class="chip2" title="Hoe dicht ' + esc(cname(c)) + ' bij overgave is">' + ic('vlag') + pct(meterOf(c)) + '%</span>'; }
    h = '<div class="sel"><span class="sb"><b>' + esc(P[p].n) + '</b></span><span class="chips">' + chips + '</span></div><div class="acts">';
    const tl = c !== me && alive(c) && !atWar(me, c) ? truceLeft(me, c) : 0;
    if(tl > 0){
      h += '<span class="chip2" title="Vredesverdrag: een jaar geen oorlog">' + ic('vrede') + 'verdrag ' + tl + ' d</span>';
      h += '<button class="btn two' + (UI.confirm === 'brk:' + c ? ' war' : '') + '" data-act="brk:' + c + '" title="Verbreek het verdrag: meteen oorlog, veel agressie en −15% oorlogssteun.">' + ic('oorlog') + '<span>' + (UI.confirm === 'brk:' + c ? 'Bevestig' : 'Verbreek verdrag') + '<small>nu · −15% steun</small></span></button>';
    }
    if(c === me){
      const full2 = nat(me).q.length >= 10, qd = nat(me).q.filter(q => q.at === p).length, sp = slotSpots(p) - qd;
      h += sp > 0 ? '<button class="btn two" data-act="fabq:' + p + '"' + (full2 ? ' disabled' : '') + ' title="Bouw een fabriek in deze provincie (' + Math.round(100*yieldOf(p)) + '% opbrengst)">' + ic('fab') + '<span>Fabriek hier<small>' + (qd ? qd + ' in wachtrij · ' : '') + sp + ' plek' + (sp === 1 ? '' : 'ken') + ' vrij</small></span></button>'
        : '<span class="chip2" title="Alle bouwplekken in gebruik">' + ic('fab') + 'plekken vol</span>';
    }
    if(c !== me && !atWar(me, c) && alive(c) && !tl){
      const wg = (G.wg[c] || 0) >= G.day, busy = G.just && G.just.c === c;
      const ae = Math.round(G.ae[c] || 0);
      if(ae) h = h.replace('</span></div><div class="acts">', '<span class="chip2' + (ae >= COAL_THR()*0.7 ? ' hot' : '') + '" title="Hoe bang ' + esc(cname(c)) + ' voor je is (coalitie bij ' + COAL_THR() + ')">' + ic('agr') + ae + '</span></span></div><div class="acts">');
      if(prepOf(me) === c) h += '<span class="chip2" title="Deel van je leger aan de grens met ' + esc(cname(c)) + '">' + ic('gen') + pct(prepReady(me, c)) + '% klaar</span>';
      else h += '<button class="btn two" data-act="prep:' + c + '" title="De generaal zet je leger klaar aan deze grens">' + ic('gen') + '<span>Voorbereiden<small>leger naar de grens</small></span></button>';
      const allied = !!G.allies && G.allies[c] != null;
      if(allied){
        h += '<span class="chip2 good" title="Bondgenoot: valt je nooit aan en doet mee in je oorlogen">' + ic('vrede') + 'bondgenoot</span>'
          + '<button class="btn two' + (UI.confirm === 'unally:' + c ? ' war' : '') + '" data-act="unally:' + c + '" title="Zeg het bondgenootschap op: de buren van ' + esc(cname(c)) + ' schrikken en je kunt het 90 dagen niet opnieuw sluiten.">' + ic('oorlog') + '<span>' + (UI.confirm === 'unally:' + c ? 'Bevestig' : 'Zeg op') + '<small>kost agressie</small></span></button>';
      } else {
        const off = allianceOffer(c);
        h += '<button class="btn two" data-act="ally:' + c + '"' + (off.ok ? '' : ' disabled') + ' title="' + (off.ok ? 'Sluit een bondgenootschap: jullie vallen elkaar nooit aan en ' + esc(cname(c)) + ' doet mee in je oorlogen. Kost ' + ALLY_COST + ' bevelpunten.' : esc(cname(c)) + ' ' + esc(off.why)) + '">' + ic('vrede') + '<span>Bondgenootschap<small>' + (off.ok ? ALLY_COST + ' bevelpunten' : 'niet mogelijk') + '</small></span></button>';
      }
      if(!allied){
      if(wg) h += '<button class="btn war" data-act="decl:' + c + '">' + ic('oorlog') + 'Verklaar oorlog</button>';
      else if(busy) h += '<span class="chip2">' + ic('tijd') + 'Doel over ' + (G.just.until - G.day) + ' d</span>';
      else {
        h += '<button class="btn two" data-act="just:' + c + '"' + (G.just || nat(me).cp < 25 ? ' disabled' : '') + ' title="Rechtvaardig een oorlogsdoel: 30 dagen en 25 bevelpunten. Daarna halve agressie en geen verlies aan steun.">' + ic('vrede') + '<span>Rechtvaardig<small>' + (G.just ? 'al een doel bezig' : '30 d · ' + '½ agressie') + '</small></span></button>';
        h += '<button class="btn two' + (UI.confirm === 'war:' + c ? ' war' : '') + '" data-act="war:' + c + '" title="Verrassingsaanval: meteen oorlog, maar veel agressie en −10% oorlogssteun.">' + ic('oorlog') + '<span>' + (UI.confirm === 'war:' + c ? 'Bevestig' : 'Verrassing') + '<small>nu · −10% steun</small></span></button>';
      }
      }
    }
    h += '<button class="btn sm ghost" data-act="clear" aria-label="Sluiten">×</button></div>';
  }
  el.hidden = !h;
  if(h === stripSig || stripPress) return;
  stripSig = h;
  el.innerHTML = h;
}
$('strip').addEventListener('pointerdown', () => { stripPress = true; });
addEventListener('pointerup', () => { stripPress = false; sheetPress = false; });
$('strip').addEventListener('click', async e => {
  const b = e.target.closest('[data-act],[data-map]'); if(!b || b.disabled) return;
  sfx('tap');
  if(b.dataset.map){ await switchMap(b.dataset.map); return; }
  const a = b.dataset.act;
  if(a === 'start'){ const c = UI.pick; UI.pick = null; newGame(c, UI.diff, UI.dailyKey ? null : UI.opt); if(UI.dailyKey){ G.daily = UI.dailyKey; UI.dailyKey = null; } onGameLoaded(true); return; }
  if(a === 'daily'){ const dl = dailyOf(); if(MAPNAME !== dl.map){ await switchMap(dl.map); } UI.diff = dl.diff; UI.opt = {help:0, ai:0}; UI.pick = dl.c; UI.dailyKey = dl.key; fitCountry(dl.c); stripSig = null; renderAll(); return; }
  if(a === 'resume'){ loadSaved(); return; }
  if(a === 'import'){ $('importFile').click(); return; }
  if(a === 'retry'){ UI.err = null; await switchMap(MAPNAME || 'europe', true); return; }
  if(a === 'new'){ toPick(); return; }
  if(a === 'diff'){ UI.diff = (UI.diff + 1) % DIFF.length; }
  else if(a === 'opt:help' || a === 'opt:ai'){ const k = a.slice(4), v = UI.opt[k]; UI.opt[k] = v === 0 ? 1 : v === 1 ? -1 : 0; }
  else if(a === 'introNext' || a === 'introSkip'){
    if(a === 'introNext' && UI.intro < INTRO.length) UI.intro++;
    else { UI.intro = 0; G.paused = false; try{ localStorage.setItem('ve_intro_seen', '1'); }catch(e){} }
  }
  else if(a === 'cont'){ UI.winShown = false; G.paused = false; }
  else if(a === 'cancelT'){ UI.target = null; }
  else if(a.startsWith('fs:')){
    const k = a.slice(3), me = G.player;
    if(k === 'hide') G.fsHide = 1;
    else if(k === 'prod'){ UI.sheet = 'prod'; sheetSig = ''; }
    else if(k === 'order'){
      const cnt = {}; for(const u of G.units) if(u.c === me) cnt[u.loc] = (cnt[u.loc] || 0) + 1;
      const big = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0];
      const grp = big ? G.units.filter(u => u.c === me && u.loc === big) : [];
      if(grp.length){ UI.sel = new Set(grp.map(u => u.id)); UI.info = null; toast('Tik nu een provincie: daar gaan ze heen (een vijandelijke = aanval)', 'good', 'fs'); fitBox(P[grp[0].loc].a[0] - 120, P[grp[0].loc].a[1] - 90, P[grp[0].loc].a[0] + 120, P[grp[0].loc].a[1] + 90, 1.3); }
    }
    else if(k === 'war'){
      const nb = neighbors(me).filter(x => !atWar(me, x)).sort((x, y) => armyPow(x) - armyPow(y))[0];
      if(nb){ const p = owned(nb).find(q => ADJ[q].some(n => G.ctrl[n] === me)) || CN[nb].cap; UI.info = p; UI.confirm = null; fitCountry(nb); toast('Rechtvaardig een oorlog tegen ' + cname(nb) + ' (30 dagen) of val meteen aan', '', 'fs'); }
    }
    else if(k === 'gen'){ const n = nat(me); n.auto = true; for(const u of G.units) if(u.c === me){ u.man = false; u.g = null; } UI.sheet = 'info'; sheetSig = ''; toast('De generaal neemt het leger over. Zijn opdrachten staan in Overzicht', 'good', 'fs'); }
  }
  else if(a === 'clear'){ clearSel(); UI.info = null; UI.confirm = null; }
  else if(a === 'airhome'){ for(const id of UI.selAir){ const w = airById(id); if(w){ w.zone = null; w.man = false; } } }
  else if(a === 'drop'){ UI.target = 'drop'; UI.sheet = null; }
  else if(a === 'halt'){ for(const id of UI.sel){ const u = unitById(id); if(u && !u.air){ u.path = []; u.att = null; u.prog = 0; u.man = true; u.g = null; } } }
  else if(a === 'front'){
    // verdeel de selectie over de frontprovincies, de leegste eerst
    const us2 = [...UI.sel].map(unitById).filter(u => u && !u.air);
    buildIdx();
    const ens2 = enemiesOf(G.player);
    const front = owned(G.player).filter(p => ADJ[p].some(n2 => ens2.length ? atWar(G.player, G.ctrl[n2]) : G.ctrl[n2] !== G.player));
    if(front.length && us2.length){
      const have = {}; front.forEach(f2 => have[f2] = defNow(f2).length);
      for(const u of us2){
        u.man = true; u.g = null; u.att = null;
        let best = null, bs = Infinity;
        for(const f2 of front){ const sc2 = have[f2]*1e6 + dist(u.loc, f2); if(sc2 < bs){ bs = sc2; best = f2; } }
        have[best]++;
        if(u.loc === best){ u.path = []; continue; }
        const path = findPath(G.player, u.loc, best, false);
        if(path){ if(u.path[0] !== path[0]) u.prog = 0; u.path = path; }
      }
      toast(us2.length + ' divisies verdelen zich over het front (' + front.length + ' provincies)', 'good');
      clearSel();
    } else toast('Geen frontprovincies gevonden', 'war', 'bad');
  }
  else if(a === 'toai'){ for(const id of UI.sel){ const u = unitById(id); if(u){ u.man = false; u.g = null; } } toast('De generaal neemt deze troepen over', 'good'); clearSel(); }
  else if(a.startsWith('tt:')){ const t = a.slice(3); const rest = [...UI.sel].filter(id => { const u = unitById(id); return u && u.t !== t; }); if(rest.length) UI.sel = new Set(rest); }
  else if(a.startsWith('war:')){
    const c = a.slice(4);
    if(UI.confirm === a){ declare(G.player, c); UI.confirm = null; }
    else UI.confirm = a;
  }
  else if(a.startsWith('decl:')){ declare(G.player, a.slice(5)); }
  else if(a.startsWith('fabq:')){
    const p = a.slice(5), n = nat(G.player);
    if(n.q.length < 10 && G.ctrl[p] === G.player){ n.q.push({k:'fab', p:0, at:p}); qSig = null; toast('Fabriek in de wachtrij · ' + P[p].n, 'good'); }
  }
  else if(a.startsWith('prep:')){
    const c = a.slice(5), n = nat(G.player); genCfg().prep = c;
    if(!n.auto){ n.auto = true; for(const u of G.units) if(u.c === G.player){ u.man = false; u.g = null; } }
    toast('Generaal: het leger marcheert naar de grens met ' + cname(c), 'good');
  }
  else if(a.startsWith('brk:')){
    const c = a.slice(4);
    if(UI.confirm !== a){ UI.confirm = a; }
    else { UI.confirm = null; delete G.truce[wk(G.player, c)]; for(const x of neighbors(c)) addAE(x, 10); nat(G.player).ws = clamp(nat(G.player).ws - 5, 0, 100); declare(G.player, c); }
  }
  else if(a.startsWith('ally:')){ proposeAlliance(a.slice(5)); }
  else if(a.startsWith('unally:')){ const c = a.slice(7); if(UI.confirm === a){ UI.confirm = null; breakAlliance(c); } else UI.confirm = a; }
  else if(a.startsWith('just:')){
    const c = a.slice(5), n = nat(G.player);
    if(!G.just && n.cp >= 25){ n.cp -= 25; G.just = {c, until: G.day + 30}; toast('Oorlogsdoel tegen ' + cname(c) + ': klaar over 30 dagen', 'good'); }
  }
  stripSig = null; renderAll();
});

/* ================= uitklapvel ================= */
let sheetSig = '', sheetPress = false;
// ---- bouwstenen voor de interface: iconen en meters i.p.v. zinnen ----
const pips = (v, n = 5) => { let h = '<span class="pips" aria-label="' + v + ' van ' + n + '">'; for(let i = 0; i < n; i++) h += '<i' + (i < v ? ' class="on"' : '') + '></i>'; return h + '</span>'; };
const meter = (v, max, cls) => '<span class="meter' + (cls ? ' ' + cls : '') + '"><i style="width:' + Math.max(0, Math.min(100, 100*v/Math.max(1e-9, max))) + '%"></i></span>';
// (fabriek: de generaal kiest de beste plek; zelf kiezen kan via een provincie → Fabriek hier)
const SHORT = {rocket:'Zware klap op één provincie', sabot:'Industrie 60 dagen half stil', blitz:'+35% aanval, 15 dagen', mobil:'Leger +30%, 180 dagen', bunker:'+20% verdediging, max 3'};
const SICON = {rocket:'rocket', sabot:'sabot', blitz:'blitz', mobil:'mobil', bunker:'bunker'};
function tile(k, n, dis, sub){
  const it = ITEMS[k];
  const tip = (AIR[k] ? AIR[k].name + ': ' + AIR[k].desc + ', bereik ' + AIR[k].range + ' km' : it.name + ': ' + (ROLE_TXT[k] || '')).replace(/"/g, '');
  let stats = '';
  if(AIR[k]) stats = '<span class="st2" title="Bereik">' + ic('doel') + AIR[k].range + ' km</span>';
  else if(it.kind === 'tech'){ const l = n.tech[it.tech]; stats = '<span class="st2" title="Niveau">' + pips(l, 3) + '</span>'; }
  return '<button class="tile" title="' + tip + '" data-q="' + k + '"' + (dis ? ' disabled' : '') + '>'
    + '<span class="tico">' + qIcon(k) + '</span>'
    + '<span class="tb"><span class="tn">' + it.name + (it.kind === 'tech' && n.tech[it.tech] < 3 ? ' ' + ROMAN[n.tech[it.tech]+1] : '') + '</span>'
    + '<span class="tmeta">' + stats + '<span class="st2 tcst">' + sub + '</span></span></span></button>';
}
// tegel voor een divisieontwerp: silhouet, naam, aanval/verdediging, bouwtijd; ✎ opent de ontwerper
function tileT(k, dis){
  const me2 = G.player, n2 = nat(me2), comp = compByKey(k), ts = tstat(me2, k), cost = tplCost(k);
  const nm = k[0] === 'p' && k.length <= 3 ? G.tmpl[+k.slice(1)].name : FIXT[k].name;
  const tip = Object.keys(comp).map(k2 => comp[k2] + '× ' + BAT[k2].name.toLowerCase()).join(', ');
  const pa = clamp(Math.round(ts.a/6), 1, 5), pd = clamp(Math.round(ts.d/7), 1, 5);
  return '<button class="tile" title="' + tip + '" data-q="' + k + '"' + (dis ? ' disabled' : '') + '>'
    + '<span class="tico">' + ic(domOf(comp)) + '</span>'
    + '<span class="tb"><span class="tn"><span>' + esc(nm) + '</span>' + (k[0] === 'p' && k.length <= 3 ? '<span class="tedit" data-edit="' + k.slice(1) + '" role="button" aria-label="Ontwerp aanpassen" title="Ontwerp aanpassen">✎</span>' : '') + '</span>'
    + '<span class="tmeta"><span class="st2" title="Aanval">' + ic('zwaard') + pips(pa) + '</span><span class="st2" title="Verdediging">' + ic('schild') + pips(pd) + '</span><span class="st2 tcst">' + ic('tijd') + Math.ceil(cost / Math.max(0.1, n2.ppd)) + ' d</span></span></span></button>';
}
// wat deze samenstelling kan (en waar ze zwak is): de rollen in gewone woorden
function roleH(fr, comp){
  const it = [];
  if(fr.tank >= 0.05) it.push(['good', ic('tank') + 'Open terrein +' + Math.round(60*fr.tank) + '% aanval']);
  if(fr.art >= 0.05) it.push(['good', ic('art') + 'Tegen bunkers, steden, heuvels +' + Math.round(120*fr.art) + '%']);
  if(comp.aa) it.push(['good', ic('aa') + 'Vijandelijke luchtsteun −' + Math.min(75, 5*comp.aa) + '%']);
  if(fr.arm >= 0.05) it.push(['bad', ic('berg') + 'Bergen −' + Math.round(45 + 25*fr.arm) + '%, steden −' + Math.round(20 + 20*fr.arm) + '%']);
  else it.push(['', ic('berg') + 'Bergen −45%, steden −20% (als infanterie)']);
  it.push(['', ic('schild') + 'Frontbreedte 1 (vlak 12, heuvels 10, bergen/moeras 8)']);
  return '<div class="roles">' + it.map(([c, t]) => '<span class="role' + (c ? ' ' + c : '') + '">' + t + '</span>').join('') + '</div>';
}
function unitTable(){
  const bp = t => ({a: clamp(Math.round(BAT[t].a*1.1), 1, 5), d: clamp(Math.round(BAT[t].d*1.4), 1, 5)});
  let b2 = '<div class="utab2">';
  for(const t of UTYPES){ const p = bp(t); b2 += '<div class="ur">' + ic(t) + '<span class="un">' + BAT[t].name + '<small>' + BDESC[t] + '</small></span><span class="up">' + ic('zwaard') + pips(p.a) + ic('schild') + pips(p.d) + '</span></div>'; }
  b2 += '<div class="ur">' + ic('fi') + '<span class="un">Jagers<small>Luchtoverwicht in hun zone (' + AIR.fi.range + ' km)</small></span></div>'
    + '<div class="ur">' + ic('cas') + '<span class="un">Grondaanval<small>Extra schade in gevechten (' + AIR.cas.range + ' km)</small></span></div>'
    + '<div class="ur">' + ic('bo') + '<span class="un">Bommenwerpers<small>Halveren vijandelijke productie (' + AIR.bo.range + ' km)</small></span></div>'
    + '</div>';
  return b2;
}
// inklapbare sectie: dichtgeklapt is het één regel met het belangrijkste getal
const starsH = n => '<span class="stars" aria-label="' + n + ' sterren">' + ic('ster').repeat(n) + '</span>';
const pchipsH = ps => '<div class="pls">' + ps.slice(0, 10).map(p => '<span class="pl">' + esc(P[p].n) + starsH(starOf(p)) + '</span>').join('') + (ps.length > 10 ? '<span class="pl mut">+' + (ps.length - 10) + '</span>' : '') + '</div>';
function negBlock(e){
  const d = dealInfo(e);
  let h = '<div class="neg">';
  if(d.keep.length){
    const ae = aePreview(e, d.keep);
    h += '<div class="nrow"><span class="nt">' + ic('check') + 'Ze staan af<small>' + pct(Math.min(0.95, d.mE)) + '% van wat je bezet · agressie +' + Math.round(ae.v) + '</small></span>' + pchipsH(d.keep)
      + '<button class="btn sm pri" data-deal="keep:' + e + '">' + ic('vrede') + 'Teken: jij houdt ' + d.keep.length + '</button></div>';
  } else h += '<div class="nrow mut">' + ic('info') + '<span>' + (d.occ.length ? 'Ze staan nog niets af: hun meter moet boven de jouwe komen' : 'Je bezet nog niets van hun land') + '</span></div>';
  h += '<div class="nrow"><button class="btn sm" data-deal="white:' + e + '"' + (d.white ? '' : ' disabled') + '>' + ic('wit') + 'Witte vrede</button><small class="mut">' + (d.white ? 'alles terug naar de oude grenzen' : 'ze winnen, dus geen witte vrede') + '</small></div>';
  if(d.give.length) h += '<div class="nrow"><span class="nt">' + ic('agr') + 'Zij eisen</span>' + pchipsH(d.give) + '<button class="btn sm war" data-deal="give:' + e + '">Accepteer hun eis</button></div>';
  return h + '</div>';
}
const det = (k, sum, body, def) => { const open = UI.od && UI.od[k] !== undefined ? UI.od[k] : def; return '<details class="secd" data-d="' + k + '"' + (open ? ' open' : '') + '><summary>' + sum + '<i class="chev"></i></summary>' + body + '</details>'; };
function renderSheet(){
  const el = $('sheet');
  if(!G || !UI.sheet || G.over){ el.hidden = true; sheetSig = ''; return; }
  const n = nat(G.player), me = G.player;
  const full = n.q.length >= 10;
  const dd = k => Math.ceil(itemCost(me,k) / Math.max(0.1, n.ppd));
  const tsub = k => ic('tijd') + dd(k) + ' d';
  const divs = UCNT[me] != null ? UCNT[me] : G.units.filter(u => u.c === me).length, cap = armyCap(me);
  let h = '<div class="tabs"><div class="tabl" role="tablist">'
    + [['prod','Productie','fab'],['spec','Acties','bevel'],['info','Overzicht','vlag']].map(([k,l,i]) => '<button class="tab' + (UI.sheet === k ? ' on' : '') + '" role="tab" aria-selected="' + (UI.sheet === k) + '" data-tab="' + k + '">' + ic(i) + '<span>' + l + '</span></button>').join('')
    + '</div><button class="xclose" data-tab="" aria-label="Sluiten">×</button></div>';
  if(UI.sheet === 'prod' && UI.editT != null){
    // de divisieontwerper: stel je divisie samen uit bataljons
    const T = G.tmpl[UI.editT], tpk = 'p' + UI.editT, nb = totBat(T.comp), ts = tstat(me, tpk), cost = tplCost(tpk);
    h += '<div class="flow2"><span class="fl">' + ic(domOf(T.comp)) + '<b>' + esc(T.name) + '</b></span><span class="fl mut2" style="margin-left:auto">' + nb + '/9 bataljons</span></div>';
    for(const k of ['inf','mot','tank','art','aa']){
      h += '<div class="trow">' + ic(k) + '<span class="un">' + BAT[k].name + '<small>' + BDESC[k] + '</small></span>'
        + '<span class="tctr"><button data-tb="sub:' + k + '"' + (T.comp[k] ? '' : ' disabled') + ' aria-label="Minder ' + BAT[k].name + '">−</button><b>' + (T.comp[k] || 0) + '</b><button data-tb="add:' + k + '"' + (nb >= 9 ? ' disabled' : '') + ' aria-label="Meer ' + BAT[k].name + '">+</button></span></div>';
    }
    h += '<div class="blk" style="margin-top:.6rem"><div class="tsum">'
      + '<span class="st2" title="Aanval">' + ic('zwaard') + NF.format(ts.a) + '</span>'
      + '<span class="st2" title="Verdediging">' + ic('schild') + NF.format(ts.d) + '</span>'
      + '<span class="st2" title="Snelheid">' + ic('mot') + ts.s + ' km/d</span>'
      + '<span class="st2" title="Bouwtijd">' + ic('tijd') + '~' + Math.ceil(cost / Math.max(0.1, n.ppd)) + ' d</span></div>'
      + '</div>' + roleH(ts.fr, T.comp)
      + '<p class="help" style="margin:.35rem 0 0">De divisie is zo snel als het traagste bataljon. Wijzigingen gelden meteen ook voor je bestaande divisies van dit ontwerp.</p></div>';
    h += '<div class="foot"><button class="btn pri" data-act="tdone">' + ic('check') + 'Klaar</button></div>';
  } else if(UI.sheet === 'prod'){
    const facT = facTot(me), [su, st] = slotTot(me), wings = ACNT[me] || 0, acap = airCap(me);
    h += '<div class="flow2" title="Fabrieken maken productie; de wachtrij bouwt één ding tegelijk; je leger groeit tot de legerlimiet (mankracht)">'
      + '<span class="fl" title="Fabrieken (bezet land telt minder)">' + ic('fab') + '<b>' + NF.format(facT) + '</b></span><i>›</i>'
      + '<span class="fl">' + ic('tijd') + '<b>' + NF.format(n.ppd) + '</b><small>/dag</small></span><i>›</i>'
      + '<span class="fl fl-army">' + ic('leger') + '<b>' + divs + '<small>/' + cap + '</small></b>' + meter(divs, cap, divs >= cap ? 'hot' : '') + '</span></div>';
    h += '<div class="sec">' + ic('inf') + 'Landmacht<span class="sr">✎ = ontwerp aanpassen</span></div><div class="grid">';
    for(const i2 of [0, 1, 2]) h += tileT('p' + i2, full);
    h += tileT('mar', full) + tileT('para', full);
    h += '</div><p class="help capx">' + ic('leger') + '<span>Legerlimiet ' + cap + ' komt uit je <b>mankracht</b> (' + NF.format(n.man || 0) + ' mln) plus een beetje uit je fabrieken. Eigen land telt helemaal, bezet land ' + Math.round(100*(D().occ || 0.3)) + '%, geïntegreerd land 70%.</span></p>';
    h += '<div class="sec">' + ic('fi') + 'Luchtmacht<span class="sr">' + wings + '/' + acap + ' eskaders</span></div><div class="grid">';
    for(const k of ['fi','cas','bo']) h += tile(k, n, full, tsub(k));
    const fs = fabSpots(me);
    h += '</div><div class="sec">' + ic('fab') + 'Economie en onderzoek<span class="sr">bouwplekken ' + NF.format(su) + '/' + st + '</span></div><div class="grid">';
    h += tile('fab', n, full || fs <= 0, fs <= 0 ? 'plekken vol' : '+' + Math.round(100*FAB_ADD*0.6/Math.max(0.3, n.ppd)) + '% · ' + tsub('fab'));
    h += tile('rocket', n, full, n.ro + '× · ' + tsub('rocket'));
    for(const k of ['t_inf','t_arm','t_air']){
      const it = ITEMS[k], lvl = n.tech[it.tech], queued = n.q.some(q => q.k === k);
      h += tile(k, n, lvl >= 3 || queued || full, lvl >= 3 ? 'max' : queued ? 'in wachtrij' : tsub(k));
    }
    h += '</div><div class="sec">' + ic('prov') + 'Nieuwe troepen naar</div><div class="seg">'
      + '<button class="btn sm' + (G.rally !== 'front' ? ' pri' : '') + '" data-rally="cap">' + ic('stad') + 'Hoofdstad</button>'
      + '<button class="btn sm' + (G.rally === 'front' ? ' pri' : '') + '" data-rally="front">' + ic('zwaard') + 'Front</button></div>';
  } else if(UI.sheet === 'spec'){
    h += '<div class="flow2"><span class="fl fl-army">' + ic('bevel') + '<b>' + Math.floor(n.cp) + '<small>/100</small></b>' + meter(n.cp, 100) + '</span><span class="fl mut2">+0,5/dag</span></div>';
    h += '<div class="grid" style="margin-top:.55rem">';
    for(const k of Object.keys(SPECIALS)){
      const sp = SPECIALS[k], st = specStatus(me, k);
      const rem = k === 'blitz' ? n.blitz - G.day : k === 'mobil' ? (n.mobil || 0) - G.day : 0;
      const short = st === 'Te weinig bevelpunten' ? 'te weinig bevel' : st === 'Bouw eerst een raket' ? 'eerst raket bouwen' : (st || '').toLowerCase();
      const arm = UI.armAct === k;
      const line = rem > 0 ? '<span class="st2 okc">actief · nog ' + Math.ceil(rem) + ' d</span>'
        : arm ? '<span class="st2" style="color:var(--accent)">tik nogmaals</span>'
        : st ? '<span class="st2" style="color:var(--war)">' + short + '</span>'
        : '<span class="st2">' + SHORT[k] + '</span>';
      h += '<button class="tile act' + (arm ? ' arm' : '') + '" data-s="' + k + '"' + (st ? ' disabled' : '') + ' title="' + sp.desc + '">'
        + '<span class="tico">' + ic(SICON[k]) + '</span>'
        + '<span class="tb"><span class="tn">' + sp.name + '<span class="tcost">' + ic('bevel') + sp.cp + '</span></span>'
        + '<span class="tmeta">' + line + '</span></span></button>';
    }
    h += '</div><p class="help" style="margin-top:.55rem">Raket, sabotage en bunker: tik hierna een provincie op de kaart.</p>';
  } else if(UI.sheet === 'info'){
    const mineP = owned(me).length;
    const wings = {fi:0, cas:0, bo:0}; for(const w of G.air) if(w.c === me) wings[w.t]++;
    const sc = score(), rk = rankOf(sc);
    h += '<div class="hero"><span class="cdot big" style="background:' + colorOf(me) + '"></span><span class="hn"><b>' + esc(cname(me)) + '</b><small>' + fmtDay(G.day) + ' · ' + DIFF[G.diff].name + (G.opt && (G.opt.help || G.opt.ai) ? ' · eigen spel' : '') + '</small></span>'
      + '<span class="medal m-' + rk.split(' ')[0].toLowerCase() + '" title="Score: gebied, doelen en verslagen landen. Geen tijdslimiet.">' + ic('medaille') + '<b>' + sc + '</b></span></div>';
    h += '<div class="tiles">'
      + (G.won
        ? '<button class="kt win" data-act="endcard" title="Overwinning behaald: je beheerst ' + winTxt() + ' van de kaart. Tik voor de eindkaart"><span class="kti">' + ic('medaille') + '</span><b>' + mineP + '</b><small>' + Math.round(100*mineP/PIDS.length) + '% · gewonnen</small></button>'
        : '<div class="kt" title="Provincies · overwinning bij ' + Math.round(100*winShare()) + '% van de kaart (' + Math.ceil(PIDS.length*winShare()) + ' provincies)"><span class="kti">' + ic('prov') + '</span><b>' + mineP + '</b><small>' + Math.round(100*mineP/PIDS.length) + '% / ' + Math.round(100*winShare()) + '%</small>' + meter(mineP, Math.ceil(PIDS.length*winShare()), 'ok') + '</div>')
      + '<div class="kt" title="Productie per dag"><span class="kti">' + ic('fab') + '</span><b>' + NF.format(n.ppd) + '</b><small>per dag</small></div>'
      + '<div class="kt" title="Divisies en legerlimiet"><span class="kti">' + ic('leger') + '</span><b>' + divs + '<small>/' + cap + '</small></b>' + meter(divs, cap, divs >= cap ? 'hot' : '') + '</div>'
      + '<div class="kt" title="Oorlogssteun: bepaalt je legerlimiet. Stijgt als je wordt aangevallen, daalt bij aanvalsoorlogen en verlies."><span class="kti">' + ic('steun') + '</span><b>' + Math.round(n.ws) + '%</b>' + meter(n.ws, 100, n.ws < 25 ? 'hot' : 'ok') + '</div>'
      + '<div class="kt" title="Eskaders: jagers / grondaanval / bommenwerpers"><span class="kti">' + ic('fi') + '</span><b>' + (wings.fi + wings.cas + wings.bo) + '</b><small>' + wings.fi + ' · ' + wings.cas + ' · ' + wings.bo + '</small></div>'
      + '<div class="kt" title="Bevelpunten"><span class="kti">' + ic('bevel') + '</span><b>' + Math.floor(n.cp) + '</b>' + meter(n.cp, 100) + '</div>'
      + '</div>';
    const threats = Object.keys(G.aiJust || {}).filter(x => alive(x) && !atWar(x, me));
    for(const x of threats) h += '<div class="alert">' + ic('oorlog') + '<span><b>' + esc(cname(x)) + '</b> bereidt oorlog voor</span><span class="num">' + (G.aiJust[x] > G.day ? (G.aiJust[x] - G.day) + ' d' : 'nu') + '</span></div>';
    if(G.just) h += '<div class="alert own">' + ic('vrede') + '<span>Oorlogsdoel tegen <b>' + esc(cname(G.just.c)) + '</b></span><span class="num">' + (G.just.until - G.day) + ' d</span></div>';
    for(const x in G.wg) if(G.wg[x] >= G.day && alive(x) && !atWar(me, x)) h += '<div class="alert own">' + ic('check') + '<span>Oorlogsdoel klaar: <b>' + esc(cname(x)) + '</b></span><span class="num">' + (G.wg[x] - G.day) + ' d</span></div>';
    h += '<div class="blk slim"><div class="tog"><span><span class="tgt">' + ic('gen') + 'Auto-generaal</span><small>Jouw bevelen gaan voor, daarna neemt hij het over</small></span><button class="sw" role="switch" aria-checked="' + (n.auto ? 'true' : 'false') + '" data-auto="1" aria-label="Auto-generaal"></button></div>' + (n.auto ? genStatusH(me) + genOrdersH(me) : '') + '</div>';
    const done = G.obj.filter(o => o.done).length;
    let b = '<div class="blk">';
    for(const o of G.obj) b += '<div class="orow' + (o.done ? ' done' : o.fail ? ' fail' : '') + '"><span class="ock">' + (o.done ? ic('check') : o.fail ? '×' : '') + '</span><span class="ot">' + esc(o.t) + '<small>' + esc(o.r) + '</small></span></div>';
    b += '</div>';
    { const sh = owned(me).length / PIDS.length; h += '<div class="alert own">' + ic('vlag') + '<span>Overwinning: beheers <b>' + Math.round(100*winShare()) + '%</b> van de kaart</span><span class="num">nu ' + Math.round(100*sh) + '%</span></div>'; }
    h += det('doelen', ic('doel') + 'Doelen<span class="sumv">' + done + '/' + G.obj.length + '</span>', b, false);
    const ens = enemiesOf(me);
    if(!ens.length) b = '<div class="blk empty">' + ic('vrede') + '<span>In vrede. Tik een buitenlandse provincie om een oorlog voor te bereiden.</span></div>';
    else {
      b = '<div class="blk">';
      for(const e of ens){
        const w = G.aggr[wk(me, e)], mE = meterOf(e), mM = meterOf(me);
        b += '<div class="war2"><div class="wtop"><span class="cdot" style="background:' + colorOf(e) + '"></span><span class="wn">' + esc(cname(e)) + '</span>'
          + (w ? '<span class="tagw" title="' + (w.a === me ? 'Jij viel aan' : 'Zij vielen aan') + '">' + ic(w.a === me ? 'zwaard' : 'schild') + '</span>' : '')
          + (nat(e).total ? '<span class="tagw war" title="Onvoorwaardelijke overgave: verover alles">' + ic('vlag') + '</span>' : '')
          + '<span class="wd" title="Duur van de oorlog">' + ic('tijd') + (G.day - G.wars[wk(me, e)]) + ' d</span></div>'
          + '<div class="mrow" title="Hoe dicht ' + esc(cname(e)) + ' bij overgave is. Vult met bezette sterren, sneller bij lage oorlogssteun."><span class="ml">Zij</span>' + meter(mE, 1, mE >= 0.75 ? 'warn' : 'ok') + '<b>' + pct(mE) + '%</b></div>'
          + '<div class="mrow" title="Hoe dicht jij bij overgave bent"><span class="ml">Jij</span>' + meter(mM, 1, 'hot') + '<b>' + pct(mM) + '%</b></div>'
          + '<div class="wacts"><button class="btn sm' + (UI.neg === e ? ' pri' : '') + '" data-neg="' + e + '">' + ic('vrede') + 'Onderhandel</button></div>'
          + (UI.neg === e ? negBlock(e) : '') + '</div>';
      }
      b += '<p class="help" style="margin:.45rem 0 0">Bij 75% roept een land de noodtoestand uit, bij 100% geeft het zich over.</p></div>';
    }
    const topM = ens.reduce((m2, e) => Math.max(m2, meterOf(e)), 0);
    const alc = Object.keys(G.allies || {});
    const allyB = alc.length
      ? '<div class="blk">' + alc.map(c => '<div class="war2"><div class="wtop"><span class="cdot" style="background:' + colorOf(c) + '"></span><span class="wn">' + esc(cname(c)) + '</span><span class="wd" title="Bondgenoot sinds">' + ic('tijd') + Math.floor(G.day - G.allies[c]) + ' d</span></div></div>').join('') + '<p class="help" style="margin:.45rem 0 0">Een bondgenoot valt je niet aan en doet mee in je oorlogen. Opzeggen: tik een provincie van het land.</p></div>'
      : '<div class="blk empty">' + ic('vrede') + '<span>Nog geen bondgenoten. Tik een buurland en kies Bondgenootschap (' + ALLY_COST + ' bevelpunten, hoogstens ' + maxAllies() + ').</span></div>';
    h += det('oorlog', ic('oorlog') + 'Oorlogen<span class="sumv">' + (ens.length ? ens.length + ' · ' + pct(topM) + '%' : 'vrede') + '</span>', b, ens.length > 0);
    h += det('bond', ic('vrede') + 'Bondgenoten<span class="sumv">' + alc.length + '/' + maxAllies() + '</span>', allyB, alc.length > 0);
    const thr = COAL_THR(), am = maxAE();
    const fear = CIDS.filter(x => x !== me && alive(x) && !atWar(x, me) && (G.ae[x] || 0) >= 5).sort((a2, b2) => G.ae[b2] - G.ae[a2]).slice(0, 6);
    b = '<div class="blk">';
    if(!fear.length) b += '<div class="empty">' + ic('check') + '<span>Niemand is bang voor je.</span></div>';
    for(const x of fear){ const v = G.ae[x]; b += '<div class="aerow" title="Agressie: hoe bang ' + esc(cname(x)) + ' voor je is"><span class="cdot" style="background:' + colorOf(x) + '"></span><span class="wn">' + esc(cname(x)) + '</span>' + meter(v, thr, v >= thr ? 'hot' : v >= thr*0.7 ? 'warn' : 'ok') + '<span class="num">' + Math.round(v) + '</span></div>'; }
    b += '<p class="help" style="margin:.4rem 0 0">Coalitie zodra 3 landen boven ' + thr + ' komen. Rechtvaardigen halveert agressie; in vrede zakt ze sneller.</p></div>';
    h += det('dreiging', ic('agr') + 'Dreiging<span class="sumv' + (am.m >= thr*0.8 ? ' hotv' : '') + '">' + Math.round(am.m) + '/' + thr + '</span>', b, am.m >= thr*0.8);
    const rank = CIDS.filter(alive).map(c => ({c, n: owned(c).length})).sort((a2, b2) => b2.n - a2.n).slice(0, 5);
    b = '<div class="blk">';
    for(const r of rank) b += '<div class="rrow"><span class="cdot" style="background:' + colorOf(r.c) + '"></span><span class="wn">' + esc(cname(r.c)) + (r.c === me ? ' <span class="mut">(jij)</span>' : '') + '</span>' + (atWar(me, r.c) ? '<span class="tagw war">' + ic('oorlog') + '</span>' : '') + meter(r.n, rank[0].n) + '<span class="num">' + r.n + '</span></div>';
    b += '</div>';
    h += det('machten', ic('prov') + 'Grootste machten<span class="sumv">' + esc(cname(rank[0].c)) + '</span>', b, false);
    b = '<div class="rules">'
      + '<p>' + ic('fab') + '<span><b>Fabrieken</b> maken productie. Elke provincie heeft <b>bouwplekken</b>: dorp 2, grote stad 5, hoofdstad 8. Vol? Dan groei je alleen nog met nieuw land. Kies zelf de plek via een provincie → Fabriek hier.</span></p>'
      + '<p>' + ic('leger') + '<span><b>Legerlimiet</b> = vooral mankracht (plus 0,3 per fabriek). Eigen land telt helemaal, bezet land 30%. Na een jaar zonder oorlog met de oude eigenaar is land <b>geïntegreerd</b>: 70% mankracht en 75% van de fabrieken. Vliegtuigen hebben fabrieken nodig.</span></p>'
      + '<p>' + ic('schild') + '<span><b>Frontbreedte</b>: per gevecht vechten er maximaal 12 divisies per kant (heuvels en steden 10, bergen en moeras 8). De rest staat in reserve en valt in als de voorste linie breekt.</span></p>'
      + '<p>' + ic('prov') + '<span><b>Aanvoer</b>: elke provincie voedt een beperkt aantal divisies (eigen dorp 9, stad 12, hoofdstad 19; bezet minder; aan het front mag het 60% voller). Te veel = slijtage. Ben je minstens anderhalf keer zo sterk als een vijand overzee, dan mag je in je havens dubbel zoveel verzamelen voor de landing.</span></p>'
      + '<p>' + ic('steun') + '<span><b>Oorlogssteun</b> vermenigvuldigt je limiet. Aangevallen worden geeft steun; zelf aanvallen, steden en divisies verliezen kost steun. Lage steun = sneller opgeven.</span></p>'
      + '<p>' + ic('agr') + '<span><b>Agressie</b>: veroveren maakt buren bang. 3 landen boven de grens = coalitie. Een gerechtvaardigde oorlog geeft de helft.</span></p>'
      + '<p>' + ic('berg') + '<span><b>Terrein</b>: aanvallen in bergen −40%, heuvels −15%, moeras −20%, steden −15%, over een rivier −20 tot −35%. Pantser lijdt extra, maar is in open terrein tot 60% sterker. Artillerie breekt bunkers, steden en heuvels; onder vuur brokkelen ingraven en bunkers af.</span></p>'
      + '<p>' + ic('ster') + '<span><b>Sterren</b>: hoofdstad en wereldsteden 3, grote steden 2, de rest 1. Hoe meer sterren een land kwijt is, hoe voller zijn <b>overgavemeter</b>. Overzees gebied telt voor een vijfde.</span></p>'
      + '<p>' + ic('schild') + '<span><b>Laatste verzet</b>: bij 75% roept een land de noodtoestand uit: milities en steden +25% verdediging. Het einde is het zwaarst.</span></p>'
      + '<p>' + ic('vlag') + '<span><b>Overgave</b>: bij 100% legt het leger de wapens neer. Jij kiest: vredesconferentie (verdeel de buit) of doorvechten tot je alles hebt.</span></p>'
      + '<p>' + ic('vrede') + '<span><b>Onderhandelen</b> kan altijd: een vijand staat af wat zijn meter aangeeft (op 40% houd je 40% van wat je bezet). Na elke vrede volgt een verdrag van een jaar.</span></p>'
      + '<p>' + ic('schild') + '<span><b>Ingraven</b>: stilstaande troepen tot +20% verdediging.</span></p>'
      + '<p>' + ic('prov') + '<span><b>Bevoorrading</b>: afgesneden troepen (oranje) vechten op 65% en slijten.</span></p>'
      + '<p>' + ic('zwaard') + '<span>' + (isTouch ? 'Tik een stapel, tik of sleep naar een doel. Lang vasthouden voegt toe. Dubbel tikken = inzoomen.' : 'Klik een stapel, klik, rechtsklik of sleep naar een doel. Shift+klik voegt toe. Spatie = pauze, 1–4 = snelheid, Esc = selectie wissen, Shift+slepen = kader selecteren.') + '</span></p>'
      + '</div>' + unitTable();
    h += det('how', ic('info') + 'Hoe werkt het?', b, false);
    { const a = achGet(), got = ACH.filter(z => a[z.id]).length;
      const ab = '<div class="achs">' + ACH.map(z => '<div class="arow2' + (a[z.id] ? ' got' : '') + '">' + ic(z.ic) + '<span><b>' + z.t + '</b><small>' + z.d + (a[z.id] ? ' · ' + a[z.id] : '') + '</small></span></div>').join('') + '</div>';
      h += det('ach', ic('ster') + 'Onderscheidingen<span class="sumv">' + got + '/' + ACH.length + '</span>', ab, false); }
    { const sb = '<div class="setrow"><label><input type="checkbox" data-set="sound"' + (SET.sound ? ' checked' : '') + '> Geluidseffecten</label><label><input type="checkbox" data-set="music"' + (SET.music ? ' checked' : '') + '> Muziek</label>'
      + '<label class="vol">' + ic('steun') + '<input type="range" min="0" max="1" step="0.05" value="' + SET.vol + '" data-set="vol" aria-label="Volume"></label>'
      + '<label><input type="checkbox" data-set="cb"' + (SET.cb ? ' checked' : '') + '> Kleurenblind: dikke grenzen en patronen</label></div>';
      h += det('set', ic('bevel') + 'Instellingen', sb, false); }
    h += '<div class="foot"><button class="btn sm" data-act="focus">' + ic('prov') + 'Mijn land</button><button class="btn sm" data-act="intro">' + ic('info') + 'Snelstart</button><button class="btn sm" data-act="export" title="Bewaar dit spel als bestand, om het op een ander apparaat of na het wissen van je browsergegevens weer te laden">Bewaar als bestand</button>'
      + (UI.confirm === 'new' ? '<button class="btn sm war" data-act="new">Bevestig nieuw spel</button>' : '<button class="btn sm" data-act="new">' + ic('vlag') + 'Nieuw spel</button>') + '</div>';
  }
  if(h === sheetSig || sheetPress) return;
  sheetSig = h;
  const st = el.scrollTop;
  el.innerHTML = h; el.hidden = false; el.scrollTop = st;
}
$('sheet').addEventListener('pointerdown', () => { sheetPress = true; });
$('sheet').addEventListener('change', e => {
  const i = e.target.closest('[data-set]'); if(!i) return;
  const k = i.dataset.set;
  if(k === 'sound'){ setSound(i.checked); if(i.checked){ audioInit(); sfx('tap'); } }
  else if(k === 'music'){ audioInit(); setMusic(i.checked); }
  else if(k === 'vol'){ audioInit(); setVol(+i.value); sfx('tap'); }
  else if(k === 'cb'){ SET.cb = i.checked; saveSettings(); allFills(); baseDirty = true; }
  sheetSig = '';
});
$('sheet').addEventListener('click', e => {
  if(e.target.closest('.setrow')) return;   // instellingen: het change-event doet het werk, niet opnieuw renderen
  if(e.target.closest('button')) sfx('tap');
  const me = G && G.player; if(!me) return;
  const n = nat(me);
  const tb = e.target.closest('[data-tab]');
  if(tb){ UI.sheet = tb.dataset.tab || null; UI.target = null; UI.armAct = null; UI.editT = null; sheetSig = ''; sheetPress = false; renderAll(); return; }
  if(e.target.closest('summary')){ setTimeout(() => { UI.od ||= {}; $('sheet').querySelectorAll('details[data-d]').forEach(d => UI.od[d.dataset.d] = d.open); sheetSig = ''; }, 0); return; }
  const ed = e.target.closest('[data-edit]');
  if(ed){ UI.editT = +ed.dataset.edit; sheetSig = ''; sheetPress = false; renderAll(); return; }
  const tbn = e.target.closest('[data-tb]');
  if(tbn && !tbn.disabled && UI.editT != null){
    const [op, k2] = tbn.dataset.tb.split(':'), T = G.tmpl[UI.editT];
    T.comp[k2] = Math.max(0, (T.comp[k2] || 0) + (op === 'add' ? 1 : -1));
    if(!T.comp[k2]) delete T.comp[k2];
    if(!totBat(T.comp)) T.comp.inf = 1;
    T.name = autoName(T.comp); TPC = {};
    const tpk = 'p' + UI.editT, d2 = domOf(T.comp);
    for(const u of G.units) if(u.tp === tpk) u.t = d2;
    qSig = null; sheetSig = ''; sheetPress = false; renderAll(); return;
  }
  const q = e.target.closest('[data-q]'), s = e.target.closest('[data-s]'), ral = e.target.closest('[data-rally]');
  const ng = e.target.closest('[data-neg]'), dl = e.target.closest('[data-deal]'), au = e.target.closest('[data-auto]'), act = e.target.closest('[data-act]');
  if(ral){ G.rally = ral.dataset.rally; }
  else if(q && !q.disabled){ n.q.push({k:q.dataset.q, p:0}); qSig = null; }
  else if(s && !s.disabled){
    const k = s.dataset.s;
    if(k === 'blitz' || k === 'mobil'){
      if(UI.armAct === k){ UI.armAct = null; doSpecial(me, k, null); }   // twee keer tikken: geen kostbare misklikken
      else UI.armAct = k;
    }
    else { UI.armAct = null; UI.target = k; UI.sheet = null; clearSel(); UI.info = null; }
  }
  else if(ng){ UI.neg = UI.neg === ng.dataset.neg ? null : ng.dataset.neg; }
  else if(dl && !dl.disabled){
    const [kind, e2] = dl.dataset.deal.split(':');
    if(!playerDeal(e2, kind)) toast(cname(e2) + ' weigert', 'war'); else UI.neg = null;
  }
  else if(au){ n.auto = !n.auto; if(n.auto) for(const u of G.units) if(u.c === me){ u.man = false; u.g = null; } }
  else if(e.target.closest('[data-gen]')){
    const [k, v] = e.target.closest('[data-gen]').dataset.gen.split(':'), g = genCfg();
    if(k === 'mode') g.mode = v; else if(k === 'focus') g.focus = v || null; else if(k === 'prep') g.prep = v || null; else if(k === 'own') g[v] = !g[v];
  }
  else if(act){
    if(act.dataset.act === 'focus'){ fitCountry(me); }
    else if(act.dataset.act === 'intro'){ UI.intro = 1; UI.sheet = null; G.paused = true; stripSig = null; }
    else if(act.dataset.act === 'export'){ exportGame(); }
    else if(act.dataset.act === 'endcard'){ UI.winShown = true; G.paused = true; UI.sheet = null; }
    else if(act.dataset.act === 'tdone'){ UI.editT = null; }
    else if(act.dataset.act === 'new'){ if(UI.confirm === 'new'){ UI.confirm = null; toPick(); return; } UI.confirm = 'new'; }
  }
  sheetSig = ''; sheetPress = false; renderAll();
});

function renderAll(){ renderBar(); renderStrip(); renderSheet(); renderEnd(); renderCard(); overC.classList.toggle('targeting', !!UI.target); overDirty = true; }
/* ---- beslissingskaart: overgave, vredesconferentie, voorstellen van de vijand ---- */
let cardSig = '';
function renderCard(){
  const el = $('card');
  if(!G || G.over || !cardOpen()){
    if(!el.hidden){ el.hidden = true; cardSig = ''; UI.conf = null; overDirty = true; }
    if(G && G.cardPause && !cardOpen()){ G.cardPause = false; G.paused = false; }
    return;
  }
  const cd = G.cards[0], me = G.player, e = cd.e;
  if(e && (!alive(e) || !atWar(me, e))){ G.cards.shift(); UI.conf = null; cardSig = ''; renderCard(); return; }
  if(cd.k === 'conf' && !UI.conf) UI.conf = confInit(e);
  const head = (icon, t, sub, cls) => '<div class="chead"><span class="eico ' + (cls || '') + '">' + ic(icon) + '</span><span class="ct"><b>' + t + '</b><small>' + sub + '</small></span></div>';
  const opt = (k, icon, t, sub, cls) => '<button class="copt ' + (cls || '') + '" data-c="' + k + '">' + ic(icon) + '<span><b>' + t + '</b><small>' + sub + '</small></span></button>';
  const nm = e ? esc(cname(e)) : '';
  let h = '';
  if(cd.k === 'surr'){
    const occ = occBy(me, e), kills = (G.kill || {})[me + '>' + e] || 0;
    h = head('vlag', nm + ' biedt overgave aan', 'Het leger legt de wapens neer · ' + fmtDate(G.day), 'win')
      + '<div class="crows"><div>' + ic('prov') + '<span>Jij bezet</span><b>' + occ.length + ' prov · ' + starSum(occ) + starsH(1) + '</b></div>'
      + '<div>' + ic('dood') + '<span>Divisies vernietigd</span><b>' + kills + '</b></div>'
      + '<div>' + ic('vlag') + '<span>Nog in hun handen</span><b>' + owned(e).length + ' prov</b></div></div>'
      + '<div class="copts">' + opt('conf', 'vrede', 'Vredesconferentie', 'Oorlog voorbij: verdeel de buit', 'pri') + opt('fight', 'oorlog', 'Doorvechten', 'Neem alles in. Kost meer agressie', 'war') + '</div>';
  } else if(cd.k === 'conf'){
    const c = UI.conf, used = confUsed(c), ae = aePreview(e, [...c.sel], c.dem ? 2 : 0), thr = COAL_THR();
    h = head('vrede', 'Vredesconferentie', nm + ' · kies je eisen', 'win')
      + '<div class="pts"><span>Oorlogspunten<small>bezette sterren + vernietigde divisies</small></span><b>' + used + ' / ' + c.pts + '</b></div>' + meter(used, c.pts, used > c.pts ? 'hot' : '')
      + '<div class="seg3">' + [['alles', 'Alles', 'Houd alles wat je bezet'], ['grens', 'Grens + herstel', 'Alleen provincies aan je grens, plus herstelbetaling: minder agressie'], ['veilig', 'Veilig', 'Geen land, wel herstelbetaling en ontwapening: bijna geen agressie']].map(([k, l, t]) => '<button class="btn sm' + (c.preset === k ? ' pri' : '') + '" data-cp="' + k + '" title="' + t + '">' + l + '</button>').join('') + '</div>'
      + '<div class="sub2">Provincies<small>tik om te kiezen · kost hun sterren</small></div>'
      + '<div class="pchips">' + (c.occ.length ? c.occ.slice().sort((x, y) => starOf(y) - starOf(x)).map(p => '<button class="pchip' + (c.sel.has(p) ? ' on' : '') + '" data-cpp="' + p + '">' + esc(P[p].n) + starsH(starOf(p)) + '</button>').join('') : '<span class="mut">Je bezet niets van hun land</span>') + '</div>'
      + '<button class="pchip wide' + (c.rep ? ' on' : '') + '" data-cx="rep">' + ic('fab') + 'Herstelbetaling: +' + NF.format(repAmount(e)) + ' fabrieken<i>' + REP_COST + '</i></button>'
      + '<button class="pchip wide' + (c.dem ? ' on' : '') + '" data-cx="dem">' + ic('schild') + 'Ontwapenen: hun leger −50%, 3 jaar<i>' + DEM_COST + '</i></button>'
      + '<div class="aeline' + (ae.top >= thr ? ' hot' : '') + '">' + ic('agr') + '<span>Agressie +' + Math.round(ae.v) + (ae.who ? ' · ' + esc(cname(ae.who)) + ' komt op ' + Math.round(ae.top) + '/' + thr + (ae.top >= thr ? ': coalitiegevaar' : '') : '') + '</span></div>'
      + '<div class="cbtns"><button class="btn sm" data-c="back">Terug</button><button class="btn pri wide" data-c="sign">' + ic('check') + 'Teken vrede</button></div>';
  } else if(cd.k === 'mysurr'){
    h = head('vlag', 'Je land staat op instorten', 'Overgave ' + pct(meterOf(me)) + '% · ' + fmtDate(G.day), 'lose')
      + '<div class="copts">' + opt('yes', 'vlag', 'Capituleer', 'De vijand houdt wat hij bezet, je leger halveert, een jaar verdrag', 'war')
      + opt('no', 'schild', 'Vecht door', 'Tot de laatste provincie. Over 60 dagen komt deze keuze terug') + '</div>';
  } else if(cd.k === 'offer'){
    const give = cd.give.filter(p => G.ctrl[p] === me), ae = aePreview(e, give);
    h = head('vrede', nm + ' biedt vrede aan', 'Ze staan dit af, de rest gaat terug naar de oude grens', 'win')
      + pchipsH(give) + '<div class="aeline">' + ic('agr') + '<span>Agressie +' + Math.round(ae.v) + '</span></div>'
      + '<div class="copts">' + opt('yes', 'check', 'Accepteer', 'Vrede en een jaar verdrag', 'pri') + opt('no', 'oorlog', 'Vecht door', 'Wie weet krijg je straks meer') + '</div>';
  } else if(cd.k === 'demand'){
    const take = cd.take.filter(p => G.ctrl[p] === e);
    h = head('agr', nm + ' eist vrede', 'Ze willen houden wat ze bezetten', 'lose')
      + pchipsH(take)
      + '<div class="copts">' + opt('yes', 'vrede', 'Accepteer', 'Je staat dit af, de rest krijg je terug', 'war') + opt('no', 'schild', 'Vecht door', 'Weiger en vecht verder') + '</div>';
  } else if(cd.k === 'arm'){
    const k2 = wk(me, e), quiet = G.day - Math.max(G.wars[k2] ?? G.day, (G.wlast || {})[k2] || 0);
    h = head('wit', 'Wapenstilstand met ' + nm + '?', 'Het front ligt al ' + quiet + (quiet === 1 ? ' dag' : ' dagen') + ' stil', '')
      + '<div class="crows"><div>' + ic('prov') + '<span>Jij houdt</span><b>' + occBy(me, e).length + ' prov</b></div><div>' + ic('prov') + '<span>Zij houden</span><b>' + occBy(e, me).length + ' prov</b></div></div>'
      + '<div class="copts">' + opt('yes', 'check', 'Accepteer', 'Iedereen houdt wat hij nu heeft', 'pri') + opt('no', 'oorlog', 'Vecht door', 'De oorlog gaat verder') + '</div>';
  }
  if(G.cards.length > 1) h += '<div class="cmore">Nog ' + (G.cards.length - 1) + (G.cards.length > 2 ? ' beslissingen' : ' beslissing') + '</div>';
  if(h === cardSig) return;
  cardSig = h; el.className = 'glass k-' + cd.k; el.innerHTML = h; el.hidden = false;
}
$('card').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b || !G || !cardOpen()) return;
  sfx('tap');
  const c = UI.conf;
  if(b.dataset.c) resolveCard(b.dataset.c);
  else if(c && b.dataset.cp) confPreset(c, b.dataset.cp);
  else if(c && b.dataset.cpp){
    const p = b.dataset.cpp;
    if(c.sel.has(p)) c.sel.delete(p);
    else { c.sel.add(p); if(confUsed(c) > c.pts){ c.sel.delete(p); toast('Te weinig oorlogspunten', 'war', 'pts'); } }
    c.preset = null;
  }
  else if(c && b.dataset.cx){ const k = b.dataset.cx; c[k] = !c[k]; if(confUsed(c) > c.pts){ c[k] = false; toast('Te weinig oorlogspunten', 'war', 'pts'); } c.preset = null; }
  cardSig = ''; stripSig = null; sheetSig = ''; renderAll();
});
/* ---- eindkaart: overwinning, capitulatie of 1946 ---- */
let endSig = '';
function renderEnd(){
  const el = $('endcard');
  $('hero').hidden = !(DATA && !G && !UI.pick && !UI.loading && !UI.err);
  const show = G && (G.over || (G.won && UI.winShown));
  if(!show){ if(!el.hidden) el.hidden = true; endSig = ''; return; }
  const sc = score(), rk = rankOf(sc), best = bestOf(MAPNAME, G.player);
  const sh = Math.round(100*owned(G.player).length/PIDS.length);
  const done = G.obj.filter(o => o.done).length;
  const win = G.won && !G.over;
  const title = win ? 'Overwinning' : 'Capitulatie';
  const sub = win ? 'Je beheerst ' + winTxt() + ' van de kaart' : esc(cname(G.player)) + ' geeft zich over · ' + fmtDate(G.day);
  const h = '<span class="eico">' + ic(win ? 'medaille' : 'dood') + '</span>'
    + '<span class="et">' + title + '</span><span class="esub">' + sub + '</span>'
    + '<span class="escore">' + sc + '<small>' + rk + (best > 0 && sc >= best ? ' · record' : best ? ' · record ' + best : '') + '</small></span>'
    + '<div class="erows">'
    + '<div>' + ic('prov') + '<span>Gebied</span><b>' + sh + '%</b></div>'
    + '<div>' + ic('doel') + '<span>Doelen behaald</span><b>' + done + '/' + G.obj.length + '</b></div>'
    + '<div>' + ic('vlag') + '<span>Landen verslagen</span><b>' + G.stats.caps + '</b></div>'
    + '<div>' + ic('dood') + '<span>Divisies verloren</span><b>' + G.stats.lost + '</b></div>'
    + ((G.newAch || []).length ? '<div>' + ic('ster') + '<span>Onderscheiding: ' + G.newAch.map(id => (ACH.find(z => z.id === id) || {}).t).filter(Boolean).join(', ') + '</span></div>' : '')
    + '</div><div class="ebtns">'
    + (win ? '<button class="btn" data-e="cont">Doorspelen</button>' : '<button class="btn" data-e="again">' + ic('leger') + 'Opnieuw met ' + esc(cname(G.player)) + '</button>')
    + '<button class="btn pri" data-e="new">' + ic('vlag') + 'Nieuw spel</button></div>'
    + '<button class="btn sm ghost" data-e="share" title="Deel je score">' + ic('steun') + 'Deel je score</button>';
  if(h === endSig) return;
  endSig = h; el.className = 'glass ' + (win ? 'win' : 'lose'); el.innerHTML = h; el.hidden = false;
}
$('endcard').addEventListener('click', e => {
  const b = e.target.closest('[data-e]'); if(!b) return;
  if(b.dataset.e === 'new'){ toPick(); }
  else if(b.dataset.e === 'share'){
    const txt = 'Vesting Europa: ' + score() + ' punten (' + rankOf(score()) + ') met ' + cname(G.player) + ' op ' + DIFF[G.diff].name + (G.opt && (G.opt.help || G.opt.ai) ? ' (eigen spel)' : '') + (G.won ? ' — overwinning!' : '') + (G.daily ? ' · uitdaging van ' + G.daily : '') + ' · ' + location.href.split('#')[0];
    if(navigator.share){ navigator.share({title:'Vesting Europa', text:txt}).catch(() => {}); }
    else if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(() => toast('Score gekopieerd naar het klembord', 'good')).catch(() => toast(txt, '')); }
    else toast(txt, '');
    return;
  }
  else if(b.dataset.e === 'again'){ const c = G.player, d = G.diff, o = G.opt; clearToasts(); newGame(c, d, o); onGameLoaded(true); }
  else { UI.winShown = false; G.paused = false; }
  renderAll();
});
