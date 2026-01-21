import { forwardRef, PropsWithChildren } from "react";
import c from "../utility/classNames";

export const ListGroup = forwardRef(function ListGroup(
  props: PropsWithChildren,
  ref: React.Ref<HTMLDivElement>,
) {
  return (
    <div ref={ref} className="flex w-full flex-col gap-2 p-4">
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
        "rounded-lg px-4 py-3 transition-all text-base leading-relaxed",

        type === "continue" &&
          "bg-green-50 text-green border border-green-300 hover:bg-green-100 cursor-pointer shadow-sm hover:shadow-md font-medium",

        type === "line" && "bg-white text-black",
        type === "option" && "bg-white text-black border border-grey-200 hover:bg-grey-50 hover:border-green cursor-pointer shadow-sm hover:shadow-md",
        type === "selected-option" &&
          "bg-green-50 text-green border border-green-300",
        type === "command" && "bg-grey-50 text-grey-500 text-sm italic",
        type === "error" && "bg-red-50 text-red-800 border border-red-300",
        type === "unknown" && "bg-red-50 text-red-800 border border-red-300",
      )}
      role={type === "option" || type === "continue" ? "button" : undefined}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  );
});
