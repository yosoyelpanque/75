const CACHE_NAME = 'inventario-pro-v8-cache';

// Lista de archivos requeridos para que la app funcione sin internet
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './css/styles.css',
  
  // Módulos JS (Los crearemos a continuación)
  './js/app.js',
  './js/state.js',
  './js/db.js',
  './js/utils.js',
  './js/ui.js',
  './js/inventory.js',
  './js/reports.js',
  './js/layout.js',

  // Librerías Externas (Deben estar en la carpeta /libs)
  './libs/xlsx.full.min.js',
  './libs/qrcode.min.js',
  './libs/html5-qrcode.min.js',
  './libs/jszip.min.js',
  './libs/interact.min.js'
  // Nota: Tailwind no se incluye aquí porque se usa vía CDN en el HTML
  // o deberías descargar el script de tailwind y ponerlo en libs si quieres offline total.
];

// 1. Instalación: Guardar archivos en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando archivos...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Activación: Limpiar cachés viejas si actualizas la versión
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// 3. Fetch: Servir desde caché o buscar en la red
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si está en caché, lo devuelve
      if (response) {
        return response;
      }
      // Si no, lo busca en internet
      return fetch(event.request).catch(() => {
        // Si falla internet y no está en caché (opcional: página de error)
        // Por ahora no hacemos nada, fallará el navegador.
      });
    })
  );
});