/**
 * LIFF Routes - LIFFページ関連エンドポイント
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from '../env-adapter.js';
import { handleOAuthCallback } from '../oauth.js';
import { registerUserForNotifications } from '../app.js';
import { generateLiffHtml } from '../liff.js';
import { getAppVersion, getCacheBuster, getVersionInfo } from '../utils/version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// OAuth コールバック
router.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <html><head><meta charset="utf-8"></head><body>
      認証がキャンセルされました。LINEに戻って再度お試しください。
      <script>setTimeout(() => window.close(), 3000);</script>
      </body></html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send(`
      <html><head><meta charset="utf-8"></head><body>
      無効なリクエストです。
      </body></html>
    `);
  }

  try {
    await handleOAuthCallback(code, state, env);
    await registerUserForNotifications(state, env);

    res.send(`
      <html><head><meta charset="utf-8"></head><body>
      <h1>✅ 認証成功！</h1>
      <p>LINEに戻ってメッセージを送信してください。</p>
      <script>setTimeout(() => window.close(), 3000);</script>
      </body></html>
    `);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`
      <html><head><meta charset="utf-8"></head><body>
      <h1>⚠️ 認証失敗</h1>
      <p>${err.message}</p>
      <p>LINEに戻って再度お試しください。</p>
      </body></html>
    `);
  }
});

// LIFF アプリ
router.get('/liff', async (req, res) => {
  const liffId = (process.env.LIFF_ID || env.LIFF_ID || 'YOUR_LIFF_ID').trim();
  const apiBase = `https://${req.get('host')}`;
  const versionInfo = getVersionInfo();

  let html = generateLiffHtml(liffId, apiBase);

  // バージョン情報をHTMLに埋め込む
  html = html.replace('</head>', `
    <!-- App Version: ${versionInfo.fullVersion} -->
    <!-- Build Time: ${versionInfo.buildTime} -->
    <script>window.APP_VERSION = '${versionInfo.fullVersion}';</script>
    </head>`);

  // キャッシュ制御ヘッダー（短時間キャッシュ + ETag）
  res.set({
    'Cache-Control': 'public, max-age=300, must-revalidate', // 5分キャッシュ
    'ETag': `"${versionInfo.cacheBuster}"`,
    'X-App-Version': versionInfo.fullVersion
  });

  res.type('html').send(html);
});

// LIFF アプリ (キャッシュ回避用)
router.get('/liff2', async (req, res) => {
  const liffId = (process.env.LIFF_ID || env.LIFF_ID || 'YOUR_LIFF_ID').trim();
  const apiBase = `https://${req.get('host')}`;
  const versionInfo = getVersionInfo();

  let html = generateLiffHtml(liffId, apiBase);

  // バージョン情報をHTMLに埋め込む
  html = html.replace('</head>', `
    <!-- App Version: ${versionInfo.fullVersion} (no-cache) -->
    <script>window.APP_VERSION = '${versionInfo.fullVersion}';</script>
    </head>`);

  // 完全にキャッシュを無効化
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-App-Version': versionInfo.fullVersion
  });

  res.type('html').send(html);
});

// Claude Chat ページ
router.get('/claude-chat', async (req, res) => {
  const adminUserId = env.ADMIN_USER_ID || '';
  const filePath = path.join(__dirname, '..', '..', 'public', 'claude-chat.html');

  try {
    let html = fs.readFileSync(filePath, 'utf-8');
    html = html.replace('var adminUserId = null;', `var adminUserId = "${adminUserId}";`);
    html = html.replace("接続中...", "オンライン");

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Content-Type': 'text/html; charset=utf-8'
    });
    res.send(html);
  } catch (err) {
    console.error('Claude chat page error:', err);
    res.status(500).send('Page not found');
  }
});

// 診断ページ
router.get('/diagnostic', (req, res) => {
  const filePath = path.join(__dirname, '..', '..', 'public', 'diagnostic.html');
  try {
    let html = fs.readFileSync(filePath, 'utf-8');
    // LIFF_IDを実際の値に置き換え
    const liffId = (process.env.LIFF_ID || env.LIFF_ID || 'YOUR_LIFF_ID').trim();
    html = html.replace('2006593633-7jp4ogp0', liffId);

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'text/html; charset=utf-8'
    });
    res.send(html);
  } catch (err) {
    res.status(500).send('診断ページの読み込みに失敗しました');
  }
});

// ヘルスチェック
router.get('/', (req, res) => {
  res.send('LINE Calendar Bot is running');
});

export default router;
