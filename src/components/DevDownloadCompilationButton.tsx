import { Program } from "@yarnspinnertool/core";
import { YarnSpinner } from "backend";
import { Button } from "./Button";
import base64ToBytes from "../utility/base64ToBytes";
import { downloadFile } from "../utility/downloadFile";

export function DevDownloadCompilationButton(props: {
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
