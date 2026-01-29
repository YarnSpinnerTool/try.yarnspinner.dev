import { VariableStorage, YarnValue } from "@yarnspinnertool/core";
import { YarnSpinner } from "backend";
import { useState, useRef, useEffect } from "react";
import { trackEvent } from "../utility/analytics";

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

    // If it's a string type, wrap in quotes (also handles empty strings)
    if (compilationResult.variableDeclarations[name].type === "String") {
      return `"${value}"`;
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
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const variableCount = Object.keys(props.storage).length;

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (variableCount === 0) {
    return null;
  }

  return (
    <div className="absolute top-3 right-3 z-10">
      {/* Trigger Button - Simple Badge */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (!isOpen) {
            trackEvent('open-variables');
          }
          setIsOpen(!isOpen);
        }}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all shadow-sm hover:shadow bg-white dark:bg-[#242124] border border-[#E5E1E6] dark:border-[#534952] text-[#4C8962] dark:text-[#7DBD91]"
      >
        <span className="font-mono">$variables</span>
        <span className="opacity-60 ml-1">{variableCount}</span>
      </button>

      {/* Popover - Clean and Simple */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-1 w-72 rounded-lg overflow-hidden shadow-lg bg-white dark:bg-[#242124] border border-[#E5E1E6] dark:border-[#534952]"
          style={{
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-[#E5E1E6] dark:border-[#534952] bg-[#F9F7F9] dark:bg-[#312A35] flex items-center justify-between">
            <h3 className="font-sans font-semibold text-xs uppercase tracking-wide text-[#7A6F7D] dark:text-[#B8A8BB]">
              Variables
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-0.5 hover:opacity-70 rounded transition-opacity text-[#7A6F7D] dark:text-[#B8A8BB]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Variables List */}
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(props.storage).map(([name, val], i) => {
              if (!props.compilationResult) {
                return null;
              }

              const type = getVariableType(name, props.compilationResult);
              const displayValue = getVariableDisplayValue(name, val, props.compilationResult);

              return (
                <div
                  key={i}
                  className="px-3 py-2.5 border-b border-[#F9F7F9] dark:border-[#534952] transition-colors hover:bg-[#F9F7F9] dark:hover:bg-[#312A35]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="font-mono text-xs font-medium truncate text-[#E4542C] dark:text-[#FF7A5C]">
                        {name}
                      </div>
                      {type && (
                        <div className="text-[10px] text-[#5C8A9A] dark:text-[#7DAABE] opacity-80">
                          {type}
                        </div>
                      )}
                    </div>
                    <div className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded transition-colors text-[#2D1F30] dark:text-[#E0D8E2] bg-[#F0EEF1] dark:bg-[#534952]">
                      {displayValue}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
