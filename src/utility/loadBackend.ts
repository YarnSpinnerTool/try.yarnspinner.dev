import backend from "backend";

// Start booting the backend immediately, and create a promise that we can await
// when we eventually need to use the backend
async function loadDotNet() {
    if (backend.getStatus() != backend.BootStatus.Booted) {
        console.log("Booting dotnet...");
        await backend.boot({ root: "/backend" });
    }
}

export const backendPromise = loadDotNet();