// Runtime cache only: never touches IndexedDB or localStorage.
const ROOT=new URL('./',self.location.href);
const CACHE='stockfish-credit-chess-pwa-v14-'+ROOT.pathname;
const ASSETS=['./','index.html','landing.css','desktop.html','tablet.html','tablet.css','animation.js','app.js','credits.js','arena.js','layout.js','core.js','premoves.js','storage.js','engine.js','openings.js','opening-worker.js','style.css','board-layout.css','icon.svg','vendor/chess.js','vendor/stockfish-18-lite-single.js','vendor/stockfish-18-lite-single.wasm'];
ASSETS.push('tablet.webmanifest','icons/tablet-192.png','icons/tablet-512.png','icons/tablet-maskable-192.png','icons/tablet-maskable-512.png');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try {
   const response=await fetch(event.request,{cache:'no-cache'});
   if(response.ok)await cache.put(event.request,response.clone());
   return response;
  }catch {
   const exact=await cache.match(event.request);
   if(exact)return exact;
   // Old installed launch URLs used ?standalone=2. Only HTML navigations
   // may fall back to their canonical page; never serve HTML as JS/WASM.
   if(event.request.mode==='navigate'&&['tablet.html','desktop.html','index.html'].some(name=>url.pathname===ROOT.pathname+name)){
    url.search='';url.hash='';
    return await cache.match(url.href)||Response.error();
   }
   return Response.error();
  }
 })());
});
