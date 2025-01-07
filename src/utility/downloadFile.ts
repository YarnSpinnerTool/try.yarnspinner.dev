export function downloadFile(source: string | Blob, fileName: string) {
    if (window.navigator && "msSaveOrOpenBlob" in window.navigator && typeof window.navigator.msSaveOrOpenBlob === "function") {
        // IE11 support
        const blob = new Blob([source], { type: "application/octet-stream" });
        window.navigator.msSaveOrOpenBlob(blob, fileName);
    } else {
        // other browsers
        const file = new File([source], fileName, {
            type: "application/octet-stream",
        });

        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(file);
        link.download = file.name;

        document.body.appendChild(link);

        link.dispatchEvent(
            new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window,
            }),
        );

        link.remove();
        window.URL.revokeObjectURL(link.href);
    }
}