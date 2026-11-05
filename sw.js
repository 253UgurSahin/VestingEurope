'use strict';
/* Vesting Europa: service worker. Na één bezoek werkt het spel zonder internet.
   De code (html, js, css, manifest) komt eerst van het net, met de cache als terugval: een nieuwe versie van het spel
   komt dus meteen binnen als je online bent. Kaarten, lettertypes en iconen komen uit de cache.
   Verander CACHE hieronder (het versienummer) als een kaartbestand, lettertype of icoon verandert, dan worden ze opnieuw opgehaald.
   De wereldkaart (zwaar, 8 MB) wordt pas bewaard als je hem een keer hebt gebruikt. */
const CACHE = 'vesting-europa-1';
const CORE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/kaart.js', 'js/regels.js', 'js/oorlog.js', 'js/ai.js', 'js/tekenen.js', 'js/interface.js', 'js/start.js',
  'europe.json', 'europe-hd.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'fonts/barlow-latin-400-normal.woff2', 'fonts/barlow-latin-500-normal.woff2', 'fonts/barlow-latin-600-normal.woff2',
  'fonts/barlow-latin-ext-400-normal.woff2', 'fonts/barlow-latin-ext-500-normal.woff2', 'fonts/barlow-latin-ext-600-normal.woff2',
  'fonts/barlow-condensed-latin-500-normal.woff2', 'fonts/barlow-condensed-latin-600-normal.woff2', 'fonts/barlow-condensed-latin-700-normal.woff2',
  'fonts/barlow-condensed-latin-ext-500-normal.woff2', 'fonts/barlow-condensed-latin-ext-600-normal.woff2', 'fonts/barlow-condensed-latin-ext-700-normal.woff2'
];
const CODE = /\.(html|js|css|webmanifest)$|\/$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('vesting-europa-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(req.mode === 'navigate' || CODE.test(url.pathname) ? networkFirst(req) : cacheFirst(req));
});
async function networkFirst(req){
  const cache = await caches.open(CACHE);
  try{
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(req.url, {signal: ctl.signal, cache: 'no-cache'});   // vraagt de server of het bestand veranderd is (ook als de browsercache het nog 'vers' vindt)
    clearTimeout(timer);
    if(res.ok) cache.put(req, res.clone());
    return res;
  }catch(err){
    return (await cache.match(req, {ignoreSearch: true})) || (await cache.match('index.html')) || Response.error();
  }
}
async function cacheFirst(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res.ok) cache.put(req, res.clone());
  return res;
}
