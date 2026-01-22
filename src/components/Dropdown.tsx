import { useState, useRef, useEffect } from "react";
import { Button } from "./Button";

export interface DropdownItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "info";
}

export interface DropdownProps {
  label: string;
  iconURL?: string;
  items: DropdownItem[];
  variant?: "default" | "primary" | "circle";
}

export function Dropdown(props: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        iconURL={props.iconURL}
        variant={props.variant}
      >
        {props.label}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
          {props.items.map((item, index) =>
            item.type === "info" ? (
              <div
                key={index}
                className={`px-4 py-3 text-xs leading-relaxed ${index < props.items.length - 1 ? 'border-b border-gray-200' : ''}`}
                style={{
                  backgroundColor: '#F9F7F9',
                  color: '#6B5F6D',
                  lineHeight: '1.5'
                }}
              >
                {item.label}
              </div>
            ) : (
              <button
                key={index}
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick();
                    setIsOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                  item.disabled
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-700 hover:bg-green/10 hover:text-green"
                }`}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
