import react from "react-dom/client";

import { Button, ButtonGroup, Col, Container, Row } from "react-bootstrap";
import "./scss/App.scss";

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
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { useDebouncedCallback } from "./utility";
import { YarnStorageContext } from "./YarnStorageContext";
// import { MonacoEditor, MonacoEditorHandle } from "./EditorNeue";
import { fetchGist } from "./fetchGist";
import isEmbed from "./useEmbed";

import type { MonacoEditorHandle } from "./Editor";
import { downloadFile } from "./downloadFile";
import { downloadStandaloneRunner } from "./downloadStandaloneRunner";
import base64ToBytes from "./base64ToBytes";

import { compilationDebounceMilliseconds, scriptKey } from "./config.json";
import useBodyClass from "./useBodyClass";

// Lazily load the editor component, which is large and complex
const MonacoEditor = lazy(() => import("./Editor"));

// Start booting the backend immediately, and create a promise that we can await
// when we eventually need to use the backend
async function loadDotNet() {
  if (backend.getStatus() != backend.BootStatus.Booted) {
    console.log("Booting dotnet...");
    await backend.boot({ root: "/bin" });
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
  if (isEmbed()) {
    return (
      <div
        className="row p-2 flex-shrink-0 align-items-center"
        id="mini-app-header"
      >
        <div className="col-12 d-flex align-items-center justify-content-between">
          <div>
            <img height="20px" src={YarnSpinnerLogoURL} id="logo" />{" "}
            <a
              id="title-link"
              href="https://try.yarnspinner.dev"
              target="_blank"
              rel="noreferrer"
            >
              Try Yarn Spinner
            </a>
          </div>
          <div>
            <button
              type="button"
              className="p-1 fs-0 my-0 btn btn-primary"
              id="button-test"
              onClick={props.onPlay}
            >
              <img height="24px" src={PlayIconURL} /> Run
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <Row className="p-3 flex-shrink-0 align-items-center" id={"app-header"}>
        <Col md={6}>
          <img
            // markup-inline
            height="70px"
            src={YarnSpinnerLogoURL}
            id="logo"
          />
          <h1>Try Yarn Spinner</h1>
        </Col>
        <Col md={6}>
          <div className="d-flex justify-content-end gap-1">
            <a href="https://docs.yarnspinner.dev/">
              <Button>
                <img height="24" src={DocsIconURL} />
                Docs
              </Button>
            </a>
            <Button onClick={props.onSaveScript}>
              <img height="24" src={SaveScriptIconURL} />
              Save Script
            </Button>
            <Button onClick={props.onExportPlayer}>
              <img height="24" src={ExportPlayerIconURL} />
              Export Player
            </Button>
            <Button onClick={props.onPlay}>
              <img height="24" src={PlayIconURL} />
              Run
            </Button>
          </div>
        </Col>
      </Row>
    );
  }
}

function c(...classNames: (string | false | null | undefined)[]) {
  return classNames.filter((a) => !!a).join(" ");
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
            base64ToBytes(props.result?.programData ?? "")
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
  compilationResult: YarnSpinner.CompilationResult
): string | undefined {
  const decls = compilationResult.variableDeclarations as unknown as Record<
    string,
    YarnSpinner.VariableDeclaration
  >;

  const decl = decls[name];

  if (!decl) {
    return undefined;
  }

  return decl.type;
}

function getVariableDisplayValue(
  name: string,
  value: YarnValue,
  compilationResult: YarnSpinner.CompilationResult
): string {
  const decls = compilationResult.variableDeclarations as unknown as Record<
    string,
    YarnSpinner.VariableDeclaration
  >;

  const decl = decls[name];

  const types = compilationResult.typeDeclarations as unknown as Record<
    string,
    YarnSpinner.TypeDeclaration
  >;

  if (decl) {
    // We have a declaration for this variable. Do we have a type declaration?
    if (decl.type in types) {
      // We do. Is it an enum (i.e. it has a 'cases' dict)?
      const type = types[decl.type];
      if ("cases" in type) {
        // Try to find the case name of this value.
        const cases = type.cases as Record<string, number | string>;
        const caseName = (Object.entries(cases).find(
          (kv) => kv[1] === value
        ) ?? [undefined])[0];

        // Found it! Return the case name, not the raw value name.
        if (caseName) {
          return caseName;
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
    <Container className="h-100 d-flex flex-column" fluid>
      <YarnStorageContext.Provider value={storage.current}>
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
        <Row
          className="flex-fill justify-content-center"
          style={{ minHeight: 0 }}
        >
          <Col
            xs={12}
            sm={6}
            className={c(
              "mh-100",
              "d-sm-block",
              viewMode !== "code" && "d-none"
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
          </Col>
          <Col
            xs={12}
            sm={6}
            className={c(
              "pt-2",
              "mh-100",
              "d-sm-block",
              viewMode !== "game" && "d-none"
            )}
          >
            <Container className="h-100 d-flex flex-column">
              <Row className="flex-fill mh-100" style={{ overflowY: "scroll" }}>
                <Col md={12}>
                  <DevDownloadCompilationButton
                    result={state.compilationResult}
                  />
                  <div id="controls">
                    <YarnStory
                      locale="en-US"
                      compilationResult={state.compilationResult}
                      ref={playerRef}
                      onVariableChanged={updateVariableDisplay}
                    />
                  </div>
                </Col>
              </Row>
              {Object.entries(storage.current).length > 0 && (
                <Row
                  className="flex-shrink-0 mt-3"
                  style={{ maxHeight: "25%", overflowY: "scroll" }}
                >
                  <Col md={12}>
                    <div id="variables">
                      <table className="table table-borderless">
                        <thead>
                          <tr>
                            <th>Variable</th>
                            <th>Type</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody id="variables-body">
                          {Object.entries(storage.current).map(
                            ([name, val], i) => {
                              if (!state.compilationResult) {
                                // No compilation result, so no variable info to
                                // show
                                return null;
                              }
                              return (
                                <tr key={i}>
                                  <td>{name}</td>
                                  <td>
                                    {getVariableType(
                                      name,
                                      state.compilationResult
                                    )}
                                  </td>
                                  <td>
                                    {getVariableDisplayValue(
                                      name,
                                      val,
                                      state.compilationResult
                                    )}
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Col>
                </Row>
              )}
            </Container>
          </Col>
        </Row>
        <Row className="d-sm-none">
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
            </div> */}
          </Col>
        </Row>
      </YarnStorageContext.Provider>
    </Container>
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
  </>
);
