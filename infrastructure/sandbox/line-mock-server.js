/**
 * LINE Mock Server
 * LINEのWebhookをシミュレートするテストサーバー
 */
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 8082;

// ターゲットWebhook URL
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:8080/webhook';
const PROJECT_WEBHOOK_URL = process.env.PROJECT_WEBHOOK_URL || 'http://localhost:8081/webhook';

// モック用のシークレット
const MOCK_CHANNEL_SECRET = process.env.MOCK_CHANNEL_SECRET || 'mock-secret-key';

// メッセージログ
const messageLog = [];

app.use(express.json());
app.use(express.static('public'));

// 署名を生成
function generateSignature(body) {
  return crypto
    .createHmac('sha256', MOCK_CHANNEL_SECRET)
    .update(JSON.stringify(body))
    .digest('base64');
}

// テストユーザー
const testUsers = {
  'user-001': { displayName: 'テストユーザー1', pictureUrl: null },
  'user-002': { displayName: 'テストユーザー2', pictureUrl: null },
  'admin': { displayName: '管理者', pictureUrl: null }
};

// ホーム
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Webhookをシミュレート送信
app.post('/api/simulate', async (req, res) => {
  const { userId, message, target } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'userId and message are required' });
  }

  const webhookUrl = target === 'project' ? PROJECT_WEBHOOK_URL : WEBHOOK_URL;

  // LINEイベントを構築
  const event = {
    type: 'message',
    replyToken: `mock-reply-${Date.now()}`,
    source: {
      type: 'user',
      userId: userId
    },
    message: {
      type: 'text',
      id: `mock-msg-${Date.now()}`,
      text: message
    },
    timestamp: Date.now()
  };

  const body = { events: [event] };
  const signature = generateSignature(body);

  // ログに記録
  messageLog.unshift({
    timestamp: new Date().toISOString(),
    direction: 'outgoing',
    target: target || 'main',
    userId,
    message,
    event
  });

  // Webhookに送信
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature
      },
      body: JSON.stringify(body)
    });

    res.json({
      success: response.ok,
      status: response.status,
      webhookUrl
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// フォローイベントをシミュレート
app.post('/api/simulate/follow', async (req, res) => {
  const { userId, target } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const webhookUrl = target === 'project' ? PROJECT_WEBHOOK_URL : WEBHOOK_URL;

  const event = {
    type: 'follow',
    replyToken: `mock-reply-${Date.now()}`,
    source: {
      type: 'user',
      userId: userId
    },
    timestamp: Date.now()
  };

  const body = { events: [event] };
  const signature = generateSignature(body);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature
      },
      body: JSON.stringify(body)
    });

    res.json({ success: response.ok, status: response.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reply APIのモック（Botからの返信をキャプチャ）
app.post('/v2/bot/message/reply', (req, res) => {
  const { replyToken, messages } = req.body;

  messageLog.unshift({
    timestamp: new Date().toISOString(),
    direction: 'incoming',
    replyToken,
    messages
  });

  console.log('Bot Reply:', JSON.stringify(messages, null, 2));
  res.json({});
});

// Push APIのモック
app.post('/v2/bot/message/push', (req, res) => {
  const { to, messages } = req.body;

  messageLog.unshift({
    timestamp: new Date().toISOString(),
    direction: 'incoming',
    to,
    messages
  });

  console.log('Bot Push to', to, ':', JSON.stringify(messages, null, 2));
  res.json({});
});

// メッセージログ取得
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ logs: messageLog.slice(0, limit) });
});

// ログクリア
app.delete('/api/logs', (req, res) => {
  messageLog.length = 0;
  res.json({ success: true });
});

// テストユーザー一覧
app.get('/api/users', (req, res) => {
  res.json({ users: testUsers });
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LINE Mock Server',
    webhookUrl: WEBHOOK_URL,
    projectWebhookUrl: PROJECT_WEBHOOK_URL
  });
});

app.listen(PORT, () => {
  console.log(`LINE Mock Server running on port ${PORT}`);
  console.log(`Main Webhook: ${WEBHOOK_URL}`);
  console.log(`Project Webhook: ${PROJECT_WEBHOOK_URL}`);
});
