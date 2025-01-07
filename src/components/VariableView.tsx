import { VariableStorage, YarnValue } from "@yarnspinnertool/core";
import { YarnSpinner } from "backend";

function getVariableType(
  name: string,
  compilationResult: YarnSpinner.CompilationResult,
): string | undefined {
  const decls = compilationResult.variableDeclarations;

  const decl = decls[name];

  if (!decl) {
    return undefined;
  }

  return decl.type;
}

function getVariableDisplayValue(
  name: string,
  value: YarnValue,
  compilationResult: YarnSpinner.CompilationResult,
): string {
  if (compilationResult.variableDeclarations[name]) {
    // We have a declaration for this variable. Do we have a type declaration?
    if (
      compilationResult.variableDeclarations[name].type in
      compilationResult.typeDeclarations
    ) {
      // We do. Is it an enum (i.e. it has a 'cases' dict)?
      const type =
        compilationResult.typeDeclarations[
          compilationResult.variableDeclarations[name].type
        ];

      if ("cases" in type) {
        // Try to find the case name of this value.
        const cases = type.cases as Record<string, number | string>;

        const matchingCase = Object.entries(cases).find(
          (kv) => kv[1] === value,
        );

        if (matchingCase) {
          // Found it! Return the case name, not the raw value name.
          return matchingCase[0];
        }
      }
    }
  }

  // We didn't find a decl for the variable, or we didn't find a case name for
  // it. Convert it directly to a string.
  return value.toString();
}

export function VariableView(props: {
  storage: VariableStorage;
  compilationResult?: YarnSpinner.CompilationResult;
}) {
  return (
    <>
      {Object.entries(props.storage).length > 0 && (
        <div id="variables" className="h-[25%] shrink-0 overflow-y-auto p-3">
          <table className="w-full">
            <thead className="border-grey-50 border-b-2 text-left">
              <tr>
                <th>Variable</th>
                <th>Type</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody id="variables-body">
              {Object.entries(props.storage).map(([name, val], i) => {
                if (!props.compilationResult) {
                  // No compilation result, so no variable info to
                  // show
                  return null;
                }
                return (
                  <tr key={i}>
                    <td>{name}</td>
                    <td>{getVariableType(name, props.compilationResult)}</td>
                    <td>
                      {getVariableDisplayValue(
                        name,
                        val,
                        props.compilationResult,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
