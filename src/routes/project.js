/**
 * Project Routes - プロジェクト管理エンドポイント
 */
import { Router } from 'express';
import { env } from '../env-adapter.js';
import { setCors, asyncHandler } from '../middleware/common.js';
import { sendLineMessage } from '../line.js';
import {
  getProjectProgress,
  generateProgressSummary,
  updateTaskStatus,
  addActivityLog,
  getRecentActivityLogs,
  getMessagesForClaude,
  saveMessageForClaude,
  saveClaudeResponse
} from '../project-manager.js';

const router = Router();

router.use(setCors);

// プロジェクト進捗取得
router.get('/progress', asyncHandler(async (req, res) => {
  const progress = await getProjectProgress(env);
  const summary = await generateProgressSummary(env);
  res.json({ progress, summary });
}));

// タスクステータス更新
router.post('/task', asyncHandler(async (req, res) => {
  const { phaseId, taskId, status } = req.body;
  if (!phaseId || !taskId || !status) {
    return res.status(400).json({ error: 'phaseId, taskId, and status are required' });
  }

  await updateTaskStatus(phaseId, taskId, status, env);
  await addActivityLog(`タスク ${taskId} を ${status} に更新`, env);
  res.json({ success: true });
}));

// 活動ログ取得
router.get('/logs', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const logs = await getRecentActivityLogs(limit, env);
  res.json({ logs });
}));

// Claudeへのメッセージ取得
router.get('/messages', asyncHandler(async (req, res) => {
  const messages = await getMessagesForClaude(env);
  res.json({ messages });
}));

// メッセージを記録
router.post('/messages', asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  await saveMessageForClaude(message, env);
  res.json({ success: true });
}));

// Claudeからの返信を保存
router.post('/reply', asyncHandler(async (req, res) => {
  const { response } = req.body;
  if (!response) {
    return res.status(400).json({ error: 'response is required' });
  }

  await saveClaudeResponse(response, env);
  await addActivityLog('Claude返信: ' + response.substring(0, 30) + '...', env);
  res.json({ success: true, message: 'Response saved. User can check with "返信確認" command.' });
}));

// 管理者にLINEメッセージを直接送信
router.post('/notify', asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const adminUserId = env.ADMIN_USER_ID;
  if (!adminUserId) {
    return res.status(400).json({ error: 'ADMIN_USER_ID not configured' });
  }

  await sendLineMessage(adminUserId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
  await addActivityLog('LINE通知送信: ' + message.substring(0, 30) + '...', env);
  res.json({ success: true, message: 'Message sent to admin' });
}));

// 未読メッセージ数を取得
router.get('/unread', asyncHandler(async (req, res) => {
  const messages = await getMessagesForClaude(env);
  const unread = messages.filter(m => !m.read);
  res.json({ unread: unread.length, messages: unread });
}));

export default router;
