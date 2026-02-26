/**
 * 共有タスクリスト機能 - Firestore連携
 */
import { env } from '../utils/env-adapter.js';

function generateId(prefix = 'stl') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function generateInviteCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ========== 共有タスクリスト CRUD ==========

export async function createSharedTaskList(data, userId, envObj) {
    const e = envObj || env;
    const listId = generateId('stl');
    const inviteCode = generateInviteCode();

    const taskList = {
        id: listId,
        name: data.name,
        color: data.color || '#06c755',
        inviteCode,
        createdBy: userId,
        members: [userId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await e.NOTIFICATIONS.put(`shared_tasklist:${listId}`, JSON.stringify(taskList));

    // ユーザーの共有タスクリスト一覧に追加
    const userKey = `user_shared_tasklists:${userId}`;
    let lists = await e.NOTIFICATIONS.get(userKey, { type: 'json' }) || [];
    lists.push(listId);
    await e.NOTIFICATIONS.put(userKey, JSON.stringify(lists));

    return taskList;
}

export async function getUserSharedTaskLists(userId, envObj) {
    const e = envObj || env;
    const userKey = `user_shared_tasklists:${userId}`;
    const listIds = await e.NOTIFICATIONS.get(userKey, { type: 'json' }) || [];

    const lists = [];
    for (const id of listIds) {
        const list = await e.NOTIFICATIONS.get(`shared_tasklist:${id}`, { type: 'json' });
        if (list) lists.push(list);
    }
    return lists;
}

export async function updateSharedTaskList(listId, data, userId, envObj) {
    const e = envObj || env;
    const list = await e.NOTIFICATIONS.get(`shared_tasklist:${listId}`, { type: 'json' });
    if (!list) throw new Error('タスクリストが見つかりません');

    if (data.name !== undefined) list.name = data.name;
    if (data.color !== undefined) list.color = data.color;
    list.updatedAt = new Date().toISOString();

    await e.NOTIFICATIONS.put(`shared_tasklist:${listId}`, JSON.stringify(list));
    return list;
}

export async function joinTaskListByCode(inviteCode, userId, envObj) {
    const e = envObj || env;
    // 招待コードから共有タスクリストを検索
    const result = await e.NOTIFICATIONS.list({ prefix: 'shared_tasklist:', include: ['value'] });
    const items = result.keys || [];
    let foundList = null;

    for (const item of items) {
        try {
            // item.value は include: ['value'] を指定した場合に利用可能
            const list = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            if (list.inviteCode === inviteCode) {
                foundList = list;
                break;
            }
        } catch (err) { /* skip */ }
    }

    if (!foundList) throw new Error('招待コードが無効です');
    if (foundList.members && foundList.members.includes(userId)) {
        throw new Error('既に参加しています');
    }

    // メンバーに追加
    foundList.members = foundList.members || [];
    foundList.members.push(userId);
    foundList.updatedAt = new Date().toISOString();
    await e.NOTIFICATIONS.put(`shared_tasklist:${foundList.id}`, JSON.stringify(foundList));

    // ユーザーの一覧に追加
    const userKey = `user_shared_tasklists:${userId}`;
    let lists = await e.NOTIFICATIONS.get(userKey, { type: 'json' }) || [];
    if (!lists.includes(foundList.id)) lists.push(foundList.id);
    await e.NOTIFICATIONS.put(userKey, JSON.stringify(lists));

    return foundList;
}

export async function leaveSharedTaskList(listId, userId, envObj) {
    const e = envObj || env;
    const list = await e.NOTIFICATIONS.get(`shared_tasklist:${listId}`, { type: 'json' });
    if (!list) throw new Error('タスクリストが見つかりません');

    list.members = (list.members || []).filter(m => m !== userId);
    list.updatedAt = new Date().toISOString();
    await e.NOTIFICATIONS.put(`shared_tasklist:${listId}`, JSON.stringify(list));

    // ユーザーの一覧から削除
    const userKey = `user_shared_tasklists:${userId}`;
    let lists = await e.NOTIFICATIONS.get(userKey, { type: 'json' }) || [];
    lists = lists.filter(id => id !== listId);
    await e.NOTIFICATIONS.put(userKey, JSON.stringify(lists));
}

export async function deleteSharedTaskList(listId, userId, envObj) {
    const e = envObj || env;
    const list = await e.NOTIFICATIONS.get(`shared_tasklist:${listId}`, { type: 'json' });
    if (!list) throw new Error('タスクリストが見つかりません');

    // タスクを全て削除
    const taskIds = await e.NOTIFICATIONS.get(`shared_tasks_list:${listId}`, { type: 'json' }) || [];
    for (const taskId of taskIds) {
        await e.NOTIFICATIONS.delete(`shared_task:${listId}:${taskId}`);
    }
    await e.NOTIFICATIONS.delete(`shared_tasks_list:${listId}`);

    // メンバー全員の一覧から削除
    for (const memberId of (list.members || [])) {
        const userKey = `user_shared_tasklists:${memberId}`;
        let lists = await e.NOTIFICATIONS.get(userKey, { type: 'json' }) || [];
        lists = lists.filter(id => id !== listId);
        await e.NOTIFICATIONS.put(userKey, JSON.stringify(lists));
    }

    // リスト本体を削除
    await e.NOTIFICATIONS.delete(`shared_tasklist:${listId}`);
}

// ========== 共有タスク CRUD ==========

export async function createSharedTask(data, listId, userId, envObj) {
    const e = envObj || env;
    const taskId = generateId('stk');

    const task = {
        id: taskId,
        listId,
        title: data.title,
        due: data.due || null,
        status: 'needsAction',
        completed: null,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await e.NOTIFICATIONS.put(`shared_task:${listId}:${taskId}`, JSON.stringify(task));

    // タスクリストのタスク一覧に追加
    const listKey = `shared_tasks_list:${listId}`;
    let taskIds = await e.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
    taskIds.unshift(taskId);
    await e.NOTIFICATIONS.put(listKey, JSON.stringify(taskIds));

    return task;
}

export async function getAllSharedTasksForUser(userId, envObj) {
    const e = envObj || env;
    const lists = await getUserSharedTaskLists(userId, e);
    const allTasks = [];

    for (const list of lists) {
        const taskIds = await e.NOTIFICATIONS.get(`shared_tasks_list:${list.id}`, { type: 'json' }) || [];
        for (const taskId of taskIds) {
            const task = await e.NOTIFICATIONS.get(`shared_task:${list.id}:${taskId}`, { type: 'json' });
            if (task && task.status !== 'completed') {
                task.listName = list.name;
                task.listColor = list.color;
                task.isShared = true;
                allTasks.push(task);
            }
        }
    }

    // due でソート
    allTasks.sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due) - new Date(b.due);
    });

    return allTasks;
}

export async function getAllCompletedSharedTasksForUser(userId, envObj) {
    const e = envObj || env;
    const lists = await getUserSharedTaskLists(userId, e);
    const allTasks = [];

    for (const list of lists) {
        const taskIds = await e.NOTIFICATIONS.get(`shared_tasks_list:${list.id}`, { type: 'json' }) || [];
        for (const taskId of taskIds) {
            const task = await e.NOTIFICATIONS.get(`shared_task:${list.id}:${taskId}`, { type: 'json' });
            if (task && task.status === 'completed') {
                task.listName = list.name;
                task.listColor = list.color;
                task.isShared = true;
                allTasks.push(task);
            }
        }
    }

    return allTasks;
}

export async function completeSharedTask(taskId, listId, userId, envObj) {
    const e = envObj || env;
    const task = await e.NOTIFICATIONS.get(`shared_task:${listId}:${taskId}`, { type: 'json' });
    if (!task) throw new Error('タスクが見つかりません');

    task.status = 'completed';
    task.completed = new Date().toISOString();
    task.completedBy = userId;
    task.updatedAt = new Date().toISOString();
    await e.NOTIFICATIONS.put(`shared_task:${listId}:${taskId}`, JSON.stringify(task));
}

export async function uncompleteSharedTask(taskId, listId, userId, envObj) {
    const e = envObj || env;
    const task = await e.NOTIFICATIONS.get(`shared_task:${listId}:${taskId}`, { type: 'json' });
    if (!task) throw new Error('タスクが見つかりません');

    task.status = 'needsAction';
    task.completed = null;
    task.completedBy = null;
    task.updatedAt = new Date().toISOString();
    await e.NOTIFICATIONS.put(`shared_task:${listId}:${taskId}`, JSON.stringify(task));
}

export async function deleteSharedTask(taskId, listId, userId, envObj) {
    const e = envObj || env;
    await e.NOTIFICATIONS.delete(`shared_task:${listId}:${taskId}`);

    // リストから削除
    const listKey = `shared_tasks_list:${listId}`;
    let taskIds = await e.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
    taskIds = taskIds.filter(id => id !== taskId);
    await e.NOTIFICATIONS.put(listKey, JSON.stringify(taskIds));
}
