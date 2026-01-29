import backend from "backend";

export type BackendStatus = 'loading' | 'ready' | 'error';

export interface LoadProgress {
    downloadedBytes: number;
    totalBytes: number;
    filesLoaded: number;
    totalFiles: number;
}

// Track backend loading state
let backendStatus: BackendStatus = 'loading';
let backendError: Error | null = null;
let loadProgress: LoadProgress = { downloadedBytes: 0, totalBytes: 0, filesLoaded: 0, totalFiles: 0 };

const statusListeners: Array<(status: BackendStatus, error?: Error) => void> = [];
const progressListeners: Array<(progress: LoadProgress) => void> = [];

export function getBackendStatus(): BackendStatus {
    return backendStatus;
}

export function getBackendError(): Error | null {
    return backendError;
}

export function getLoadProgress(): LoadProgress {
    return loadProgress;
}

export function onBackendStatusChange(listener: (status: BackendStatus, error?: Error) => void) {
    statusListeners.push(listener);
    // Immediately call with current status
    listener(backendStatus, backendError ?? undefined);

    return () => {
        const index = statusListeners.indexOf(listener);
        if (index > -1) {
            statusListeners.splice(index, 1);
        }
    };
}

export function onProgressChange(listener: (progress: LoadProgress) => void) {
    progressListeners.push(listener);
    // Immediately call with current progress
    listener(loadProgress);

    return () => {
        const index = progressListeners.indexOf(listener);
        if (index > -1) {
            progressListeners.splice(index, 1);
        }
    };
}

function notifyStatusChange(status: BackendStatus, error?: Error) {
    backendStatus = status;
    backendError = error ?? null;
    statusListeners.forEach(listener => listener(status, error));
}

function notifyProgressChange(progress: LoadProgress) {
    loadProgress = progress;
    progressListeners.forEach(listener => listener(progress));
}

// Known WASM files and their decompressed sizes (from public/backend)
// Browser decompresses Brotli automatically, so we track decompressed sizes
const KNOWN_FILES: Record<string, number> = {
    'Antlr4.Runtime.Standard.wasm': 102677,
    'Backend.Compiler.wasm': 22805,
    'Backend.WASM.wasm': 97045,
    'Bootsharp.Common.wasm': 10005,
    'Bootsharp.Inject.wasm': 5909,
    'dotnet.native.wasm': 11191078,
    'Google.Protobuf.wasm': 283413,
    'Microsoft.Extensions.DependencyInjection.Abstractions.wasm': 13077,
    'Microsoft.Extensions.DependencyInjection.wasm': 41237,
    'System.Collections.Concurrent.wasm': 20245,
    'System.Collections.wasm': 14613,
    'System.ComponentModel.wasm': 4373,
    'System.Console.wasm': 13589,
    'System.IO.Pipelines.wasm': 5397,
    'System.Linq.wasm': 49429,
    'System.Memory.wasm': 13589,
    'System.Private.CoreLib.wasm': 1261845,
    'System.Runtime.InteropServices.JavaScript.wasm': 38165,
    'System.Text.Encodings.Web.wasm': 27925,
    'System.Text.Json.wasm': 223509,
    'System.Text.RegularExpressions.wasm': 229653,
    'YarnSpinner.Compiler.wasm': 284437,
    'YarnSpinner.wasm': 106261,
};

// Calculate total expected bytes
const TOTAL_EXPECTED_BYTES = Object.values(KNOWN_FILES).reduce((a, b) => a + b, 0);
const TOTAL_FILES = Object.keys(KNOWN_FILES).length;

// Start booting the backend immediately, and create a promise that we can await
// when we eventually need to use the backend
async function loadDotNet(retryCount = 0): Promise<void> {
    const MAX_RETRIES = 2;

    if (backend.getStatus() != backend.BootStatus.Booted) {
        console.log("Booting dotnet...");
        notifyStatusChange('loading');

        // Track progress
        let downloadedBytes = 0;
        let filesLoaded = 0;
        const trackedUrls = new Set<string>();

        // Initialize progress
        notifyProgressChange({
            downloadedBytes: 0,
            totalBytes: TOTAL_EXPECTED_BYTES,
            filesLoaded: 0,
            totalFiles: TOTAL_FILES
        });

        // Intercept fetch to track progress with streaming
        const originalFetch = window.fetch;
        window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const response = await originalFetch.call(window, input, init);

            // Check if this is a WASM file from our backend
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (url.includes('/backend/') && url.endsWith('.wasm') && !trackedUrls.has(url)) {
                trackedUrls.add(url);

                const fileName = url.split('/').pop() || '';
                const expectedSize = KNOWN_FILES[fileName] || 0;

                // If we can stream, track progress incrementally
                if (response.body) {
                    const reader = response.body.getReader();
                    let fileBytes = 0;

                    // Create a new ReadableStream that tracks progress
                    const trackedStream = new ReadableStream({
                        async start(controller) {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) {
                                    filesLoaded++;
                                    notifyProgressChange({
                                        downloadedBytes,
                                        totalBytes: Math.max(TOTAL_EXPECTED_BYTES, downloadedBytes),
                                        filesLoaded,
                                        totalFiles: TOTAL_FILES
                                    });
                                    console.log(`Loaded ${fileName}: ${(fileBytes / 1024).toFixed(0)} KB (${filesLoaded}/${TOTAL_FILES})`);
                                    controller.close();
                                    break;
                                }

                                // Track progress
                                fileBytes += value.byteLength;
                                downloadedBytes += value.byteLength;

                                notifyProgressChange({
                                    downloadedBytes,
                                    totalBytes: Math.max(TOTAL_EXPECTED_BYTES, downloadedBytes),
                                    filesLoaded,
                                    totalFiles: TOTAL_FILES
                                });

                                controller.enqueue(value);
                            }
                        }
                    });

                    // Return new response with tracked stream
                    return new Response(trackedStream, {
                        headers: response.headers,
                        status: response.status,
                        statusText: response.statusText
                    });
                }
            }

            return response;
        };

        try {
            // Add timeout to detect if Safari hangs (5 minutes to accommodate slow connections)
            const bootPromise = backend.boot({ root: "/backend" });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Backend boot timeout after 5 minutes")), 300000)
            );

            await Promise.race([bootPromise, timeoutPromise]);
            console.log(".NET booted.");
            notifyStatusChange('ready');
        } catch (error) {
            const err = error as Error;

            // Safari sometimes fails with "Load failed" - retry automatically
            const isRetryableError = err.message === "Load failed" ||
                                     err.message.includes("Load failed") ||
                                     err.message.includes("NetworkError");

            if (isRetryableError && retryCount < MAX_RETRIES) {
                console.warn(`Backend load failed, retrying (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                return loadDotNet(retryCount + 1);
            }

            console.error("Failed to boot .NET runtime:", error);
            console.error("Error details:", {
                message: err.message,
                stack: err.stack,
                browser: navigator.userAgent
            });
            notifyStatusChange('error', err);
            throw error;
        } finally {
            // Restore original fetch
            window.fetch = originalFetch;
        }
    } else {
        notifyStatusChange('ready');
    }
}

// Allow manual retry
export async function retryBackendLoad() {
    console.log("Retrying backend load...");
    backendError = null;
    loadProgress = { downloadedBytes: 0, totalBytes: 0, filesLoaded: 0, totalFiles: 0 };
    return loadDotNet();
}

// Start loading, but catch errors silently since they're handled through status system
export const backendPromise = loadDotNet().catch(err => {
    // Error is already logged and status updated in loadDotNet
    // Just prevent unhandled rejection by catching here
    console.log("Backend loading failed, handled through status system");
});
