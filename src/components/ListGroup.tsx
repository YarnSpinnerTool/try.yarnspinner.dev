import { forwardRef, PropsWithChildren } from "react";
import c from "../utility/classNames";

export const ListGroup = forwardRef(function ListGroup(
  props: PropsWithChildren,
  ref: React.Ref<HTMLDivElement>,
) {
  return (
    <div ref={ref} className="flex w-full flex-col gap-0 rounded-md">
      {props.children}
    </div>
  );
});

export const ListGroupItem = forwardRef(function ListGroupItem(
  props: {
    type:
      | "line"
      | "option"
      | "selected-option"
      | "continue"
      | "command"
      | "error"
      | "unknown";
    onClick?: () => void;
  } & PropsWithChildren,
  ref: React.Ref<HTMLDivElement>,
) {
  let type = props.type;
  type ??= "line";

  return (
    <div
      ref={ref}
      className={c(
        "border-1 border-t-0 p-2 px-3 transition-colors first:rounded-t-md first:border-t-1 last:rounded-b-md",

        type === "continue" &&
          "border-green-300 bg-green-100 text-green-800 hover:bg-green-200",

        type === "line" && "border-grey-200 bg-white",
        type === "option" && "border-grey-200 bg-white hover:bg-grey-50",
        type === "selected-option" &&
          "border-blue-200 bg-blue-100 text-blue-800",
        type === "command" && "border-blue-200 bg-blue-100 text-blue-800",
        type === "error" && "border-red-200 bg-red-100 text-red-800",
        type === "unknown" && "border-red-200 bg-red-100 text-red-800",
      )}
      role={type === "option" || type === "continue" ? "button" : undefined}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  );
});
