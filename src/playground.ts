/**
 * The playground module contains the main 'Try Yarn Spinner' frontend code. It
 * registers event handlers, and sets up the Monaco text editor and the Dialogue
 * Runner from 'yarnspinner'.
 */

import * as monaco from 'monaco-editor';

import * as yarnspinner from './yarnspinner';
import "../scss/yarnspinner.scss";
import 'bootstrap';

import { escape } from 'html-escaper';

import { initialContent } from './starter-content';

import * as schemas from './schemas.g';

let editor: monaco.editor.IStandaloneCodeEditor

let dialogue: yarnspinner.IDialogue;

let errorsExist = false;

import * as yarnspinner_language from './yarnspinner-language';
import { JobRequest } from './server';

class SimpleVariableStorage implements yarnspinner.IVariableStorage {
    storage: { [key: string]: string | number | boolean; } = {};
    
    getVariableNames = () => {
        return Object.keys(this.storage);
    }

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

export async function load (initialContentName : string = "default") {

    let script = initialContent[initialContentName]
    
    monaco.languages.register({
        id: 'yarnspinner',
        extensions: ['.yarn', '.yarnproject'],
    })

    monaco.languages.setLanguageConfiguration('yarnspinner', yarnspinner_language.configuration);

    monaco.languages.setMonarchTokensProvider('yarnspinner', yarnspinner_language.monarchLanguage);

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
    }

    monaco.editor.defineTheme('yarnspinner', {
        base: 'vs',
        inherit: true,
        rules: [
            
            { token: 'line.character', fontStyle: 'bold' },
            { token: 'comment', foreground: colors.green, fontStyle: 'italic' },
            
            // { token: 'comment', foreground: 'aaaaaa', fontStyle: 'italic' },
            { token: 'keyword', foreground: colors.blue },
            { token: 'operator', foreground: colors.black },
            { token: 'namespace', foreground: colors.blue },

            { token: 'type', foreground: colors.red },
            { token: 'enum', foreground: colors.red, },
            { token: 'function', foreground: colors.olive },

            { token: 'number', foreground: colors.green },

            { token: 'identifier', foreground: colors.blue},

            { token: 'string', foreground: colors.red, },

            { token: 'variable', foreground: colors.yellow },
            
        ],
        colors: {
            // 'editor.foreground': '#000000'
        }
    });

    const titleField = document.getElementById("book-title") as HTMLInputElement;
    const authorField = document.getElementById("book-author") as HTMLInputElement;
    let title = window.localStorage.getItem("title");
    let author = window.localStorage.getItem("author");
    let content = window.localStorage.getItem("content");

    if (titleField) {
        titleField.addEventListener("input", () => window.localStorage.setItem("title", titleField.value));
        if (title) {
            titleField.value = title;

        }
    }

    if (authorField) {
        authorField.addEventListener("input", () => window.localStorage.setItem("author", authorField.value));
        if (author) {
            authorField.value = author;

        }
    }

    if (content) {
        script = content;
    }

    editor = monaco.editor.create(document.getElementById('editor'), {
        value: script,
        language: 'yarnspinner',
        wordBasedSuggestions: false,
        theme: 'yarnspinner',
        fontFamily: "Inconsolata",
        fontSize: getCurrentFontSize(),
        wordWrap: 'on',
        minimap: {enabled:false},
        lineNumbersMinChars: 3,
        wrappingIndent: 'same',
        padding: {
            top: 10
        },
    });

    // When the editor changes its content, run the source code through the
    // compiler and update the markers. (This feature is debounced, so it will
    // only invoke the function a short time after the last keystroke.)
    editor.onDidChangeModelContent(debounce(async (event: monaco.editor.IModelContentChangedEvent) => {
        // When the text changes, our compiled code is no longer valid. Show
        // this by clearing the log.
        await compileSource();
    }));
    
    let variableStorage = new SimpleVariableStorage();

    let runtimeInfo = await yarnspinner.init(variableStorage);


    const versionField = document.getElementById("yarn-spinner-version");
    const versionValueField = document.getElementById("yarn-spinner-version-value");

    if (versionField && versionValueField) {
        versionValueField.innerText = `v${runtimeInfo.version} (${runtimeInfo.gitHash})`;
        versionField.classList.remove("d-none");
    }

    dialogue = yarnspinner.create();

    dialogue.registerFunction({
        name: "greeting",
        parameters: ["string"],
        returnType: "string",
        function: (name : string) => "Hello, " + name,
    });

    dialogue.onLine = async function (line) {
        return new Promise<void>(resolve => {

            let lineElement = addLogText(dialogue.getLine(line.lineID, line.substitutions));
            
            let continueElement = addLogText("Continue...", "list-group-item-action", "list-group-item-primary")
            continueElement.scrollIntoView();
            
            continueElement.addEventListener("click", () => {
                continueElement.remove();
                resolve();
            });
        })
    }

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

            options.forEach(option => {
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
    }

    // We only want to show the '(jumped to node X)' message on the second node
    // that gets run - we don't want to show it when the dialogue starts up.
    // We'll track whether we should show the 'jumped' line here.
    let shouldShowJumpLine = false;

    dialogue.onNodeComplete = async function (nodeID) {
        shouldShowJumpLine = true;
    }

    dialogue.onNodeStarted = async function (nodeID) {
        if (shouldShowJumpLine) {

            let nodeNameElement = addLogText("(jumped to node " + nodeID + ")", "list-group-item-primary");
            nodeNameElement.scrollIntoView();
        }
    }

    dialogue.onCommand = async function (commandText) {
        
        return new Promise<void>(resolve => {

            let commandElement = addLogText("<<" + commandText + ">>", "list-group-item-primary");
            commandElement.scrollIntoView();
            
            let continueElement = addLogText("Continue...", "list-group-item-action", "list-group-item-primary")
            continueElement.scrollIntoView();
            
            continueElement.addEventListener("click", () => {
                continueElement.remove();
                resolve();
            });
        });
    }

    dialogue.onError = async function(error:Error) {
        const startOfStack = error.message.indexOf('\n   at');
        const messageWithoutStack = error.message.substring(0, startOfStack);
        const endOfExceptionName = messageWithoutStack.indexOf(': ');
        const displayMessage = messageWithoutStack.substring(endOfExceptionName + 2);

        let logElement = addLogText(error.message, "list-group-item-danger");

        let errorText = document.createElement('strong');
        errorText.innerText = "Error: ";

        logElement.insertBefore(errorText, logElement.firstChild);
    }

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

            let cssClasses: string[]
            
            switch (diagnostic.severity) {
                case yarnspinner.DiagnosticSeverity.Error:
                    cssClasses = ["list-group-item-danger", "error"];
                    break;
                case yarnspinner.DiagnosticSeverity.Warning:
                    cssClasses = ["list-group-item-warning", "warning"];
                case yarnspinner.DiagnosticSeverity.Info:
                    cssClasses = [];
                default:
                    console.warn(`Unknown diagnostic severity type ${diagnostic.severity}`);
                    break;
            }
            addLogText(message, ...cssClasses);
        }
        
        if (compilation.compiled) {
            
            let nodeToRun;
            if (compilation.nodes.includes("Start")) {
                // If we have a node name Start, start from that
                nodeToRun = "Start";
            } else {
                // Otherwise, use the first node present.
                nodeToRun = compilation.nodes[0];
            }
            await dialogue.startDialogue(nodeToRun);
        }

    });

    document.getElementById("button-save-script")?.addEventListener("click",async  => {
        var source = editor.getModel().getValue();

        const fileName = "YarnScript.yarn";
        downloadFile(source, fileName);
    })

    document.getElementById("button-export-runner")?.addEventListener("click", async => {

        if (dialogue.programData.length == 0) {
            window.alert("Your Yarn script contains errors. Fix them before exporting a runner!");
            return;
        }
        let runnerSource = require("./runner.html.txt")

        let programData = dialogue.programData;

        let stringTable = dialogue.stringTable;

        let injectedYarnProgramScript = `
        <script>
        window.yarnData = {
            programData : Uint8Array.from([${programData.toString()}]),
            stringTable : ${JSON.stringify(stringTable)}
        };
        </script>
        `;

        let replacementMarker = '<script id="injected-yarn-program"></script>';

        var html = runnerSource.replace(replacementMarker, injectedYarnProgramScript);

        const fileName = "Runner.html";
        downloadFile(html, fileName);

    });

    let pdfDownloadInProgress = false;

    document.getElementById("button-download-pdf")?.addEventListener("click", async => {
        if (pdfDownloadInProgress) {
            return;
        }

        if (errorsExist) {
            alert("Can't download a PDF, because errors exist in your document.");
            return;
        }

        var source = editor.getModel().getValue();

        const icon = document.getElementById("button-download-pdf-icon");
        const spinner = document.getElementById("button-download-pdf-spinner");

        icon.classList.add("d-none");
        spinner.classList.remove("d-none");

        const titleElement = document.getElementById("book-title") as HTMLInputElement;
        const authorElement = document.getElementById("book-author") as HTMLInputElement;

        const title = titleElement?.value || titleElement?.placeholder || "Title";
        const author = authorElement?.value || authorElement?.placeholder || "Author";

        var data : JobRequest = {
            title, author, yarn: source
        };

        pdfDownloadInProgress = true;

        async function dispatchAndWaitForJob(jobData: JobRequest) : Promise<Blob> {
            // const pdfServer = 'http://localhost:7071';
            const pdfServer = 'https://yarnspinner-books-api.azurewebsites.net/';
            const pdfNewJobEndpoint = pdfServer + '/api/AddNewJob';
            const pdfPollEndpoint = pdfServer + '/api/GetJobStatus';

            const newJobResponse : Response = await fetch(pdfNewJobEndpoint, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify(jobData),
            });

            if (newJobResponse.status !== 200) {
                console.error(await newJobResponse.text());
                throw new Error("Failed to dispatch new job");
            }
            
            const responseJSON = JSON.parse(await newJobResponse.text());
            var data = await schemas.pDFGenerationReponseSchema.parseAsync(responseJSON);

            if (data.state !== "Processing") {
                console.error(data);

                throw new Error("Failed to submit new job");
            }
            
            console.log(`Successfully submitted job ${data.jobID}`);

            let pollCount = 0;
            const maxPolls = 100;
            const basePollDelayMilliseconds = 1000;
            let pollDelayMilliseconds = basePollDelayMilliseconds;
            let increaseWaitPeriodAfterPoll = 5;

            while (pollCount < maxPolls) {
                if (pollCount >= increaseWaitPeriodAfterPoll ) {
                    pollDelayMilliseconds = basePollDelayMilliseconds * 4;
                }
                
                const q = new URLSearchParams();
                q.set("id", data.jobID);
                q.toString();

                console.log(`Getting status of job ${data.jobID}...`);
            
                const jobStatusResponse = await fetch(`${pdfPollEndpoint}?${q.toString()}`, {
                    method: 'GET',
                });

                var status = await schemas.pDFGenerationReponseSchema.parseAsync(JSON.parse(await jobStatusResponse.text()));
                
                if (status.state == "Complete") {
                    console.log(`Job ${data.jobID} completed successfully.`);
                    const pdfLocation = status.pdfLocation;
                    console.log(`Job ${data.jobID} PDF available at `,pdfLocation);
                    const pdfResponse = await fetch(pdfLocation, {
                        method: 'GET'
                    });
                    if (pdfResponse.ok) {
                        return await pdfResponse.blob();
                    } else {
                        throw new Error("PDF generation reported as successful, but download failed");
                    }
                }

                if (status.state == "Failed") {
                    throw new Error("PDF generation failed");
                }
                await new Promise(res => setTimeout(res, pollDelayMilliseconds));
                pollCount += 1;
            
            }
            
        }

        dispatchAndWaitForJob(data).then(async (blob) => {
            downloadFile(blob, "YarnSpinner-Book.pdf");
        }).catch((err) => {
            console.error("Error fetching PDF: ", err);
            alert("Sorry, there was a problem downloading your PDF.");
        }).finally(() => {
            icon.classList.remove("d-none");
            spinner.classList.add("d-none");

            pdfDownloadInProgress = false
        });
    });

    // Finally, compile our source immediately.
    compileSource();
        
}

async function compileSource() {
    clearLog();

    var source = editor.getModel().getValue();

    window.localStorage.setItem("content", source);

    var compilation = await dialogue.compileSource(source);

    function toMarkerSeverity(severity: yarnspinner.DiagnosticSeverity): monaco.MarkerSeverity {
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

    const diagnostics = compilation.diagnostics.map(d => {
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
        addLogText(message, "list-group-item-danger");
    }

    // Errors exist if we have any error diagnostics or if no nodes were compiled.
    errorsExist = diagnostics.length > 0 || compilation.nodes.length < 1;
}

function downloadFile(source: string | Blob, fileName: string) {
    if (window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
        // IE11 support
        let blob = new Blob([source], { type: "application/octet-stream" });
        (window.navigator as any).msSaveOrOpenBlob(blob, fileName);
    } else {
        // other browsers
        let file = new File([source], fileName, { type: "application/octet-stream" });
        let link = document.createElement('a');
        link.href = window.URL.createObjectURL(file);
        link.download = file.name;
        document.body.appendChild(link);
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
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

function addLogText(text: string, ...classes : string[]) {
    var logElement = addLogElement("div", "list-group-item", ...classes);

    text = escape(text);

    text = text.replace(/\[i\](.*?)\[\/i\]/g, (substring, group1) => `<i>${group1}</i>`)
    text = text.replace(/\[b\](.*?)\[\/b\]/g, (substring, group1) => `<b>${group1}</b>`)

    logElement.innerHTML = text;
    return logElement;
}

function addLogElement(elementType : string, ...classes : string[]) {
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


const getCurrentFontSize = () => {
    const root = document.documentElement;
    const fontSizeString = window.getComputedStyle(root).fontSize;
    const fontSize = parseInt(fontSizeString.match(/[0-9\.]+/)[0])
    return fontSize;
}

const updateEditor = () => {
    if (!editor) {
        return;
    }
    editor.updateOptions({
        fontSize: getCurrentFontSize()
    })
    editor.layout();
}

// Re-layout the editor every time the window resizes.
window.addEventListener("resize", updateEditor);

window.addEventListener("yarnspinner-mode-changed", updateEditor);

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

        let variable = storage.getValue(variableName);

        let row = document.createElement("tr");
        let variableNameCol = document.createElement("td");
        let variableValueCol = document.createElement("td");

        variableTableBody.appendChild(row);
        row.appendChild(variableNameCol);
        row.appendChild(variableValueCol);

        variableNameCol.innerText = variableName;

        if (typeof variable === 'string') {
            variableValueCol.innerText = "\"" + variable + "\"";
        } else if (typeof variable === 'number' || typeof variable === 'boolean') {
            variableValueCol.innerText = variable.toString();
        }
    }
}

