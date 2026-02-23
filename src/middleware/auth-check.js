/**
 * 認証チェックミドルウェア
 * 全API（auth-status/auth-url以外）に適用
 */
import { env } from '../utils/env-adapter.js';

export async function requireAuth(req, res, next) {
    const userId = req.query.userId || req.body?.userId;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const tokens = await env.NOTIFICATIONS.get(`user_tokens:${userId}`, { type: 'json' });
        if (!tokens) {
            return res.status(401).json({ error: 'Not authenticated', authRequired: true });
        }

        req.userId = userId;
        req.tokens = tokens;
        next();
    } catch (error) {
        console.error('Auth check error:', error);
        return res.status(500).json({ error: 'Internal auth error' });
    }
}
