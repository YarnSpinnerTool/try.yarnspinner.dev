import { YarnSpinner } from "backend";

import { VariableStorage, YarnValue } from "@yarnspinnertool/core";

import { Runner, YarnStoryHandle } from "../components/Runner";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AppHeader } from "../components/AppHeader";
import { ButtonGroup, ButtonGroupItem } from "../components/ButtonGroup";
import type { CodeMirrorEditorHandle } from "../components/CodeMirrorEditor";
import { VariableView } from "../components/VariableView";
import { compilationDebounceMilliseconds, scriptKey } from "../config.json";
import c from "../utility/classNames";
import { downloadStandaloneRunner } from "../utility/downloadStandaloneRunner";
import { useDebouncedCallback } from "../utility/useDebouncedCallback";
import { YarnStorageContext } from "../YarnStorageContext";
import { fetchInitialContent } from "../utility/fetchInitialContent";

// Lazily load the editor component, which is large and complex
const CodeMirrorEditor = lazy(() => import("../components/CodeMirrorEditor"));

import { backendPromise, onBackendStatusChange, BackendStatus } from "../utility/loadBackend";

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

    // Store script in local storage
    window.localStorage.setItem(scriptKey, value);

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

  const handlePlay = useCallback(async () => {
    // Get current editor content and compile it immediately (bypass debounce)
    const currentContent = editorRef.current?.getValue();
    if (currentContent) {
      await compileYarnScript(currentContent);
      // Wait for React state update to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    setViewMode("game");
    // Wait for view mode change and Runner to mount
    await new Promise(resolve => setTimeout(resolve, 100));
    playerRef.current?.start();
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
          onPlay={backendStatus === 'ready' && !hasErrors ? handlePlay : undefined}
          onExportPlayer={() => {
            if (!state.compilationResult) {
              return;
            }
            downloadStandaloneRunner(state.compilationResult);
          }}
          backendStatus={backendStatus}
        />

        {/* App - Two column layout with individual scrolling */}
        <div className="flex flex-1 min-h-0">
          {/* Editor */}
          <div
            className={c(
              "w-full md:w-1/2 overflow-hidden",
              "md:flex",
              viewMode === "code" ? "flex" : "hidden",
            )}
          >
            <Suspense fallback={<div className="p-4">Loading editor...</div>}>
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
            </Suspense>
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
        <div className="flex justify-center md:hidden">
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
