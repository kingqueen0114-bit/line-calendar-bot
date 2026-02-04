/**
 * OAuth 2.0 Flow Management for Multi-User Authentication
 * Manages per-user Google OAuth tokens with automatic refresh
 */

// State parameter validity period (10 minutes)
const STATE_EXPIRATION = 600;

// Required OAuth scopes
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks'
];

/**
 * Generate OAuth authorization URL for a user
 * @param {string} userId - LINE user ID
 * @param {Object} env - Environment variables
 * @returns {string} Authorization URL
 */
export function getAuthorizationUrl(userId, env) {
  // Generate random state parameter for CSRF protection
  const state = generateRandomState();

  // Store state with user ID for verification (expires in 10 minutes)
  // Note: This returns a promise, but we handle it asynchronously
  env.NOTIFICATIONS.put(
    `oauth_state:${state}`,
    JSON.stringify({
      userId: userId,
      timestamp: Date.now()
    }),
    { expirationTtl: STATE_EXPIRATION }
  );

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: OAUTH_SCOPES.join(' '),
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Force consent screen to get refresh token
    state: state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Handle OAuth callback and exchange code for tokens
 * @param {string} code - Authorization code
 * @param {string} state - State parameter
 * @param {Object} env - Environment variables
 * @throws {Error} If state is invalid or token exchange fails
 */
export async function handleOAuthCallback(code, state, env) {
  // Verify state parameter
  const stateKey = `oauth_state:${state}`;
  const stateData = await env.NOTIFICATIONS.get(stateKey, { type: 'json' });

  if (!stateData) {
    throw new Error('Invalid or expired state parameter');
  }

  const { userId, timestamp } = stateData;

  // Delete state after verification (one-time use)
  await env.NOTIFICATIONS.delete(stateKey);

  // Check state age (extra security)
  if (Date.now() - timestamp > STATE_EXPIRATION * 1000) {
    throw new Error('State parameter expired');
  }

  // Exchange authorization code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = await tokenResponse.json();

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Missing tokens in response');
  }

  // Calculate expiration timestamp
  const expiresAt = Date.now() + (tokens.expires_in * 1000);

  // Store tokens for user
  const userTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: expiresAt,
    scope: tokens.scope
  };

  await env.NOTIFICATIONS.put(
    `user_tokens:${userId}`,
    JSON.stringify(userTokens)
  );

  // Add user to authenticated users list
  await addAuthenticatedUser(userId, env);

  console.log('OAuth completed for user:', userId);
}

/**
 * Refresh access token for a user
 * @param {string} userId - LINE user ID
 * @param {Object} env - Environment variables
 * @returns {string} New access token
 * @throws {Error} If refresh fails
 */
export async function refreshUserAccessToken(userId, env) {
  const tokens = await env.NOTIFICATIONS.get(`user_tokens:${userId}`, { type: 'json' });

  if (!tokens || !tokens.refreshToken) {
    throw new Error('No refresh token found for user');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Missing access token in refresh response');
  }

  // Update stored tokens with new access token
  const expiresAt = Date.now() + (data.expires_in * 1000);
  tokens.accessToken = data.access_token;
  tokens.expiresAt = expiresAt;

  // If refresh token is rotated, update it
  if (data.refresh_token) {
    tokens.refreshToken = data.refresh_token;
  }

  await env.NOTIFICATIONS.put(
    `user_tokens:${userId}`,
    JSON.stringify(tokens)
  );

  console.log('Token refreshed for user:', userId);
  return data.access_token;
}

/**
 * Get valid access token for user (auto-refresh if expired)
 * @param {string} userId - LINE user ID
 * @param {Object} env - Environment variables
 * @returns {string} Valid access token
 * @throws {Error} If no tokens or refresh fails
 */
export async function getUserAccessToken(userId, env) {
  const tokens = await env.NOTIFICATIONS.get(`user_tokens:${userId}`, { type: 'json' });

  if (!tokens) {
    throw new Error('User not authenticated');
  }

  // Check if token is expired or will expire soon (5 minute buffer)
  const expirationBuffer = 5 * 60 * 1000;
  if (Date.now() >= tokens.expiresAt - expirationBuffer) {
    console.log('Token expired or expiring soon, refreshing...');
    return await refreshUserAccessToken(userId, env);
  }

  return tokens.accessToken;
}

/**
 * Revoke user tokens (logout)
 * @param {string} userId - LINE user ID
 * @param {Object} env - Environment variables
 */
export async function revokeUserTokens(userId, env) {
  const tokens = await env.NOTIFICATIONS.get(`user_tokens:${userId}`, { type: 'json' });

  if (tokens && tokens.accessToken) {
    // Revoke token with Google
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.accessToken}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Token revocation error:', error);
      // Continue with deletion even if revocation fails
    }
  }

  // Delete stored tokens
  await env.NOTIFICATIONS.delete(`user_tokens:${userId}`);

  // Remove from authenticated users list
  await removeAuthenticatedUser(userId, env);

  console.log('Tokens revoked for user:', userId);
}

/**
 * Add user to authenticated users list
 * @param {string} userId - LINE user ID
 * @param {Object} env - Environment variables
 */
async function addAuthenticatedUser(userId, env) {
  let users = await env.NOTIFICATIONS.get('authenticated_users', { type: 'json' }) || [];

  if (!users.includes(userId)) {
    users.push(userId);
    await env.NOTIFICATIONS.put('authenticated_users', JSON.stringify(users));
    console.log('User added to authenticated list:', userId);
  }
}

/**
 * Remove user from authenticated users list
 * @param {string} userId - LINE user ID
 * @param {Object} env - Environment variables
 */
async function removeAuthenticatedUser(userId, env) {
  let users = await env.NOTIFICATIONS.get('authenticated_users', { type: 'json' }) || [];

  users = users.filter(id => id !== userId);
  await env.NOTIFICATIONS.put('authenticated_users', JSON.stringify(users));
  console.log('User removed from authenticated list:', userId);
}

/**
 * Generate random state parameter for CSRF protection
 * @returns {string} Random state string
 */
function generateRandomState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if user is authenticated
 * @param {string} userId - LINE user ID
 * @param {Object} env - Environment variables
 * @returns {boolean} True if user has valid tokens
 */
export async function isUserAuthenticated(userId, env) {
  const key = `user_tokens:${userId}`;
  console.log('isUserAuthenticated: checking key:', key);
  const tokens = await env.NOTIFICATIONS.get(key, { type: 'json' });
  console.log('isUserAuthenticated: tokens found:', tokens !== null, 'has refreshToken:', tokens?.refreshToken !== undefined);
  return tokens !== null && tokens.refreshToken !== undefined;
}
