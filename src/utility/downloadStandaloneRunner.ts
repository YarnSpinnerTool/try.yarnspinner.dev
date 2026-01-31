import standAloneRunner from "../standalone-runner/index.html?raw";
import { YarnSpinner } from "backend";
import { downloadFile } from "./downloadFile";
import { MetadataTable, StringTable } from "@yarnspinnertool/core";

type ExportedData = {
  data: string;
  stringTable: StringTable;
  metadataTable: MetadataTable;
};

export function downloadStandaloneRunner(
  result: YarnSpinner.CompilationResult
) {
  // Ensure that our incoming data is something that can be turned into a runner
  if (!result.programData) {
    console.log("Can't export runner: no valid program");
    return;
  }
  if (!result.stringTable) {
    console.log("Can't export runner: no valid string table");
    return;
  }

  const stringTable = result.stringTable;

  // Create the object that the runner will expect to find at window.yarnData
  const data: ExportedData = {
    data: result.programData,

    stringTable: Object.fromEntries(
      Object.entries(stringTable).map(([id, entry]) => {
        return [id, entry.text];
      })
    ),

    metadataTable: Object.fromEntries(
      Object.entries(stringTable).map(([id, entry]) => {
        return [
          id,
          {
            id,
            lineNumber: entry.lineNumber.toString(),
            node: entry.nodeName ?? "",
            tags: entry.tags,
          },
        ];
      })
    ),
  };

  // Inject this data into the standalone runner's HTML
  const injectedScript = `<script id="injected-yarn-program">window.yarnData=(${JSON.stringify(
    data
  )});</script>`;

  const output = standAloneRunner.replace(
    `<script id="injected-yarn-program"></script>`,
    injectedScript
  );

  // Download the resulting source code as an HTML file
  downloadFile(output, "Runner.html");
}
