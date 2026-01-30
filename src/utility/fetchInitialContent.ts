import { fetchGist } from "./fetchGist";
import { scriptKey } from "../config.json";
import defaultInitialContent from "../DefaultContent.yarn?raw";

export type ContentSource = 'gist' | 'localStorage' | 'default';

export interface InitialContentResult {
  content: string;
  source: ContentSource;
}

export async function fetchInitialContent(): Promise<InitialContentResult> {
  const location = window.location.href;
  const url = new URL(location);

  const gistID = url.searchParams.get("gist");
  if (gistID !== null) {
    try {
      console.log(`Loading from Gist ${gistID}`);
      const content = await fetchGist(gistID);
      console.log(`Got content from Gist.`);
      return { content, source: 'gist' };
    } catch {
      console.warn(`Failed to load from gist. Loading default content.`);
      return { content: defaultInitialContent, source: 'default' };
    }
  } else {
    const savedScript = window.localStorage.getItem(scriptKey);
    if (savedScript !== null && savedScript.trim().length > 0) {
      console.log(`Loading initial content from local storage.`);
      return { content: savedScript, source: 'localStorage' };
    }

    console.log(`Loading default content`);
    return { content: defaultInitialContent, source: 'default' };
  }
}
