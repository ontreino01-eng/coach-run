// CoachEndurance — Service Worker
// Cacheia o app shell pra abrir instantâneo e funcionar offline
// (o treino do dia continua acessível sem internet; ações que
// precisam do backend — login, IA, sync — pedem conexão).
const CACHE = 'coachendurance-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Nunca cachear chamadas de API/Supabase/Groq — sempre buscar fresco.
  if (e.request.url.includes('/functions/') || e.request.url.includes('supabase.co') || e.request.url.includes('groq.com')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const resClone = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, resClone));
      return res;
    }).catch(() => cached))
  );
});
