import { PropsWithChildren } from "react";
import c from "../utility/classNames";

export function ButtonGroup(props: PropsWithChildren) {
  return <div className="flex p-2">{props.children}</div>;
}
export function ButtonGroupItem(
  props: { onClick?: () => void; active?: boolean } & PropsWithChildren,
) {
  return (
    <div
      role="button"
      onClick={props.onClick}
      aria-current={props.active ? "page" : "false"}
      className={c(
        "select-none p-2 px-4 font-bold text-white transition-colors first:rounded-l-md last:rounded-r-md hover:bg-green-600",
        props.active ? "bg-green-400" : "bg-green-500",
      )}
    >
      {props.children}
    </div>
  );
}
