import { YarnSpinner } from "backend";
import "../monaco-worker";

// import * as monaco from 'monaco-editor'; <- PROBLEM: Causes import errors with vite, probably related to
// https://github.com/sveltejs/kit/discussions/3539#discussioncomment-2048425

// import type { editor } from "monaco-editor/esm/vs/editor/editor.api"; // you can still use type imports as far as I know
import * as monaco from "monaco-editor";
import { forwardRef, Ref, useEffect, useImperativeHandle, useRef } from "react";
import { downloadFile } from "../utility/downloadFile";
import isEmbed from "../utility/useEmbed";

function toMarkerSeverity(
  severity: YarnSpinner.DiagnosticSeverity,
): monaco.MarkerSeverity {
  switch (severity) {
    case YarnSpinner.DiagnosticSeverity.Error:
      return monaco.MarkerSeverity.Error;
    case YarnSpinner.DiagnosticSeverity.Warning:
      return monaco.MarkerSeverity.Warning;
    case YarnSpinner.DiagnosticSeverity.Info:
      return monaco.MarkerSeverity.Info;
    default:
      return monaco.MarkerSeverity.Warning;
  }
}

export type MonacoEditorHandle = {
  saveContents: () => void;
};

export default forwardRef(function MonacoEditor(
  props: {
    onValueChanged: (value: string | undefined) => void;
    initialValue: string;
    compilationResult?: YarnSpinner.CompilationResult;
  },
  ref: Ref<MonacoEditorHandle>,
) {
  const editorContainerRef = useRef(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();

  useImperativeHandle(ref, () => ({
    saveContents() {
      if (!editorRef.current) {
        console.error(
          "Tried to save editor contents, but editor is not available",
        );
        return;
      }

      downloadFile(editorRef.current.getValue(), "YarnScript.yarn");
    },
  }));

  const { onValueChanged, initialValue, compilationResult } = props;

  useEffect(() => {
    // SOLUTION: instead use dynamic imports on the client side
    // import("monaco-editor/esm/vs/editor/editor.api")
    //   .then((monaco) => {
    console.log("Creating Monaco...");
    if (!editorContainerRef.current) {
      throw new Error("Failed to find an element to mount to!");
    }

    editorRef.current = monaco.editor.create(editorContainerRef.current!, {
      value: initialValue,
      language: "yarnspinner",
      theme: "yarnspinner",
      fontFamily: "Inconsolata",
      fontSize: 18,
      minimap: !isEmbed() ? { enabled: true } : { enabled: false },
      wordWrap: "on",
      lineNumbers: !isEmbed() ? "on" : "off",
      wrappingIndent: "same",
      wordBasedSuggestions: "off",
      automaticLayout: true,
      padding: {
        top: 10,
      },
    });

    // We have have created the editor before the document's fonts have finished
    // loading. Tell Monaco to re-measure the fonts once they're ready.
    document.fonts.ready.then(() => monaco.editor.remeasureFonts());

    editorRef.current.onDidChangeModelContent(() => {
      onValueChanged(editorRef.current?.getValue());
    });
    //   })
    //   .catch(() => {
    //     throw new Error("Failed to load Monaco!");
    //   });

    return () => {
      editorRef.current?.dispose();
    };
  }, [onValueChanged, initialValue]);

  useEffect(() => {
    console.log(
      `Diagnostics changed; now have ${
        compilationResult?.diagnostics.length ?? "unknown"
      }`,
    );

    if (!editorRef.current || !compilationResult) {
      return;
    }

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      console.warn("Editor has no model!");
      return;
    }

    const diagnostics = compilationResult.diagnostics.map((d) => {
      return {
        message: d.message,
        severity: toMarkerSeverity(d.severity),
        startLineNumber: d.range.start.line + 1,
        startColumn: d.range.start.character + 1,
        endLineNumber: d.range.end.line + 1,
        endColumn: d.range.end.character + 1,
      };
    });

    monaco.editor.setModelMarkers(model, "", diagnostics);
  }, [compilationResult]);

  return (
    <div
      ref={editorContainerRef}
      style={{ height: "100%", width: "100%" }}
    ></div>
  );
});
