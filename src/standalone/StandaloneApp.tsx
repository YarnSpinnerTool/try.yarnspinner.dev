import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Runner, type YarnStoryHandle } from "../components/Runner";
import { YarnStorageContext } from "../YarnStorageContext";
import type { VariableStorage, YarnValue } from "@yarnspinnertool/core";
import type { YarnSpinner } from "./backend-shim";

/**
 * Shape of the data injected into window.yarnData by the download flow.
 * - data: base64-encoded program bytecode
 * - stringTable: Record<id, text>
 * - metadataTable: Record<id, { id, node, lineNumber (string), tags }>
 */
interface ExportedYarnData {
  data: string;
  stringTable: Record<string, string>;
  metadataTable: Record<
    string,
    { id: string; node: string; lineNumber: string; tags: string[] }
  >;
}

declare global {
  interface Window {
    yarnData?: ExportedYarnData;
  }
}

export function StandaloneApp() {
  const runnerRef = useRef<YarnStoryHandle>(null);
  const [storage] = useState<VariableStorage>(() => ({}));
  const [dialogueComplete, setDialogueComplete] = useState(false);
  const startedRef = useRef(false);

  // Read injected yarn data
  const yarnData = window.yarnData;

  // Reconstruct a CompilationResult from the exported data.
  // Stable reference — only recomputed if yarnData changes (it won't).
  const compilationResult = useMemo(() => {
    if (!yarnData) return undefined;

    const fullStringTable: Record<string, YarnSpinner.StringInfo> = {};
    for (const [id, text] of Object.entries(yarnData.stringTable)) {
      const meta = yarnData.metadataTable[id];
      fullStringTable[id] = {
        text,
        lineNumber: meta ? parseInt(meta.lineNumber, 10) : 0,
        nodeName: meta?.node || undefined,
        tags: meta?.tags ?? [],
        isImplicitTag: false,
      };
    }

    return {
      info: "",
      nodes: {},
      variableDeclarations: {},
      typeDeclarations: {},
      stringTable: fullStringTable,
      programData: yarnData.data,
      programHash: 1,
      stringTableHash: Date.now(),
      diagnostics: [],
    } satisfies YarnSpinner.CompilationResult;
  }, [yarnData]);

  // Auto-start dialogue once Runner has processed the compilationResult prop.
  // Runner's internal effects load the program and populate the string table
  // from the prop; we just need to call start() after those effects have run.
  useEffect(() => {
    if (compilationResult && runnerRef.current && !startedRef.current) {
      startedRef.current = true;
      // Allow Runner's mount + compilationResult effects to complete first
      const timer = setTimeout(() => {
        runnerRef.current?.start();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [compilationResult]);

  const handleDialogueComplete = useCallback(() => {
    setDialogueComplete(true);
  }, []);

  const handleDialogueStart = useCallback(() => {
    setDialogueComplete(false);
  }, []);

  const handleRestart = useCallback(() => {
    if (compilationResult && runnerRef.current) {
      setDialogueComplete(false);
      runnerRef.current.loadAndStart(
        compilationResult as unknown as YarnSpinner.CompilationResult,
      );
    }
  }, [compilationResult]);

  const handleVariableChanged = useCallback(
    (name: string, value: YarnValue) => {
      storage[name] = value;
    },
    [storage],
  );

  if (!yarnData) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)] text-[var(--foreground)] font-sans">
        <div className="text-center p-8">
          <h1 className="text-xl font-bold mb-2">No yarn data found</h1>
          <p className="text-[var(--muted-foreground)]">
            This file was not exported correctly. Please re-export from the Yarn
            Spinner editor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <YarnStorageContext.Provider value={storage}>
      <div className="flex flex-col h-full bg-[var(--background)] text-[var(--foreground)] font-sans">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
          <a href="https://yarnspinner.dev" target="_blank" rel="noopener noreferrer" className="text-sm font-bold tracking-wide text-[var(--primary)] hover:underline">
            Powered by Yarn Spinner
          </a>
          <div className="flex items-center gap-2">
            {dialogueComplete && (
              <button
                onClick={handleRestart}
                className="px-3 py-1 text-sm rounded bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                Play Again
              </button>
            )}
            {!dialogueComplete && (
              <button
                onClick={handleRestart}
                className="px-3 py-1 text-sm rounded border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
              >
                Restart
              </button>
            )}
          </div>
        </div>

        {/* Runner fills remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Runner
            ref={runnerRef}
            locale="en"
            compilationResult={
              compilationResult as unknown as YarnSpinner.CompilationResult
            }
            backendStatus="ready"
            diceEffectsMode="none"
            textSpeed={30}
            showWaitProgress={true}
            onVariableChanged={handleVariableChanged}
            onDialogueComplete={handleDialogueComplete}
            onDialogueStart={handleDialogueStart}
          />
        </div>
      </div>
    </YarnStorageContext.Provider>
  );
}
