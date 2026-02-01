/**
 * Google Tasks API操作
 */

// OAuth 2.0トークン更新（calendar.jsと共通）
async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('トークン更新失敗: ' + JSON.stringify(data));
  }
  
  return data.access_token;
}

// タスクリスト一覧を取得
export async function getTaskLists(env) {
  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );

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
export async function createTask(taskData, env) {
  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );

  // タスクリストを取得
  const taskLists = await getTaskLists(env);
  
  // 指定されたリスト名で検索、なければデフォルトリストを使用
  let targetList = taskLists.find(list => list.title === taskData.listName);
  if (!targetList) {
    targetList = taskLists[0]; // デフォルトリスト
  }

  const task = {
    title: taskData.title
  };

  // 期限があれば追加（RFC3339形式）
  if (taskData.due) {
    task.due = `${taskData.due}T00:00:00.000Z`;
  }

  // メモ（場所やURL）があれば追加
  if (taskData.notes) {
    task.notes = taskData.notes;
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
    listTitle: targetList.title
  };
}

// 未完了タスクを取得（期限付き）
export async function getUpcomingTasks(env) {
  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );

  const taskLists = await getTaskLists(env);
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
export async function getAllIncompleteTasks(env) {
  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );

  const taskLists = await getTaskLists(env);
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
        const tasks = data.items.map(task => ({
          ...task,
          listTitle: list.title,
          listId: list.id
        }));
        allTasks.push(...tasks);
      }
    }
  }

  return allTasks;
}
