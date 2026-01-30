/**
 * About Panel - Information about Try Yarn Spinner
 *
 * Shows version info, links, description, and credits.
 */

import { ExternalLink, Heart } from 'lucide-react';
import * as images from '../img';
import { trackEvent } from '../utility/analytics';

export function AboutPanel({
  onClose,
  compilerVersion,
  commitHash,
}: {
  onClose: () => void;
  compilerVersion?: string;
  commitHash?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sm:bg-black/30 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full h-full sm:w-auto sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:mx-4 bg-white dark:bg-[#242124] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:border border-[#E5E1E6] dark:border-[#534952]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 sm:px-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-5 pb-4 sm:pb-5 bg-green sm:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                className="h-10 w-auto"
                src={images.YarnSpinnerLogoURL}
                alt="Yarn Spinner"
              />
              <div>
                <h2 className="font-sans font-bold text-lg sm:text-xl text-white">
                  Try Yarn Spinner
                </h2>
                {(compilerVersion || commitHash) && (
                  <p className="text-xs mt-0.5 text-white/70">
                    {compilerVersion && `Compiler v${compilerVersion}`}
                    {compilerVersion && commitHash && ' · '}
                    {commitHash && `Build ${commitHash}`}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded transition-colors text-white/70 hover:bg-white/10 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {/* Description */}
          <div className="mb-6">
            <p className="text-sm leading-relaxed text-[#2D1F30] dark:text-[#E0D8E2]">
              Try Yarn Spinner is an interactive playground for writing and testing dialogue
              in{' '}
              <a
                href="https://yarnspinner.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green hover:underline"
                onClick={() => trackEvent('outbound-link', { url: 'yarnspinner.dev', location: 'about-description' })}
              >
                Yarn Spinner
              </a>
              , the friendly dialogue system for games.
            </p>
            <p className="text-sm leading-relaxed mt-3 text-[#7A6F7D] dark:text-[#B8A8BB]">
              Write your dialogue scripts, see syntax errors in real-time, and run
              your conversations directly in the browser. Your scripts stay in your browser
              and none of your content is sent to any server.
            </p>
          </div>

          {/* Call to Action */}
          <a
            href="https://yarnspinner.dev/install/"
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-6 p-4 rounded-xl bg-green/10 dark:bg-green/20 border border-green/20 dark:border-green/30 hover:bg-green/15 dark:hover:bg-green/25 transition-colors"
            onClick={() => trackEvent('cta-click', { destination: 'install-page' })}
          >
            <p className="text-sm font-semibold text-green dark:text-green-400 mb-1">
              Use Yarn Spinner in your game
            </p>
            <p className="text-xs text-[#7A6F7D] dark:text-[#B8A8BB]">
              Install for Unity, Unreal, or Godot →
            </p>
          </a>

          {/* Links */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-[#2D1F30] dark:text-[#E0D8E2]">
              Links
            </h3>
            <div className="space-y-2">
              <a
                href="https://docs.yarnspinner.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors bg-[#F9F7F9] dark:bg-[#312A35] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] text-[#2D1F30] dark:text-[#E0D8E2]"
                onClick={() => trackEvent('outbound-link', { url: 'docs.yarnspinner.dev', location: 'about-links' })}
              >
                <ExternalLink className="h-4 w-4 text-[#7A6F7D] dark:text-[#B8A8BB]" />
                Documentation
              </a>
              <a
                href="https://yarnspinner.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors bg-[#F9F7F9] dark:bg-[#312A35] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] text-[#2D1F30] dark:text-[#E0D8E2]"
                onClick={() => trackEvent('outbound-link', { url: 'yarnspinner.dev', location: 'about-links' })}
              >
                <ExternalLink className="h-4 w-4 text-[#7A6F7D] dark:text-[#B8A8BB]" />
                Yarn Spinner Website
              </a>
              <a
                href="https://discord.com/invite/yarnspinner"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors bg-[#F9F7F9] dark:bg-[#312A35] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] text-[#2D1F30] dark:text-[#E0D8E2]"
                onClick={() => trackEvent('outbound-link', { url: 'discord.com/invite/yarnspinner', location: 'about-links' })}
              >
                <ExternalLink className="h-4 w-4 text-[#7A6F7D] dark:text-[#B8A8BB]" />
                Join the Discord
              </a>
              <a
                href="https://github.com/sponsors/yarnspinnertool"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors bg-[#F9F7F9] dark:bg-[#312A35] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] text-[#2D1F30] dark:text-[#E0D8E2]"
                onClick={() => trackEvent('sponsor-click', { platform: 'github' })}
              >
                <Heart className="h-4 w-4 text-[#E42C84]" />
                Sponsor us on GitHub
              </a>
              <a
                href="https://patreon.com/secretlab"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors bg-[#F9F7F9] dark:bg-[#312A35] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] text-[#2D1F30] dark:text-[#E0D8E2]"
                onClick={() => trackEvent('sponsor-click', { platform: 'patreon' })}
              >
                <Heart className="h-4 w-4 text-[#E42C84]" />
                Sponsor us on Patreon
              </a>
            </div>
          </div>

          {/* Other */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-[#2D1F30] dark:text-[#E0D8E2]">
              Other
            </h3>
            <div className="flex gap-4">
              <a
                href="https://github.com/YarnSpinnerTool/IssuesDiscussion/issues/new?template=bug-report.md&assignees=parisba&projects=YarnSpinnerTool/8"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green hover:underline"
                onClick={() => trackEvent('report-bug-click', { location: 'about' })}
              >
                Report a Bug
              </a>
              <a
                href="https://www.yarnspinner.dev/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green hover:underline"
                onClick={() => trackEvent('outbound-link', { url: 'yarnspinner.dev/terms', location: 'about-other' })}
              >
                Terms of Service
              </a>
              <a
                href="https://www.yarnspinner.dev/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green hover:underline"
                onClick={() => trackEvent('outbound-link', { url: 'yarnspinner.dev/privacy', location: 'about-other' })}
              >
                Privacy Policy
              </a>
            </div>
          </div>

          {/* Credits */}
          <div className="pt-4 border-t border-[#E5E1E6] dark:border-[#534952]">
            <div className="flex items-center gap-2 text-sm text-[#7A6F7D] dark:text-[#B8A8BB]">
              <span>Made with</span>
              <Heart className="h-4 w-4 text-[#E42C84]" fill="#E42C84" />
              <span>by the</span>
              <a
                href="https://yarnspinner.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green hover:underline"
                onClick={() => trackEvent('outbound-link', { url: 'yarnspinner.dev', location: 'about-credits' })}
              >
                Yarn Spinner
              </a>
              <span>team</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
