/**
 * Standalone shim for src/utility/loadBackend.
 *
 * The standalone player never loads the .NET WASM backend — it receives
 * pre-compiled bytecode.  This module satisfies Runner.tsx's imports without
 * triggering any network requests or side-effects.
 */

export type BackendStatus = 'loading' | 'ready' | 'error';

export interface LoadProgress {
  downloadedBytes: number;
  totalBytes: number;
  filesLoaded: number;
  totalFiles: number;
}

export function getBackendStatus(): BackendStatus {
  return 'ready';
}

export function getBackendError(): Error | null {
  return null;
}

export function onBackendStatusChange(
  listener: (status: BackendStatus, error?: Error) => void,
): () => void {
  // Immediately report ready, then return an unsubscribe no-op.
  listener('ready');
  return () => {};
}

export function onProgressChange(
  _listener: (progress: LoadProgress) => void,
): () => void {
  return () => {};
}

export async function retryBackendLoad(): Promise<void> {
  // Nothing to retry.
}

export const backendPromise: Promise<void> = Promise.resolve();
