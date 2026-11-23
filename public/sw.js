const CACHE_NAME = 'sohib-games-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/audio.js',
  '/js/network.js',
  '/js/app.js',
  '/js/games/astro-trail.js',
  '/js/games/draw-guess.js',
  '/js/games/neon-grid.js',
  '/js/games/cosmic-quiz.js',
  '/js/games/memory-matrix.js',
  '/js/games/reaction-duel.js',
  '/js/games/judgment-court.js',
  '/js/games/vibe-meter.js',
  '/js/games/whos-likely.js',
  '/js/games/spy-game.js',
  '/js/games/truth-bluff.js',
  '/js/games/taboo-dash.js',
  '/js/games/truth-dare.js',
  '/js/games/deep-talk.js',
  '/js/games/five-seconds.js',
  '/js/games/would-you-rather.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/socket.io/')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
