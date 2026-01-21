/**
 * Editor Language Constants
 *
 * Shared constants for Yarn language features.
 */

/** Pattern for character dialogue: any text before a colon at start of line */
export const CHARACTER_PATTERN = /^([^:\n]+):/gm

/** Yarn keywords that shouldn't be treated as character names */
export const YARN_KEYWORDS = new Set([
  'if', 'else', 'elseif', 'endif', 'once', 'endonce',
  'set', 'declare', 'jump', 'detour', 'return', 'call', 'stop', 'wait',
  'enum', 'endenum', 'case', 'local',
  'true', 'false', 'null',
  'and', 'or', 'not', 'xor',
  'is', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'to',
  'string', 'number', 'bool',
  'when', 'always', 'as',
])
