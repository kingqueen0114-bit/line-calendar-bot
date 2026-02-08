/**
 * ローカルカレンダー機能 - KVストレージベースの個人イベント管理
 * Google Calendar APIを使用せず、KVに直接保存
 */

// ユニークIDを生成
function generateEventId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * ローカルイベントを作成
 */
export async function createLocalEvent(eventData, userId, env) {
  const eventId = generateEventId();

  const event = {
    id: eventId,
    summary: eventData.title,
    start: {},
    end: {},
    location: eventData.location || null,
    description: '',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    isLocal: true,
    tagIds: eventData.tagIds || []
  };

  // 終日予定かどうかで分岐
  if (eventData.isAllDay) {
    event.start = { date: eventData.date };
    const endDate = new Date(eventData.date);
    endDate.setDate(endDate.getDate() + 1);
    event.end = { date: endDate.toISOString().split('T')[0] };
  } else {
    event.start = {
      dateTime: `${eventData.date}T${eventData.startTime}:00+09:00`,
      timeZone: 'Asia/Tokyo'
    };
    // 終了時刻が開始時刻より前の場合は翌日とみなす
    let endDateStr = eventData.date;
    if (eventData.endTime < eventData.startTime || eventData.endTime === '00:00') {
      const endDate = new Date(eventData.date);
      endDate.setDate(endDate.getDate() + 1);
      endDateStr = endDate.toISOString().split('T')[0];
    }
    event.end = {
      dateTime: `${endDateStr}T${eventData.endTime}:00+09:00`,
      timeZone: 'Asia/Tokyo'
    };
  }

  // URLとメモを説明に追加
  let description = '';
  if (eventData.url) {
    description += eventData.url;
  }
  if (eventData.memo) {
    if (description) description += '\n\n';
    description += eventData.memo;
  }
  event.description = description;

  // イベントを保存
  await env.NOTIFICATIONS.put(
    `local_event:${userId}:${eventId}`,
    JSON.stringify(event),
    { expirationTtl: 365 * 24 * 60 * 60 } // 1年
  );

  // イベントリストに追加
  const listKey = `local_events_list:${userId}`;
  const existingList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  existingList.push({
    id: eventId,
    date: eventData.date,
    created: event.created
  });
  await env.NOTIFICATIONS.put(listKey, JSON.stringify(existingList));

  return event;
}

/**
 * ローカルイベントを取得（指定日数分）
 */
export async function getLocalEvents(userId, env, daysAhead = 90) {
  // 日本時間で今日の0時を取得
  const now = new Date();
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const todayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
  const timeMax = new Date(todayStart.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const listKey = `local_events_list:${userId}`;
  const eventList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];

  const events = [];
  const validIds = [];

  for (const item of eventList) {
    const eventData = await env.NOTIFICATIONS.get(`local_event:${userId}:${item.id}`, { type: 'json' });
    if (eventData) {
      // 日付範囲フィルタリング
      let eventDate;
      if (eventData.start.date) {
        eventDate = new Date(eventData.start.date);
      } else if (eventData.start.dateTime) {
        eventDate = new Date(eventData.start.dateTime);
      }

      if (eventDate >= todayStart && eventDate <= timeMax) {
        events.push(eventData);
        validIds.push(item);
      } else if (eventDate > timeMax) {
        // 将来のイベントはリストに保持
        validIds.push(item);
      }
      // 過去のイベントは削除されるがリストには残す（念のため）
      else {
        validIds.push(item);
      }
    }
  }

  // 開始時刻順にソート
  events.sort((a, b) => {
    const aTime = a.start.dateTime || a.start.date + 'T00:00:00';
    const bTime = b.start.dateTime || b.start.date + 'T00:00:00';
    return new Date(aTime) - new Date(bTime);
  });

  return events;
}

/**
 * ローカルイベントを削除
 */
export async function deleteLocalEvent(eventId, userId, env) {
  // イベントを削除
  await env.NOTIFICATIONS.delete(`local_event:${userId}:${eventId}`);

  // リストから削除
  const listKey = `local_events_list:${userId}`;
  const eventList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
  const newList = eventList.filter(item => item.id !== eventId);
  await env.NOTIFICATIONS.put(listKey, JSON.stringify(newList));

  return { success: true };
}

/**
 * ローカルイベントを更新
 */
export async function updateLocalEvent(eventId, eventData, userId, env) {
  const existingEvent = await env.NOTIFICATIONS.get(`local_event:${userId}:${eventId}`, { type: 'json' });

  if (!existingEvent) {
    throw new Error('イベントが見つかりません');
  }

  // 更新データをマージ
  if (eventData.title) {
    existingEvent.summary = eventData.title;
  }
  if (eventData.location !== undefined) {
    existingEvent.location = eventData.location;
  }
  if (eventData.description !== undefined) {
    existingEvent.description = eventData.description;
  }
  if (eventData.tagIds !== undefined) {
    existingEvent.tagIds = eventData.tagIds;
  }
  if (eventData.date) {
    if (eventData.isAllDay) {
      existingEvent.start = { date: eventData.date };
      const endDate = new Date(eventData.date);
      endDate.setDate(endDate.getDate() + 1);
      existingEvent.end = { date: endDate.toISOString().split('T')[0] };
    } else if (eventData.startTime && eventData.endTime) {
      existingEvent.start = {
        dateTime: `${eventData.date}T${eventData.startTime}:00+09:00`,
        timeZone: 'Asia/Tokyo'
      };
      let endDateStr = eventData.date;
      if (eventData.endTime < eventData.startTime || eventData.endTime === '00:00') {
        const endDate = new Date(eventData.date);
        endDate.setDate(endDate.getDate() + 1);
        endDateStr = endDate.toISOString().split('T')[0];
      }
      existingEvent.end = {
        dateTime: `${endDateStr}T${eventData.endTime}:00+09:00`,
        timeZone: 'Asia/Tokyo'
      };
    }
  }

  existingEvent.updated = new Date().toISOString();

  // 保存
  await env.NOTIFICATIONS.put(
    `local_event:${userId}:${eventId}`,
    JSON.stringify(existingEvent),
    { expirationTtl: 365 * 24 * 60 * 60 }
  );

  // リストも更新（日付が変わった場合）
  if (eventData.date) {
    const listKey = `local_events_list:${userId}`;
    const eventList = await env.NOTIFICATIONS.get(listKey, { type: 'json' }) || [];
    const updatedList = eventList.map(item => {
      if (item.id === eventId) {
        return { ...item, date: eventData.date };
      }
      return item;
    });
    await env.NOTIFICATIONS.put(listKey, JSON.stringify(updatedList));
  }

  return existingEvent;
}

/**
 * 単一のローカルイベントを取得
 */
export async function getLocalEvent(eventId, userId, env) {
  return await env.NOTIFICATIONS.get(`local_event:${userId}:${eventId}`, { type: 'json' });
}
