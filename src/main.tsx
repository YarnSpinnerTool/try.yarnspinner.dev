import react from "react-dom/client";

import "./css/index.css";

import defaultInitialContent from "./DefaultContent.yarn?raw";

import backend, { YarnSpinner } from "backend";

import DocsIconURL from "./img/Book-QuestionMark.svg";
import SaveScriptIconURL from "./img/DownArrow-from-Tray.svg";
import PlayIconURL from "./img/Play.svg";
import ExportPlayerIconURL from "./img/UpArrow-from-Tray.svg";
import YarnSpinnerLogoURL from "./img/yarnspinner.svg";

import { Program, VariableStorage, YarnValue } from "@yarnspinnertool/core";

import { YarnStory, YarnStoryHandle } from "./YarnStory";

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

import type { MonacoEditorHandle } from "./Editor";
import { YarnStorageContext } from "./YarnStorageContext";
import base64ToBytes from "./base64ToBytes";
import c from "./classNames";
import { Button } from "./components";
import { compilationDebounceMilliseconds, scriptKey } from "./config.json";
import { downloadFile } from "./downloadFile";
import { downloadStandaloneRunner } from "./downloadStandaloneRunner";
import { fetchGist } from "./fetchGist";
import useBodyClass from "./useBodyClass";
import isEmbed from "./useEmbed";
import { useDebouncedCallback } from "./utility";

// Lazily load the editor component, which is large and complex
const MonacoEditor = lazy(() => import("./Editor"));

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

function AppHeader(props: {
  onSaveScript?: () => void;
  onPlay?: () => void;
  onExportPlayer?: () => void;
}) {
  const embed = isEmbed();

  return (
    <div
      className={c(
        "border-b-green flex w-full shrink-0 flex-row justify-between border-b-2 bg-green-50",
        embed ? "p-2 pl-3" : "p-4 pl-6",
      )}
    >
      <div className="flex flex-row items-center gap-4">
        <img
          className={c(embed ? "h-[40px]" : "h-[40px] md:h-[70px]")}
          src={YarnSpinnerLogoURL}
        />
        <h1
          className={c(
            "font-title hidden sm:block",
            embed ? "text-xl" : "sm:text-2xl md:text-4xl",
          )}
        >
          Try Yarn Spinner
        </h1>
      </div>
      <div className="flex items-center gap-1 text-end">
        {embed ? null : (
          <a className="select-none" href="https://docs.yarnspinner.dev">
            <Button iconURL={DocsIconURL}>Docs</Button>
          </a>
        )}
        {embed ? null : (
          <Button onClick={props.onSaveScript} iconURL={SaveScriptIconURL}>
            Save Script
          </Button>
        )}
        {embed ? null : (
          <Button onClick={props.onExportPlayer} iconURL={ExportPlayerIconURL}>
            Export Player
          </Button>
        )}
        <Button onClick={props.onPlay} iconURL={PlayIconURL}>
          Run
        </Button>
      </div>
    </div>
  );
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

function getVariableType(
  name: string,
  compilationResult: YarnSpinner.CompilationResult,
): string | undefined {
  const decls = compilationResult.variableDeclarations;

  const decl = decls[name];

  if (!decl) {
    return undefined;
  }

  return decl.type;
}

function getVariableDisplayValue(
  name: string,
  value: YarnValue,
  compilationResult: YarnSpinner.CompilationResult,
): string {
  if (compilationResult.variableDeclarations[name]) {
    // We have a declaration for this variable. Do we have a type declaration?
    if (
      compilationResult.variableDeclarations[name].type in
      compilationResult.typeDeclarations
    ) {
      // We do. Is it an enum (i.e. it has a 'cases' dict)?
      const type =
        compilationResult.typeDeclarations[
          compilationResult.variableDeclarations[name].type
        ];

      if ("cases" in type) {
        // Try to find the case name of this value.
        const cases = type.cases as Record<string, number | string>;

        const matchingCase = Object.entries(cases).find(
          (kv) => kv[1] === value,
        );

        if (matchingCase) {
          // Found it! Return the case name, not the raw value name.
          return matchingCase[0];
        }
      }
    }
  }

  // We didn't find a decl for the variable, or we didn't find a case name for
  // it. Convert it directly to a string.
  return value.toString();
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

              <YarnStory
                locale="en-US"
                compilationResult={state.compilationResult}
                ref={playerRef}
                onVariableChanged={updateVariableDisplay}
              />
            </div>

            {/* Variables */}
            {Object.entries(storage.current).length > 0 && (
              <div
                id="variables"
                className="h-[25%] shrink-0 overflow-y-auto p-3"
              >
                <table className="w-full">
                  <thead className="border-grey-50 border-b-2 text-left">
                    <tr>
                      <th>Variable</th>
                      <th>Type</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody id="variables-body">
                    {Object.entries(storage.current).map(([name, val], i) => {
                      if (!state.compilationResult) {
                        // No compilation result, so no variable info to
                        // show
                        return null;
                      }
                      return (
                        <tr key={i}>
                          <td>{name}</td>
                          <td>
                            {getVariableType(name, state.compilationResult)}
                          </td>
                          <td>
                            {getVariableDisplayValue(
                              name,
                              val,
                              state.compilationResult,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
