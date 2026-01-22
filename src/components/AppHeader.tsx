import c from "../utility/classNames";
import isEmbed from "../utility/isEmbed";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import type { BackendStatus } from "../utility/loadBackend";
import { trackEvent } from "../utility/analytics";

import * as images from "../img";

export function AppHeader(props: {
  onSaveScript?: () => void;
  onLoadFromDisk?: () => void;
  onLoadFromGist?: () => void;
  onPlay?: () => void;
  onExportPlayer?: () => void;
  backendStatus?: BackendStatus;
}) {
  const embed = isEmbed();

  return (
    <div
      className={c(
        "fixed top-0 left-0 right-0 flex w-full h-12 shrink-0 flex-row items-center justify-between border-b border-green/20 bg-green px-4 gap-4 z-50",
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
          <>
            <h1 className="hidden sm:block font-title font-semibold text-white text-base tracking-tight">
              Try Yarn Spinner
            </h1>
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="hidden sm:block text-white/20">·</span>
              <Dropdown
                label="?"
                variant="circle"
                items={[
                  {
                    label: "Documentation",
                    onClick: () => {
                      trackEvent('docs-click');
                      window.open("https://docs.yarnspinner.dev", "_blank");
                    },
                  },
                  {
                    label: "About Yarn Spinner",
                    onClick: () => {
                      window.open("https://yarnspinner.dev", "_blank");
                    },
                  },
                  {
                    label: "Terms of Service",
                    onClick: () => {
                      window.open("https://www.yarnspinner.dev/terms/", "_blank");
                    },
                  },
                  {
                    label: "Privacy Policy",
                    onClick: () => {
                      window.open("https://www.yarnspinner.dev/privacy/", "_blank");
                    },
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {!embed && (
          <Dropdown
            label="Load"
            items={[
              {
                label: "Load from Disk",
                onClick: () => {
                  trackEvent('load-from-disk');
                  props.onLoadFromDisk?.();
                },
              },
              {
                label: "Load from Gist",
                onClick: () => {
                  trackEvent('load-from-gist');
                  props.onLoadFromGist?.();
                },
              },
              {
                label: "Loading opens a copy and replaces your current content. Everything is stored locally in your browser and doesn't save back to disk or gist.",
                type: "info",
              },
            ]}
          />
        )}
        {!embed && (
          <Dropdown
            label="Save"
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
