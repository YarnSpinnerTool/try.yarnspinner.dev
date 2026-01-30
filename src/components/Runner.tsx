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
import { DiceOverlay, type DiceOverlayHandle } from "./DiceOverlay";
import { YarnStorageContext } from "../YarnStorageContext";
import { YarnSpinner } from "backend";
import base64ToBytes from "../utility/base64ToBytes";
import { ListGroup, ListGroupItem } from "./ListGroup";
import { RandomSaliencyStrategy } from "../utility/RandomSaliencyStrategy";
import type { BackendStatus, LoadProgress } from "../utility/loadBackend";
import { onProgressChange, onBackendStatusChange, getBackendError, retryBackendLoad } from "../utility/loadBackend";
import { trackEvent } from "../utility/analytics";
import { StyledLine } from "./StyledLine";

// The type of the ref that this component exposes.
export type YarnStoryHandle = {
  start: () => void;
  stop: () => void;
  loadAndStart: (result: YarnSpinner.CompilationResult) => void;
  isRunning: () => boolean;
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
    }
  | { action: "waiting"; durationMs: number };

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

      /** How to display unavailable options: 'hidden' or 'strikethrough' */
      unavailableOptionsMode?: 'hidden' | 'strikethrough';

      /** Whether to show an animated progress bar during <<wait>> commands */
      showWaitProgress?: boolean;

      /** Whether to show 3D dice effects when dice() is called */
      showDiceEffects?: boolean;

      /** Called when the dialogue completes */
      onDialogueComplete?: () => void;

      /** Whether the viewport is mobile-sized */
      isMobile?: boolean;
    },
    ref: ForwardedRef<YarnStoryHandle>,
  ) => {
    const storage = useContext(YarnStorageContext);

    const { locale, compilationResult, onVariableChanged, backendStatus, saliencyStrategy, unavailableOptionsMode = 'hidden', showWaitProgress = true, showDiceEffects = true, onDialogueComplete, isMobile = false } = props;

    // Simple touch device detection
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Refs to keep callback values current for VM closures
    const showWaitProgressRef = useRef(showWaitProgress);
    useEffect(() => { showWaitProgressRef.current = showWaitProgress; }, [showWaitProgress]);

    const onDialogueCompleteRef = useRef(onDialogueComplete);
    useEffect(() => { onDialogueCompleteRef.current = onDialogueComplete; }, [onDialogueComplete]);

    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [currentAction, setCurrentAction] = useState<CurrentAction | null>(
      null,
    );
    const [vmActive, setVmActive] = useState(false);

    const yarnVM = useRef<YarnVM>();
    const lineProvider = useRef<BasicLineProvider>();

    const programHash = compilationResult?.programHash ?? 0;

    const [stringTableHash, setStringTableHash] = useState(0);

    const [progress, setProgress] = useState<LoadProgress>({ downloadedBytes: 0, totalBytes: 0, filesLoaded: 0, totalFiles: 0 });
    const [backendError, setBackendError] = useState<Error | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const continueRef = useRef<HTMLDivElement>(null);
    const runnerRef = useRef<HTMLDivElement>(null);
    const diceOverlayRef = useRef<DiceOverlayHandle>(null);
    const [optionsInteractive, setOptionsInteractive] = useState(false);

    // Track whether the VM is actively running dialogue (after start()).
    // Dice calls during loadInitialValues (before start) should use the
    // built-in RNG silently — no 3D effect while the Play screen is showing.
    const vmStartedRef = useRef(false);

    // Disable 3D dice on phones — dice-box has rendering issues on mobile
    // browsers (canvas sizing, face detection failures on iOS Safari).
    // Keep it enabled on tablets (iPads) which have enough screen real estate.
    const isPhone = isTouchDevice && window.innerWidth < 768;
    const effectiveDiceEffects = showDiceEffects && !isPhone;

    // Use a ref so the dice wrapper closure always reads the latest value
    const showDiceEffectsRef = useRef(effectiveDiceEffects);
    useEffect(() => { showDiceEffectsRef.current = effectiveDiceEffects; }, [effectiveDiceEffects]);

    // Track loading progress
    useEffect(() => {
      return onProgressChange(setProgress);
    }, []);

    // Track backend errors
    useEffect(() => {
      return onBackendStatusChange((status, error) => {
        if (status === 'error' && error) {
          setBackendError(error);
        } else if (status === 'ready') {
          setBackendError(null);
        }
      });
    }, []);

    const handleRetry = useCallback(async () => {
      setIsRetrying(true);
      setBackendError(null);
      try {
        await retryBackendLoad();
      } catch (err) {
        // Error will be handled by the status change listener
      } finally {
        setIsRetrying(false);
      }
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
      setVmActive(true);
      yarnVM.current.setNode(startNode, true);
      yarnVM.current.loadInitialValues(yarnVM.current.program);
      vmStartedRef.current = true;
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

    const handleStop = useCallback(() => {
      setHistory([]);
      setCurrentAction(null);
      setVmActive(false);
      vmStartedRef.current = false;
      diceOverlayRef.current?.clear();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        start: handleStart,
        stop: handleStop,
        loadAndStart: loadAndStart,
        isRunning: () => vmActive || history.length > 0 || currentAction !== null,
      }),
      [handleStart, handleStop, loadAndStart, history.length, currentAction],
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

      // Monkey-patch runInstruction to intercept dice() calls. Since start()
      // is async and awaits each runInstruction(), we can make dice() truly
      // async: fire the 3D roll, await the physics result, and push it onto
      // the VM stack before the next instruction (e.g. storeVariable) runs.
      // This means the physics value IS the game value — no patching needed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vmAny = vm as any;
      const originalRunInstruction = vmAny.runInstruction.bind(vm);
      vmAny.runInstruction = async function (i: any) {
        if (
          i.instructionType?.oneofKind === 'callFunc' &&
          showDiceEffectsRef.current &&
          vmStartedRef.current &&
          diceOverlayRef.current
        ) {
          const funcName = i.instructionType.callFunc?.functionName;

          if (funcName === 'dice' || funcName === 'multidice') {
            // Replicate the VM's callFunc parameter handling
            const parameterCount = this.stack.pop();
            if (typeof parameterCount !== 'number') {
              this.logError?.('top of stack is not a number!');
              return;
            }
            const parameters: YarnValue[] = [];
            for (let j = 0; j < parameterCount; j++) {
              const top = this.stack.pop();
              if (top === undefined) {
                this.logError?.('Internal error: stack was empty when popping parameter');
                return;
              }
              parameters.unshift(top);
            }

            if (funcName === 'multidice') {
              // multidice(qty, sides) — roll multiple physical dice simultaneously
              const qty = typeof parameters[0] === 'number' ? parameters[0] : Number(parameters[0]);
              const sides = typeof parameters[1] === 'number' ? parameters[1] : Number(parameters[1]);

              if (qty >= 1 && sides >= 1) {
                const notation = `${qty}d${sides}`;
                const physicsResult = await diceOverlayRef.current!.rollNotationAndWait(notation);

                if (physicsResult !== null) {
                  trackEvent('dice-roll', { type: 'multidice', qty, sides, result: physicsResult, physics: 1 });
                  this.stack.push(physicsResult);
                } else {
                  // Fallback: compute sum via built-in RNG
                  let sum = 0;
                  for (let k = 0; k < qty; k++) {
                    sum += Math.floor(Math.random() * sides) + 1;
                  }
                  trackEvent('dice-roll', { type: 'multidice', qty, sides, result: sum, physics: 0 });
                  this.stack.push(sum);
                }
              } else {
                this.logError?.('multidice requires positive qty and sides');
              }
            } else {
              // dice(sides) — single die
              const sides = typeof parameters[0] === 'number'
                ? parameters[0]
                : Number(parameters[0]);

              const physicsResult = await diceOverlayRef.current!.rollAndWait(sides);

              if (physicsResult !== null) {
                trackEvent('dice-roll', { type: 'dice', qty: 1, sides, result: physicsResult, physics: 1 });
                this.stack.push(physicsResult);
              } else {
                // Fallback (unsupported die type or init failure) — use built-in
                const result = this.runFunc('dice', parameters);
                if (result !== undefined) {
                  trackEvent('dice-roll', { type: 'dice', qty: 1, sides, result: result as number, physics: 0 });
                  this.stack.push(result);
                } else {
                  this.logError?.('dice did not return a valid result');
                }
              }
            }
            return;
          }
        }

        // All other instructions: delegate to the original
        await originalRunInstruction(i);
      };

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
              trackEvent('dialogue-continue');
              setCurrentAction(null);
              resolve();
            },
          });
        });
      };

      // When we receive a command, check to see if it's one that the Runner can
      // handle itself. If it is, handle it and immediately continue; if it's not, log it to the history
      // log and wait for the user to continue.
      vm.commandCallback = async (c) => {
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
        } else if (commandParts[0] === "wait") {
          // Handle wait command — pause then auto-continue
          const seconds = commandParts.length >= 2 ? parseFloat(commandParts[1]) : 1;
          const ms = isNaN(seconds) ? 1000 : seconds * 1000;
          if (showWaitProgressRef.current) {
            return new Promise<void>((resolve) => {
              setCurrentAction({ action: "waiting", durationMs: ms });
              setTimeout(() => {
                setCurrentAction(null);
                resolve();
              }, ms);
            });
          }
          return new Promise((resolve) => {
            setTimeout(resolve, ms);
          });
        } else if (commandParts[0] === "screen_shake") {
          // Handle screen_shake command — shake the runner panel
          const intensity = commandParts.length >= 2 ? parseFloat(commandParts[1]) : 5;
          const px = isNaN(intensity) ? 5 : Math.max(1, Math.min(intensity, 30));
          const el = runnerRef.current;
          if (el) {
            el.style.setProperty('--shake-px', `${px}px`);
            el.classList.add('yarn-shake');
            const onEnd = () => {
              el.classList.remove('yarn-shake');
              el.removeEventListener('animationend', onEnd);
            };
            el.addEventListener('animationend', onEnd);
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
              trackEvent('dialogue-option-selected', { optionCount: o.length });
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
      vm.dialogueCompleteCallback = async () => {
        trackEvent('dialogue-complete');
        setHistory((h) => [...h, { type: "complete" }]);
        onDialogueCompleteRef.current?.();
      };
    }, [onVariableChanged, storage]);

    // When the compilation's hash changes (indicating a change in the program's
    // instructions), clear history and state.
    useEffect(() => {
      setHistory([]);
      setCurrentAction(null);
      setVmActive(false);
      vmStartedRef.current = false;

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
          const availableOptions = currentAction.options.filter(o => o.isAvailable);

          // Enter/Space for single option
          if ((e.code === 'Enter' || e.code === 'Space') && availableOptions.length === 1) {
            e.preventDefault();
            currentAction.selectOption(availableOptions[0]);
            return;
          }

          // Number keys 1-9 for selecting options
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) {
            const optionIndex = num - 1;
            if (optionIndex < availableOptions.length) {
              e.preventDefault();
              currentAction.selectOption(availableOptions[optionIndex]);
              return;
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentAction]);

    // Suppress ghost hover: when options appear, disable pointer events
    // until the user actually moves the mouse
    useEffect(() => {
      if (currentAction?.action === 'select-option') {
        setOptionsInteractive(false);
        const onMove = () => {
          setOptionsInteractive(true);
          window.removeEventListener('mousemove', onMove);
        };
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
      }
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
                .map((e, i) => {
                  const isInternalError = e.message.startsWith('Internal compiler error:');
                  const fullErrorText = isInternalError && e.context
                    ? `${e.message}${e.context}`
                    : e.message;

                  return (
                    <div
                      key={i}
                      className="rounded-lg px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-600 dark:bg-red-700 text-white">
                          Line {e.range.start.line + 1}
                        </span>
                        <span className="flex-1 text-sm font-sans text-red-900 dark:text-red-300">
                          {e.message}
                        </span>
                        {isInternalError && (
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(fullErrorText);
                              } catch {
                                // Fallback for older browsers
                                const textarea = document.createElement('textarea');
                                textarea.value = fullErrorText;
                                document.body.appendChild(textarea);
                                textarea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textarea);
                              }
                            }}
                            className="shrink-0 p-1.5 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            title="Copy full error details"
                          >
                            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      );
    }

    const isRunning = vmActive || history.length > 0 || currentAction != null;

    const canPlay = backendStatus === 'ready' && errors.length === 0 && compilationResult?.programData;

    return (
      <div className="h-full flex flex-col relative">
        <DiceOverlay ref={diceOverlayRef} enabled={effectiveDiceEffects} />
        {!isRunning ? (
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#F9F7F9] to-white dark:from-[#3A3340] dark:to-[#312A35]">
        <div className="text-center px-8">
          {backendStatus === 'error' || backendError ? (
            <>
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                  boxShadow: '0 8px 16px rgba(220, 38, 38, 0.2)'
                }}>
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-sans mb-4 tracking-wide uppercase" style={{
                color: '#dc2626',
                letterSpacing: '0.1em'
              }}>
                Failed to Load
              </div>
              <div className="text-base font-sans text-[#2D1F30] dark:text-[#E0D8E2] mb-2">
                Something went wrong loading Yarn Spinner
              </div>
              <div className="text-sm font-sans text-[#7A6F7D] dark:text-[#B8A8BB] mb-6 max-w-xs mx-auto">
                {backendError?.message || 'An unexpected error occurred'}
              </div>
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-6 py-3 rounded-lg font-sans font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #4C8962 0%, #7aa479 100%)',
                  boxShadow: '0 4px 12px rgba(76, 137, 98, 0.3)'
                }}
              >
                {isRetrying ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Retrying...
                  </span>
                ) : (
                  'Try Again'
                )}
              </button>
              <div className="text-xs font-sans mt-4 text-[#9B8E9E] dark:text-[#B8A8BB]">
                If this keeps happening, try refreshing the page
              </div>
            </>
          ) : backendStatus === 'loading' || isRetrying || !canPlay ? (
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
                {(backendStatus === 'loading' || isRetrying) ? 'Preparing...' : 'Compiling...'}
              </div>
              <div className="text-base font-sans text-[#2D1F30] dark:text-[#E0D8E2]">
                {(backendStatus === 'loading' || isRetrying) ? 'Loading Yarn Spinner' : 'Compiling your script...'}
              </div>
              {(backendStatus === 'loading' || isRetrying) && progress.totalBytes > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-mono text-[#4C8962] dark:text-[#7DBD91]">
                    {(progress.downloadedBytes / 1024 / 1024).toFixed(1)} MB / {(progress.totalBytes / 1024 / 1024).toFixed(1)} MB
                  </div>
                  <div className="w-48 mx-auto h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4C8962] dark:bg-[#7DBD91] transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${Math.min(100, (progress.downloadedBytes / progress.totalBytes) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs font-sans text-[#7A6F7D] dark:text-[#B8A8BB]">
                    {progress.filesLoaded} of {progress.totalFiles} files
                  </div>
                </div>
              )}
              {(backendStatus === 'loading' || isRetrying) && progress.totalBytes === 0 && (
                <div className="text-xs font-sans mt-2" style={{color: '#7A6F7D'}}>
                  First load may take a few seconds
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
      <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-[#F9F7F9] to-white dark:from-[#3A3340] dark:to-[#3A3340]"
        style={{
          cursor: currentAction?.action === 'continue-line' ? 'pointer' : 'default'
        }}
        onClick={() => {
          if (currentAction?.action === 'continue-line') {
            currentAction.continue();
          }
        }}
      >
        {/* Scrollable history area */}
        <div ref={runnerRef} className="flex-1 min-h-0 overflow-y-auto"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#E5E1E6 transparent',
          }}
        >
          <div className="max-w-3xl mx-auto px-4 md:px-8 pt-8 pb-16">
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
                  <div key={i} className="mb-5 pl-4 border-l-2 border-[#4A7B8C] dark:border-[#7DAABE] font-serif text-xl" style={{ lineHeight: '1.8' }}>
                    <StyledLine
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
            <div ref={continueRef} />
          </div>
        </div>

        {/* Pinned action bar at bottom */}
        {currentAction && (
        <div className="shrink-0 border-t border-[#E5E1E6] dark:border-[#534952] bg-white dark:bg-[#3A3340]">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-4">
            {currentAction.action === "continue-line" && (
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

            {currentAction.action === "continue-command" && (
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

            {currentAction.action === "waiting" && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-[#E5E1E6] dark:bg-[#534952] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#4C8962] dark:bg-[#7DBD91]"
                    style={{
                      transformOrigin: 'left',
                      animation: `waitProgress ${currentAction.durationMs}ms linear forwards`,
                    }}
                  />
                </div>
                <span className="text-xs text-[#9B8E9E] dark:text-[#B8A8BB] font-mono shrink-0">
                  wait
                </span>
              </div>
            )}

            {currentAction.action === "select-option" && (() => {
              const optionsToShow = unavailableOptionsMode === 'hidden'
                ? currentAction.options.filter(o => o.isAvailable)
                : currentAction.options;
              const availableOptions = currentAction.options.filter(o => o.isAvailable);
              let availableIndex = 0;

              return (
                <div className={`flex flex-col gap-3 pt-1 max-h-[50vh] overflow-y-auto ${optionsInteractive ? '' : 'pointer-events-none'}`}>
                  {optionsToShow.map((o, i) => {
                    const isAvailable = o.isAvailable;
                    const keyboardIndex = isAvailable ? availableIndex++ : -1;

                    return (
                      <button
                        key={i}
                        onClick={isAvailable ? () => currentAction.selectOption(o) : undefined}
                        disabled={!isAvailable}
                        className={`group text-left px-4 md:px-6 py-3 md:py-4 text-base md:text-lg font-serif border rounded-xl transition-all duration-200 flex items-start gap-3 focus:outline-none ${
                          isAvailable
                            ? 'border-[#D0CCD2] dark:border-[#6B5F6D] bg-white dark:bg-[#242124] text-[#2D1F30] dark:text-[#E0D8E2] shadow-sm hover:shadow-md hover:border-[#4C8962] dark:hover:border-[#7DBD91] hover:-translate-y-0.5 hover:bg-[#4C8962]/5 dark:hover:bg-[#7DBD91]/10 cursor-pointer'
                            : 'border-[#E5E1E6] dark:border-[#4D4650] bg-[#F5F3F5] dark:bg-[#1D1B1E] text-[#9B8E9E] dark:text-[#6B5F6D] cursor-not-allowed'
                        }`}
                        style={{
                          lineHeight: '1.6'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.blur();
                        }}
                      >
                        {!isTouchDevice && isAvailable && (
                          <kbd className="px-2 py-1 text-xs font-mono rounded border shrink-0 mt-0.5 bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">{keyboardIndex + 1}</kbd>
                        )}
                        <span className={`flex-1 ${!isAvailable ? 'line-through cursor-not-allowed' : ''}`}>
                          <Line
                            line={o.line}
                            lineProvider={lineProvider.current}
                            stringTableHash={stringTableHash}
                          />
                        </span>
                      </button>
                    );
                  })}
                  {!isTouchDevice && availableOptions.length === 1 && (
                    <div className="text-xs text-center mt-2 text-[#9B8E9E] dark:text-[#B8A8BB]">
                      Press <kbd className="px-2 py-0.5 mx-1 font-mono rounded border bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">Enter</kbd> or <kbd className="px-2 py-0.5 mx-1 font-mono rounded border bg-[#F9F7F9] dark:bg-[#534952] border-[#D0CCD2] dark:border-[#6B5F6D] text-[#5A4F5D] dark:text-[#B8A8BB] shadow-[0_1px_0_rgba(0,0,0,0.1)]">Space</kbd> to continue
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        )}
      </div>
      )}
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
    }).catch(() => {
      if (!ignore) {
        const raw = (props.lineProvider as any)?.stringTable?.[props.line.id];
        if (raw) {
          setLocalisedLine({ text: raw, attributes: [], id: props.line.id, metadata: [] });
        }
      }
    });

    return () => {
      ignore = true;
    };
  }, [props.line, props.lineProvider, props.stringTableHash]);

  return localisedLine?.text ?? "";
}
