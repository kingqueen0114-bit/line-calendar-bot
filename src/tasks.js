/**
 * Google Tasks API操作
 */
import { getUserAccessToken } from './oauth.js';

// タスクリスト一覧を取得
export async function getTaskLists(userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const response = await fetch(
    'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('タスクリスト取得失敗: ' + error);
  }

  const data = await response.json();
  return data.items || [];
}

// タスクを作成
export async function createTask(taskData, userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  // タスクリストを取得
  const taskLists = await getTaskLists(userId, env);
  
  // 指定されたリスト名で検索、なければデフォルトリストを使用
  let targetList = taskLists.find(list => list.title === taskData.listName);
  if (!targetList) {
    targetList = taskLists[0]; // デフォルトリスト
  }

  const task = {
    title: taskData.title
  };

  // 期限があれば追加（RFC3339形式）
  // 日付のみのタスクとして扱う（時刻なし）
  if (taskData.due) {
    task.due = `${taskData.due}T00:00:00Z`;
  }

  // メモ（場所やURL）とスターマーカーを追加
  let notesContent = taskData.notes || '';

  // スター付きタスクの場合、notesの先頭に[STARRED]マーカーを追加
  if (taskData.starred) {
    notesContent = `[STARRED]\n${notesContent}`.trim();
  }

  if (notesContent) {
    task.notes = notesContent;
  }

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${targetList.id}/tasks`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(task)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('タスク作成失敗: ' + error);
  }

  const result = await response.json();
  return {
    ...result,
    listTitle: targetList.title,
    listId: targetList.id
  };
}

// 未完了タスクを取得（期限付き）
export async function getUpcomingTasks(userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const taskLists = await getTaskLists(userId, env);
  const allTasks = [];

  for (const list of taskLists) {
    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=false&showHidden=false`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.items) {
        // 期限があるタスクのみ抽出
        const tasksWithDue = data.items
          .filter(task => task.due)
          .map(task => ({
            ...task,
            listTitle: list.title,
            listId: list.id
          }));
        allTasks.push(...tasksWithDue);
      }
    }
  }

  return allTasks;
}

// 未完了タスク一覧を取得（全タスク）
export async function getAllIncompleteTasks(userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const taskLists = await getTaskLists(userId, env);
  const allTasks = [];

  for (const list of taskLists) {
    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=false&showHidden=false`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.items) {
        const tasks = data.items.map(task => {
          // [STARRED]マーカーをチェック
          const isStarred = task.notes && task.notes.startsWith('[STARRED]');

          return {
            ...task,
            listTitle: list.title,
            listId: list.id,
            starred: isStarred,
            // notesから[STARRED]マーカーを除去して表示用に
            notes: task.notes ? task.notes.replace(/^\[STARRED\]\n?/, '') : null
          };
        });
        allTasks.push(...tasks);
      }
    }
  }

  // スマートソート: スター → 期限 → 更新日時
  allTasks.sort((a, b) => {
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

  return allTasks;
}

// タスクを完了にする
export async function completeTask(taskId, listId, userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'completed' })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('タスク完了失敗: ' + error);
  }

  return await response.json();
}

// タスクを更新する
export async function updateTask(taskId, listId, updates, userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const body = { title: updates.title };
  if (updates.due) {
    body.due = new Date(updates.due).toISOString();
  }

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('タスク更新失敗: ' + error);
  }

  return await response.json();
}

// タスクを削除する
export async function deleteTask(taskId, listId, userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('タスク削除失敗: ' + error);
  }

  return { success: true };
}

// 完了済みタスク一覧を取得
export async function getAllCompletedTasks(userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const taskLists = await getTaskLists(userId, env);
  const allTasks = [];

  for (const list of taskLists) {
    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=true&showHidden=true`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.items) {
        const completedTasks = data.items
          .filter(task => task.status === 'completed')
          .map(task => ({
            ...task,
            listTitle: list.title,
            listId: list.id
          }));
        allTasks.push(...completedTasks);
      }
    }
  }

  // 完了日時降順（新しい順）
  allTasks.sort((a, b) => {
    return new Date(b.completed || 0) - new Date(a.completed || 0);
  });

  return allTasks;
}

// タスクの完了を取り消す（未完了に戻す）
export async function uncompleteTask(taskId, listId, userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'needsAction', completed: null })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('タスク完了取消失敗: ' + error);
  }

  return await response.json();
}
