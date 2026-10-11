const CACHE_NAME = 'bellnexa-app-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/bellnexa-logo.png',
  '/pwa-192.png',
  '/pwa-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const pageResponse = await fetch('/');
    if (!pageResponse.ok) {
      throw new Error(`App shell request failed with status ${pageResponse.status}`);
    }

    const html = await pageResponse.clone().text();
    const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)]
      .map((match) => match[1]);

    await cache.put('/', pageResponse);
    await cache.addAll([...APP_SHELL.slice(1), ...new Set(assetPaths)]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('bellnexa-app-shell-') && name !== CACHE_NAME)
        .map(name => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
        }
        return response;
      } catch {
        const cachedPage = await caches.match('/');
        if (cachedPage) return cachedPage;
        throw new Error('BellNexa app shell is not available offline yet.');
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/pwa-') ||
      url.pathname === '/bellnexa-logo.png' || url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(url.href, { ignoreVary: true });
      if (cachedResponse) return cachedResponse;

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
