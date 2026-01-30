/**
 * GitHub OAuth Device Flow - fully client-side authentication
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

const CLIENT_ID = 'Ov23liJmbNLXEzAg5ziu'; // Public OAuth app client ID for Try Yarn Spinner
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const TOKEN_STORAGE_KEY = 'github_access_token';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface GitHubAuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
}

/**
 * Step 1: Request a device code from GitHub
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  // Use form-encoded data to avoid CORS preflight issues
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: 'gist', // Only request gist permissions
  });

  const response = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error('Failed to request device code');
  }

  return await response.json();
}

/**
 * Step 2: Poll GitHub to check if user has authorized
 */
export async function pollForToken(
  deviceCode: string,
  interval: number,
  onProgress?: (status: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        onProgress?.('Checking authorization status...');

        // Use form-encoded data to avoid CORS preflight issues
        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        });

        const response = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
          },
          body: params,
        });

        const data: TokenResponse = await response.json();

        if (data.access_token) {
          clearInterval(poll);
          saveToken(data.access_token);
          resolve(data.access_token);
        } else if (data.error === 'authorization_pending') {
          // Still waiting for user to authorize
          onProgress?.('Waiting for authorization...');
        } else if (data.error === 'slow_down') {
          // GitHub is asking us to slow down polling
          clearInterval(poll);
          // Restart with longer interval
          setTimeout(() => {
            pollForToken(deviceCode, interval + 5, onProgress).then(resolve).catch(reject);
          }, (interval + 5) * 1000);
        } else if (data.error) {
          clearInterval(poll);
          reject(new Error(data.error_description || data.error));
        }
      } catch (error) {
        clearInterval(poll);
        reject(error);
      }
    }, interval * 1000);

    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(poll);
      reject(new Error('Authorization timeout'));
    }, 10 * 60 * 1000);
  });
}

/**
 * Save token to localStorage
 */
function saveToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/**
 * Get saved token from localStorage
 */
export function getSavedToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Remove saved token
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Check if token is valid by making a test API call
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(token: string): Promise<{ login: string; name: string | null }> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return await response.json();
}

/**
 * Get current auth state
 */
export async function getAuthState(): Promise<GitHubAuthState> {
  const token = getSavedToken();

  if (!token) {
    return { isAuthenticated: false, token: null, username: null };
  }

  // Validate token
  const isValid = await validateToken(token);
  if (!isValid) {
    clearToken();
    return { isAuthenticated: false, token: null, username: null };
  }

  // Get username
  try {
    const user = await getCurrentUser(token);
    return { isAuthenticated: true, token, username: user.login };
  } catch {
    return { isAuthenticated: true, token, username: null };
  }
}

/**
 * Create a new gist
 */
export async function createGist(
  token: string,
  filename: string,
  content: string,
  description: string = 'Yarn Spinner Script'
): Promise<{ id: string; html_url: string }> {
  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description,
      public: true,
      files: {
        [filename]: {
          content,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create gist');
  }

  return await response.json();
}

/**
 * Update an existing gist
 */
export async function updateGist(
  token: string,
  gistId: string,
  filename: string,
  content: string
): Promise<void> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [filename]: {
          content,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update gist');
  }
}

/**
 * List user's gists
 */
export async function listGists(token: string): Promise<Array<{
  id: string;
  description: string;
  html_url: string;
  files: Record<string, { filename: string; language: string | null }>;
  created_at: string;
  updated_at: string;
}>> {
  const response = await fetch('https://api.github.com/gists', {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to list gists');
  }

  return await response.json();
}
