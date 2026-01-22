import c from "../utility/classNames";
import isEmbed from "../utility/isEmbed";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import type { BackendStatus } from "../utility/loadBackend";
import { trackEvent } from "../utility/analytics";

import * as images from "../img";

export function AppHeader(props: {
  onSaveScript?: () => void;
  onPlay?: () => void;
  onExportPlayer?: () => void;
  backendStatus?: BackendStatus;
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
          <div className="hidden sm:flex flex-row items-center gap-3">
            <h1 className="font-title font-semibold text-white text-base tracking-tight">
              Try Yarn Spinner
            </h1>
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="text-white/20">·</span>
              <a
                href="https://www.yarnspinner.dev/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                Privacy
              </a>
              <span className="text-white/20">·</span>
              <a
                href="https://www.yarnspinner.dev/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                Terms
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {!embed && (
          <a
            className="select-none"
            href="https://docs.yarnspinner.dev"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('docs-click')}
          >
            <Button iconURL={images.DocsIconURL}>Docs</Button>
          </a>
        )}
        {!embed && (
          <Dropdown
            label="Save"
            iconURL={images.SaveScriptIconURL}
            items={[
              {
                label: "Save Script",
                onClick: () => {
                  trackEvent('save-script');
                  props.onSaveScript?.();
                },
              },
              {
                label: "Export Player",
                onClick: () => {
                  trackEvent('export-player');
                  props.onExportPlayer?.();
                },
              },
            ]}
          />
        )}
        <Button
          onClick={props.onPlay ? () => {
            trackEvent('run-dialogue');
            props.onPlay?.();
          } : undefined}
          iconURL={images.PlayIconURL}
          disabled={!props.onPlay}
          variant="primary"
        >
          {props.backendStatus === 'loading' ? 'Loading runtime...' : 'Run'}
        </Button>
      </div>
    </div>
  );
}
