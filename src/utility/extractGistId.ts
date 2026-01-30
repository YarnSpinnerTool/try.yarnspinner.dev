/**
 * Extracts a Gist ID from a URL or returns the ID if it's already just an ID
 * Supports formats like:
 * - https://gist.github.com/username/abc123
 * - gist.github.com/username/abc123
 * - abc123
 */
export function extractGistId(input: string): string {
  const trimmed = input.trim();

  // If it looks like a URL, try to extract the ID
  if (trimmed.includes('gist.github.com') || trimmed.includes('://')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const parts = url.pathname.split('/').filter(p => p.length > 0);
      // Last part should be the gist ID
      return parts[parts.length - 1];
    } catch {
      // If URL parsing fails, try to extract from string
      const match = trimmed.match(/gist\.github\.com\/[^\/]+\/([a-zA-Z0-9]+)/);
      if (match) {
        return match[1];
      }
    }
  }

  // Otherwise assume it's already a gist ID
  return trimmed;
}
