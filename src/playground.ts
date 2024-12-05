/**
 * The playground module contains the main 'Try Yarn Spinner' frontend code. It
 * registers event handlers, and sets up the Monaco text editor and the Dialogue
 * Runner from 'yarnspinner'.
 */

import * as monaco from "monaco-editor";

import * as yarnspinner from "./yarnspinner";
import "../scss/yarnspinner.scss";
import "bootstrap";

import { escape } from "html-escaper";

import { initialContent } from "./starter-content";

import * as base64 from "@protobufjs/base64";

let editor: monaco.editor.IStandaloneCodeEditor;

let dialogue: yarnspinner.IDialogue;

let errorsExist = false;

import * as yarnspinner_language from "./yarnspinner-language";
import { scriptStorageKey } from "./constants";

class SimpleVariableStorage implements yarnspinner.IVariableStorage {
  storage: { [key: string]: string | number | boolean } = {};

  getVariableNames = () => {
    return Object.keys(this.storage);
  };

  setValue = (name: string, value: string | number | boolean) => {
    this.storage[name] = value;

    updateVariableStorageDisplay(this);
  };

  getValue = (name: string) => {
    return this.storage[name];
  };

  clear = () => {
    this.storage = {};
  };
}

type YarnParameter = "string" | "number" | "bool";

export interface IFunctionDefinition {
  name: string;
  parameters: YarnParameter[];
  returnType: YarnParameter;
  function: Function;
}

export function getInitialContent(initialContentName: string = "default") {
  return initialContent[initialContentName];
}

export async function load(script: string) {
  monaco.languages.register({
    id: "yarnspinner",
    extensions: [".yarn", ".yarnproject"],
  });

  monaco.languages.setLanguageConfiguration(
    "yarnspinner",
    yarnspinner_language.configuration,
  );

  monaco.languages.setMonarchTokensProvider(
    "yarnspinner",
    yarnspinner_language.monarchLanguage,
  );

  let colors = {
    black: "#303A1D",
    // grey: "#818582",
    grey: "#abb0ac",
    dark_green: "#4C8962",
    olive: "#A3AD68",
    green: "#7AA479",
    lightgreen: "#A8BD9B",
    yellow: "#F5C45A",
    red: "#D5683F",
    pink: "#F2A9A0",
    blue: "#79A5B7",
  };

  monaco.editor.defineTheme("yarnspinner", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "line.character", fontStyle: "bold" },
      { token: "comment", foreground: colors.green, fontStyle: "italic" },

      // { token: 'comment', foreground: 'aaaaaa', fontStyle: 'italic' },
      { token: "keyword", foreground: colors.blue },
      { token: "operator", foreground: colors.black },
      { token: "namespace", foreground: colors.blue },

      { token: "type", foreground: colors.red },
      { token: "enum", foreground: colors.red },
      { token: "function", foreground: colors.olive },

      { token: "number", foreground: colors.green },

      { token: "identifier", foreground: colors.blue },

      { token: "string", foreground: colors.red },

      { token: "variable", foreground: colors.yellow },
    ],
    colors: {
      // 'editor.foreground': '#000000'
    },
  });

  editor = monaco.editor.create(document.getElementById("editor"), {
    value: script,
    language: "yarnspinner",
    wordBasedSuggestions: false,
    theme: "yarnspinner",
    fontFamily: "Inconsolata",
    fontSize: 18,
    wordWrap: "on",
    wrappingIndent: "same",
    padding: {
      top: 10,
    },
  });

  // When the editor changes its content, run the source code through the
  // compiler and update the markers. (This feature is debounced, so it will
  // only invoke the function a short time after the last keystroke.)
  editor.onDidChangeModelContent(
    debounce(async (event: monaco.editor.IModelContentChangedEvent) => {
      // When the text changes, our compiled code is no longer valid. Show
      // this by clearing the log.
      window.localStorage.setItem(scriptStorageKey, editor.getValue());
      await compileSource();
    }),
  );

  let variableStorage = new SimpleVariableStorage();

  let runtimeInfo = await yarnspinner.init(variableStorage);

  document.getElementById("yarn-spinner-version-value").innerText =
    `v${runtimeInfo.version} (${runtimeInfo.gitHash})`;

  document.getElementById("yarn-spinner-version").classList.remove("d-none");

  dialogue = yarnspinner.create();

  dialogue.registerFunction({
    name: "greeting",
    parameters: ["string"],
    returnType: "string",
    function: (name: string) => "Hello, " + name,
  });

  dialogue.onLine = async function (line) {
    return new Promise<void>((resolve) => {
      let lineElement = addLogText(
        dialogue.getLine(line.lineID, line.substitutions),
      );

      let continueElement = addLogText(
        "Continue...",
        "list-group-item-action",
        "list-group-item-primary",
      );
      continueElement.scrollIntoView();

      continueElement.addEventListener("click", () => {
        continueElement.remove();
        resolve();
      });
    });
  };

  dialogue.onOptions = async function (options: [yarnspinner.Option]) {
    return new Promise<number>((resolve, reject) => {
      // Create a button that resolves this promise with the specified
      // option index on click. (In other words, onOptions will finish
      // running when the button is clicked.)

      // Start by creating a container for the options
      var optionsContainer = addLogElement("div", "list-group-item");

      var optionsList = document.createElement("div");
      optionsList.classList.add("list-group");
      optionsContainer.appendChild(optionsList);

      options.forEach((option) => {
        // Create a button in the options container
        let button = document.createElement("a");
        button.classList.add("list-group-item", "list-group-item-action");

        if (option.isAvailable == false) {
          button.classList.add("list-group-item-unavailable");
        }

        optionsList.appendChild(button);

        // Set the text of the button to the button itself
        let text = dialogue.getLine(option.lineID, option.substitutions);
        button.innerHTML = "<b>&#8594;</b> " + text; // '→'

        // If the option is available, allow the user to select it
        if (option.isAvailable) {
          // When the button is clicked, display the selected option and
          // resolve with its ID.
          button.addEventListener("click", () => {
            // Add the text of the button that was selected, and get rid
            // of the buttons.
            addLogText(text, "selected-option", "list-group-item-secondary");
            optionsContainer.remove();

            // Resolve with the option ID that was selected.
            resolve(option.optionID);
          });
        }
      });

      optionsList.scrollIntoView();
    });
  };

  // We only want to show the '(jumped to node X)' message on the second node
  // that gets run - we don't want to show it when the dialogue starts up.
  // We'll track whether we should show the 'jumped' line here.
  let shouldShowJumpLine = false;

  dialogue.onNodeComplete = async function (nodeID) {
    shouldShowJumpLine = true;
  };

  dialogue.onNodeStarted = async function (nodeID) {
    if (shouldShowJumpLine) {
      let nodeNameElement = addLogText(
        "(jumped to node " + nodeID + ")",
        "list-group-item-primary",
      );
      nodeNameElement.scrollIntoView();
    }
  };

  dialogue.onCommand = async function (commandText) {
    return new Promise<void>((resolve) => {
      let commandElement = addLogText(
        "<<" + commandText + ">>",
        "list-group-item-primary",
      );
      commandElement.scrollIntoView();

      let continueElement = addLogText(
        "Continue...",
        "list-group-item-action",
        "list-group-item-primary",
      );
      continueElement.scrollIntoView();

      continueElement.addEventListener("click", () => {
        continueElement.remove();
        resolve();
      });
    });
  };

  dialogue.onError = async function (error: Error) {
    const startOfStack = error.message.indexOf("\n   at");
    const messageWithoutStack = error.message.substring(0, startOfStack);
    const endOfExceptionName = messageWithoutStack.indexOf(": ");
    const displayMessage = messageWithoutStack.substring(
      endOfExceptionName + 2,
    );

    let logElement = addLogText(error.message, "list-group-item-danger");

    let errorText = document.createElement("strong");
    errorText.innerText = "Error: ";

    logElement.insertBefore(errorText, logElement.firstChild);

    console.error(error.message);
  };

  document.getElementById("button-test").addEventListener("click", async () => {
    if (errorsExist) {
      return;
    }

    clearLog();
    hideVariableStorageDisplay();

    variableStorage.clear();

    shouldShowJumpLine = false;

    // Get the text out of the editor and compile it
    var source = editor.getModel().getValue();
    var compilation = await dialogue.compileSource(source);

    // Display any diagnostics we have
    for (let diagnostic of compilation.diagnostics) {
      let displayPosition = `Line ${diagnostic.range.start.line + 1}`;
      let message = `${displayPosition}: ${diagnostic.message}`;

      let cssClasses: string[];

      switch (diagnostic.severity) {
        case yarnspinner.DiagnosticSeverity.Error:
          cssClasses = ["list-group-item-danger", "error"];
          break;
        case yarnspinner.DiagnosticSeverity.Warning:
          cssClasses = ["list-group-item-warning", "warning"];
          break;
        case yarnspinner.DiagnosticSeverity.Info:
          cssClasses = [];
        default:
          console.warn(
            `Unknown diagnostic severity type ${diagnostic.severity}`,
          );
          break;
      }
      addLogText(message, ...cssClasses);
    }

    if (compilation.compiled) {
      let nodeToRun;

      // If we have a node name Start, start from that
      nodeToRun = compilation.nodes.find((n) => n.name === "Start");

      if (!nodeToRun) {
        // Otherwise, use the first node present that is not internal or part of
        // a node group.

        nodeToRun = compilation.nodes.find((n) => {
          // Is the node title prefixed with a tag that indicates that it's internal?
          if (n.name.startsWith("$Yarn.Internal")) {
            return false;
          }

          // Does the node have a header that indicates it's part of a node group?
          if (n.headers.find((h) => h.key == "$Yarn.Internal.NodeGroup")) {
            return false;
          }

          // The node is able to run.
          return true;
        });
      }
      await dialogue.startDialogue(nodeToRun.name);
    }
  });

  document
    .getElementById("button-save-script")
    .addEventListener("click", (async) => {
      var source = editor.getModel().getValue();

      const fileName = "YarnScript.yarn";
      downloadFile(source, fileName);
    });

  document
    .getElementById("button-export-runner")
    .addEventListener("click", (async) => {
      if (dialogue.programData.length == 0) {
        window.alert(
          "Your Yarn script contains errors. Fix them before exporting a runner!",
        );
        return;
      }
      let runnerSource = require("./runner.html.txt");

      let programData = dialogue.programData;

      let stringTable = dialogue.stringTable;

      let injectedYarnProgramScript = `
        <script>
        window.yarnData = {
            data : "${base64.encode(programData, 0, programData.length)}",
            stringTable : ${JSON.stringify(stringTable)}
        };
        </script>
        `;

      let replacementMarker = '<script id="injected-yarn-program"></script>';

      var html = runnerSource.replace(
        replacementMarker,
        injectedYarnProgramScript,
      );

      const fileName = "Runner.html";
      downloadFile(html, fileName);
    });

  let pdfDownloadInProgress = false;

  document
    .getElementById("button-download-pdf")
    .addEventListener("click", (async) => {
      if (pdfDownloadInProgress) {
        return;
      }

      pdfDownloadInProgress = true;
      const pdfServer = "https://books-generator.yarnspinner.dev";
      const pdfEndpoint = pdfServer + "/get-pdf";

      var source = editor.getModel().getValue();

      const icon = document.getElementById("button-download-pdf-icon");
      const spinner = document.getElementById("button-download-pdf-spinner");

      icon.classList.add("d-none");
      spinner.classList.remove("d-none");

      fetch(pdfEndpoint, {
        method: "POST",
        body: source,
      })
        .then(async (response) => {
          if (response.status !== 200) {
            console.error(await response.text());
            alert("Sorry, there was a problem downloading your PDF.");
            return;
          }
          var blob = await response.blob();
          downloadFile(blob, "YarnSpinner-Book.pdf");
        })
        .catch((err) => {
          console.error("Error fetching PDF: ", err);
          alert("Sorry, there was a problem downloading your PDF.");
        })
        .finally(() => {
          icon.classList.remove("d-none");
          spinner.classList.add("d-none");

          pdfDownloadInProgress = false;
        });
    });

  // Finally, compile our source immediately.
  compileSource();
}

async function compileSource() {
  clearLog();

  var source = editor.getModel().getValue();
  var compilation = await dialogue.compileSource(source);

  function toMarkerSeverity(
    severity: yarnspinner.DiagnosticSeverity,
  ): monaco.MarkerSeverity {
    switch (severity) {
      case yarnspinner.DiagnosticSeverity.Error:
        return monaco.MarkerSeverity.Error;
      case yarnspinner.DiagnosticSeverity.Warning:
        return monaco.MarkerSeverity.Warning;
      case yarnspinner.DiagnosticSeverity.Info:
        return monaco.MarkerSeverity.Info;
      default:
        return monaco.MarkerSeverity.Warning;
    }
  }

  const diagnostics = compilation.diagnostics.map((d) => {
    return {
      message: d.message,
      severity: toMarkerSeverity(d.severity),
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
    };
  });

  monaco.editor.setModelMarkers(editor.getModel(), "", diagnostics);

  for (let d of diagnostics) {
    let message = `Line ${d.startLineNumber}: ${d.message}`;
    switch (d.severity) {
      case monaco.MarkerSeverity.Error:
        addLogText(message, "list-group-item-danger");
        break;
      case monaco.MarkerSeverity.Warning:
        addLogText(message, "list-group-item-warning");
        break;
      case monaco.MarkerSeverity.Info:
        addLogText(message, "list-group-item-info");
        break;
    }
  }

  errorsExist =
    diagnostics.filter((d) => d.severity === monaco.MarkerSeverity.Error)
      .length > 0;

  if (compilation.nodes.length < 1) {
    addLogText(
      "You need at least one node in your script!",
      "list-group-item-danger",
    );
    errorsExist = true;
  }
}

function downloadFile(source: string | Blob, fileName: string) {
  if (window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
    // IE11 support
    let blob = new Blob([source], { type: "application/octet-stream" });
    (window.navigator as any).msSaveOrOpenBlob(blob, fileName);
  } else {
    // other browsers
    let file = new File([source], fileName, {
      type: "application/octet-stream",
    });
    let link = document.createElement("a");
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

function clearLog() {
  let log = document.getElementById("log");
  while (log.firstChild) {
    log.removeChild(log.firstChild);
  }

  // Show the 'click test' tip when we have no log content.
  setTestTipVisible(true);
}

function addLogText(text: string, ...classes: string[]) {
  var logElement = addLogElement("div", "list-group-item", ...classes);

  text = escape(text);

  text = text.replace(
    /\[i\](.*?)\[\/i\]/g,
    (substring, group1) => `<i>${group1}</i>`,
  );
  text = text.replace(
    /\[b\](.*?)\[\/b\]/g,
    (substring, group1) => `<b>${group1}</b>`,
  );

  logElement.innerHTML = text;
  return logElement;
}

function addLogElement(elementType: string, ...classes: string[]) {
  let log = document.getElementById("log");
  var logElement = document.createElement(elementType);
  log.appendChild(logElement);

  for (let logClass of classes) {
    logElement.classList.add(logClass);
  }

  // Don't show the 'click test' tip when we have log content.
  setTestTipVisible(false);

  return logElement;
}

/**
 * @summary Given a function, returns a debounced version of that function.
 * @description The debounced version will delay by 'ms' milliseconds before
 * actually running; if the function is called again during that delay, the
 * timer will reset. This means that the function can be called multiple times
 * during an interval, and will only run once.
 * @param fn The function to debounce.
 * @param ms The number of milliseconds to debounce by.
 * @returns A debounced version of 'fn' that debounces by 'ms' milliseconds.
 */
function debounce(fn: Function, ms = 150) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

export async function show() {
  // Re-layout the editor
  editor.layout();
}

// Re-layout the editor every time the window resizes.
window.addEventListener("resize", async function () {
  if (editor !== undefined) {
    editor.layout();
  }
});

function setTestTipVisible(visible: boolean) {
  let tip = document.getElementById("log-no-content");
  if (visible) {
    tip.classList.remove("d-none");
  } else {
    tip.classList.add("d-none");
  }
}

function hideVariableStorageDisplay() {
  let variableTable = document.getElementById("variables");
  variableTable.classList.add("d-none");
}

function updateVariableStorageDisplay(storage: yarnspinner.IVariableStorage) {
  let variableTable = document.getElementById("variables");

  // Make the variables view visible now
  variableTable.classList.remove("d-none");
  let variableTableBody = document.getElementById("variables-body");

  // Remove all entries from the variables list
  while (variableTableBody.firstChild) {
    variableTableBody.removeChild(variableTableBody.firstChild);
  }

  // Create new entries for the current set of variables
  for (let variableName of storage.getVariableNames()) {
    if (variableName.startsWith("$Yarn.Internal.")) {
      continue;
    }

    let variable = storage.getValue(variableName);

    let row = document.createElement("tr");
    let variableNameCol = document.createElement("td");
    let variableValueCol = document.createElement("td");

    variableTableBody.appendChild(row);
    row.appendChild(variableNameCol);
    row.appendChild(variableValueCol);

    variableNameCol.innerText = variableName;

    if (typeof variable === "string") {
      variableValueCol.innerText = '"' + variable + '"';
    } else if (typeof variable === "number" || typeof variable === "boolean") {
      variableValueCol.innerText = variable.toString();
    }
  }
}
