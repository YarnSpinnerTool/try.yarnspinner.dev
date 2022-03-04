import * as monaco from 'monaco-editor';

import * as yarnspinner from './yarnspinner';
import "../scss/yarnspinner.scss";
import 'bootstrap';

let editor: monaco.editor.IStandaloneCodeEditor

let dialogue: yarnspinner.IDialogue;

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

export async function load () {

    let script = `title: Start
---
Wow, cool! Yarn Spinner in the browser!
<<set $myVar to greeting("world")>>
Here's a variable: {$myVar}
<<command woo nice>>
-> One
    You chose option one!
-> Two
    You chose option two!
Let's jump somewhere else!
<<jump OtherNode>>
===
title: OtherNode
---
Time to change a variable!
<<set $myVar to "goodbye">>
The variable says: {$myVar}!
All done!
===`
    
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: script,
        language: null,
        wordBasedSuggestions: false,
    });

    // When the editor changes its content, run the source code through the
    // compiler and update the markers. (This feature is debounced, so it will
    // only invoke the function a short time after the last keystroke.)
    editor.onDidChangeModelContent(debounce(async (event: monaco.editor.IModelContentChangedEvent) => {
        var source = editor.getModel().getValue();
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

        monaco.editor.setModelMarkers(editor.getModel(), "", compilation.diagnostics.map(d => {
            return {
                message: d.message,
                severity: toMarkerSeverity(d.severity),
                startLineNumber: d.range.start.line + 1,
                startColumn: d.range.start.character + 1,
                endLineNumber: d.range.end.line + 1,
                endColumn: d.range.end.character + 1,
            }
        }));
    }));
    
    let variableStorage = new SimpleVariableStorage();

    let runtimeInfo = await yarnspinner.init(variableStorage);

    document.getElementById("yarn-spinner-version-value").innerText = `v${runtimeInfo.version} (${runtimeInfo.gitHash})`;

    document.getElementById("yarn-spinner-version").classList.remove("d-none");

    dialogue = yarnspinner.create();

    dialogue.registerFunction({
        name: "greeting",
        parameters: ["string"],
        returnType: "string",
        function: (name : string) => "Hello, " + name,
    });

    dialogue.onLine = async function (line) {
        let lineElement = addLogText(dialogue.getLine(line.lineID, line.substitutions));
        lineElement.scrollIntoView();
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
                optionsList.appendChild(button);

                // Set the text of the button to the button itself
                let text = dialogue.getLine(option.lineID, option.substitutions);
                button.innerText = text;

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
            });

            optionsList.scrollIntoView();
        });
    }

    dialogue.onCommand = async function(commandText) {
        let commandElement = addLogText("<<" + commandText + ">>", "list-group-item-primary");
        commandElement.scrollIntoView();
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

    document.getElementById("button-run").addEventListener("click", async () => {
        clearLog();
        hideVariableStorageDisplay();

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
            await dialogue.startDialogue("Start");
        }

    });
}

function clearLog() {
    let log = document.getElementById("log");
    while (log.firstChild) {
        log.removeChild(log.firstChild);
    }
}

function addLogText(text: string, ...classes : string[]) {
    var logElement = addLogElement("div", "list-group-item", ...classes);
    logElement.innerText = text;
    return logElement;
}

function addLogElement(elementType : string, ...classes : string[]) {
    let log = document.getElementById("log");
    var logElement = document.createElement(elementType);
    log.appendChild(logElement);

    for (let logClass of classes) {
        logElement.classList.add(logClass);
    }

    return logElement;
}

function debounce(fn: Function, ms = 150) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: any[]) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
}

export async function show() {
    editor.layout();
}

// Re-layout the editor every time the window resizes.
window.addEventListener("resize", async function () {
    if (editor !== undefined) {
        editor.layout();
    }
});

function hideVariableStorageDisplay() {
    let variableTable = document.getElementById("variables");
    variableTable.classList.add("d-none");
}

function updateVariableStorageDisplay(storage: yarnspinner.IVariableStorage) {
    let variableTable = document.getElementById("variables");

    // Make the variables view visible now
    variableTable.classList.remove("d-none");
    let variableTableBody = document.getElementById("variables-body");

    while (variableTableBody.firstChild) {
        variableTableBody.removeChild(variableTableBody.firstChild);
    }

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

