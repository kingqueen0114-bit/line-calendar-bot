/**
 * API Routes - /api エンドポイント
 */
import { Router } from 'express';
import { env } from '../env-adapter.js';
import { setCors, requireUserId, requireAuth, requireAdmin, asyncHandler } from '../middleware/common.js';
import { isUserAuthenticated, getAuthorizationUrl, revokeUserTokens } from '../oauth.js';
import { getUpcomingEvents, createEvent, deleteEvent } from '../calendar.js';
import { getAllIncompleteTasks, getAllCompletedTasks, getTaskLists, createTask, completeTask, uncompleteTask, updateTask, deleteTask } from '../tasks.js';
import { getMemos, createMemo, deleteMemo, uploadImage, uploadFile, uploadAudio } from '../memo.js';
import { registerUserForNotifications, updateUserNotificationSettings } from '../app.js';

const router = Router();

// 全ルートにCORS適用
router.use(setCors);

// ==================== 認証 API ====================

router.get('/auth-status', requireUserId, asyncHandler(async (req, res) => {
  const isAuth = await isUserAuthenticated(req.userId, env);
  res.json({ authenticated: isAuth });
}));

router.get('/auth-url', requireUserId, asyncHandler(async (req, res) => {
  const authUrl = getAuthorizationUrl(req.userId, env);
  res.json({ authUrl });
}));

router.post('/auth-revoke', asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  await revokeUserTokens(userId, env);

  const settings = {
    googleCalendarSync: false,
    googleTasksSync: false,
    updatedAt: new Date().toISOString()
  };
  await env.NOTIFICATIONS.put(`sync_settings:${userId}`, JSON.stringify(settings));

  res.json({ success: true });
}));

router.get('/admin-check', asyncHandler(async (req, res) => {
  const adminUserId = env.ADMIN_USER_ID;
  if (adminUserId) {
    res.json({ adminUserId });
  } else {
    res.status(404).json({ error: 'Admin not configured' });
  }
}));

router.get('/oauth-debug', asyncHandler(async (req, res) => {
  res.json({
    redirect_uri: env.OAUTH_REDIRECT_URI || 'NOT SET',
    client_id_set: !!env.GOOGLE_CLIENT_ID,
    client_id_prefix: env.GOOGLE_CLIENT_ID ? env.GOOGLE_CLIENT_ID.substring(0, 20) + '...' : null,
    client_secret_set: !!env.GOOGLE_CLIENT_SECRET,
    expected_callback: 'https://line-calendar-bot-67385363897.asia-northeast1.run.app/oauth/callback'
  });
}));

// ==================== カレンダー API ====================

router.get('/events', requireAuth, asyncHandler(async (req, res) => {
  await registerUserForNotifications(req.userId, env);
  const events = await getUpcomingEvents(req.userId, env, 90);
  res.json(events);
}));

router.post('/events', requireAuth, asyncHandler(async (req, res) => {
  const { title, date, startTime, endTime, isAllDay, location, url, memo, reminders } = req.body;

  if (!title || !date) {
    return res.status(400).json({ error: 'title, date required' });
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

  const result = await createEvent(eventData, req.userId, env);

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
      `event_reminder_${req.userId}_${result.id}`,
      JSON.stringify(reminderData),
      { expirationTtl: 30 * 24 * 60 * 60 }
    );
  }

  res.json(result);
}));

router.delete('/events', requireAuth, asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  await deleteEvent(eventId, req.userId, env);
  res.json({ success: true });
}));

router.get('/event-reminders', requireUserId, asyncHandler(async (req, res) => {
  const { eventId } = req.query;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  const reminderData = await env.NOTIFICATIONS.get(`event_reminder_${req.userId}_${eventId}`, { type: 'json' });
  res.json(reminderData || null);
}));

// ==================== タスク API ====================

router.get('/tasks', requireAuth, asyncHandler(async (req, res) => {
  const tasks = await getAllIncompleteTasks(req.userId, env);
  res.json(tasks);
}));

router.post('/tasks', requireAuth, asyncHandler(async (req, res) => {
  const { title, due, listName, reminders } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const taskData = { title, due, listName };
  const result = await createTask(taskData, req.userId, env);

  if (reminders && reminders.length > 0 && due) {
    const reminderData = {
      type: 'task',
      title,
      due,
      reminders,
      createdAt: new Date().toISOString()
    };
    await env.NOTIFICATIONS.put(
      `task_reminder_${req.userId}_${result.id}`,
      JSON.stringify(reminderData),
      { expirationTtl: 90 * 24 * 60 * 60 }
    );
  }

  res.json(result);
}));

router.post('/tasks/complete', requireAuth, asyncHandler(async (req, res) => {
  const { taskId, listId } = req.body;
  if (!taskId || !listId) return res.status(400).json({ error: 'taskId, listId required' });

  await completeTask(taskId, listId, req.userId, env);
  res.json({ success: true });
}));

router.post('/tasks/uncomplete', requireAuth, asyncHandler(async (req, res) => {
  const { taskId, listId } = req.body;
  if (!taskId || !listId) return res.status(400).json({ error: 'taskId, listId required' });

  await uncompleteTask(taskId, listId, req.userId, env);
  res.json({ success: true });
}));

router.get('/tasks/completed', requireAuth, asyncHandler(async (req, res) => {
  const tasks = await getAllCompletedTasks(req.userId, env);
  res.json(tasks);
}));

router.post('/tasks/update', requireAuth, asyncHandler(async (req, res) => {
  const { taskId, listId, title, due } = req.body;
  if (!taskId || !listId || !title) return res.status(400).json({ error: 'taskId, listId, title required' });

  await updateTask(taskId, listId, { title, due }, req.userId, env);
  res.json({ success: true });
}));

router.delete('/tasks', requireAuth, asyncHandler(async (req, res) => {
  const { taskId, listId } = req.body;
  if (!taskId || !listId) return res.status(400).json({ error: 'taskId, listId required' });

  await deleteTask(taskId, listId, req.userId, env);
  res.json({ success: true });
}));

router.get('/tasklists', requireAuth, asyncHandler(async (req, res) => {
  const lists = await getTaskLists(req.userId, env);
  res.json(lists);
}));

router.get('/task-reminders', requireAuth, asyncHandler(async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });

  const reminderData = await env.NOTIFICATIONS.get(`task_reminder_${req.userId}_${taskId}`, { type: 'json' });
  res.json(reminderData || null);
}));

// ==================== メモ API ====================

router.get('/memos', requireUserId, asyncHandler(async (req, res) => {
  const memos = await getMemos(req.userId, env);
  res.json(memos);
}));

router.post('/memos', asyncHandler(async (req, res) => {
  const { userId, text, imageBase64, fileBase64, fileName, fileType, fileSize, audioBase64, audioDuration } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (!text && !imageBase64 && !fileBase64 && !audioBase64) {
    return res.status(400).json({ error: 'text, image, file or audio required' });
  }
  if (fileSize && fileSize > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'ファイルサイズが10MBを超えています' });
  }

  let imageUrl = null, fileUrl = null, audioUrl = null;

  if (imageBase64) {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    imageUrl = await uploadImage(imageBuffer, userId);
  }
  if (fileBase64 && fileName) {
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    fileUrl = await uploadFile(fileBuffer, userId, fileName, fileType || 'application/octet-stream');
  }
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
}));

router.delete('/memos', asyncHandler(async (req, res) => {
  const { userId, memoId } = req.body;
  if (!userId || !memoId) return res.status(400).json({ error: 'userId, memoId required' });

  await deleteMemo(memoId, userId, env);
  res.json({ success: true });
}));

// ==================== 設定 API ====================

router.get('/settings/notifications', requireUserId, asyncHandler(async (req, res) => {
  const settings = await env.NOTIFICATIONS.get(`settings:${req.userId}`, { type: 'json' });
  res.json(settings || { reminderEnabled: true });
}));

router.post('/settings/notifications', asyncHandler(async (req, res) => {
  const { userId, reminderEnabled } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  await registerUserForNotifications(userId, env);
  await updateUserNotificationSettings(userId, { reminderEnabled }, env);
  res.json({ success: true });
}));

router.get('/sync-settings', requireUserId, asyncHandler(async (req, res) => {
  const settings = await env.NOTIFICATIONS.get(`sync_settings:${req.userId}`, { type: 'json' });
  res.json(settings || { googleCalendarSync: false, googleTasksSync: false });
}));

router.post('/sync-settings', asyncHandler(async (req, res) => {
  const { userId, googleCalendarSync, googleTasksSync } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const settings = {
    googleCalendarSync: googleCalendarSync || false,
    googleTasksSync: googleTasksSync || false,
    updatedAt: new Date().toISOString()
  };
  await env.NOTIFICATIONS.put(`sync_settings:${userId}`, JSON.stringify(settings));
  res.json({ success: true, settings });
}));

// ==================== Claude Chat API ====================

router.get('/claude/history', requireUserId, asyncHandler(async (req, res) => {
  const historyKey = `claude_chat_history:${req.userId}`;
  const history = await env.NOTIFICATIONS.get(historyKey, { type: 'json' }) || [];
  res.json({ success: true, history });
}));

router.post('/claude/chat', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const historyKey = `claude_chat_history:${userId}`;
  let history = await env.NOTIFICATIONS.get(historyKey, { type: 'json' }) || [];

  history.push({
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  });

  const DEV_AGENT_URL = process.env.DEV_AGENT_URL || env.DEV_AGENT_URL;

  const vmResponse = await fetch(`${DEV_AGENT_URL}/api/claude/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      message,
      history: history.slice(-20)
    }),
    signal: AbortSignal.timeout(120000)
  });

  const vmData = await vmResponse.json();

  let response = 'エラーが発生しました';
  if (vmData.success && vmData.response) {
    response = vmData.response;
  } else if (vmData.error) {
    response = `エラー: ${vmData.error}`;
  }

  history.push({
    role: 'claude',
    content: response,
    timestamp: new Date().toISOString()
  });

  if (history.length > 50) {
    history = history.slice(-50);
  }
  await env.NOTIFICATIONS.put(historyKey, JSON.stringify(history));

  res.json({ success: true, response });
}));

// CORS プリフライト
router.options('/*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.sendStatus(204);
});

export default router;
