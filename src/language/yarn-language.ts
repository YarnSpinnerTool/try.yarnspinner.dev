import { LanguageSupport, HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { tags as t, classHighlighter } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

interface YarnState {
  inHeader: boolean
  inMetadata: boolean  // For de-emphasized metadata like tags, position, colorID
  inCommand: boolean
  inString: boolean
}

const yarnLanguage = StreamLanguage.define<YarnState>({
  name: 'yarn',
  startState: () => ({ inHeader: false, inMetadata: false, inCommand: false, inString: false }),

  token(stream, state) {
    // Skip whitespace at start of line for indentation tracking
    if (stream.sol()) {
      state.inHeader = false
      state.inMetadata = false
    }

    // Comments
    if (stream.match(/\/\/.*/)) {
      return 'comment'
    }

    // Node header markers
    if (stream.sol() && stream.match(/---/)) {
      return 'keyword'
    }
    if (stream.sol() && stream.match(/===/)) {
      return 'keyword'
    }

    // Title line (prominent)
    if (stream.sol() && stream.match(/title:\s*/)) {
      state.inHeader = true
      return 'keyword'
    }
    if (state.inHeader) {
      stream.skipToEnd()
      return 'string'
    }

    // Metadata lines (de-emphasized: tags, position, colorID)
    if (stream.sol() && stream.match(/(tags|position|colorID):\s*/)) {
      state.inMetadata = true
      return 'meta'
    }
    if (state.inMetadata) {
      stream.skipToEnd()
      return 'meta'
    }

    // Commands << >>
    if (stream.match(/<<\s*/)) {
      state.inCommand = true
      return 'bracket'
    }
    if (stream.match(/\s*>>/)) {
      state.inCommand = false
      return 'bracket'
    }

    if (state.inCommand) {
      // Command keywords
      if (stream.match(/\b(if|else|elseif|endif|set|declare|jump|detour|return|stop|wait|call|once|endonce|enum|endenum|case|local|when|always)\b/)) {
        return 'keyword'
      }
      // Operators in commands
      if (stream.match(/\b(and|or|not|is|to|true|false|null|as|eq|neq|gt|gte|lt|lte|xor)\b/)) {
        return 'operator'
      }
      // Type names
      if (stream.match(/\b(string|number|bool)\b/)) {
        return 'typeName'
      }
      // Numbers
      if (stream.match(/-?\d+(\.\d+)?/)) {
        return 'number'
      }
      // Strings in commands
      if (stream.match(/"[^"]*"/)) {
        return 'string'
      }
      // Variables
      if (stream.match(/\$\w+/)) {
        return 'variableName'
      }
      // Identifiers and functions - match word, then check if followed by (
      if (stream.match(/\w+/)) {
        // If followed by (, it's a function call
        if (stream.peek() === '(') {
          return 'function'
        }
        // Otherwise it's an identifier (node name, etc)
        return 'typeName'
      }
      // Operators
      if (stream.match(/[=<>!+\-*/]+/)) {
        return 'operator'
      }
      stream.next()
      return null
    }

    // Options (shortcut syntax) - match at start of line or after whitespace
    if (stream.match(/->\s*/)) {
      return 'keyword'
    }

    // Character name at start of line (everything before unescaped colon)
    if (stream.sol()) {
      const lineText = stream.string

      // Find first unescaped colon
      let colonPos = -1
      for (let i = 0; i < lineText.length; i++) {
        if (lineText[i] === '\\') {
          i++; // skip escaped character
        } else if (lineText[i] === ':') {
          colonPos = i
          break
        }
      }

      // If there's a colon and some text before it, this might be a character line
      if (colonPos > 0 && colonPos < 100) {
        const charName = lineText.substring(0, colonPos).trim()

        // Check it's not empty and not a keyword
        if (charName.length > 0 && !/^(if|else|elseif|set|declare)/.test(charName)) {
          // Match up to (but not including) the colon
          while (stream.pos < colonPos) {
            stream.next()
          }
          return 'className'
        }
      }
    }

    // Colon after character name
    if (stream.match(/:\s*/)) {
      return 'punctuation'
    }

    // Inline expressions in dialogue { }
    // We parse the content to highlight functions and variables separately
    if (stream.match(/\{/)) {
      return 'bracket'
    }
    if (stream.match(/\}/)) {
      return 'bracket'
    }
    // Variables in dialogue (inline expressions)
    if (stream.match(/\$\w+/)) {
      return 'variableName'
    }
    // Functions in dialogue - only match word+( pattern to avoid consuming regular words
    // Use a simple check: if current char starts a word and is followed by (, match it
    if (/[a-zA-Z_]/.test(stream.peek() ?? '')) {
      const pos = stream.pos
      if (stream.match(/[a-zA-Z_]\w*/)) {
        if (stream.peek() === '(') {
          return 'function'
        }
        // Not a function, reset position
        stream.pos = pos
      }
    }

    // Hashtags for line tags (supports multi-part tags like #location:archives or #arms:on-hips)
    if (stream.match(/#[a-zA-Z_][a-zA-Z0-9_:\-]*/)) {
      return 'meta'
    }

    // Everything else is dialogue text
    stream.next()
    return null
  },

  languageData: {
    commentTokens: { line: '//' },
  },
})

// Dark theme syntax highlighting (matches theme_palette_dark)
export const yarnHighlightStyleDark = HighlightStyle.define([
  { tag: t.keyword, color: '#F5C45A' },           // Keywords, Brackets from palette
  { tag: t.comment, color: '#A8BD9B', fontStyle: 'italic' }, // Comments from palette
  { tag: t.string, color: '#F2A9A0' },            // Literals, Node Names from palette
  { tag: t.number, color: '#F2A9A0' },            // Literals from palette
  { tag: t.className, color: '#79A5B7', fontWeight: 'bold' }, // Types, Speaker Names from palette
  { tag: t.typeName, color: '#79A5B7' },          // Types, Speaker Names from palette
  { tag: t.bracket, color: '#F5C45A' },           // Keywords, Brackets from palette
  { tag: t.operator, color: '#B0AAB2' },          // Text color from palette
  { tag: t.meta, color: '#796D7D' },              // Line Tags from palette
  { tag: t.punctuation, color: '#B0AAB2' },       // Text color from palette
  { tag: t.variableName, color: '#E4542C' },      // Variables from palette
  // Function styling
  { tag: [t.function(t.variableName), t.function(t.name)], color: '#F2A9A0', fontStyle: 'italic' },
])

// Light theme syntax highlighting (matches theme_palette_light)
export const yarnHighlightStyleLight = HighlightStyle.define([
  { tag: t.keyword, color: '#E5A83C' },           // Keywords, Brackets from palette
  { tag: t.comment, color: '#7AA479', fontStyle: 'italic' }, // Comments from palette
  { tag: t.string, color: '#F2A9A0' },            // Literals, Node Names from palette
  { tag: t.number, color: '#F2A9A0' },            // Literals from palette
  { tag: t.className, color: '#79A5B7', fontWeight: 'bold' }, // Types, Speaker Names from palette
  { tag: t.typeName, color: '#79A5B7' },          // Types, Speaker Names from palette
  { tag: t.bracket, color: '#E5A83C' },           // Keywords, Brackets from palette
  { tag: t.operator, color: '#4D464F' },          // Text color from palette
  { tag: t.meta, color: '#CBC7CC' },              // Line Tags from palette
  { tag: t.punctuation, color: '#4D464F' },       // Text color from palette
  { tag: t.variableName, color: '#E4542C' },      // Variables from palette
  // Function styling
  { tag: [t.function(t.variableName), t.function(t.name)], color: '#F2A9A0', fontStyle: 'italic' },
])

// Keep original as dark (for backwards compatibility)
export const yarnHighlightStyle = yarnHighlightStyleDark

/**
 * Base theme for Yarn syntax highlighting.
 * Uses CodeMirror's theme system for reliable CSS application.
 */
export const yarnSyntaxTheme = EditorView.baseTheme({
  // Function names get italic styling with subtle underline (color from highlight style)
  '.tok-function': {
    fontStyle: 'italic',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(242, 169, 160, 0.4)', // Based on #F2A9A0
    textUnderlineOffset: '2px',
  },
})

export function yarn(isDark: boolean = true) {
  const highlightStyle = isDark ? yarnHighlightStyleDark : yarnHighlightStyleLight
  return new LanguageSupport(yarnLanguage, [
    syntaxHighlighting(highlightStyle),
    syntaxHighlighting(classHighlighter), // Adds .tok-* classes for theme styling
    yarnSyntaxTheme,
  ])
}
