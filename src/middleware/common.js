/**
 * Common Middleware - 共通ミドルウェア
 */
import { env } from '../env-adapter.js';
import { isUserAuthenticated } from '../oauth.js';

/**
 * CORS設定を適用（統一版）
 */
export function setCors(req, res, next) {
  const ALLOWED_ORIGINS = [
    'https://liff.line.me',
    'https://line-calendar-bot-67385363897.asia-northeast1.run.app'
  ];

  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  } else {
    // LIFFからの直接アクセス用
    res.set('Access-Control-Allow-Origin', '*');
  }

  if (next) next();
}

/**
 * 環境変数をリクエストに注入
 */
export function injectEnv(req, res, next) {
  req.env = env;
  next();
}

/**
 * userId 必須チェック
 */
export function requireUserId(req, res, next) {
  const userId = req.query.userId || req.body?.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  req.userId = userId;
  next();
}

/**
 * 認証必須チェック
 */
export async function requireAuth(req, res, next) {
  const userId = req.userId || req.query.userId || req.body?.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const authenticated = await isUserAuthenticated(userId, env);
    if (!authenticated) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.userId = userId;
    next();
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * 管理者必須チェック
 */
export function requireAdmin(req, res, next) {
  const userId = req.userId || req.query.userId || req.body?.userId;
  const adminUserId = env.ADMIN_USER_ID;

  if (!adminUserId || userId !== adminUserId) {
    return res.status(403).json({ error: 'Admin access only' });
  }

  next();
}

/**
 * 非同期ハンドラーラッパー（エラーハンドリング統一）
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default {
  setCors,
  injectEnv,
  requireUserId,
  requireAuth,
  requireAdmin,
  asyncHandler
};
