import { PropsWithChildren } from "react";
import c from "../utility/classNames";

export function Button(
  props: {
    iconURL?: string;
    onClick?: () => void;
    disabled?: boolean;
    variant?: "default" | "primary" | "circle";
    title?: string;
  } & PropsWithChildren,
) {
  const variant = props.variant || "default";

  return (
    <div
      onClick={props.disabled ? undefined : props.onClick}
      title={props.title}
      className={c(
        "flex shrink-0 select-none flex-row items-center gap-2 text-sm font-semibold transition-colors",
        variant === "circle"
          ? "w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 justify-center text-white text-xs cursor-pointer"
          : "h-8 rounded-lg px-3 py-1.5",
        props.disabled
          ? "opacity-50 cursor-not-allowed text-white/60"
          : variant === "primary"
          ? "bg-[#6AAA7E] text-white hover:bg-[#7DBD91] cursor-pointer shadow-sm"
          : variant === "default"
          ? "text-white/90 hover:bg-white/10 hover:text-white cursor-pointer"
          : ""
      )}
      role="button"
      aria-disabled={props.disabled}
    >
      {props.iconURL && variant !== "circle" ? <img className="h-4 w-4" src={props.iconURL} alt="" /> : null}
      <span className={c(props.iconURL && variant !== "circle" && "hidden sm:inline")}>
        {props.children}
      </span>
    </div>
  );
}
