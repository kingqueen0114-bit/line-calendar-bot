/**
 * LINE Calendar Bot - Express Server for Google Cloud Run
 */
import express from 'express';
import crypto from 'crypto';
import { handleWebhook, runScheduledTask } from './app.js';

const app = express();
const PORT = process.env.PORT || 8080;

// JSONボディの解析（生のボディも保持、画像Base64用に50MBまで許可）
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// ヘルスチェック
app.get('/', (req, res) => {
  res.send('LINE Calendar Bot is running');
});

// OAuth コールバック
app.get('/oauth/callback', async (req, res) => {
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
    const { handleOAuthCallback } = await import('./oauth.js');
    const { env } = await import('./env-adapter.js');
    const { registerUserForNotifications } = await import('./app.js');
    await handleOAuthCallback(code, state, env);

    // 認証成功時にユーザーを通知リストに登録
    await registerUserForNotifications(state, env);

    res.send(`
      <html><head><meta charset="utf-8"></head><body>
      <h1>✅ 認証成功！</h1>
      <p>LINEに戻ってメッセージを送信してください。</p>
      <script>setTimeout(() => window.close(), 3000);</script>
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

// LIFF アプリ
app.get('/liff', async (req, res) => {
  const { generateLiffHtml } = await import('./liff.js');
  const liffId = process.env.LIFF_ID || 'YOUR_LIFF_ID';
  const apiBase = `https://${req.get('host')}`;
  let html = generateLiffHtml(liffId, apiBase);
  // キャッシュ回避用のタイムスタンプを埋め込み
  html = html.replace('</head>', `<!-- build: ${Date.now()} --></head>`);
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
    'ETag': `"${Date.now()}"`,
    'Vary': '*'
  });
  res.type('html').send(html);
});

// LIFF アプリ (キャッシュ回避用)
app.get('/liff2', async (req, res) => {
  const { generateLiffHtml } = await import('./liff.js');
  const liffId = process.env.LIFF_ID || 'YOUR_LIFF_ID';
  const apiBase = `https://${req.get('host')}`;
  let html = generateLiffHtml(liffId, apiBase);
  html = html.replace('</head>', `<!-- build: ${Date.now()} --></head>`);
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.type('html').send(html);
});

// Debug: OAuth設定確認
app.get('/api/oauth-debug', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { env } = await import('./env-adapter.js');
  res.json({
    redirect_uri: env.OAUTH_REDIRECT_URI || 'NOT SET',
    client_id_set: !!env.GOOGLE_CLIENT_ID,
    client_id_prefix: env.GOOGLE_CLIENT_ID ? env.GOOGLE_CLIENT_ID.substring(0, 20) + '...' : null,
    client_secret_set: !!env.GOOGLE_CLIENT_SECRET,
    expected_callback: 'https://line-calendar-bot-67385363897.asia-northeast1.run.app/oauth/callback'
  });
});

// LIFF API: 認証状態確認
app.get('/api/auth-status', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { env } = await import('./env-adapter.js');
    const isAuth = await isUserAuthenticated(userId, env);
    res.json({ authenticated: isAuth });
  } catch (error) {
    console.error('Auth status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LIFF API: 認証URL取得
app.get('/api/auth-url', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { getAuthorizationUrl } = await import('./oauth.js');
    const { env } = await import('./env-adapter.js');
    const authUrl = getAuthorizationUrl(userId, env);
    res.json({ authUrl });
  } catch (error) {
    console.error('Auth URL generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LIFF API: Google連携解除
app.post('/api/auth-revoke', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { revokeUserTokens } = await import('./oauth.js');
    const { env } = await import('./env-adapter.js');

    await revokeUserTokens(userId, env);

    // 同期設定もオフにする
    const settings = {
      googleCalendarSync: false,
      googleTasksSync: false,
      updatedAt: new Date().toISOString()
    };
    await env.NOTIFICATIONS.put(`sync_settings:${userId}`, JSON.stringify(settings));

    res.json({ success: true });
  } catch (error) {
    console.error('Auth revoke error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LIFF API エンドポイント
app.get('/api/events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getUpcomingEvents } = await import('./calendar.js');
    const { env } = await import('./env-adapter.js');
    const { registerUserForNotifications } = await import('./app.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // ユーザーを通知リストに登録（LIFF起動時）
    await registerUserForNotifications(userId, env);

    const events = await getUpcomingEvents(userId, env, 90);
    res.json(events);
  } catch (err) {
    console.error('LIFF API events error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getAllIncompleteTasks } = await import('./tasks.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const tasks = await getAllIncompleteTasks(userId, env);
    res.json(tasks);
  } catch (err) {
    console.error('LIFF API tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/complete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { completeTask } = await import('./tasks.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await completeTask(taskId, listId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('LIFF API complete task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// タスク完了取消し
app.post('/api/tasks/uncomplete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { uncompleteTask } = await import('./tasks.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await uncompleteTask(taskId, listId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('LIFF API uncomplete task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 完了済みタスク取得
app.get('/api/tasks/completed', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getAllCompletedTasks } = await import('./tasks.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const tasks = await getAllCompletedTasks(userId, env);
    res.json(tasks);
  } catch (err) {
    console.error('LIFF API completed tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// タスク更新
app.post('/api/tasks/update', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId, title, due } = req.body;

  if (!userId || !taskId || !listId || !title) {
    return res.status(400).json({ error: 'userId, taskId, listId, title required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { updateTask } = await import('./tasks.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await updateTask(taskId, listId, { title, due }, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('LIFF API update task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 予定作成
app.post('/api/events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, title, date, startTime, endTime, isAllDay, location, url, memo, reminders } = req.body;

  if (!userId || !title || !date) {
    return res.status(400).json({ error: 'userId, title, date required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { createEvent } = await import('./calendar.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const eventData = {
      title,
      date,
      startTime: startTime || '09:00',
      endTime: endTime || '10:00',
      isAllDay: isAllDay || false,
      location,
      url,
      memo
    };

    const result = await createEvent(eventData, userId, env);

    // リマインダーがある場合はKVに保存
    if (reminders && reminders.length > 0) {
      const reminderData = {
        type: 'event',
        title,
        date,
        startTime: isAllDay ? null : startTime,
        isAllDay: isAllDay || false,
        reminders,
        createdAt: new Date().toISOString()
      };
      await env.NOTIFICATIONS.put(
        `event_reminder_${userId}_${result.id}`,
        JSON.stringify(reminderData),
        { expirationTtl: 30 * 24 * 60 * 60 } // 30日
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 予定削除
app.delete('/api/events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, eventId } = req.body;

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId, eventId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { deleteEvent } = await import('./calendar.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await deleteEvent(eventId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 予定リマインダー取得（認証不要 - ローカルイベントでも使用）
app.get('/api/event-reminders', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, eventId } = req.query;

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId, eventId required' });
  }

  try {
    const { env } = await import('./env-adapter.js');

    const reminderData = await env.NOTIFICATIONS.get(`event_reminder_${userId}_${eventId}`, { type: 'json' });
    res.json(reminderData || null);
  } catch (err) {
    console.error('Get event reminders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// タスクリスト取得
app.get('/api/tasklists', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getTaskLists } = await import('./tasks.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const lists = await getTaskLists(userId, env);
    res.json(lists);
  } catch (err) {
    console.error('Get tasklists error:', err);
    res.status(500).json({ error: err.message });
  }
});

// タスク作成
app.post('/api/tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, title, due, listName, reminders } = req.body;

  if (!userId || !title) {
    return res.status(400).json({ error: 'userId, title required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { createTask } = await import('./tasks.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const taskData = { title, due, listName };
    const result = await createTask(taskData, userId, env);

    // リマインダーがある場合はKVに保存
    if (reminders && reminders.length > 0 && due) {
      const reminderData = {
        type: 'task',
        title,
        due,
        reminders,
        createdAt: new Date().toISOString()
      };
      await env.NOTIFICATIONS.put(
        `task_reminder_${userId}_${result.id}`,
        JSON.stringify(reminderData),
        { expirationTtl: 90 * 24 * 60 * 60 } // 90日
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// タスクリマインダー取得
app.get('/api/task-reminders', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId } = req.query;

  if (!userId || !taskId) {
    return res.status(400).json({ error: 'userId, taskId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const reminderData = await env.NOTIFICATIONS.get(`task_reminder_${userId}_${taskId}`, { type: 'json' });
    res.json(reminderData || null);
  } catch (err) {
    console.error('Get task reminders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// タスク削除
app.delete('/api/tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { deleteTask } = await import('./tasks.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await deleteTask(taskId, listId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// メモ一覧取得（認証不要 - ローカル機能）
app.get('/api/memos', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { getMemos } = await import('./memo.js');
    const { env } = await import('./env-adapter.js');

    const memos = await getMemos(userId, env);
    res.json(memos);
  } catch (err) {
    console.error('Get memos error:', err);
    res.status(500).json({ error: err.message });
  }
});

// メモ作成（画像・ファイル・音声はBase64で送信）
app.post('/api/memos', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const {
    userId,
    text,
    imageBase64,
    // ファイル添付
    fileBase64,
    fileName,
    fileType,
    fileSize,
    // 音声
    audioBase64,
    audioDuration
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  if (!text && !imageBase64 && !fileBase64 && !audioBase64) {
    return res.status(400).json({ error: 'text, image, file or audio required' });
  }

  // ファイルサイズチェック（10MB）
  if (fileSize && fileSize > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'ファイルサイズが10MBを超えています' });
  }

  try {
    const { createMemo, uploadImage, uploadFile, uploadAudio } = await import('./memo.js');
    const { env } = await import('./env-adapter.js');

    let imageUrl = null;
    let fileUrl = null;
    let audioUrl = null;

    // 画像がある場合はGCSにアップロード
    if (imageBase64) {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      imageUrl = await uploadImage(imageBuffer, userId);
    }

    // ファイルがある場合はGCSにアップロード
    if (fileBase64 && fileName) {
      const fileBuffer = Buffer.from(fileBase64, 'base64');
      fileUrl = await uploadFile(fileBuffer, userId, fileName, fileType || 'application/octet-stream');
    }

    // 音声がある場合はGCSにアップロード
    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      audioUrl = await uploadAudio(audioBuffer, userId, 'audio/webm');
    }

    const memo = await createMemo({
      text,
      imageUrl,
      fileUrl,
      fileName: fileUrl ? fileName : null,
      fileType: fileUrl ? fileType : null,
      fileSize: fileUrl ? fileSize : null,
      audioUrl,
      audioDuration: audioUrl ? audioDuration : null
    }, userId, env);

    res.json(memo);
  } catch (err) {
    console.error('Create memo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// メモ削除（認証不要 - ローカル機能）
app.delete('/api/memos', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, memoId } = req.body;

  if (!userId || !memoId) {
    return res.status(400).json({ error: 'userId, memoId required' });
  }

  try {
    const { deleteMemo } = await import('./memo.js');
    const { env } = await import('./env-adapter.js');

    await deleteMemo(memoId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete memo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// プロジェクト一覧取得
app.get('/api/projects', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getUserProjects } = await import('./project.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const projects = await getUserProjects(userId, env);
    res.json(projects);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

// プロジェクト作成
app.post('/api/projects', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, name, description, color, isPersonal, editPermission } = req.body;

  if (!userId || !name) {
    return res.status(400).json({ error: 'userId, name required' });
  }

  try {
    const { createProject } = await import('./project.js');
    const { env } = await import('./env-adapter.js');

    const project = await createProject({ name, description, color, isPersonal, editPermission }, userId, env);
    res.json(project);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: err.message });
  }
});

// プロジェクト参加（招待コード）
app.post('/api/projects/join', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, inviteCode } = req.body;

  if (!userId || !inviteCode) {
    return res.status(400).json({ error: 'userId, inviteCode required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { joinProjectByCode } = await import('./project.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const project = await joinProjectByCode(inviteCode.toUpperCase(), userId, env);
    res.json(project);
  } catch (err) {
    console.error('Join project error:', err);
    res.status(400).json({ error: err.message });
  }
});

// プロジェクト退出
app.post('/api/projects/leave', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId } = req.body;

  if (!userId || !projectId) {
    return res.status(400).json({ error: 'userId, projectId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { leaveProject } = await import('./project.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await leaveProject(projectId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Leave project error:', err);
    res.status(400).json({ error: err.message });
  }
});

// プロジェクト更新
app.post('/api/projects/update', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId, name, color } = req.body;

  if (!userId || !projectId || !name) {
    return res.status(400).json({ error: 'userId, projectId, name required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { updateProject } = await import('./project.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const project = await updateProject(projectId, { name, color }, userId, env);
    res.json(project);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(400).json({ error: err.message });
  }
});

// プロジェクト削除
app.delete('/api/projects', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId } = req.body;

  if (!userId || !projectId) {
    return res.status(400).json({ error: 'userId, projectId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { deleteProject } = await import('./project.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await deleteProject(projectId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(400).json({ error: err.message });
  }
});

// プロジェクトメンバー取得
app.get('/api/projects/members', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId } = req.query;

  if (!userId || !projectId) {
    return res.status(400).json({ error: 'userId, projectId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getProjectMembers } = await import('./project.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const members = await getProjectMembers(projectId, env);
    res.json(members);
  } catch (err) {
    console.error('Get project members error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有カレンダーの予定一覧取得
app.get('/api/shared-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getAllSharedEventsForUser, formatSharedEventForDisplay } = await import('./shared-calendar.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const events = await getAllSharedEventsForUser(userId, env, 90);
    const formatted = events.map(formatSharedEventForDisplay);
    res.json(formatted);
  } catch (err) {
    console.error('Get shared events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有カレンダーに予定作成
app.post('/api/shared-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId, title, date, startTime, endTime, isAllDay, location, notifyMembers } = req.body;

  if (!userId || !projectId || !title || !date) {
    return res.status(400).json({ error: 'userId, projectId, title, date required' });
  }

  try {
    const { createSharedEvent } = await import('./shared-calendar.js');
    const { getProject, canUserEditProject } = await import('./project.js');
    const { sendLineMessage } = await import('./line.js');
    const { env } = await import('./env-adapter.js');

    // プロジェクトのメンバーかチェック
    const project = await getProject(projectId, env);
    if (!project || !project.members.includes(userId)) {
      return res.status(403).json({ error: 'このカレンダーにアクセスできません' });
    }

    // 編集権限チェック
    const canEdit = await canUserEditProject(projectId, userId, env);
    if (!canEdit) {
      return res.status(403).json({ error: 'このカレンダーを編集する権限がありません' });
    }

    const eventData = {
      title,
      date,
      startTime: startTime || null,
      endTime: endTime || null,
      isAllDay: isAllDay || false,
      location
    };

    const event = await createSharedEvent(eventData, projectId, userId, env);

    // メンバーに通知
    if (notifyMembers && project.members.length > 1) {
      const creatorData = await env.NOTIFICATIONS.get(`user:${userId}`, { type: 'json' });
      const creatorName = creatorData?.displayName || '誰か';
      const timeStr = isAllDay ? '終日' : (startTime ? startTime + (endTime ? ' - ' + endTime : '') : '');
      const message = `📅 新しい予定が追加されました\n\n📝 ${title}\n📆 ${date}${timeStr ? '\n⏰ ' + timeStr : ''}${location ? '\n📍 ' + location : ''}\n\n👤 ${creatorName}さんが「${project.name}」に追加しました`;

      for (const memberId of project.members) {
        if (memberId !== userId) {
          try {
            await sendLineMessage(memberId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
          } catch (notifyErr) {
            console.error(`Failed to notify member ${memberId}:`, notifyErr);
          }
        }
      }
    }

    res.json(event);
  } catch (err) {
    console.error('Create shared event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有カレンダーの予定削除
app.delete('/api/shared-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, eventId, projectId } = req.body;

  if (!userId || !eventId || !projectId) {
    return res.status(400).json({ error: 'userId, eventId, projectId required' });
  }

  try {
    const { deleteSharedEvent } = await import('./shared-calendar.js');
    const { getProject, canUserEditProject } = await import('./project.js');
    const { env } = await import('./env-adapter.js');

    // プロジェクトのメンバーかチェック
    const project = await getProject(projectId, env);
    if (!project || !project.members.includes(userId)) {
      return res.status(403).json({ error: 'このカレンダーにアクセスできません' });
    }

    // 編集権限チェック
    const canEdit = await canUserEditProject(projectId, userId, env);
    if (!canEdit) {
      return res.status(403).json({ error: 'このカレンダーを編集する権限がありません' });
    }

    await deleteSharedEvent(eventId, projectId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete shared event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// 共有タスクリスト API
// ========================================

// 共有タスクリスト一覧取得
app.get('/api/shared-tasklists', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getUserSharedTaskLists } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const lists = await getUserSharedTaskLists(userId, env);
    res.json(lists);
  } catch (err) {
    console.error('Get shared tasklists error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスクリスト作成
app.post('/api/shared-tasklists', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, name, color, editPermission } = req.body;

  if (!userId || !name) {
    return res.status(400).json({ error: 'userId, name required' });
  }

  try {
    const { createSharedTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    const list = await createSharedTaskList({ name, color, editPermission }, userId, env);
    res.json(list);
  } catch (err) {
    console.error('Create shared tasklist error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスクリスト更新
app.post('/api/shared-tasklists/update', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, listId, name, color, editPermission } = req.body;

  if (!userId || !listId || !name) {
    return res.status(400).json({ error: 'userId, listId, name required' });
  }

  try {
    const { updateSharedTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    const list = await updateSharedTaskList(listId, { name, color, editPermission }, userId, env);
    res.json(list);
  } catch (err) {
    console.error('Update shared tasklist error:', err);
    res.status(400).json({ error: err.message });
  }
});

// 共有タスクリストに参加
app.post('/api/shared-tasklists/join', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, inviteCode } = req.body;

  if (!userId || !inviteCode) {
    return res.status(400).json({ error: 'userId, inviteCode required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { joinTaskListByCode } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const list = await joinTaskListByCode(inviteCode.toUpperCase(), userId, env);
    res.json(list);
  } catch (err) {
    console.error('Join shared tasklist error:', err);
    res.status(400).json({ error: err.message });
  }
});

// 共有タスクリストから退出
app.post('/api/shared-tasklists/leave', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, listId } = req.body;

  if (!userId || !listId) {
    return res.status(400).json({ error: 'userId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { leaveSharedTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await leaveSharedTaskList(listId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Leave shared tasklist error:', err);
    res.status(400).json({ error: err.message });
  }
});

// 共有タスクリスト削除
app.delete('/api/shared-tasklists', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, listId } = req.body;

  if (!userId || !listId) {
    return res.status(400).json({ error: 'userId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { deleteSharedTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await deleteSharedTaskList(listId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete shared tasklist error:', err);
    res.status(400).json({ error: err.message });
  }
});

// 共有タスク一覧取得
app.get('/api/shared-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getAllSharedTasksForUser } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const tasks = await getAllSharedTasksForUser(userId, env);
    res.json(tasks);
  } catch (err) {
    console.error('Get shared tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスク作成
app.post('/api/shared-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, listId, title, due, notifyMembers } = req.body;

  if (!userId || !listId || !title) {
    return res.status(400).json({ error: 'userId, listId, title required' });
  }

  try {
    const { createSharedTask, getSharedTaskList, canUserEditTaskList } = await import('./shared-tasklist.js');
    const { sendLineMessage } = await import('./line.js');
    const { env } = await import('./env-adapter.js');

    // 編集権限チェック
    const canEdit = await canUserEditTaskList(listId, userId, env);
    if (!canEdit) {
      return res.status(403).json({ error: 'このタスクリストを編集する権限がありません' });
    }

    const task = await createSharedTask({ title, due }, listId, userId, env);

    // メンバーに通知
    if (notifyMembers) {
      const list = await getSharedTaskList(listId, env);
      if (list && list.members.length > 1) {
        const creatorData = await env.NOTIFICATIONS.get(`user:${userId}`, { type: 'json' });
        const creatorName = creatorData?.displayName || '誰か';
        const dueStr = due ? `\n📅 期限: ${due.substring(0, 10)}` : '';
        const message = `✅ 新しいタスクが追加されました\n\n📝 ${title}${dueStr}\n\n👤 ${creatorName}さんが「${list.name}」に追加しました`;

        for (const memberId of list.members) {
          if (memberId !== userId) {
            try {
              await sendLineMessage(memberId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
            } catch (notifyErr) {
              console.error(`Failed to notify member ${memberId}:`, notifyErr);
            }
          }
        }
      }
    }

    res.json(task);
  } catch (err) {
    console.error('Create shared task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスク完了
app.post('/api/shared-tasks/complete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId, userName } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { completeSharedTask, canUserEditTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    // 編集権限チェック
    const canEdit = await canUserEditTaskList(listId, userId, env);
    if (!canEdit) {
      return res.status(403).json({ error: 'このタスクリストを編集する権限がありません' });
    }

    await completeSharedTask(taskId, listId, userId, env, userName);
    res.json({ success: true });
  } catch (err) {
    console.error('Complete shared task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスク削除
app.delete('/api/shared-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { deleteSharedTask, canUserEditTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    // 編集権限チェック
    const canEdit = await canUserEditTaskList(listId, userId, env);
    if (!canEdit) {
      return res.status(403).json({ error: 'このタスクリストを編集する権限がありません' });
    }

    await deleteSharedTask(taskId, listId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete shared task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスク完了取消し
app.post('/api/shared-tasks/uncomplete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { uncompleteSharedTask } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await uncompleteSharedTask(taskId, listId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Uncomplete shared task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 完了済み共有タスク取得
app.get('/api/shared-tasks/completed', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./oauth.js');
    const { getAllCompletedSharedTasksForUser } = await import('./shared-tasklist.js');
    const { env } = await import('./env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const tasks = await getAllCompletedSharedTasksForUser(userId, env);
    res.json(tasks);
  } catch (err) {
    console.error('Get completed shared tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 通知設定取得
app.get('/api/settings/notifications', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const settings = await env.NOTIFICATIONS.get(`settings:${userId}`, { type: 'json' });
    res.json(settings || { reminderEnabled: true });
  } catch (err) {
    console.error('Get notification settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 通知設定更新
app.post('/api/settings/notifications', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, reminderEnabled } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { registerUserForNotifications, updateUserNotificationSettings } = await import('./app.js');

    // ユーザーを通知リストに登録
    await registerUserForNotifications(userId, env);

    // 設定を保存
    await updateUserNotificationSettings(userId, { reminderEnabled }, env);

    res.json({ success: true });
  } catch (err) {
    console.error('Update notification settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// 同期設定 API
// ========================================

// 同期設定取得
app.get('/api/sync-settings', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const settings = await env.NOTIFICATIONS.get(`sync_settings:${userId}`, { type: 'json' });
    res.json(settings || { googleCalendarSync: false, googleTasksSync: false });
  } catch (err) {
    console.error('Get sync settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 同期設定更新
app.post('/api/sync-settings', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, googleCalendarSync, googleTasksSync } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const settings = {
      googleCalendarSync: googleCalendarSync || false,
      googleTasksSync: googleTasksSync || false,
      updatedAt: new Date().toISOString()
    };
    await env.NOTIFICATIONS.put(`sync_settings:${userId}`, JSON.stringify(settings));
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Update sync settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// ローカルイベント API
// ========================================

// ローカルイベント取得
app.get('/api/local-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, days } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { getLocalEvents } = await import('./local-calendar.js');
    const { env } = await import('./env-adapter.js');

    const events = await getLocalEvents(userId, env, parseInt(days) || 90);
    res.json(events);
  } catch (err) {
    console.error('Get local events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカルイベント作成
app.post('/api/local-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, title, date, startTime, endTime, isAllDay, location, url, memo, reminders } = req.body;

  if (!userId || !title || !date) {
    return res.status(400).json({ error: 'userId, title, date required' });
  }

  try {
    const { createLocalEvent } = await import('./local-calendar.js');
    const { env } = await import('./env-adapter.js');

    const eventData = {
      title,
      date,
      startTime: startTime || '09:00',
      endTime: endTime || '10:00',
      isAllDay: isAllDay || false,
      location,
      url,
      memo
    };

    const result = await createLocalEvent(eventData, userId, env);

    // リマインダーがある場合はKVに保存
    if (reminders && reminders.length > 0) {
      const reminderData = {
        type: 'event',
        title,
        date,
        startTime: isAllDay ? null : startTime,
        isAllDay: isAllDay || false,
        reminders,
        createdAt: new Date().toISOString()
      };
      await env.NOTIFICATIONS.put(
        `event_reminder_${userId}_${result.id}`,
        JSON.stringify(reminderData),
        { expirationTtl: 30 * 24 * 60 * 60 }
      );

      // ユーザーを通知リストに登録
      const usersJson = await env.NOTIFICATIONS.get('notification_users', { type: 'json' });
      const users = usersJson || [];
      if (!users.includes(userId)) {
        users.push(userId);
        await env.NOTIFICATIONS.put('notification_users', JSON.stringify(users));
      }
    }

    res.json(result);
  } catch (err) {
    console.error('Create local event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカルイベント更新
app.put('/api/local-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, eventId, title, date, startTime, endTime, isAllDay, location, url, memo, reminders } = req.body;

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId, eventId required' });
  }

  try {
    const { updateLocalEvent, getLocalEvent } = await import('./local-calendar.js');
    const { env } = await import('./env-adapter.js');

    // 既存のイベントを取得
    const existingEvent = await getLocalEvent(eventId, userId, env);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // descriptionを再構築
    let description = '';
    if (url) {
      description += url;
    }
    if (memo) {
      if (description) description += '\n\n';
      description += memo;
    }

    const eventData = {
      title,
      date,
      startTime: startTime || '09:00',
      endTime: endTime || '10:00',
      isAllDay: isAllDay || false,
      location,
      description
    };

    const result = await updateLocalEvent(eventId, eventData, userId, env);

    // リマインダーを更新
    if (reminders && reminders.length > 0) {
      const reminderData = {
        type: 'event',
        title,
        date,
        startTime: isAllDay ? null : startTime,
        isAllDay: isAllDay || false,
        reminders,
        createdAt: new Date().toISOString()
      };
      await env.NOTIFICATIONS.put(
        `event_reminder_${userId}_${eventId}`,
        JSON.stringify(reminderData),
        { expirationTtl: 30 * 24 * 60 * 60 }
      );

      // ユーザーを通知リストに登録
      const usersJson = await env.NOTIFICATIONS.get('notification_users', { type: 'json' });
      const users = usersJson || [];
      if (!users.includes(userId)) {
        users.push(userId);
        await env.NOTIFICATIONS.put('notification_users', JSON.stringify(users));
      }
    } else {
      // リマインダーがない場合は削除
      await env.NOTIFICATIONS.delete(`event_reminder_${userId}_${eventId}`);
    }

    res.json(result);
  } catch (err) {
    console.error('Update local event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカルイベント削除
app.delete('/api/local-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, eventId } = req.body;

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId, eventId required' });
  }

  try {
    const { deleteLocalEvent } = await import('./local-calendar.js');
    const { env } = await import('./env-adapter.js');

    await deleteLocalEvent(eventId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete local event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// ローカルタスク API
// ========================================

// ローカルタスク取得
app.get('/api/local-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { getLocalTasks } = await import('./local-tasks.js');
    const { env } = await import('./env-adapter.js');

    const tasks = await getLocalTasks(userId, env);
    res.json(tasks);
  } catch (err) {
    console.error('Get local tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカルタスク作成
app.post('/api/local-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, title, due, listName, reminders } = req.body;

  if (!userId || !title) {
    return res.status(400).json({ error: 'userId, title required' });
  }

  try {
    const { createLocalTask } = await import('./local-tasks.js');
    const { env } = await import('./env-adapter.js');

    const taskData = { title, due, listName };
    const result = await createLocalTask(taskData, userId, env);

    // リマインダーがある場合はKVに保存
    if (reminders && reminders.length > 0 && due) {
      const reminderData = {
        type: 'task',
        title,
        due,
        reminders,
        createdAt: new Date().toISOString()
      };
      await env.NOTIFICATIONS.put(
        `task_reminder_${userId}_${result.id}`,
        JSON.stringify(reminderData),
        { expirationTtl: 90 * 24 * 60 * 60 }
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Create local task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカルタスク完了
app.post('/api/local-tasks/complete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId } = req.body;

  if (!userId || !taskId) {
    return res.status(400).json({ error: 'userId, taskId required' });
  }

  try {
    const { completeLocalTask } = await import('./local-tasks.js');
    const { env } = await import('./env-adapter.js');

    await completeLocalTask(taskId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Complete local task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカルタスク完了取消し
app.post('/api/local-tasks/uncomplete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId } = req.body;

  if (!userId || !taskId) {
    return res.status(400).json({ error: 'userId, taskId required' });
  }

  try {
    const { uncompleteLocalTask } = await import('./local-tasks.js');
    const { env } = await import('./env-adapter.js');

    await uncompleteLocalTask(taskId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Uncomplete local task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカルタスク削除
app.delete('/api/local-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId } = req.body;

  if (!userId || !taskId) {
    return res.status(400).json({ error: 'userId, taskId required' });
  }

  try {
    const { deleteLocalTask } = await import('./local-tasks.js');
    const { env } = await import('./env-adapter.js');

    await deleteLocalTask(taskId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete local task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカルタスク更新
app.post('/api/local-tasks/update', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, title, due } = req.body;

  if (!userId || !taskId || !title) {
    return res.status(400).json({ error: 'userId, taskId, title required' });
  }

  try {
    const { updateLocalTask } = await import('./local-tasks.js');
    const { env } = await import('./env-adapter.js');

    await updateLocalTask(taskId, { title, due }, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Update local task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 完了済みローカルタスク取得
app.get('/api/local-tasks/completed', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { getLocalCompletedTasks } = await import('./local-tasks.js');
    const { env } = await import('./env-adapter.js');

    const tasks = await getLocalCompletedTasks(userId, env);
    res.json(tasks);
  } catch (err) {
    console.error('Get completed local tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CORS プリフライト
app.options('/api/*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.sendStatus(204);
});

// LINE Webhook
app.post('/', async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Webhook body:', JSON.stringify(req.body));
  try {
    // 署名検証
    const signature = req.headers['x-line-signature'];
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    const hash = crypto
      .createHmac('SHA256', channelSecret)
      .update(req.rawBody)
      .digest('base64');

    if (hash !== signature) {
      console.error('Invalid signature');
      return res.status(401).send('Invalid signature');
    }

    console.log('Signature verified, calling handleWebhook');
    // Webhook処理
    await handleWebhook(req.body);
    console.log('handleWebhook completed');
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// スケジュールタスク用エンドポイント（Cloud Scheduler から呼び出し）
// スケジュールタスク（POST/GET両対応）
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

// ==================== バックアップAPI ====================

// バックアップエクスポート（JSONダウンロード用）
app.get('/api/backup/export', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { exportUserData } = await import('./backup.js');
    const exportData = await exportUserData(userId, env);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="calendar-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('Backup export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// バックアップインポート
app.post('/api/backup/import', async (req, res) => {
  const { userId, data, merge } = req.body;
  if (!userId || !data) {
    return res.status(400).json({ error: 'userId and data are required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { importUserData } = await import('./backup.js');
    const result = await importUserData(userId, data, env, merge || false);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Backup import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// バックアップ一覧取得
app.get('/api/backup/list', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { listBackups, getLastBackupTime } = await import('./backup.js');
    const backups = await listBackups(userId, env);
    const lastBackupTime = await getLastBackupTime(userId, env);
    res.json({ backups, lastBackupTime });
  } catch (err) {
    console.error('Backup list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// バックアップから復元
app.post('/api/backup/restore', async (req, res) => {
  const { userId, backupId } = req.body;
  if (!userId || !backupId) {
    return res.status(400).json({ error: 'userId and backupId are required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { restoreFromBackup } = await import('./backup.js');
    const result = await restoreFromBackup(userId, backupId, env);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Backup restore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 手動バックアップ作成
app.post('/api/backup/create', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { createBackup } = await import('./backup.js');
    const result = await createBackup(userId, env);
    res.json({ success: true, backup: result });
  } catch (err) {
    console.error('Backup create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 自動バックアップ設定取得
app.get('/api/backup/settings', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { autoBackupSetting, getLastBackupTime } = await import('./backup.js');
    const autoBackupEnabled = await autoBackupSetting(userId, env);
    const lastBackupTime = await getLastBackupTime(userId, env);
    res.json({ autoBackupEnabled, lastBackupTime });
  } catch (err) {
    console.error('Backup settings get error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 自動バックアップ設定更新
app.post('/api/backup/settings', async (req, res) => {
  const { userId, autoBackupEnabled } = req.body;
  if (!userId || autoBackupEnabled === undefined) {
    return res.status(400).json({ error: 'userId and autoBackupEnabled are required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { autoBackupSetting } = await import('./backup.js');
    await autoBackupSetting(userId, env, autoBackupEnabled);
    res.json({ success: true, autoBackupEnabled });
  } catch (err) {
    console.error('Backup settings update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== プロジェクト管理API ====================

// プロジェクト進捗取得
app.get('/api/project/progress', async (req, res) => {
  try {
    const { env } = await import('./env-adapter.js');
    const { getProjectProgress, generateProgressSummary } = await import('./project-manager.js');

    const progress = await getProjectProgress(env);
    const summary = await generateProgressSummary(env);

    res.json({ progress, summary });
  } catch (err) {
    console.error('Project progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

// タスクステータス更新
app.post('/api/project/task', async (req, res) => {
  const { phaseId, taskId, status } = req.body;
  if (!phaseId || !taskId || !status) {
    return res.status(400).json({ error: 'phaseId, taskId, and status are required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { updateTaskStatus, addActivityLog } = await import('./project-manager.js');

    await updateTaskStatus(phaseId, taskId, status, env);
    await addActivityLog(`タスク ${taskId} を ${status} に更新`, env);

    res.json({ success: true });
  } catch (err) {
    console.error('Task update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 活動ログ取得
app.get('/api/project/logs', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  try {
    const { env } = await import('./env-adapter.js');
    const { getRecentActivityLogs } = await import('./project-manager.js');

    const logs = await getRecentActivityLogs(limit, env);
    res.json({ logs });
  } catch (err) {
    console.error('Activity logs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Claudeへのメッセージ取得（Claude Codeから確認用）
app.get('/api/project/messages', async (req, res) => {
  try {
    const { env } = await import('./env-adapter.js');
    const { getMessagesForClaude } = await import('./project-manager.js');

    const messages = await getMessagesForClaude(env);
    res.json({ messages });
  } catch (err) {
    console.error('Messages fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// メッセージを記録
app.post('/api/project/messages', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const { env } = await import('./env-adapter.js');
    const { saveMessageForClaude } = await import('./project-manager.js');

    await saveMessageForClaude(message, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Message save error:', err);
    res.status(500).json({ error: err.message });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
