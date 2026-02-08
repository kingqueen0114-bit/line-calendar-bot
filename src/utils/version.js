/**
 * アプリバージョン管理ユーティリティ
 * キャッシュバスティングとバージョン管理のための統一的な仕組み
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// package.jsonからバージョンを読み込む
function getPackageVersion() {
  try {
    const packagePath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (err) {
    console.error('Failed to read package.json version:', err);
    return '1.0.0';
  }
}

// Gitコミットハッシュを取得（利用可能な場合）
function getGitHash() {
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // stderrを無視
    }).trim();
    return hash;
  } catch (err) {
    // Gitが利用できない場合はnullを返す
    return null;
  }
}

// サーバー起動時のタイムスタンプ（固定値）
const SERVER_START_TIME = Date.now().toString(36);

// ビルドタイムスタンプを生成
function getBuildTimestamp() {
  // 環境変数からビルド時刻を取得（Cloud Buildで設定可能）
  if (process.env.BUILD_TIMESTAMP) {
    return process.env.BUILD_TIMESTAMP;
  }

  // サーバー起動時刻を使用（リクエストごとに変わらない固定値）
  return SERVER_START_TIME;
}

// コンテンツハッシュを生成
function generateContentHash(content) {
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex')
    .slice(0, 8);
}

// 統合バージョン文字列を生成
function getAppVersion() {
  const version = getPackageVersion();
  const gitHash = getGitHash();
  const buildTime = getBuildTimestamp();

  if (gitHash) {
    return `${version}-${gitHash}`;
  }

  return `${version}-${buildTime}`;
}

// キャッシュバスティング用のクエリパラメータを生成
function getCacheBuster() {
  return getAppVersion().replace(/\./g, '_');
}

// バージョン情報オブジェクトを取得
function getVersionInfo() {
  return {
    version: getPackageVersion(),
    gitHash: getGitHash(),
    buildTime: getBuildTimestamp(),
    fullVersion: getAppVersion(),
    cacheBuster: getCacheBuster()
  };
}

export {
  getPackageVersion,
  getGitHash,
  getBuildTimestamp,
  generateContentHash,
  getAppVersion,
  getCacheBuster,
  getVersionInfo
};
