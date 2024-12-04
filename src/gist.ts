import { z } from "zod";

const GistFileSchema = z.object({
  filename: z.string().default(""),
  content: z.string(),
  truncated: z.boolean().default(false),
});

const GistSchema = z.object({
  files: z.record(GistFileSchema),
});

const fetchAndValidate = async <T extends z.ZodSchema>(
  url: string,
  schema: T,
  request: RequestInit = {},
): Promise<z.output<T>> => {
  const response = await fetch(url, request);
  const data = await response.json();

  if (response.ok === false) {
    if (data && typeof data === "object") {
      throw new Error("Failed to get gist: " + JSON.stringify(data));
    } else {
      throw new Error("Failed to get gist: Unknown error");
    }
  }

  return await schema.parseAsync(data);
};

export const fetchGist = async (gistID: string): Promise<string> => {
  const url = `https://api.github.com/gists/${gistID}`;
  const gistData = await fetchAndValidate(url, GistSchema, {
    method: "GET",
    redirect: "follow",
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  const files = Object.entries(gistData.files).map((f) => f[1]);

  if (files.length == 0) {
    throw new Error("Gist contains no files");
  }

  const firstFile = files[0];

  if (firstFile.truncated) {
    throw new Error("File is truncated");
  }

  if (!firstFile.content || firstFile.content.length == 0) {
    throw new Error("Gist is empty");
  }

  return firstFile.content;

  /*
  const response = await 

  const gistData = (await response.json()) as unknown;
  if (response.ok === false) {
    if (gistData && typeof gistData === "object" && "message" in gistData) {
      throw new Error("Failed to get gist: " + gistData["message"]);
    } else {
      throw new Error("Failed to get gist: Unknown error");
    }
  }

  if (typeof gistData !== "object") {
    throw new Error("Invalid gist contents: gist did not contain an object");
  }

  const file = Object.entries(gistData["files"])[0][1] as {
    truncated: boolean;
    content: string;
  };
  if (file.truncated) {
    throw new Error("Invalid gist contents: file is truncated (too large)");
  }

  let fileData;
  try {
    fileData = JSON.parse(file.content);
  } catch {
    throw new Error("Invalid gist contents: file did not contain valid JSON");
  }

  if (!("yarn" in fileData)) {
    throw new Error("Invalid gist contents: no Yarn data");
  }
  if (!("map" in fileData)) {
    throw new Error("Invalid gist contents: no map data");
  }

  return {
    map: fileData["map"],
    yarn: fileData["yarn"],
    info: {
      username: gistData["owner"]["login"],
      profile_link: gistData["owner"]["html_url"],
      gist_link: gistData["html_url"],
      title: gistData["description"],
    },
  };*/
};

type GistInfo = {
  username: string;
  profile_link: string;
  gist_link: string;
  title: string;
};
