import { YarnSpinner } from "backend";

import { VariableStorage, YarnValue } from "@yarnspinnertool/core";

import { Runner, YarnStoryHandle } from "../components/Runner";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AppHeader } from "../components/AppHeader";
import { ButtonGroup, ButtonGroupItem } from "../components/ButtonGroup";
import CodeMirrorEditor, { type CodeMirrorEditorHandle } from "../components/CodeMirrorEditor";
import { VariableView } from "../components/VariableView";
import { HelpPanel } from "../components/HelpPanel";
import { compilationDebounceMilliseconds, scriptKey } from "../config.json";
import c from "../utility/classNames";
import { downloadStandaloneRunner } from "../utility/downloadStandaloneRunner";
import { useDebouncedCallback } from "../utility/useDebouncedCallback";
import { YarnStorageContext } from "../YarnStorageContext";
import { fetchInitialContent } from "../utility/fetchInitialContent";
import { loadFromDisk } from "../utility/loadFromDisk";
import { fetchGist } from "../utility/fetchGist";
import { extractGistId } from "../utility/extractGistId";
import { loadSample, SAMPLES } from "../utility/loadSample";

import { backendPromise, onBackendStatusChange, BackendStatus, retryBackendLoad } from "../utility/loadBackend";
import { Button } from "../components/Button";

type InitialContentLoadingState =
  | {
      state: "loading" | "error";
    }
  | { state: "loaded"; value: string };

type ViewMode = "code" | "game";

export function TryYarnSpinner() {
  const [state, setState] = useState<{
    compilationResult?: YarnSpinner.CompilationResult;
  }>({});

  const [backendStatus, setBackendStatus] = useState<BackendStatus>('loading');

  const [viewMode, setViewMode] = useState<ViewMode>("code");

  // Track if user has tapped Play tab before (for first-time UX hint)
  const [hasPlayedBefore, setHasPlayedBefore] = useState(() => {
    return localStorage.getItem('hasPlayedBefore') === 'true';
  });

  // Detect if we're on mobile (play pane not visible by default)
  const [isMobile, setIsMobile] = useState(() => {
    return window.innerWidth < 768; // sm breakpoint
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePlayTabClick = useCallback(() => {
    setViewMode("game");
    if (!hasPlayedBefore) {
      setHasPlayedBefore(true);
      localStorage.setItem('hasPlayedBefore', 'true');
    }
  }, [hasPlayedBefore]);

  const onEdited = useDebouncedCallback(async (value: string | undefined) => {
    if (value === undefined) {
      // No content
      return;
    }

    // Store script in local storage, or clear it if empty
    if (value.trim().length === 0) {
      window.localStorage.removeItem(scriptKey);
    } else {
      window.localStorage.setItem(scriptKey, value);
    }

    compileYarnScript(value);
  }, compilationDebounceMilliseconds);

  const compileYarnScript = useCallback(async (source: string) => {
    await backendPromise;

    // Check if backend loaded successfully
    if (backendStatus !== 'ready') {
      console.log("Backend not ready, skipping compilation");
      return;
    }

    console.log("Compiling...");
    const result = await YarnSpinner.compileAsync({ source });

    if (result.programData) {
      console.log("Compilation success");
    } else {
      console.log("Compilation failure");
    }

    setState({
      compilationResult: result,
    });

    return result;
  }, [backendStatus]);

  const [initialContentState, setInitialContentState] =
    useState<InitialContentLoadingState>({
      state: "loading",
    });

  useEffect(() => {
    let ignore = false;

    fetchInitialContent().then((content) => {
      if (ignore) {
        return;
      }
      setInitialContentState({ state: "loaded", value: content });
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (initialContentState.state === "loaded") {
      compileYarnScript(initialContentState.value);
    }
  }, [compileYarnScript, initialContentState]);

  // Track backend loading status
  useEffect(() => {
    const unsubscribe = onBackendStatusChange((status) => {
      setBackendStatus(status);
    });
    return unsubscribe;
  }, []);

  const updateVariableDisplay = useCallback((name: string, val: YarnValue) => {
    console.log(`Updated ${name} to ${val}`);
    setStorageContentsVersion((v) => v + 1);
  }, []);

  const storage = useRef<VariableStorage>({});

  const [, setStorageContentsVersion] = useState(0);

  const playerRef = useRef<YarnStoryHandle>(null);

  const editorRef = useRef<CodeMirrorEditorHandle>(null);

  // Save or clear localStorage before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentContent = editorRef.current?.getValue();
      if (currentContent !== undefined) {
        if (currentContent.trim().length === 0) {
          window.localStorage.removeItem(scriptKey);
        } else {
          window.localStorage.setItem(scriptKey, currentContent);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handlePlay = useCallback(async () => {
    // Get current editor content and compile it immediately (bypass debounce)
    const currentContent = editorRef.current?.getValue();
    if (!currentContent) {
      return;
    }

    const result = await compileYarnScript(currentContent);

    // Only proceed if compilation succeeded
    if (!result) {
      return;
    }

    // Switch to game mode
    setViewMode("game");

    // Small delay for Runner to mount
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

    // Load and start with the fresh result
    playerRef.current?.loadAndStart(result);
  }, [compileYarnScript]);

  const handleLoadFromDisk = useCallback(async () => {
    try {
      const content = await loadFromDisk();
      editorRef.current?.setValue(content);
      // Compile the loaded content
      await compileYarnScript(content);
    } catch (error) {
      if (error instanceof Error && error.message !== 'File selection cancelled') {
        console.error('Failed to load file:', error);
        alert('Could not load the file. Please make sure it\'s a valid text file and try again.');
      }
    }
  }, [compileYarnScript]);

  const handleLoadFromGist = useCallback(async () => {
    const input = prompt('Enter GitHub Gist URL or ID:');
    if (!input) {
      return;
    }

    try {
      const gistId = extractGistId(input);
      const content = await fetchGist(gistId);
      editorRef.current?.setValue(content);
      // Compile the loaded content
      await compileYarnScript(content);
    } catch (error) {
      console.error('Failed to load gist:', error);

      // Make error messages more user-friendly
      let userMessage = 'Could not load the Gist. ';

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('not found') || msg.includes('404')) {
          userMessage += 'The Gist ID or URL you entered does not exist. Please check it and try again.';
        } else if (msg.includes('truncated')) {
          userMessage += 'The Gist file is too large to load.';
        } else if (msg.includes('empty')) {
          userMessage += 'The Gist appears to be empty.';
        } else if (msg.includes('no files')) {
          userMessage += 'The Gist does not contain any files.';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          userMessage += 'Network error. Please check your internet connection and try again.';
        } else {
          userMessage += 'Please check the Gist ID or URL and try again.';
        }
      } else {
        userMessage += 'Please check the Gist ID or URL and try again.';
      }

      alert(userMessage);
    }
  }, [compileYarnScript]);

  const handleLoadSample = useCallback(async (filename: string) => {
    try {
      const content = await loadSample(filename);
      editorRef.current?.setValue(content);
      // Compile the loaded content
      await compileYarnScript(content);
    } catch (error) {
      console.error('Failed to load sample:', error);
      alert('Could not load the sample. Please try again.');
    }
  }, [compileYarnScript]);

  // Check if there are any compilation errors
  const hasErrors = state.compilationResult?.diagnostics.some(
    d => d.severity === YarnSpinner.DiagnosticSeverity.Error
  ) ?? false;

  // State for help panel visibility
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // Saliency strategy state
  const [saliencyStrategy, setSaliencyStrategy] = useState<string>(() => {
    return localStorage.getItem('saliencyStrategy') || 'random_best_least_recent';
  });

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Save saliency strategy to localStorage
  useEffect(() => {
    localStorage.setItem('saliencyStrategy', saliencyStrategy);
  }, [saliencyStrategy]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Cmd/Ctrl + Enter: Run dialogue
      if (cmdOrCtrl && event.key === 'Enter') {
        event.preventDefault();
        if (backendStatus === 'ready' && !hasErrors) {
          handlePlay();
        }
        return;
      }

      // Cmd/Ctrl + S: Save script
      if (cmdOrCtrl && event.key === 's') {
        event.preventDefault();
        editorRef.current?.saveContents();
        return;
      }

      // Escape: Close help panel
      if (event.key === 'Escape' && showHelpPanel) {
        event.preventDefault();
        setShowHelpPanel(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [backendStatus, hasErrors, handlePlay, viewMode, showHelpPanel]);

  return (
    <YarnStorageContext.Provider value={storage.current}>
      <div className="flex h-full w-full flex-col" style={{backgroundColor: darkMode ? '#4C434F' : '#F9F7F9'}}>
        {/* Header */}
        <AppHeader
          onSaveScript={editorRef.current?.saveContents}
          onLoadFromDisk={handleLoadFromDisk}
          onLoadFromGist={handleLoadFromGist}
          onLoadSample={handleLoadSample}
          samples={SAMPLES}
          onPlay={backendStatus === 'ready' && !hasErrors ? handlePlay : undefined}
          onExportPlayer={() => {
            if (!state.compilationResult) {
              return;
            }
            downloadStandaloneRunner(state.compilationResult);
          }}
          onShowHelp={() => setShowHelpPanel(true)}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          backendStatus={backendStatus}
          saliencyStrategy={saliencyStrategy}
          onSaliencyStrategyChange={setSaliencyStrategy}
        />

        {/* Error overlay */}
        {backendStatus === 'error' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#3A3340] rounded-lg shadow-xl p-8 max-w-md mx-4">
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Failed to Load Runtime</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                The Yarn Spinner runtime failed to load. This might be due to:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-6 space-y-2">
                <li>Cached files from an old version</li>
                <li>Network connection issues</li>
                <li>Browser compatibility problems</li>
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setBackendStatus('loading');
                    try {
                      await retryBackendLoad();
                    } catch (e) {
                      // Error will be handled by onBackendStatusChange
                    }
                  }}
                  className="flex-1 bg-green text-white px-4 py-2 rounded-lg font-semibold hover:bg-green/90 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={() => {
                    // Clear cache and reload
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(registrations => {
                        registrations.forEach(reg => reg.unregister());
                      });
                    }
                    window.location.reload();
                  }}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear Cache & Reload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* App - Two column layout with individual scrolling */}
        <div className="flex flex-1 min-h-0 pb-16 md:pb-0 pt-12">
          {/* Editor */}
          <div
            className={c(
              "w-full md:w-1/2 overflow-hidden",
              "md:flex",
              viewMode === "code" ? "flex" : "hidden",
            )}
          >
            <CodeMirrorEditor
              initialValue={
                (initialContentState.state === "loaded" &&
                  initialContentState.value) ||
                ""
              }
              compilationResult={state.compilationResult}
              onValueChanged={onEdited}
              darkMode={darkMode}
              ref={editorRef}
            />
          </div>

          {/* Player */}
          <div
            className={c(
              "flex w-full md:w-1/2 flex-col border-l relative border-[#E5E1E6] dark:border-[#534952]",
              "md:flex",
              viewMode === "game" ? "flex" : "hidden",
            )}
          >
            {/* Variables Popover - absolutely positioned */}
            <VariableView
              compilationResult={state.compilationResult}
              storage={storage.current}
            />

            {/* Log */}
            <div className="flex-1 bg-white dark:bg-[#3A3340] flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <Runner
                  locale="en-US"
                  compilationResult={state.compilationResult}
                  ref={playerRef}
                  onVariableChanged={updateVariableDisplay}
                  backendStatus={backendStatus}
                  saliencyStrategy={saliencyStrategy}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile view switcher - fixed at bottom */}
        <div
          className="fixed bottom-0 left-0 right-0 flex justify-center md:hidden bg-white dark:bg-[#3A3340] border-t border-[#E5E1E6] dark:border-[#534952] shadow-lg z-40"
          style={{
            paddingTop: '0.5rem',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
          }}
        >
          <ButtonGroup>
            <ButtonGroupItem
              onClick={() => setViewMode("code")}
              active={viewMode === "code"}
            >
              Code
            </ButtonGroupItem>
            <ButtonGroupItem
              onClick={handlePlayTabClick}
              active={viewMode === "game"}
              pulse={isMobile && !hasPlayedBefore}
            >
              Play
            </ButtonGroupItem>
          </ButtonGroup>
        </div>

        {/* Help Panel - shows when ? is pressed */}
        {showHelpPanel && <HelpPanel onClose={() => setShowHelpPanel(false)} />}
      </div>
    </YarnStorageContext.Provider>
  );
}
