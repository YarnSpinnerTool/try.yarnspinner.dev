import { scriptStorageKey } from "./constants";
import { fetchGist } from "./gist";
import { initialContent } from "./starter-content";

// Hide the PDF button if 'pdf' is not part of the query
let params = new URLSearchParams(window.location.search);
if (params.has("pdf")) {
  document.getElementById("button-download-pdf").classList.remove("d-none");
}

window.addEventListener("load", async function () {
  // First, determine what content we want to load. If the url contains a
  // hash, and that hash matches a key inside the initialContent data, then we
  // want to laod that content.

  let playground: typeof import("./playground");

  const loadPlaygroundPromise = (async () => {
    playground = await import("./playground");
    return playground;
  })();

  const getGistID = (): string | null => {
    let location = window.location.href;
    let url = new URL(location);
    const gistID = url.searchParams.get("gist");
    return gistID;
  };

  const fetchContent = (async (): Promise<string> => {
    let location = window.location.href;
    let url = new URL(location);
    let content: string | undefined;

    const existingScript = window.localStorage.getItem(scriptStorageKey);

    let hashComponents = url.hash.replace(/^#/, "").split("/");

    let contentName: string | undefined;

    if (url.hash.length > 0 && initialContent[hashComponents[0]]) {
      contentName = hashComponents[0];
    }

    const gistID = getGistID();

    if (gistID !== null) {
      try {
        console.log(`Loading from Gist ${gistID}`);
        return fetchGist(gistID);
      } catch {
        console.warn(`Failed to load from gist. Loading default content.`);
        const playground = await loadPlaygroundPromise;
        return playground.getInitialContent(undefined);
      }
    } else if (contentName) {
      console.log(`Loading initial content "${contentName}"`);
      const playground = await loadPlaygroundPromise;
      return playground.getInitialContent(contentName);
    } else if (existingScript) {
      console.log(`Loading existing script from storage`);
      return existingScript;
    } else {
      console.log(`Loading default content`);
      const playground = await loadPlaygroundPromise;
      return playground.getInitialContent(undefined);
    }
  })();

  const gist = getGistID();
  const externalOpenButton = this.document.getElementById(
    "external-open-link",
  ) as HTMLAnchorElement;
  if (externalOpenButton) {
    externalOpenButton.href = "https://try.yarnspinner.dev/";
    if (gist) {
      externalOpenButton.href = "https://try.yarnspinner.dev/?gist=" + gist;
    }
  }

  await loadPlaygroundPromise;
  const content = await fetchContent;
  await playground.load(content);

  // Hide the loading element, which is visible before any script runs.
  global.document.getElementById("loader").classList.add("d-none");

  // Show the app element
  global.document.getElementById("app").classList.remove("d-none");

  // Now that the elements are visible, tell the playground that it's ready to
  // be displayed.
  playground.show();
});
