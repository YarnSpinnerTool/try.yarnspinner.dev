const CACHE_NAME = 'yarn-spinner-wasm-v2';
const WASM_CACHE_NAME = 'yarn-spinner-wasm-files-v2';

// Files that should be cached
const WASM_FILES = [
  '/backend/dotnet.native.wasm',
  '/backend/dotnet.native.wasm.br',
  '/backend/Antlr4.Runtime.Standard.wasm',
  '/backend/Antlr4.Runtime.Standard.wasm.br',
  '/backend/Backend.Compiler.wasm',
  '/backend/Backend.Compiler.wasm.br',
  '/backend/Backend.WASM.wasm',
  '/backend/Backend.WASM.wasm.br',
  '/backend/Bootsharp.Common.wasm',
  '/backend/Bootsharp.Common.wasm.br',
  '/backend/Bootsharp.Inject.wasm',
  '/backend/Bootsharp.Inject.wasm.br',
  '/backend/Google.Protobuf.wasm',
  '/backend/Google.Protobuf.wasm.br',
  '/backend/Microsoft.Extensions.DependencyInjection.wasm',
  '/backend/Microsoft.Extensions.DependencyInjection.wasm.br',
  '/backend/Microsoft.Extensions.DependencyInjection.Abstractions.wasm',
  '/backend/Microsoft.Extensions.DependencyInjection.Abstractions.wasm.br',
  '/backend/System.Collections.Concurrent.wasm',
  '/backend/System.Collections.Concurrent.wasm.br',
  '/backend/System.Collections.wasm',
  '/backend/System.Collections.wasm.br',
  '/backend/System.ComponentModel.wasm',
  '/backend/System.ComponentModel.wasm.br',
  '/backend/System.Console.wasm',
  '/backend/System.Console.wasm.br',
  '/backend/System.IO.Pipelines.wasm',
  '/backend/System.IO.Pipelines.wasm.br',
  '/backend/System.Linq.wasm',
  '/backend/System.Linq.wasm.br',
  '/backend/System.Memory.wasm',
  '/backend/System.Memory.wasm.br',
  '/backend/System.Private.CoreLib.wasm',
  '/backend/System.Private.CoreLib.wasm.br',
  '/backend/System.Runtime.InteropServices.JavaScript.wasm',
  '/backend/System.Runtime.InteropServices.JavaScript.wasm.br',
  '/backend/System.Text.Encodings.Web.wasm',
  '/backend/System.Text.Encodings.Web.wasm.br',
  '/backend/System.Text.Json.wasm',
  '/backend/System.Text.Json.wasm.br',
  '/backend/System.Text.RegularExpressions.wasm',
  '/backend/System.Text.RegularExpressions.wasm.br',
  '/backend/YarnSpinner.Compiler.wasm',
  '/backend/YarnSpinner.Compiler.wasm.br',
  '/backend/YarnSpinner.wasm',
  '/backend/YarnSpinner.wasm.br',
  '/backend/dotnet.js'
];

// Install event - cache WASM files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(WASM_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching WASM files');
      // Don't fail installation if some files are missing
      return Promise.allSettled(
        WASM_FILES.map(url =>
          cache.add(url).catch(err => {
            console.log(`[Service Worker] Failed to cache ${url}:`, err);
          })
        )
      );
    }).then(() => {
      console.log('[Service Worker] Installed successfully');
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== WASM_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activated successfully');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache for WASM files, network for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Check if this is a WASM/backend file
  const isWasmFile = url.pathname.startsWith('/backend/');

  if (isWasmFile) {
    // Cache-first strategy for WASM files
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[Service Worker] Serving from cache:', url.pathname);
          return cachedResponse;
        }

        // Not in cache, fetch from network and cache it
        return fetch(event.request).then((response) => {
          // Only cache successful responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(WASM_CACHE_NAME).then((cache) => {
              console.log('[Service Worker] Caching new file:', url.pathname);
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        }).catch(err => {
          console.error('[Service Worker] Fetch failed for:', url.pathname, err);
          throw err;
        });
      })
    );
  } else {
    // Network-first strategy for everything else
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});
