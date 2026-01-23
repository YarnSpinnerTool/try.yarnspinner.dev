import { LanguageSupport, HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { tags as t, classHighlighter } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

interface YarnState {
  inHeader: boolean
  inMetadata: boolean  // For de-emphasized metadata like tags, position, colorID
  inCommand: boolean
  inString: boolean
  lineStart: boolean  // True if we haven't seen non-whitespace yet on this line
}

const yarnLanguage = StreamLanguage.define<YarnState>({
  name: 'yarn',
  startState: () => ({ inHeader: false, inMetadata: false, inCommand: false, inString: false, lineStart: true }),

  token(stream, state) {
    // Reset state at start of line
    if (stream.sol()) {
      state.inHeader = false
      state.inMetadata = false
      state.lineStart = true
    }

    // Skip leading whitespace but stay in lineStart mode
    if (state.lineStart && stream.eatSpace()) {
      return null
    }

    // Comments
    if (stream.match(/\/\/.*/)) {
      return 'comment'
    }

    // Node header markers
    if (state.lineStart && stream.match(/---/)) {
      state.lineStart = false
      return 'punctuation'
    }
    if (state.lineStart && stream.match(/===/)) {
      state.lineStart = false
      return 'punctuation'
    }

    // Title line (prominent) - header key should be pink (VALUE NAME)
    if (state.lineStart && stream.match(/title:\s*/)) {
      state.inHeader = true
      state.lineStart = false
      return 'propertyName'
    }
    if (state.inHeader) {
      stream.skipToEnd()
      return 'string'
    }

    // Metadata header keys (tags, position, colorID) - these are VALUE NAMES
    if (state.lineStart) {
      const match = stream.match(/(tags|position|colorID):/)
      if (match) {
        state.inMetadata = true
        state.lineStart = false
        return 'propertyName'
      }
    }
    if (state.inMetadata) {
      stream.skipToEnd()
      return 'meta'
    }

    // Commands << >>
    if (stream.match(/<<\s*/)) {
      state.inCommand = true
      return 'punctuation'
    }
    if (stream.match(/\s*>>/)) {
      state.inCommand = false
      return 'punctuation'
    }

    if (state.inCommand) {
      // Command keywords
      if (stream.match(/\b(if|else|elseif|endif|set|declare|jump|detour|return|stop|wait|call|once|endonce|enum|endenum|case|local|when|always)\b/)) {
        return 'keyword'
      }
      // Boolean literals (true, false, null) - should be colored as literals
      if (stream.match(/\b(true|false|null)\b/)) {
        return 'number'
      }
      // Operators in commands
      if (stream.match(/\b(and|or|not|is|to|as|eq|neq|gt|gte|lt|lte|xor)\b/)) {
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
      return 'punctuation'
    }

    // Character name at start of line (everything before unescaped colon)
    if (state.lineStart) {
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
          state.lineStart = false
          return 'className'
        }
      }
    }

    // Colon after character name - same color as character name
    if (stream.match(/:\s*/)) {
      return 'className'
    }

    // Markup tags [b], [/b], [wave], [anim="..."], etc.
    if (stream.match(/\[\/?\w+/)) {
      // Check if there are attributes like ="..."
      if (stream.peek() === '=') {
        stream.next() // consume =
        if (stream.peek() === '"') {
          stream.next() // consume opening "
          while (stream.peek() && stream.peek() !== '"') {
            stream.next()
          }
          if (stream.peek() === '"') {
            stream.next() // consume closing "
          }
        }
      }
      if (stream.peek() === ']') {
        stream.next() // consume ]
      }
      return 'tagName' // Markup commands
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
    state.lineStart = false
    stream.next()
    return null
  },

  languageData: {
    commentTokens: { line: '//' },
  },
})

// Dark theme syntax highlighting (brighter colors for dark background)
export const yarnHighlightStyleDark = HighlightStyle.define([
  { tag: t.keyword, color: '#C678DD' },           // Keywords (declare, set, jump, if, etc.) - bright purple
  { tag: t.comment, color: '#A9B665', fontStyle: 'italic' }, // Comments - olive/yellow-green
  { tag: t.string, color: '#98C379' },            // Literal values (strings, node names in headers) - green
  { tag: t.number, color: '#98C379' },            // Literal values (numbers, booleans) - green
  { tag: t.className, color: '#61AFEF' },         // Speaker names (Traveler:, You:) - cyan
  { tag: t.typeName, color: '#98C379' },          // Literal values (node names in commands, parameters) - green
  { tag: t.bracket, color: '#C678DD' },           // Command brackets (<< >>) - bright purple
  { tag: t.operator, color: '#C678DD' },          // Operators (=, +=, ==, etc.) - bright purple
  { tag: t.meta, color: '#888888' },              // Line tags and metadata (#line:123456) - gray
  { tag: t.punctuation, color: '#E5C07B' },       // Punctuation (---, ===, ->, :) - yellow/orange
  { tag: t.variableName, color: '#E879F9' },      // Variable names ($trust) - bright pink
  { tag: t.propertyName, color: '#E879F9' },      // Header field keys (title:, tags:) - bright pink
  { tag: t.tagName, color: '#D19A66' },           // Markup commands ([b], [/b], [anim="..."]) - orange
  { tag: [t.function(t.variableName), t.function(t.name)], color: '#C678DD' }, // Functions - bright purple
])

// Light theme syntax highlighting
export const yarnHighlightStyleLight = HighlightStyle.define([
  { tag: t.keyword, color: '#8D11B4' },           // Keywords (declare, set, jump, if, etc.)
  { tag: t.comment, color: '#8A9929', fontStyle: 'italic' }, // Comments
  { tag: t.string, color: '#19A05B' },            // Literal values (strings, node names in headers)
  { tag: t.number, color: '#19A05B' },            // Literal values (numbers)
  { tag: t.className, color: '#08A6DD' }, // Speaker names (Traveler:, You:)
  { tag: t.typeName, color: '#19A05B' },          // Literal values (node names in commands, parameters)
  { tag: t.bracket, color: '#8D11B4' },           // Command brackets (<< >>)
  { tag: t.operator, color: '#8D11B4' },          // Operators (=, +=, ==, etc.)
  { tag: t.meta, color: '#CBC7CC' },              // Line tags and metadata (#line:123456)
  { tag: t.punctuation, color: '#F7B500' },       // Punctuation (---, ===, ->, :)
  { tag: t.variableName, color: '#E42C84' },      // Variable names ($trust)
  { tag: t.propertyName, color: '#E42C84' },      // Header field keys (title:, tags:)
  { tag: t.tagName, color: '#FD7C1F' },           // Markup commands ([b], [/b], [anim="..."])
  { tag: [t.function(t.variableName), t.function(t.name)], color: '#8D11B4' }, // Functions
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
    textUnderlineOffset: '2px',
  },
  // Light mode function underline
  '&light .tok-function': {
    textDecorationColor: 'rgba(141, 17, 180, 0.4)', // Based on #8D11B4
  },
  // Dark mode function underline
  '&dark .tok-function': {
    textDecorationColor: 'rgba(198, 120, 221, 0.4)', // Based on #C678DD
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
