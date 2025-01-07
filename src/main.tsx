import react from "react-dom/client";

import "./css/index.css";

import defaultInitialContent from "./DefaultContent.yarn?raw";

import backend, { YarnSpinner } from "backend";

import { Program, VariableStorage, YarnValue } from "@yarnspinnertool/core";

import { Runner, YarnStoryHandle } from "./components/Runner";

import {
  lazy,
  PropsWithChildren,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import { AppHeader } from "./components/AppHeader";
import { Button } from "./components/Button";
import type { MonacoEditorHandle } from "./components/Editor";
import { VariableView } from "./components/VariableView";
import { compilationDebounceMilliseconds, scriptKey } from "./config.json";
import { fetchGist } from "./utility/fetchGist";
import base64ToBytes from "./utility/base64ToBytes";
import c from "./utility/classNames";
import { downloadFile } from "./utility/downloadFile";
import { downloadStandaloneRunner } from "./utility/downloadStandaloneRunner";
import useBodyClass from "./utility/useBodyClass";
import { useDebouncedCallback } from "./utility/useDebouncedCallback";
import isEmbed from "./utility/useEmbed";
import { YarnStorageContext } from "./YarnStorageContext";

// Lazily load the editor component, which is large and complex
const MonacoEditor = lazy(() => import("./components/Editor"));

// Start booting the backend immediately, and create a promise that we can await
// when we eventually need to use the backend
async function loadDotNet() {
  if (backend.getStatus() != backend.BootStatus.Booted) {
    console.log("Booting dotnet...");
    await backend.boot({ root: "/backend" });
  }
}
const backendPromise = loadDotNet();

type InitialContentLoadingState =
  | {
      state: "loading" | "error";
    }
  | { state: "loaded"; value: string };

async function fetchInitialContent() {
  const location = window.location.href;
  const url = new URL(location);

  const gistID = url.searchParams.get("gist");
  if (gistID !== null) {
    try {
      console.log(`Loading from Gist ${gistID}`);
      const content = await fetchGist(gistID);
      console.log(`Got content from Gist.`);
      return content;
    } catch {
      console.warn(`Failed to load from gist. Loading default content.`);
      return defaultInitialContent;
    }
  } else {
    const localStorage = window.localStorage.getItem(scriptKey);
    if (localStorage !== null && localStorage.length > 0) {
      console.log(`Loading initial content from local storage.`);
      return localStorage;
    }

    console.log(`Loading default content`);
    return defaultInitialContent;
  }
}

type ViewMode = "code" | "game";

function DevDownloadCompilationButton(props: {
  result?: YarnSpinner.CompilationResult;
}) {
  if (!import.meta.env.DEV) {
    return null;
  }
  if (props.result) {
    return (
      <Button
        onClick={() => {
          const program = Program.fromBinary(
            base64ToBytes(props.result?.programData ?? ""),
          );
          const programJSON = Program.toJson(program);

          const outputData = {
            ...props.result,
            program: programJSON,
          };
          const json = JSON.stringify(outputData, null, 2);
          downloadFile(json, "CompilationResult.json");
        }}
      >
        Download Compilation Result
      </Button>
    );
  } else {
    return "No compilation result available";
  }
}

function Layout() {
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

        {/* <Row className="d-sm-none">
          <Col className="d-flex justify-content-center p-2">
            <ButtonGroup>
              <Button
                className="btn-primary"
                active={viewMode === "code"}
                aria-current="page"
                onClick={() => setViewMode("code")}
              >
                Code
              </Button>

              <Button
                className="btn-primary"
                aria-current="page"
                active={viewMode === "game"}
                onClick={() => setViewMode("game")}
              >
                Preview
              </Button>
            </ButtonGroup>
            {/* <div className="btn-group">
              <button
                id="set-view-code"
                className="btn btn-primary active"
                aria-current="page"
              ></button>{" "}
              <button id="set-view-game" className="btn btn-primary">
                Preview
              </button>
            </div> * /}
          </Col>
        </Row> */}
      </div>
    </YarnStorageContext.Provider>
  );
}

function ButtonGroup(props: PropsWithChildren) {
  return <div className="flex p-2">{props.children}</div>;
}

function ButtonGroupItem(
  props: { onClick?: () => void; active?: boolean } & PropsWithChildren,
) {
  return (
    <div
      role="button"
      onClick={props.onClick}
      aria-current={props.active ? "page" : "false"}
      className={c(
        "select-none p-2 px-4 font-bold text-white transition-colors first:rounded-l-md last:rounded-r-md hover:bg-green-600",
        props.active ? "bg-green-400" : "bg-green-500",
      )}
    >
      {props.children}
    </div>
  );
}

const SerializedGameStateSchema = z.record(z.string(), z.boolean());

function App() {
  const bodyClassName = isEmbed() ? "embedded" : null;

  useBodyClass(bodyClassName);

  return (
    <>
      <Layout />
    </>
  );
}

react.createRoot(document.getElementById("app")!).render(
  <>
    <App />
    {/* <CompilerTest /> */}
    {/* <Layout /> */}
  </>,
);
