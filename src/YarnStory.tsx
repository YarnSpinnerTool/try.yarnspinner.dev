import {
  BasicLineProvider,
  BestLeastRecentlyViewedSalienceStrategy,
  Line,
  LineProvider,
  LocalizedLine,
  OptionItem,
  Program,
  YarnValue,
  YarnVM,
} from "@yarnspinnertool/core";
import {
  ForwardedRef,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { YarnStorageContext } from "./YarnStorageContext";
import { YarnSpinner } from "backend";
import base64ToBytes from "./base64ToBytes";

export type YarnStoryHandle = {
  start: () => void;
};

type HistoryItem =
  | { type: "line"; line: Line }
  | { type: "command"; command: string }
  | {
      type: "selected-option";
      option: OptionItem;
    }
  | { type: "complete" };

type CurrentAction =
  | { action: "continue-line"; continue: () => void }
  | { action: "continue-command"; continue: () => void }
  | {
      action: "select-option";
      options: OptionItem[];
      selectOption: (opt: OptionItem) => void;
    };

export const YarnStory = forwardRef(
  (
    props: {
      locale: string;
      compilationResult?: YarnSpinner.CompilationResult;
      onVariableChanged: (name: string, value: YarnValue) => void;
    },
    ref: ForwardedRef<YarnStoryHandle>
  ) => {
    const storage = useContext(YarnStorageContext);

    const { locale, compilationResult, onVariableChanged } = props;

    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [currentAction, setCurrentAction] = useState<CurrentAction | null>(
      null
    );

    const yarnVM = useRef<YarnVM>();
    const lineProvider = useRef<BasicLineProvider>();

    const programHash = compilationResult?.programHash ?? 0;

    const [stringTableHash, setStringTableHash] = useState(0);

    const continueRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        start() {
          console.log("Start");

          setHistory([]);
          setCurrentAction(null);

          for (const prop of Object.getOwnPropertyNames(storage)) {
            delete storage[prop];
            onVariableChanged(prop, 0);
          }

          if (!yarnVM.current || !yarnVM.current.program) {
            // No VM, or no program set.
            return;
          }

          let startNode: string | undefined;
          if (yarnVM.current.program.nodes["Start"]) {
            startNode = "Start";
          } else {
            // No explicit 'Start' node exists. Search for a node that 1. isn't
            // a smart variable node and 2. isn't a node group endpoint.
            startNode = Object.values(yarnVM.current.program.nodes).find(
              (n) => {
                // Is the node title prefixed with a tag that indicates that it's internal?
                if (n.name.startsWith("$Yarn.Internal")) {
                  return false;
                }

                // Does the node have a header that indicates it's part of a node group?
                if (
                  n.headers.find((h) => h.key == "$Yarn.Internal.NodeGroup")
                ) {
                  return false;
                }

                // The node is able to run.
                return true;
              }
            )?.name;
          }

          if (!startNode) {
            // No start node found!
            console.warn(`Failed to find a start node!`);
            return;
          }

          yarnVM.current.setNode(startNode, true);
          yarnVM.current.loadInitialValues(yarnVM.current.program);
          yarnVM.current.start();
        },
      }),
      [onVariableChanged, storage]
    );

    // When the compilation's string table changes, update string table
    useEffect(() => {
      if (!lineProvider.current) {
        lineProvider.current = new BasicLineProvider(locale, {}, {});
      }

      lineProvider.current.stringTable = {};
      lineProvider.current.metadataTable = {};

      if (!compilationResult) {
        return;
      }

      const incomingStringTable = (compilationResult.stringTable ??
        {}) as unknown as Record<string, YarnSpinner.StringInfo>;

      for (const [id, info] of Object.entries(incomingStringTable)) {
        lineProvider.current.stringTable[id] = info.text;
        lineProvider.current.metadataTable[id] = {
          id,
          lineNumber: info.lineNumber.toString(),
          node: info.nodeName ?? "<unknown>",
          tags: info.tags,
        };
      }

      setStringTableHash(compilationResult.stringTableHash);
    }, [stringTableHash, locale, compilationResult]);

    // When we mount the component, create and prepare the VM and its callbacks
    useEffect(() => {
      // Create a proxy that invokes the onVariableChanged function whenever a
      // variable is modified
      const storageProxy = new Proxy(storage, {
        set: function (target, name, value) {
          target[name.toString()] = value;
          onVariableChanged(name.toString(), value);
          return true;
        },
      });

      console.log("Construct YarnVM");

      const vm = new YarnVM();
      vm.variableStorage = storageProxy;

      vm.saliencyStrategy = new BestLeastRecentlyViewedSalienceStrategy(
        storage,
        true
      );

      vm.lineCallback = async (l) => {
        if (!lineProvider.current) {
          throw new Error("Can't run content: no line provider");
        }

        const localisedLine = await lineProvider.current.getLocalizedLine(l);

        console.log(`Run line ${localisedLine.text}`);

        setHistory((h) => [
          ...h,
          {
            type: "line",
            line: l,
          },
        ]);

        await new Promise<void>((resolve) => {
          setCurrentAction({
            action: "continue-line",
            continue: () => {
              setCurrentAction(null);
              resolve();
            },
          });
        });
      };

      vm.commandCallback = (c) => {
        console.log(`Run command ${c}`);

        setHistory((h) => [
          ...h,
          {
            type: "command",
            command: c,
          },
        ]);

        return new Promise((resolve) => {
          setCurrentAction({
            action: "continue-command",
            continue: () => {
              setCurrentAction(null);
              resolve();
            },
          });
        });
      };

      vm.optionCallback = async (o) => {
        console.log(`Run options: ${o.map((o) => o.line.id).join(", ")}`);

        return await new Promise((resolve) => {
          setCurrentAction({
            action: "select-option",
            options: o,
            selectOption: (opt) => {
              setCurrentAction(null);

              setHistory((h) => [
                ...h,
                {
                  type: "selected-option",
                  option: opt,
                },
              ]);

              resolve(opt.optionID);
            },
          });
        });
      };

      vm.dialogueCompleteCallback = () => {
        setHistory((h) => [...h, { type: "complete" }]);

        return Promise.resolve();
      };

      yarnVM.current = vm;
    }, [onVariableChanged, storage]);

    // When the compilation's hash changes (indicating a change in the program's
    // instructions), clear history and state.
    useEffect(() => {
      setHistory([]);
      setCurrentAction(null);

      for (const prop of Object.getOwnPropertyNames(storage)) {
        delete storage[prop];
        onVariableChanged(prop, 0);
      }
    }, [programHash, onVariableChanged, storage]);

    // When the compilation changes, attempt to load the
    // program.
    useEffect(() => {
      // No VM, so we can't do anything..
      if (!yarnVM.current) {
        return;
      }

      yarnVM.current.program = undefined;

      // No valid program, so we can't run it.
      if (!compilationResult?.programData) {
        return;
      }

      // Load the program into the VM - it's ready to go!
      const program = Program.fromBinary(
        base64ToBytes(compilationResult.programData)
      );

      yarnVM.current.loadProgram(program);
    }, [compilationResult]);

    const errors = useMemo(
      () =>
        compilationResult?.diagnostics.filter(
          (d) => d.severity === YarnSpinner.DiagnosticSeverity.Error
        ) ?? [],
      [compilationResult]
    );

    // When the number of items in the history changes or the current action
    // changes, scroll to the bottom
    useEffect(() => {
      if (!continueRef.current) {
        return;
      }

      continueRef.current.scrollIntoView({
        block: "end",
      });
    }, [history.length, currentAction]);

    if (errors.length > 0) {
      return (
        <>
          <div id="log" className="list-group">
            {errors
              .sort((a, b) => a.range.start.line - b.range.start.line)
              .map((e, i) => (
                <div key={i} className="list-group-item list-group-item-danger">
                  Line {e.range.start.line + 1}: {e.message}
                </div>
              ))}
          </div>
        </>
      );
    }

    const isRunning = !(history.length == 0 && currentAction == null);

    return !isRunning ? (
      <div id="log-no-content" className="alert alert-primary">
        Click Run to play your conversation!
      </div>
    ) : (
      <>
        <div id="log" className="list-group">
          {history.map((item, i) => {
            // const string = stringTable.current?[item.li]
            if (item.type === "line") {
              return (
                <div className="list-group-item" key={i}>
                  <Line
                    line={item.line}
                    lineProvider={lineProvider.current}
                    stringTableHash={stringTableHash}
                  />
                </div>
              );
            } else if (item.type === "command") {
              return (
                <div
                  className="list-group-item list-group-item-primary"
                  key={i}
                >
                  Command: {item.command}
                </div>
              );
            } else if (item.type === "selected-option") {
              return (
                <div
                  className="list-group-item selected-option list-group-item-secondary"
                  key={i}
                >
                  Selected:{" "}
                  {
                    <Line
                      line={item.option.line}
                      lineProvider={lineProvider.current}
                      stringTableHash={stringTableHash}
                    />
                  }
                </div>
              );
            } else if (item.type === "complete") {
              // Show nothing
              return null;
            } else {
              return (
                <div className="list-group-item" key={i}>
                  Unknown: {JSON.stringify(item)}
                </div>
              );
            }
          })}

          {(currentAction &&
            (currentAction.action == "continue-line" ||
              currentAction.action === "continue-command") && (
              <div
                onClick={currentAction.continue}
                className="list-group-item list-group-item-action list-group-item-primary"
                ref={continueRef}
              >
                Continue...
              </div>
            )) ||
            (currentAction?.action == "select-option" && (
              <div className="list-group-item" ref={continueRef}>
                <div className="list-group">
                  {currentAction.options.map((o, i) => (
                    <a
                      className="list-group-item list-group-item-action"
                      key={i}
                      onClick={() => currentAction.selectOption(o)}
                    >
                      <b>→</b>{" "}
                      <Line
                        line={o.line}
                        lineProvider={lineProvider.current}
                        stringTableHash={stringTableHash}
                      />
                    </a>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </>
    );
  }
);

function Line(props: {
  line: Line;
  lineProvider: LineProvider | undefined;
  stringTableHash: number;
}) {
  console.log("Line Render: " + props.line.id);
  const [localisedLine, setLocalisedLine] = useState<LocalizedLine>();

  useEffect(() => {
    let ignore = false;

    props.lineProvider?.getLocalizedLine(props.line).then((localisedLine) => {
      if (ignore) {
        return;
      }

      console.log(
        "Line Render " + props.line.id + "resolved: " + localisedLine.text
      );
      setLocalisedLine(localisedLine);
    });

    return () => {
      ignore = true;
    };
  }, [props.line, props.lineProvider, props.stringTableHash]);

  return localisedLine?.text ?? "";
}
