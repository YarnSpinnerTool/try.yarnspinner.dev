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
import { AlertTriangle, RotateCcw, Bug, Copy, Check, MessageCircle, ExternalLink } from 'lucide-react';
import { YarnSpinnerLogoURL } from '../img';

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
}

// =============================================================================
// Constants
// =============================================================================

const ISSUE_TRACKER_URL = 'https://github.com/YarnSpinnerTool/IssuesDiscussion';
const DISCORD_URL = 'https://discord.com/invite/yarnspinner';

// =============================================================================
// Component
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorHandler?: (event: ErrorEvent) => void;
  private rejectionHandler?: (event: PromiseRejectionEvent) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  componentDidMount(): void {
    // Catch global uncaught errors
    this.errorHandler = (event: ErrorEvent) => {
      event.preventDefault();
      const error = event.error || new Error(event.message);
      console.error('[ErrorBoundary] Caught global error:', error);
      this.setState({
        hasError: true,
        error,
        errorInfo: { componentStack: `\nGlobal error at ${event.filename}:${event.lineno}:${event.colno}` } as React.ErrorInfo,
      });
    };

    // Catch unhandled promise rejections
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      event.preventDefault();

      let error: Error;
      if (event.reason instanceof Error) {
        error = event.reason;
      } else if (typeof event.reason === 'string') {
        error = new Error(event.reason);
      } else if (event.reason && typeof event.reason === 'object') {
        // Try to extract a message from the object
        const message = event.reason.message || event.reason.toString() || 'Unknown error';
        error = new Error(message);
      } else {
        error = new Error('Unknown promise rejection');
      }

      console.error('[ErrorBoundary] Caught unhandled promise rejection:', error);
      this.setState({
        hasError: true,
        error,
        errorInfo: { componentStack: '\nUnhandled promise rejection' } as React.ErrorInfo,
      });
    };

    window.addEventListener('error', this.errorHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  componentWillUnmount(): void {
    // Clean up event listeners
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  getErrorReport = (): string => {
    const { error, errorInfo } = this.state;
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
      'Stack Trace:',
      error?.stack || 'No stack trace available',
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

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{
          background: 'linear-gradient(135deg, #FEF3F2 0%, #FEE4E2 100%)'
        }} role="alert" aria-live="assertive">
          {/* Background pattern */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{
            opacity: 0.08
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
                  filter: 'grayscale(100%)',
                }}
              />
            ))}
          </div>

          {/* Error card */}
          <div className="relative z-10 w-full max-w-lg mx-4">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{
              border: '1px solid #FEE4E2'
            }}>
              {/* Header */}
              <div className="px-6 py-8 text-center" style={{
                background: 'linear-gradient(90deg, #DC2626 0%, #EA580C 100%)'
              }}>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)'
                }}>
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h1 className="font-sans font-bold text-2xl text-white mb-2">
                  Something went wrong
                </h1>
                <p className="text-white text-sm" style={{ opacity: 0.9 }}>
                  Try Yarn Spinner encountered an unexpected error
                </p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Error message */}
                <div className="rounded-lg p-4" style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FEE2E2'
                }}>
                  <div className="flex items-start gap-3">
                    <Bug className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm break-words" style={{ color: '#991B1B' }}>
                        {error?.message || 'Unknown error'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary actions */}
                <div className="flex gap-3">
                  <button
                    onClick={this.handleReload}
                    className="flex-1 gap-2 text-white px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center shadow-sm hover:shadow"
                    style={{
                      backgroundColor: '#4C8962'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5C9A72'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4C8962'}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reload Page
                  </button>
                  <button
                    onClick={this.handleCopyError}
                    className="gap-2 bg-white px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center shadow-sm hover:shadow"
                    style={{
                      border: '1px solid #E5E7EB',
                      color: '#374151'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Error
                      </>
                    )}
                  </button>
                </div>

                {/* Secondary actions */}
                <div className="flex gap-2 justify-center">
                  <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <button
                      className="gap-1.5 text-xs px-3 py-1.5 rounded transition-colors flex items-center"
                      style={{ color: '#6B7280' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F3F4F6';
                        e.currentTarget.style.color = '#111827';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#6B7280';
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Discord Community
                    </button>
                  </a>
                  <a
                    href={ISSUE_TRACKER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <button
                      className="gap-1.5 text-xs px-3 py-1.5 rounded transition-colors flex items-center"
                      style={{ color: '#6B7280' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F3F4F6';
                        e.currentTarget.style.color = '#111827';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#6B7280';
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Report Issue
                    </button>
                  </a>
                </div>

                {/* Help text */}
                <p className="text-center text-xs" style={{ color: '#9CA3AF' }}>
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
