/**
 * Google Calendar API操作
 */

// OAuth 2.0トークン更新
async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  console.log('refreshAccessToken: Starting token refresh...');
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
  console.log('refreshAccessToken: Response received, ok:', response.ok);
  if (!data.access_token) {
    console.error('refreshAccessToken: Failed -', JSON.stringify(data));
    throw new Error('トークン更新失敗: ' + JSON.stringify(data));
  }
  console.log('refreshAccessToken: Success');
  
  return data.access_token;
}

// イベントを作成
export async function createEvent(eventData, env) {
  console.log('createEvent: Received eventData:', JSON.stringify(eventData));
  console.log('createEvent: Refreshing access token...');
  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );
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

  // URLがあれば説明に追加
  console.log('Checking url:', eventData.url);
  if (eventData.url) {
    event.description = eventData.url;
    console.log('URL added:', event.description);
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

// 今後のイベントを取得
export async function getUpcomingEvents(env) {
  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );

  // 日本時間で現在時刻を取得
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  
  // 48時間後まで
  const timeMax = new Date(jstNow.getTime() + 48 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: jstNow.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50'
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('イベント取得失敗: ' + error);
  }

  const data = await response.json();
  return data.items || [];
}

// キーワードで予定を検索（今日・明日のみ）
export async function searchEvents(keyword, env) {
  console.log('searchEvents: Function started with keyword:', keyword);

  try {
    console.log('searchEvents: Calling refreshAccessToken...');
    const accessToken = await refreshAccessToken(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REFRESH_TOKEN
    );
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
      maxResults: '50'
    });

    if (keyword) {
      params.set('q', keyword);
      console.log('searchEvents: Search keyword added:', keyword);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`;
    console.log('searchEvents: Making API request to:', url);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    console.log('searchEvents: API response received, ok:', response.ok, 'status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('searchEvents: API error response:', error);
      throw new Error('予定検索失敗: ' + error);
    }

    console.log('searchEvents: Parsing response JSON...');
    const data = await response.json();
    console.log('searchEvents: Response parsed, items count:', data.items ? data.items.length : 0);

    return data.items || [];
  } catch (error) {
    console.error('searchEvents: Exception caught:', error.message);
    console.error('searchEvents: Stack trace:', error.stack);
    throw error;
  }
}

// 指定期間で予定を検索
export async function searchEventsInRange(timeMin, timeMax, keyword, env) {
  console.log('searchEventsInRange: From:', timeMin, 'To:', timeMax);

  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );

  const params = new URLSearchParams({
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50'
  });

  if (keyword) {
    params.set('q', keyword);
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error('予定検索失敗: ' + error);
  }

  const data = await response.json();
  return data.items || [];
}

// 予定を削除
export async function deleteEvent(eventId, env) {
  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );

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
export async function updateEvent(eventId, updateData, env) {
  const accessToken = await refreshAccessToken(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REFRESH_TOKEN
  );

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
