/**
 * CodeMirror Extensions for Yarn Spinner LSP Features
 *
 * Provides:
 * - Autocomplete for variables, commands, nodes, functions
 * - Hover tooltips
 * - Go to definition (Cmd/Ctrl+Click or F12)
 */

import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  Completion,
} from '@codemirror/autocomplete'
import { hoverTooltip, Tooltip } from '@codemirror/view'
import { EditorView, keymap } from '@codemirror/view'
import { LspService, CompletionItem } from './lsp-service'

/**
 * Map LSP completion kind to CodeMirror completion type
 */
function mapCompletionKind(kind: CompletionItem['kind']): string {
  switch (kind) {
    case 'variable': return 'variable'
    case 'node': return 'class'
    case 'function': return 'function'
    case 'command': return 'keyword'
    case 'keyword': return 'keyword'
    default: return 'text'
  }
}

/**
 * Autocomplete extension for Yarn Spinner
 */
function yarnCompletionSource(context: CompletionContext): CompletionResult | null {
  // Get completions from LSP service
  const line = context.state.doc.lineAt(context.pos)
  const lineNumber = line.number - 1 // 0-indexed
  const column = context.pos - line.from

  const content = context.state.doc.toString()
  const completions = LspService.getCompletions(content, lineNumber, column)

  if (completions.length === 0) {
    return null
  }

  // Find the start of the current word for replacement
  const textBefore = context.state.sliceDoc(line.from, context.pos)

  // Determine where completions should start
  let from = context.pos

  // Check for different completion triggers
  const dollarMatch = textBefore.match(/\$(\w*)$/)
  if (dollarMatch) {
    from = context.pos - dollarMatch[1].length
  } else {
    const wordMatch = textBefore.match(/(\w+)$/)
    if (wordMatch) {
      from = context.pos - wordMatch[1].length
    }
  }

  const cmCompletions: Completion[] = completions.map(c => {
    const base: Completion = {
      label: c.label,
      type: mapCompletionKind(c.kind),
      detail: c.detail,
      boost: c.kind === 'keyword' ? 2 : c.kind === 'variable' ? 1 : 0,
    }

    // For insertText ending with (), place cursor inside the parens
    if (c.insertText?.endsWith('()')) {
      base.apply = (view, completion, from, to) => {
        const text = c.insertText!
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length - 1 },
        })
      }
    } else {
      base.apply = c.insertText
    }

    return base
  })

  return {
    from,
    options: cmCompletions,
    validFor: /^\w*$/,
  }
}

/**
 * Create the autocomplete extension
 */
export function yarnAutocomplete() {
  return autocompletion({
    override: [yarnCompletionSource],
    activateOnTyping: true,
    icons: true,
  })
}

/**
 * Hover tooltip extension for Yarn Spinner
 */
export function yarnHoverTooltip() {
  return hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
    const content = view.state.doc.toString()
    const line = view.state.doc.lineAt(pos)
    const lineNumber = line.number - 1 // 0-indexed
    const column = pos - line.from

    const hoverInfo = LspService.getHoverInfo(content, lineNumber, column)

    if (!hoverInfo) {
      return null
    }

    // Convert LSP range to CodeMirror positions
    const startLine = view.state.doc.line(hoverInfo.range.start.line + 1)
    const endLine = view.state.doc.line(hoverInfo.range.end.line + 1)
    const from = startLine.from + hoverInfo.range.start.character
    const to = endLine.from + hoverInfo.range.end.character

    return {
      pos: from,
      end: to,
      above: true,
      create() {
        const dom = document.createElement('div')
        dom.className = 'cm-yarn-hover'
        dom.innerHTML = formatHoverContent(hoverInfo.contents)
        return { dom }
      }
    }
  }, {
    hideOnChange: true,
    hoverTime: 300,
  })
}

/**
 * Format hover content (simple markdown-like formatting)
 */
function formatHoverContent(content: string): string {
  return content
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Blockquote
    .replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>')
    // Line breaks
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
}

/**
 * Go to definition handler
 */
function goToDefinition(view: EditorView): boolean {
  const pos = view.state.selection.main.head
  const content = view.state.doc.toString()
  const line = view.state.doc.lineAt(pos)
  const lineNumber = line.number - 1
  const column = pos - line.from

  const definition = LspService.getDefinition(content, lineNumber, column)

  if (!definition) {
    return false
  }

  // Navigate to the definition
  const targetLine = view.state.doc.line(definition.range.start.line + 1)
  const targetPos = targetLine.from + definition.range.start.character

  view.dispatch({
    selection: { anchor: targetPos, head: targetPos },
    scrollIntoView: true,
  })

  return true
}

/**
 * Keymap for go-to-definition (F12)
 */
export function yarnGoToDefinition() {
  return keymap.of([
    {
      key: 'F12',
      run: goToDefinition,
    },
    {
      key: 'Mod-F12',
      run: goToDefinition,
    },
  ])
}

/**
 * Click handler for Cmd/Ctrl+Click go-to-definition
 */
export function yarnClickToDefinition() {
  return EditorView.domEventHandlers({
    click(event: MouseEvent, view: EditorView) {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      if (event.metaKey || event.ctrlKey) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos !== null) {
          // Temporarily set selection to clicked position
          const oldSelection = view.state.selection
          view.dispatch({ selection: { anchor: pos } })

          const result = goToDefinition(view)

          if (!result) {
            // Restore old selection if no definition found
            view.dispatch({ selection: oldSelection })
          }

          return result
        }
      }
      return false
    }
  })
}

/**
 * CSS styles for hover tooltips
 */
export const yarnHoverStyles = EditorView.baseTheme({
  '.cm-tooltip': {
    zIndex: '200 !important', // Above header bar
  },
  '.cm-yarn-hover': {
    padding: '8px 12px',
    backgroundColor: 'var(--hover-bg, #242124)',
    color: 'var(--hover-fg, #F9F7F9)',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '400px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    border: '1px solid var(--hover-border, #534952)',
  },
  '.cm-yarn-hover strong': {
    color: 'var(--hover-title, #7DBD91)',
    fontWeight: '600',
  },
  '.cm-yarn-hover code': {
    backgroundColor: 'var(--hover-code-bg, #3F3A40)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: '"Necto Mono", monospace',
  },
  '.cm-yarn-hover blockquote': {
    borderLeft: '3px solid var(--hover-quote-border, #4C8962)',
    paddingLeft: '8px',
    margin: '8px 0',
    opacity: '0.8',
    fontStyle: 'italic',
  },
  // Light mode overrides
  '&light .cm-yarn-hover': {
    '--hover-bg': '#FFFFFF',
    '--hover-fg': '#242124',
    '--hover-border': '#E5E1E6',
    '--hover-title': '#4C8962',
    '--hover-code-bg': '#F3F4F6',
    '--hover-quote-border': '#4C8962',
  },
})

/**
 * Combined LSP extensions for Yarn Spinner
 * Call this to add all LSP features at once
 */
export function yarnLspExtensions() {
  return [
    yarnAutocomplete(),
    yarnHoverTooltip(),
    yarnGoToDefinition(),
    yarnClickToDefinition(),
    yarnHoverStyles,
  ]
}
