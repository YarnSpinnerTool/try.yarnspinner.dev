/**
 * LSP Service for Yarn Spinner
 *
 * Wraps the PlaygroundCompilerService to provide IDE features:
 * - Autocomplete for variables, commands, nodes, functions
 * - Hover information
 * - Go to definition
 *
 * Does NOT provide syntax highlighting (our custom highlighter is used instead)
 */

import { WasmCompilerService, CompilationResult } from '@yarnspinner/playground-compiler-service'
import type { LspActionDeclaration, LspNodeInfo, LspDeclaration } from '@yarnspinner/playground-compiler-service'
import { YarnSpinner } from 'backend'
import { getBuiltinDoc, formatBuiltinHover, CONTROL_FLOW_DOCS, COMMAND_DOCS, FUNCTION_DOCS } from './builtins'

// Create a wrapper that adapts our WASM compiler to the interface expected by PlaygroundCompilerService
interface YarnCompilerAdapter {
  compile(sources: Array<{ name: string; content: string }>): Promise<any>
  isReady(): boolean
}

function createCompilerAdapter(): YarnCompilerAdapter {
  return {
    isReady() {
      return true // Assume ready if this code is running
    },

    async compile(sources: Array<{ name: string; content: string }>) {
      // Compile using our existing WASM backend
      const source = sources.map(s => s.content).join('\n===\n')
      const result = await YarnSpinner.compileAsync({ source })

      // Map to the format expected by PlaygroundCompilerService
      // Note: result.programData is already base64 encoded from the WASM compiler
      return {
        success: !!result.programData,
        programData: result.programData || null,
        diagnostics: (result.diagnostics || []).map(d => ({
          severity: d.severity === YarnSpinner.DiagnosticSeverity.Error ? 'error' :
                   d.severity === YarnSpinner.DiagnosticSeverity.Warning ? 'warning' : 'info',
          message: d.message,
          line: d.range.start.line,
          column: d.range.start.character,
          endLine: d.range.end.line,
          endColumn: d.range.end.character,
          file: d.fileName || sources[0]?.name || 'input',
        })),
        declarations: Object.entries(result.variableDeclarations || {}).map(([name, decl]) => ({
          name,
          type: 'variable',
          valueType: decl.type?.toLowerCase() as 'string' | 'number' | 'boolean',
          defaultValue: undefined, // Not available from compiler
        })),
        nodeNames: Object.keys(result.nodes || {}),
        nodes: Object.fromEntries(
          Object.entries(result.nodes || {}).map(([name, node]) => [
            name,
            { name, headers: node.headers || {} }
          ])
        ),
        variableDeclarations: result.variableDeclarations,
        stringTable: result.stringTable ? Object.fromEntries(
          Object.entries(result.stringTable).map(([id, text]) => [
            id,
            { text, tags: [], nodeName: '', lineNumber: 0, isImplicitTag: false }
          ])
        ) : undefined,
      }
    }
  }
}

export interface LspState {
  nodes: LspNodeInfo[]
  variables: LspDeclaration[]
  actions: LspActionDeclaration[]
  nodeNames: string[]
}

/**
 * LSP Service singleton
 *
 * Designed to be resilient - errors in LSP features should never crash the editor.
 * All public methods catch and log errors, returning safe fallback values.
 */
class LspServiceImpl {
  private compilerService: WasmCompilerService | null = null
  private lastResult: CompilationResult | null = null
  private state: LspState = {
    nodes: [],
    variables: [],
    actions: [],
    nodeNames: [],
  }
  private initError: Error | null = null

  initialize() {
    if (this.compilerService || this.initError) {
      return // Already initialized or failed
    }

    try {
      console.log('[LSP] Initializing compiler service...')
      const adapter = createCompilerAdapter()
      this.compilerService = new WasmCompilerService(adapter)
      console.log('[LSP] Compiler service initialized successfully')
    } catch (error) {
      console.error('[LSP] Failed to initialize compiler service:', error)
      this.initError = error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * Reset the LSP service (useful for recovery after errors)
   */
  reset() {
    this.compilerService = null
    this.lastResult = null
    this.initError = null
    this.state = {
      nodes: [],
      variables: [],
      actions: [],
      nodeNames: [],
    }
  }

  /**
   * Check if the service is healthy
   */
  isHealthy(): boolean {
    return this.compilerService !== null && this.initError === null
  }

  /**
   * Update the LSP state with new compilation results
   */
  async updateFromSource(content: string, fileUri: string = 'file:///script.yarn'): Promise<LspState> {
    try {
      this.initialize()

      if (!this.compilerService) {
        console.warn('[LSP] Compiler service not available')
        return this.state
      }

      console.log('[LSP] Compiling source...', content.length, 'chars')
      this.lastResult = await this.compilerService.compile({
        files: [{ uri: fileUri, content }]
      })

      // Extract state from result
      this.state = {
        nodes: this.lastResult.nodes || [],
        variables: this.lastResult.declarations || [],
        actions: this.lastResult.actions || [],
        nodeNames: (this.lastResult.nodes || []).map(n => n.title),
      }
      console.log('[LSP] State updated:', this.state.nodeNames.length, 'nodes,', this.state.variables.length, 'variables')
    } catch (error) {
      console.error('[LSP] Compilation error:', error)
      // Don't reset state on error - keep last known good state
    }

    return this.state
  }

  /**
   * Update the LSP state from an already-completed compilation result.
   * This avoids a redundant WASM compile when the main compilation has already run.
   */
  updateFromCompilationResult(content: string, result: { nodes?: Record<string, any>; variableDeclarations?: Record<string, any> }): void {
    try {
      this.initialize()

      // Extract node names from the compilation result
      const nodeNames = Object.keys(result.nodes || {})

      // Extract variable declarations
      const variables: LspDeclaration[] = Object.entries(result.variableDeclarations || {}).map(([name, decl]: [string, any]) => ({
        name,
        type: (decl.type?.toLowerCase() || 'any') as 'string' | 'number' | 'boolean',
        description: decl.description,
      }))

      // Build node info from result (providing all required LspNodeInfo fields)
      const nodes: LspNodeInfo[] = nodeNames.map(name => ({
        title: name,
        uri: 'file:///script.yarn',
        jumps: [],
        functionCalls: [],
        commandCalls: [],
        variableReferences: [],
        nodeGroupComplexity: 0,
        characterNames: [],
        tags: [],
        previewText: '',
        optionCount: 0,
        headerStartLine: 0,
        titleLine: 0,
        bodyStartLine: 0,
        bodyEndLine: 0,
      }))

      this.state = {
        nodes,
        variables,
        actions: this.state.actions, // Preserve existing actions
        nodeNames,
      }
    } catch (error) {
      console.error('[LSP] Error updating from compilation result:', error)
    }
  }

  /**
   * Get current LSP state
   */
  getState(): LspState {
    return this.state
  }

  /**
   * Get completions at a position
   * Returns empty array on error - never throws
   */
  getCompletions(content: string, line: number, column: number): CompletionItem[] {
    try {
      const lines = content.split('\n')
      const currentLine = lines[line] || ''
      const textBeforeCursor = currentLine.substring(0, column)

      const completions: CompletionItem[] = []

      // Check what context we're in
      const inCommand = /<<[^>]*$/.test(textBeforeCursor)
      const inExpression = /\{[^}]*$/.test(textBeforeCursor) || inCommand
      const afterDollar = /\$\w*$/.test(textBeforeCursor)
      const afterArrow = /->\s*\w*$/.test(textBeforeCursor) || /<<\s*(jump|detour)\s+\w*$/i.test(textBeforeCursor)
      const afterCommandStart = /<<\s*\w*$/.test(textBeforeCursor)

      // Variable completions (after $)
      if (afterDollar) {
        for (const variable of this.state.variables) {
          completions.push({
            label: variable.name,
            kind: 'variable',
            detail: `${variable.type} variable`,
            insertText: variable.name.startsWith('$') ? variable.name.substring(1) : variable.name,
          })
        }
      }

      // Node completions (after -> or jump/detour)
      if (afterArrow) {
        for (const nodeName of this.state.nodeNames) {
          completions.push({
            label: nodeName,
            kind: 'node',
            detail: 'Node',
            insertText: nodeName,
          })
        }
      }

      // Command completions (after <<)
      if (afterCommandStart && !afterArrow) {
        // Built-in commands
        const builtInCommands = ['if', 'else', 'elseif', 'endif', 'set', 'declare', 'jump', 'detour', 'return', 'stop', 'wait', 'screen_shake', 'set_saliency', 'fade_out', 'fade_in']
        for (const cmd of builtInCommands) {
          completions.push({
            label: cmd,
            kind: 'keyword',
            detail: 'keyword',
            insertText: cmd,
          })
        }

        // Custom commands from actions
        for (const action of this.state.actions) {
          if (action.isCommand) {
            completions.push({
              label: action.name,
              kind: 'command',
              detail: action.signature || `${action.name}()`,
              insertText: action.name,
            })
          }
        }
      }

      // Function completions (in expressions)
      if (inExpression && !afterDollar && !afterArrow && !afterCommandStart) {
        // Built-in functions
        for (const [name, doc] of Object.entries(FUNCTION_DOCS)) {
          completions.push({
            label: name,
            kind: 'function',
            detail: doc.signature,
            insertText: name + '()',
          })
        }

        // Custom functions from actions
        for (const action of this.state.actions) {
          if (!action.isCommand) {
            completions.push({
              label: action.name,
              kind: 'function',
              detail: action.signature || `${action.name}(): ${action.returnType || 'any'}`,
              insertText: action.name + '()',
            })
          }
        }
      }

      return completions
    } catch (error) {
      console.error('[LSP] Error getting completions:', error)
      return []
    }
  }

  /**
   * Get hover information at a position
   * Returns null on error - never throws
   */
  getHoverInfo(content: string, line: number, column: number): HoverInfo | null {
    try {
      const lines = content.split('\n')
      const currentLine = lines[line] || ''

      // Find the word at the cursor position
      const wordMatch = this.getWordAtPosition(currentLine, column)
      if (!wordMatch) {
        return null
      }

      const { word, start, end } = wordMatch

      // Check if it's a built-in keyword, command, or function
      const builtinDoc = getBuiltinDoc(word)
      if (builtinDoc) {
        return {
          contents: formatBuiltinHover(builtinDoc),
          range: { start: { line, character: start }, end: { line, character: end } }
        }
      }

      // Check if it's a variable (preceded by $)
      if (start > 0 && currentLine[start - 1] === '$') {
        const varName = word
        const variable = this.state.variables.find(v =>
          v.name === varName || v.name === '$' + varName
        )
        if (variable) {
          // Prefer LSP description, fallback to parsing /// comments manually
          const description = variable.description || this.findVariableDocComment(lines, varName) || 'Variable'
          return {
            contents: `**$${varName}** (${variable.type})\n\n${description}`,
            range: { start: { line, character: start - 1 }, end: { line, character: end } }
          }
        }
      }

      // Check if it's a node name
      const node = this.state.nodes.find(n => n.title === word)
      if (node) {
        const preview = node.previewText ? `\n\n> ${node.previewText}...` : ''
        const tags = node.tags.length > 0 ? `\n\nTags: ${node.tags.join(', ')}` : ''
        return {
          contents: `**${word}** (Node)${tags}${preview}`,
          range: { start: { line, character: start }, end: { line, character: end } }
        }
      }

      // Check if it's a function or command
      const action = this.state.actions.find(a => a.name === word)
      if (action) {
        const kind = action.isCommand ? 'Command' : 'Function'
        const sig = action.signature || `${action.name}()`
        return {
          contents: `**${word}** (${kind})\n\n\`${sig}\``,
          range: { start: { line, character: start }, end: { line, character: end } }
        }
      }

      return null
    } catch (error) {
      console.error('[LSP] Error getting hover info:', error)
      return null
    }
  }

  /**
   * Get definition location for a symbol
   * Returns null on error - never throws
   */
  getDefinition(content: string, line: number, column: number): DefinitionLocation | null {
    try {
      const lines = content.split('\n')
      const currentLine = lines[line] || ''

      const wordMatch = this.getWordAtPosition(currentLine, column)
      if (!wordMatch) {
        return null
      }

      const { word } = wordMatch

      // Check if it's a node name - find its definition by searching content
      const nodeExists = this.state.nodeNames.includes(word)
      if (nodeExists) {
        // Search for the title: line in the content
        for (let i = 0; i < lines.length; i++) {
          const titleMatch = lines[i].match(/^title:\s*(.+)$/)
          if (titleMatch && titleMatch[1].trim() === word) {
            return {
              uri: 'file:///script.yarn',
              range: {
                start: { line: i, character: 0 },
                end: { line: i, character: lines[i].length }
              }
            }
          }
        }
      }

      // Check if it's a variable - find its declaration
      const variable = this.state.variables.find(v =>
        v.name === word || v.name === '$' + word
      )
      if (variable && variable.range) {
        return {
          uri: variable.sourceUri || 'file:///script.yarn',
          range: variable.range
        }
      }

      // For variables without a known definition, search the content
      if (variable || (currentLine[Math.max(0, column - word.length - 1)] === '$')) {
        const varName = word.startsWith('$') ? word : '$' + word
        // Find <<declare $varName or <<set $varName
        for (let i = 0; i < lines.length; i++) {
          const declareMatch = lines[i].match(new RegExp(`<<\\s*declare\\s+\\${varName}`))
          if (declareMatch) {
            return {
              uri: 'file:///script.yarn',
              range: {
                start: { line: i, character: declareMatch.index || 0 },
                end: { line: i, character: (declareMatch.index || 0) + declareMatch[0].length }
              }
            }
          }
        }
      }

      return null
    } catch (error) {
      console.error('[LSP] Error getting definition:', error)
      return null
    }
  }

  /**
   * Find /// documentation comments above a variable declaration
   */
  private findVariableDocComment(lines: string[], varName: string): string | null {
    // Find the line where the variable is declared
    const varPattern = new RegExp(`<<\\s*declare\\s+\\$${varName}\\b`)
    let declareLine = -1

    for (let i = 0; i < lines.length; i++) {
      if (varPattern.test(lines[i])) {
        declareLine = i
        break
      }
    }

    if (declareLine <= 0) {
      return null
    }

    // Collect /// comments above the declaration
    const docLines: string[] = []
    for (let i = declareLine - 1; i >= 0; i--) {
      const trimmed = lines[i].trim()
      if (trimmed.startsWith('///')) {
        // Extract the comment text (remove /// and leading space)
        const commentText = trimmed.substring(3).trim()
        docLines.unshift(commentText)
      } else if (trimmed === '') {
        // Skip empty lines but continue looking
        continue
      } else {
        // Hit a non-comment, non-empty line - stop
        break
      }
    }

    return docLines.length > 0 ? docLines.join('\n') : null
  }

  /**
   * Helper to get word at a position
   */
  private getWordAtPosition(line: string, column: number): { word: string; start: number; end: number } | null {
    // Find word boundaries
    let start = column
    let end = column

    // Move start backwards to find word beginning
    while (start > 0 && /[\w]/.test(line[start - 1])) {
      start--
    }

    // Move end forwards to find word end
    while (end < line.length && /[\w]/.test(line[end])) {
      end++
    }

    if (start === end) {
      return null
    }

    return {
      word: line.substring(start, end),
      start,
      end
    }
  }
}

export interface CompletionItem {
  label: string
  kind: 'variable' | 'node' | 'function' | 'command' | 'keyword'
  detail: string
  insertText: string
}

export interface HoverInfo {
  contents: string
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

export interface DefinitionLocation {
  uri: string
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

// Export singleton instance
export const LspService = new LspServiceImpl()
