/**
 * LINE Calendar Bot - Express Server for Google Cloud Run (v2 Architecture)
 */
import express from 'express';
import liffRoute from './routes/liff.route.js';
import authRoute from './routes/auth.route.js';
import apiRoute from './routes/api.route.js';
import ogpRoute from './routes/ogp.route.js';
import webhookRoute from './routes/webhook.route.js';
import { runScheduledTask } from './app.js';

import { apiRateLimit } from './middleware/rate-limit.js';

const app = express();
const PORT = process.env.PORT || 8080;

// JSONボディの解析（生のボディも保持、画像Base64用に50MBまで許可）
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// CORS
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ヘルスチェック
app.get('/', (req, res) => {
  res.send('LINE Calendar Bot is running');
});

// Routes
app.use('/liff', liffRoute);
app.use('/oauth', authRoute);
app.use('/auth/google', authRoute); // OAUTH_REDIRECT_URI 互換 (/auth/google/callback)
app.use('/api', apiRateLimit, apiRoute);
app.use('/api', apiRateLimit, ogpRoute);
app.use('/webhook', webhookRoute);

// LINE Webhook はルート(/)にもマウントしておく（互換性確保用）
app.use('/', webhookRoute);

// スケジュールタスク用エンドポイント（Cloud Scheduler から呼び出し）
app.post('/scheduled', async (req, res) => {
  console.log('Scheduled task triggered via POST');
  try {
    await runScheduledTask();
    console.log('Scheduled task completed successfully');
    res.sendStatus(200);
  } catch (err) {
    console.error('Scheduled task error:', err);
    res.status(500).send('Error');
  }
});

app.get('/scheduled', async (req, res) => {
  console.log('Scheduled task triggered via GET');
  try {
    await runScheduledTask();
    console.log('Scheduled task completed successfully');
    res.send('OK');
  } catch (err) {
    console.error('Scheduled task error:', err);
    res.status(500).send('Error');
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
