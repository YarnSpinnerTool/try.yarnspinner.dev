import { useState, useEffect } from 'react';
import { listGists, type GitHubAuthState } from '../utility/githubAuth';
import { X, ExternalLink, FileText, Clock } from 'lucide-react';

interface GistBrowserProps {
  onClose: () => void;
  onLoadGist: (gistId: string, filename: string) => void;
  authState: GitHubAuthState;
}

interface GistFile {
  filename: string;
  language: string | null;
}

interface Gist {
  id: string;
  description: string;
  html_url: string;
  files: Record<string, GistFile>;
  created_at: string;
  updated_at: string;
}

export function GistBrowser({ onClose, onLoadGist, authState }: GistBrowserProps) {
  const [gists, setGists] = useState<Gist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGists();
  }, []);

  const loadGists = async () => {
    if (!authState.token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const userGists = await listGists(authState.token);

      // Filter to only gists that contain .yarn files
      const yarnGists = userGists.filter(gist => {
        return Object.values(gist.files).some(file =>
          file.filename.endsWith('.yarn')
        );
      });

      setGists(yarnGists);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gists');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 max-h-[80vh] bg-white dark:bg-[#242124] rounded-2xl shadow-2xl overflow-hidden border border-[#E5E1E6] dark:border-[#534952] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E1E6] dark:border-[#534952] bg-[#F9F7F9] dark:bg-[#312A35] flex items-center justify-between">
          <div>
            <h2 className="font-sans font-bold text-lg text-[#2D1F30] dark:text-[#E0D8E2]">
              Your Yarn Spinner Gists
            </h2>
            <p className="text-sm mt-0.5 text-[#7A6F7D] dark:text-[#B8A8BB]">
              {authState.username ? `@${authState.username}` : 'GitHub Gists'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-[#4C8962] border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-[#7A6F7D] dark:text-[#B8A8BB] mt-4">
                Loading your gists...
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={loadGists}
                className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && gists.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-[#7A6F7D] dark:text-[#B8A8BB] mx-auto mb-4" />
              <p className="text-base font-medium text-[#2D1F30] dark:text-[#E0D8E2] mb-2">
                No Yarn Spinner gists found
              </p>
              <p className="text-sm text-[#7A6F7D] dark:text-[#B8A8BB]">
                Save your first script using File → GitHub → Save to Gist
              </p>
            </div>
          )}

          {!loading && !error && gists.length > 0 && (
            <div className="space-y-3">
              {gists.map((gist) => {
                const yarnFiles = Object.values(gist.files).filter(f =>
                  f.filename.endsWith('.yarn')
                );

                return (
                  <div
                    key={gist.id}
                    className="border border-[#E5E1E6] dark:border-[#534952] rounded-lg p-4 hover:bg-[#F9F7F9] dark:hover:bg-[#312A35] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[#2D1F30] dark:text-[#E0D8E2] truncate">
                          {gist.description || 'Untitled Gist'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[#7A6F7D] dark:text-[#B8A8BB]">
                          <Clock className="h-3 w-3" />
                          <span>Updated {formatDate(gist.updated_at)}</span>
                        </div>
                      </div>
                      <a
                        href={gist.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 p-2 rounded-lg text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <div className="space-y-2">
                      {yarnFiles.map((file) => (
                        <button
                          key={file.filename}
                          onClick={() => {
                            onLoadGist(gist.id, file.filename);
                            onClose();
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg bg-[#F9F7F9] dark:bg-[#312A35] hover:bg-[#4C8962] hover:text-white dark:hover:bg-[#5C9A72] transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[#4C8962] group-hover:text-white" />
                            <span className="text-sm font-mono text-[#2D1F30] dark:text-[#E0D8E2] group-hover:text-white">
                              {file.filename}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E1E6] dark:border-[#534952] bg-[#F9F7F9] dark:bg-[#312A35]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors text-[#7A6F7D] dark:text-[#B8A8BB] hover:bg-[#F0EEF1] dark:hover:bg-[#534952]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
