
window.addEventListener('load', async function () {

    const playground = await import("./playground");
    await playground.load();
    
    // Hide the loading element
    global.document.getElementById("loader").classList.add("d-none");

    // Show the app element
    global.document.getElementById("app").classList.remove("d-none");

    playground.show();

});
