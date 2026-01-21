import c from "../utility/classNames";
import isEmbed from "../utility/isEmbed";
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
        "flex w-full h-12 shrink-0 flex-row items-center justify-between border-b border-green/20 bg-green px-4 gap-4",
      )}
    >
      {/* Left: Logo and title */}
      <div className="flex flex-row items-center gap-3">
        <a href="https://yarnspinner.dev">
          <img
            className="h-7 w-auto"
            src={images.YarnSpinnerLogoURL}
            alt="Yarn Spinner"
          />
        </a>
        {!embed && (
          <h1 className="hidden sm:block font-title font-semibold text-white text-base tracking-tight">
            Try Yarn Spinner
          </h1>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {!embed && (
          <a className="select-none" href="https://docs.yarnspinner.dev" target="_blank" rel="noopener noreferrer">
            <Button iconURL={images.DocsIconURL}>Docs</Button>
          </a>
        )}
        {!embed && (
          <Button
            onClick={props.onSaveScript}
            iconURL={images.SaveScriptIconURL}
          >
            Save Script
          </Button>
        )}
        {!embed && (
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
