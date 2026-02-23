import express from 'express';
import { handleOAuthCallback, isUserAuthenticated, getAuthorizationUrl } from '../services/auth.service.js';
import { env } from '../utils/env-adapter.js';
import { registerUserForNotifications } from '../app.js';

const router = express.Router();

router.get('/callback', async (req, res) => {
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

    // 認証成功時にユーザーを通知リストに登録
    await registerUserForNotifications(state, env);

    res.send(`
      <html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: sans-serif; text-align: center; padding-top: 50px; background: #121212; color: #fff; }
        h1 { color: #4CAF50; }
      </style>
      </head><body>
      <h1>✅ 認証成功！</h1>
      <p>この画面を閉じて、LINEの画面に戻ってください。</p>
      <script>
        setTimeout(() => {
          window.close();
        }, 1500);
      </script>
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

export default router;
