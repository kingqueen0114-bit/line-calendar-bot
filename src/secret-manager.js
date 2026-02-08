/**
 * Secret Manager Helper
 * Google Cloud Secret Managerからシークレットを取得する
 */
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// シークレットのキャッシュ（再取得を避けるため）
const secretCache = new Map();

/**
 * Secret Managerからシークレットを取得
 * @param {string} secretName - シークレット名（例: "LINE_CHANNEL_ACCESS_TOKEN"）
 * @param {string} projectId - GCPプロジェクトID
 * @param {string} version - シークレットのバージョン（デフォルト: "latest"）
 * @returns {Promise<string>} シークレットの値
 */
export async function getSecret(secretName, projectId, version = 'latest') {
  // キャッシュをチェック
  const cacheKey = `${projectId}/${secretName}/${version}`;
  if (secretCache.has(cacheKey)) {
    return secretCache.get(cacheKey);
  }

  try {
    const client = new SecretManagerServiceClient();
    const name = `projects/${projectId}/secrets/${secretName}/versions/${version}`;

    const [response] = await client.accessSecretVersion({ name });
    const secretValue = response.payload.data.toString('utf8');

    // キャッシュに保存
    secretCache.set(cacheKey, secretValue);

    return secretValue;
  } catch (error) {
    console.error(`Failed to get secret ${secretName}:`, error.message);
    // 環境変数にフォールバック
    return process.env[secretName] || '';
  }
}

/**
 * 複数のシークレットを一度に取得
 * @param {string[]} secretNames - シークレット名の配列
 * @param {string} projectId - GCPプロジェクトID
 * @returns {Promise<Object>} シークレット名と値のマップ
 */
export async function getSecrets(secretNames, projectId) {
  const secrets = {};

  await Promise.all(
    secretNames.map(async (name) => {
      secrets[name] = await getSecret(name, projectId);
    })
  );

  return secrets;
}

/**
 * 必要なすべてのシークレットを取得してprocess.envに設定
 * @param {string} projectId - GCPプロジェクトID
 */
export async function loadSecretsToEnv(projectId) {
  if (!projectId) {
    console.warn('Project ID not provided, skipping Secret Manager');
    return;
  }

  const secretNames = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'OAUTH_REDIRECT_URI',
    'GEMINI_API_KEY',
    'LIFF_ID',
    'ADMIN_USER_ID'
  ];

  console.log('Loading secrets from Secret Manager...');

  const secrets = await getSecrets(secretNames, projectId);

  // 環境変数に設定（既存の値を上書きしない）
  for (const [name, value] of Object.entries(secrets)) {
    if (value && !process.env[name]) {
      process.env[name] = value;
    }
  }

  console.log(`✓ Loaded ${Object.keys(secrets).length} secrets from Secret Manager`);
}

/**
 * キャッシュをクリア（主にテスト用）
 */
export function clearCache() {
  secretCache.clear();
}
