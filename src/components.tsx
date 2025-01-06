import { forwardRef, PropsWithChildren } from "react";
import c from "./classNames";

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
      <div
        className={c(
          props.iconURL && "hidden lg:block", // hide text on small screens if there's an icon
        )}
      >
        {props.children}
      </div>
    </div>
  );
}

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
      | "unknown";
    onClick?: () => void;
  } & PropsWithChildren,
  ref: React.Ref<HTMLDivElement>,
) {
  //   props.type ??= "line";

  let type = props.type;
  type ??= "line";

  return (
    <div
      ref={ref}
      className={c(
        "first:border-t-1 border-1 border-t-0 p-2 px-3 transition-colors first:rounded-t-md last:rounded-b-md",

        type === "continue" &&
          "border-green-300 bg-green-100 text-green-800 hover:bg-green-200",

        type === "line" && "border-grey-200 bg-white",
        type === "option" && "border-grey-200 hover:bg-grey-50 bg-white",
        type === "selected-option" &&
          "border-blue-200 bg-blue-100 text-blue-800",
        type === "command" && "border-blue-200 bg-blue-100 text-blue-800",

        type === "unknown" && "border-red-200 bg-red-100 text-red-800",
      )}
      role={type === "option" || type === "continue" ? "button" : undefined}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  );
});
