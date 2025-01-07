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
import { DevDownloadCompilationButton } from "../components/DevDownloadCompilationButton";
import type { MonacoEditorHandle } from "../components/Editor";
import { VariableView } from "../components/VariableView";
import { compilationDebounceMilliseconds, scriptKey } from "../config.json";
import c from "../utility/classNames";
import { downloadStandaloneRunner } from "../utility/downloadStandaloneRunner";
import { useDebouncedCallback } from "../utility/useDebouncedCallback";
import { YarnStorageContext } from "../YarnStorageContext";
import { fetchInitialContent } from "../utility/fetchInitialContent";

// Lazily load the editor component, which is large and complex
const MonacoEditor = lazy(() => import("../components/Editor"));

import { backendPromise } from "../utility/loadBackend";

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

  const updateVariableDisplay = useCallback((name: string, val: YarnValue) => {
    console.log(`Updated ${name} to ${val}`);
    setStorageContentsVersion((v) => v + 1);
  }, []);

  const storage = useRef<VariableStorage>({});

  const [, setStorageContentsVersion] = useState(0);

  const playerRef = useRef<YarnStoryHandle>(null);

  const editorRef = useRef<MonacoEditorHandle>(null);

  return (
    <YarnStorageContext.Provider value={storage.current}>
      <div className="flex size-full flex-col bg-white">
        {/* Header */}
        <AppHeader
          onSaveScript={editorRef.current?.saveContents}
          onPlay={() => {
            setViewMode("game");
            playerRef.current?.start();
          }}
          onExportPlayer={() => {
            if (!state.compilationResult) {
              return;
            }
            downloadStandaloneRunner(state.compilationResult);
          }}
        />

        {/* App */}
        <div className="flex h-full min-h-0 flex-row justify-normal">
          {/* Editor */}
          <div
            className={c(
              "w-full md:w-[50%]",
              "md:block",
              viewMode === "code" ? "block" : "hidden",
            )}
          >
            <Suspense fallback={"Loading editor..."}>
              <MonacoEditor
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
              "flex grow flex-col",
              "md:flex",
              viewMode === "game" ? "flex" : "hidden",
            )}
          >
            {/* Log */}
            <div className="grow overflow-y-auto p-3">
              <DevDownloadCompilationButton result={state.compilationResult} />

              <Runner
                locale="en-US"
                compilationResult={state.compilationResult}
                ref={playerRef}
                onVariableChanged={updateVariableDisplay}
              />
            </div>

            {/* Variables */}
            <VariableView
              compilationResult={state.compilationResult}
              storage={storage.current}
            />
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
