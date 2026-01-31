/**
 * Help Panel - Quick-start guide with links to the real docs.
 *
 * Appears when user presses '?' key or clicks the help icon.
 */

import { ExternalLink, Keyboard } from 'lucide-react';
import { trackEvent } from '../utility/analytics';

// =============================================================================
// Data
// =============================================================================

const DOCS_BASE = 'https://docs.yarnspinner.dev';

interface DocsTopic {
  title: string;
  description: string;
  url: string;
  snippets?: string[];
}

interface DocsGroup {
  heading: string;
  topics: DocsTopic[];
}

const DOCS_GROUPS: DocsGroup[] = [
  {
    heading: 'Fundamentals',
    topics: [
      {
        title: 'Scripting Basics',
        description: 'Nodes, lines, and the structure of a Yarn script',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals`,
        snippets: ['title: NodeName', '---', '==='],
      },
      {
        title: 'Options',
        description: 'Player choices and branching dialogue',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals/options`,
        snippets: ['-> Option text'],
      },
      {
        title: 'Jumps',
        description: 'Navigate between nodes',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals/jumps`,
        snippets: ['<<jump NodeName>>'],
      },
      {
        title: 'Variables & Logic',
        description: 'Declare, set, and use variables in your dialogue',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals/logic-and-variables`,
        snippets: ['<<declare $gold = 100>>', '<<set $gold + 10>>'],
      },
      {
        title: 'Flow Control',
        description: 'If/else conditions for dynamic dialogue',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals/flow-control`,
        snippets: ['<<if $gold >= 50>>', '<<elseif $gold >= 25>>', '<<else>>', '<<endif>>'],
      },
      {
        title: 'Commands',
        description: 'Built-in and custom game commands',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals/commands`,
        snippets: ['<<wait 1>>', '<<stop>>', '<<screen_shake>>', '<<fade_out>>', '<<fade_in>>'],
      },
      {
        title: 'Functions',
        description: 'Built-in functions like visited() and random()',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals/functions`,
        snippets: ['visited("NodeName")', 'random_range(1, 10)', 'dice(6)', 'diceroll(2, 6)', 'multidice("2d6+1d8")'],
      },
      {
        title: 'Once',
        description: 'Content that only runs once',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals/once`,
        snippets: ['<<once>> ... <<endonce>>'],
      },
      {
        title: 'Line Groups',
        description: 'Random line selection for variety',
        url: `${DOCS_BASE}/write-yarn-scripts/scripting-fundamentals/line-groups`,
        snippets: ['=> Thing only happens once <<once>>', '=> Conditional line <<if $gold > 5>>'],
      },
    ],
  },
  {
    heading: 'Advanced',
    topics: [
      {
        title: 'Node Groups',
        description: 'Collections of nodes with conditional execution',
        url: `${DOCS_BASE}/write-yarn-scripts/advanced-scripting/node-groups`,
      },
      {
        title: 'Saliency',
        description: 'Control how content is selected',
        url: `${DOCS_BASE}/write-yarn-scripts/advanced-scripting/saliency`,
      },
      {
        title: 'Tags & Metadata',
        description: 'Add contextual information to lines and nodes',
        url: `${DOCS_BASE}/write-yarn-scripts/advanced-scripting/tags-metadata`,
        snippets: ['Hello! #greeting', '#line:intro_001'],
      },
      {
        title: 'Markup',
        description: 'Style and animate text with attributes',
        url: `${DOCS_BASE}/write-yarn-scripts/advanced-scripting/markup`,
        snippets: ['[b]bold[/b]', '[i]italic[/i]', '[wave]text[/wave]', '[shake]text[/shake]', '[color=red]text[/color]', '[pause/]', '[speed=5]slow[/speed]'],
      },
      {
        title: 'Shadow Lines',
        description: 'Reuse lines across locations for localisation',
        url: `${DOCS_BASE}/write-yarn-scripts/advanced-scripting/shadow-lines`,
      },
    ],
  },
];

interface ShortcutEntry {
  label: string;
  keys: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { label: 'Run dialogue', keys: 'Cmd/Ctrl + Enter' },
  { label: 'Save script', keys: 'Cmd/Ctrl + S' },
  { label: 'Close help', keys: 'Escape' },
];

// =============================================================================
// Components
// =============================================================================

function DocsTopicRow({ topic }: { topic: DocsTopic }) {
  return (
    <a
      href={topic.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start justify-between gap-3 px-3 py-2.5 -mx-3 rounded-lg transition-colors hover:bg-[#F0EEF1] dark:hover:bg-[#3D363F] group"
      onClick={() =>
        trackEvent('outbound-link', {
          url: topic.url,
          location: 'help-panel',
        })
      }
    >
      <div className="min-w-0">
        <div className="flex items-baseline">
          <span className="text-sm font-semibold text-[#2D1F30] dark:text-[#E0D8E2]">
            {topic.title}
          </span>
          <span className="text-xs text-[#7A6F7D] dark:text-[#B8A8BB] ml-2">
            {topic.description}
          </span>
        </div>
        {topic.snippets && topic.snippets.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {topic.snippets.map((snippet, i) => (
              <span key={i} className="contents">
                {i > 0 && (
                  <span className="text-xs text-[#B8A8BB] dark:text-[#534952]">
                    ·
                  </span>
                )}
                <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#ECEAED] dark:bg-[#2D262F] text-[#5C4D5F] dark:text-[#B8A8BB]">
                  {snippet}
                </code>
              </span>
            ))}
          </div>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-1 text-[#B8A8BB] dark:text-[#534952] group-hover:text-[#7A6F7D] dark:group-hover:text-[#B8A8BB] transition-colors" />
    </a>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sm:bg-black/30 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full h-full sm:w-auto sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:mx-4 bg-white dark:bg-[#242124] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:border border-[#E5E1E6] dark:border-[#534952]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 sm:px-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-5 pb-4 sm:pb-5 border-b border-[#E5E1E6] dark:border-[#534952] bg-[#F9F7F9] dark:bg-[#312A35]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-sans font-bold text-lg sm:text-xl text-[#2D1F30] dark:text-[#E0D8E2]">
                Yarn Spinner Help
              </h2>
              <p className="text-sm mt-1 text-[#7A6F7D] dark:text-[#B8A8BB]">
                Quick links to the Yarn Spinner documentation
              </p>
            </div>
            <div className="flex gap-2 items-center shrink-0">
              <a
                href={DOCS_BASE}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-[#4C8962] hover:bg-[#5C9A72] text-white"
                onClick={() =>
                  trackEvent('outbound-link', {
                    url: 'docs.yarnspinner.dev',
                    location: 'help-panel',
                  })
                }
              >
                Full Docs
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={onClose}
                className="p-2 rounded transition-colors text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] hover:text-[#2D1F30] dark:hover:text-[#E0D8E2]"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 py-4 space-y-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {/* Doc link groups */}
            {DOCS_GROUPS.map((group) => (
              <section key={group.heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7A6F7D] dark:text-[#B8A8BB] mb-1">
                  {group.heading}
                </h3>
                <div>
                  {group.topics.map((topic) => (
                    <DocsTopicRow key={topic.title} topic={topic} />
                  ))}
                </div>
              </section>
            ))}

            {/* Keyboard shortcuts */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7A6F7D] dark:text-[#B8A8BB] mb-2 flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5" />
                Keyboard Shortcuts
              </h3>
              <div className="space-y-1">
                {SHORTCUTS.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between text-sm px-3 py-1.5"
                  >
                    <span className="text-[#2D1F30] dark:text-[#E0D8E2]">
                      {s.label}
                    </span>
                    <kbd className="text-xs font-mono px-2 py-0.5 rounded bg-[#F0EEF1] dark:bg-[#3D363F] text-[#7A6F7D] dark:text-[#B8A8BB]">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
