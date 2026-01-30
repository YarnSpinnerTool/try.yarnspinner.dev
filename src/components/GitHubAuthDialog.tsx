import { useState } from 'react';
import { getAuthState, type GitHubAuthState } from '../utility/githubAuth';
import { ExternalLink, Github } from 'lucide-react';

interface GitHubAuthDialogProps {
  onClose: () => void;
  onAuthenticated: (state: GitHubAuthState) => void;
}

export function GitHubAuthDialog({ onClose, onAuthenticated }: GitHubAuthDialogProps) {
  const [step, setStep] = useState<'initial' | 'token-input' | 'validating' | 'success' | 'error'>('initial');
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) {
      setError('Please enter a token');
      return;
    }

    try {
      setStep('validating');
      setError('');

      // Save and validate token
      localStorage.setItem('github_access_token', tokenInput.trim());

      const authState = await getAuthState();

      if (!authState.isAuthenticated) {
        throw new Error('Invalid token');
      }

      setStep('success');
      setTimeout(() => {
        onAuthenticated(authState);
        onClose();
      }, 1500);
    } catch (err) {
      localStorage.removeItem('github_access_token');
      setError(err instanceof Error ? err.message : 'Invalid token');
      setStep('token-input');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 bg-white dark:bg-[#242124] rounded-2xl shadow-2xl overflow-hidden border border-[#E5E1E6] dark:border-[#534952]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E1E6] dark:border-[#534952] bg-[#F9F7F9] dark:bg-[#312A35]">
          <div className="flex items-center gap-3">
            <Github className="h-6 w-6 text-[#2D1F30] dark:text-[#E0D8E2]" />
            <div>
              <h2 className="font-sans font-bold text-lg text-[#2D1F30] dark:text-[#E0D8E2]">
                Connect GitHub
              </h2>
              <p className="text-sm mt-0.5 text-[#7A6F7D] dark:text-[#B8A8BB]">
                Save and load your Yarn scripts as gists
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'initial' && (
            <div className="space-y-4">
              <p className="text-sm text-[#2D1F30] dark:text-[#E0D8E2]">
                Connecting your GitHub account allows you to:
              </p>
              <ul className="text-sm text-[#7A6F7D] dark:text-[#B8A8BB] space-y-2 ml-4">
                <li>• Save scripts as GitHub gists</li>
                <li>• Load your existing gists</li>
                <li>• Share scripts with others</li>
                <li>• Keep your work backed up</li>
              </ul>
              <div className="mt-4 p-3 bg-[#F9F7F9] dark:bg-[#312A35] rounded-lg border border-[#E5E1E6] dark:border-[#534952]">
                <p className="text-xs font-medium text-[#2D1F30] dark:text-[#E0D8E2] mb-2">
                  How it works:
                </p>
                <ol className="text-xs text-[#7A6F7D] dark:text-[#B8A8BB] space-y-1.5 ml-4">
                  <li>1. Create a Personal Access Token on GitHub</li>
                  <li>2. Give it "gist" permission only</li>
                  <li>3. Paste the token here</li>
                </ol>
              </div>
              <p className="text-xs text-[#7A6F7D] dark:text-[#B8A8BB]">
                Your token is stored securely in your browser only. We never see it.
              </p>
            </div>
          )}

          {step === 'token-input' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#2D1F30] dark:text-[#E0D8E2]">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTokenSubmit()}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E1E6] dark:border-[#534952] bg-white dark:bg-[#312A35] text-[#2D1F30] dark:text-[#E0D8E2] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4C8962]"
                  autoFocus
                />
                <p className="text-xs text-[#7A6F7D] dark:text-[#B8A8BB]">
                  Paste your token here. It will be stored locally in your browser.
                </p>
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>
          )}

          {step === 'validating' && (
            <div className="text-center py-6">
              <div className="animate-spin h-8 w-8 border-4 border-[#4C8962] border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-[#7A6F7D] dark:text-[#B8A8BB] mt-4">
                Validating token...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-[#2D1F30] dark:text-[#E0D8E2]">
                Successfully connected!
              </p>
              <p className="text-sm text-[#7A6F7D] dark:text-[#B8A8BB] mt-2">
                You can now save and load gists
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E1E6] dark:border-[#534952] bg-[#F9F7F9] dark:bg-[#312A35]">
          {step === 'initial' && (
            <div className="flex justify-between gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952]"
              >
                Cancel
              </button>
              <a
                href="https://github.com/settings/tokens/new?description=Try%20Yarn%20Spinner&scopes=gist"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setStep('token-input')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-[#4C8962] hover:bg-[#5C9A72] text-white"
              >
                Create Token on GitHub
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}
          {step === 'token-input' && (
            <div className="flex justify-between gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952]"
              >
                Cancel
              </button>
              <button
                onClick={handleTokenSubmit}
                disabled={!tokenInput.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-[#4C8962] hover:bg-[#5C9A72] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface GitHubStatusProps {
  authState: GitHubAuthState | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function GitHubStatus({ authState, onLogin, onLogout }: GitHubStatusProps) {
  if (!authState?.isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#242124] border border-[#4C8962]/20 dark:border-[#7DBD91]/20">
      <Github className="h-4 w-4 text-[#4C8962] dark:text-[#7DBD91]" />
      <span className="text-[#2D1F30] dark:text-[#E0D8E2] font-medium">
        {authState.username || 'Connected'}
      </span>
    </div>
  );
}
