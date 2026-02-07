/**
 * Shared Routes - 共有カレンダー・タスク・プロジェクトAPI
 */
import { Router } from 'express';
import { env } from '../env-adapter.js';
import { setCors, requireUserId, requireAuth, asyncHandler } from '../middleware/common.js';
import { sendLineMessage } from '../line.js';
import { getUserProjects, createProject, joinProjectByCode, leaveProject, updateProject, deleteProject, getProjectMembers, getProject, canUserEditProject } from '../project.js';
import { getAllSharedEventsForUser, formatSharedEventForDisplay, createSharedEvent, deleteSharedEvent } from '../shared-calendar.js';
import {
  getUserSharedTaskLists,
  createSharedTaskList,
  updateSharedTaskList,
  joinTaskListByCode,
  leaveSharedTaskList,
  deleteSharedTaskList,
  getAllSharedTasksForUser,
  createSharedTask,
  completeSharedTask,
  deleteSharedTask,
  uncompleteSharedTask,
  getAllCompletedSharedTasksForUser,
  getSharedTaskList,
  canUserEditTaskList
} from '../shared-tasklist.js';

const router = Router();

router.use(setCors);

// ==================== プロジェクト ====================

router.get('/projects', requireAuth, asyncHandler(async (req, res) => {
  const projects = await getUserProjects(req.userId, env);
  res.json(projects);
}));

router.post('/projects', asyncHandler(async (req, res) => {
  const { userId, name, description, color, isPersonal, editPermission } = req.body;
  if (!userId || !name) {
    return res.status(400).json({ error: 'userId, name required' });
  }

  const project = await createProject({ name, description, color, isPersonal, editPermission }, userId, env);
  res.json(project);
}));

router.post('/projects/join', requireAuth, asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) {
    return res.status(400).json({ error: 'inviteCode required' });
  }

  const project = await joinProjectByCode(inviteCode.toUpperCase(), req.userId, env);
  res.json(project);
}));

router.post('/projects/leave', requireAuth, asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'projectId required' });
  }

  await leaveProject(projectId, req.userId, env);
  res.json({ success: true });
}));

router.post('/projects/update', requireAuth, asyncHandler(async (req, res) => {
  const { projectId, name, color } = req.body;
  if (!projectId || !name) {
    return res.status(400).json({ error: 'projectId, name required' });
  }

  const project = await updateProject(projectId, { name, color }, req.userId, env);
  res.json(project);
}));

router.delete('/projects', requireAuth, asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: 'projectId required' });
  }

  await deleteProject(projectId, req.userId, env);
  res.json({ success: true });
}));

router.get('/projects/members', requireAuth, asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) {
    return res.status(400).json({ error: 'projectId required' });
  }

  const members = await getProjectMembers(projectId, env);
  res.json(members);
}));

// ==================== 共有カレンダー ====================

router.get('/events', requireAuth, asyncHandler(async (req, res) => {
  const events = await getAllSharedEventsForUser(req.userId, env, 90);
  const formatted = events.map(formatSharedEventForDisplay);
  res.json(formatted);
}));

router.post('/events', asyncHandler(async (req, res) => {
  const { userId, projectId, title, date, startTime, endTime, isAllDay, location, notifyMembers } = req.body;

  if (!userId || !projectId || !title || !date) {
    return res.status(400).json({ error: 'userId, projectId, title, date required' });
  }

  const project = await getProject(projectId, env);
  if (!project || !project.members.includes(userId)) {
    return res.status(403).json({ error: 'このカレンダーにアクセスできません' });
  }

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
}));

router.delete('/events', asyncHandler(async (req, res) => {
  const { userId, eventId, projectId } = req.body;
  if (!userId || !eventId || !projectId) {
    return res.status(400).json({ error: 'userId, eventId, projectId required' });
  }

  const project = await getProject(projectId, env);
  if (!project || !project.members.includes(userId)) {
    return res.status(403).json({ error: 'このカレンダーにアクセスできません' });
  }

  const canEdit = await canUserEditProject(projectId, userId, env);
  if (!canEdit) {
    return res.status(403).json({ error: 'このカレンダーを編集する権限がありません' });
  }

  await deleteSharedEvent(eventId, projectId, userId, env);
  res.json({ success: true });
}));

// ==================== 共有タスクリスト ====================

router.get('/tasklists', requireAuth, asyncHandler(async (req, res) => {
  const lists = await getUserSharedTaskLists(req.userId, env);
  res.json(lists);
}));

router.post('/tasklists', asyncHandler(async (req, res) => {
  const { userId, name, color, editPermission } = req.body;
  if (!userId || !name) {
    return res.status(400).json({ error: 'userId, name required' });
  }

  const list = await createSharedTaskList({ name, color, editPermission }, userId, env);
  res.json(list);
}));

router.post('/tasklists/update', asyncHandler(async (req, res) => {
  const { userId, listId, name, color, editPermission } = req.body;
  if (!userId || !listId || !name) {
    return res.status(400).json({ error: 'userId, listId, name required' });
  }

  const list = await updateSharedTaskList(listId, { name, color, editPermission }, userId, env);
  res.json(list);
}));

router.post('/tasklists/join', requireAuth, asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) {
    return res.status(400).json({ error: 'inviteCode required' });
  }

  const list = await joinTaskListByCode(inviteCode.toUpperCase(), req.userId, env);
  res.json(list);
}));

router.post('/tasklists/leave', requireAuth, asyncHandler(async (req, res) => {
  const { listId } = req.body;
  if (!listId) {
    return res.status(400).json({ error: 'listId required' });
  }

  await leaveSharedTaskList(listId, req.userId, env);
  res.json({ success: true });
}));

router.delete('/tasklists', requireAuth, asyncHandler(async (req, res) => {
  const { listId } = req.body;
  if (!listId) {
    return res.status(400).json({ error: 'listId required' });
  }

  await deleteSharedTaskList(listId, req.userId, env);
  res.json({ success: true });
}));

// ==================== 共有タスク ====================

router.get('/tasks', requireAuth, asyncHandler(async (req, res) => {
  const tasks = await getAllSharedTasksForUser(req.userId, env);
  res.json(tasks);
}));

router.post('/tasks', asyncHandler(async (req, res) => {
  const { userId, listId, title, due, notifyMembers } = req.body;
  if (!userId || !listId || !title) {
    return res.status(400).json({ error: 'userId, listId, title required' });
  }

  const canEdit = await canUserEditTaskList(listId, userId, env);
  if (!canEdit) {
    return res.status(403).json({ error: 'このタスクリストを編集する権限がありません' });
  }

  const task = await createSharedTask({ title, due }, listId, userId, env);

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
}));

router.post('/tasks/complete', asyncHandler(async (req, res) => {
  const { userId, taskId, listId, userName } = req.body;
  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  const canEdit = await canUserEditTaskList(listId, userId, env);
  if (!canEdit) {
    return res.status(403).json({ error: 'このタスクリストを編集する権限がありません' });
  }

  await completeSharedTask(taskId, listId, userId, env, userName);
  res.json({ success: true });
}));

router.post('/tasks/uncomplete', requireAuth, asyncHandler(async (req, res) => {
  const { taskId, listId } = req.body;
  if (!taskId || !listId) {
    return res.status(400).json({ error: 'taskId, listId required' });
  }

  await uncompleteSharedTask(taskId, listId, req.userId, env);
  res.json({ success: true });
}));

router.delete('/tasks', asyncHandler(async (req, res) => {
  const { userId, taskId, listId } = req.body;
  if (!userId || !taskId || !listId) {
    return res.status(400).json({ error: 'userId, taskId, listId required' });
  }

  const canEdit = await canUserEditTaskList(listId, userId, env);
  if (!canEdit) {
    return res.status(403).json({ error: 'このタスクリストを編集する権限がありません' });
  }

  await deleteSharedTask(taskId, listId, userId, env);
  res.json({ success: true });
}));

router.get('/tasks/completed', requireAuth, asyncHandler(async (req, res) => {
  const tasks = await getAllCompletedSharedTasksForUser(req.userId, env);
  res.json(tasks);
}));

export default router;
