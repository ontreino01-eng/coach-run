// CoachEndurance — Service Worker
// v2: HTML/JS sempre busca a versão mais nova da rede primeiro (network-first) —
// só usa o cache salvo se estiver sem internet. Isso evita o app "travar" numa
// versão antiga depois de uma atualização. Ícones/manifest usam cache-first
// (mudam raramente, não precisam buscar toda vez).
const CACHE = 'coachendurance-v2';
const APP_SHELL = ['./', './index.html', './manifest.json'];

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
  const url = e.request.url;
  if (url.includes('/functions/') || url.includes('supabase.co') || url.includes('groq.com')) {
    return;
  }

  const isHTML = e.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/');

  if (isHTML) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, resClone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, resClone));
        return res;
      }).catch(() => cached))
    );
  }
});
