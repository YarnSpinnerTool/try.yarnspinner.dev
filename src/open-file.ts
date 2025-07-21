export const openFile = async (...accept: string[]): Promise<File | null> => {
  return new Promise<File | null>((resolve) => {
    // Append a new `<input type="file" multiple? />` and hide it.
    const input = document.createElement("input");
    input.style.display = "none";
    input.type = "file";
    document.body.append(input);
    input.multiple = false;
    input.accept = accept.length > 0 ? accept.join(",") : undefined;

    // The `change` event fires when the user interacts with the dialog.
    input.addEventListener("change", () => {
      // Remove the `<input type="file" multiple? />` again from the DOM.
      input.remove();
      // If no files were selected, return.
      if (!input.files) {
        return undefined;
      }
      // Return the the first selected file.
      resolve(input.files[0]);
    });
    // Show the picker.
    if ("showPicker" in HTMLInputElement.prototype) {
      input.showPicker();
    } else {
      input.click();
    }
  });
};
