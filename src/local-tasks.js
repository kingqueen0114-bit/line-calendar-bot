/**
 * ローカルタスク機能 - KVストレージベースの個人タスク管理
 * Google Tasks APIを使用せず、KVに直接保存
 */

// ユニークIDを生成
function generateTaskId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

// デフォルトのローカルタスクリスト
const DEFAULT_LOCAL_LIST = {
  id: 'local_default',
  title: 'マイタスク',
  isLocal: true
};

/**
 * ローカルタスクリストを取得
 */
export async function getLocalTaskLists(userId, env) {
  const listKey = `local_tasklists:${userId}`;
  const lists = await env.NOTIFICATIONS.get(listKey, { type: 'json' });

  if (!lists || lists.length === 0) {
    // デフォルトリストを作成
    await env.NOTIFICATIONS.put(listKey, JSON.stringify([DEFAULT_LOCAL_LIST]));
    return [DEFAULT_LOCAL_LIST];
  }

  return lists;
}

/**
 * ローカルタスクを作成
 */
export async function createLocalTask(taskData, userId, env) {
  const taskId = generateTaskId();
  const listId = taskData.listId || 'local_default';

  const task = {
    id: taskId,
    title: taskData.title,
    status: 'needsAction',
    due: taskData.due || null,
    notes: taskData.notes || null,
    starred: taskData.starred || false,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    completed: null,
    listId: listId,
    listTitle: taskData.listName || 'マイタスク',
    isLocal: true
  };

  // タスクを保存
  await env.NOTIFICATIONS.put(
    `local_task:${userId}:${taskId}`,
    JSON.stringify(task),
    { expirationTtl: 365 * 24 * 60 * 60 } // 1年
  );

  // タスクリストに追加
  const listKey = `local_tasks_list:${userId}`;
  const existingList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  existingList.push({
    id: taskId,
    listId: listId,
    created: task.created,
    status: 'needsAction'
  });
  await env.NOTIFICATIONS.put(listKey, JSON.stringify(existingList));

  return task;
}

/**
 * 未完了のローカルタスクを取得
 */
export async function getLocalTasks(userId, env) {
  const listKey = `local_tasks_list:${userId}`;
  const taskList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];

  const tasks = [];

  for (const item of taskList) {
    if (item.status === 'completed') continue;

    const taskData = await env.NOTIFICATIONS.get(`local_task:${userId}:${item.id}`, { type: 'json' });
    if (taskData && taskData.status !== 'completed') {
      tasks.push(taskData);
    }
  }

  // スマートソート: スター → 期限 → 更新日時
  tasks.sort((a, b) => {
    // 1. スター付き優先
    if (a.starred !== b.starred) {
      return a.starred ? -1 : 1;
    }

    // 2. 期限昇順（期限あり → 期限なし）
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    if (a.due && b.due) {
      const dateCompare = new Date(a.due) - new Date(b.due);
      if (dateCompare !== 0) return dateCompare;
    }

    // 3. 更新日時降順（新しい順）
    return new Date(b.updated || 0) - new Date(a.updated || 0);
  });

  return tasks;
}

/**
 * 完了済みのローカルタスクを取得
 */
export async function getLocalCompletedTasks(userId, env) {
  const listKey = `local_tasks_list:${userId}`;
  const taskList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];

  const tasks = [];

  for (const item of taskList) {
    if (item.status !== 'completed') continue;

    const taskData = await env.NOTIFICATIONS.get(`local_task:${userId}:${item.id}`, { type: 'json' });
    if (taskData && taskData.status === 'completed') {
      tasks.push(taskData);
    }
  }

  // 完了日時降順（新しい順）
  tasks.sort((a, b) => {
    return new Date(b.completed || 0) - new Date(a.completed || 0);
  });

  return tasks;
}

/**
 * ローカルタスクを完了にする
 */
export async function completeLocalTask(taskId, userId, env) {
  const task = await env.NOTIFICATIONS.get(`local_task:${userId}:${taskId}`, { type: 'json' });

  if (!task) {
    throw new Error('タスクが見つかりません');
  }

  task.status = 'completed';
  task.completed = new Date().toISOString();
  task.updated = new Date().toISOString();

  await env.NOTIFICATIONS.put(
    `local_task:${userId}:${taskId}`,
    JSON.stringify(task),
    { expirationTtl: 365 * 24 * 60 * 60 }
  );

  // リストのステータスも更新
  const listKey = `local_tasks_list:${userId}`;
  const taskList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  const updatedList = taskList.map(item => {
    if (item.id === taskId) {
      return { ...item, status: 'completed' };
    }
    return item;
  });
  await env.NOTIFICATIONS.put(listKey, JSON.stringify(updatedList));

  return task;
}

/**
 * ローカルタスクの完了を取り消す
 */
export async function uncompleteLocalTask(taskId, userId, env) {
  const task = await env.NOTIFICATIONS.get(`local_task:${userId}:${taskId}`, { type: 'json' });

  if (!task) {
    throw new Error('タスクが見つかりません');
  }

  task.status = 'needsAction';
  task.completed = null;
  task.updated = new Date().toISOString();

  await env.NOTIFICATIONS.put(
    `local_task:${userId}:${taskId}`,
    JSON.stringify(task),
    { expirationTtl: 365 * 24 * 60 * 60 }
  );

  // リストのステータスも更新
  const listKey = `local_tasks_list:${userId}`;
  const taskList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  const updatedList = taskList.map(item => {
    if (item.id === taskId) {
      return { ...item, status: 'needsAction' };
    }
    return item;
  });
  await env.NOTIFICATIONS.put(listKey, JSON.stringify(updatedList));

  return task;
}

/**
 * ローカルタスクを削除
 */
export async function deleteLocalTask(taskId, userId, env) {
  // タスクを削除
  await env.NOTIFICATIONS.delete(`local_task:${userId}:${taskId}`);

  // リストから削除
  const listKey = `local_tasks_list:${userId}`;
  const taskList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  const newList = taskList.filter(item => item.id !== taskId);
  await env.NOTIFICATIONS.put(listKey, JSON.stringify(newList));

  return { success: true };
}

/**
 * ローカルタスクを更新
 */
export async function updateLocalTask(taskId, updates, userId, env) {
  const task = await env.NOTIFICATIONS.get(`local_task:${userId}:${taskId}`, { type: 'json' });

  if (!task) {
    throw new Error('タスクが見つかりません');
  }

  if (updates.title !== undefined) {
    task.title = updates.title;
  }
  if (updates.due !== undefined) {
    task.due = updates.due;
  }
  if (updates.notes !== undefined) {
    task.notes = updates.notes;
  }
  if (updates.starred !== undefined) {
    task.starred = updates.starred;
  }

  task.updated = new Date().toISOString();

  await env.NOTIFICATIONS.put(
    `local_task:${userId}:${taskId}`,
    JSON.stringify(task),
    { expirationTtl: 365 * 24 * 60 * 60 }
  );

  return task;
}

/**
 * 単一のローカルタスクを取得
 */
export async function getLocalTask(taskId, userId, env) {
  return await env.NOTIFICATIONS.get(`local_task:${userId}:${taskId}`, { type: 'json' });
}
