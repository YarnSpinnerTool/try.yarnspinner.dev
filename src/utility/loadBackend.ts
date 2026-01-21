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
            await backend.boot({ root: "/backend" });
            console.log(".NET booted.");
            notifyStatusChange('ready');
        } catch (error) {
            const err = error as Error;
            console.error("Failed to boot .NET runtime:", error);
            notifyStatusChange('error', err);
            throw error;
        }
    } else {
        notifyStatusChange('ready');
    }
}

export const backendPromise = loadDotNet();