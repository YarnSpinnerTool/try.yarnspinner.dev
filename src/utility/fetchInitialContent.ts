import { fetchGist } from "./fetchGist";
import { scriptKey } from "../config.json";
import defaultInitialContent from "../DefaultContent.yarn?raw";

export async function fetchInitialContent() {
  const location = window.location.href;
  const url = new URL(location);

  const gistID = url.searchParams.get("gist");
  if (gistID !== null) {
    try {
      console.log(`Loading from Gist ${gistID}`);
      const content = await fetchGist(gistID);
      console.log(`Got content from Gist.`);
      return content;
    } catch {
      console.warn(`Failed to load from gist. Loading default content.`);
      return defaultInitialContent;
    }
  } else {
    const localStorage = window.localStorage.getItem(scriptKey);
    if (localStorage !== null && localStorage.length > 0) {
      console.log(`Loading initial content from local storage.`);
      return localStorage;
    }

    console.log(`Loading default content`);
    return defaultInitialContent;
  }
}
