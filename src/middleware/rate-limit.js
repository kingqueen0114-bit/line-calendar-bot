/**
 * レート制限ミドルウェア
 * Cloud Run のメモリ内 Map を使用（KV不要）
 */

const attempts = new Map();

// 定期的にクリーンアップ（メモリリーク回避）
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attempts.entries()) {
        if (now > record.resetAt + 60000) {
            attempts.delete(key);
        }
    }
}, 60000);

/**
 * レート制限ミドルウェア
 * @param {object} options
 * @param {number} options.windowMs - 時間ウィンドウ（ミリ秒、デフォルト60秒）
 * @param {number} options.max - ウィンドウ内の最大リクエスト数（デフォルト60）
 * @param {function} options.keyFn - レートキーを生成する関数（デフォルト: userId ベース）
 */
export function rateLimit({ windowMs = 60000, max = 60, keyFn = null } = {}) {
    return (req, res, next) => {
        const key = keyFn
            ? keyFn(req)
            : (req.query.userId || req.body?.userId || req.ip || 'anonymous');

        const now = Date.now();
        let record = attempts.get(key);

        if (!record || now > record.resetAt) {
            record = { count: 0, resetAt: now + windowMs };
        }

        record.count++;
        attempts.set(key, record);

        // レート制限ヘッダーを設定
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
        res.set('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

        if (record.count > max) {
            return res.status(429).json({
                error: 'リクエスト数が上限を超えました。しばらく待ってから再試行してください。'
            });
        }

        next();
    };
}

/**
 * 招待コード用の厳しいレート制限（ブルートフォース防止）
 * 1ユーザーあたり60秒で5回まで
 */
export const inviteCodeRateLimit = rateLimit({
    windowMs: 60000,
    max: 5,
    keyFn: (req) => `invite:${req.body?.userId || req.ip}`
});

/**
 * API全体用のグローバルレート制限
 * 1ユーザーあたり60秒で60回まで
 */
export const apiRateLimit = rateLimit({
    windowMs: 60000,
    max: 60,
    keyFn: (req) => `api:${req.query.userId || req.body?.userId || req.ip}`
});
