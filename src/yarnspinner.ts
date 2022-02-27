import * as dotnet from '../bin/dotnet';

type YarnValue = string | number | boolean;

declare global {
    interface Window {
        variableStorage: {
            storage: { [key: string]: YarnValue };
            setValue: (name: string, value: YarnValue) => void;
            getValue: (name: string) => YarnValue;
            clear: () => void;
        }
    }
}

interface CompileResult {
    compiled: boolean;
    nodes: [string];
    stringTable: { [lineID: string]: string };
}

export interface Line {
    lineID: string;
    substitutions: [string];
}

export interface Option extends Line {
    optionID: number;
}

export interface IDialogue {
    compileSource: (source: string) => Promise<CompileResult>;
    
    startDialogue: (nodeName: string) => Promise<void>;

    getLine(lineID: string, substitutions: [string]) : string;

    onLine: (line: Line) => Promise<void>;
    onOptions: (options: [Option]) => Promise<number>;
    onCommand: (commandText: string) => Promise<void>;

    onNodeStarted: (nodeID: string) => Promise<void>;
    onNodeComplete: (nodeID: string) => Promise<void>;
    onPrepareForLines: (lineIDs: [string]) => Promise<void>;
    onDialogueEnded: () => Promise<void>;
    onError: (error: Error) => Promise<void>;
}

export interface IYarnSpinnerRuntimeInfo {
    version: string;
}

async function boot() {
    if (dotnet.getBootStatus() != dotnet.BootStatus.Booted) {
        await dotnet.boot();
    }
}

export async function init(variableStorage: IVariableStorage) : Promise<IYarnSpinnerRuntimeInfo> {

    // Set up the global Yarn variable storage
    window.variableStorage = {
        storage: {},
        setValue: (name, value) => {
            window.variableStorage.storage[name] = value;
            console.log(`JS: Set ${name} to ${value}`);
        },

        getValue: (name) => {
            console.log(`JS: Getting ${name}`);
            return window.variableStorage.storage[name];
        },

        clear: () => {
            window.variableStorage.storage = {};
        },
    };

    // Configure dotnet with the implementations of the variable storage
    // functions    
    dotnet.YarnJS.ClearVariableStorage = window.variableStorage.clear;
    dotnet.YarnJS.SetValue = window.variableStorage.setValue;
    dotnet.YarnJS.GetValue = window.variableStorage.getValue;

    await boot();

    let version = await dotnet.YarnJS.GetYarnSpinnerVersion();

    let displayVersion = version.substring(0, version.indexOf('+'));

    return {
        version: displayVersion
    };
}

export function create(): IDialogue {
    return new Dialogue();
}

interface DotNetObjectReference {
    invokeMethodAsync(methodName: string, ...params: any): any | PromiseLike<any>;
}

class Dialogue implements IDialogue {

    private dotNetDialogue: DotNetObjectReference;
    private compilation: CompileResult;

    constructor() {
        this.dotNetDialogue = dotnet.YarnJS.GetDialogue();
    }
    getLine(lineID: string, substitutions: [string]): string {
        var lineText = this.compilation.stringTable[lineID];

        substitutions.forEach((sub, index) => {
            lineText = lineText.replace("{" + index + "}", sub);
        });

        return lineText;
    }
    
    compileSource(source: string): Promise<CompileResult> {
        return (async () => {
            this.compilation = await this.dotNetDialogue.invokeMethodAsync('SetProgramSource', source);
            return this.compilation;
        })();
    }

    startDialogue(nodeName: string): Promise<void> {
        
        return (async () => {
            await this.dotNetDialogue.invokeMethodAsync('SetNode', nodeName);

            while (true) {

                try {
                    var events = await this.dotNetDialogue.invokeMethodAsync('Continue') as [any];
                } catch (error) {
                    await this.onError(error);
                    break;
                }

                let ended = false;
                for (let event of events) {
                    if (event.type === "line") {
                        await this.onLine(event);
                    } else if (event.type === "options") {
                        let options = event.options as [Option]

                        let selectedItem = await this.onOptions(options);

                        console.log("Received selected item " + selectedItem);
                        
                        await this.dotNetDialogue.invokeMethodAsync('SetSelectedOption', selectedItem);
                    } else if (event.type === "command") {
                        await this.onCommand(event.commandText);
                    } else if (event.type == "prepareForLines") {
                        await this.onPrepareForLines(event.lineIDs.join(', '));
                    } else if (event.type == "nodeStarted") {
                        await this.onNodeStarted(event.nodeName);
                    } else if (event.type == "nodeComplete") {
                        await this.onNodeComplete(event.nodeName);
                    } else if (event.type === "dialogueEnded") {
                        await this.onDialogueEnded();
                        ended = true;
                    }
                }

                if (ended) {
                    break;
                }
            }
        })();
    }

    onLine (line: Line) : Promise<void> {
        return (async () => { })();
    }
    onOptions (options: [Option]) : Promise<number> {
        return (async () => options[0].optionID)();
    }
    onCommand (commandText: string) : Promise<void> {
        return (async () => { })();
    }
    onNodeStarted (nodeID: string) : Promise<void> {
        return (async () => { })();
    }
    onNodeComplete (nodeID: string) : Promise<void> {
        return (async () => { })();
    }
    onPrepareForLines (lineIDs: [string]) : Promise<void> {
        return (async () => { })();
    }
    onDialogueEnded () : Promise<void> {
        return (async () => { })();
    }
    onError(error: Error): Promise<void> {
        const startOfStack = error.message.indexOf('\n   at');
        const messageWithoutStack = error.message.substring(0, startOfStack);
        const endOfExceptionName = messageWithoutStack.indexOf(': ');
        const displayMessage = messageWithoutStack.substring(endOfExceptionName + 2);
        console.error(displayMessage);
        return (async () => { })();
    }

}