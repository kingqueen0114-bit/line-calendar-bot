/**
 * LINE Calendar Bot - Express Server for Google Cloud Run
 * リファクタリング版: ルーター分割 + 統一ミドルウェア
 */
import express from 'express';
import {
  rateLimit,
  securityHeaders,
  corsHandler,
  requestLogger,
  validateInput
} from './security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// ルーターをインポート
import liffRouter from './routes/liff.js';
import apiRouter from './routes/api.js';
import backupRouter from './routes/backup.js';
import projectRouter from './routes/project.js';
import webhookRouter from './routes/webhook.js';
import { eventsRouter, tasksRouter } from './routes/local.js';
import sharedRouter from './routes/shared.js';
import tagsRouter from './routes/tags.js';

const app = express();
const PORT = process.env.PORT || 8080;

// ==================== グローバルミドルウェア ====================

// リクエストログ
app.use(requestLogger());

// セキュリティヘッダー
app.use(securityHeaders());

// CORS
app.use(corsHandler());

// JSONボディ解析（署名検証用にrawBodyを保持）
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// 入力検証
app.use(validateInput());

// ==================== ルート別レート制限 ====================

app.use('/api/auth', rateLimit('auth'));
app.use('/api', rateLimit('api'));
app.use('/liff', rateLimit('liff'));

// ==================== ルーター登録 ====================

// LIFF & OAuth（/, /liff, /liff2, /oauth/callback, /claude-chat）
app.use('/', liffRouter);

// API（/api/*）
app.use('/api', apiRouter);

// タグ（/api/tags）
app.use('/api/tags', tagsRouter);

// ローカルイベント（/api/local-events）
app.use('/api/local-events', eventsRouter);

// ローカルタスク（/api/local-tasks）
app.use('/api/local-tasks', tasksRouter);

// 共有（/api/shared-*, /api/projects）
app.use('/api/shared-events', sharedRouter);
app.use('/api/shared-tasks', sharedRouter);
app.use('/api/shared-tasklists', sharedRouter);
app.use('/api/projects', sharedRouter);

// バックアップ（/api/backup/*）
app.use('/api/backup', backupRouter);

// プロジェクト管理（/api/project/*）
app.use('/api/project', projectRouter);

// Webhook & スケジューラー（POST /, /scheduled）
app.use('/', webhookRouter);

// ==================== エラーハンドリング ====================

// 404ハンドラー
app.use(notFoundHandler);

// 統一エラーハンドラー
app.use(errorHandler);

// ==================== サーバー起動 ====================

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Routes registered:');
  console.log('  - LIFF: /, /liff, /liff2, /oauth/callback, /claude-chat');
  console.log('  - API: /api/*');
  console.log('  - Tags: /api/tags');
  console.log('  - Local Events: /api/local-events');
  console.log('  - Local Tasks: /api/local-tasks');
  console.log('  - Shared: /api/shared-events, /api/shared-tasks, /api/shared-tasklists, /api/projects');
  console.log('  - Backup: /api/backup/*');
  console.log('  - Project: /api/project/*');
  console.log('  - Webhook: POST /, /scheduled');
});

export default app;
