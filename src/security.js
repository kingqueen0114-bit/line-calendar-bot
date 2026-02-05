/**
 * Security Middleware - Rate Limiting & Security Headers
 */

// インメモリレート制限ストア（Cloud Run インスタンス単位）
const rateLimitStore = new Map();

// レート制限設定
const RATE_LIMITS = {
  // 一般API: 100リクエスト/分
  api: { windowMs: 60 * 1000, max: 100 },
  // Webhook: 200リクエスト/分
  webhook: { windowMs: 60 * 1000, max: 200 },
  // 認証: 10リクエスト/分
  auth: { windowMs: 60 * 1000, max: 10 },
  // LIFF: 50リクエスト/分
  liff: { windowMs: 60 * 1000, max: 50 }
};

// 古いエントリをクリーンアップ（5分ごと）
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > 5 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * レート制限ミドルウェア
 */
export function rateLimit(type = 'api') {
  const config = RATE_LIMITS[type] || RATE_LIMITS.api;

  return (req, res, next) => {
    // IPアドレス取得（Cloud Run / プロキシ対応）
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.ip
      || req.connection.remoteAddress
      || 'unknown';

    const key = `${type}:${ip}`;
    const now = Date.now();

    let data = rateLimitStore.get(key);

    if (!data || now - data.windowStart > config.windowMs) {
      // 新しいウィンドウを開始
      data = { count: 1, windowStart: now };
      rateLimitStore.set(key, data);
    } else {
      data.count++;
    }

    // レート制限ヘッダーを設定
    res.set({
      'X-RateLimit-Limit': config.max.toString(),
      'X-RateLimit-Remaining': Math.max(0, config.max - data.count).toString(),
      'X-RateLimit-Reset': Math.ceil((data.windowStart + config.windowMs) / 1000).toString()
    });

    if (data.count > config.max) {
      console.warn(`Rate limit exceeded: ${key}, count: ${data.count}`);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'レート制限を超えました。しばらくしてから再試行してください。',
        retryAfter: Math.ceil((data.windowStart + config.windowMs - now) / 1000)
      });
    }

    next();
  };
}

/**
 * セキュリティヘッダーミドルウェア
 */
export function securityHeaders() {
  return (req, res, next) => {
    // XSS保護
    res.set('X-XSS-Protection', '1; mode=block');

    // コンテンツタイプスニッフィング防止
    res.set('X-Content-Type-Options', 'nosniff');

    // クリックジャッキング防止（LIFFページ以外）
    if (!req.path.startsWith('/liff')) {
      res.set('X-Frame-Options', 'DENY');
    }

    // Referrerポリシー
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy (CSP)
    if (req.path.startsWith('/liff')) {
      // LIFFページ用CSP（LINE SDK許可）
      res.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.line.me https://liff.line.me https://*.line-scdn.net",
        "frame-ancestors https://liff.line.me https://line.me"
      ].join('; '));
    } else {
      // 通常ページ用CSP
      res.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "frame-ancestors 'none'"
      ].join('; '));
    }

    // Strict Transport Security (HTTPS強制)
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Permissions Policy
    res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  };
}

/**
 * CORS設定ミドルウェア
 */
export function corsHandler() {
  const ALLOWED_ORIGINS = [
    'https://liff.line.me',
    'https://line-calendar-bot-67385363897.asia-northeast1.run.app',
    'https://line-calendar-bot-staging-67385363897.asia-northeast1.run.app'
  ];

  return (req, res, next) => {
    const origin = req.headers.origin;

    // OPTIONSリクエスト（プリフライト）
    if (req.method === 'OPTIONS') {
      if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o) || o === '*')) {
        res.set({
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
          'Access-Control-Allow-Credentials': 'true'
        });
      }
      return res.status(204).end();
    }

    // 通常リクエスト
    if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o) || o === '*')) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
    }

    next();
  };
}

/**
 * リクエストログミドルウェア
 */
export function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

      // 異常なリクエストのみログ
      if (res.statusCode >= 400 || duration > 5000) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: duration,
          ip: ip,
          userAgent: req.headers['user-agent']?.substring(0, 100)
        }));
      }
    });

    next();
  };
}

/**
 * 入力サニタイズ（XSS対策）
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * SQLインジェクション対策（パターン検出）
 */
export function detectSqlInjection(input) {
  if (typeof input !== 'string') return false;
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/i,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    /(--|;|\/\*|\*\/)/
  ];
  return patterns.some(p => p.test(input));
}

/**
 * 入力検証ミドルウェア
 */
export function validateInput() {
  return (req, res, next) => {
    // POSTボディをチェック
    if (req.body && typeof req.body === 'object') {
      const checkValue = (value, path) => {
        if (typeof value === 'string' && detectSqlInjection(value)) {
          console.warn(`Potential SQL injection detected at ${path}: ${value.substring(0, 50)}`);
          return true;
        }
        return false;
      };

      const checkObject = (obj, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (checkValue(value, currentPath)) {
            return true;
          }
          if (value && typeof value === 'object') {
            if (checkObject(value, currentPath)) return true;
          }
        }
        return false;
      };

      if (checkObject(req.body)) {
        return res.status(400).json({ error: 'Invalid input detected' });
      }
    }

    next();
  };
}

export default {
  rateLimit,
  securityHeaders,
  corsHandler,
  requestLogger,
  sanitizeInput,
  detectSqlInjection,
  validateInput
};
