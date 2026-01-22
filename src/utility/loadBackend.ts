import backend from "backend";

export type BackendStatus = 'loading' | 'ready' | 'error';

// Track backend loading state
let backendStatus: BackendStatus = 'loading';
let backendError: Error | null = null;
const statusListeners: Array<(status: BackendStatus, error?: Error) => void> = [];

export function getBackendStatus(): BackendStatus {
    return backendStatus;
}

export function getBackendError(): Error | null {
    return backendError;
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

function notifyStatusChange(status: BackendStatus, error?: Error) {
    backendStatus = status;
    backendError = error ?? null;
    statusListeners.forEach(listener => listener(status, error));
}

// Start booting the backend immediately, and create a promise that we can await
// when we eventually need to use the backend
async function loadDotNet() {
    if (backend.getStatus() != backend.BootStatus.Booted) {
        console.log("Booting dotnet...");
        notifyStatusChange('loading');

        try {
            // Add timeout to detect if Safari hangs
            const bootPromise = backend.boot({ root: "/backend" });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Backend boot timeout after 30s")), 30000)
            );

            await Promise.race([bootPromise, timeoutPromise]);
            console.log(".NET booted.");
            notifyStatusChange('ready');
        } catch (error) {
            const err = error as Error;
            console.error("Failed to boot .NET runtime:", error);
            console.error("Error details:", {
                message: err.message,
                stack: err.stack,
                browser: navigator.userAgent
            });
            notifyStatusChange('error', err);
            throw error;
        }
    } else {
        notifyStatusChange('ready');
    }
}

// Allow manual retry
export async function retryBackendLoad() {
    console.log("Retrying backend load...");
    backendError = null;
    return loadDotNet();
}

export const backendPromise = loadDotNet();