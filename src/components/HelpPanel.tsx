/**
 * Help Panel - Syntax Reference and Keyboard Shortcuts
 *
 * Comprehensive reference for Yarn Spinner syntax and keyboard shortcuts.
 * Appears when user presses '?' key.
 */

import { useState } from 'react';
import {
  MessageSquare,
  GitBranch,
  Variable,
  Zap,
  Hash,
  Code,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Keyboard,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface SyntaxSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  items: SyntaxItem[];
}

interface SyntaxItem {
  name: string;
  syntax: string;
  description: string;
  example?: string;
}

// =============================================================================
// Data
// =============================================================================

const SYNTAX_SECTIONS: SyntaxSection[] = [
  {
    id: 'structure',
    title: 'Node Structure',
    icon: Code,
    color: '#8D11B4',
    items: [
      {
        name: 'Node Header',
        syntax: 'title: NodeName',
        description: 'Every node starts with a title',
        example: 'title: StartConversation',
      },
      {
        name: 'Header End',
        syntax: '---',
        description: 'Marks the end of the header, start of body',
      },
      {
        name: 'Node End',
        syntax: '===',
        description: 'Marks the end of the node',
      },
      {
        name: 'Comments',
        syntax: '// comment',
        description: 'Single-line comments (ignored by compiler)',
        example: '// This is a comment',
      },
    ],
  },
  {
    id: 'dialogue',
    title: 'Dialogue',
    icon: MessageSquare,
    color: '#19A05B',
    items: [
      {
        name: 'Plain Line',
        syntax: 'Text here',
        description: 'Simple dialogue text shown to player',
        example: 'Hello, welcome to my shop!',
      },
      {
        name: 'Character Line',
        syntax: 'Character: Text',
        description: 'Dialogue with speaker name',
        example: 'Alice: How are you today?',
      },
      {
        name: 'Inline Expression',
        syntax: '{expression}',
        description: 'Embed variables or expressions in text',
        example: 'You have {$gold} gold coins.',
      },
      {
        name: 'Escaped Braces',
        syntax: '\\{ \\}',
        description: 'Show literal braces in text',
        example: 'Type \\{help\\} for assistance.',
      },
    ],
  },
  {
    id: 'options',
    title: 'Options & Branching',
    icon: GitBranch,
    color: '#08A6DD',
    items: [
      {
        name: 'Option',
        syntax: '-> Option text',
        description: 'Player choice that continues in same node',
        example: '-> Tell me more',
      },
      {
        name: 'Option with Jump',
        syntax: '-> Text\n    <<jump Node>>',
        description: 'Choice that jumps to another node',
        example: '-> Goodbye\n    <<jump EndChat>>',
      },
      {
        name: 'Conditional Option',
        syntax: '-> Text <<if $cond>>',
        description: 'Option only shown when condition is true',
        example: '-> Buy sword <<if $gold >= 50>>',
      },
    ],
  },
  {
    id: 'commands',
    title: 'Commands',
    icon: Zap,
    color: '#FD7C1F',
    items: [
      {
        name: 'Jump',
        syntax: '<<jump NodeName>>',
        description: 'Go to another node (no return)',
        example: '<<jump ShopMenu>>',
      },
      {
        name: 'Stop',
        syntax: '<<stop>>',
        description: 'End the dialogue immediately',
      },
      {
        name: 'Wait',
        syntax: '<<wait seconds>>',
        description: 'Pause for specified duration',
        example: '<<wait 2>>',
      },
      {
        name: 'Custom Command',
        syntax: '<<command args>>',
        description: 'Call game-defined command',
        example: '<<playSound doorbell>>',
      },
    ],
  },
  {
    id: 'variables',
    title: 'Variables',
    icon: Variable,
    color: '#E42C84',
    items: [
      {
        name: 'Variable Reference',
        syntax: '$variableName',
        description: 'Reference a variable value',
        example: '$playerName',
      },
      {
        name: 'Declare',
        syntax: '<<declare $var = value>>',
        description: 'Create variable with initial value',
        example: '<<declare $gold = 100>>',
      },
      {
        name: 'Set',
        syntax: '<<set $var = value>>',
        description: 'Change variable value',
        example: '<<set $gold = $gold + 10>>',
      },
      {
        name: 'Types',
        syntax: 'number, string, bool',
        description: 'Supported variable types',
        example: '<<declare $name = "Ada">>',
      },
    ],
  },
  {
    id: 'conditions',
    title: 'Conditions',
    icon: GitBranch,
    color: '#5C8A9A',
    items: [
      {
        name: 'If',
        syntax: '<<if expression>>',
        description: 'Start conditional block',
        example: '<<if $gold >= 50>>',
      },
      {
        name: 'Elseif',
        syntax: '<<elseif expression>>',
        description: 'Alternative condition',
        example: '<<elseif $gold >= 25>>',
      },
      {
        name: 'Else',
        syntax: '<<else>>',
        description: 'Fallback when no conditions match',
      },
      {
        name: 'Endif',
        syntax: '<<endif>>',
        description: 'End conditional block',
      },
      {
        name: 'Operators',
        syntax: '== != < > <= >= and or not',
        description: 'Comparison and logical operators',
        example: '<<if $level > 5 and $hasKey>>',
      },
    ],
  },
  {
    id: 'tags',
    title: 'Line Tags & Metadata',
    icon: Hash,
    color: '#CBC7CC',
    items: [
      {
        name: 'Line Tag',
        syntax: '#tag',
        description: 'Add metadata to a line',
        example: 'Hello there! #greeting',
      },
      {
        name: 'Line ID',
        syntax: '#line:id',
        description: 'Unique identifier for localization',
        example: 'Welcome! #line:intro_001',
      },
      {
        name: 'Custom Tag',
        syntax: '#category:value',
        description: 'Custom metadata with colon separator',
        example: 'The archives... #location:library',
      },
    ],
  },
  {
    id: 'functions',
    title: 'Built-in Functions',
    icon: Zap,
    color: '#08A6DD',
    items: [
      {
        name: 'visited(node)',
        syntax: 'visited(node)',
        description: 'True if node was visited',
      },
      {
        name: 'visited_count(node)',
        syntax: 'visited_count(node)',
        description: 'Times node was visited',
      },
      {
        name: 'random()',
        syntax: 'random()',
        description: 'Random number 0-1',
      },
      {
        name: 'random_range(min, max)',
        syntax: 'random_range(min, max)',
        description: 'Random in range',
      },
      {
        name: 'dice(sides)',
        syntax: 'dice(sides)',
        description: 'Roll dice (1 to sides)',
      },
      {
        name: 'round(n)',
        syntax: 'round(n)',
        description: 'Round to nearest integer',
      },
      {
        name: 'floor(n)',
        syntax: 'floor(n)',
        description: 'Round down',
      },
      {
        name: 'ceil(n)',
        syntax: 'ceil(n)',
        description: 'Round up',
      },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    icon: Keyboard,
    color: '#5C8A9A',
    items: [
      {
        name: 'Run dialogue',
        syntax: 'Cmd/Ctrl + Enter',
        description: 'Compile and run the current dialogue',
      },
      {
        name: 'Save script',
        syntax: 'Cmd/Ctrl + S',
        description: 'Download your script to disk',
      },
      {
        name: 'Close help',
        syntax: 'Escape',
        description: 'Close this help panel',
      },
    ],
  },
  {
    id: 'tips',
    title: 'Quick Tips',
    icon: MessageSquare,
    color: '#E42C84',
    items: [
      {
        name: 'Indentation',
        syntax: 'Spaces/Tabs',
        description: 'Indentation matters for nested options and their content',
      },
      {
        name: 'Variable persistence',
        syntax: '$variables',
        description: 'Variables persist across nodes and dialogue sessions',
      },
      {
        name: 'Jumping nodes',
        syntax: '<<jump>>',
        description: 'Use <<jump>> to go to another node without returning',
      },
    ],
  },
];

// =============================================================================
// Components
// =============================================================================

function SectionHeader({
  section,
  isOpen,
  onToggle,
}: {
  section: SyntaxSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = section.icon;

  // Get icon color classes based on section color
  const getIconColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      '#8D11B4': 'text-[#8D11B4] dark:text-[#C678DD]', // Purple (keywords)
      '#19A05B': 'text-[#19A05B] dark:text-[#98C379]', // Green (literals)
      '#08A6DD': 'text-[#08A6DD] dark:text-[#61AFEF]', // Cyan (speakers)
      '#FD7C1F': 'text-[#FD7C1F] dark:text-[#D19A66]', // Orange (markup)
      '#E42C84': 'text-[#E42C84] dark:text-[#E879F9]', // Pink (variables)
      '#5C8A9A': 'text-[#5C8A9A] dark:text-[#61AFEF]', // Blue-gray -> cyan
      '#CBC7CC': 'text-[#CBC7CC] dark:text-[#888888]', // Gray
    };
    return colorMap[color] || `text-[${color}]`;
  };

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${isOpen ? 'bg-[#F9F7F9] dark:bg-[#534952]' : 'bg-transparent'}`}
    >
      <Icon className={`h-5 w-5 ${getIconColorClass(section.color)}`} />
      <span className="font-sans font-semibold text-base flex-1 text-left text-[#2D1F30] dark:text-[#E0D8E2]">
        {section.title}
      </span>
      {isOpen ? (
        <ChevronDown className="h-5 w-5 text-[#7A6F7D] dark:text-[#B8A8BB]" />
      ) : (
        <ChevronRight className="h-5 w-5 text-[#7A6F7D] dark:text-[#B8A8BB]" />
      )}
    </button>
  );
}

function HighlightedSyntax({ code }: { code: string }) {
  // Simple syntax highlighter for help panel examples
  const highlight = (text: string) => {
    const parts: React.ReactNode[] = [];
    let buffer = '';
    let i = 0;

    const flush = () => {
      if (buffer) {
        parts.push(<span key={i++} className="text-[#2D1F30] dark:text-[#E0D8E2]">{buffer}</span>);
        buffer = '';
      }
    };

    const addColored = (content: string, lightColor: string, darkColor: string) => {
      flush();
      parts.push(<span key={i++} className={`text-[${lightColor}] dark:text-[${darkColor}]`}>{content}</span>);
    };

    // Keywords pattern
    const keywords = /\b(if|else|elseif|endif|set|declare|jump|detour|return|stop|wait|call|once|endonce|enum|endenum|case|local|when|always|true|false|null|string|number|bool)\b/g;
    // Variables pattern
    const variables = /\$\w+/g;
    // Commands pattern
    const commands = /<<|>>/g;
    // Character names pattern
    const characterLine = /^(\w+):\s/;
    // Comments pattern
    const comments = /\/\/.*/g;
    // Punctuation pattern
    const punctuation = /^(---|===|->)/;
    // Header keys pattern
    const headerKeys = /^(title|tags|position|colorID):/;
    // Markup tags
    const markupTags = /\[[^\]]+\]/g;
    // Line tags
    const lineTags = /#\w+(:\w+)?/g;

    const lines = text.split('\n');
    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) parts.push(<br key={`br-${i++}`} />);

      // Check for comments first
      if (line.trim().startsWith('//')) {
        parts.push(<span key={i++} className="text-[#8A9929] dark:text-[#A9B665] italic">{line}</span>);
        return;
      }

      // Check for punctuation lines
      if (line.match(/^(---|===)$/)) {
        parts.push(<span key={i++} className="text-[#F7B500] dark:text-[#E5C07B]">{line}</span>);
        return;
      }

      // Check for header keys
      const headerMatch = line.match(/^(title|tags|position|colorID):\s*(.*)$/);
      if (headerMatch) {
        parts.push(<span key={i++} className="text-[#E42C84] dark:text-[#E879F9]">{headerMatch[1]}:</span>);
        parts.push(<span key={i++}> </span>);
        parts.push(<span key={i++} className="text-[#19A05B] dark:text-[#98C379]">{headerMatch[2]}</span>);
        return;
      }

      // Check for character lines
      const charMatch = line.match(/^(\w+):\s*(.*)$/);
      if (charMatch) {
        parts.push(<span key={i++} className="text-[#08A6DD] dark:text-[#61AFEF]">{charMatch[1]}:</span>);
        parts.push(<span key={i++}> </span>);
        parts.push(<span key={i++} className="text-[#2D1F30] dark:text-[#E0D8E2]">{charMatch[2]}</span>);
        return;
      }

      // For other lines, do inline highlighting
      let remaining = line;
      let currentPos = 0;

      // Simple tokenization - just highlight keywords, variables, commands
      if (remaining.includes('<<')) {
        const cmdStart = remaining.indexOf('<<');
        if (cmdStart > 0) {
          parts.push(<span key={i++} className="text-[#2D1F30] dark:text-[#E0D8E2]">{remaining.substring(0, cmdStart)}</span>);
        }
        const cmdEnd = remaining.indexOf('>>');
        if (cmdEnd > cmdStart) {
          const cmdContent = remaining.substring(cmdStart, cmdEnd + 2);
          parts.push(<span key={i++} className="text-[#8D11B4] dark:text-[#C678DD]">{cmdContent}</span>);
          remaining = remaining.substring(cmdEnd + 2);
          if (remaining) {
            parts.push(<span key={i++} className="text-[#2D1F30] dark:text-[#E0D8E2]">{remaining}</span>);
          }
        }
      } else if (remaining.startsWith('->')) {
        parts.push(<span key={i++} className="text-[#F7B500] dark:text-[#E5C07B]">-></span>);
        parts.push(<span key={i++} className="text-[#2D1F30] dark:text-[#E0D8E2]">{remaining.substring(2)}</span>);
      } else {
        // Check for variables
        const varMatch = remaining.match(/\$\w+/);
        if (varMatch) {
          const beforeVar = remaining.substring(0, varMatch.index);
          const afterVar = remaining.substring(varMatch.index! + varMatch[0].length);
          if (beforeVar) parts.push(<span key={i++} className="text-[#2D1F30] dark:text-[#E0D8E2]">{beforeVar}</span>);
          parts.push(<span key={i++} className="text-[#E42C84] dark:text-[#E879F9]">{varMatch[0]}</span>);
          if (afterVar) parts.push(<span key={i++} className="text-[#2D1F30] dark:text-[#E0D8E2]">{afterVar}</span>);
        } else {
          parts.push(<span key={i++} className="text-[#2D1F30] dark:text-[#E0D8E2]">{remaining}</span>);
        }
      }
    });

    return parts;
  };

  return <>{highlight(code)}</>;
}

function SyntaxItemRow({ item }: { item: SyntaxItem }) {
  return (
    <div className="py-3 px-4 border-b last:border-0 border-[#F9F7F9] dark:border-[#534952]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-[#2D1F30] dark:text-[#E0D8E2]">{item.name}</span>
        <code className="text-xs px-2 py-1 rounded font-mono shrink-0 bg-[#F0EEF1] dark:bg-[#534952]">
          <HighlightedSyntax code={item.syntax} />
        </code>
      </div>
      <p className="text-xs mt-1 leading-relaxed text-[#7A6F7D] dark:text-[#B8A8BB]">
        {item.description}
      </p>
      {item.example && (
        <code className="block text-xs mt-2 px-3 py-2 rounded font-mono whitespace-pre-wrap bg-[#F9F7F9] dark:bg-[#312A35]">
          <HighlightedSyntax code={item.example} />
        </code>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['structure', 'dialogue', 'shortcuts']));

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(SYNTAX_SECTIONS.map((s) => s.id)));
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] mx-4 bg-white dark:bg-[#3A3340] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#E5E1E6] dark:border-[#534952]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-5 border-b border-[#E5E1E6] dark:border-[#534952] bg-[#F9F7F9] dark:bg-[#312A35] flex items-center justify-between">
          <div>
            <h2 className="font-sans font-bold text-xl text-[#2D1F30] dark:text-[#E0D8E2]">
              Yarn Spinner Reference
            </h2>
            <p className="text-sm mt-1 text-[#7A6F7D] dark:text-[#B8A8BB]">
              Quick reference for Yarn Spinner syntax and shortcuts
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={expandAll}
              className="text-xs px-3 py-1.5 rounded transition-colors text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] hover:text-[#2D1F30] dark:hover:text-[#E0D8E2]"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 rounded transition-colors text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] hover:text-[#2D1F30] dark:hover:text-[#E0D8E2]"
            >
              Collapse All
            </button>
            <a
              href="https://docs.yarnspinner.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-[#4C8962] hover:bg-[#5C9A72] text-white"
            >
              Full Docs
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 ml-1 rounded transition-colors text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] hover:text-[#2D1F30] dark:hover:text-[#E0D8E2]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - All sections */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-1">
            {SYNTAX_SECTIONS.map((section) => (
              <div key={section.id}>
                <SectionHeader
                  section={section}
                  isOpen={openSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
                {openSections.has(section.id) && (
                  <div className="ml-6 mt-1 mb-2 border-l-2 border-[#E5E1E6] dark:border-[#534952]">
                    {section.items.map((item) => (
                      <SyntaxItemRow key={item.name} item={item} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
