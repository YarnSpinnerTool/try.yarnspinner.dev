import * as dotnet from '../bin/dotnet';
import { IFunctionDefinition } from './playground';

type YarnValue = string | number | boolean;

declare global {
    // We need to store the variable storage as a global (because .NET will look
    // for it at 'window.variableStorage'), so we'll extend the Window interface
    // to include this property.
    interface Window {
        variableStorage: IVariableStorage
        yarnFunctions: {[functionName:string] : Function}
    }
}

interface CompileResult {
    compiled: boolean;
    nodes: string[];
    stringTable: { [lineID: string]: string };
    diagnostics: Diagnostic[];
}

export interface Line {
    lineID: string;
    substitutions: [string];
}

export interface Option extends Line {
    optionID: number;
}

/** @summary Represents a position in a multi-line string. */
export interface Position {
    /** @summary The zero-indexed line of this position. */
    line: number;

    /** @summary The zero-indexed character number of this position. */
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export enum DiagnosticSeverity {
    Error = "error",
    Warning = "warning",
    Info = "info",
}

export interface Diagnostic {
    
    fileName: string;
    range: Range;
    message: string;
    context?: string;
    severity: DiagnosticSeverity;
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

    registerFunction: (functionDefinition: IFunctionDefinition) => Promise<void>;
}

export interface IVariableStorage {
    getVariableNames: () => string[];
    setValue: (name: string, value: YarnValue) => void;
    getValue: (name: string) => YarnValue;
    clear: () => void;
}

export interface IYarnSpinnerRuntimeInfo {
    version: string;
    gitHash: string;
}

async function boot() {
    if (dotnet.getBootStatus() != dotnet.BootStatus.Booted) {
        await dotnet.boot();
    }
}

function invokeFunction(name: string, params: any[]): any {
    console.log(`Invoking function ${name}`);
    let f = window.yarnFunctions[name];

    if (f === undefined) {
        throw Error(`Unknown function ${name}`);
    }

    const result = f(...params);

    console.log(`${name} returned ${typeof result}: ${result}`);

    return result;
}

export async function init(variableStorage: IVariableStorage) : Promise<IYarnSpinnerRuntimeInfo> {

    // Set up the global Yarn variable storage
    window.variableStorage = variableStorage;

    // Configure dotnet with the implementations of the variable storage
    // functions    
    dotnet.YarnJS.ClearVariableStorage = window.variableStorage.clear;
    dotnet.YarnJS.SetValue = window.variableStorage.setValue;
    dotnet.YarnJS.GetValue = window.variableStorage.getValue;
    dotnet.YarnJS.InvokeFunction = invokeFunction;

    await boot();

    let version = await dotnet.YarnJS.GetYarnSpinnerVersion();

    let displayVersionRE = /(\d+)\.(\d+)\.(\d+)\+(\d+)\..*?Sha\.(.{0,8})/
    let result = displayVersionRE.exec(version);

    let major = result[1];
    let minor = result[2];
    let patch = result[3];
    let commits = result[4];
    let sha = result[5];

    let displayVersion = `${major}.${minor}.${patch}`

    if (parseInt(commits) > 0) {
        displayVersion += "+" + commits;
    }

    window.yarnFunctions = {};

    return {
        version: displayVersion,
        gitHash: sha,
    };
}

export function create(): IDialogue {
    return new Dialogue();
}

interface DotNetObjectReference {
    invokeMethodAsync(methodName: string, ...params: any): any | PromiseLike<any>;
}

class Dialogue implements IDialogue {

    private dotNetDialogue: DotNetObjectReference = null;
    private compilation: CompileResult = null;

    constructor() {
        // Ask .NET to create a Dialogue object for us in managed code, and
        // return to us a reference we can use to call instance methods on it
        this.dotNetDialogue = dotnet.YarnJS.GetDialogue();
    }

    registerFunction (functionDefinition: IFunctionDefinition) : Promise<void> {
        return (async () => {

            window.yarnFunctions[functionDefinition.name] = functionDefinition.function;

            this.compilation = await this.dotNetDialogue.invokeMethodAsync('RegisterFunction', functionDefinition);
        })();
    };

    // Given a line ID and a collection of substitutions, look up the
    // appropriate user-facing text, apply the substitutions to it, and return
    // it.
    getLine(lineID: string, substitutions: [string]): string {
        var lineText = this.compilation.stringTable[lineID];

        substitutions.forEach((sub, index) => {
            lineText = lineText.replace("{" + index + "}", sub);
        });

        return lineText;
    }
    
    // Submits Yarn source code to the compiler, and returns the result.
    compileSource(source: string): Promise<CompileResult> {
        return (async () => {

            try {
                this.compilation = await this.dotNetDialogue.invokeMethodAsync('SetProgramSource', source);
                return this.compilation;
            } catch (error) {
                this.compilation = {
                    compiled: false,
                    nodes: [],
                    diagnostics: [],
                    stringTable: {},
                };
                this.onError(error);
            }
        })();
    }

    // Start running dialogue from the given node name.
    startDialogue(nodeName: string): Promise<void> {

        if (this.compilation == null) {
            this.onError(new Error("Can't start dialogue: no Yarn source code has been compiled yet"));
            return;
        }

        return (async () => {
            try {

                await this.dotNetDialogue.invokeMethodAsync('SetNode', nodeName);

                while (true) {

                    var events = await this.dotNetDialogue.invokeMethodAsync('Continue') as any[];

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
                        } else if (event.type === "prepareForLines") {
                            await this.onPrepareForLines(event.lineIDs.join(', '));
                        } else if (event.type === "nodeStarted") {
                            await this.onNodeStarted(event.nodeName);
                        } else if (event.type === "nodeComplete") {
                            await this.onNodeComplete(event.nodeName);
                        } else if (event.type === "dialogueEnded") {
                            await this.onDialogueEnded();
                            return;
                        }
                    }
                }
            } catch (error) {
                // If an error occurs at any point, report an error and stop.
                await this.onError(error);
                return;
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