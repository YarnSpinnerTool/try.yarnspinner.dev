// Check if WASM files are cached by the service worker
export async function checkWasmCache(): Promise<boolean> {
  if (!('caches' in window)) {
    return false;
  }

  try {
    const cacheName = 'yarn-spinner-wasm-files-v1';
    const cache = await caches.open(cacheName);

    // Check if the main runtime file is cached
    const cachedResponse = await cache.match('/backend/dotnet.native.wasm');
    return cachedResponse !== undefined;
  } catch (error) {
    console.warn('Failed to check cache:', error);
    return false;
  }
}
