import { PropsWithChildren } from "react";
import c from "../utility/classNames";

export function Button(
  props: {
    iconURL?: string;
    onClick?: () => void;
  } & PropsWithChildren,
) {
  return (
    <div
      onClick={props.onClick}
      className="flex h-8 shrink-0 select-none flex-row items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
      role="button"
    >
      {props.iconURL ? <img className="h-4 w-4" src={props.iconURL} alt="" /> : null}
      <span className={c(props.iconURL && "hidden sm:inline")}>
        {props.children}
      </span>
    </div>
  );
}
