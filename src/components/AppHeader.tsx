import c from "../utility/classNames";
import isEmbed from "../utility/isEmbed";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import type { BackendStatus } from "../utility/loadBackend";
import { trackEvent } from "../utility/analytics";
import { useState } from "react";
import type { Sample } from "../utility/loadSample";
import { Settings, BookOpen } from "lucide-react";

import * as images from "../img";

// =============================================================================
// ERROR TESTING UTILITIES
// Comment out this entire section to remove error testing menu
// =============================================================================

const SHOW_ERROR_TESTING_MENU = false; // Set to false to hide error testing menu

// Component that throws an error during render to test ErrorBoundary
function ErrorThrower(): JSX.Element {
  throw new Error('[TEST] React rendering error - intentional test');
}

// Error simulation functions
const ErrorSimulators = {
  // 1. React rendering error
  reactRenderError: () => {
    return <ErrorThrower />;
  },

  // 2. Global JavaScript error
  globalError: () => {
    // @ts-ignore - intentional error for testing
    window.nonExistentFunction();
  },

  // 3. Unhandled promise rejection
  promiseRejection: () => {
    Promise.reject(new Error('[TEST] Unhandled promise rejection - intentional test'));
  },

  // 4. Async error (simulates backend/compilation failure)
  asyncError: async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    throw new Error('[TEST] Async operation failed - intentional test');
  },

  // 5. Null reference error
  nullReference: () => {
    const obj: any = null;
    console.log(obj.property); // Will throw
  },

  // 6. Type error
  typeError: () => {
    const num: any = 123;
    num.toUpperCase(); // Will throw - numbers don't have toUpperCase
  },

  // 7. Network error (fetch failure)
  networkError: async () => {
    await fetch('https://this-domain-definitely-does-not-exist-12345.com');
  },

  // 8. JSON parse error
  jsonParseError: () => {
    JSON.parse('{ invalid json }');
  },

  // 9. LocalStorage quota exceeded
  storageQuotaError: () => {
    try {
      const huge = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      for (let i = 0; i < 100; i++) {
        localStorage.setItem(`test_${i}`, huge);
      }
    } catch (e) {
      throw new Error('[TEST] LocalStorage quota exceeded - intentional test');
    }
  },

  // 10. Stack overflow (infinite recursion)
  stackOverflow: () => {
    const recurse: any = () => recurse();
    recurse();
  },

  // 11. WASM/Backend simulation error
  wasmError: () => {
    throw new Error('[TEST] WebAssembly module failed to load - intentional test');
  },

  // 12. CORS error simulation
  corsError: async () => {
    // This will likely fail with CORS
    await fetch('https://example.com/api/test', { mode: 'cors' });
  },

  // 13. Timeout error
  timeoutError: async () => {
    await new Promise((_, reject) => {
      setTimeout(() => reject(new Error('[TEST] Operation timed out - intentional test')), 100);
    });
  },

  // 14. Range error (invalid array length)
  rangeError: () => {
    new Array(-1); // Invalid array length
  },

  // 15. Reference error (accessing undefined variable)
  referenceError: () => {
    // @ts-ignore - intentional error for testing
    console.log(undefinedVariable);
  },
};

// =============================================================================
// END ERROR TESTING UTILITIES
// =============================================================================

import type { GitHubAuthState } from "../utility/githubAuth";
import { GitHubStatus } from "./GitHubAuthDialog";

export function AppHeader(props: {
  onNew?: () => void;
  onSaveScript?: () => void;
  onLoadFromDisk?: () => void;
  onLoadFromGist?: () => void;
  onLoadSample?: (filename: string) => void;
  samples?: Sample[];
  onPlay?: () => void;
  onStop?: () => void;
  isRunning?: boolean;
  onExportPlayer?: () => void;
  onDownloadProject?: () => void;
  onShowHelp?: () => void;
  onShowAbout?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  backendStatus?: BackendStatus;
  saliencyStrategy?: string;
  onSaliencyStrategyChange?: (strategy: string) => void;
  unavailableOptionsMode?: 'hidden' | 'strikethrough';
  onUnavailableOptionsModeChange?: (mode: 'hidden' | 'strikethrough') => void;
  showWaitProgress?: boolean;
  onShowWaitProgressChange?: (value: boolean) => void;
  showDiceEffects?: boolean;
  onShowDiceEffectsChange?: (value: boolean) => void;
  githubAuthState?: GitHubAuthState | null;
  onGitHubLogin?: () => void;
  onGitHubLogout?: () => void;
  onSaveToGist?: () => void;
  onBrowseGists?: () => void;
  compilerVersion?: string;
}) {
  const embed = isEmbed();
  const [shouldThrowError, setShouldThrowError] = useState(false);

  // Track which error type to trigger
  const [errorToTrigger, setErrorToTrigger] = useState<keyof typeof ErrorSimulators | null>(null);

  // Trigger React rendering error if requested
  if (shouldThrowError || errorToTrigger === 'reactRenderError') {
    return <ErrorThrower />;
  }

  return (
    <div
      className={c(
        "fixed top-0 left-0 right-0 flex w-full h-12 shrink-0 flex-row items-center justify-between border-b border-green/20 bg-green px-4 gap-4 z-50",
      )}
    >
      {/* Left: Logo and title */}
      <div className="flex flex-row items-center gap-3">
        <a href="https://yarnspinner.dev" className="flex items-center gap-2">
          <img
            className="h-7 w-auto"
            src={images.YarnSpinnerLogoURL}
            alt="Yarn Spinner"
          />
          {!embed && (
            <div className="hidden sm:flex items-baseline gap-1.5">
              <span className="font-title font-semibold text-white text-lg tracking-tight">
                Try
              </span>
              <span className="font-title font-semibold text-white text-lg tracking-tight">
                Yarn Spinner
              </span>
            </div>
          )}
        </a>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Error Testing Menu - Comment out SHOW_ERROR_TESTING_MENU above to hide */}
        {SHOW_ERROR_TESTING_MENU && (
          <Dropdown
            label="Errors ▾"
            align="right"
            items={[
              {
                label: "This menu tests all error handling scenarios. All errors should be caught gracefully.",
                type: "info",
              },
              {
                label: "",
                type: "separator",
              },
              {
                label: "React Render Error",
                onClick: () => {
                  console.log('[TEST] Triggering React render error...');
                  setErrorToTrigger('reactRenderError');
                },
              },
              {
                label: "Global JavaScript Error",
                onClick: () => {
                  console.log('[TEST] Triggering global error...');
                  ErrorSimulators.globalError();
                },
              },
              {
                label: "Unhandled Promise Rejection",
                onClick: () => {
                  console.log('[TEST] Triggering promise rejection...');
                  ErrorSimulators.promiseRejection();
                },
              },
              {
                label: "Async Error",
                onClick: async () => {
                  console.log('[TEST] Triggering async error...');
                  await ErrorSimulators.asyncError();
                },
              },
              {
                label: "Null Reference Error",
                onClick: () => {
                  console.log('[TEST] Triggering null reference error...');
                  ErrorSimulators.nullReference();
                },
              },
              {
                label: "Type Error",
                onClick: () => {
                  console.log('[TEST] Triggering type error...');
                  ErrorSimulators.typeError();
                },
              },
              {
                label: "",
                type: "separator",
              },
              {
                label: "Network Fetch Error",
                onClick: async () => {
                  console.log('[TEST] Triggering network error...');
                  await ErrorSimulators.networkError();
                },
              },
              {
                label: "JSON Parse Error",
                onClick: () => {
                  console.log('[TEST] Triggering JSON parse error...');
                  ErrorSimulators.jsonParseError();
                },
              },
              {
                label: "LocalStorage Quota Error",
                onClick: () => {
                  console.log('[TEST] Triggering storage quota error...');
                  ErrorSimulators.storageQuotaError();
                },
              },
              {
                label: "Stack Overflow (Recursion)",
                onClick: () => {
                  console.log('[TEST] Triggering stack overflow...');
                  ErrorSimulators.stackOverflow();
                },
              },
              {
                label: "WASM/Backend Error",
                onClick: () => {
                  console.log('[TEST] Triggering WASM error...');
                  ErrorSimulators.wasmError();
                },
              },
              {
                label: "CORS Error",
                onClick: async () => {
                  console.log('[TEST] Triggering CORS error...');
                  await ErrorSimulators.corsError();
                },
              },
              {
                label: "Timeout Error",
                onClick: async () => {
                  console.log('[TEST] Triggering timeout error...');
                  await ErrorSimulators.timeoutError();
                },
              },
              {
                label: "Range Error",
                onClick: () => {
                  console.log('[TEST] Triggering range error...');
                  ErrorSimulators.rangeError();
                },
              },
              {
                label: "Reference Error",
                onClick: () => {
                  console.log('[TEST] Triggering reference error...');
                  ErrorSimulators.referenceError();
                },
              },
            ]}
          />
        )}
        {!embed && (
          <Dropdown
            label="File"
            align="left"
            items={[
              {
                label: "New",
                onClick: () => {
                  trackEvent('new-script');
                  props.onNew?.();
                },
              },
              {
                label: "",
                type: "separator",
              },
              {
                label: "Open from Disk",
                onClick: () => {
                  trackEvent('load-from-disk');
                  props.onLoadFromDisk?.();
                },
              },
              {
                label: "Open from Gist",
                onClick: () => {
                  trackEvent('load-from-gist');
                  props.onLoadFromGist?.();
                },
              },
              {
                label: "",
                type: "separator",
              },
              {
                label: "Download Script",
                onClick: () => {
                  trackEvent('save-script');
                  props.onSaveScript?.();
                },
              },
              // {
              //   label: "Download Project",
              //   onClick: () => {
              //     trackEvent('download-project');
              //     props.onDownloadProject?.();
              //   },
              // },
              {
                label: "Download Web Player",
                onClick: () => {
                  trackEvent('export-player');
                  props.onExportPlayer?.();
                },
              },
            ]}
          />
        )}
        {!embed && (
          <Dropdown
            label="Samples"
            align="left"
            items={[
              {
                label: "Loading a sample replaces your current content.",
                type: "info",
              },
              {
                label: "",
                type: "separator",
              },
              ...(props.samples?.map(sample => ({
                label: sample.name,
                onClick: () => {
                  trackEvent('load-sample', { sample: sample.id });
                  props.onLoadSample?.(sample.filename);
                },
              })) || []),
            ]}
          />
        )}
        {!embed && (
          <Dropdown
            label={<Settings size={18} />}
            align="right"
            items={[
              {
                label: "Saliency Strategy",
                type: "submenu",
                items: [
                  {
                    label: 'Random Best Least Recently Used',
                    selected: props.saliencyStrategy === 'random_best_least_recent',
                    onClick: () => {
                      trackEvent('set-saliency-strategy', { strategy: 'random_best_least_recent' });
                      props.onSaliencyStrategyChange?.('random_best_least_recent');
                    },
                  },
                  {
                    label: 'Best Least Recently Used',
                    selected: props.saliencyStrategy === 'best_least_recent',
                    onClick: () => {
                      trackEvent('set-saliency-strategy', { strategy: 'best_least_recent' });
                      props.onSaliencyStrategyChange?.('best_least_recent');
                    },
                  },
                  {
                    label: 'Best',
                    selected: props.saliencyStrategy === 'best',
                    onClick: () => {
                      trackEvent('set-saliency-strategy', { strategy: 'best' });
                      props.onSaliencyStrategyChange?.('best');
                    },
                  },
                  {
                    label: 'Random',
                    selected: props.saliencyStrategy === 'random',
                    onClick: () => {
                      trackEvent('set-saliency-strategy', { strategy: 'random' });
                      props.onSaliencyStrategyChange?.('random');
                    },
                  },
                  {
                    label: 'First',
                    selected: props.saliencyStrategy === 'first',
                    onClick: () => {
                      trackEvent('set-saliency-strategy', { strategy: 'first' });
                      props.onSaliencyStrategyChange?.('first');
                    },
                  },
                ],
              },
              {
                label: "Unavailable Options",
                type: "submenu",
                items: [
                  {
                    label: 'Hidden',
                    selected: props.unavailableOptionsMode === 'hidden',
                    onClick: () => {
                      trackEvent('set-unavailable-options-mode', { mode: 'hidden' });
                      props.onUnavailableOptionsModeChange?.('hidden');
                    },
                  },
                  {
                    label: 'Shown (struck through)',
                    selected: props.unavailableOptionsMode === 'strikethrough',
                    onClick: () => {
                      trackEvent('set-unavailable-options-mode', { mode: 'strikethrough' });
                      props.onUnavailableOptionsModeChange?.('strikethrough');
                    },
                  },
                ],
              },
              {
                label: "Visuals",
                type: "submenu",
                items: [
                  {
                    label: props.darkMode ? 'Light Mode' : 'Dark Mode',
                    onClick: () => {
                      trackEvent('toggle-dark-mode');
                      props.onToggleDarkMode?.();
                    },
                  },
                  {
                    label: props.showWaitProgress ? 'Wait Progress: On' : 'Wait Progress: Off',
                    onClick: () => {
                      trackEvent('toggle-wait-progress');
                      props.onShowWaitProgressChange?.(!props.showWaitProgress);
                    },
                  },
                  {
                    label: props.showDiceEffects ? 'Dice Effects: On' : 'Dice Effects: Off',
                    onClick: () => {
                      trackEvent('toggle-dice-effects');
                      props.onShowDiceEffectsChange?.(!props.showDiceEffects);
                    },
                  },
                ],
              },
              {
                label: "",
                type: "separator",
              },
              {
                label: "About",
                onClick: () => {
                  trackEvent('about-click');
                  props.onShowAbout?.();
                },
              },
            ]}
          />
        )}
        {!embed && (
          <Button
            onClick={() => {
              trackEvent('help-click');
              props.onShowHelp?.();
            }}
            title="Documentation"
          >
            <BookOpen size={18} />
          </Button>
        )}
        {/* GitHub status badge temporarily disabled */}
        {/* {!embed && props.githubAuthState && (
          <GitHubStatus
            authState={props.githubAuthState}
            onLogin={() => {
              trackEvent('github-login-status');
              props.onGitHubLogin?.();
            }}
            onLogout={() => {
              trackEvent('github-logout-status');
              props.onGitHubLogout?.();
            }}
          />
        )} */}
        {/* Only show in dev/preview environments */}
        {!embed && (import.meta.env.DEV || window.location.hostname.includes('preview')) && (
          <Button
            onClick={() => setShouldThrowError(true)}
            title="Test Error Boundary"
          >
            Test Error
          </Button>
        )}
        <Button
          onClick={props.isRunning
            ? () => {
                trackEvent('stop-dialogue');
                props.onStop?.();
              }
            : props.onPlay
              ? () => {
                  trackEvent('run-dialogue');
                  props.onPlay?.();
                }
              : undefined
          }
          iconURL={props.isRunning ? undefined : (props.backendStatus === 'loading' ? undefined : images.PlayIconURL)}
          disabled={!props.onPlay && !props.isRunning && props.backendStatus !== 'loading'}
          loading={props.backendStatus === 'loading'}
          variant="primary"
        >
          {props.backendStatus === 'loading' ? 'Loading...' : props.isRunning ? 'Stop' : 'Run'}
        </Button>
      </div>
    </div>
  );
}
