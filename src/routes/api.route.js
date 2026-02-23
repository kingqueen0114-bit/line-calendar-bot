import express from 'express';
import { registerUserForNotifications, updateUserNotificationSettings } from '../app.js';

const router = express.Router();
// LIFF API: 認証状態確認
router.get('/api/auth-status', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { env } = await import('./utils/env-adapter.js');
    const isAuth = await isUserAuthenticated(userId, env);
    res.json({ authenticated: isAuth });
  } catch (error) {
    console.error('Auth status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LIFF API: 認証URL取得
router.get('/api/auth-url', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { getAuthorizationUrl } = await import('./services/auth.service.js');
    const { env } = await import('./utils/env-adapter.js');
    const authUrl = getAuthorizationUrl(userId, env);
    res.json({ authUrl });
  } catch (error) {
    console.error('Auth URL generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LIFF API エンドポイント
router.get('/api/events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getUpcomingEvents } = await import('./services/google-calendar.service.js');
    const { env } = await import('./utils/env-adapter.js');
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
    if (err.status === 401) {
      return res.status(401).json({ error: 'Auth error' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/calendars', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getCalendarList } = await import('./services/google-calendar.service.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const calendars = await getCalendarList(userId, env);
    res.json(calendars);
  } catch (err) {
    console.error('LIFF API calendars error:', err);
    if (err.status === 401) {
      return res.status(401).json({ error: 'Auth error' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getAllIncompleteTasks } = await import('./services/google-tasks.service.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const tasks = await getAllIncompleteTasks(userId, env);
    res.json(tasks);
  } catch (err) {
    console.error('LIFF API tasks error:', err);
    if (err.status === 401) {
      return res.status(401).json({ error: 'Auth error' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/tasks/complete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { completeTask } = await import('./services/google-tasks.service.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/tasks/uncomplete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { uncompleteTask } = await import('./services/google-tasks.service.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.get('/api/tasks/completed', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getAllCompletedTasks } = await import('./services/google-tasks.service.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const tasks = await getAllCompletedTasks(userId, env);
    res.json(tasks);
  } catch (err) {
    console.error('LIFF API completed tasks error:', err);
    if (err.status === 401) {
      return res.status(401).json({ error: 'Auth error' });
    }
    res.status(500).json({ error: err.message });
  }
});

// タスク更新
router.post('/api/tasks/update', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId, title, due } = req.body;

  if (!userId || !taskId || !listId || !title) {
    return res.status(400).json({ error: 'userId, taskId, listId, title required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { updateTask } = await import('./services/google-tasks.service.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, title, date, startTime, endTime, isAllDay, location, url, memo } = req.body;

  if (!userId || !title || !date) {
    return res.status(400).json({ error: 'userId, title, date required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { createEvent } = await import('./services/google-calendar.service.js');
    const { env } = await import('./utils/env-adapter.js');

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
    res.json(result);
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 予定削除
router.delete('/api/events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, eventId } = req.body;

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId, eventId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { deleteEvent } = await import('./services/google-calendar.service.js');
    const { env } = await import('./utils/env-adapter.js');

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

// タスクリスト取得
router.get('/api/tasklists', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getTaskLists } = await import('./services/google-tasks.service.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, title, due, listName } = req.body;

  if (!userId || !title) {
    return res.status(400).json({ error: 'userId, title required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { createTask } = await import('./services/google-tasks.service.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const taskData = { title, due, listName };
    const result = await createTask(taskData, userId, env);
    res.json(result);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// タスク削除
router.delete('/api/tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { deleteTask } = await import('./services/google-tasks.service.js');
    const { env } = await import('./utils/env-adapter.js');

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

// メモ一覧取得
router.get('/api/memos', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getMemos } = await import('./database/memo.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const memos = await getMemos(userId, env);
    res.json(memos);
  } catch (err) {
    console.error('Get memos error:', err);
    res.status(500).json({ error: err.message });
  }
});

// メモ作成（画像はBase64で送信）
router.post('/api/memos', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, text, imageBase64 } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  if (!text && !imageBase64) {
    return res.status(400).json({ error: 'text or image required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { createMemo, uploadImage } = await import('./database/memo.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let imageUrl = null;

    // 画像がある場合はGCSにアップロード
    if (imageBase64) {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      imageUrl = await uploadImage(imageBuffer, userId);
    }

    const memo = await createMemo({ text, imageUrl }, userId, env);
    res.json(memo);
  } catch (err) {
    console.error('Create memo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// メモ削除
router.delete('/api/memos', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, memoId } = req.body;

  if (!userId || !memoId) {
    return res.status(400).json({ error: 'userId, memoId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { deleteMemo } = await import('./database/memo.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await deleteMemo(memoId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete memo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// プロジェクト一覧取得
router.get('/api/projects', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getUserProjects } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/projects', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, name, description, color, isPersonal } = req.body;

  if (!userId || !name) {
    return res.status(400).json({ error: 'userId, name required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { createProject } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const project = await createProject({ name, description, color, isPersonal }, userId, env);
    res.json(project);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: err.message });
  }
});

// プロジェクト参加（招待コード）
router.post('/api/projects/join', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, inviteCode } = req.body;

  if (!userId || !inviteCode) {
    return res.status(400).json({ error: 'userId, inviteCode required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { joinProjectByCode } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/projects/leave', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId } = req.body;

  if (!userId || !projectId) {
    return res.status(400).json({ error: 'userId, projectId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { leaveProject } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/projects/update', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId, name, color } = req.body;

  if (!userId || !projectId || !name) {
    return res.status(400).json({ error: 'userId, projectId, name required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { updateProject } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.delete('/api/projects', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId } = req.body;

  if (!userId || !projectId) {
    return res.status(400).json({ error: 'userId, projectId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { deleteProject } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.get('/api/projects/members', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId } = req.query;

  if (!userId || !projectId) {
    return res.status(400).json({ error: 'userId, projectId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getProjectMembers } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.get('/api/shared-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getAllSharedEventsForUser, formatSharedEventForDisplay } = await import('./database/shared-calendar.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/shared-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, projectId, title, date, startTime, endTime, isAllDay, location } = req.body;

  if (!userId || !projectId || !title || !date) {
    return res.status(400).json({ error: 'userId, projectId, title, date required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { createSharedEvent } = await import('./database/shared-calendar.js');
    const { getProject } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // プロジェクトのメンバーかチェック
    const project = await getProject(projectId, env);
    if (!project || !project.members.includes(userId)) {
      return res.status(403).json({ error: 'このカレンダーにアクセスできません' });
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
    res.json(event);
  } catch (err) {
    console.error('Create shared event error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有カレンダーの予定削除
router.delete('/api/shared-events', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, eventId, projectId } = req.body;

  if (!userId || !eventId || !projectId) {
    return res.status(400).json({ error: 'userId, eventId, projectId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { deleteSharedEvent } = await import('./database/shared-calendar.js');
    const { getProject } = await import('./database/project.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // プロジェクトのメンバーかチェック
    const project = await getProject(projectId, env);
    if (!project || !project.members.includes(userId)) {
      return res.status(403).json({ error: 'このカレンダーにアクセスできません' });
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
router.get('/api/shared-tasklists', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getUserSharedTaskLists } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/shared-tasklists', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, name, color } = req.body;

  if (!userId || !name) {
    return res.status(400).json({ error: 'userId, name required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { createSharedTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const list = await createSharedTaskList({ name, color }, userId, env);
    res.json(list);
  } catch (err) {
    console.error('Create shared tasklist error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスクリスト更新
router.post('/api/shared-tasklists/update', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, listId, name, color } = req.body;

  if (!userId || !listId || !name) {
    return res.status(400).json({ error: 'userId, listId, name required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { updateSharedTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const list = await updateSharedTaskList(listId, { name, color }, userId, env);
    res.json(list);
  } catch (err) {
    console.error('Update shared tasklist error:', err);
    res.status(400).json({ error: err.message });
  }
});

// 共有タスクリストに参加
router.post('/api/shared-tasklists/join', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, inviteCode } = req.body;

  if (!userId || !inviteCode) {
    return res.status(400).json({ error: 'userId, inviteCode required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { joinTaskListByCode } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/shared-tasklists/leave', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, listId } = req.body;

  if (!userId || !listId) {
    return res.status(400).json({ error: 'userId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { leaveSharedTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.delete('/api/shared-tasklists', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, listId } = req.body;

  if (!userId || !listId) {
    return res.status(400).json({ error: 'userId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { deleteSharedTaskList } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.get('/api/shared-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getAllSharedTasksForUser } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.post('/api/shared-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, listId, title, due } = req.body;

  if (!userId || !listId || !title) {
    return res.status(400).json({ error: 'userId, listId, title required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { createSharedTask } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const task = await createSharedTask({ title, due }, listId, userId, env);
    res.json(task);
  } catch (err) {
    console.error('Create shared task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスク完了
router.post('/api/shared-tasks/complete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId, userName } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { completeSharedTask } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await completeSharedTask(taskId, listId, userId, env, userName);
    res.json({ success: true });
  } catch (err) {
    console.error('Complete shared task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスク削除
router.delete('/api/shared-tasks', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { deleteSharedTask } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

    if (!await isUserAuthenticated(userId, env)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await deleteSharedTask(taskId, listId, userId, env);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete shared task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 共有タスク完了取消し
router.post('/api/shared-tasks/uncomplete', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, taskId, listId } = req.body;

  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { uncompleteSharedTask } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.get('/api/shared-tasks/completed', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { isUserAuthenticated } = await import('./services/auth.service.js');
    const { getAllCompletedSharedTasksForUser } = await import('./shared-tasklist.js');
    const { env } = await import('./utils/env-adapter.js');

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
router.get('/api/settings/notifications', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { env } = await import('./utils/env-adapter.js');
    const settings = await env.NOTIFICATIONS.get(`settings:${userId}`, { type: 'json' });
    res.json(settings || { reminderEnabled: true });
  } catch (err) {
    console.error('Get notification settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 通知設定更新
router.post('/api/settings/notifications', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, reminderEnabled } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { env } = await import('./utils/env-adapter.js');
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

// 同期するカレンダー設定取得
router.get('/api/settings/calendars', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const { env } = await import('./utils/env-adapter.js');
    const settings = await env.NOTIFICATIONS.get(`settings:${userId}`, { type: 'json' });
    // デフォルトは空配列 (or undefined)。もし無ければ後で「メインのみ表示」等に倒す。
    res.json(settings && settings.enabledCalendars ? settings.enabledCalendars : []);
  } catch (err) {
    console.error('Get calendar settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 同期するカレンダー設定更新
router.post('/api/settings/calendars', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId, enabledCalendars } = req.body;

  if (!userId || !Array.isArray(enabledCalendars)) {
    return res.status(400).json({ error: 'userId and enabledCalendars array required' });
  }

  try {
    const { env } = await import('./utils/env-adapter.js');

    // 既存設定を取得してマージ
    let settings = await env.NOTIFICATIONS.get(`settings:${userId}`, { type: 'json' });
    if (!settings) settings = {};
    settings.enabledCalendars = enabledCalendars;

    await env.NOTIFICATIONS.put(`settings:${userId}`, settings, { type: 'json' });

    res.json({ success: true });
  } catch (err) {
    console.error('Update calendar settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CORS プリフライト
router.options('/api/*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.sendStatus(204);
});

export default router;
