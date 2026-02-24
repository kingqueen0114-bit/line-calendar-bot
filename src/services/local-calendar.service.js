/**
 * ローカルカレンダーサービス — Firestore 直接保存
 * Google Calendar/Tasks API 未認証ユーザー用
 */
import { env } from '../utils/env-adapter.js';

function generateId() {
    return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ========== イベント ==========

export async function createLocalEvent(userId, eventData) {
    const eventId = generateId();
    const event = {
        id: eventId,
        summary: eventData.title || eventData.summary || '',
        start: {},
        end: {},
        location: eventData.location || '',
        description: eventData.memo || eventData.description || '',
        htmlLink: eventData.url || '',
        isLocal: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    if (eventData.isAllDay) {
        event.start.date = eventData.date;
        event.end.date = eventData.date;
    } else {
        const startDT = eventData.date + 'T' + (eventData.startTime || '09:00') + ':00+09:00';
        const endDT = eventData.date + 'T' + (eventData.endTime || '10:00') + ':00+09:00';
        event.start.dateTime = startDT;
        event.end.dateTime = endDT;
    }

    await env.NOTIFICATIONS.put(`local_event:${userId}:${eventId}`, JSON.stringify(event));
    return event;
}

export async function getLocalEvents(userId, days = 90) {
    const results = await env.NOTIFICATIONS.list(`local_event:${userId}:`);
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const pastCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const events = [];
    for (const item of results) {
        try {
            const event = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            const eventDate = event.start?.dateTime || event.start?.date;
            if (eventDate) {
                const d = new Date(eventDate);
                if (d >= pastCutoff && d <= cutoff) {
                    event.isLocal = true;
                    events.push(event);
                }
            }
        } catch (e) { /* skip invalid */ }
    }

    events.sort((a, b) => {
        const dA = new Date(a.start?.dateTime || a.start?.date || 0);
        const dB = new Date(b.start?.dateTime || b.start?.date || 0);
        return dA - dB;
    });

    return events;
}

export async function updateLocalEvent(userId, eventId, data) {
    const raw = await env.NOTIFICATIONS.get(`local_event:${userId}:${eventId}`, { type: 'json' });
    if (!raw) throw new Error('Event not found');

    const event = { ...raw, ...data, updatedAt: new Date().toISOString() };
    await env.NOTIFICATIONS.put(`local_event:${userId}:${eventId}`, JSON.stringify(event));
    return event;
}

export async function deleteLocalEvent(userId, eventId) {
    await env.NOTIFICATIONS.delete(`local_event:${userId}:${eventId}`);
}

// ========== タスク ==========

export async function createLocalTask(userId, taskData) {
    const taskId = generateId();
    const task = {
        id: taskId,
        title: taskData.title || '',
        notes: taskData.notes || '',
        due: taskData.due || null,
        status: 'needsAction',
        completed: null,
        isLocal: true,
        listId: 'local',
        listTitle: 'マイタスク',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await env.NOTIFICATIONS.put(`local_task:${userId}:${taskId}`, JSON.stringify(task));
    return task;
}

export async function getLocalTasks(userId) {
    const results = await env.NOTIFICATIONS.list(`local_task:${userId}:`);
    const tasks = [];

    for (const item of results) {
        try {
            const task = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            if (task.status !== 'completed') {
                task.isLocal = true;
                tasks.push(task);
            }
        } catch (e) { /* skip */ }
    }

    tasks.sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due) - new Date(b.due);
    });

    return tasks;
}

export async function getLocalCompletedTasks(userId) {
    const results = await env.NOTIFICATIONS.list(`local_task:${userId}:`);
    const tasks = [];

    for (const item of results) {
        try {
            const task = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            if (task.status === 'completed') {
                task.isLocal = true;
                tasks.push(task);
            }
        } catch (e) { /* skip */ }
    }

    return tasks;
}

export async function completeLocalTask(userId, taskId) {
    const raw = await env.NOTIFICATIONS.get(`local_task:${userId}:${taskId}`, { type: 'json' });
    if (!raw) throw new Error('Task not found');

    raw.status = 'completed';
    raw.completed = new Date().toISOString();
    raw.updatedAt = new Date().toISOString();
    await env.NOTIFICATIONS.put(`local_task:${userId}:${taskId}`, JSON.stringify(raw));
}

export async function uncompleteLocalTask(userId, taskId) {
    const raw = await env.NOTIFICATIONS.get(`local_task:${userId}:${taskId}`, { type: 'json' });
    if (!raw) throw new Error('Task not found');

    raw.status = 'needsAction';
    raw.completed = null;
    raw.updatedAt = new Date().toISOString();
    await env.NOTIFICATIONS.put(`local_task:${userId}:${taskId}`, JSON.stringify(raw));
}

export async function updateLocalTask(userId, taskId, data) {
    const raw = await env.NOTIFICATIONS.get(`local_task:${userId}:${taskId}`, { type: 'json' });
    if (!raw) throw new Error('Task not found');

    const task = { ...raw, ...data, updatedAt: new Date().toISOString() };
    await env.NOTIFICATIONS.put(`local_task:${userId}:${taskId}`, JSON.stringify(task));
    return task;
}

export async function deleteLocalTask(userId, taskId) {
    await env.NOTIFICATIONS.delete(`local_task:${userId}:${taskId}`);
}

// ========== メモ（既存Firestoreメモはそのまま） ==========
// メモは既にFirestore保存なので変更不要
