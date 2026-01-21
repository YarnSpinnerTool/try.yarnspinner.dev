import { VariableStorage, YarnValue } from "@yarnspinnertool/core";
import { YarnSpinner } from "backend";
import { useState, useRef, useEffect } from "react";

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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all shadow-sm hover:shadow"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E1E6',
          color: '#4C8962'
        }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span>{variableCount}</span>
      </button>

      {/* Popover - Clean and Simple */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-1 w-72 rounded-lg overflow-hidden shadow-lg"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E1E6',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{
            borderColor: '#E5E1E6',
            backgroundColor: '#F9F7F9'
          }}>
            <h3 className="font-sans font-semibold text-xs uppercase tracking-wide" style={{color: '#7A6F7D'}}>
              Variables
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-0.5 hover:opacity-70 rounded transition-opacity"
              style={{color: '#7A6F7D'}}
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
                  className="px-3 py-2.5 border-b transition-colors"
                  style={{
                    borderColor: '#F9F7F9',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F9F7F9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-medium truncate" style={{color: '#E4542C'}}>
                        {name}
                      </div>
                      {type && (
                        <div className="text-[10px] mt-0.5" style={{color: '#5C8A9A', opacity: 0.8}}>
                          {type}
                        </div>
                      )}
                    </div>
                    <div
                      className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        color: '#2D1F30',
                        backgroundColor: '#F0EEF1'
                      }}
                    >
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
