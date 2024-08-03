import  { initialContent } from './starter-content'

const ModeChangedEvent = new Event("yarnspinner-mode-changed");

let updateSelectedMode : (mode:string) => void;

window.addEventListener('DOMContentLoaded', () => {

    // Set up the mode selector so that when a mode toggle is set, the appropriate element is visible
    const selectorElements = document.querySelectorAll(".mode-selector") as NodeListOf<HTMLElement>;

    const selectableElementsMap = new Map<string, HTMLElement>();

    updateSelectedMode = (mode: string) => {
        selectableElementsMap.forEach(v => {
            v.classList.add("d-none");
        });
        
        selectorElements.forEach((e, i) => {
            const selectorMode = e.dataset["modeSelect"];
            const modeElement = document.getElementById("mode-" + mode);

            if (!modeElement) {
                console.error("No element found for mode " + mode);
                return;
            }

            if (selectorMode === mode) {
                e.classList.add("mode-selector-selected");
                modeElement.classList.remove("d-none");
            } else {
                e.classList.remove("mode-selector-selected");
            }
        })

        window.dispatchEvent(ModeChangedEvent);
    }

    selectorElements.forEach(e => {

        const selectorMode = e.dataset["modeSelect"];

        e.addEventListener("click", () => {
            updateSelectedMode(selectorMode);
        })

        const modeElement = document.getElementById("mode-" + selectorMode);

        if (!modeElement) {
            console.error("No element found for mode " + selectorMode);
            return;
        }

        selectableElementsMap.set(selectorMode, modeElement);
    });

    updateSelectedMode("code");

    
});

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
    
    const testButton = document.getElementById("button-test");
    const downloadButton = document.getElementById("button-download-pdf");

    testButton.addEventListener("click", () => {
        updateSelectedMode("test");
    })
    
    await playground.load(contentName, testButton, downloadButton);

    // Hide the loading element, which is visible before any script runs.
    global.document.getElementById("loader").classList.add("d-none");

    // Show the app element
    global.document.getElementById("app").classList.remove("d-none");
    
    // Now that the elements are visible, tell the playground that it's ready to
    // be displayed.
    playground.show();

});
