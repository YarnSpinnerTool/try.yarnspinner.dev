import { LanguageSupport, HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { tags as t, classHighlighter } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

interface YarnState {
  inNodeHeader: boolean  // True when we're in the header section of a node (before ---)
  inHeaderValue: boolean  // True when parsing a header value (simple literal)
  inHeaderExpression: boolean  // For headers like "when:" that contain expressions
  inCommand: boolean
  inString: boolean
  lineStart: boolean  // True if we haven't seen non-whitespace yet on this line
  inMarkupTag: boolean  // True when inside [b] or [/b] etc.
}

const yarnLanguage = StreamLanguage.define<YarnState>({
  name: 'yarn',
  startState: () => ({ inNodeHeader: false, inHeaderValue: false, inHeaderExpression: false, inCommand: false, inString: false, lineStart: true, inMarkupTag: false }),

  token(stream, state) {
    // Reset line-specific state at start of line
    if (stream.sol()) {
      state.inHeaderValue = false
      state.inHeaderExpression = false
      state.inCommand = false  // Commands can't span multiple lines
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
    // --- marks the end of the header section and start of body
    if (state.lineStart && stream.match(/---/)) {
      state.lineStart = false
      state.inNodeHeader = false  // Exit header section, enter body
      return 'punctuation'
    }
    // === marks the end of the node (and implicitly starts a new header section)
    if (state.lineStart && stream.match(/===/)) {
      state.lineStart = false
      state.inNodeHeader = true  // Next content will be a new node's header
      return 'punctuation'
    }

    // Header lines - only match in header section (before ---)
    // title: is special - it indicates we're starting a new header section
    if (state.lineStart && stream.match(/title:\s*/)) {
      state.inNodeHeader = true  // We're now in a header section
      state.inHeaderValue = true
      state.lineStart = false
      return 'propertyName'
    }

    // Other header keys only match when we're in the header section
    if (state.lineStart && state.inNodeHeader) {
      // Check for expression headers first (when:)
      if (stream.match(/when:\s*/)) {
        state.inHeaderExpression = true
        state.lineStart = false
        return 'propertyName'
      }
      // Check for any other header (word followed by colon)
      if (stream.match(/[a-zA-Z_][a-zA-Z0-9_]*:\s*/)) {
        state.inHeaderValue = true
        state.lineStart = false
        return 'propertyName'
      }
    }

    // Header expression values (like "when:") - parse like command content
    if (state.inHeaderExpression) {
      // Boolean literals
      if (stream.match(/\b(true|false|null)\b/)) {
        return 'number'
      }
      // Operators (word-based)
      if (stream.match(/\b(and|or|not|is|to|as|eq|neq|gt|gte|lt|lte|xor)\b/)) {
        return 'operator'
      }
      // Numbers
      if (stream.match(/-?\d+(\.\d+)?/)) {
        return 'number'
      }
      // Strings
      if (stream.match(/"[^"]*"/)) {
        return 'string'
      }
      // Variables
      if (stream.match(/\$\w+/)) {
        return 'variableName'
      }
      // Functions - match word followed by paren (but don't consume paren)
      if (/[a-zA-Z_]/.test(stream.peek() ?? '')) {
        const pos = stream.pos
        if (stream.match(/[a-zA-Z_]\w*/)) {
          if (stream.peek() === '(') {
            return 'keyword'  // Function name (purple)
          }
          // Not a function, reset
          stream.pos = pos
        }
      }
      // All parentheses are yellow
      if (stream.match(/[()]/)) {
        return 'punctuation'
      }
      // Operators (symbol-based)
      if (stream.match(/[=<>!+\-*/]+/)) {
        return 'operator'
      }
      stream.next()
      return null
    }

    // Simple header values - green literal
    if (state.inHeaderValue) {
      stream.skipToEnd()
      return 'string'
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
      // Check if this is the first word in the command (right after <<)
      const isFirstWord = stream.string.substring(0, stream.pos).trim() === '<<';

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
      // Functions - match word followed by paren (but don't consume paren)
      if (/[a-zA-Z_]/.test(stream.peek() ?? '')) {
        const pos = stream.pos
        if (stream.match(/[a-zA-Z_]\w*/)) {
          if (stream.peek() === '(') {
            return 'keyword'  // Function name (purple)
          }
          // Not a function, check if first word
          if (isFirstWord) {
            return 'keyword'
          }
          // Otherwise it's an identifier (node name, etc)
          return 'typeName'
        }
        stream.pos = pos  // Reset if no match
      }
      // All parentheses are yellow
      if (stream.match(/[()]/)) {
        return 'punctuation'
      }
      // Identifiers - match word (fallback)
      if (stream.match(/\w+/)) {
        // If this is the first word after <<, it's always a keyword (even if incomplete)
        if (isFirstWord) {
          return 'keyword'
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
    // -> for options, => for line groups
    if (stream.match(/->\s*/) || stream.match(/=>\s*/)) {
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
    // Match opening bracket and tag in one go, but return different tokens
    if (stream.peek() === '[') {
      stream.next() // consume [
      state.inMarkupTag = true
      return 'punctuation' // Yellow bracket
    }

    // Inside markup tag
    if (state.inMarkupTag) {
      // Closing slash [/b]
      if (stream.match(/\//)) {
        return 'punctuation' // Yellow slash
      }
      // Tag name
      if (stream.match(/\w+/)) {
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
        return 'tagName' // Orange tag name
      }
      // Closing bracket
      if (stream.match(/\]/)) {
        state.inMarkupTag = false
        return 'punctuation' // Yellow bracket
      }
    }

    // Inline expressions in dialogue { }
    // We parse the content to highlight functions and variables separately
    if (stream.match(/\{/)) {
      return 'punctuation' // Yellow brace like <<
    }
    if (stream.match(/\}/)) {
      return 'punctuation' // Yellow brace like <<
    }
    // Variables in dialogue (inline expressions)
    if (stream.match(/\$\w+/)) {
      return 'variableName'
    }
    // Functions in dialogue - match word followed by paren (but don't consume paren)
    if (/[a-zA-Z_]/.test(stream.peek() ?? '')) {
      const pos = stream.pos
      if (stream.match(/[a-zA-Z_]\w*/)) {
        if (stream.peek() === '(') {
          return 'keyword'  // Function name (purple)
        }
        // Not a function, reset
        stream.pos = pos
      }
    }
    // All parentheses in dialogue are yellow
    if (stream.match(/[()]/)) {
      return 'punctuation'
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

// Dark theme syntax highlighting (same as light except purple -> #B94CDC, line IDs -> #4D4650)
export const yarnHighlightStyleDark = HighlightStyle.define([
  { tag: t.keyword, color: '#B94CDC' },           // Keywords (declare, set, jump, if, etc.) - purple
  { tag: t.comment, color: '#8A9929', fontStyle: 'italic' }, // Comments
  { tag: t.string, color: '#19A05B' },            // Literal values (strings, node names in headers)
  { tag: t.number, color: '#19A05B' },            // Literal values (numbers, booleans)
  { tag: t.className, color: '#08A6DD' },         // Speaker names (Traveler:, You:)
  { tag: t.typeName, color: '#19A05B' },          // Literal values (node names in commands, parameters)
  { tag: t.bracket, color: '#B94CDC' },           // Command brackets (<< >>)
  { tag: t.operator, color: '#B94CDC' },          // Operators (=, +=, ==, etc.)
  { tag: t.meta, color: '#4D4650' },              // Line tags and metadata (#line:123456)
  { tag: t.punctuation, color: '#F7B500' },       // Punctuation (---, ===, ->, :)
  { tag: t.variableName, color: '#E42C84' },      // Variable names ($trust)
  { tag: t.propertyName, color: '#E42C84' },      // Header field keys (title:, tags:)
  { tag: t.tagName, color: '#FD7C1F' },           // Markup commands ([b], [/b], [anim="..."])
  { tag: [t.function(t.variableName), t.function(t.name)], color: '#B94CDC' }, // Functions
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
  // Function names get purple color, italic styling with subtle underline
  '.cm-line .tok-function': {
    color: '#B94CDC',
    fontStyle: 'italic',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    textDecorationColor: 'rgba(185, 76, 220, 0.4)',
  },
})

// Light theme override for functions
export const yarnSyntaxThemeLight = EditorView.baseTheme({
  '.cm-line .tok-function': {
    color: '#8D11B4',
    textDecorationColor: 'rgba(141, 17, 180, 0.4)',
  },
})

export function yarn(isDark: boolean = true) {
  const highlightStyle = isDark ? yarnHighlightStyleDark : yarnHighlightStyleLight
  const extensions = [
    syntaxHighlighting(highlightStyle),
    syntaxHighlighting(classHighlighter), // Adds .tok-* classes for theme styling
    yarnSyntaxTheme,
  ]
  if (!isDark) {
    extensions.push(yarnSyntaxThemeLight)
  }
  return new LanguageSupport(yarnLanguage, extensions)
}
