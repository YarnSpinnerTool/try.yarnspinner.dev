import { YarnSpinner } from "backend";
import { forwardRef, Ref, useEffect, useLayoutEffect, useImperativeHandle, useRef } from "react";
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { completionKeymap } from '@codemirror/autocomplete';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { yarn, yarnLspExtensions } from "../language";
import { lightTheme, darkTheme } from "./CodeMirrorEditor/themes";
import { downloadFile } from "../utility/downloadFile";
import type { Diagnostic } from '@codemirror/lint';

function toCodeMirrorSeverity(severity: YarnSpinner.DiagnosticSeverity): "error" | "warning" | "info" {
  switch (severity) {
    case YarnSpinner.DiagnosticSeverity.Error:
      return "error";
    case YarnSpinner.DiagnosticSeverity.Warning:
      return "warning";
    case YarnSpinner.DiagnosticSeverity.Info:
      return "info";
    default:
      return "warning";
  }
}

export type CodeMirrorEditorHandle = {
  saveContents: () => void;
  getValue: () => string | undefined;
  setValue: (value: string) => void;
};

export default forwardRef(function CodeMirrorEditor(
  props: {
    onValueChanged: (value: string | undefined) => void;
    onRun?: () => void;
    initialValue: string;
    compilationResult?: YarnSpinner.CompilationResult;
    compilationVersion?: number;
    darkMode?: boolean;
  },
  ref: Ref<CodeMirrorEditorHandle>,
) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onValueChangedRef = useRef(props.onValueChanged);
  const onRunRef = useRef(props.onRun);
  const lastEmittedValueRef = useRef<string>(props.initialValue);
  const compilationResultRef = useRef(props.compilationResult);

  // Compartments for dark-mode-dependent extensions
  const themeCompartment = useRef(new Compartment());
  const yarnCompartment = useRef(new Compartment());

  // Keep refs up to date
  useEffect(() => {
    onValueChangedRef.current = props.onValueChanged;
  }, [props.onValueChanged]);

  useEffect(() => {
    onRunRef.current = props.onRun;
  }, [props.onRun]);

  useEffect(() => {
    compilationResultRef.current = props.compilationResult;
  }, [props.compilationResult]);

  useImperativeHandle(ref, () => ({
    saveContents() {
      if (!viewRef.current) {
        console.error("Tried to save editor contents, but editor is not available");
        return;
      }
      downloadFile(viewRef.current.state.doc.toString(), "YarnScript.yarn");
    },
    getValue() {
      if (!viewRef.current) {
        return undefined;
      }
      return viewRef.current.state.doc.toString();
    },
    setValue(value: string) {
      if (!viewRef.current) {
        console.error("Tried to set editor contents, but editor is not available");
        return;
      }
      const view = viewRef.current;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value
        }
      });
      lastEmittedValueRef.current = value;
    },
  }));

  // Helper function to compute diagnostics from compilation result
  const computeDiagnostics = (view: EditorView, result: YarnSpinner.CompilationResult | undefined): Diagnostic[] => {
    if (!result || !result.diagnostics) {
      return [];
    }

    return result.diagnostics
      .filter((d) => {
        const startLine = d.range.start.line + 1;
        const endLine = d.range.end.line + 1;
        const lineCount = view.state.doc.lines;
        return startLine >= 1 && startLine <= lineCount && endLine >= 1 && endLine <= lineCount;
      })
      .map((d) => {
        const startLine = d.range.start.line + 1;
        const endLine = d.range.end.line + 1;
        const from = view.state.doc.line(startLine).from + d.range.start.character;
        const to = view.state.doc.line(endLine).from + d.range.end.character;

        return {
          from,
          to,
          severity: toCodeMirrorSeverity(d.severity),
          message: d.message,
        };
      });
  };

  // Initialize editor
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const isMobile = window.innerWidth < 768;

    const startState = EditorState.create({
      doc: props.initialValue,
      extensions: [
        yarnCompartment.current.of(yarn(!!props.darkMode)),
        history(),
        ...(isMobile ? [] : [lineNumbers()]),
        EditorView.lineWrapping,
        highlightActiveLine(),
        ...(isMobile ? [] : [highlightActiveLineGutter()]),
        bracketMatching(),
        highlightSelectionMatches(),
        yarnLspExtensions(),
        ...(isMobile ? [] : [lintGutter()]),
        themeCompartment.current.of(props.darkMode ? darkTheme : lightTheme),
        keymap.of([
          // Cmd/Ctrl + Enter to run - must be before defaultKeymap
          {
            key: "Mod-Enter",
            run: () => {
              onRunRef.current?.();
              return true; // Prevent default behavior
            },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            if (newValue !== lastEmittedValueRef.current) {
              lastEmittedValueRef.current = newValue;
              onValueChangedRef.current(newValue);
            }
          }
        }),
        // Prevent CodeMirror from handling file drops - let the app handle them
        EditorView.domEventHandlers({
          drop(event) {
            // If this is a file drop, prevent CodeMirror from handling it
            // but let the event bubble up to the global handler
            if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
              return true; // Mark as handled to prevent CodeMirror from inserting text
            }
            return false;
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [props.initialValue]);

  // Update theme when dark mode changes — reconfigure compartments to preserve undo history
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: [
        themeCompartment.current.reconfigure(props.darkMode ? darkTheme : lightTheme),
        yarnCompartment.current.reconfigure(yarn(!!props.darkMode)),
      ],
    });
  }, [props.darkMode]);

  // Update diagnostics when compilation result changes
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const diagnostics = computeDiagnostics(view, props.compilationResult);
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [props.compilationResult, props.compilationVersion]);

  return (
    <div
      ref={editorContainerRef}
      className={`h-full w-full ${props.darkMode ? 'bg-[#4C434F]' : 'bg-white'}`}
      style={{ fontFamily: "Necto Mono", fontSize: "17px" }}
    />
  );
});
