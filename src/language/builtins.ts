/**
 * Built-in Yarn Spinner Commands and Functions Documentation
 *
 * Provides hover documentation for:
 * - Control flow commands (if, else, elseif, endif, set, declare, jump, detour, return, etc.)
 * - Built-in commands (wait, stop)
 * - Built-in functions (visited, dice, random, round, etc.)
 */

export interface BuiltinDoc {
  name: string
  kind: 'command' | 'function' | 'keyword'
  signature: string
  description: string
  parameters?: Array<{
    name: string
    type: string
    description?: string
  }>
  returnType?: string
}

/**
 * Documentation for control flow keywords
 */
export const CONTROL_FLOW_DOCS: Record<string, BuiltinDoc> = {
  if: {
    name: 'if',
    kind: 'keyword',
    signature: '<<if expression>>',
    description: 'Starts a conditional block. The content inside will only run if the expression evaluates to true.',
  },
  elseif: {
    name: 'elseif',
    kind: 'keyword',
    signature: '<<elseif expression>>',
    description: 'Adds an alternative condition to an if block. Runs if the previous if/elseif conditions were false and this expression is true.',
  },
  else: {
    name: 'else',
    kind: 'keyword',
    signature: '<<else>>',
    description: 'The fallback branch of an if block. Runs if all previous if/elseif conditions were false.',
  },
  endif: {
    name: 'endif',
    kind: 'keyword',
    signature: '<<endif>>',
    description: 'Closes an if block. Required after every if statement.',
  },
  set: {
    name: 'set',
    kind: 'keyword',
    signature: '<<set $variable = value>>',
    description: 'Sets a variable to a value. The variable must be declared first, or use declare to create it.',
    parameters: [
      { name: '$variable', type: 'variable', description: 'The variable to set' },
      { name: 'value', type: 'any', description: 'The value to assign' },
    ],
  },
  declare: {
    name: 'declare',
    kind: 'keyword',
    signature: '<<declare $variable = value>>',
    description: 'Declares a new variable with an initial value. The type is inferred from the value. Use this to create variables before using them.',
    parameters: [
      { name: '$variable', type: 'variable', description: 'The variable name (must start with $)' },
      { name: 'value', type: 'any', description: 'The initial value (determines the type)' },
    ],
  },
  jump: {
    name: 'jump',
    kind: 'keyword',
    signature: '<<jump NodeName>>',
    description: 'Immediately moves execution to another node. The current node ends and the target node begins.',
    parameters: [
      { name: 'NodeName', type: 'string', description: 'The name of the node to jump to' },
    ],
  },
  detour: {
    name: 'detour',
    kind: 'keyword',
    signature: '<<detour NodeName>>',
    description: 'Temporarily visits another node, then returns. Like a function call - execution continues after the detour when the target node ends or uses <<return>>.',
    parameters: [
      { name: 'NodeName', type: 'string', description: 'The name of the node to detour to' },
    ],
  },
  return: {
    name: 'return',
    kind: 'keyword',
    signature: '<<return>>',
    description: 'Returns from a detour to the calling node. If not in a detour, ends the dialogue.',
  },
  call: {
    name: 'call',
    kind: 'keyword',
    signature: '<<call expression>>',
    description: 'Evaluates an expression (typically a function call) without using its result. Useful for calling functions that have side effects.',
  },
  once: {
    name: 'once',
    kind: 'keyword',
    signature: '<<once>>...<<endonce>>',
    description: 'Content inside a once block will only run the first time it is encountered. On subsequent visits, it is skipped.',
  },
  endonce: {
    name: 'endonce',
    kind: 'keyword',
    signature: '<<endonce>>',
    description: 'Closes a once block.',
  },
  local: {
    name: 'local',
    kind: 'keyword',
    signature: '<<local $variable = value>>',
    description: 'Declares a variable that only exists within the current node. It is reset each time the node is entered.',
  },
}

/**
 * Documentation for built-in commands
 */
export const COMMAND_DOCS: Record<string, BuiltinDoc> = {
  wait: {
    name: 'wait',
    kind: 'command',
    signature: '<<wait duration>>',
    description: 'Pauses the dialogue for a specified number of seconds, and then resumes.',
    parameters: [
      { name: 'duration', type: 'number', description: 'Seconds to wait. Can be integers or decimals.' },
    ],
  },
  stop: {
    name: 'stop',
    kind: 'command',
    signature: '<<stop>>',
    description: 'Immediately ends the dialogue, as though the game had reached the end of a node. Use this if you need to leave a conversation in the middle of an if statement, or a shortcut option.',
  },
  screen_shake: {
    name: 'screen_shake',
    kind: 'command',
    signature: '<<screen_shake intensity>>',
    description: 'Shakes the dialogue panel. The optional intensity parameter controls how strong the shake is (1–30 pixels, default 5).',
    parameters: [
      { name: 'intensity', type: 'number', description: 'Shake strength in pixels (1–30, default 5)' },
    ],
  },
  set_saliency: {
    name: 'set_saliency',
    kind: 'command',
    signature: '<<set_saliency strategy>>',
    description: 'Changes the saliency strategy used when selecting which options or node group members to present.',
    parameters: [
      { name: 'strategy', type: 'string', description: 'One of: first, random, best, best_least_recent, random_best_least_recent' },
    ],
  },
  fade_out: {
    name: 'fade_out',
    kind: 'command',
    signature: '<<fade_out duration>>',
    description: 'Fades the dialogue panel to black over the given duration in seconds (default 0.5). Dialogue pauses until the fade completes, then auto-continues.',
    parameters: [
      { name: 'duration', type: 'number', description: 'Fade duration in seconds (0.1–5, default 0.5)' },
    ],
  },
  fade_in: {
    name: 'fade_in',
    kind: 'command',
    signature: '<<fade_in duration>>',
    description: 'Fades the dialogue panel back in from black over the given duration in seconds (default 0.5). Dialogue pauses until the fade completes, then auto-continues.',
    parameters: [
      { name: 'duration', type: 'number', description: 'Fade duration in seconds (0.1–5, default 0.5)' },
    ],
  },
}

/**
 * Documentation for built-in functions
 */
export const FUNCTION_DOCS: Record<string, BuiltinDoc> = {
  // Visit tracking
  visited: {
    name: 'visited',
    kind: 'function',
    signature: 'visited(node_name)',
    description: 'Returns true if the node has been entered and exited at least once before, otherwise returns false. Will return false if node_name doesn\'t match a node in the project.',
    parameters: [{ name: 'node_name', type: 'string', description: 'The title of the node to check' }],
    returnType: 'bool',
  },
  visited_count: {
    name: 'visited_count',
    kind: 'function',
    signature: 'visited_count(node_name)',
    description: 'Returns the number of times the node has been entered and exited. Returns 0 if never visited or if node_name doesn\'t match a node in the project.',
    parameters: [{ name: 'node_name', type: 'string', description: 'The title of the node to check' }],
    returnType: 'number',
  },

  // Random
  random: {
    name: 'random',
    kind: 'function',
    signature: 'random()',
    description: 'Returns a random number between 0 and 1 each time you call it.',
    returnType: 'number',
  },
  random_range: {
    name: 'random_range',
    kind: 'function',
    signature: 'random_range(a, b)',
    description: 'Returns a random integer between a and b, inclusive.',
    parameters: [
      { name: 'a', type: 'number', description: 'Lower bound (inclusive)' },
      { name: 'b', type: 'number', description: 'Upper bound (inclusive)' },
    ],
    returnType: 'number',
  },
  random_range_float: {
    name: 'random_range_float',
    kind: 'function',
    signature: 'random_range_float(a, b)',
    description: 'Returns a random floating point value between a and b, inclusive.',
    parameters: [
      { name: 'a', type: 'number', description: 'Lower bound (inclusive)' },
      { name: 'b', type: 'number', description: 'Upper bound (inclusive)' },
    ],
    returnType: 'number',
  },
  dice: {
    name: 'dice',
    kind: 'function',
    signature: 'dice(sides)',
    description: 'Returns a random integer between 1 and sides, inclusive. Like rolling a die.',
    parameters: [{ name: 'sides', type: 'number', description: 'Number of sides on the die' }],
    returnType: 'number',
  },
  diceroll: {
    name: 'diceroll',
    kind: 'function',
    signature: 'diceroll(qty, sides)',
    description: 'Rolls multiple identical dice simultaneously and returns their sum. For example, diceroll(2, 6) rolls two six-sided dice.',
    parameters: [
      { name: 'qty', type: 'number', description: 'Number of dice to roll' },
      { name: 'sides', type: 'number', description: 'Number of sides on each die' },
    ],
    returnType: 'number',
  },
  multidice: {
    name: 'multidice',
    kind: 'function',
    signature: 'multidice(notation)',
    description: 'Rolls a mix of dice using standard notation and returns the total sum. Separate dice groups with +. For example, multidice("2d6+1d8") rolls two d6 and one d8 together.',
    parameters: [
      { name: 'notation', type: 'string', description: 'Dice notation, e.g. "2d6", "3d8+1d12", "1d20+2d6+1d4"' },
    ],
    returnType: 'number',
  },

  // Math - Rounding
  round: {
    name: 'round',
    kind: 'function',
    signature: 'round(n)',
    description: 'Rounds n to the nearest integer.',
    parameters: [{ name: 'n', type: 'number' }],
    returnType: 'number',
  },
  round_places: {
    name: 'round_places',
    kind: 'function',
    signature: 'round_places(n, places)',
    description: 'Rounds n to the nearest number with the specified decimal places.',
    parameters: [
      { name: 'n', type: 'number', description: 'The number to round' },
      { name: 'places', type: 'number', description: 'Number of decimal places' },
    ],
    returnType: 'number',
  },
  floor: {
    name: 'floor',
    kind: 'function',
    signature: 'floor(n)',
    description: 'Rounds n down to the nearest integer, towards negative infinity.',
    parameters: [{ name: 'n', type: 'number' }],
    returnType: 'number',
  },
  ceil: {
    name: 'ceil',
    kind: 'function',
    signature: 'ceil(n)',
    description: 'Rounds n up to the nearest integer, towards positive infinity.',
    parameters: [{ name: 'n', type: 'number' }],
    returnType: 'number',
  },
  inc: {
    name: 'inc',
    kind: 'function',
    signature: 'inc(n)',
    description: 'Rounds n up to the nearest integer. If n is already an integer, returns n+1.',
    parameters: [{ name: 'n', type: 'number' }],
    returnType: 'number',
  },
  dec: {
    name: 'dec',
    kind: 'function',
    signature: 'dec(n)',
    description: 'Rounds n down to the nearest integer. If n is already an integer, returns n-1.',
    parameters: [{ name: 'n', type: 'number' }],
    returnType: 'number',
  },
  int: {
    name: 'int',
    kind: 'function',
    signature: 'int(n)',
    description: 'Rounds n down to the nearest integer, towards zero. (Different from floor, which rounds towards negative infinity.)',
    parameters: [{ name: 'n', type: 'number' }],
    returnType: 'number',
  },
  decimal: {
    name: 'decimal',
    kind: 'function',
    signature: 'decimal(n)',
    description: 'Returns the decimal portion of n. Always between 0 and 1. For example, decimal(4.51) returns 0.51.',
    parameters: [{ name: 'n', type: 'number' }],
    returnType: 'number',
  },

  // Math - Comparison
  min: {
    name: 'min',
    kind: 'function',
    signature: 'min(a, b)',
    description: 'Compares a and b, and returns the smaller of the two.',
    parameters: [
      { name: 'a', type: 'number' },
      { name: 'b', type: 'number' },
    ],
    returnType: 'number',
  },
  max: {
    name: 'max',
    kind: 'function',
    signature: 'max(a, b)',
    description: 'Compares a and b, and returns the larger of the two.',
    parameters: [
      { name: 'a', type: 'number' },
      { name: 'b', type: 'number' },
    ],
    returnType: 'number',
  },

  // Type conversion
  string: {
    name: 'string',
    kind: 'function',
    signature: 'string(value)',
    description: 'Converts value to string type.',
    parameters: [{ name: 'value', type: 'any' }],
    returnType: 'string',
  },
  number: {
    name: 'number',
    kind: 'function',
    signature: 'number(value)',
    description: 'Converts value to number type.',
    parameters: [{ name: 'value', type: 'any' }],
    returnType: 'number',
  },
  bool: {
    name: 'bool',
    kind: 'function',
    signature: 'bool(value)',
    description: 'Converts value to bool type.',
    parameters: [{ name: 'value', type: 'any' }],
    returnType: 'bool',
  },

  // Formatting
  format: {
    name: 'format',
    kind: 'function',
    signature: 'format(format_string, argument)',
    description: 'Formats the argument into the format_string. Uses C# string format rules.',
    parameters: [
      { name: 'format_string', type: 'string', description: 'The format string (C# format rules)' },
      { name: 'argument', type: 'any', description: 'The value to format' },
    ],
    returnType: 'string',
  },
  format_invariant: {
    name: 'format_invariant',
    kind: 'function',
    signature: 'format_invariant(value)',
    description: 'Converts a number to a string using invariant culture (always uses . for decimals).',
    parameters: [{ name: 'value', type: 'number' }],
    returnType: 'string',
  },

  // Other
  has_any_content: {
    name: 'has_any_content',
    kind: 'function',
    signature: 'has_any_content(node_group)',
    description: 'Checks if a node group has any members that could possibly run.',
    parameters: [{ name: 'node_group', type: 'string', description: 'The name of the node group' }],
    returnType: 'bool',
  },
}

/**
 * Get documentation for a built-in by name
 */
export function getBuiltinDoc(name: string): BuiltinDoc | null {
  return CONTROL_FLOW_DOCS[name] || COMMAND_DOCS[name] || FUNCTION_DOCS[name] || null
}

/**
 * Format a builtin doc as hover markdown
 */
export function formatBuiltinHover(doc: BuiltinDoc): string {
  const lines: string[] = []

  // Title with kind
  const kindLabel = doc.kind === 'keyword' ? 'Keyword' : doc.kind === 'command' ? 'Command' : 'Function'
  lines.push(`**${doc.name}** (${kindLabel})`)
  lines.push('')

  // Signature
  lines.push(`\`${doc.signature}\``)
  lines.push('')

  // Description
  lines.push(doc.description)

  // Parameters
  if (doc.parameters && doc.parameters.length > 0) {
    lines.push('')
    lines.push('**Parameters:**')
    for (const param of doc.parameters) {
      const desc = param.description ? ` - ${param.description}` : ''
      lines.push(`- \`${param.name}\`: ${param.type}${desc}`)
    }
  }

  // Return type
  if (doc.returnType) {
    lines.push('')
    lines.push(`**Returns:** ${doc.returnType}`)
  }

  return lines.join('\n')
}

/**
 * Get all builtin names for completion
 */
export function getAllBuiltinNames(): string[] {
  return [
    ...Object.keys(CONTROL_FLOW_DOCS),
    ...Object.keys(COMMAND_DOCS),
    ...Object.keys(FUNCTION_DOCS),
  ]
}
