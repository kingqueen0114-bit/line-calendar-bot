/**
 * プロジェクト管理Bot - 専用サーバー
 * LINEでプロジェクトの進捗確認・Claudeとの連携が可能
 */
import express from 'express';
import crypto from 'crypto';
import {
  getProjectProgress,
  saveProjectProgress,
  updateTaskStatus,
  generateProgressSummary,
  generateDetailedProgress,
  addActivityLog,
  getRecentActivityLogs,
  saveMessageForClaude,
  getMessagesForClaude,
  parseProjectCommand,
  getHelpMessage
} from './project-manager.js';
import { storage } from './storage.js';

const app = express();
const PORT = process.env.PORT || 8081;

// 環境変数
const LINE_CHANNEL_ACCESS_TOKEN = process.env.PROJECT_LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.PROJECT_LINE_CHANNEL_SECRET;

// JSONボディの解析
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Project Management Bot',
    version: '1.0.0'
  });
});

// LINE署名検証
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// LINEメッセージ送信
async function sendLineMessage(userId, message) {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }]
      })
    });
    return response.ok;
  } catch (error) {
    console.error('Send message error:', error);
    return false;
  }
}

// LINEメッセージ返信
async function replyLineMessage(replyToken, message) {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: message }]
      })
    });
    return response.ok;
  } catch (error) {
    console.error('Reply message error:', error);
    return false;
  }
}

// Webhook処理
app.post('/webhook', async (req, res) => {
  // 署名検証
  const signature = req.headers['x-line-signature'];
  if (!verifySignature(req.rawBody, signature)) {
    console.error('Invalid signature');
    return res.status(403).send('Invalid signature');
  }

  res.status(200).send('OK');

  // イベント処理
  const events = req.body.events || [];
  for (const event of events) {
    try {
      if (event.type === 'message' && event.message.type === 'text') {
        await handleTextMessage(event);
      } else if (event.type === 'follow') {
        await handleFollow(event);
      }
    } catch (error) {
      console.error('Event handling error:', error);
    }
  }
});

// フォローイベント処理
async function handleFollow(event) {
  const userId = event.source.userId;
  const replyToken = event.replyToken;

  await addActivityLog(`新規ユーザー: ${userId}`, storage);

  await replyLineMessage(replyToken,
    `🤖 プロジェクト管理Botへようこそ！

このBotでは以下のことができます：

📊 進捗確認
・「進捗」- 全体の進捗を表示
・「Phase1」- CI/CD詳細
・「Phase2」- モックサーバー詳細

📝 タスク管理
・「タスク開始 p1-1」
・「タスク完了 p1-1」

💬 Claude連携
・メッセージを送信 → 記録
・Claude Codeで確認・回答

「ヘルプ」でコマンド一覧を表示`
  );
}

// テキストメッセージ処理
async function handleTextMessage(event) {
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const message = event.message.text.trim();

  console.log(`Message from ${userId}: ${message}`);

  // ユーザーID確認
  if (message === 'ID' || message === 'id' || message === 'ユーザーID') {
    await replyLineMessage(replyToken, `🆔 あなたのUser ID:\n\n${userId}`);
    return;
  }

  // コマンド解析
  const cmd = parseProjectCommand(message);
  let response;

  switch (cmd.command) {
    case 'summary':
      await addActivityLog('進捗確認', storage);
      response = await generateProgressSummary(storage);
      break;

    case 'detail':
      await addActivityLog(`${cmd.phase}詳細確認`, storage);
      response = await generateDetailedProgress(cmd.phase, storage);
      break;

    case 'complete': {
      const progress = await getProjectProgress(storage);
      for (const phase of Object.values(progress)) {
        const task = phase.tasks.find(t => t.id === cmd.taskId);
        if (task) {
          await updateTaskStatus(phase.id, cmd.taskId, 'completed', storage);
          await addActivityLog(`✅ 完了: ${task.name}`, storage);
          response = `✅ タスク「${task.name}」を完了しました！`;
          break;
        }
      }
      if (!response) response = '❌ タスクが見つかりません';
      break;
    }

    case 'start': {
      const progress = await getProjectProgress(storage);
      for (const phase of Object.values(progress)) {
        const task = phase.tasks.find(t => t.id === cmd.taskId);
        if (task) {
          await updateTaskStatus(phase.id, cmd.taskId, 'in_progress', storage);
          await addActivityLog(`🔄 開始: ${task.name}`, storage);
          response = `🔄 タスク「${task.name}」を開始しました！`;
          break;
        }
      }
      if (!response) response = '❌ タスクが見つかりません';
      break;
    }

    case 'help':
      response = getHelpMessage();
      break;

    case 'claude':
    default:
      // メッセージを記録
      await addActivityLog(`💬 ${message.substring(0, 50)}...`, storage);
      response = await saveMessageForClaude(message, storage);
      break;
  }

  await replyLineMessage(replyToken, response);
}

// API: 進捗取得
app.get('/api/progress', async (req, res) => {
  try {
    const progress = await getProjectProgress(storage);
    const summary = await generateProgressSummary(storage);
    res.json({ success: true, progress, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: タスク更新
app.post('/api/task', async (req, res) => {
  const { phaseId, taskId, status } = req.body;
  try {
    await updateTaskStatus(phaseId, taskId, status, storage);
    await addActivityLog(`API: ${taskId} → ${status}`, storage);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: 活動ログ取得
app.get('/api/logs', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  try {
    const logs = await getRecentActivityLogs(limit, storage);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Claudeへのメッセージ取得
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await getMessagesForClaude(storage);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: メッセージをユーザーに送信
app.post('/api/send', async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: 'userId and message required' });
  }
  try {
    const success = await sendLineMessage(userId, message);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Project Management Bot running on port ${PORT}`);
});
