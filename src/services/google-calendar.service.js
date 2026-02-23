/**
 * Google Calendar API操作
 */
import { getUserAccessToken } from '../services/auth.service.js';

// イベントを作成
export async function createEvent(eventData, userId, env) {
  console.log('createEvent: Received eventData:', JSON.stringify(eventData));
  console.log('createEvent: Getting user access token for:', userId);
  const accessToken = await getUserAccessToken(userId, env);
  console.log('createEvent: Access token obtained');

  // テスト：まずGETリクエストで接続確認
  console.log('Testing Calendar API connection with GET...');
  try {
    const testResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary',
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    console.log('GET test response:', testResponse.ok, testResponse.status);
  } catch (error) {
    console.error('GET test failed:', error);
  }

  // 終日予定かどうかで分岐
  const event = {
    summary: eventData.title,
    reminders: {
      useDefault: false,
      overrides: []
    }
  };

  if (eventData.isAllDay) {
    // 終日予定の場合はdateフィールドを使用
    console.log('Creating all-day event');
    event.start = {
      date: eventData.date
    };
    const endDate = new Date(eventData.date);
    endDate.setDate(endDate.getDate() + 1);
    event.end = {
      date: endDate.toISOString().split('T')[0]
    };
  } else {
    // 通常の予定の場合はdateTimeフィールドを使用
    event.start = {
      dateTime: `${eventData.date}T${eventData.startTime}:00+09:00`,
      timeZone: 'Asia/Tokyo'
    };
    event.end = {
      dateTime: `${eventData.date}T${eventData.endTime}:00+09:00`,
      timeZone: 'Asia/Tokyo'
    };
  }

  // 場所があれば追加
  console.log('Checking location:', eventData.location);
  if (eventData.location) {
    event.location = eventData.location;
    console.log('Location added:', event.location);
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
  if (description) {
    event.description = description;
    console.log('Description added:', event.description);
  }

  // 終日予定でない場合のみ、終了時刻の調整を行う
  if (!eventData.isAllDay && (eventData.endTime < eventData.startTime || eventData.endTime === '00:00')) {
    const endDate = new Date(eventData.date);
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = endDate.toISOString().split('T')[0];
    event.end.dateTime = `${endDateStr}T${eventData.endTime}:00+09:00`;
    console.log('End time adjusted to next day:', event.end.dateTime);
  }

  console.log('Posting to Google Calendar API...');
  console.log('Event data:', JSON.stringify(event));

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );

    console.log('Calendar API response received, ok:', response.ok, 'status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('Calendar API error response:', error);
      throw new Error('イベント作成失敗: ' + error);
    }

    const result = await response.json();
    console.log('Event created successfully, ID:', result.id);
    return result;
  } catch (error) {
    console.error('Calendar API fetch error:', error);
    throw error;
  }
}

// ユーザーの有効なカレンダーIDリストを取得するヘルパー関数
async function getEnabledCalendarIds(userId, env) {
  let calendars = ['primary'];
  try {
    const settings = await env.NOTIFICATIONS.get(`settings:${userId}`, { type: 'json' });
    if (settings && Array.isArray(settings.enabledCalendars) && settings.enabledCalendars.length > 0) {
      calendars = settings.enabledCalendars;
    }
  } catch (e) {
    console.error('Failed to load user settings for calendars', e);
  }
  return calendars;
}

// 今後のイベントを取得（過去1年、未来1年のイベントを取得）
export async function getUpcomingEvents(userId, env, daysAhead = 365, daysBehind = 365) {
  const accessToken = await getUserAccessToken(userId, env);
  const calendars = await getEnabledCalendarIds(userId, env);

  // 日本時間で今日の0時を取得
  const now = new Date();
  // 日本時間で今日の日付を取得
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const todayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());

  const timeMin = new Date(todayStart.getTime() - daysBehind * 24 * 60 * 60 * 1000);
  const timeMax = new Date(todayStart.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500' // 最大2500件まで一括取得
  });

  const allItems = [];

  await Promise.all(calendars.map(async (calendarId) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          // アイテムにカレンダーIDを付与（キャンセルされた予定などstartが無いものは除外）
          const validItems = data.items.filter(item => item.start && (item.start.dateTime || item.start.date));
          validItems.forEach(item => { item.calendarId = calendarId; });
          allItems.push(...validItems);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch events for calendar:', calendarId, errorText);
        if (response.status === 401 || response.status === 403) {
          const err = new Error('イベント取得失敗: ' + errorText);
          err.status = 401;
          throw err;
        }
      }
    } catch (err) {
      console.error('Error fetching calendar:', calendarId, err);
      if (err.status === 401) throw err; // Propagate auth errors
    }
  }));

  allItems.sort((a, b) => {
    const aTime = new Date(a.start.dateTime || a.start.date).getTime();
    const bTime = new Date(b.start.dateTime || b.start.date).getTime();
    return aTime - bTime;
  });

  return allItems;
}

// キーワードで予定を検索（今日・明日のみ）
export async function searchEvents(keyword, userId, env) {
  console.log('searchEvents: Function started with keyword:', keyword);

  try {
    console.log('searchEvents: Getting user access token...');
    const accessToken = await getUserAccessToken(userId, env);
    const calendars = await getEnabledCalendarIds(userId, env);
    console.log('searchEvents: Access token obtained');

    // 日本時間で今日の00:00を取得
    console.log('searchEvents: Calculating time range...');
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);

    const today = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    console.log('searchEvents: Time range - from:', today.toISOString(), 'to:', dayAfterTomorrow.toISOString());

    const params = new URLSearchParams({
      timeMin: today.toISOString(),
      timeMax: dayAfterTomorrow.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250' // 増やす
    });

    if (keyword) {
      params.set('q', keyword);
      console.log('searchEvents: Search keyword added:', keyword);
    }

    const allItems = [];

    await Promise.all(calendars.map(async (calendarId) => {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
      console.log('searchEvents: Making API request to:', url);

      try {
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        console.log('searchEvents: API response received, ok:', response.ok, 'status:', response.status);

        if (response.ok) {
          const data = await response.json();
          if (data.items) {
            const validItems = data.items.filter(item => item.start && (item.start.dateTime || item.start.date));
            validItems.forEach(item => { item.calendarId = calendarId; });
            allItems.push(...validItems);
          }
        }
      } catch (e) {
        console.error('searchEvents error for calendar:', calendarId, e);
      }
    }));

    allItems.sort((a, b) => {
      const aTime = new Date(a.start.dateTime || a.start.date).getTime();
      const bTime = new Date(b.start.dateTime || b.start.date).getTime();
      return aTime - bTime;
    });

    return allItems;
  } catch (error) {
    console.error('searchEvents: Exception caught:', error.message);
    console.error('searchEvents: Stack trace:', error.stack);
    throw error;
  }
}

// 指定期間で予定を検索
export async function searchEventsInRange(timeMin, timeMax, keyword, userId, env) {
  console.log('searchEventsInRange: From:', timeMin, 'To:', timeMax);

  const accessToken = await getUserAccessToken(userId, env);
  const calendars = await getEnabledCalendarIds(userId, env);

  const params = new URLSearchParams({
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250'
  });

  if (keyword) {
    params.set('q', keyword);
  }

  const allItems = [];

  await Promise.all(calendars.map(async (calendarId) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          const validItems = data.items.filter(item => item.start && (item.start.dateTime || item.start.date));
          validItems.forEach(item => { item.calendarId = calendarId; });
          allItems.push(...validItems);
        }
      }
    } catch (e) {
      console.error('searchEventsInRange error for calendar:', calendarId, e);
    }
  }));

  allItems.sort((a, b) => {
    const aTime = new Date(a.start.dateTime || a.start.date).getTime();
    const bTime = new Date(b.start.dateTime || b.start.date).getTime();
    return aTime - bTime;
  });

  return allItems;
}

// 予定を削除
export async function deleteEvent(eventId, userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok && response.status !== 204) {
    const error = await response.text();
    throw new Error('予定削除失敗: ' + error);
  }

  return true;
}

// 予定を更新
export async function updateEvent(eventId, updateData, userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  // まず既存の予定を取得
  const getResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!getResponse.ok) {
    const error = await getResponse.text();
    throw new Error('予定取得失敗: ' + error);
  }

  const existingEvent = await getResponse.json();

  // 更新データをマージ
  if (updateData.startTime) {
    const date = existingEvent.start.dateTime.split('T')[0];
    existingEvent.start.dateTime = `${date}T${updateData.startTime}:00+09:00`;
    existingEvent.end.dateTime = `${date}T${updateData.endTime || updateData.startTime}:00+09:00`;
  }

  if (updateData.title) {
    existingEvent.summary = updateData.title;
  }

  if (updateData.location !== undefined) {
    existingEvent.location = updateData.location;
  }

  if (updateData.description !== undefined) {
    existingEvent.description = updateData.description;
  }

  // 更新をPUT
  const updateResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(existingEvent)
    }
  );

  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    throw new Error('予定更新失敗: ' + error);
  }

  return await updateResponse.json();
}

// カレンダーリストを取得
export async function getCalendarList(userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error('カレンダーリスト取得失敗: ' + errorText);
    if (response.status === 401 || response.status === 403) {
      error.status = 401;
    }
    throw error;
  }

  const data = await response.json();
  return data.items || [];
}

