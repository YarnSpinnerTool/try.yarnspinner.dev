import { YarnSpinner } from "backend";
import { forwardRef, Ref, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { completionKeymap, autocompletion } from '@codemirror/autocomplete';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { yarn } from "../language";
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
    initialValue: string;
    compilationResult?: YarnSpinner.CompilationResult;
    darkMode?: boolean;
  },
  ref: Ref<CodeMirrorEditorHandle>,
) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onValueChangedRef = useRef(props.onValueChanged);
  const lastEmittedValueRef = useRef<string>(props.initialValue);

  // Keep onValueChanged callback up to date
  useEffect(() => {
    onValueChangedRef.current = props.onValueChanged;
  }, [props.onValueChanged]);

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

  // Initialize editor
  useEffect(() => {
    if (!editorContainerRef.current) return;

    // Detect mobile for hiding line numbers
    const isMobile = window.innerWidth < 768;

    const startState = EditorState.create({
      doc: props.initialValue,
      extensions: [
        // Language support
        yarn(!!props.darkMode), // Use dark mode from props

        // Basic editing
        history(),
        ...(isMobile ? [] : [lineNumbers()]), // Hide line numbers on mobile
        EditorView.lineWrapping,
        highlightActiveLine(),
        ...(isMobile ? [] : [highlightActiveLineGutter()]), // Hide gutter highlight on mobile too
        bracketMatching(),
        highlightSelectionMatches(),

        // Autocomplete
        autocompletion(),

        // Linting
        ...(isMobile ? [] : [lintGutter()]), // Hide lint gutter on mobile too

        // Theme
        props.darkMode ? darkTheme : lightTheme,

        // Keymaps
        keymap.of([
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
        ]),

        // Update callback
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            if (newValue !== lastEmittedValueRef.current) {
              lastEmittedValueRef.current = newValue;
              onValueChangedRef.current(newValue);
            }
          }
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

  // Update diagnostics when compilation result changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !props.compilationResult) return;

    const diagnostics: Diagnostic[] = props.compilationResult.diagnostics
      .filter((d) => {
        // Filter out diagnostics with invalid line numbers
        const startLine = d.range.start.line + 1;
        const endLine = d.range.end.line + 1;
        const lineCount = view.state.doc.lines;
        return startLine >= 1 && startLine <= lineCount && endLine >= 1 && endLine <= lineCount;
      })
      .map((d) => {
        const from = view.state.doc.line(d.range.start.line + 1).from + d.range.start.character;
        const to = view.state.doc.line(d.range.end.line + 1).from + d.range.end.character;

        return {
          from,
          to,
          severity: toCodeMirrorSeverity(d.severity),
          message: d.message,
        };
      });

    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [props.compilationResult]);

  // Update theme when dark mode changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Create a new state with updated theme
    const isMobile = window.innerWidth < 768;

    const newState = EditorState.create({
      doc: view.state.doc,
      extensions: [
        // Language support with updated dark mode
        yarn(!!props.darkMode),

        // Basic editing
        history(),
        ...(isMobile ? [] : [lineNumbers()]),
        EditorView.lineWrapping,
        highlightActiveLine(),
        ...(isMobile ? [] : [highlightActiveLineGutter()]),
        bracketMatching(),
        highlightSelectionMatches(),

        // Autocomplete
        autocompletion(),

        // Linting
        ...(isMobile ? [] : [lintGutter()]),

        // Theme
        props.darkMode ? darkTheme : lightTheme,

        // Keymaps
        keymap.of([
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
        ]),

        // Update callback
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            if (newValue !== lastEmittedValueRef.current) {
              lastEmittedValueRef.current = newValue;
              onValueChangedRef.current(newValue);
            }
          }
        }),
      ],
    });

    view.setState(newState);
  }, [props.darkMode]);

  return (
    <div
      ref={editorContainerRef}
      className={`h-full w-full ${props.darkMode ? 'bg-[#4C434F]' : 'bg-white'}`}
      style={{ fontFamily: "Necto Mono", fontSize: "17px" }}
    />
  );
});
