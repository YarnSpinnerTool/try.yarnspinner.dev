import c from "../utility/classNames";
import isEmbed from "../utility/useEmbed";
import { Button } from "./Button";

import * as images from "../img";

export function AppHeader(props: {
  onSaveScript?: () => void;
  onPlay?: () => void;
  onExportPlayer?: () => void;
}) {
  const embed = isEmbed();

  return (
    <div
      className={c(
        "flex w-full shrink-0 flex-row justify-between border-b-2 border-b-green bg-green-50",
        embed ? "p-2 pl-3" : "p-4 pl-6",
      )}
    >
      <div className="flex flex-row items-center gap-4">
        <a href="https://yarnspinner.dev">
          <img
            className={c(embed ? "h-[40px]" : "h-[40px] md:h-[70px]")}
            src={images.YarnSpinnerLogoURL}
          />
        </a>
        <h1
          className={c(
            "hidden font-title sm:block",
            embed ? "text-xl" : "sm:text-2xl md:text-4xl",
          )}
        >
          <a href="https://yarnspinner.dev">Try Yarn Spinner</a>
        </h1>
      </div>
      <div className="flex items-center gap-1 text-end">
        {embed ? null : (
          <a className="select-none" href="https://docs.yarnspinner.dev">
            <Button iconURL={images.DocsIconURL}>Docs</Button>
          </a>
        )}
        {embed ? null : (
          <Button
            onClick={props.onSaveScript}
            iconURL={images.SaveScriptIconURL}
          >
            Save Script
          </Button>
        )}
        {embed ? null : (
          <Button
            onClick={props.onExportPlayer}
            iconURL={images.ExportPlayerIconURL}
          >
            Export Player
          </Button>
        )}
        <Button onClick={props.onPlay} iconURL={images.PlayIconURL}>
          Run
        </Button>
      </div>
    </div>
  );
}
