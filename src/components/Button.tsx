import { PropsWithChildren } from "react";
import c from "../utility/classNames";

export function Button(
  props: {
    iconURL?: string;
    onClick?: () => void;
    disabled?: boolean;
  } & PropsWithChildren,
) {
  return (
    <div
      onClick={props.disabled ? undefined : props.onClick}
      className={c(
        "flex h-8 shrink-0 select-none flex-row items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
        props.disabled
          ? "opacity-50 cursor-not-allowed text-white/60"
          : "text-white/90 hover:bg-white/10 hover:text-white cursor-pointer"
      )}
      role="button"
      aria-disabled={props.disabled}
    >
      {props.iconURL ? <img className="h-4 w-4" src={props.iconURL} alt="" /> : null}
      <span className={c(props.iconURL && "hidden sm:inline")}>
        {props.children}
      </span>
    </div>
  );
}
