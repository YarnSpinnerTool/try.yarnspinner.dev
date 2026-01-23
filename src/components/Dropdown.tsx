import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight } from "lucide-react";
import { Button } from "./Button";

export interface DropdownItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "info" | "separator" | "submenu";
  items?: DropdownItem[];
  description?: string;
}

export interface DropdownProps {
  label: string;
  iconURL?: string;
  items: DropdownItem[];
  variant?: "default" | "primary" | "circle";
  align?: "left" | "right";
}

export function Dropdown(props: DropdownProps) {
  return (
    <DropdownMenu.Root>
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
          className="min-w-56 rounded-md shadow-xl bg-white dark:bg-[#3A3340] ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
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

            if (item.type === "submenu" && item.items) {
              return (
                <DropdownMenu.Sub key={index}>
                  <DropdownMenu.SubTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-700 dark:text-[#E0D8E2] hover:bg-green/10 dark:hover:bg-green/20 hover:text-green dark:hover:text-green-400 data-[state=open]:bg-green/10 dark:data-[state=open]:bg-green/20 data-[state=open]:text-green dark:data-[state=open]:text-green-400 transition-colors cursor-pointer outline-none">
                    <span>{item.label}</span>
                    <ChevronRight size={14} className="ml-2 shrink-0" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      sideOffset={8}
                      className="w-72 rounded-md shadow-xl bg-white dark:bg-[#3A3340] ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
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
                            className="block w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-[#E0D8E2] hover:bg-green/10 dark:hover:bg-green/20 hover:text-green dark:hover:text-green-400 data-[highlighted]:bg-green/10 dark:data-[highlighted]:bg-green/20 data-[highlighted]:text-green dark:data-[highlighted]:text-green-400 transition-colors cursor-pointer outline-none data-[disabled]:text-gray-400 dark:data-[disabled]:text-gray-500 data-[disabled]:cursor-not-allowed"
                          >
                            {subItem.label}
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
                className="block w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-[#E0D8E2] hover:bg-green/10 dark:hover:bg-green/20 hover:text-green dark:hover:text-green-400 data-[highlighted]:bg-green/10 dark:data-[highlighted]:bg-green/20 data-[highlighted]:text-green dark:data-[highlighted]:text-green-400 transition-colors cursor-pointer outline-none data-[disabled]:text-gray-400 dark:data-[disabled]:text-gray-500 data-[disabled]:cursor-not-allowed"
              >
                {item.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
