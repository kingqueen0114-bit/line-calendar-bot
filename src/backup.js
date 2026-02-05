/**
 * バックアップ機能 - ユーザーデータのエクスポート/インポート/自動バックアップ
 */

const BACKUP_VERSION = '1.0';
const MAX_BACKUPS = 7; // 保持するバックアップ数

/**
 * ユーザーの全データをエクスポート
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object>} - エクスポートデータ
 */
export async function exportUserData(userId, env) {
  const exportData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    userId: userId,
    data: {
      events: [],
      tasks: [],
      memos: [],
      eventReminders: [],
      taskReminders: [],
      settings: null,
      syncSettings: null,
      // 共有データ
      sharedCalendars: [],
      sharedCalendarEvents: [],
      sharedTaskLists: [],
      sharedTasks: [],
      // 参加している共有カレンダー/タスクリストのID
      joinedCalendarIds: [],
      joinedTaskListIds: []
    }
  };

  // ローカルイベントを取得
  const eventListKey = `local_events_list:${userId}`;
  const eventList = await env.NOTIFICATIONS.get(eventListKey, { type: 'json' }) || [];
  for (const item of eventList) {
    const event = await env.NOTIFICATIONS.get(`local_event:${userId}:${item.id}`, { type: 'json' });
    if (event) {
      exportData.data.events.push(event);
      // イベントのリマインダーも取得
      const reminder = await env.NOTIFICATIONS.get(`event_reminder_${userId}_${item.id}`, { type: 'json' });
      if (reminder) {
        exportData.data.eventReminders.push({ eventId: item.id, ...reminder });
      }
    }
  }

  // ローカルタスクを取得
  const taskListKey = `local_tasks_list:${userId}`;
  const taskList = await env.NOTIFICATIONS.get(taskListKey, { type: 'json' }) || [];
  for (const item of taskList) {
    const task = await env.NOTIFICATIONS.get(`local_task:${userId}:${item.id}`, { type: 'json' });
    if (task) {
      exportData.data.tasks.push(task);
      // タスクのリマインダーも取得
      const reminder = await env.NOTIFICATIONS.get(`task_reminder_${userId}_${item.id}`, { type: 'json' });
      if (reminder) {
        exportData.data.taskReminders.push({ taskId: item.id, ...reminder });
      }
    }
  }

  // メモを取得
  const memoListKey = `memo_list:${userId}`;
  const memoList = await env.NOTIFICATIONS.get(memoListKey, { type: 'json' }) || [];
  for (const memoId of memoList) {
    const memo = await env.NOTIFICATIONS.get(`memo:${userId}:${memoId}`, { type: 'json' });
    if (memo) {
      exportData.data.memos.push(memo);
    }
  }

  // 設定を取得
  exportData.data.settings = await env.NOTIFICATIONS.get(`settings:${userId}`, { type: 'json' });
  exportData.data.syncSettings = await env.NOTIFICATIONS.get(`sync_settings:${userId}`, { type: 'json' });

  // 共有カレンダー（プロジェクト）を取得
  const projectListKey = `user_projects:${userId}`;
  const projectIds = await env.NOTIFICATIONS.get(projectListKey, { type: 'json' }) || [];
  exportData.data.joinedCalendarIds = projectIds;

  for (const projectId of projectIds) {
    const project = await env.NOTIFICATIONS.get(`project:${projectId}`, { type: 'json' });
    if (project && project.ownerId === userId) {
      // オーナーの場合はカレンダーデータも保存
      exportData.data.sharedCalendars.push(project);

      // 共有カレンダーのイベントを取得
      const sharedEventIds = await env.NOTIFICATIONS.get(`shared_events_list:${projectId}`, { type: 'json' }) || [];
      for (const eventId of sharedEventIds) {
        const sharedEvent = await env.NOTIFICATIONS.get(`shared_event:${projectId}:${eventId}`, { type: 'json' });
        if (sharedEvent) {
          exportData.data.sharedCalendarEvents.push({ projectId, ...sharedEvent });
        }
      }
    }
  }

  // 共有タスクリストを取得
  const taskListIdsKey = `user_tasklists:${userId}`;
  const sharedTaskListIds = await env.NOTIFICATIONS.get(taskListIdsKey, { type: 'json' }) || [];
  exportData.data.joinedTaskListIds = sharedTaskListIds;

  for (const listId of sharedTaskListIds) {
    const taskListData = await env.NOTIFICATIONS.get(`shared_tasklist:${listId}`, { type: 'json' });
    if (taskListData && taskListData.ownerId === userId) {
      // オーナーの場合はタスクリストデータも保存
      exportData.data.sharedTaskLists.push(taskListData);

      // 共有タスクリストのタスクを取得
      const sharedTaskIds = await env.NOTIFICATIONS.get(`shared_tasks_list:${listId}`, { type: 'json' }) || [];
      for (const taskId of sharedTaskIds) {
        const sharedTask = await env.NOTIFICATIONS.get(`shared_task:${listId}:${taskId}`, { type: 'json' });
        if (sharedTask) {
          exportData.data.sharedTasks.push({ listId, ...sharedTask });
        }
      }
    }
  }

  return exportData;
}

/**
 * ユーザーデータをインポート（復元）
 * @param {string} userId - ユーザーID
 * @param {object} importData - インポートデータ
 * @param {object} env - 環境オブジェクト
 * @param {boolean} merge - 既存データとマージするか（false=上書き）
 * @returns {Promise<object>} - インポート結果
 */
export async function importUserData(userId, importData, env, merge = false) {
  const result = {
    events: 0,
    tasks: 0,
    memos: 0,
    reminders: 0,
    sharedCalendars: 0,
    sharedCalendarEvents: 0,
    sharedTaskLists: 0,
    sharedTasks: 0
  };

  // バージョンチェック
  if (!importData.version || !importData.data) {
    throw new Error('無効なバックアップファイルです');
  }

  const data = importData.data;

  // マージしない場合は既存データを削除
  if (!merge) {
    await clearUserData(userId, env);
  }

  // イベントをインポート
  if (data.events && data.events.length > 0) {
    const eventList = [];
    for (const event of data.events) {
      await env.NOTIFICATIONS.put(
        `local_event:${userId}:${event.id}`,
        JSON.stringify(event),
        { expirationTtl: 365 * 24 * 60 * 60 }
      );
      eventList.push({
        id: event.id,
        date: getEventDate(event),
        created: event.created
      });
      result.events++;
    }
    await env.NOTIFICATIONS.put(`local_events_list:${userId}`, JSON.stringify(eventList));
  }

  // イベントリマインダーをインポート
  if (data.eventReminders && data.eventReminders.length > 0) {
    for (const reminder of data.eventReminders) {
      const { eventId, ...reminderData } = reminder;
      await env.NOTIFICATIONS.put(
        `event_reminder_${userId}_${eventId}`,
        JSON.stringify(reminderData),
        { expirationTtl: 30 * 24 * 60 * 60 }
      );
      result.reminders++;
    }
  }

  // タスクをインポート
  if (data.tasks && data.tasks.length > 0) {
    const taskList = [];
    for (const task of data.tasks) {
      await env.NOTIFICATIONS.put(
        `local_task:${userId}:${task.id}`,
        JSON.stringify(task),
        { expirationTtl: 365 * 24 * 60 * 60 }
      );
      taskList.push({
        id: task.id,
        listId: task.listId,
        created: task.created,
        status: task.status
      });
      result.tasks++;
    }
    await env.NOTIFICATIONS.put(`local_tasks_list:${userId}`, JSON.stringify(taskList));
  }

  // タスクリマインダーをインポート
  if (data.taskReminders && data.taskReminders.length > 0) {
    for (const reminder of data.taskReminders) {
      const { taskId, ...reminderData } = reminder;
      await env.NOTIFICATIONS.put(
        `task_reminder_${userId}_${taskId}`,
        JSON.stringify(reminderData),
        { expirationTtl: 30 * 24 * 60 * 60 }
      );
      result.reminders++;
    }
  }

  // メモをインポート
  if (data.memos && data.memos.length > 0) {
    const memoList = [];
    for (const memo of data.memos) {
      await env.NOTIFICATIONS.put(
        `memo:${userId}:${memo.id}`,
        JSON.stringify(memo)
      );
      memoList.push(memo.id);
      result.memos++;
    }
    await env.NOTIFICATIONS.put(`memo_list:${userId}`, JSON.stringify(memoList));
  }

  // 設定をインポート
  if (data.settings) {
    await env.NOTIFICATIONS.put(`settings:${userId}`, JSON.stringify(data.settings));
  }
  if (data.syncSettings) {
    await env.NOTIFICATIONS.put(`sync_settings:${userId}`, JSON.stringify(data.syncSettings));
  }

  // 共有カレンダーをインポート（オーナーのもののみ）
  if (data.sharedCalendars && data.sharedCalendars.length > 0) {
    const projectIds = [];
    for (const calendar of data.sharedCalendars) {
      // オーナーIDを現在のユーザーに更新
      calendar.ownerId = userId;
      // メンバーリストにも自分を追加
      if (!calendar.members.includes(userId)) {
        calendar.members = [userId];
      } else {
        calendar.members = calendar.members.filter(m => m === userId);
        calendar.members = [userId];
      }

      await env.NOTIFICATIONS.put(
        `project:${calendar.id}`,
        JSON.stringify(calendar)
      );
      // 招待コードも復元
      if (calendar.inviteCode) {
        await env.NOTIFICATIONS.put(`project_invite:${calendar.inviteCode}`, calendar.id);
      }
      projectIds.push(calendar.id);
      result.sharedCalendars++;
    }
    await env.NOTIFICATIONS.put(`user_projects:${userId}`, JSON.stringify(projectIds));

    // 共有カレンダーのイベントをインポート
    if (data.sharedCalendarEvents && data.sharedCalendarEvents.length > 0) {
      const eventsByProject = {};
      for (const event of data.sharedCalendarEvents) {
        const { projectId, ...eventData } = event;
        if (!eventsByProject[projectId]) {
          eventsByProject[projectId] = [];
        }
        await env.NOTIFICATIONS.put(
          `shared_event:${projectId}:${eventData.id}`,
          JSON.stringify(eventData)
        );
        eventsByProject[projectId].push(eventData.id);
        result.sharedCalendarEvents++;
      }
      // 各プロジェクトのイベントリストを保存
      for (const [projectId, eventIds] of Object.entries(eventsByProject)) {
        await env.NOTIFICATIONS.put(`shared_events_list:${projectId}`, JSON.stringify(eventIds));
      }
    }
  }

  // 共有タスクリストをインポート（オーナーのもののみ）
  if (data.sharedTaskLists && data.sharedTaskLists.length > 0) {
    const taskListIds = [];
    for (const taskList of data.sharedTaskLists) {
      // オーナーIDを現在のユーザーに更新
      taskList.ownerId = userId;
      // メンバーリストに自分だけを設定
      taskList.members = [userId];

      await env.NOTIFICATIONS.put(
        `shared_tasklist:${taskList.id}`,
        JSON.stringify(taskList)
      );
      // 招待コードも復元
      if (taskList.inviteCode) {
        await env.NOTIFICATIONS.put(`tasklist_invite:${taskList.inviteCode}`, taskList.id);
      }
      taskListIds.push(taskList.id);
      result.sharedTaskLists++;
    }
    await env.NOTIFICATIONS.put(`user_tasklists:${userId}`, JSON.stringify(taskListIds));

    // 共有タスクをインポート
    if (data.sharedTasks && data.sharedTasks.length > 0) {
      const tasksByList = {};
      for (const task of data.sharedTasks) {
        const { listId, ...taskData } = task;
        if (!tasksByList[listId]) {
          tasksByList[listId] = [];
        }
        await env.NOTIFICATIONS.put(
          `shared_task:${listId}:${taskData.id}`,
          JSON.stringify(taskData)
        );
        tasksByList[listId].push(taskData.id);
        result.sharedTasks++;
      }
      // 各タスクリストのタスクリストを保存
      for (const [listId, taskIds] of Object.entries(tasksByList)) {
        await env.NOTIFICATIONS.put(`shared_tasks_list:${listId}`, JSON.stringify(taskIds));
      }
    }
  }

  return result;
}

/**
 * バックアップを作成（サーバー側保存）
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object>} - バックアップ情報
 */
export async function createBackup(userId, env) {
  const timestamp = new Date().toISOString();
  const backupId = `backup_${Date.now()}`;

  // データをエクスポート
  const exportData = await exportUserData(userId, env);

  // バックアップを保存
  await env.NOTIFICATIONS.put(
    `backup:${userId}:${backupId}`,
    JSON.stringify(exportData),
    { expirationTtl: 30 * 24 * 60 * 60 } // 30日
  );

  // バックアップリストを更新
  const listKey = `backup_list:${userId}`;
  let backupList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];

  backupList.unshift({
    id: backupId,
    timestamp: timestamp,
    eventCount: exportData.data.events.length,
    taskCount: exportData.data.tasks.length,
    memoCount: exportData.data.memos.length,
    sharedCalendarCount: exportData.data.sharedCalendars.length,
    sharedTaskListCount: exportData.data.sharedTaskLists.length
  });

  // 古いバックアップを削除（MAX_BACKUPS を超えた分）
  if (backupList.length > MAX_BACKUPS) {
    const toDelete = backupList.splice(MAX_BACKUPS);
    for (const backup of toDelete) {
      await env.NOTIFICATIONS.delete(`backup:${userId}:${backup.id}`);
    }
  }

  await env.NOTIFICATIONS.put(listKey, JSON.stringify(backupList));

  // 最終バックアップ時刻を更新
  await env.NOTIFICATIONS.put(`last_backup:${userId}`, timestamp);

  return {
    id: backupId,
    timestamp: timestamp,
    eventCount: exportData.data.events.length,
    taskCount: exportData.data.tasks.length,
    memoCount: exportData.data.memos.length,
    sharedCalendarCount: exportData.data.sharedCalendars.length,
    sharedTaskListCount: exportData.data.sharedTaskLists.length
  };
}

/**
 * バックアップ一覧を取得
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<Array>} - バックアップ一覧
 */
export async function listBackups(userId, env) {
  const listKey = `backup_list:${userId}`;
  const backupList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  return backupList;
}

/**
 * バックアップから復元
 * @param {string} userId - ユーザーID
 * @param {string} backupId - バックアップID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object>} - 復元結果
 */
export async function restoreFromBackup(userId, backupId, env) {
  const backupKey = `backup:${userId}:${backupId}`;
  const backupData = await env.NOTIFICATIONS.get(backupKey, { type: 'json' });

  if (!backupData) {
    throw new Error('バックアップが見つかりません');
  }

  // 復元前に現在のデータをバックアップ（復元失敗時のため）
  await createBackup(userId, env);

  // 復元実行
  return await importUserData(userId, backupData, env, false);
}

/**
 * 最終バックアップ時刻を取得
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<string|null>} - 最終バックアップ時刻
 */
export async function getLastBackupTime(userId, env) {
  return await env.NOTIFICATIONS.get(`last_backup:${userId}`);
}

/**
 * 自動バックアップ設定を取得/更新
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @param {boolean} enabled - 有効/無効（undefinedの場合は取得のみ）
 * @returns {Promise<boolean>} - 自動バックアップが有効か
 */
export async function autoBackupSetting(userId, env, enabled = undefined) {
  const key = `auto_backup:${userId}`;

  if (enabled !== undefined) {
    await env.NOTIFICATIONS.put(key, enabled ? 'true' : 'false');
    return enabled;
  }

  const value = await env.NOTIFICATIONS.get(key);
  return value !== 'false'; // デフォルトは有効
}

// ヘルパー関数

/**
 * ユーザーデータをクリア
 */
async function clearUserData(userId, env) {
  // イベントをクリア
  const eventListKey = `local_events_list:${userId}`;
  const eventList = await env.NOTIFICATIONS.get(eventListKey, { type: 'json' }) || [];
  for (const item of eventList) {
    await env.NOTIFICATIONS.delete(`local_event:${userId}:${item.id}`);
    await env.NOTIFICATIONS.delete(`event_reminder_${userId}_${item.id}`);
  }
  await env.NOTIFICATIONS.delete(eventListKey);

  // タスクをクリア
  const taskListKey = `local_tasks_list:${userId}`;
  const taskList = await env.NOTIFICATIONS.get(taskListKey, { type: 'json' }) || [];
  for (const item of taskList) {
    await env.NOTIFICATIONS.delete(`local_task:${userId}:${item.id}`);
    await env.NOTIFICATIONS.delete(`task_reminder_${userId}_${item.id}`);
  }
  await env.NOTIFICATIONS.delete(taskListKey);

  // メモをクリア
  const memoListKey = `memo_list:${userId}`;
  const memoList = await env.NOTIFICATIONS.get(memoListKey, { type: 'json' }) || [];
  for (const memoId of memoList) {
    await env.NOTIFICATIONS.delete(`memo:${userId}:${memoId}`);
  }
  await env.NOTIFICATIONS.delete(memoListKey);

  // 共有カレンダー（オーナーのもの）をクリア
  const projectListKey = `user_projects:${userId}`;
  const projectIds = await env.NOTIFICATIONS.get(projectListKey, { type: 'json' }) || [];
  for (const projectId of projectIds) {
    const project = await env.NOTIFICATIONS.get(`project:${projectId}`, { type: 'json' });
    if (project && project.ownerId === userId) {
      // 共有イベントをクリア
      const sharedEventIds = await env.NOTIFICATIONS.get(`shared_events_list:${projectId}`, { type: 'json' }) || [];
      for (const eventId of sharedEventIds) {
        await env.NOTIFICATIONS.delete(`shared_event:${projectId}:${eventId}`);
      }
      await env.NOTIFICATIONS.delete(`shared_events_list:${projectId}`);
      // 招待コードを削除
      if (project.inviteCode) {
        await env.NOTIFICATIONS.delete(`project_invite:${project.inviteCode}`);
      }
      await env.NOTIFICATIONS.delete(`project:${projectId}`);
    }
  }
  await env.NOTIFICATIONS.delete(projectListKey);

  // 共有タスクリスト（オーナーのもの）をクリア
  const taskListIdsKey = `user_tasklists:${userId}`;
  const sharedTaskListIds = await env.NOTIFICATIONS.get(taskListIdsKey, { type: 'json' }) || [];
  for (const listId of sharedTaskListIds) {
    const taskListData = await env.NOTIFICATIONS.get(`shared_tasklist:${listId}`, { type: 'json' });
    if (taskListData && taskListData.ownerId === userId) {
      // 共有タスクをクリア
      const sharedTaskIds = await env.NOTIFICATIONS.get(`shared_tasks_list:${listId}`, { type: 'json' }) || [];
      for (const taskId of sharedTaskIds) {
        await env.NOTIFICATIONS.delete(`shared_task:${listId}:${taskId}`);
      }
      await env.NOTIFICATIONS.delete(`shared_tasks_list:${listId}`);
      // 招待コードを削除
      if (taskListData.inviteCode) {
        await env.NOTIFICATIONS.delete(`tasklist_invite:${taskListData.inviteCode}`);
      }
      await env.NOTIFICATIONS.delete(`shared_tasklist:${listId}`);
    }
  }
  await env.NOTIFICATIONS.delete(taskListIdsKey);
}

/**
 * イベントの日付を取得
 */
function getEventDate(event) {
  if (event.start.date) {
    return event.start.date;
  } else if (event.start.dateTime) {
    return event.start.dateTime.split('T')[0];
  }
  return null;
}
