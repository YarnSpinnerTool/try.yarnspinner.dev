import { PropsWithChildren } from "react";
import c from "../utility/classNames";

export function ButtonGroup(props: PropsWithChildren) {
  return <div className="flex p-2">{props.children}</div>;
}
export function ButtonGroupItem(
  props: { onClick?: () => void; active?: boolean; pulse?: boolean } & PropsWithChildren,
) {
  return (
    <div
      role="button"
      onClick={props.onClick}
      aria-current={props.active ? "page" : "false"}
      className={c(
        "select-none px-6 py-2 font-semibold text-sm first:rounded-l-lg last:rounded-r-lg cursor-pointer",
        props.active
          ? "bg-green text-white"
          : "bg-green/20 text-green hover:bg-green/30",
        props.pulse ? "animate-pulse-attention" : "transition-colors"
      )}
    >
      {props.children}
    </div>
  );
}
