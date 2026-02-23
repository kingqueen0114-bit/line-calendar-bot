/**
 * 共有タスクリスト機能
 */

/**
 * 共有タスクリストを作成
 */
export async function createSharedTaskList(listData, userId, env) {
  const listId = `tl_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const inviteCode = generateInviteCode();

  const taskList = {
    id: listId,
    name: listData.name,
    color: listData.color || '#06c755',
    ownerId: userId,
    members: [userId],
    inviteCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await env.NOTIFICATIONS.put(`shared_tasklist:${listId}`, JSON.stringify(taskList));
  await env.NOTIFICATIONS.put(`tasklist_invite:${inviteCode}`, listId);
  await addTaskListToUser(userId, listId, env);

  return taskList;
}

/**
 * 共有タスクリストを取得
 */
export async function getSharedTaskList(listId, env) {
  return await env.NOTIFICATIONS.get(`shared_tasklist:${listId}`, { type: 'json' });
}

/**
 * ユーザーの共有タスクリスト一覧を取得
 */
export async function getUserSharedTaskLists(userId, env) {
  const listIds = await env.NOTIFICATIONS.get(`user_tasklists:${userId}`, { type: 'json' }) || [];
  const lists = [];

  for (const listId of listIds) {
    const list = await getSharedTaskList(listId, env);
    if (list) {
      lists.push(list);
    }
  }

  return lists;
}

/**
 * 共有タスクリストを更新
 */
export async function updateSharedTaskList(listId, updates, userId, env) {
  const list = await getSharedTaskList(listId, env);
  if (!list) {
    throw new Error('タスクリストが見つかりません');
  }

  if (!list.members.includes(userId)) {
    throw new Error('このタスクリストを編集する権限がありません');
  }

  if (updates.name) list.name = updates.name;
  if (updates.color) list.color = updates.color;

  list.updatedAt = new Date().toISOString();

  await env.NOTIFICATIONS.put(`shared_tasklist:${listId}`, JSON.stringify(list));

  return list;
}

/**
 * 招待コードでタスクリストに参加
 */
export async function joinTaskListByCode(inviteCode, userId, env) {
  const listId = await env.NOTIFICATIONS.get(`tasklist_invite:${inviteCode}`);
  if (!listId) {
    throw new Error('招待コードが無効です');
  }

  const list = await getSharedTaskList(listId, env);
  if (!list) {
    throw new Error('タスクリストが見つかりません');
  }

  if (list.members.includes(userId)) {
    throw new Error('すでにこのタスクリストに参加しています');
  }

  list.members.push(userId);
  list.updatedAt = new Date().toISOString();
  await env.NOTIFICATIONS.put(`shared_tasklist:${listId}`, JSON.stringify(list));
  await addTaskListToUser(userId, listId, env);

  return list;
}

/**
 * 共有タスクリストから退出
 */
export async function leaveSharedTaskList(listId, userId, env) {
  const list = await getSharedTaskList(listId, env);
  if (!list) {
    throw new Error('タスクリストが見つかりません');
  }

  if (list.ownerId === userId) {
    throw new Error('オーナーはタスクリストから退出できません。削除してください。');
  }

  list.members = list.members.filter(id => id !== userId);
  list.updatedAt = new Date().toISOString();
  await env.NOTIFICATIONS.put(`shared_tasklist:${listId}`, JSON.stringify(list));
  await removeTaskListFromUser(userId, listId, env);
}

/**
 * 共有タスクリストを削除（オーナーのみ）
 */
export async function deleteSharedTaskList(listId, userId, env) {
  const list = await getSharedTaskList(listId, env);
  if (!list) {
    throw new Error('タスクリストが見つかりません');
  }

  if (list.ownerId !== userId) {
    throw new Error('タスクリストを削除できるのはオーナーのみです');
  }

  // 全メンバーのリストから削除
  for (const memberId of list.members) {
    await removeTaskListFromUser(memberId, listId, env);
  }

  // タスクも削除
  const taskIds = await env.NOTIFICATIONS.get(`shared_tasks_list:${listId}`, { type: 'json' }) || [];
  for (const taskId of taskIds) {
    await env.NOTIFICATIONS.delete(`shared_task:${listId}:${taskId}`);
  }
  await env.NOTIFICATIONS.delete(`shared_tasks_list:${listId}`);

  await env.NOTIFICATIONS.delete(`tasklist_invite:${list.inviteCode}`);
  await env.NOTIFICATIONS.delete(`shared_tasklist:${listId}`);
}

/**
 * 共有タスクを作成
 */
export async function createSharedTask(taskData, listId, userId, env) {
  const list = await getSharedTaskList(listId, env);
  if (!list || !list.members.includes(userId)) {
    throw new Error('このタスクリストにアクセスできません');
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const task = {
    id: taskId,
    listId,
    title: taskData.title,
    due: taskData.due || null,
    completed: false,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await env.NOTIFICATIONS.put(`shared_task:${listId}:${taskId}`, JSON.stringify(task));

  const taskIds = await env.NOTIFICATIONS.get(`shared_tasks_list:${listId}`, { type: 'json' }) || [];
  taskIds.unshift(taskId);
  await env.NOTIFICATIONS.put(`shared_tasks_list:${listId}`, JSON.stringify(taskIds));

  return task;
}

/**
 * 共有タスクリストのタスク一覧を取得
 */
export async function getSharedTasks(listId, env, includeCompleted = false) {
  const taskIds = await env.NOTIFICATIONS.get(`shared_tasks_list:${listId}`, { type: 'json' }) || [];
  const tasks = [];

  for (const taskId of taskIds) {
    const task = await env.NOTIFICATIONS.get(`shared_task:${listId}:${taskId}`, { type: 'json' });
    if (task && (includeCompleted || !task.completed)) {
      tasks.push(task);
    }
  }

  return tasks;
}

/**
 * ユーザーの全共有タスクを取得
 */
export async function getAllSharedTasksForUser(userId, env) {
  const lists = await getUserSharedTaskLists(userId, env);
  const allTasks = [];

  for (const list of lists) {
    const tasks = await getSharedTasks(list.id, env, false);
    tasks.forEach(task => {
      allTasks.push({
        ...task,
        listTitle: list.name,
        listColor: list.color,
        isShared: true
      });
    });
  }

  return allTasks;
}

/**
 * 共有タスクを完了
 */
export async function completeSharedTask(taskId, listId, userId, env, userName = null) {
  const list = await getSharedTaskList(listId, env);
  if (!list || !list.members.includes(userId)) {
    throw new Error('このタスクリストにアクセスできません');
  }

  const task = await env.NOTIFICATIONS.get(`shared_task:${listId}:${taskId}`, { type: 'json' });
  if (!task) {
    throw new Error('タスクが見つかりません');
  }

  task.completed = true;
  task.completedBy = userId;
  task.completedByName = userName;
  task.completedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();

  await env.NOTIFICATIONS.put(`shared_task:${listId}:${taskId}`, JSON.stringify(task));

  return task;
}

/**
 * 共有タスクを削除
 */
export async function deleteSharedTask(taskId, listId, userId, env) {
  const list = await getSharedTaskList(listId, env);
  if (!list || !list.members.includes(userId)) {
    throw new Error('このタスクリストにアクセスできません');
  }

  await env.NOTIFICATIONS.delete(`shared_task:${listId}:${taskId}`);

  const taskIds = await env.NOTIFICATIONS.get(`shared_tasks_list:${listId}`, { type: 'json' }) || [];
  const newTaskIds = taskIds.filter(id => id !== taskId);
  await env.NOTIFICATIONS.put(`shared_tasks_list:${listId}`, JSON.stringify(newTaskIds));
}

/**
 * 共有タスクの完了を取り消す
 */
export async function uncompleteSharedTask(taskId, listId, userId, env) {
  const list = await getSharedTaskList(listId, env);
  if (!list || !list.members.includes(userId)) {
    throw new Error('このタスクリストにアクセスできません');
  }

  const task = await env.NOTIFICATIONS.get(`shared_task:${listId}:${taskId}`, { type: 'json' });
  if (!task) {
    throw new Error('タスクが見つかりません');
  }

  task.completed = false;
  task.completedBy = null;
  task.completedAt = null;
  task.updatedAt = new Date().toISOString();

  await env.NOTIFICATIONS.put(`shared_task:${listId}:${taskId}`, JSON.stringify(task));

  return task;
}

/**
 * ユーザーの全完了済み共有タスクを取得
 */
export async function getAllCompletedSharedTasksForUser(userId, env) {
  const lists = await getUserSharedTaskLists(userId, env);
  const allTasks = [];

  for (const list of lists) {
    const tasks = await getSharedTasks(list.id, env, true);
    tasks.filter(task => task.completed).forEach(task => {
      allTasks.push({
        ...task,
        listTitle: list.name,
        listColor: list.color,
        isShared: true
      });
    });
  }

  // 完了日時降順（新しい順）
  allTasks.sort((a, b) => {
    return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
  });

  return allTasks;
}

// ヘルパー関数
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function addTaskListToUser(userId, listId, env) {
  const key = `user_tasklists:${userId}`;
  const lists = await env.NOTIFICATIONS.get(key, { type: 'json' }) || [];
  if (!lists.includes(listId)) {
    lists.push(listId);
    await env.NOTIFICATIONS.put(key, JSON.stringify(lists));
  }
}

async function removeTaskListFromUser(userId, listId, env) {
  const key = `user_tasklists:${userId}`;
  let lists = await env.NOTIFICATIONS.get(key, { type: 'json' }) || [];
  lists = lists.filter(id => id !== listId);
  await env.NOTIFICATIONS.put(key, JSON.stringify(lists));
}
