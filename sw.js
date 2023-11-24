const CACHE_NAME = 'ticket-printer';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'css/style.css',
  'js/main.js',
  'lib/BrowserPrint-3.1.250.min.js',
  'lib/BrowserPrint-Zebra-1.1.250.min.js',
  'lib/pdf-lib.js',
  'lib/pdf.js',
  'lib/pdfWorker.js',
  'images/iconoRecargar.png',
  'images/maskable_icon_x48.png',
  'images/maskable_icon_x72.png',
  'images/maskable_icon_x96.png',
  'images/maskable_icon_x128.png',
  'images/maskable_icon_x192.png',
  'images/maskable_icon_x384.png',
  'images/maskable_icon_x512.png',
];

self.addEventListener("install", (event) => {
  const cacheStatic = caches
    .open(CACHE_NAME)
    .then((cache) => cache.addAll(urlsToCache));

  event.waitUntil(cacheStatic);
});

self.addEventListener('activate', (event) => {
  clients.claim();
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Borrando caché antigua:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );
});

self.addEventListener('fetch', (event) => {
  
  // URL en la que vive el SW
  let scriptURL = self.location.href;
  // Obtener la URL base eliminando la parte específica del servicio
  let baseURL = scriptURL.split('/').slice(0, -1).join('/');

  if(event.request.method === 'GET'){
    console.log("fetch get!", event.request);
    event.respondWith(
      caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(console.log)
    );
  } else if (event.request.method === 'POST' && event.request.url.includes(baseURL)){
    console.log("fetch post!", event.request);
    event.respondWith(Response.redirect('./'));
    event.waitUntil(async function () {
      const data = await event.request.formData();
      const clientId =
          event.resultingClientId !== ""
            ? event.resultingClientId
            : event.clientId;
      console.log(clientId)
      if (!clientId) return;
      const client = await self.clients.get(clientId);
      if(!client) return
      const file = data.get('file');
      client.postMessage({ file });
    }());
  }
});

/*self.addEventListener('install', () => {
  skipWaiting();
});

self.addEventListener('activate', () => {
  clients.claim();
});


// Intercepta las solicitudes y responde desde la caché si está disponible
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'POST') return;
  
  event.respondWith(Response.redirect('./'));
  
  event.waitUntil(async function () {
    const data = await event.request.formData();
    const clientId =
        event.resultingClientId !== ""
          ? event.resultingClientId
          : event.clientId;
    console.log(clientId)
    if (!clientId) return;
    const client = await self.clients.get(clientId);
    if(!client) return
    const file = data.get('file');
    client.postMessage({ file });
  }());
});*/



/*addEventListener('fetch', (event) => {
  if (event.request.method !== 'POST') return;
  
  event.respondWith(Response.redirect('./'));
  
  event.waitUntil(async function () {
    const data = await event.request.formData();
    const client = await self.clients.get(event.resultingClientId);
    const file = data.get('file');
    client.postMessage({ file });
  }());
});*/