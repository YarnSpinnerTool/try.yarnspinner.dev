import * as monaco from 'monaco-editor';
import * as yarnspinner from './yarnspinner';

let editor: monaco.editor.IStandaloneCodeEditor

let dialogue: yarnspinner.IDialogue;

window.addEventListener("load", async function () {

    let script = `title: Start
---
Wow, cool! Yarn Spinner in the browser!
<<set $myVar to "hello">>
Here's a variable: {$myVar}
<<command woo nice>>
-> One
    You chose option one!
-> Two
    You chose option two!
All done!
===`
    
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: script,
        language: null
    });


    await yarnspinner.init();

    dialogue = yarnspinner.create();

    dialogue.onLine = async function (line) {
        addLogText(dialogue.getLine(line.lineID, line.substitutions));
    }

    dialogue.onOptions = async function (options: [yarnspinner.Option]) {
        return new Promise<number>((resolve, reject) => {
            
            // Create a button that resolves this promise with the specified
            // option index on click. (In other words, onOptions will finish
            // running when the button is clicked.)
            var optionsContainer = addLogElement("div", "options");

            options.forEach(option => {
                // Create a button in the options container
                let button = document.createElement("button");
                optionsContainer.appendChild(button);

                // Set the text of the button to the button itself
                let text = dialogue.getLine(option.lineID, option.substitutions);
                button.innerText = text;

                // When the button is clicked, display the selected option and
                // resolve with its ID.
                button.addEventListener("click", () => {
                    // Add the text of the button that was selected, and get rid
                    // of the buttons.
                    addLogText(text, "selected-option");
                    optionsContainer.remove();

                    // Resolve with the option ID that was selected. 
                    resolve(option.optionID);
                });
            });
        });
    }

    dialogue.onCommand = async function(commandText) {
        addLogText("<<" + commandText + ">>", "command");
    }

    this.document.getElementById("run").addEventListener("click", async () => {

        clearLog();

        var source = editor.getModel().getValue();

        var compilation = await dialogue.compileSource(source);

        if (compilation.compiled == false) {
            addLogText("Source contained errors.", "error");
            return;
        }

        await dialogue.startDialogue("Start");
    });
});

function clearLog() {
    let log = document.getElementById("log");
    while (log.firstChild) {
        log.removeChild(log.firstChild);
    }
}

function addLogText(text: string, ...classes : string[]) {
    var logElement = addLogElement("p", ...classes);
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

window.addEventListener("resize", async function () {
    editor.layout();
});

