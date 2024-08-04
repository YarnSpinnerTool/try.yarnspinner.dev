import  { initialContent } from './starter-content'

const ModeChangedEvent = new Event("yarnspinner-mode-changed");

let updateSelectedMode : (mode:string, submode?: string) => void;

window.addEventListener('DOMContentLoaded', () => {

    // Set up the mode selector so that when a mode toggle is set, the appropriate element is visible
    const selectorElements = document.querySelectorAll(".mode-selector") as NodeListOf<HTMLElement>;

    const selectableElementsMap = new Map<string, HTMLElement>();

    updateSelectedMode = (mode: string|undefined, submode?:string) => {
        selectableElementsMap.forEach((v, k) => {
            if (k.startsWith("submode") && submode === undefined) {
                // Only update submode states if we're changing submode
                return;
            }
            v.classList.add("d-none");
        });

        selectorElements.forEach((e, i) => {
            const selectorMode = e.dataset["modeSelect"];
            const selectorSubMode = e.dataset["submodeSelect"];
            const modeElement = selectableElementsMap.get("mode-" + mode);
            const submodeElement = selectableElementsMap.get("submode-" + submode);

            const isCurrentModeAndSubmode = ((mode === undefined || selectorMode === undefined || selectorMode === mode)
                && (submode === undefined || selectorSubMode === undefined || selectorSubMode === submode));

            if (isCurrentModeAndSubmode) {
                e.classList.add("active");
                modeElement?.classList.remove("d-none");
                submodeElement?.classList.remove("d-none");
            } else {
                e.classList.remove("active");
            }
        })

        window.dispatchEvent(ModeChangedEvent);
    }

    selectorElements.forEach(e => {

        const selectorMode = e.dataset["modeSelect"];
        const selectorSubmode = e.dataset["submodeSelect"];

        e.addEventListener("click", () => {
            updateSelectedMode(selectorMode, selectorSubmode);
        })

        const modeElement = document.getElementById("mode-" + selectorMode);
        const submodeElement = document.getElementById("submode-" + selectorSubmode);

        if (modeElement) {
            selectableElementsMap.set("mode-"+selectorMode, modeElement);
        }

        if (submodeElement) {
            selectableElementsMap.set("submode-"+selectorSubmode, submodeElement);
        }
    });

    updateSelectedMode("code", "live");
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
