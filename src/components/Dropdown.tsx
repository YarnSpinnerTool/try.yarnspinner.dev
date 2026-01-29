import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "./Button";
import { useMediaQuery } from "../utility/useMediaQuery";
import { useState, type ReactNode } from "react";

export interface DropdownItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  type?: "button" | "info" | "separator" | "submenu";
  items?: DropdownItem[];
  description?: string;
}

export interface DropdownProps {
  label: ReactNode;
  iconURL?: string;
  items: DropdownItem[];
  variant?: "default" | "primary" | "circle";
  align?: "left" | "right";
}

// Mobile-friendly inline submenu component
function MobileSubmenu({ item, onClose, isExpanded, onToggle }: {
  item: DropdownItem;
  onClose: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700 dark:text-[#E0D8E2] hover:bg-green/10 dark:hover:bg-green/20 hover:text-green dark:hover:text-green-400 transition-colors cursor-pointer outline-none"
      >
        <span>{item.label}</span>
        <ChevronDown
          size={14}
          className={`ml-2 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && item.items && (
        <div className="bg-[#F9F7F9] dark:bg-[#1a181a] border-y border-gray-200 dark:border-gray-700 overflow-hidden">
          {item.items.map((subItem, subIndex) => {
            if (subItem.type === "separator") {
              return <div key={subIndex} className="h-px bg-gray-200 dark:bg-gray-600 mx-2 my-1" />;
            }

            if (subItem.type === "info") {
              return (
                <div
                  key={subIndex}
                  className="px-6 py-3 text-xs leading-relaxed text-[#6B5F6D] dark:text-[#B8A8BB]"
                >
                  {subItem.label}
                </div>
              );
            }

            return (
              <button
                key={subIndex}
                onClick={() => {
                  subItem.onClick?.();
                  onClose();
                }}
                disabled={subItem.disabled}
                className={`flex w-full items-center ${subItem.selected !== undefined ? 'gap-2' : ''} text-left pl-6 pr-4 py-3 text-sm text-gray-700 dark:text-[#E0D8E2] hover:bg-green/10 dark:hover:bg-green/20 hover:text-green dark:hover:text-green-400 transition-colors cursor-pointer outline-none disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed min-w-0`}
              >
                {subItem.selected !== undefined && (
                  <span className="w-4 shrink-0 text-green dark:text-green-400">
                    {subItem.selected && '●'}
                  </span>
                )}
                <span className="truncate">{subItem.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Dropdown(props: DropdownProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSubmenu, setExpandedSubmenu] = useState<number | null>(null);

  // Reset expanded submenu when dropdown closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setExpandedSubmenu(null);
    }
  };

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger asChild>
        <div>
          <Button iconURL={props.iconURL} variant={props.variant}>
            {props.label}
          </Button>
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={props.align === "left" ? "start" : "end"}
          sideOffset={8}
          collisionPadding={16}
          className="min-w-56 max-w-[calc(100vw-32px)] rounded-md shadow-xl bg-white dark:bg-[#242124] ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 overflow-hidden"
          style={isMobile ? { width: 'calc(100vw - 32px)' } : undefined}
        >
          {props.items.map((item, index) => {
            if (item.type === "separator") {
              return <DropdownMenu.Separator key={index} className="h-px bg-gray-200 dark:bg-gray-600 mx-2 my-1" />;
            }

            if (item.type === "info") {
              return (
                <div
                  key={index}
                  className="px-4 py-3 text-xs leading-relaxed bg-[#F9F7F9] dark:bg-[#312A35] text-[#6B5F6D] dark:text-[#B8A8BB] border-b border-gray-200 dark:border-gray-600"
                >
                  {item.label}
                </div>
              );
            }

            // On mobile, render submenus as inline expandable sections
            if (item.type === "submenu" && item.items) {
              if (isMobile) {
                return (
                  <MobileSubmenu
                    key={index}
                    item={item}
                    onClose={() => setIsOpen(false)}
                    isExpanded={expandedSubmenu === index}
                    onToggle={() => setExpandedSubmenu(expandedSubmenu === index ? null : index)}
                  />
                );
              }

              // Desktop: use normal Radix submenu
              return (
                <DropdownMenu.Sub key={index}>
                  <DropdownMenu.SubTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700 dark:text-[#E0D8E2] hover:bg-green/10 dark:hover:bg-green/20 hover:text-green dark:hover:text-green-400 data-[state=open]:bg-green/10 dark:data-[state=open]:bg-green/20 data-[state=open]:text-green dark:data-[state=open]:text-green-400 transition-colors cursor-pointer outline-none">
                    <span>{item.label}</span>
                    <ChevronRight size={14} className="ml-2 shrink-0" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      sideOffset={4}
                      alignOffset={-8}
                      collisionPadding={16}
                      className="w-72 max-w-[calc(100vw-32px)] rounded-md shadow-xl bg-white dark:bg-[#242124] ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 z-[60] overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    >
                      {item.items.map((subItem, subIndex) => {
                        if (subItem.type === "separator") {
                          return <DropdownMenu.Separator key={subIndex} className="h-px bg-gray-200 dark:bg-gray-600 mx-2 my-1" />;
                        }

                        if (subItem.type === "info") {
                          return (
                            <div
                              key={subIndex}
                              className="px-4 py-3 text-xs leading-relaxed bg-[#F9F7F9] dark:bg-[#312A35] text-[#6B5F6D] dark:text-[#B8A8BB] border-b border-gray-200 dark:border-gray-600"
                            >
                              {subItem.label}
                            </div>
                          );
                        }

                        return (
                          <DropdownMenu.Item
                            key={subIndex}
                            onSelect={subItem.onClick}
                            disabled={subItem.disabled}
                            className={`flex w-full items-center ${subItem.selected !== undefined ? 'gap-2' : ''} text-left px-4 py-3 text-sm text-gray-700 dark:text-[#E0D8E2] hover:bg-green/10 dark:hover:bg-green/20 hover:text-green dark:hover:text-green-400 data-[highlighted]:bg-green/10 dark:data-[highlighted]:bg-green/20 data-[highlighted]:text-green dark:data-[highlighted]:text-green-400 transition-colors cursor-pointer outline-none data-[disabled]:text-gray-400 dark:data-[disabled]:text-gray-500 data-[disabled]:cursor-not-allowed`}
                          >
                            {subItem.selected !== undefined && (
                              <span className="w-4 shrink-0 text-green dark:text-green-400">
                                {subItem.selected && '●'}
                              </span>
                            )}
                            <span>{subItem.label}</span>
                          </DropdownMenu.Item>
                        );
                      })}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              );
            }

            return (
              <DropdownMenu.Item
                key={index}
                onSelect={item.onClick}
                disabled={item.disabled}
                className={`flex w-full items-center ${item.selected !== undefined ? 'gap-2' : ''} text-left px-4 py-3 text-sm text-gray-700 dark:text-[#E0D8E2] hover:bg-green/10 dark:hover:bg-green/20 hover:text-green dark:hover:text-green-400 data-[highlighted]:bg-green/10 dark:data-[highlighted]:bg-green/20 data-[highlighted]:text-green dark:data-[highlighted]:text-green-400 transition-colors cursor-pointer outline-none data-[disabled]:text-gray-400 dark:data-[disabled]:text-gray-500 data-[disabled]:cursor-not-allowed`}
              >
                {item.selected !== undefined && (
                  <span className="w-4 shrink-0 text-green dark:text-green-400">
                    {item.selected && '●'}
                  </span>
                )}
                <span>{item.label}</span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
