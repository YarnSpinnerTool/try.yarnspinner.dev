import {
  BasicLineProvider,
  BestLeastRecentlyViewedSalienceStrategy,
  BestSaliencyStrategy,
  FirstSaliencyStrategy,
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
  useCallback,
} from "react";
import { YarnStorageContext } from "../YarnStorageContext";
import { YarnSpinner } from "backend";
import base64ToBytes from "../utility/base64ToBytes";
import { ListGroup, ListGroupItem } from "./ListGroup";
import { RandomSaliencyStrategy } from "../utility/RandomSaliencyStrategy";
import type { BackendStatus } from "../utility/loadBackend";
import { trackEvent } from "../utility/analytics";
import { StyledLine } from "./StyledLine";
import { checkWasmCache } from "../utility/checkWasmCache";

// The type of the ref that this component exposes. It has one method: start,
// which starts the dialogue.
export type YarnStoryHandle = {
  start: () => void;
  loadAndStart: (result: YarnSpinner.CompilationResult) => void;
};

// An item in the history log.
type HistoryItem =
  | { type: "line"; line: Line }
  | { type: "command"; command: string }
  | {
      type: "selected-option";
      option: OptionItem;
    }
  | {
      type: "error";
      message: string;
    }
  | { type: "complete" };

// The current action that the runner is waiting for before dialogue can
// continue.
type CurrentAction =
  | { action: "continue-line"; continue: () => void }
  | { action: "continue-command"; continue: () => void }
  | {
      action: "select-option";
      options: OptionItem[];
      selectOption: (opt: OptionItem) => void;
    };

// The Yarn Spinner dialogue runner.
export const Runner = forwardRef(
  (
    props: {
      /** The locale that the dialogue is running in. */
      locale: string;
      /** The compilation result to run, if present.*/
      compilationResult?: YarnSpinner.CompilationResult;

      /** Called when the runner modifies the value of a variable. */
      onVariableChanged: (name: string, value: YarnValue) => void;

      /** Backend loading status */
      backendStatus?: BackendStatus;

      /** Saliency strategy to use for options */
      saliencyStrategy?: string;
    },
    ref: ForwardedRef<YarnStoryHandle>,
  ) => {
    const storage = useContext(YarnStorageContext);

    const { locale, compilationResult, onVariableChanged, backendStatus, saliencyStrategy } = props;

    // Simple touch device detection
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [currentAction, setCurrentAction] = useState<CurrentAction | null>(
      null,
    );

    const yarnVM = useRef<YarnVM>();
    const lineProvider = useRef<BasicLineProvider>();

    const programHash = compilationResult?.programHash ?? 0;

    const [stringTableHash, setStringTableHash] = useState(0);

    const [isWasmCached, setIsWasmCached] = useState(false);

    const continueRef = useRef<HTMLDivElement>(null);

    // Check if WASM is cached on mount
    useEffect(() => {
      checkWasmCache().then(setIsWasmCached);
    }, []);

    // Update saliency strategy when it changes
    useEffect(() => {
      if (!yarnVM.current) {
        return;
      }

      const vm = yarnVM.current;
      const strategy = saliencyStrategy || 'random_best_least_recent';

      switch (strategy) {
        case "first":
          vm.saliencyStrategy = new FirstSaliencyStrategy();
          break;
        case "random":
          vm.saliencyStrategy = new RandomSaliencyStrategy();
          break;
        case "best":
          vm.saliencyStrategy = new BestSaliencyStrategy();
          break;
        case "best_least_recent":
          vm.saliencyStrategy = new BestLeastRecentlyViewedSalienceStrategy(
            storage,
            false,
          );
          break;
        case "random_best_least_recent":
        default:
          vm.saliencyStrategy = new BestLeastRecentlyViewedSalienceStrategy(
            storage,
            true,
          );
          break;
      }
    }, [saliencyStrategy, storage]);

    // Extract start logic into a callback so it can be used both by the ref and the internal button
    const handleStart = useCallback(() => {
      // Clear the history and get ready for a new run.
      setHistory([]);
      setCurrentAction(null);

      // Clear the variable storage
      for (const prop of Object.getOwnPropertyNames(storage)) {
        delete storage[prop];
        onVariableChanged(prop, 0);
      }

      if (!yarnVM.current || !yarnVM.current.program) {
        // No VM, or no program set. Nothing left to do.
        return;
      }

      // Figure out which node to start from. We'll start from the "Start"
      // node; if one doesn't exist, we'll start from the first user-defined
      // node in the script.
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
          },
        )?.name;
      }

      if (!startNode) {
        // No start node found!
        console.warn(`Failed to find a start node!`);
        return;
      }

      // Start the VM!
      yarnVM.current.setNode(startNode, true);
      yarnVM.current.loadInitialValues(yarnVM.current.program);
      yarnVM.current.start();
    }, [onVariableChanged, storage]);

    const loadAndStart = useCallback((result: YarnSpinner.CompilationResult) => {
      // Update string table
      if (!lineProvider.current) {
        lineProvider.current = new BasicLineProvider(locale, {}, {});
      }

      lineProvider.current.stringTable = {};
      lineProvider.current.metadataTable = {};

      const incomingStringTable = result.stringTable ?? {};

      for (const [id, info] of Object.entries(incomingStringTable)) {
        lineProvider.current.stringTable[id] = info.text;
        lineProvider.current.metadataTable[id] = {
          id,
          lineNumber: info.lineNumber.toString(),
          node: info.nodeName ?? "<unknown>",
          tags: info.tags,
        };
      }

      setStringTableHash(result.stringTableHash);

      // Load program into VM
      if (!yarnVM.current) {
        console.warn("Cannot load program: VM not initialized");
        return;
      }

      yarnVM.current.program = undefined;

      if (!result.programData) {
        console.warn("Cannot load program: no program data");
        return;
      }

      // Load the program into the VM
      const program = Program.fromBinary(base64ToBytes(result.programData));
      yarnVM.current.loadProgram(program);

      // Now start the program
      handleStart();
    }, [locale, handleStart]);

    useImperativeHandle(
      ref,
      () => ({
        start: handleStart,
        loadAndStart: loadAndStart,
      }),
      [handleStart, loadAndStart],
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

      const incomingStringTable = compilationResult.stringTable ?? {};

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

      const vm = new YarnVM();
      vm.variableStorage = storageProxy;

      // Set initial saliency strategy
      const initialStrategy = saliencyStrategy || 'random_best_least_recent';
      switch (initialStrategy) {
        case "first":
          vm.saliencyStrategy = new FirstSaliencyStrategy();
          break;
        case "random":
          vm.saliencyStrategy = new RandomSaliencyStrategy();
          break;
        case "best":
          vm.saliencyStrategy = new BestSaliencyStrategy();
          break;
        case "best_least_recent":
          vm.saliencyStrategy = new BestLeastRecentlyViewedSalienceStrategy(
            storage,
            false,
          );
          break;
        case "random_best_least_recent":
        default:
          vm.saliencyStrategy = new BestLeastRecentlyViewedSalienceStrategy(
            storage,
            true,
          );
          break;
      }

      // Store this newly created VM for future renders
      yarnVM.current = vm;

      // When we receive a line, add it to the history log, and set up the
      // current action so that we don't continue until the user's ready
      vm.lineCallback = async (l) => {
        if (!lineProvider.current) {
          throw new Error("Can't run content: no line provider");
        }

        setHistory((h) => [
          ...h,
          {
            type: "line",
            line: l,
          },
        ]);

        // Create (and await) a promise that only resolves when the user clicks
        // Continue
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

      // When we receive a command, check to see if it's one that the Runner can
      // handle itself. If it is, handle it and immediately continue; if it's not, log it to the history
      // log and wait for the user to continue.
      vm.commandCallback = (c) => {
        const commandParts = c.split(" ");
        if (commandParts[0] === "set_saliency") {
          // This is the set_saliency command; intercept it and use it
          if (commandParts.length >= 2) {
            const saliencyType = commandParts[1];
            switch (saliencyType) {
              case "first":
                vm.saliencyStrategy = new FirstSaliencyStrategy();
                break;
              case "random":
                vm.saliencyStrategy = new RandomSaliencyStrategy();
                break;
              case "best":
                vm.saliencyStrategy = new BestSaliencyStrategy();
                break;
              case "best_least_recent":
                vm.saliencyStrategy =
                  new BestLeastRecentlyViewedSalienceStrategy(
                    vm.variableStorage,
                    false,
                  );
                break;
              case "random_best_least_recent":
                vm.saliencyStrategy =
                  new BestLeastRecentlyViewedSalienceStrategy(
                    vm.variableStorage,
                    true,
                  );
                break;
              default:
                setHistory((h) => [
                  ...h,
                  {
                    type: "error",
                    message: `Unknown saliency strategy type ${saliencyType}. Valid values are: first, random, best, best_least_recent, random_best_least_recent`,
                  },
                ]);
            }
          } else {
            setHistory((h) => [
              ...h,
              {
                type: "error",
                message:
                  "set_saliency requires a parameter. Valid values are: first, random, best, best_least_recent, random_best_least_recent",
              },
            ]);
          }
          setCurrentAction(null);
          return Promise.resolve();
        } else {
          // Unknown command; log it as-is
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
        }
      };

      // When we get options, set our current action to be 'waiting for option
      // selection', and then wait for the user to select an option
      vm.optionCallback = async (o) => {
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

      // When the dialogue completes, add a 'complete' item to the history log
      vm.dialogueCompleteCallback = () => {
        setHistory((h) => [...h, { type: "complete" }]);

        return Promise.resolve();
      };
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
        base64ToBytes(compilationResult.programData),
      );

      yarnVM.current.loadProgram(program);
    }, [compilationResult]);

    const errors = useMemo(
      () =>
        compilationResult?.diagnostics.filter(
          (d) => d.severity === YarnSpinner.DiagnosticSeverity.Error,
        ) ?? [],
      [compilationResult],
    );

    // When the number of items in the history changes or the current action
    // changes, scroll to the bottom
    useEffect(() => {
      if (!continueRef.current) {
        return;
      }
      continueRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, [history.length, currentAction]);

    // Keyboard controls
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Handle continue with Enter or Space
        if (currentAction &&
            (currentAction.action === "continue-line" || currentAction.action === "continue-command") &&
            (e.code === 'Enter' || e.code === 'Space')) {
          e.preventDefault();
          currentAction.continue();
          return;
        }

        // Handle options
        if (currentAction && currentAction.action === "select-option") {
          // Enter/Space for single option
          if ((e.code === 'Enter' || e.code === 'Space') && currentAction.options.length === 1) {
            e.preventDefault();
            currentAction.selectOption(currentAction.options[0]);
            return;
          }

          // Number keys 1-9 for selecting options
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) {
            const optionIndex = num - 1;
            if (optionIndex < currentAction.options.length) {
              e.preventDefault();
              currentAction.selectOption(currentAction.options[optionIndex]);
              return;
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentAction]);

    // If there are any errors, show them
    if (errors.length > 0) {
      return (
        <div className="h-full overflow-y-auto bg-gradient-to-br from-[#F9F7F9] to-white dark:from-[#3A3340] dark:to-[#312A35]" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#E5E1E6 transparent'
        }}>
          <div className="max-w-2xl mx-auto px-8 py-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-800">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-sans font-semibold mb-2 text-[#2D1F30] dark:text-[#E0D8E2]">
                Compilation Errors
              </h3>
              <p className="text-sm font-sans text-[#7A6F7D] dark:text-[#B8A8BB]">
                Fix the errors below to run your script
              </p>
            </div>
            <div className="space-y-3">
              {errors
                .sort((a, b) => a.range.start.line - b.range.start.line)
                .map((e, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-4 py-3 border-l-4 bg-red-50 dark:bg-red-900/30 border-l-red-600 dark:border-l-red-400 border border-red-300 dark:border-red-800"
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-600 dark:bg-red-700 text-white">
                        Line {e.range.start.line + 1}
                      </span>
                      <span className="flex-1 text-sm font-sans text-red-900 dark:text-red-300">
                        {e.message}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      );
    }

    const isRunning = !(history.length == 0 && currentAction == null);

    const canPlay = backendStatus === 'ready' && errors.length === 0 && compilationResult?.programData;

    return !isRunning ? (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-[#F9F7F9] to-white dark:from-[#3A3340] dark:to-[#312A35]">
        <div className="text-center px-8">
          {backendStatus === 'loading' || !canPlay ? (
            <>
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{
                  background: 'linear-gradient(135deg, #4C8962 0%, #7aa479 100%)',
                  boxShadow: '0 8px 16px rgba(76, 137, 98, 0.2)'
                }}>
                  <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>
              <div className="text-sm font-sans mb-4 tracking-wide uppercase" style={{
                color: '#8B7F8E',
                letterSpacing: '0.1em'
              }}>
                {backendStatus === 'loading' ? 'Loading Runtime...' : 'Compiling...'}
              </div>
              <div className="text-base font-sans" style={{color: '#2D1F30'}}>
                {backendStatus === 'loading' ? 'Loading .NET WebAssembly runtime' : 'Compiling your script...'}
              </div>
              {backendStatus === 'loading' && !isWasmCached && (
                <div className="text-xs font-sans mt-2" style={{color: '#7A6F7D'}}>
                  First load may take a few seconds • Caching for faster future loads
                </div>
              )}
              {backendStatus === 'loading' && isWasmCached && (
                <div className="text-xs font-sans mt-2" style={{color: '#4C8962'}}>
                  Loading from cache...
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-6">
                <button
                  onClick={() => {
                    trackEvent('run-dialogue-player');
                    handleStart();
                  }}
                  className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110"
                  style={{
                    background: 'linear-gradient(135deg, #4C8962 0%, #7aa479 100%)',
                    boxShadow: '0 8px 16px rgba(76, 137, 98, 0.2)'
                  }}
                >
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <div className="text-sm font-sans mb-4 tracking-wide uppercase text-[#8B7F8E] dark:text-[#B8A8BB]" style={{
                letterSpacing: '0.1em'
              }}>
                Ready to play
              </div>
              <div className="text-base font-sans text-[#2D1F30] dark:text-[#E0D8E2]">
                Click the button to start
              </div>
            </>
          )}
        </div>
      </div>
    ) : (
      <div className="h-full flex flex-col md:flex-col bg-gradient-to-b from-[#F9F7F9] to-white dark:from-[#3A3340] dark:to-[#3A3340]">
        {/* History - scrollable only when needed */}
        <div
          className="overflow-y-auto px-4 md:px-8 md:flex-1 pt-8 pb-8"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#E5E1E6 transparent',
            height: window.innerWidth < 768 ? 'calc(100vh - 48px - 140px)' : 'auto',
            maxHeight: window.innerWidth < 768 ? 'calc(100vh - 48px - 140px)' : 'none',
            cursor: currentAction?.action === 'continue-line' ? 'pointer' : 'default'
          }}
          onClick={() => {
            if (currentAction?.action === 'continue-line') {
              currentAction.continue();
            }
          }}
        >
          <div className="max-w-3xl mx-auto flex flex-col justify-start" style={{
            minHeight: '100%'
          }}>
            {history.map((item, i) => {
              if (item.type === "line") {
                return (
                  <div
                    key={i}
                    className="mb-6 leading-relaxed opacity-0 animate-fade-in"
                    style={{
                      animation: 'fadeIn 0.4s ease-out forwards',
                      animationDelay: '0.1s'
                    }}
                  >
                    <span className="text-xl font-serif" style={{
                      lineHeight: '1.8'
                    }}>
                      <StyledLine
                        line={item.line}
                        lineProvider={lineProvider.current}
                        stringTableHash={stringTableHash}
                      />
                    </span>
                  </div>
                );
              } else if (item.type === "command") {
                return (
                  <div key={i} className="text-xs italic mb-4 font-sans text-[#8B7F8E] dark:text-[#B8A8BB] opacity-70">
                    {item.command}
                  </div>
                );
              } else if (item.type === "selected-option") {
                return (
                  <div key={i} className="italic mb-5 pl-4 border-l-2 text-[#4A7B8C] dark:text-[#7DAABE] border-[#4A7B8C] dark:border-[#7DAABE]">
                    <Line
                      line={item.option.line}
                      lineProvider={lineProvider.current}
                      stringTableHash={stringTableHash}
                    />
                  </div>
                );
              } else if (item.type === "error") {
                return (
                  <div key={i} className="text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-5 py-4 mb-5 shadow-sm">
                    {item.message}
                  </div>
                );
              } else if (item.type === "complete") {
                return (
                  <div key={i} className="text-lg italic text-center my-8 text-[#8B7F8E] dark:text-[#B8A8BB] opacity-70">
                    — End —
                  </div>
                );
              }
              return null;
            })}
            <div ref={continueRef} style={{
              height: window.innerWidth < 768 ? '100px' : '60px',
              flexShrink: 0
            }} />
          </div>
        </div>

        {/* Current Action - fixed at bottom with beautiful design */}
        <div
          className="fixed md:relative bottom-16 md:bottom-0 left-0 right-0 md:left-auto md:right-auto px-4 md:px-8 py-6 shrink-0 z-30 bg-white dark:bg-[#3A3340] border-t border-[#E5E1E6] dark:border-[#534952] shadow-[0_-2px_10px_rgba(0,0,0,0.02)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.2)]"
        >
          <div className="max-w-3xl mx-auto">
            {currentAction && currentAction.action === "continue-line" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={currentAction.continue}
                  className="text-sm font-sans font-medium transition-all hover:translate-x-1 text-[#4C8962] dark:text-[#7DBD91]"
                >
                  Continue →
                </button>
                {!isTouchDevice && (
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 text-xs font-mono rounded border bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">Enter</kbd>
                    <span className="text-xs text-[#9B8E9E] dark:text-[#B8A8BB]">or</span>
                    <kbd className="px-2 py-1 text-xs font-mono rounded border bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">Space</kbd>
                  </div>
                )}
              </div>
            )}

            {currentAction && currentAction.action === "continue-command" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={currentAction.continue}
                  className="text-sm font-sans font-medium transition-all hover:translate-x-1 text-[#4C8962] dark:text-[#7DBD91]"
                >
                  Continue →
                </button>
                {!isTouchDevice && (
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 text-xs font-mono rounded border bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">Enter</kbd>
                    <span className="text-xs text-[#9B8E9E] dark:text-[#B8A8BB]">or</span>
                    <kbd className="px-2 py-1 text-xs font-mono rounded border bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">Space</kbd>
                  </div>
                )}
              </div>
            )}

            {currentAction && currentAction.action === "select-option" && (
              <div className="flex flex-col gap-3">
                {currentAction.options.map((o, i) => (
                  <button
                    key={i}
                    onClick={() => currentAction.selectOption(o)}
                    className="group text-left px-4 md:px-6 py-3 md:py-4 text-base md:text-lg font-serif border border-[#D0CCD2] dark:border-[#6B5F6D] rounded-xl transition-all duration-200 bg-white dark:bg-[#3A3340] text-[#2D1F30] dark:text-[#E0D8E2] shadow-sm hover:shadow-md hover:border-[#4C8962] dark:hover:border-[#7DBD91] hover:-translate-y-0.5 hover:bg-[#4C8962]/5 dark:hover:bg-[#7DBD91]/10 flex items-start gap-3 focus:outline-none"
                    style={{
                      lineHeight: '1.6'
                    }}
                    onFocus={(e) => {
                      // Prevent focus styling unless it's from mouse
                      e.currentTarget.blur();
                    }}
                  >
                    {!isTouchDevice && (
                      <kbd className="px-2 py-1 text-xs font-mono rounded border shrink-0 mt-0.5 bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">{i + 1}</kbd>
                    )}
                    <span className="flex-1">
                      <Line
                        line={o.line}
                        lineProvider={lineProvider.current}
                        stringTableHash={stringTableHash}
                      />
                    </span>
                  </button>
                ))}
                {!isTouchDevice && currentAction.options.length === 1 && (
                  <div className="text-xs text-center mt-2 text-[#9B8E9E] dark:text-[#B8A8BB]">
                    Press <kbd className="px-2 py-0.5 mx-1 font-mono rounded border bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">Enter</kbd> or <kbd className="px-2 py-0.5 mx-1 font-mono rounded border bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">Space</kbd> to continue
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

function Line(props: {
  line: Line;
  lineProvider: LineProvider | undefined;
  stringTableHash: number;
}) {
  const [localisedLine, setLocalisedLine] = useState<LocalizedLine>();

  useEffect(() => {
    let ignore = false;

    props.lineProvider?.getLocalizedLine(props.line).then((localisedLine) => {
      if (ignore) {
        return;
      }

      setLocalisedLine(localisedLine);
    });

    return () => {
      ignore = true;
    };
  }, [props.line, props.lineProvider, props.stringTableHash]);

  return localisedLine?.text ?? "";
}
