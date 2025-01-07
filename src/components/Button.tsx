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
      className="flex min-h-10 shrink-0 select-none flex-row items-center gap-1 rounded-md bg-green-500 p-2 px-4 font-bold text-white transition-colors hover:bg-green-600"
      role="button"
    >
      {props.iconURL ? <img className="h-6" src={props.iconURL} /> : null}
      <div className={c(props.iconURL && "hidden lg:block")}>
        {props.children}
      </div>
    </div>
  );
}
