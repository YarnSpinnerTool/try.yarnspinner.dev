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
import { compilationDebounceMilliseconds, scriptKey } from "../config.json";
import c from "../utility/classNames";
import { downloadStandaloneRunner } from "../utility/downloadStandaloneRunner";
import { useDebouncedCallback } from "../utility/useDebouncedCallback";
import { YarnStorageContext } from "../YarnStorageContext";
import { fetchInitialContent } from "../utility/fetchInitialContent";
import { loadFromDisk } from "../utility/loadFromDisk";
import { fetchGist } from "../utility/fetchGist";
import { extractGistId } from "../utility/extractGistId";

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
  }, []);

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

  // Check if there are any compilation errors
  const hasErrors = state.compilationResult?.diagnostics.some(
    d => d.severity === YarnSpinner.DiagnosticSeverity.Error
  ) ?? false;

  return (
    <YarnStorageContext.Provider value={storage.current}>
      <div className="flex h-full w-full flex-col" style={{backgroundColor: '#F9F7F9'}}>
        {/* Header */}
        <AppHeader
          onSaveScript={editorRef.current?.saveContents}
          onLoadFromDisk={handleLoadFromDisk}
          onLoadFromGist={handleLoadFromGist}
          onPlay={backendStatus === 'ready' && !hasErrors ? handlePlay : undefined}
          onExportPlayer={() => {
            if (!state.compilationResult) {
              return;
            }
            downloadStandaloneRunner(state.compilationResult);
          }}
          backendStatus={backendStatus}
        />

        {/* Error overlay */}
        {backendStatus === 'error' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4">
              <h2 className="text-xl font-bold text-red-600 mb-4">Failed to Load Runtime</h2>
              <p className="text-gray-700 mb-6">
                The Yarn Spinner runtime failed to load. This might be due to:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
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
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
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
              ref={editorRef}
            />
          </div>

          {/* Player */}
          <div
            className={c(
              "flex w-full md:w-1/2 flex-col border-l relative",
              "md:flex",
              viewMode === "game" ? "flex" : "hidden",
            )}
            style={{borderColor: '#E5E1E6'}}
          >
            {/* Variables Popover - absolutely positioned */}
            <VariableView
              compilationResult={state.compilationResult}
              storage={storage.current}
            />

            {/* Log */}
            <div className="flex-1 bg-white flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <Runner
                  locale="en-US"
                  compilationResult={state.compilationResult}
                  ref={playerRef}
                  onVariableChanged={updateVariableDisplay}
                  backendStatus={backendStatus}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile view switcher - fixed at bottom */}
        <div
          className="fixed bottom-0 left-0 right-0 flex justify-center md:hidden bg-white border-t shadow-lg z-40"
          style={{
            borderColor: '#E5E1E6',
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
              onClick={() => setViewMode("game")}
              active={viewMode === "game"}
            >
              Play
            </ButtonGroupItem>
          </ButtonGroup>
        </div>
      </div>
    </YarnStorageContext.Provider>
  );
}
