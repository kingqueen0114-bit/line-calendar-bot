/**
 * Local Routes - ローカルイベント・タスクAPI
 */
import { Router } from 'express';
import { env } from '../env-adapter.js';
import { setCors, requireUserId, asyncHandler } from '../middleware/common.js';
import { getLocalEvents, createLocalEvent, updateLocalEvent, deleteLocalEvent, getLocalEvent } from '../local-calendar.js';
import { getLocalTasks, createLocalTask, completeLocalTask, uncompleteLocalTask, updateLocalTask, deleteLocalTask, getLocalCompletedTasks } from '../local-tasks.js';

// ==================== ローカルイベントルーター ====================
const eventsRouter = Router();

eventsRouter.use(setCors);

eventsRouter.get('/', requireUserId, asyncHandler(async (req, res) => {
  const { days } = req.query;
  const events = await getLocalEvents(req.userId, env, parseInt(days) || 90);
  res.json(events);
}));

eventsRouter.post('/', asyncHandler(async (req, res) => {
  const { userId, title, date, startTime, endTime, isAllDay, location, url, memo, reminders } = req.body;

  if (!userId || !title || !date) {
    return res.status(400).json({ error: 'userId, title, date required' });
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

  const result = await createLocalEvent(eventData, userId, env);

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

    const usersJson = await env.NOTIFICATIONS.get('notification_users', { type: 'json' });
    const users = usersJson || [];
    if (!users.includes(userId)) {
      users.push(userId);
      await env.NOTIFICATIONS.put('notification_users', JSON.stringify(users));
    }
  }

  res.json(result);
}));

eventsRouter.put('/', asyncHandler(async (req, res) => {
  const { userId, eventId, title, date, startTime, endTime, isAllDay, location, url, memo, reminders } = req.body;

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId, eventId required' });
  }

  const existingEvent = await getLocalEvent(eventId, userId, env);
  if (!existingEvent) {
    return res.status(404).json({ error: 'Event not found' });
  }

  let description = '';
  if (url) description += url;
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

    const usersJson = await env.NOTIFICATIONS.get('notification_users', { type: 'json' });
    const users = usersJson || [];
    if (!users.includes(userId)) {
      users.push(userId);
      await env.NOTIFICATIONS.put('notification_users', JSON.stringify(users));
    }
  } else {
    await env.NOTIFICATIONS.delete(`event_reminder_${userId}_${eventId}`);
  }

  res.json(result);
}));

eventsRouter.delete('/', asyncHandler(async (req, res) => {
  const { userId, eventId } = req.body;
  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId, eventId required' });
  }

  await deleteLocalEvent(eventId, userId, env);
  res.json({ success: true });
}));

// ==================== ローカルタスクルーター ====================
const tasksRouter = Router();

tasksRouter.use(setCors);

tasksRouter.get('/', requireUserId, asyncHandler(async (req, res) => {
  const tasks = await getLocalTasks(req.userId, env);
  res.json(tasks);
}));

tasksRouter.post('/', asyncHandler(async (req, res) => {
  const { userId, title, due, listName, reminders } = req.body;

  if (!userId || !title) {
    return res.status(400).json({ error: 'userId, title required' });
  }

  const taskData = { title, due, listName };
  const result = await createLocalTask(taskData, userId, env);

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
}));

tasksRouter.post('/complete', asyncHandler(async (req, res) => {
  const { userId, taskId } = req.body;
  if (!userId || !taskId) {
    return res.status(400).json({ error: 'userId, taskId required' });
  }

  await completeLocalTask(taskId, userId, env);
  res.json({ success: true });
}));

tasksRouter.post('/uncomplete', asyncHandler(async (req, res) => {
  const { userId, taskId } = req.body;
  if (!userId || !taskId) {
    return res.status(400).json({ error: 'userId, taskId required' });
  }

  await uncompleteLocalTask(taskId, userId, env);
  res.json({ success: true });
}));

tasksRouter.post('/update', asyncHandler(async (req, res) => {
  const { userId, taskId, title, due } = req.body;
  if (!userId || !taskId || !title) {
    return res.status(400).json({ error: 'userId, taskId, title required' });
  }

  await updateLocalTask(taskId, { title, due }, userId, env);
  res.json({ success: true });
}));

tasksRouter.delete('/', asyncHandler(async (req, res) => {
  const { userId, taskId } = req.body;
  if (!userId || !taskId) {
    return res.status(400).json({ error: 'userId, taskId required' });
  }

  await deleteLocalTask(taskId, userId, env);
  res.json({ success: true });
}));

tasksRouter.get('/completed', requireUserId, asyncHandler(async (req, res) => {
  const tasks = await getLocalCompletedTasks(req.userId, env);
  res.json(tasks);
}));

// デフォルトエクスポート（互換性のため）
export default eventsRouter;

// 名前付きエクスポート
export { eventsRouter, tasksRouter };
