import  { initialContent } from './starter-content'

window.addEventListener('load', async function () {

    // First, determine what content we want to load. If the url contains a
    // hash, and that hash matches a key inside the initialContent data, then we
    // want to laod that content.
    let location = window.location.href;
    let url = new URL(location);
    let hashComponents = url.hash.replace(/^#/, "").split('/')

    let contentName : string | undefined
    
    if (url.hash.length > 0 && initialContent[hashComponents[0]]) {
        contentName = hashComponents[0]
    }
    
    // Wait for the playground module to finish being downloaded, and then
    // import it. Once that's done, load the playground with the content that we
    // selected.
    const playground = await import("./playground");
    await playground.load(contentName);

    // Hide the loading element, which is visible before any script runs.
    global.document.getElementById("loader").classList.add("d-none");

    // Show the app element
    global.document.getElementById("app").classList.remove("d-none");

    // Now that the elements are visible, tell the playground that it's ready to
    // be displayed.
    playground.show();

});
