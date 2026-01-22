/**
 * CodeMirror Themes
 */

import { EditorView } from '@codemirror/view'

// Light theme for CodeMirror (matches theme_palette_light)
export const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#F9F7F9', // Code background from palette
    color: '#4D464F', // Text from palette
    height: '100%',
    fontFamily: '"Necto Mono", monospace',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: '"Necto Mono", monospace',
    fontVariantLigatures: 'none',
  },
  '.cm-content': {
    caretColor: '#4D464F',
    fontFamily: '"Necto Mono", monospace',
    fontVariantLigatures: 'none',
  },
  '.cm-line': {
    fontFamily: '"Necto Mono", monospace',
    fontVariantLigatures: 'none',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#4D464F',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#d1d5db',
  },
  '.cm-panels': {
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid #e5e7eb',
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: '1px solid #e5e7eb',
  },
  '.cm-searchMatch': {
    backgroundColor: '#fef08a',
    outline: '1px solid #fde047',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: '#fde047',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#e0f2fe',
  },
  '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: '#dbeafe',
    outline: '1px solid #93c5fd',
  },
  '.cm-gutters': {
    backgroundColor: '#F9F7F9', // Match code background
    color: '#CBC7CC', // Lighter text for line numbers
    border: 'none',
    borderRight: '1px solid #E5E1E6',
    fontFamily: '"Necto Mono", monospace',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(77, 70, 79, 0.05)', // Subtle highlight using text color
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6b7280',
  },
  '.cm-tooltip': {
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
  },
  '.cm-tooltip .cm-tooltip-arrow:before': {
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  '.cm-tooltip .cm-tooltip-arrow:after': {
    borderTopColor: '#ffffff',
    borderBottomColor: '#ffffff',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: '#e0f2fe',
      color: '#1f2937',
    },
  },
  // Character link styling for light theme
  '.cm-character-link': {
    color: '#79A5B7', // Types, Speaker Names from palette
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
  },
}, { dark: false })

// Dark theme for CodeMirror (matches theme_palette_dark)
export const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#4C434F', // Code background from palette
    color: '#B0AAB2', // Text from palette
    fontFamily: '"Necto Mono", monospace',
  },
  '.cm-scroller': {
    fontFamily: '"Necto Mono", monospace',
    fontVariantLigatures: 'none',
  },
  '.cm-content': {
    caretColor: '#B0AAB2',
    fontFamily: '"Necto Mono", monospace',
    fontVariantLigatures: 'none',
  },
  '.cm-line': {
    fontFamily: '"Necto Mono", monospace',
    fontVariantLigatures: 'none',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#B0AAB2',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(176, 170, 178, 0.25)', // Text color with transparency
  },
  '.cm-panels': {
    backgroundColor: '#1D1B1E', // Dark Background from palette
    color: '#B0AAB2',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid #796D7D',
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: '1px solid #796D7D',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(245, 196, 90, 0.3)', // Keywords color with transparency
    outline: '1px solid #F5C45A',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(245, 196, 90, 0.5)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(176, 170, 178, 0.08)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(121, 165, 183, 0.2)', // Types color with transparency
  },
  '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: 'rgba(245, 196, 90, 0.2)', // Keywords/Brackets color
    outline: '1px solid #F5C45A',
  },
  '.cm-gutters': {
    backgroundColor: '#4C434F', // Match code background
    color: '#796D7D', // Line Tags color for line numbers
    border: 'none',
    borderRight: '1px solid #796D7D',
    fontFamily: '"Necto Mono", monospace',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(176, 170, 178, 0.08)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#A8BD9B', // Comments color
  },
  '.cm-tooltip': {
    border: '1px solid #796D7D',
    backgroundColor: '#1D1B1E', // Dark Background
    color: '#B0AAB2',
  },
  '.cm-tooltip .cm-tooltip-arrow:before': {
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  '.cm-tooltip .cm-tooltip-arrow:after': {
    borderTopColor: '#1D1B1E',
    borderBottomColor: '#1D1B1E',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: 'rgba(121, 165, 183, 0.3)', // Types color
      color: '#B0AAB2',
    },
  },
  // Character link styling for dark theme
  '.cm-character-link': {
    color: '#79A5B7', // Types, Speaker Names from palette
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
  },
}, { dark: true })

/**
 * Create custom theme with dynamic font size and family
 */
export function createCustomTheme(fontSize: number, fontFamily: string) {
  return EditorView.theme({
    '&': {
      height: '100%',
      fontSize: `${fontSize}px`,
    },
    '.cm-scroller': {
      fontFamily: `${fontFamily} !important`,
      overflow: 'auto',
    },
    '.cm-content': {
      fontFamily: `${fontFamily} !important`,
      padding: '8px 0',
    },
    '.cm-line': {
      fontFamily: `${fontFamily} !important`,
    },
    '.cm-gutters': {
      fontFamily: `${fontFamily} !important`,
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 8px',
      minWidth: '40px',
      '@media (max-width: 768px)': {
        padding: '0 6px 0 8px',
      },
    },
  })
}
