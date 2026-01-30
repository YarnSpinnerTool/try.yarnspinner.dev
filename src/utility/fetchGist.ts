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

export const fetchGist = async (gistID: string, filename?: string): Promise<string> => {
    if (!/^[a-f0-9]+$/i.test(gistID)) {
        throw new Error("Invalid gist ID format");
    }

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

    // If filename is specified, find that file
    let targetFile;
    if (filename) {
        targetFile = files.find(f => f.filename === filename);
        if (!targetFile) {
            throw new Error(`File '${filename}' not found in gist`);
        }
    } else {
        // Otherwise use first file (existing behavior)
        targetFile = files[0];
    }

    if (targetFile.truncated) {
        throw new Error("File is truncated");
    }

    if (!targetFile.content || targetFile.content.length == 0) {
        throw new Error("Gist is empty");
    }

    return targetFile.content;
};