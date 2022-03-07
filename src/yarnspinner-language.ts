import type { languages } from "monaco-editor";

/** The Monaco language configuration for Yarn Spinner. */
export const configuration: languages.LanguageConfiguration = {
    comments: {
        lineComment: '//'
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' }
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' }
    ],
    folding: {
        markers: {
            // title: is _usually_ the first tag, but isn't guaranteed to
            // be; this is probably fine though
            start: /^title:/,
            end: /^===$/
        }
    }
};

/** The tokenisation rules for  for Yarn Spinner. */
export const monarchLanguage = <languages.IMonarchLanguage>{
    // Set defaultToken to invalid to see what you do not tokenize yet

    // The default token, if we haven't matched anything else, is 'line'
    defaultToken: 'line',

    keywords: ['if', "else", "endif", "elseif", "jump", "set", "call"],

    constants: ['true', 'false'],

    // FIXME: NOT actually the correct regex! It doesn't handle the full set of
    // Unicode codepoints that are actually legal in identifiers. See
    // YarnSpinnerLexer.g4 in the code Yarn Spinner project for the full one -
    // this one NEEDS TO BE REPLACED
    identifiers: /[a-zA-Z_][a-zA-Z0-9_]*/,

    numbers: /[0-9]+(\.[0-9]+)?/,

    typeKeywords: [
        'bool', 'string', 'number',
    ],

    variables: /\$@keywords/,

    operators: [
        '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
        '&&', '||', '-', '*', '/', '&', '|', '^', '%',
        '+=', '-=', '*=', '/=', '&=', '|=', '^=',
        '%=', 'and', 'or', 'not', 'is', 'eq', 'neq', 'le', 'leq', 'ge', 'lt', 'le', 'gt', 'gte'
    ],

    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,

    // C# style strings
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer for our languages
    tokenizer: {
        root: [
            [/(@identifiers)(:\s*)(.*)/, [{ token: 'identifier.$1' }, { token: '@default' }, { token: 'string' }]],

            ['---', 'keyword.other', "@node"],

        ],
        node: [

            ['===', 'keyword.other', '@pop'],

            // Commands
            ['<<', 'keyword.other', '@command'],

            // Options
            ['->', 'keyword.other'],

            // Hashtag
            [/#[^\s]+/, 'annotation'],

            // Character names
            [/^\s*[^\s]+?\:/, 'line.character'],

            // // identifiers and keywords
            // [/[a-z_$][\w$]*/, { cases: { '@typeKeywords': 'keyword',
            //                              '@keywords': 'keyword',
            //                              '@default': 'identifier' } }],
            // [/[A-Z][\w\$]*/, 'type.identifier' ],  // to show class names nicely

            // // whitespace
            { include: '@whitespace' },

            // // delimiters and operators
            // [/[{}()\[\]]/, '@brackets'],
            // [/[<>](?!@symbols)/, '@brackets'],
            // [/@symbols/, { cases: { '@operators': 'operator',
            //                         '@default'  : '' } } ],

            // // @ annotations.
            // // As an example, we emit a debugging log message on these tokens.
            // // Note: message are supressed during the first load -- change some lines to see them.
            // [/@\s*[a-zA-Z_\$][\w\$]*/, { token: 'annotation', log: 'annotation token: $0' }],

            // // numbers
            // [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
            // [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            // [/\d+/, 'number'],

            // // delimiter: after number because of .\d floats
            // [/[;,.]/, 'delimiter'],

            // // strings
            // [/"([^"\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
            // [/"/,  { token: 'string.quote', bracket: '@open', next: '@string' } ],

            // // characters
            // [/'[^\\']'/, 'string'],
            // [/(')(@escapes)(')/, ['string','string.escape','string']],
            // [/'/, 'string.invalid']
        ],

        comment: [
            [/[^\/*]+/, 'comment'],
        ],

        string: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],

        whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
        ],

        command: [
            [/@identifiers/, {
                cases: {
                    'jump': { token: 'keyword.$0', next: '@expectIdentifier' },
                    '@keywords': { token: 'keyword.$0' },
                    '@operators': { token: 'operator.$0' },
                    '@typeKeywords': { token: 'type.$0' },
                    '@constants': { token: 'constant.$0' },
                    '@default': 'identifier'
                }
            }],
            [/\$@identifiers/, 'variable'],
            [/@numbers/, 'number'],
            [/[\(\)]/, 'delimiter'],
            ['>>', 'keyword.other', '@pop'],

        ],

        expectIdentifier: [
            [/@identifiers/, 'identifier', '@pop']
        ]
    }
};
