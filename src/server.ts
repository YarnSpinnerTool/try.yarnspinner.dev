export type JobRequest = {
    yarn: string;
    author?: string;
    title?: string;
    debug?: boolean;
    shuffle?: boolean;
}

export type JobState =
    "Unknown" |
    "Failed" |
    "Processing" |
    "Complete";

export type PDFGenerationReponse = {
    jobID:string;
    state:JobState;
    message?:string | null;
    details?:string | null;
    pdfLocation?:string|null;
}
