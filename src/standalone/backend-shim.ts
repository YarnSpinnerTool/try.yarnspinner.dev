/**
 * Standalone shim for the "backend" module.
 *
 * In the main app the "backend" package resolves to the .NET WASM bridge.
 * The standalone player receives pre-compiled bytecode so it never needs the
 * real compiler — it only needs the *type shapes* that Runner.tsx imports.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace YarnSpinner {
  export interface Position {
    line: number;
    character: number;
  }

  export interface Range {
    start: Position;
    end: Position;
  }

  export enum DiagnosticSeverity {
    Info = 0,
    Warning = 1,
    Error = 2,
  }

  export interface Diagnostic {
    fileName: string;
    range: Range;
    message: string;
    context?: string;
    severity: DiagnosticSeverity;
    code?: string;
  }

  export interface Node {
    name: string;
    headers: Record<string, string>;
  }

  export interface Declaration {
    name: string;
  }

  export interface VariableDeclaration extends Declaration {
    type: string;
    description?: string;
  }

  export interface TypeDeclaration extends Declaration {}

  export interface StringInfo {
    text: string;
    tags: string[];
    nodeName?: string;
    lineNumber: number;
    fileName?: string;
    isImplicitTag: boolean;
    shadowLineID?: string;
  }

  export interface CompilationResult {
    info: string;
    nodes: Record<string, Node>;
    variableDeclarations: Record<string, VariableDeclaration>;
    typeDeclarations: Record<string, TypeDeclaration>;
    stringTable?: Record<string, StringInfo>;
    programData?: string;
    programHash: number;
    stringTableHash: number;
    diagnostics: Diagnostic[];
  }
}
