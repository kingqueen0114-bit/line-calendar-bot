/**
 * 共有カレンダー機能 - Firestore連携
 */

/**
 * 共有カレンダーに予定を作成
 */
export async function createSharedEvent(eventData, projectId, userId, env) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const event = {
    id: eventId,
    projectId,
    title: eventData.title,
    date: eventData.date,
    startTime: eventData.startTime || null,
    endTime: eventData.endTime || null,
    isAllDay: eventData.isAllDay || false,
    location: eventData.location || null,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // イベントを保存
  await env.NOTIFICATIONS.put(`shared_event:${projectId}:${eventId}`, JSON.stringify(event));

  // プロジェクトのイベントリストに追加
  const listKey = `shared_events_list:${projectId}`;
  let eventList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  eventList.unshift(eventId);
  await env.NOTIFICATIONS.put(listKey, JSON.stringify(eventList));

  return event;
}

/**
 * 共有カレンダーの予定一覧を取得
 */
export async function getSharedEvents(projectId, env, days = 90) {
  const listKey = `shared_events_list:${projectId}`;
  const eventIds = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];

  const events = [];
  // 今日の0時を基準にする
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoffDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  for (const eventId of eventIds) {
    const event = await env.NOTIFICATIONS.get(`shared_event:${projectId}:${eventId}`, { type: 'json' });
    if (event) {
      const eventDate = new Date(event.date);
      if (eventDate >= today && eventDate <= cutoffDate) {
        events.push(event);
      }
    }
  }

  // 日付順にソート
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  return events;
}

/**
 * ユーザーの全共有カレンダーの予定を取得
 */
export async function getAllSharedEventsForUser(userId, env, days = 90) {
  const { getUserProjects } = await import('./project.js');
  const projects = await getUserProjects(userId, env);

  const allEvents = [];

  for (const project of projects) {
    const events = await getSharedEvents(project.id, env, days);
    events.forEach(event => {
      allEvents.push({
        ...event,
        projectName: project.name,
        projectColor: project.color,
        isShared: true
      });
    });
  }

  // 日付順にソート
  allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  return allEvents;
}

/**
 * 共有予定を削除
 */
export async function deleteSharedEvent(eventId, projectId, userId, env) {
  const event = await env.NOTIFICATIONS.get(`shared_event:${projectId}:${eventId}`, { type: 'json' });

  if (!event) {
    throw new Error('予定が見つかりません');
  }

  // 削除
  await env.NOTIFICATIONS.delete(`shared_event:${projectId}:${eventId}`);

  // リストから削除
  const listKey = `shared_events_list:${projectId}`;
  let eventList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  eventList = eventList.filter(id => id !== eventId);
  await env.NOTIFICATIONS.put(listKey, JSON.stringify(eventList));
}

/**
 * 共有予定をGoogle Calendar API形式に変換
 */
export function formatSharedEventForDisplay(event) {
  // 終日 or 時間指定がない場合
  if (event.isAllDay || !event.startTime || !event.endTime) {
    return {
      id: event.id,
      summary: event.title,
      start: { date: event.date },
      end: { date: event.date },
      projectId: event.projectId,
      projectName: event.projectName,
      projectColor: event.projectColor,
      isShared: true
    };
  } else {
    return {
      id: event.id,
      summary: event.title,
      start: { dateTime: `${event.date}T${event.startTime}:00+09:00` },
      end: { dateTime: `${event.date}T${event.endTime}:00+09:00` },
      projectId: event.projectId,
      projectName: event.projectName,
      projectColor: event.projectColor,
      isShared: true
    };
  }
}
