/**
 * Error Boundary
 *
 * Catches React errors and displays a friendly error screen
 * themed to match the Yarn Spinner style.
 *
 * Features:
 * - Themed error display with logo pattern background
 * - Copy error details for reporting
 * - Email support with error context
 * - Links to issue tracker
 */

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Bug, Copy, Check, MessageCircle, ExternalLink, Trash2, Download } from 'lucide-react';
import StackTrace from 'stacktrace-js';
import { YarnSpinnerLogoURL } from '../img';
import { trackEvent } from '../utility/analytics';

// =============================================================================
// Types
// =============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component or render function */
  fallback?: ReactNode | ((error: Error, errorInfo: React.ErrorInfo) => ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
  resolvedStack: string | null;
}

// =============================================================================
// Constants
// =============================================================================

const ISSUE_TRACKER_BASE_URL = 'https://github.com/YarnSpinnerTool/IssuesDiscussion/issues/new';
const DISCORD_URL = 'https://discord.com/invite/yarnspinner';

// =============================================================================
// Component
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      resolvedStack: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.resolveStackTrace(error);
  }

  resolveStackTrace(error: Error): void {
    StackTrace.fromError(error)
      .then(frames => {
        const resolved = frames.map(f =>
          `    at ${f.functionName || '(anonymous)'} (${f.fileName}:${f.lineNumber}:${f.columnNumber})`
        ).join('\n');
        this.setState({ resolvedStack: resolved });
      })
      .catch(err => {
        console.warn('[ErrorBoundary] Could not resolve stack trace:', err);
      });
  }

  handleReload = (): void => {
    trackEvent('error-boundary-reload');
    window.location.reload();
  };

  getErrorReport = (): string => {
    const { error, errorInfo, resolvedStack } = this.state;
    const stackTrace = resolvedStack || error?.stack || 'No stack trace available';
    const lines = [
      '='.repeat(60),
      'Try Yarn Spinner Error Report',
      '='.repeat(60),
      '',
      `Timestamp: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
      `URL: ${window.location.href}`,
      `Platform: ${navigator.platform}`,
      '',
      'ERROR DETAILS',
      '-'.repeat(40),
      `Message: ${error?.message || 'Unknown error'}`,
      '',
      `Stack Trace${resolvedStack ? ' (source-mapped)' : ''}:`,
      stackTrace,
      '',
      'Component Stack:',
      errorInfo?.componentStack || 'No component stack available',
      '',
      '='.repeat(60),
      'Please include this report when filing an issue.',
      '='.repeat(60),
    ];
    return lines.join('\n');
  };

  handleCopyError = async (): Promise<void> => {
    trackEvent('error-boundary-copy');
    try {
      await navigator.clipboard.writeText(this.getErrorReport());
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Clipboard API not available - try fallback
      const textarea = document.createElement('textarea');
      textarea.value = this.getErrorReport();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  handleResetApp = (): void => {
    trackEvent('error-boundary-reset');
    // Download script first if there is one
    this.handleDownloadScript();
    // Small delay to ensure download starts before clearing
    setTimeout(() => {
      // Clear all localStorage data
      localStorage.clear();
      // Reload the page
      window.location.reload();
    }, 100);
  };

  handleDownloadScript = (): void => {
    const script = localStorage.getItem('script');
    if (script) {
      const blob = new Blob([script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MyScript.yarn';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  hasScriptInStorage = (): boolean => {
    const script = localStorage.getItem('script');
    return script !== null && script.trim().length > 0;
  };

  isDarkMode = (): boolean => {
    return localStorage.getItem('darkMode') === 'true';
  };

  getIssueUrl = (): string => {
    const { error, errorInfo, resolvedStack } = this.state;
    // Truncate stack trace to avoid URL length limits (GitHub max ~8000 chars)
    const rawStack = resolvedStack || error?.stack || 'No stack trace available';
    const stackTrace = rawStack.length > 2000 ? rawStack.substring(0, 2000) + '\n... (truncated)' : rawStack;
    const componentStack = errorInfo?.componentStack || 'No component stack available';
    const truncatedComponentStack = componentStack.length > 1000 ? componentStack.substring(0, 1000) + '\n... (truncated)' : componentStack;

    const errorDetails = [
      `Error: ${error?.message || 'Unknown error'}`,
      '',
      `Stack Trace${resolvedStack ? ' (source-mapped)' : ''}:`,
      stackTrace,
      '',
      'Component Stack:',
      truncatedComponentStack,
      '',
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');

    const body = `**What were you doing when the issue occurred?**

<!-- Please describe what you were doing. -->

**Please provide the steps to reproduce, and if possible a minimal demo of the problem**:

<!-- Please give us as much detail as you can, so that we can reproduce the issue. If possible, please consider uploading a demo project that demonstrates the problem. -->

**What is the expected behavior?**

<!-- What do you expect to see instead of what's happening now? -->

**Please tell us about your environment**

  - Operating System: ${navigator.platform}
  - Yarn Spinner Version: Try Yarn Spinner (Web)
  - Extension Version: N/A
  - Unity Version: N/A

**Other information**

<!-- For example, a detailed explanation, stacktraces, related issues, suggestions how to fix, links for us to have context, screenshots... -->

**Add tags**

**Error log**

\`\`\`
${errorDetails}
\`\`\`

<!-- Please tag this issue with the appropriate technology: Core (compiler/language), Unity, VSCode, etc. -->`;

    return `${ISSUE_TRACKER_BASE_URL}?body=${encodeURIComponent(body)}`;
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        // If fallback is a function, call it with error and errorInfo
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error!, this.state.errorInfo!);
        }
        // Otherwise return the fallback element as-is
        return this.props.fallback;
      }

      const { error, copied } = this.state;
      const darkMode = this.isDarkMode();

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto" style={{
          background: darkMode
            ? 'linear-gradient(135deg, #1a1518 0%, #2d2228 100%)'
            : 'linear-gradient(135deg, #FEF3F2 0%, #FEE4E2 100%)',
          WebkitOverflowScrolling: 'touch',
        }} role="alert" aria-live="assertive">
          {/* Background pattern - fewer on mobile */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none hidden sm:block" style={{
            opacity: darkMode ? 0.06 : 0.12
          }}>
            {[...Array(12)].map((_, i) => (
              <img
                key={i}
                src={YarnSpinnerLogoURL}
                alt=""
                style={{
                  position: 'absolute',
                  width: '96px',
                  height: 'auto',
                  left: `${(i % 4) * 30 + 5}%`,
                  top: `${Math.floor(i / 4) * 35 + 10}%`,
                  transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 15}deg)`,
                  filter: darkMode ? 'grayscale(100%)' : 'grayscale(100%) brightness(0.3)',
                }}
              />
            ))}
          </div>

          {/* Error card */}
          <div className="relative z-10 w-full max-w-lg sm:mx-4 my-auto">
            <div className="sm:rounded-2xl shadow-2xl overflow-hidden min-h-[100dvh] sm:min-h-0 flex flex-col sm:block" style={{
              backgroundColor: darkMode ? '#242124' : 'white',
              border: darkMode ? '1px solid #534952' : '1px solid #FEE4E2'
            }}>
              {/* Header */}
              <div className="px-4 py-5 sm:px-6 sm:py-8 text-center" style={{
                background: 'linear-gradient(90deg, #DC2626 0%, #EA580C 100%)'
              }}>
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)'
                }}>
                  <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h1 className="font-sans font-bold text-xl sm:text-2xl text-white mb-1 sm:mb-2">
                  Something went wrong
                </h1>
                <p className="text-white text-xs sm:text-sm" style={{ opacity: 0.9 }}>
                  Try Yarn Spinner encountered an unexpected error
                </p>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 flex-1 flex flex-col">
                {/* Error message */}
                <div className="rounded-lg p-3 sm:p-4" style={{
                  backgroundColor: darkMode ? '#3d2a2a' : '#FEF2F2',
                  border: darkMode ? '1px solid #5c3a3a' : '1px solid #FEE2E2'
                }}>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Bug className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" style={{ color: darkMode ? '#F87171' : '#DC2626' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs sm:text-sm break-words" style={{ color: darkMode ? '#FCA5A5' : '#991B1B' }}>
                        {error?.message || 'Unknown error'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary actions */}
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={this.handleReload}
                    className="flex-1 gap-2 text-white px-3 sm:px-4 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center shadow-sm hover:shadow"
                    style={{
                      backgroundColor: '#4C8962'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5C9A72'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4C8962'}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reload
                  </button>
                  <button
                    onClick={this.handleCopyError}
                    className="gap-2 px-3 sm:px-4 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center shadow-sm hover:shadow"
                    style={{
                      backgroundColor: darkMode ? '#3F3A40' : '#FFFFFF',
                      border: darkMode ? '1px solid #534952' : '1px solid #E5E7EB',
                      color: darkMode ? '#F9F7F9' : '#374151'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#534952' : '#F9FAFB'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#3F3A40' : '#FFFFFF'}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                {/* Reset app - downloads script first, then resets */}
                <button
                  onClick={this.handleResetApp}
                  className="w-full gap-2 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center shadow-sm hover:shadow"
                  style={{
                    backgroundColor: '#DC2626'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
                >
                  <Trash2 className="w-4 h-4" />
                  Download Script & Reset
                </button>

                {/* Secondary actions */}
                <div className="flex gap-2 justify-center mt-auto pt-2">
                  <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('error-boundary-discord')}
                  >
                    <button
                      className="gap-1.5 text-xs px-3 py-1.5 rounded transition-colors flex items-center"
                      style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = darkMode ? '#3F3A40' : '#F3F4F6';
                        e.currentTarget.style.color = darkMode ? '#F9F7F9' : '#111827';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = darkMode ? '#9CA3AF' : '#6B7280';
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Discord
                    </button>
                  </a>
                  <a
                    href={this.getIssueUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('error-boundary-report-issue')}
                  >
                    <button
                      className="gap-1.5 text-xs px-3 py-1.5 rounded transition-colors flex items-center"
                      style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = darkMode ? '#3F3A40' : '#F3F4F6';
                        e.currentTarget.style.color = darkMode ? '#F9F7F9' : '#111827';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = darkMode ? '#9CA3AF' : '#6B7280';
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Report Issue
                    </button>
                  </a>
                </div>

                {/* Help text */}
                <p className="text-center text-xs pb-safe" style={{ color: darkMode ? '#6B7280' : '#9CA3AF' }}>
                  Your work is saved in your browser's local storage.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
