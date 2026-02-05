/**
 * LINE × Google Calendar & Tasks 連携 Worker
 */
import { verifySignature, replyLineMessage, sendLineMessage } from './line.js';
import { createEvent, getUpcomingEvents, searchEvents, searchEventsInRange, deleteEvent, updateEvent } from './calendar.js';
import { createTask, getUpcomingTasks, getAllIncompleteTasks, getTaskLists, completeTask } from './tasks.js';
import { parseEventText } from './gemini.js';
import { handleOAuthCallback, getAuthorizationUrl, isUserAuthenticated, getUserAccessToken } from './oauth.js';

// 日本時間を取得
function getJSTDate() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒で
  return new Date(now.getTime() + jstOffset);
}

// イベントの開始日時を日本時間でフォーマット
function formatEventDateTime(event) {
  if (event.start.dateTime) {
    // dateTimeから直接時刻を抽出（タイムゾーン情報が含まれている）
    const dateTime = event.start.dateTime;
    const date = new Date(dateTime);

    // UTCから日本時間に変換（+9時間）
    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

    const month = jstDate.getUTCMonth() + 1;
    const day = jstDate.getUTCDate();
    const hours = String(jstDate.getUTCHours()).padStart(2, '0');
    const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');

    return {
      dateStr: `${month}/${day}`,
      timeStr: `${hours}:${minutes}`
    };
  } else {
    // 終日イベント
    const date = new Date(event.start.date);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return {
      dateStr: `${month}/${day}`,
      timeStr: '終日'
    };
  }
}

// フォローイベント処理（友達追加時のオンボーディング）
async function handleFollowEvent(event, env) {
  const userId = event.source.userId;
  const replyToken = event.replyToken;

  console.log('Follow event from user:', userId);

  // 既にトークンがある場合はスキップ
  const isAuthenticated = await isUserAuthenticated(userId, env);

  if (isAuthenticated) {
    await replyLineMessage(
      replyToken,
      '再度友だち追加ありがとうございます！\n\n既に認証済みですので、そのままご利用いただけます。',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // LIFF URL生成（セキュリティのため、OAuth URLは直接送信しない）
  const liffUrl = `https://liff.line.me/${env.LIFF_ID}`;

  // ウェルカムメッセージを送信（テキスト形式）
  const welcomeMessage =
    '🎉 ようこそ！Calendar & Tasks Bot\n\n' +
    'あなた専用のAI秘書です。自然な会話でカレンダーやタスクを管理できます。\n\n' +
    '【主な機能】\n' +
    '📅 予定の登録・変更・キャンセル\n' +
    '✅ タスクの管理と期限通知\n' +
    '⏰ 自動リマインダー通知\n' +
    '🔒 完全なプライバシー保護\n\n' +
    '【はじめに】\n' +
    'まず、Googleアカウントとの連携が必要です。\n\n' +
    '下のボタンをタップして、アプリ内で認証してください👇\n\n' +
    liffUrl + '\n\n' +
    '※ セキュリティのため、アプリ内からのみ認証できます\n' +
    '※ このURLを他の人と共有しても問題ありません';

  await replyLineMessage(
    replyToken,
    welcomeMessage,
    env.LINE_CHANNEL_ACCESS_TOKEN
  );

  console.log('Welcome message sent to user:', userId);
}

export default {
  // LINE Webhook処理
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // OAuth callback route
    if (request.method === 'GET' && url.pathname === '/oauth/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // User denied authorization
      if (error) {
        return new Response(
          '<html><head><meta charset="utf-8"></head><body>認証がキャンセルされました。LINEに戻って再度お試しください。<script>setTimeout(() => window.close(), 3000);</script></body></html>',
          {
            status: 400,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }

      if (!code || !state) {
        return new Response(
          '<html><head><meta charset="utf-8"></head><body>無効なリクエストです。</body></html>',
          {
            status: 400,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }

      try {
        await handleOAuthCallback(code, state, env);
        return new Response(
          '<html><head><meta charset="utf-8"></head><body><h1>✅ 認証成功！</h1><p>LINEに戻ってメッセージを送信してください。</p><script>setTimeout(() => window.close(), 3000);</script></body></html>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      } catch (error) {
        console.error('OAuth callback error:', error);
        return new Response(
          `<html><head><meta charset="utf-8"></head><body><h1>⚠️ 認証失敗</h1><p>${error.message}</p><p>LINEに戻って再度お試しください。</p></body></html>`,
          {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }
    }

    // LIFF app route
    if (request.method === 'GET' && url.pathname === '/liff') {
      const liffId = env.LIFF_ID || 'YOUR_LIFF_ID';
      const apiBase = url.origin;
      const liffHtml = generateLiffHtml(liffId, apiBase);
      return new Response(liffHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // CORS headers for LIFF
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Debug: OAuth configuration check
    if (request.method === 'GET' && url.pathname === '/api/oauth-debug') {
      return new Response(JSON.stringify({
        redirect_uri: env.OAUTH_REDIRECT_URI || 'NOT SET',
        client_id_set: !!env.GOOGLE_CLIENT_ID,
        client_secret_set: !!env.GOOGLE_CLIENT_SECRET,
        expected_callback: url.origin + '/oauth/callback'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // LIFF API: Get auth URL for Google OAuth
    if (request.method === 'GET' && url.pathname === '/api/auth-url') {
      const userId = url.searchParams.get('userId');
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const authUrl = getAuthorizationUrl(userId, env);
        return new Response(JSON.stringify({ authUrl }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Auth URL generation error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // LIFF API: Check auth status
    if (request.method === 'GET' && url.pathname === '/api/auth-status') {
      const userId = url.searchParams.get('userId');
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const isAuth = await isUserAuthenticated(userId, env);
        return new Response(JSON.stringify({ authenticated: isAuth }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Auth status check error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // LIFF API: Get events
    if (request.method === 'GET' && url.pathname === '/api/events') {
      const userId = url.searchParams.get('userId');
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const isAuth = await isUserAuthenticated(userId, env);
        if (!isAuth) {
          return new Response(JSON.stringify({ error: 'Not authenticated' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const events = await getUpcomingEvents(userId, env, 90);
        return new Response(JSON.stringify(events), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('LIFF API events error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // LIFF API: Get tasks
    if (request.method === 'GET' && url.pathname === '/api/tasks') {
      const userId = url.searchParams.get('userId');
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const isAuth = await isUserAuthenticated(userId, env);
        if (!isAuth) {
          return new Response(JSON.stringify({ error: 'Not authenticated' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const tasks = await getAllIncompleteTasks(userId, env);
        return new Response(JSON.stringify(tasks), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('LIFF API tasks error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // LIFF API: Complete task
    if (request.method === 'POST' && url.pathname === '/api/tasks/complete') {
      try {
        const body = await request.json();
        const { userId, taskId, listId } = body;

        if (!userId || !taskId || !listId) {
          return new Response(JSON.stringify({ error: 'userId, taskId, listId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const isAuth = await isUserAuthenticated(userId, env);
        if (!isAuth) {
          return new Response(JSON.stringify({ error: 'Not authenticated' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await completeTask(taskId, listId, userId, env);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('LIFF API complete task error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // LINE Webhook
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const body = await request.text();
      const signature = request.headers.get('x-line-signature');

      // 署名検証
      const isValid = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);
      if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
      }

      const data = JSON.parse(body);
      const event = data.events && data.events[0];

      if (event) {
        // Handle follow event (user adds bot as friend)
        if (event.type === 'follow') {
          await handleFollowEvent(event, env);
        }
        // Handle message event
        else if (event.type === 'message' && event.message.type === 'text') {
          await handleMessage(event, env, ctx);
        }
      }

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Cron Trigger（15分ごと）
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAndSendNotifications(env));
  }
};

// メッセージ処理
async function handleMessage(event, env, ctx) {
  console.log('=== handleMessage START ===');
  const replyToken = event.replyToken;
  const userId = event.source.userId;

  // タスク登録待ち状態のチェック（userMessage宣言前に実行）
  const pendingTaskInput = await env.NOTIFICATIONS.get(`pending_task_input_${userId}`);
  if (pendingTaskInput) {
    console.log('Pending task input detected, processing as task');
    await env.NOTIFICATIONS.delete(`pending_task_input_${userId}`);

    const taskInput = event.message.text;
    const taskMessage = `タスク ${taskInput}`;

    // すぐに返信
    await replyLineMessage(
      replyToken,
      '⏳ タスクを登録しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    // 非同期で処理
    ctx.waitUntil(
      (async () => {
        try {
          console.log('Async task registration: calling Gemini API with text:', taskMessage);
          const eventData = await parseEventText(taskMessage, env.GEMINI_API_KEY);
          console.log('Async task registration: Gemini result:', JSON.stringify(eventData));

          if (!eventData) {
            console.error('Async task registration: Gemini returned null');
            await sendLineMessage(
              userId,
              '⚠️ タスクの登録に失敗しました。もう一度お試しください。',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          if (eventData.type !== 'task') {
            console.error('Async task registration: type is not task, got:', eventData.type);
            await sendLineMessage(
              userId,
              '⚠️ タスクの登録に失敗しました。もう一度お試しください。',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // 期限確認（dateがnullの場合）
          if (!eventData.date) {
            console.log('Async task registration: no date, asking for due date');
            await env.NOTIFICATIONS.put(
              `pending_task_due_${userId}`,
              JSON.stringify(eventData),
              { expirationTtl: 600 }
            );

            const dueConfirmMessage = {
              type: 'text',
              text: `✅ 「${eventData.title}」の期限はいつまでですか？`,
              quickReply: {
                items: [
                  {
                    type: 'action',
                    action: {
                      type: 'message',
                      label: '📅 期限あり',
                      text: '期限あり'
                    }
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'message',
                      label: '🔄 期限なし',
                      text: '期限なし'
                    }
                  }
                ]
              }
            };

            await sendLineMessage(
              userId,
              dueConfirmMessage,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            console.log('Async task registration: due date confirmation sent');
            return;
          }

          // リマインダー選択へ進む（dateがある場合）
          console.log('Async task registration: has date, asking for reminder');
          await env.NOTIFICATIONS.put(
            `pending_task_reminder_${userId}`,
            JSON.stringify({
              ...eventData,
              selectedReminders: [] // 選択済みリマインダーを記録
            }),
            { expirationTtl: 600 }
          );

          // 期限までの日数を計算してリマインダーオプションをフィルタリング
          const availableReminders = getAvailableReminders(eventData.date, []);
          const reminderMessage = buildReminderSelectionMessage(eventData.title, eventData.date, availableReminders, true);

          await sendLineMessage(
            userId,
            reminderMessage,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          console.log('Async task registration: reminder selection sent');
        } catch (error) {
          console.error('Async task registration error:', error);
          await sendLineMessage(
            userId,
            '⚠️ タスクの登録中にエラーが発生しました。',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  const userMessage = event.message.text;
  console.log('User message:', userMessage);

  // 認証チェック
  const isAuthenticated = await isUserAuthenticated(userId, env);

  if (!isAuthenticated) {
    console.log('User not authenticated:', userId);
    const liffUrl = `https://liff.line.me/${env.LIFF_ID}`;

    // 認証が必要なメッセージ（LIFF経由のみに変更）
    const authMessage =
      '🔐 Google認証が必要です\n\n' +
      'この機能を使用するには、Googleアカウントとの連携が必要です。\n\n' +
      '下のリンクをタップして、アプリ内で認証してください👇\n\n' +
      liffUrl + '\n\n' +
      '※ セキュリティのため、アプリ内からのみ認証できます';

    await replyLineMessage(
      replyToken,
      authMessage,
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  console.log('User authenticated, processing message');

  // キャンセル中止の検出
  if (userMessage === 'キャンセル中止') {
    await env.NOTIFICATIONS.delete(`pending_cancel_${userId}`);
    await env.NOTIFICATIONS.delete(`pending_complete_${userId}`);
    await replyLineMessage(
      replyToken,
      '❌ キャンセルしました',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // 予定キャンセル確定の検出
  const cancelConfirmMatch = userMessage.match(/^予定キャンセル確定:(\d+)$/);
  if (cancelConfirmMatch) {
    const selectedNumber = parseInt(cancelConfirmMatch[1]);
    const selectedIndex = selectedNumber - 1;
    const pendingCancelData = await env.NOTIFICATIONS.get(`pending_cancel_${userId}`, { type: 'json' });

    if (pendingCancelData && selectedIndex >= 0 && selectedIndex < pendingCancelData.length) {
      const selectedEvent = pendingCancelData[selectedIndex];

      await replyLineMessage(
        replyToken,
        '⏳ 予定をキャンセルしています...',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      ctx.waitUntil(
        (async () => {
          try {
            await deleteEvent(selectedEvent.id, userId, env);
            await env.NOTIFICATIONS.delete(`pending_cancel_${userId}`);

            await sendLineMessage(
              userId,
              `🗑️ 予定をキャンセルしました\n\n📝 ${selectedEvent.summary || '予定'}`,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          } catch (error) {
            console.error('Delete event error:', error);
            await sendLineMessage(
              userId,
              '⚠️ 予定のキャンセルに失敗しました',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          }
        })()
      );
      return;
    }
  }

  // タスク完了確定の検出
  const completeConfirmMatch = userMessage.match(/^タスク完了確定:(\d+)$/);
  if (completeConfirmMatch) {
    const selectedNumber = parseInt(completeConfirmMatch[1]);
    const selectedIndex = selectedNumber - 1;
    const pendingCompleteData = await env.NOTIFICATIONS.get(`pending_complete_${userId}`, { type: 'json' });

    if (pendingCompleteData && selectedIndex >= 0 && selectedIndex < pendingCompleteData.length) {
      const selectedTask = pendingCompleteData[selectedIndex];

      await replyLineMessage(
        replyToken,
        '⏳ タスクを完了にしています...',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      ctx.waitUntil(
        (async () => {
          try {
            await completeTask(selectedTask.id, selectedTask.listId, userId, env);
            await env.NOTIFICATIONS.delete(`pending_complete_${userId}`);

            await sendLineMessage(
              userId,
              `✅ タスクを完了にしました\n\n📝 ${selectedTask.title}`,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          } catch (error) {
            console.error('Complete task error:', error);
            await sendLineMessage(
              userId,
              '⚠️ タスクの完了に失敗しました',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          }
        })()
      );
      return;
    }
  }

  // スター選択の検出（Quick Reply応答）
  if (userMessage === 'スター付きにする' || userMessage === '通常のまま') {
    console.log('Star selection detected:', userMessage);
    const pendingStarKey = `pending_star_${userId}`;
    console.log('Looking for KV key:', pendingStarKey);
    const pendingStarData = await env.NOTIFICATIONS.get(pendingStarKey, { type: 'json' });
    console.log('Retrieved pending star data:', JSON.stringify(pendingStarData));

    if (pendingStarData) {
      const isStarred = userMessage === 'スター付きにする';

      try {
        // タスクを更新（スター情報を追加）
        const accessToken = await getUserAccessToken(userId, env);

        // 既存のタスクを取得
        const getResponse = await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${pendingStarData.listId}/tasks/${pendingStarData.taskId}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        if (getResponse.ok) {
          const task = await getResponse.json();

          // notesを更新
          let notes = task.notes || '';
          if (isStarred) {
            // [STARRED]を追加
            if (!notes.startsWith('[STARRED]')) {
              notes = `[STARRED]\n${notes}`.trim();
            }
          }

          // タスクを更新
          const updateResponse = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${pendingStarData.listId}/tasks/${pendingStarData.taskId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ notes: notes })
            }
          );

          if (updateResponse.ok) {
            // pending dataを削除
            await env.NOTIFICATIONS.delete(pendingStarKey);

            const emoji = isStarred ? '⭐' : '□';
            const label = isStarred ? 'スター付き' : '通常';
            await replyLineMessage(
              replyToken,
              `${emoji} ${label}タスクとして登録しました！\n\n📝 ${pendingStarData.title}`,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            console.log('Task starred status updated');
            return;
          }
        }
      } catch (error) {
        console.error('Star update error:', error);
      }
    }

    // pending dataがない、または更新失敗の場合
    await replyLineMessage(
      replyToken,
      'タスク情報が見つかりませんでした。\n時間が経過している可能性があります。',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // 予定/タスク選択の検出（Quick Reply応答）
  if (userMessage === '予定として登録' || userMessage === 'タスクとして登録') {
    console.log('Type clarification detected:', userMessage);
    const pendingClarificationKey = `pending_clarification_${userId}`;
    const pendingData = await env.NOTIFICATIONS.get(pendingClarificationKey, { type: 'json' });

    console.log('DEBUG: pendingData after type clarification:', JSON.stringify(pendingData));

    if (pendingData) {
      // ユーザーの選択に応じてtypeを更新
      pendingData.type = userMessage === 'タスクとして登録' ? 'task' : 'event';

      // タスクに変更した場合、dateをnullにリセット（期限確認のため）
      if (pendingData.type === 'task') {
        pendingData.date = null;
      }

      await env.NOTIFICATIONS.delete(pendingClarificationKey);

      if (pendingData.type === 'event') {
        // 予定の場合：時間確認
        if (!pendingData.startTime) {
          // 時間が未入力の場合、時間確認
          await env.NOTIFICATIONS.put(
            `pending_event_time_${userId}`,
            JSON.stringify(pendingData),
            { expirationTtl: 600 }
          );

          const timeConfirmMessage = {
            type: 'text',
            text: `📅 「${pendingData.title}」の時間について教えてください。`,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '⏰ 時間が決まっている',
                    text: '時間が決まっている'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '📆 未定（終日）',
                    text: '未定'
                  }
                }
              ]
            }
          };

          await replyLineMessage(replyToken, timeConfirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
          return;
        } else {
          // 時間がある場合、最終確認へ
          await env.NOTIFICATIONS.put(
            `pending_final_confirm_${userId}`,
            JSON.stringify(pendingData),
            { expirationTtl: 600 }
          );

          const confirmMessage = {
            type: 'text',
            text: `📅 以下の内容で登録しますか？\n\n📝 ${pendingData.title}\n📅 ${pendingData.date || '日付未定'}\n⏰ ${pendingData.startTime}${pendingData.endTime ? ` - ${pendingData.endTime}` : ''}`,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '✅ はい',
                    text: '登録確定'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '❌ いいえ',
                    text: '登録キャンセル'
                  }
                }
              ]
            }
          };

          await replyLineMessage(replyToken, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
          return;
        }
      } else {
        // タスクの場合：期限確認
        console.log('DEBUG: Task type selected. Checking date field. pendingData.date:', pendingData.date);
        if (!pendingData.date) {
          // 期限未入力の場合、期限確認
          await env.NOTIFICATIONS.put(
            `pending_task_due_${userId}`,
            JSON.stringify(pendingData),
            { expirationTtl: 600 }
          );

          const dueConfirmMessage = {
            type: 'text',
            text: `✅ 「${pendingData.title}」の期限はいつまでですか？`,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '📅 期限あり',
                    text: '期限あり'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '🔄 期限なし',
                    text: '期限なし'
                  }
                }
              ]
            }
          };

          await replyLineMessage(replyToken, dueConfirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
          return;
        } else {
          // 期限がある場合、最終確認へ
          await env.NOTIFICATIONS.put(
            `pending_final_confirm_${userId}`,
            JSON.stringify(pendingData),
            { expirationTtl: 600 }
          );

          const confirmMessage = {
            type: 'text',
            text: `✅ 以下の内容で登録しますか？\n\n📝 ${pendingData.title}\n📅 期限: ${pendingData.date}`,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '✅ はい',
                    text: '登録確定'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '❌ いいえ',
                    text: '登録キャンセル'
                  }
                }
              ]
            }
          };

          await replyLineMessage(replyToken, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
          return;
        }
      }
    } else {
      // pending dataがない場合
      await replyLineMessage(
        replyToken,
        'データが見つかりませんでした。\n時間が経過している可能性があります。\n\nもう一度入力してください。',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );
      return;
    }
  }

  // 時間確認応答の検出
  if (userMessage === '時間が決まっている' || userMessage === '未定') {
    const pendingEventTime = await env.NOTIFICATIONS.get(`pending_event_time_${userId}`, { type: 'json' });

    if (pendingEventTime) {
      if (userMessage === '未定') {
        // 終日予定として設定
        pendingEventTime.startTime = '00:00';
        pendingEventTime.endTime = '23:59';
        pendingEventTime.isAllDay = true;

        // 日付がない場合は日付を聞く
        if (!pendingEventTime.date) {
          await env.NOTIFICATIONS.delete(`pending_event_time_${userId}`);
          await env.NOTIFICATIONS.put(
            `pending_event_date_${userId}`,
            JSON.stringify(pendingEventTime),
            { expirationTtl: 600 }
          );

          await replyLineMessage(
            replyToken,
            `📅 「${pendingEventTime.title}」はいつの予定ですか？\n\n例：\n・今日\n・明日\n・2月10日\n・来週月曜日`,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          return;
        }

        await env.NOTIFICATIONS.delete(`pending_event_time_${userId}`);
        await env.NOTIFICATIONS.put(
          `pending_final_confirm_${userId}`,
          JSON.stringify(pendingEventTime),
          { expirationTtl: 600 }
        );

        const confirmMessage = {
          type: 'text',
          text: `📅 以下の内容で登録しますか？\n\n📝 ${pendingEventTime.title}\n📅 ${pendingEventTime.date}\n⏰ 終日`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '✅ はい',
                  text: '登録確定'
                }
              },
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '❌ いいえ',
                  text: '登録キャンセル'
                }
              }
            ]
          }
        };

        await replyLineMessage(replyToken, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
      } else {
        // 時間入力を促す
        await replyLineMessage(
          replyToken,
          '⏰ 何時からですか？\n\n例：\n・14時\n・10時30分\n・14:00',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    }
  }

  // 期限確認応答の検出
  if (userMessage === '期限あり' || userMessage === '期限なし') {
    const pendingTaskDue = await env.NOTIFICATIONS.get(`pending_task_due_${userId}`, { type: 'json' });

    if (pendingTaskDue) {
      if (userMessage === '期限なし') {
        // 期限なしとして最終確認
        await env.NOTIFICATIONS.delete(`pending_task_due_${userId}`);
        await env.NOTIFICATIONS.put(
          `pending_final_confirm_${userId}`,
          JSON.stringify(pendingTaskDue),
          { expirationTtl: 600 }
        );

        const confirmMessage = {
          type: 'text',
          text: `✅ 以下の内容で登録しますか？\n\n📝 ${pendingTaskDue.title}\n📅 期限: なし`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '✅ はい',
                  text: '登録確定'
                }
              },
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '❌ いいえ',
                  text: '登録キャンセル'
                }
              }
            ]
          }
        };

        await replyLineMessage(replyToken, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
      } else {
        // 期限入力を促す
        await replyLineMessage(
          replyToken,
          '📅 期限はいつですか？\n\n例：\n・明日\n・2月10日\n・来週月曜日',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    }
  }

  // リマインダー選択の検出（複数選択対応）
  if (userMessage.startsWith('リマインダー:')) {
    const pendingTaskReminder = await env.NOTIFICATIONS.get(`pending_task_reminder_${userId}`, { type: 'json' });

    if (pendingTaskReminder) {
      const reminderType = userMessage.replace('リマインダー:', '');
      console.log('Reminder selected:', reminderType);

      // 「なし」または「終わり」の場合は最終確認へ
      if (reminderType === 'なし' || reminderType === '終わり') {
        await env.NOTIFICATIONS.delete(`pending_task_reminder_${userId}`);

        // 選択済みリマインダーを保存
        pendingTaskReminder.reminders = pendingTaskReminder.selectedReminders || [];
        delete pendingTaskReminder.selectedReminders;

        await env.NOTIFICATIONS.put(
          `pending_final_confirm_${userId}`,
          JSON.stringify(pendingTaskReminder),
          { expirationTtl: 600 }
        );

        // 最終確認
        let reminderText = '';
        if (pendingTaskReminder.reminders.length > 0) {
          reminderText = '\n⏰ リマインダー: ' + pendingTaskReminder.reminders.join(', ');
        } else {
          reminderText = '\n⏰ リマインダー: なし';
        }

        const confirmMessage = {
          type: 'text',
          text: `✅ 以下の内容で登録しますか？\n\n📝 ${pendingTaskReminder.title}\n📅 期限: ${pendingTaskReminder.date}${reminderText}`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '✅ はい',
                  text: '登録確定'
                }
              },
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '❌ いいえ',
                  text: '登録キャンセル'
                }
              }
            ]
          }
        };

        await replyLineMessage(replyToken, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
      }

      // リマインダーを選択済みリストに追加
      if (!pendingTaskReminder.selectedReminders) {
        pendingTaskReminder.selectedReminders = [];
      }
      pendingTaskReminder.selectedReminders.push(reminderType);
      console.log('Selected reminders so far:', pendingTaskReminder.selectedReminders);

      // 残りの利用可能なリマインダーを取得
      const availableReminders = getAvailableReminders(pendingTaskReminder.date, pendingTaskReminder.selectedReminders);

      if (availableReminders.length === 0) {
        // もう選択肢がない場合は最終確認へ
        await env.NOTIFICATIONS.delete(`pending_task_reminder_${userId}`);

        pendingTaskReminder.reminders = pendingTaskReminder.selectedReminders;
        delete pendingTaskReminder.selectedReminders;

        await env.NOTIFICATIONS.put(
          `pending_final_confirm_${userId}`,
          JSON.stringify(pendingTaskReminder),
          { expirationTtl: 600 }
        );

        const reminderText = '\n⏰ リマインダー: ' + pendingTaskReminder.reminders.join(', ');
        const confirmMessage = {
          type: 'text',
          text: `✅ 以下の内容で登録しますか？\n\n📝 ${pendingTaskReminder.title}\n📅 期限: ${pendingTaskReminder.date}${reminderText}`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '✅ はい',
                  text: '登録確定'
                }
              },
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '❌ いいえ',
                  text: '登録キャンセル'
                }
              }
            ]
          }
        };

        await replyLineMessage(replyToken, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
      }

      // まだ選択肢がある場合は「他にも設定しますか？」を表示
      await env.NOTIFICATIONS.put(
        `pending_task_reminder_${userId}`,
        JSON.stringify(pendingTaskReminder),
        { expirationTtl: 600 }
      );

      const nextReminderMessage = buildReminderSelectionMessage(
        pendingTaskReminder.title,
        pendingTaskReminder.date,
        availableReminders,
        false
      );

      await replyLineMessage(replyToken, nextReminderMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
      return;
    }
  }

  // イベントリマインダー選択の検出
  if (userMessage.startsWith('イベントリマインダー:')) {
    const pendingEventReminder = await env.NOTIFICATIONS.get(`pending_event_reminder_${userId}`, { type: 'json' });

    if (pendingEventReminder) {
      const reminderType = userMessage.replace('イベントリマインダー:', '');
      console.log('Event reminder selected:', reminderType);

      // 「なし」または「終わり」の場合は保存して終了
      if (reminderType === 'なし' || reminderType === '終わり') {
        await env.NOTIFICATIONS.delete(`pending_event_reminder_${userId}`);

        // 選択済みリマインダーを保存
        if (pendingEventReminder.selectedReminders && pendingEventReminder.selectedReminders.length > 0) {
          await env.NOTIFICATIONS.put(
            `event_reminder_${userId}_${pendingEventReminder.eventId}`,
            JSON.stringify(pendingEventReminder.selectedReminders),
            { expirationTtl: 30 * 24 * 60 * 60 } // 30日間保持
          );

          await replyLineMessage(
            replyToken,
            `✅ リマインダーを設定しました\n\n⏰ ${pendingEventReminder.selectedReminders.join(', ')}`,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        } else {
          await replyLineMessage(
            replyToken,
            '✅ リマインダーなしで登録しました',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
        return;
      }

      // リマインダーを選択済みリストに追加
      if (!pendingEventReminder.selectedReminders) {
        pendingEventReminder.selectedReminders = [];
      }
      pendingEventReminder.selectedReminders.push(reminderType);
      console.log('Selected event reminders so far:', pendingEventReminder.selectedReminders);

      // 残りの利用可能なリマインダーを取得
      const availableReminders = getAvailableEventReminders(
        pendingEventReminder.startDateTime,
        pendingEventReminder.hasTime,
        pendingEventReminder.selectedReminders
      );

      if (availableReminders.length === 0) {
        // もう選択肢がない場合は保存して終了
        await env.NOTIFICATIONS.delete(`pending_event_reminder_${userId}`);

        await env.NOTIFICATIONS.put(
          `event_reminder_${userId}_${pendingEventReminder.eventId}`,
          JSON.stringify(pendingEventReminder.selectedReminders),
          { expirationTtl: 30 * 24 * 60 * 60 }
        );

        await replyLineMessage(
          replyToken,
          `✅ リマインダーを設定しました\n\n⏰ ${pendingEventReminder.selectedReminders.join(', ')}`,
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }

      // まだ選択肢がある場合は「他にも設定しますか？」を表示
      await env.NOTIFICATIONS.put(
        `pending_event_reminder_${userId}`,
        JSON.stringify(pendingEventReminder),
        { expirationTtl: 600 }
      );

      const nextReminderMessage = buildEventReminderSelectionMessage(
        pendingEventReminder.title,
        pendingEventReminder.dateTimeStr,
        availableReminders,
        false
      );

      await replyLineMessage(replyToken, nextReminderMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
      return;
    }
  }

  // スヌーズの検出
  if (userMessage.startsWith('スヌーズ:')) {
    const parts = userMessage.split(':');
    if (parts.length === 3) {
      const taskId = parts[1];
      const snoozeOption = parts[2];

      console.log('Snooze selected:', taskId, snoozeOption);

      // スヌーズ時間を計算
      const now = new Date();
      let snoozeUntil;

      if (snoozeOption === '10分') {
        snoozeUntil = new Date(now.getTime() + 10 * 60 * 1000);
      } else if (snoozeOption === '30分') {
        snoozeUntil = new Date(now.getTime() + 30 * 60 * 1000);
      } else if (snoozeOption === '1時間') {
        snoozeUntil = new Date(now.getTime() + 60 * 60 * 1000);
      } else if (snoozeOption === '3時間') {
        snoozeUntil = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      } else if (snoozeOption === '明日朝') {
        snoozeUntil = new Date(now);
        snoozeUntil.setDate(snoozeUntil.getDate() + 1);
        snoozeUntil.setHours(9, 0, 0, 0);
      }

      if (snoozeUntil) {
        // スヌーズ情報を保存
        await env.NOTIFICATIONS.put(
          `task_snooze_${userId}_${taskId}`,
          JSON.stringify({
            snoozeUntil: snoozeUntil.getTime(),
            taskId: taskId
          }),
          { expirationTtl: 24 * 60 * 60 } // 24時間保持
        );

        const snoozeTimeStr = `${snoozeUntil.getHours()}:${String(snoozeUntil.getMinutes()).padStart(2, '0')}`;
        await replyLineMessage(
          replyToken,
          `⏰ ${snoozeOption}後にリマインドします（${snoozeTimeStr}）`,
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        console.log('Snooze set:', taskId, 'until', snoozeUntil);
        return;
      }
    }
  }

  // 最終確認応答の検出
  if (userMessage === '登録確定') {
    const pendingFinalConfirm = await env.NOTIFICATIONS.get(`pending_final_confirm_${userId}`, { type: 'json' });

    if (pendingFinalConfirm) {
      await env.NOTIFICATIONS.delete(`pending_final_confirm_${userId}`);

      await replyLineMessage(
        replyToken,
        '⏳ 登録しています...',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      ctx.waitUntil(
        (async () => {
          try {
            console.log('Registration: pendingFinalConfirm =', JSON.stringify(pendingFinalConfirm));
            console.log('Registration: type =', pendingFinalConfirm.type);

            // タスクか判定（typeが'task'または、startTimeがなく日付も確定していない場合）
            const isTask = pendingFinalConfirm.type === 'task' ||
                          (!pendingFinalConfirm.startTime && !pendingFinalConfirm.isAllDay);

            if (isTask) {
              // type を明示的に設定
              pendingFinalConfirm.type = 'task';
              // タスク登録
              const taskData = {
                title: pendingFinalConfirm.title,
                due: pendingFinalConfirm.date || null,
                notes: [pendingFinalConfirm.location, pendingFinalConfirm.url].filter(Boolean).join('\n') || null,
                listName: pendingFinalConfirm.listName || null
              };

              const task = await createTask(taskData, userId, env);

              // リマインダー設定を保存（配列として）
              if (pendingFinalConfirm.reminders && pendingFinalConfirm.reminders.length > 0) {
                await env.NOTIFICATIONS.put(
                  `task_reminder_${userId}_${task.id}`,
                  JSON.stringify(pendingFinalConfirm.reminders),
                  { expirationTtl: 90 * 24 * 60 * 60 } // 90日間保持
                );
                console.log('Reminders saved:', task.id, pendingFinalConfirm.reminders);
              }

              // スター選択用のKVデータ保存
              await env.NOTIFICATIONS.put(
                `pending_star_${userId}`,
                JSON.stringify({
                  taskId: task.id,
                  listId: task.listId,
                  title: pendingFinalConfirm.title
                }),
                { expirationTtl: 600 }
              );

              // Quick Replyでスター選択
              const successMessage = {
                type: 'text',
                text: `✅ タスクを登録しました！\n\n📝 ${pendingFinalConfirm.title}\n📋 リスト: ${task.listTitle}${pendingFinalConfirm.date ? `\n📅 期限: ${pendingFinalConfirm.date}` : ''}\n\nこのタスクは重要ですか？`,
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '⭐ 重要',
                        text: 'スター付きにする'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '□ 通常',
                        text: '通常のまま'
                      }
                    }
                  ]
                }
              };

              await sendLineMessage(userId, successMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
            } else {
              // 予定登録
              // 日付がない場合はエラー（タスクとして登録すべきだった可能性）
              if (!pendingFinalConfirm.date) {
                console.error('Event registration failed: no date specified');
                console.error('Data:', JSON.stringify(pendingFinalConfirm));
                // タスクとして登録を試みる
                const taskData = {
                  title: pendingFinalConfirm.title,
                  due: null,
                  notes: null,
                  listName: null
                };
                const task = await createTask(taskData, userId, env);
                await sendLineMessage(
                  userId,
                  `✅ タスクとして登録しました！\n\n📝 ${pendingFinalConfirm.title}\n📋 リスト: ${task.listTitle}`,
                  env.LINE_CHANNEL_ACCESS_TOKEN
                );
                return;
              }

              const calendarEvent = await createEvent(pendingFinalConfirm, userId, env);

              await sendLineMessage(
                userId,
                `📅 予定を登録しました！\n\n📝 ${pendingFinalConfirm.title}\n📅 ${pendingFinalConfirm.date}\n⏰ ${pendingFinalConfirm.startTime}${pendingFinalConfirm.endTime ? ` - ${pendingFinalConfirm.endTime}` : ''}`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );

              // リマインダー設定フロー
              const hasTime = !!pendingFinalConfirm.startTime;
              const startDateTime = `${pendingFinalConfirm.date}T${pendingFinalConfirm.startTime || '00:00'}:00`;
              const availableReminders = getAvailableEventReminders(startDateTime, hasTime, []);

              if (availableReminders.length > 0) {
                const dateTimeStr = hasTime
                  ? `${pendingFinalConfirm.date} ${pendingFinalConfirm.startTime}`
                  : pendingFinalConfirm.date;

                const reminderMessage = buildEventReminderSelectionMessage(
                  pendingFinalConfirm.title,
                  dateTimeStr,
                  availableReminders,
                  true
                );

                await sendLineMessage(userId, reminderMessage, env.LINE_CHANNEL_ACCESS_TOKEN);

                // リマインダー待機状態を保存
                await env.NOTIFICATIONS.put(
                  `pending_event_reminder_${userId}`,
                  JSON.stringify({
                    eventId: calendarEvent.id,
                    title: pendingFinalConfirm.title,
                    startDateTime: startDateTime,
                    hasTime: hasTime,
                    dateTimeStr: dateTimeStr,
                    selectedReminders: []
                  }),
                  { expirationTtl: 600 }
                );
              }
            }
          } catch (error) {
            console.error('Final confirmation registration error:', error);
            console.error('Error stack:', error.stack);
            console.error('pendingFinalConfirm data:', JSON.stringify(pendingFinalConfirm));
            await sendLineMessage(
              userId,
              `⚠️ 登録に失敗しました。\n\nエラー: ${error.message}\n\nもう一度お試しください。`,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          }
        })()
      );
      return;
    }
  }

  // 登録キャンセルの検出
  if (userMessage === '登録キャンセル') {
    await env.NOTIFICATIONS.delete(`pending_final_confirm_${userId}`);
    await env.NOTIFICATIONS.delete(`pending_event_time_${userId}`);
    await env.NOTIFICATIONS.delete(`pending_task_due_${userId}`);

    await replyLineMessage(
      replyToken,
      '❌ 登録をキャンセルしました',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // 変更確定の検出
  if (userMessage === '変更確定') {
    const pendingUpdateConfirm = await env.NOTIFICATIONS.get(`pending_update_confirm_${userId}`, { type: 'json' });

    if (pendingUpdateConfirm) {
      await replyLineMessage(
        replyToken,
        '⏳ 予定を変更しています...',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      ctx.waitUntil(
        (async () => {
          try {
            const { eventId, eventSummary, updateData } = pendingUpdateConfirm;

            // 予定を更新
            await updateEvent(eventId, updateData, userId, env);
            await env.NOTIFICATIONS.delete(`pending_update_confirm_${userId}`);

            let message = `✅ 予定を変更しました\n\n📝 ${eventSummary || '予定'}`;
            if (updateData.startTime) {
              message += `\n⏰ 新しい時刻: ${updateData.startTime}`;
              if (updateData.endTime) {
                message += ` - ${updateData.endTime}`;
              }
            }
            if (updateData.location) {
              message += `\n📍 場所: ${updateData.location}`;
            }

            await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
          } catch (error) {
            console.error('Update confirm error:', error);
            await sendLineMessage(
              userId,
              '⚠️ 予定の変更に失敗しました',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          }
        })()
      );
      return;
    }
  }

  // 変更キャンセルの検出
  if (userMessage === '変更キャンセル') {
    await env.NOTIFICATIONS.delete(`pending_update_confirm_${userId}`);

    await replyLineMessage(
      replyToken,
      '❌ 変更をキャンセルしました',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // 予定登録方法の検出
  if (userMessage.includes('予定を登録してください') || userMessage === '登録方法' || userMessage === 'ヘルプ' || userMessage === '予定登録') {
    console.log('Event help message detected');
    await replyLineMessage(
      replyToken,
      '📝 予定の登録方法\n\n' +
      '以下の形式で送信してください：\n\n' +
      '【予定の例】\n' +
      '・明日14時 ミーティング\n' +
      '・2月5日19時 飲み会\n' +
      '・今日15時から17時 会議\n' +
      '・明後日10時 歯医者 at 渋谷\n\n' +
      '【その他の操作】\n' +
      '・予定一覧 → 予定を表示\n' +
      '・[予定名]をキャンセル\n' +
      '・[予定名]を[時刻]に変更',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // タスク登録ボタンの検出
  if (userMessage === 'タスク登録') {
    console.log('Task registration button detected');

    // タスク登録待ち状態を保存
    await env.NOTIFICATIONS.put(
      `pending_task_input_${userId}`,
      'waiting',
      { expirationTtl: 600 }
    );

    await replyLineMessage(
      replyToken,
      '✅ タスクを登録します。\n\nタスクの内容を入力してください。\n\n例：\n・買い物\n・レポート提出 期限2月10日\n・会議資料作成',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // タスク登録方法のヘルプ
  if (userMessage === 'タスク' || userMessage === 'タスク登録方法') {
    console.log('Task help message detected');
    await replyLineMessage(
      replyToken,
      '✅ タスクの登録方法\n\n' +
      '以下の形式で送信してください：\n\n' +
      '【基本】\n' +
      '・タスク 牛乳を買う\n' +
      '・タスク レポート提出\n\n' +
      '【期限付き】\n' +
      '・タスク 書類提出 期限2月10日\n' +
      '・タスク 会議資料作成 期限明日\n\n' +
      '【メモ付き】\n' +
      '・タスク 買い物 スーパーで\n' +
      '・タスク 予約 https://example.com\n\n' +
      '【その他の操作】\n' +
      '・タスク一覧 → 未完了タスクを表示',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // 予定のキャンセルの検出
  if (userMessage === '予定のキャンセル方法' || userMessage === '予定キャンセル') {
    console.log('Event cancel request detected');

    // すぐに返信
    await replyLineMessage(
      replyToken,
      '⏳ 予定を取得しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    // 非同期で処理
    ctx.waitUntil(
      (async () => {
        try {
          // 予定一覧を取得（今後3ヶ月）
          const now = new Date();
          const jstOffset = 9 * 60 * 60 * 1000;
          const jstNow = new Date(now.getTime() + jstOffset);

          const timeMin = jstNow.toISOString();
          const threeMonthsLater = new Date(jstNow.getTime() + 90 * 24 * 60 * 60 * 1000);
          const timeMax = threeMonthsLater.toISOString();

          const events = await searchEventsInRange(timeMin, timeMax, '', userId, env);

          if (events.length === 0) {
            await sendLineMessage(
              userId,
              '📅 今後の予定はありません',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // 予定をKVに保存
          await env.NOTIFICATIONS.put(
            `pending_cancel_${userId}`,
            JSON.stringify(events),
            { expirationTtl: 600 }
          );

          // 予定一覧を表示
          let message = '🗑️ どの予定をキャンセルしますか？\n\n';
          let eventNumber = 1;
          for (const event of events) {
            const { dateStr, timeStr } = formatEventDateTime(event);
            message += `${eventNumber}. ${event.summary || '予定'}\n⏰ ${dateStr} ${timeStr}\n\n`;
            eventNumber++;
          }
          message += '\n番号を入力してください（例: 1）';

          await sendLineMessage(userId, message.trim(), env.LINE_CHANNEL_ACCESS_TOKEN);
          // 文脈を保存
          await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message.trim(), { expirationTtl: 300 });
        } catch (error) {
          console.error('Cancel event error:', error);
          await sendLineMessage(
            userId,
            '⚠️ 予定の取得に失敗しました',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // 予定の変更の検出
  if (userMessage === '予定の変更方法') {
    console.log('Event update request detected');

    // すぐに返信
    await replyLineMessage(
      replyToken,
      '⏳ 予定を取得しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    // 非同期で処理
    ctx.waitUntil(
      (async () => {
        try {
          // 予定一覧を取得（今後3ヶ月）
          const now = new Date();
          const jstOffset = 9 * 60 * 60 * 1000;
          const jstNow = new Date(now.getTime() + jstOffset);

          const timeMin = jstNow.toISOString();
          const threeMonthsLater = new Date(jstNow.getTime() + 90 * 24 * 60 * 60 * 1000);
          const timeMax = threeMonthsLater.toISOString();

          const events = await searchEventsInRange(timeMin, timeMax, '', userId, env);

          if (events.length === 0) {
            await sendLineMessage(
              userId,
              '📅 今後の予定はありません',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // 予定をKVに保存
          await env.NOTIFICATIONS.put(
            `pending_update_${userId}`,
            JSON.stringify(events),
            { expirationTtl: 600 }
          );

          // 予定一覧を表示
          let message = '✏️ どの予定を変更しますか？\n\n';
          let eventNumber = 1;
          for (const event of events) {
            const { dateStr, timeStr } = formatEventDateTime(event);
            message += `${eventNumber}. ${event.summary || '予定'}\n⏰ ${dateStr} ${timeStr}\n\n`;
            eventNumber++;
          }
          message += '\n番号を入力してください（例: 1）';

          await sendLineMessage(userId, message.trim(), env.LINE_CHANNEL_ACCESS_TOKEN);
          // 文脈を保存
          await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message.trim(), { expirationTtl: 300 });
        } catch (error) {
          console.error('Update event error:', error);
          await sendLineMessage(
            userId,
            '⚠️ 予定の取得に失敗しました',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // タスク完了/削除の検出
  if (userMessage === 'タスク完了方法' || userMessage === 'タスク削除' || userMessage === 'タスク完了') {
    console.log('Task complete request detected');

    // すぐに返信
    await replyLineMessage(
      replyToken,
      '⏳ タスクを取得しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    // 非同期で処理
    ctx.waitUntil(
      (async () => {
        try {
          const tasks = await getAllIncompleteTasks(userId, env);

          if (tasks.length === 0) {
            await sendLineMessage(
              userId,
              '✅ 未完了のタスクはありません！',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // タスクをKVに保存
          console.log('Saving tasks to KV for completion:', tasks.length);
          await env.NOTIFICATIONS.put(
            `pending_complete_${userId}`,
            JSON.stringify(tasks),
            { expirationTtl: 600 }
          );
          console.log('Tasks saved to KV successfully');

          // タスク一覧を表示
          let message = '✅ どのタスクを完了にしますか？\n\n';
          let taskNumber = 1;
          for (const task of tasks) {
            const icon = task.starred ? '⭐' : '□';
            message += `${taskNumber}. ${icon} ${task.title}`;
            if (task.due) {
              const dueDate = getTaskDueDateInJST(task.due);
              message += ` (期限: ${dueDate.getMonth() + 1}/${dueDate.getDate()})`;
            }
            message += '\n';
            taskNumber++;
          }
          message += '\n番号を入力してください（例: 1）';

          await sendLineMessage(userId, message.trim(), env.LINE_CHANNEL_ACCESS_TOKEN);
          // 文脈を保存
          await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message.trim(), { expirationTtl: 300 });
        } catch (error) {
          console.error('Complete task error:', error);
          await sendLineMessage(
            userId,
            '⚠️ タスクの取得に失敗しました',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // タスク一覧の検出
  if (userMessage === 'タスク一覧') {
    console.log('Task list request detected');

    // すぐに返信
    await replyLineMessage(
      replyToken,
      '⏳ タスクを取得しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    // 非同期で処理
    ctx.waitUntil(
      (async () => {
        try {
          const tasks = await getAllIncompleteTasks(userId, env);

          if (tasks.length === 0) {
            await sendLineMessage(
              userId,
              '✅ 未完了のタスクはありません！',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // タスク一覧をKVに保存（番号選択用）
          await env.NOTIFICATIONS.put(
            `task_list_${userId}`,
            JSON.stringify(tasks),
            { expirationTtl: 600 } // 10分間有効
          );

          // pending_complete にも保存（番号で完了できるように）
          await env.NOTIFICATIONS.put(
            `pending_complete_${userId}`,
            JSON.stringify(tasks),
            { expirationTtl: 600 }
          );

          // タスクをそのまま表示（既にソート済み）
          let message = '📋 未完了タスク一覧\n\n';

          // グループ化せず、ソート順で表示（番号付き）
          let currentList = '';
          let taskNumber = 1;
          for (const task of tasks) {
            // リストが変わったら見出しを表示
            if (currentList !== task.listTitle) {
              if (currentList !== '') message += '\n';
              message += `【${task.listTitle}】\n`;
              currentList = task.listTitle;
            }

            // スター付きタスクは ⭐ を先頭に表示
            const icon = task.starred ? '⭐' : '□';
            message += `${taskNumber}. ${icon} ${task.title}`;

            if (task.due) {
              const dueDate = getTaskDueDateInJST(task.due);
              message += ` (期限: ${dueDate.getMonth() + 1}/${dueDate.getDate()})`;
            }
            message += '\n';
            taskNumber++;
          }

          message += '\n完了にするには番号を入力（例: 1完了）';

          await sendLineMessage(
            userId,
            message.trim(),
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          // 文脈を保存
          await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message.trim(), { expirationTtl: 300 });
        } catch (error) {
          console.error('Task list error:', error);
          await sendLineMessage(
            userId,
            '⚠️ タスクの取得に失敗しました',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // 番号+アクションの検出（例：16キャンセル、3完了）
  const numberActionMatch = userMessage.match(/^(\d+)\s*(キャンセル|削除|完了|終了)$/);
  if (numberActionMatch) {
    console.log('Number + action input detected:', numberActionMatch[1], numberActionMatch[2]);
    const selectedNumber = parseInt(numberActionMatch[1]);
    const selectedIndex = selectedNumber - 1;
    const actionType = numberActionMatch[2];

    if (actionType === 'キャンセル' || actionType === '削除') {
      // 予定キャンセルの処理
      const pendingCancelData = await env.NOTIFICATIONS.get(`pending_cancel_${userId}`, { type: 'json' });
      if (pendingCancelData && selectedIndex >= 0 && selectedIndex < pendingCancelData.length) {
        const selectedEvent = pendingCancelData[selectedIndex];

        await replyLineMessage(
          replyToken,
          '⏳ 予定をキャンセルしています...',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );

        ctx.waitUntil(
          (async () => {
            try {
              await deleteEvent(selectedEvent.id, userId, env);
              await env.NOTIFICATIONS.delete(`pending_cancel_${userId}`);
              await sendLineMessage(
                userId,
                `🗑️ 予定をキャンセルしました\n\n📝 ${selectedEvent.summary || '予定'}`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
            } catch (error) {
              console.error('Delete event error:', error);
              await sendLineMessage(
                userId,
                '⚠️ 予定のキャンセルに失敗しました',
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
            }
          })()
        );
        return;
      } else {
        await replyLineMessage(
          replyToken,
          '無効な番号です。「予定キャンセル」で一覧を確認してください。',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    }

    if (actionType === '完了' || actionType === '終了') {
      // タスク完了の処理
      const pendingCompleteData = await env.NOTIFICATIONS.get(`pending_complete_${userId}`, { type: 'json' });
      if (pendingCompleteData && selectedIndex >= 0 && selectedIndex < pendingCompleteData.length) {
        const selectedTask = pendingCompleteData[selectedIndex];

        await replyLineMessage(
          replyToken,
          '⏳ タスクを完了にしています...',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );

        ctx.waitUntil(
          (async () => {
            try {
              await completeTask(selectedTask.id, selectedTask.listId, userId, env);
              await env.NOTIFICATIONS.delete(`pending_complete_${userId}`);
              await sendLineMessage(
                userId,
                `✅ タスクを完了しました\n\n📝 ${selectedTask.title}`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
            } catch (error) {
              console.error('Complete task error:', error);
              await sendLineMessage(
                userId,
                '⚠️ タスクの完了に失敗しました',
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
            }
          })()
        );
        return;
      } else {
        await replyLineMessage(
          replyToken,
          '無効な番号です。「タスク完了」で一覧を確認してください。',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    }
  }

  // タスク名+完了の検出（例：「布団買った完了」「牛乳買う終了」）
  const taskNameCompleteMatch = userMessage.match(/^(.+?)\s*(完了|終了)$/);
  if (taskNameCompleteMatch && !userMessage.match(/^(\d+)\s*(完了|終了)$/)) {
    const taskName = taskNameCompleteMatch[1].trim();
    console.log('Task name + complete detected:', taskName);

    // pending_complete から該当タスクを検索
    const pendingCompleteData = await env.NOTIFICATIONS.get(`pending_complete_${userId}`, { type: 'json' });
    if (pendingCompleteData) {
      const matchingTask = pendingCompleteData.find(task =>
        task.title.includes(taskName) || taskName.includes(task.title)
      );

      if (matchingTask) {
        await replyLineMessage(
          replyToken,
          '⏳ タスクを完了にしています...',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );

        ctx.waitUntil(
          (async () => {
            try {
              await completeTask(matchingTask.id, matchingTask.listId, userId, env);
              await env.NOTIFICATIONS.delete(`pending_complete_${userId}`);
              await sendLineMessage(
                userId,
                `✅ タスクを完了しました\n\n📝 ${matchingTask.title}`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
            } catch (error) {
              console.error('Complete task error:', error);
              await sendLineMessage(
                userId,
                '⚠️ タスクの完了に失敗しました',
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
            }
          })()
        );
        return;
      }
    }

    // pending_complete がない場合、全タスクから検索して完了
    await replyLineMessage(
      replyToken,
      '⏳ タスクを検索しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    ctx.waitUntil(
      (async () => {
        try {
          const allTasks = await getAllIncompleteTasks(userId, env);
          const matchingTask = allTasks.find(task =>
            task.title.includes(taskName) || taskName.includes(task.title)
          );

          if (matchingTask) {
            await completeTask(matchingTask.id, matchingTask.listId, userId, env);
            await sendLineMessage(
              userId,
              `✅ タスクを完了しました\n\n📝 ${matchingTask.title}`,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          } else {
            await sendLineMessage(
              userId,
              `「${taskName}」に該当するタスクが見つかりませんでした。\n\n「タスク一覧」で確認してください。`,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          }
        } catch (error) {
          console.error('Search and complete task error:', error);
          await sendLineMessage(
            userId,
            '⚠️ タスクの完了に失敗しました',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // 数字入力の検出（pending actionがある場合）
  const numberMatch = userMessage.match(/^(\d+)$/);
  if (numberMatch) {
    console.log('Number input detected:', numberMatch[1]);
    const selectedNumber = parseInt(numberMatch[1]);
    const selectedIndex = selectedNumber - 1;

    // 予定キャンセルの処理
    const pendingCancelData = await env.NOTIFICATIONS.get(`pending_cancel_${userId}`, { type: 'json' });
    if (pendingCancelData) {
      if (selectedIndex >= 0 && selectedIndex < pendingCancelData.length) {
        const selectedEvent = pendingCancelData[selectedIndex];

        // 確認メッセージ（Quick Reply）
        const confirmMessage = {
          type: 'text',
          text: `本当にこの予定をキャンセルしますか？\n\n📝 ${selectedEvent.summary || '予定'}\n⏰ ${formatEventDateTime(selectedEvent).dateStr} ${formatEventDateTime(selectedEvent).timeStr}`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '✅ はい',
                  text: `予定キャンセル確定:${selectedNumber}`
                }
              },
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '❌ いいえ',
                  text: 'キャンセル中止'
                }
              }
            ]
          }
        };

        await replyLineMessage(replyToken, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
      } else {
        await replyLineMessage(
          replyToken,
          '無効な番号です。もう一度お試しください。',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    }

    // 予定変更の処理
    const pendingUpdateData = await env.NOTIFICATIONS.get(`pending_update_${userId}`, { type: 'json' });
    if (pendingUpdateData) {
      if (selectedIndex >= 0 && selectedIndex < pendingUpdateData.length) {
        const selectedEvent = pendingUpdateData[selectedIndex];

        // 変更内容入力を促す
        await env.NOTIFICATIONS.put(
          `pending_update_event_${userId}`,
          JSON.stringify(selectedEvent),
          { expirationTtl: 600 }
        );

        await env.NOTIFICATIONS.delete(`pending_update_${userId}`);

        await replyLineMessage(
          replyToken,
          `✏️ 予定の変更内容を入力してください\n\n📝 ${selectedEvent.summary || '予定'}\n\n【例】\n・15時に変更\n・明日14時に変更\n・場所を渋谷に変更`,
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      } else {
        await replyLineMessage(
          replyToken,
          '無効な番号です。もう一度お試しください。',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    }

    // タスク完了の処理
    console.log('Checking for pending_complete data...');
    const pendingCompleteData = await env.NOTIFICATIONS.get(`pending_complete_${userId}`, { type: 'json' });
    console.log('pending_complete data:', pendingCompleteData ? `Found ${pendingCompleteData.length} tasks` : 'Not found');
    if (pendingCompleteData) {
      if (selectedIndex >= 0 && selectedIndex < pendingCompleteData.length) {
        const selectedTask = pendingCompleteData[selectedIndex];
        console.log('Selected task for completion:', selectedTask.title);

        // 確認メッセージ（Quick Reply）
        const confirmMessage = {
          type: 'text',
          text: `このタスクを完了にしますか？\n\n${selectedTask.starred ? '⭐' : '□'} ${selectedTask.title}`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '✅ はい',
                  text: `タスク完了確定:${selectedNumber}`
                }
              },
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '❌ いいえ',
                  text: 'キャンセル中止'
                }
              }
            ]
          }
        };

        await replyLineMessage(replyToken, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        return;
      } else {
        await replyLineMessage(
          replyToken,
          '無効な番号です。もう一度お試しください。',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    }

    // 既存のpending_action処理
    const pendingActionKey = `pending_action_${userId}`;
    const pendingActionJson = await env.NOTIFICATIONS.get(pendingActionKey);

    if (pendingActionJson) {
      console.log('Pending action found');
      const pendingAction = JSON.parse(pendingActionJson);

      if (selectedIndex >= 0 && selectedIndex < pendingAction.events.length) {
        console.log('Valid selection:', selectedIndex);
        const selectedEvent = pendingAction.events[selectedIndex];

        // pending actionを削除
        await env.NOTIFICATIONS.delete(pendingActionKey);

        // アクションを実行
        await executePendingAction(pendingAction.action, selectedEvent, userId, replyToken, env, pendingAction);
        return;
      } else {
        console.log('Invalid selection');
        await replyLineMessage(
          replyToken,
          '無効な番号です。もう一度お試しください。',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    }
  }

  // 予定変更の入力処理
  const pendingUpdateEvent = await env.NOTIFICATIONS.get(`pending_update_event_${userId}`, { type: 'json' });
  if (pendingUpdateEvent) {
    console.log('Pending update event found, processing change request');

    await replyLineMessage(
      replyToken,
      '⏳ 予定を変更しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    ctx.waitUntil(
      (async () => {
        try {
          console.log('waitUntil: Starting change processing...');
          // Geminiで変更内容を解析
          const changeData = await parseEventText(userMessage, env.GEMINI_API_KEY);
          console.log('waitUntil: changeData received:', JSON.stringify(changeData));

          if (!changeData) {
            console.log('waitUntil: changeData is null, sending error');
            await sendLineMessage(
              userId,
              '⚠️ 変更内容を理解できませんでした。\n\n例: 15時に変更、明日14時に変更、場所を渋谷に変更',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // updateDataを構築
          const updateData = {};
          if (changeData.date) updateData.date = changeData.date;
          if (changeData.startTime) updateData.startTime = changeData.startTime;
          if (changeData.endTime) updateData.endTime = changeData.endTime;
          if (changeData.location) updateData.location = changeData.location;
          console.log('waitUntil: updateData constructed:', JSON.stringify(updateData));

          // 最終確認のために保存
          await env.NOTIFICATIONS.put(
            `pending_update_confirm_${userId}`,
            JSON.stringify({
              eventId: pendingUpdateEvent.id,
              eventSummary: pendingUpdateEvent.summary,
              updateData: updateData
            }),
            { expirationTtl: 600 }
          );

          // 元のpending_update_eventを削除
          await env.NOTIFICATIONS.delete(`pending_update_event_${userId}`);

          // 最終確認メッセージ
          let confirmText = `📝 以下の内容で変更しますか？\n\n予定: ${pendingUpdateEvent.summary || '予定'}`;
          if (updateData.date) {
            confirmText += `\n📅 日付: ${updateData.date}`;
          }
          if (updateData.startTime) {
            confirmText += `\n⏰ 時刻: ${updateData.startTime}`;
            if (updateData.endTime) {
              confirmText += ` - ${updateData.endTime}`;
            }
          }
          if (updateData.location) {
            confirmText += `\n📍 場所: ${updateData.location}`;
          }

          const confirmMessage = {
            type: 'text',
            text: confirmText,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '✅ はい',
                    text: '変更確定'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '❌ いいえ',
                    text: '変更キャンセル'
                  }
                }
              ]
            }
          };

          await sendLineMessage(userId, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
          console.log('waitUntil: Confirmation message sent');
        } catch (error) {
          console.error('Update event error:', error);
          console.error('Update event error stack:', error.stack);
          await sendLineMessage(
            userId,
            '⚠️ 予定の変更に失敗しました',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // 時間入力処理（予定）
  const pendingEventTime = await env.NOTIFICATIONS.get(`pending_event_time_${userId}`, { type: 'json' });
  if (pendingEventTime) {
    console.log('Pending event time input detected');

    await replyLineMessage(
      replyToken,
      '⏳ 時間を設定しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    ctx.waitUntil(
      (async () => {
        try {
          // Geminiで時間を解析
          const timeData = await parseEventText(userMessage, env.GEMINI_API_KEY);

          if (!timeData || !timeData.startTime) {
            await sendLineMessage(
              userId,
              '⚠️ 時間を理解できませんでした。\n\nもう一度入力してください。\n\n例：\n・14時\n・10時30分\n・14:00',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // 時間を設定
          pendingEventTime.startTime = timeData.startTime;
          if (timeData.endTime) {
            pendingEventTime.endTime = timeData.endTime;
          }

          await env.NOTIFICATIONS.delete(`pending_event_time_${userId}`);
          await env.NOTIFICATIONS.put(
            `pending_final_confirm_${userId}`,
            JSON.stringify(pendingEventTime),
            { expirationTtl: 600 }
          );

          // 最終確認
          const confirmMessage = {
            type: 'text',
            text: `📅 以下の内容で登録しますか？\n\n📝 ${pendingEventTime.title}\n📅 ${pendingEventTime.date || '日付未定'}\n⏰ ${pendingEventTime.startTime}${pendingEventTime.endTime ? ` - ${pendingEventTime.endTime}` : ''}`,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '✅ はい',
                    text: '登録確定'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '❌ いいえ',
                    text: '登録キャンセル'
                  }
                }
              ]
            }
          };

          await sendLineMessage(userId, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        } catch (error) {
          console.error('Time input error:', error);
          await sendLineMessage(
            userId,
            '⚠️ 時間の設定に失敗しました。もう一度お試しください。',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // 日付入力処理（終日予定）
  const pendingEventDate = await env.NOTIFICATIONS.get(`pending_event_date_${userId}`, { type: 'json' });
  if (pendingEventDate) {
    console.log('Pending event date input detected');

    await replyLineMessage(
      replyToken,
      '⏳ 日付を設定しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    ctx.waitUntil(
      (async () => {
        try {
          // Geminiで日付を解析
          const dateData = await parseEventText(userMessage, env.GEMINI_API_KEY);

          if (!dateData || !dateData.date) {
            await sendLineMessage(
              userId,
              '⚠️ 日付を理解できませんでした。\n\nもう一度入力してください。\n\n例：\n・今日\n・明日\n・2月10日',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // 日付を設定
          pendingEventDate.date = dateData.date;

          await env.NOTIFICATIONS.delete(`pending_event_date_${userId}`);
          await env.NOTIFICATIONS.put(
            `pending_final_confirm_${userId}`,
            JSON.stringify(pendingEventDate),
            { expirationTtl: 600 }
          );

          // 最終確認
          const confirmMessage = {
            type: 'text',
            text: `📅 以下の内容で登録しますか？\n\n📝 ${pendingEventDate.title}\n📅 ${pendingEventDate.date}\n⏰ 終日`,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '✅ はい',
                    text: '登録確定'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '❌ いいえ',
                    text: '登録キャンセル'
                  }
                }
              ]
            }
          };

          await sendLineMessage(userId, confirmMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        } catch (error) {
          console.error('Date input error:', error);
          await sendLineMessage(
            userId,
            '⚠️ 日付の設定に失敗しました。もう一度お試しください。',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // 期限入力処理（タスク）
  const pendingTaskDue = await env.NOTIFICATIONS.get(`pending_task_due_${userId}`, { type: 'json' });
  if (pendingTaskDue) {
    console.log('Pending task due input detected');

    await replyLineMessage(
      replyToken,
      '⏳ 期限を設定しています...',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );

    ctx.waitUntil(
      (async () => {
        try {
          // Geminiで期限を解析
          const dueData = await parseEventText(userMessage, env.GEMINI_API_KEY);

          if (!dueData || !dueData.date) {
            await sendLineMessage(
              userId,
              '⚠️ 期限を理解できませんでした。\n\nもう一度入力してください。\n\n例：\n・明日\n・2月10日\n・来週月曜日',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // 期限を設定
          pendingTaskDue.date = dueData.date;

          await env.NOTIFICATIONS.delete(`pending_task_due_${userId}`);

          // リマインダー選択へ進む（複数選択用の初期化）
          await env.NOTIFICATIONS.put(
            `pending_task_reminder_${userId}`,
            JSON.stringify({
              ...pendingTaskDue,
              selectedReminders: [] // 選択済みリマインダーを記録
            }),
            { expirationTtl: 600 }
          );

          // 期限までの日数を計算してリマインダーオプションをフィルタリング
          const availableReminders = getAvailableReminders(pendingTaskDue.date, []);
          const reminderMessage = buildReminderSelectionMessage(pendingTaskDue.title, pendingTaskDue.date, availableReminders, true);

          await sendLineMessage(userId, reminderMessage, env.LINE_CHANNEL_ACCESS_TOKEN);

          await sendLineMessage(userId, reminderMessage, env.LINE_CHANNEL_ACCESS_TOKEN);
        } catch (error) {
          console.error('Due input error:', error);
          await sendLineMessage(
            userId,
            '⚠️ 期限の設定に失敗しました。もう一度お試しください。',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );
    return;
  }

  // まず処理中メッセージを返信してから非同期でGemini APIを呼び出す
  await replyLineMessage(
    replyToken,
    '⏳ 処理しています...',
    env.LINE_CHANNEL_ACCESS_TOKEN
  );

  // 非同期で処理
  ctx.waitUntil(
    (async () => {
      try {
        console.log('Calling Gemini API...');
        // 直前のボット返信を取得（文脈として使用）
        const lastBotResponse = await env.NOTIFICATIONS.get(`last_bot_response_${userId}`);
        console.log('Context (last bot response):', lastBotResponse ? lastBotResponse.substring(0, 100) + '...' : 'none');

        // Gemini APIで自然言語解析（文脈付き）
        const eventData = await parseEventText(userMessage, env.GEMINI_API_KEY, lastBotResponse);
        console.log('Gemini API result:', JSON.stringify(eventData));

        if (!eventData) {
          console.log('Data validation failed - Gemini returned null');
          console.log('User message was:', userMessage);
          await sendLineMessage(
            userId,
            '⚠️ メッセージを理解できませんでした。\n\nもう一度、以下の形式で送信してください：\n\n【予定の例】\n・明日14時 ミーティング\n・2月5日19時 飲み会 at 渋谷\n\n【タスクの例】\n・タスク 牛乳を買う\n・タスク 書類提出 期限明日',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          return;
        }

        const action = eventData.action || 'create';
        console.log('Action:', action);

        // 予定一覧
        if (action === 'list') {
          console.log('Action: LIST');
          console.log('LIST: Fetching upcoming events...');

          // 現在時刻から90日分の予定を取得（シンプルに）
          const events = await getUpcomingEvents(userId, env, 90);
          console.log('LIST: Found', events.length, 'events');

          if (events.length === 0) {
            await sendLineMessage(
              userId,
              '📅 今後3ヶ月の予定はありません',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // 予定一覧をKVに保存（番号選択用）
          await env.NOTIFICATIONS.put(
            `event_list_${userId}`,
            JSON.stringify(events),
            { expirationTtl: 600 } // 10分間有効
          );

          // pending_cancel と pending_update にも保存（番号で操作できるように）
          await env.NOTIFICATIONS.put(
            `pending_cancel_${userId}`,
            JSON.stringify(events),
            { expirationTtl: 600 }
          );
          await env.NOTIFICATIONS.put(
            `pending_update_${userId}`,
            JSON.stringify(events),
            { expirationTtl: 600 }
          );

          let message = `📅 予定一覧（今後90日）\n\n`;
          let eventNumber = 1;
          for (const event of events) {
            const { dateStr, timeStr } = formatEventDateTime(event);
            message += `${eventNumber}. 📝 ${event.summary || '予定'}\n⏰ ${dateStr} ${timeStr}\n\n`;
            eventNumber++;
          }

          message += '操作: 「1キャンセル」「2を17時に変更」など';

          await sendLineMessage(
            userId,
            message.trim(),
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          // 文脈を保存
          await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message.trim(), { expirationTtl: 300 });
          return;
        }

        // タスク完了
        if (action === 'complete') {
          console.log('Action: COMPLETE');

          // 複数番号指定の場合
          if (eventData.targetNumbers && eventData.targetNumbers.length > 0) {
            const targetNums = eventData.targetNumbers;
            console.log('COMPLETE: Multiple target numbers:', targetNums);

            const pendingCompleteData = await env.NOTIFICATIONS.get(`pending_complete_${userId}`, { type: 'json' });
            if (!pendingCompleteData) {
              await sendLineMessage(
                userId,
                'タスク一覧がありません。「タスク一覧」で確認してください。',
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            }

            const completedTasks = [];
            const failedNums = [];

            for (const targetNum of targetNums) {
              const selectedIndex = targetNum - 1;
              if (selectedIndex >= 0 && selectedIndex < pendingCompleteData.length) {
                const selectedTask = pendingCompleteData[selectedIndex];
                try {
                  await completeTask(selectedTask.id, selectedTask.listId, userId, env);
                  completedTasks.push(selectedTask.title);
                } catch (error) {
                  console.error('Failed to complete task:', selectedTask.title, error);
                  failedNums.push(targetNum);
                }
              } else {
                failedNums.push(targetNum);
              }
            }

            await env.NOTIFICATIONS.delete(`pending_complete_${userId}`);
            await env.NOTIFICATIONS.delete(`last_bot_response_${userId}`);

            let message = '';
            if (completedTasks.length > 0) {
              message += `✅ ${completedTasks.length}件のタスクを完了しました\n\n`;
              completedTasks.forEach(title => {
                message += `📝 ${title}\n`;
              });
            }
            if (failedNums.length > 0) {
              message += `\n⚠️ 番号 ${failedNums.join(', ')} は見つかりませんでした`;
            }

            await sendLineMessage(userId, message.trim(), env.LINE_CHANNEL_ACCESS_TOKEN);
            return;
          }

          // 単一番号指定の場合
          if (eventData.targetNumber) {
            const targetNum = eventData.targetNumber;
            const selectedIndex = targetNum - 1;
            console.log('COMPLETE: Target number:', targetNum);

            // pending_complete から取得
            const pendingCompleteData = await env.NOTIFICATIONS.get(`pending_complete_${userId}`, { type: 'json' });
            if (pendingCompleteData && selectedIndex >= 0 && selectedIndex < pendingCompleteData.length) {
              const selectedTask = pendingCompleteData[selectedIndex];

              await completeTask(selectedTask.id, selectedTask.listId, userId, env);
              await env.NOTIFICATIONS.delete(`pending_complete_${userId}`);
              await env.NOTIFICATIONS.delete(`last_bot_response_${userId}`);
              await sendLineMessage(
                userId,
                `✅ タスクを完了しました\n\n📝 ${selectedTask.title}`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            } else {
              await sendLineMessage(
                userId,
                `番号 ${targetNum} のタスクが見つかりませんでした。\n\n「タスク一覧」または「タスク完了」で確認してください。`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            }
          }

          // キーワード指定の場合
          if (eventData.keyword) {
            console.log('COMPLETE: Searching for task with keyword:', eventData.keyword);

            // まず pending_complete から検索
            const pendingCompleteData = await env.NOTIFICATIONS.get(`pending_complete_${userId}`, { type: 'json' });
            if (pendingCompleteData) {
              const matchingTask = pendingCompleteData.find(task =>
                task.title.toLowerCase().includes(eventData.keyword.toLowerCase()) ||
                eventData.keyword.toLowerCase().includes(task.title.toLowerCase())
              );

              if (matchingTask) {
                await completeTask(matchingTask.id, matchingTask.listId, userId, env);
                await env.NOTIFICATIONS.delete(`pending_complete_${userId}`);
                await sendLineMessage(
                  userId,
                  `✅ タスクを完了しました\n\n📝 ${matchingTask.title}`,
                  env.LINE_CHANNEL_ACCESS_TOKEN
                );
                return;
              }
            }

            // 全タスクから検索
            const allTasks = await getAllIncompleteTasks(userId, env);
            const matchingTask = allTasks.find(task =>
              task.title.toLowerCase().includes(eventData.keyword.toLowerCase()) ||
              eventData.keyword.toLowerCase().includes(task.title.toLowerCase())
            );

            if (matchingTask) {
              await completeTask(matchingTask.id, matchingTask.listId, userId, env);
              await sendLineMessage(
                userId,
                `✅ タスクを完了しました\n\n📝 ${matchingTask.title}`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            } else {
              await sendLineMessage(
                userId,
                `「${eventData.keyword}」に該当するタスクが見つかりませんでした。\n\n「タスク一覧」で確認してください。`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            }
          }

          // キーワードも番号もない場合
          await sendLineMessage(
            userId,
            '完了するタスクを指定してください。\n\n例：\n・3完了\n・牛乳買った完了\n・掃除終わり',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          return;
        }

        // 予定キャンセル
        if (action === 'cancel') {
          console.log('Action: CANCEL');

          // 番号指定の場合
          if (eventData.targetNumber) {
            const targetNum = eventData.targetNumber;
            const selectedIndex = targetNum - 1;
            console.log('CANCEL: Target number:', targetNum);

            // pending_cancel から取得
            const pendingCancelData = await env.NOTIFICATIONS.get(`pending_cancel_${userId}`, { type: 'json' });
            if (pendingCancelData && selectedIndex >= 0 && selectedIndex < pendingCancelData.length) {
              const selectedEvent = pendingCancelData[selectedIndex];

              await deleteEvent(selectedEvent.id, userId, env);
              await env.NOTIFICATIONS.delete(`pending_cancel_${userId}`);
              await sendLineMessage(
                userId,
                `🗑️ 予定をキャンセルしました\n\n📝 ${selectedEvent.summary || '予定'}`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            } else {
              await sendLineMessage(
                userId,
                `番号 ${targetNum} の予定が見つかりませんでした。\n\n「予定キャンセル」で一覧を確認してください。`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            }
          }

          if (!eventData.keyword) {
            // 予定かタスクかを聞く
            const clarifyMessage = {
              type: 'text',
              text: '🗑️ 何をキャンセル/削除しますか？',
              quickReply: {
                items: [
                  {
                    type: 'action',
                    action: {
                      type: 'message',
                      label: '📅 予定をキャンセル',
                      text: '予定キャンセル'
                    }
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'message',
                      label: '✅ タスクを削除',
                      text: 'タスク削除'
                    }
                  }
                ]
              }
            };
            await sendLineMessage(
              userId,
              clarifyMessage,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          console.log('CANCEL: Starting async search...');
            let events = await searchEvents(eventData.keyword, userId, env);
            console.log('CANCEL: Search completed, found', events.length, 'events');

            // 日付でフィルタリング
            if (eventData.date) {
              console.log('CANCEL: Filtering by date:', eventData.date);
              events = events.filter(event => {
                const eventStart = new Date(event.start.dateTime || event.start.date);
                const eventDateStr = eventStart.toISOString().split('T')[0];
                return eventDateStr === eventData.date;
              });
              console.log('CANCEL: After date filter, found', events.length, 'events');
            }

            // 時刻でフィルタリング
            if (eventData.startTime && events.length > 1) {
              console.log('CANCEL: Filtering by start time:', eventData.startTime);
              events = events.filter(event => {
                if (!event.start.dateTime) return false;
                const eventStart = new Date(event.start.dateTime);
                const eventTimeStr = `${String(eventStart.getHours()).padStart(2, '0')}:${String(eventStart.getMinutes()).padStart(2, '0')}`;
                return eventTimeStr === eventData.startTime;
              });
              console.log('CANCEL: After time filter, found', events.length, 'events');
            }

            if (events.length === 0) {
              console.log('CANCEL: No events found, sending message...');
              await sendLineMessage(
                userId,
                `「${eventData.keyword}」に該当する予定が見つかりませんでした。`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              console.log('CANCEL: No events message sent');
              return;
            }

            if (events.length > 1) {
              console.log('CANCEL: Multiple events found, building message...');
              let message = `「${eventData.keyword}」に該当する予定が複数あります：\n\n`;
              for (let i = 0; i < events.length; i++) {
                const event = events[i];
                console.log('CANCEL: Processing event:', event.summary);
                const { dateStr, timeStr } = formatEventDateTime(event);
                message += `${i + 1}. ${event.summary} (${dateStr} ${timeStr})\n`;
              }
              message += '\nキャンセルしたい予定の番号を送信してください（例：1）';

              // pending_cancel に保存（番号選択用）
              await env.NOTIFICATIONS.put(
                `pending_cancel_${userId}`,
                JSON.stringify(events.map(e => ({
                  id: e.id,
                  summary: e.summary,
                  start: e.start
                }))),
                { expirationTtl: 600 }
              );
              console.log('CANCEL: Pending cancel saved');

              console.log('CANCEL: Sending multiple events message...');
              console.log('CANCEL: Message content:', message);
              await sendLineMessage(
                userId,
                message,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              // 文脈を保存
              await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message, { expirationTtl: 300 });
              console.log('CANCEL: Multiple events message sent');
              return;
            }

            // 1件のみ見つかった場合は削除
            console.log('CANCEL: Single event found, deleting...');
            const event = events[0];
            await deleteEvent(event.id, userId, env);
            console.log('CANCEL: Event deleted, sending success message...');

          await sendLineMessage(
            userId,
            `✅ 「${event.summary}」をキャンセルしました`,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          console.log('CANCEL: Success message sent');
          return;
        }

        // 予定変更
        if (action === 'update') {
          console.log('Action: UPDATE');

          // 番号指定の場合（一覧表示後）
          if (eventData.targetNumber) {
            const targetNum = eventData.targetNumber;
            const selectedIndex = targetNum - 1;
            console.log('UPDATE: Target number:', targetNum);

            // pending_update から取得
            const pendingUpdateData = await env.NOTIFICATIONS.get(`pending_update_${userId}`, { type: 'json' });
            if (pendingUpdateData && selectedIndex >= 0 && selectedIndex < pendingUpdateData.length) {
              const selectedEvent = pendingUpdateData[selectedIndex];

              // 変更データがある場合は直接更新
              if (eventData.startTime) {
                const updateData = {
                  startTime: eventData.startTime,
                  endTime: eventData.endTime || eventData.startTime
                };

                await updateEvent(selectedEvent.id, updateData, userId, env);
                await env.NOTIFICATIONS.delete(`pending_update_${userId}`);
                await env.NOTIFICATIONS.delete(`last_bot_response_${userId}`);

                await sendLineMessage(
                  userId,
                  `✅ 予定を変更しました\n\n📝 ${selectedEvent.summary || '予定'}\n⏰ 新しい時刻: ${eventData.startTime}`,
                  env.LINE_CHANNEL_ACCESS_TOKEN
                );
                return;
              }

              // 変更内容がない場合は入力を促す
              await env.NOTIFICATIONS.put(
                `pending_update_event_${userId}`,
                JSON.stringify(selectedEvent),
                { expirationTtl: 600 }
              );
              await env.NOTIFICATIONS.delete(`pending_update_${userId}`);

              await sendLineMessage(
                userId,
                `✏️ 予定の変更内容を入力してください\n\n📝 ${selectedEvent.summary || '予定'}\n\n【例】\n・15時に変更\n・明日14時に変更\n・場所を渋谷に変更`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            } else {
              await sendLineMessage(
                userId,
                `番号 ${targetNum} の予定が見つかりませんでした。\n\n「変更」で一覧を確認してください。`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            }
          }

          if (!eventData.keyword && !eventData.targetNumber) {
            // 予定一覧を取得して表示
            console.log('UPDATE: No keyword, fetching event list...');
            // 30日分の予定を取得
            const events = await getUpcomingEvents(userId, env, 30);

            if (events.length === 0) {
              await sendLineMessage(
                userId,
                '📅 変更できる予定がありません',
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            }

            // pending_update に保存
            await env.NOTIFICATIONS.put(
              `pending_update_${userId}`,
              JSON.stringify(events),
              { expirationTtl: 600 }
            );

            let message = '✏️ どの予定を変更しますか？\n\n';
            let eventNumber = 1;
            for (const event of events) {
              const { dateStr, timeStr } = formatEventDateTime(event);
              message += `${eventNumber}. ${event.summary || '予定'}\n⏰ ${dateStr} ${timeStr}\n\n`;
              eventNumber++;
            }
            message += '\n番号を入力してください（例: 1）';

            await sendLineMessage(userId, message.trim(), env.LINE_CHANNEL_ACCESS_TOKEN);
            // 文脈を保存
            await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message.trim(), { expirationTtl: 300 });
            return;
          }

          console.log('UPDATE: Starting async search...');
            let events = await searchEvents(eventData.keyword, userId, env);
            console.log('UPDATE: Search completed, found', events.length, 'events');

            // 日付でフィルタリング
            if (eventData.date) {
              console.log('UPDATE: Filtering by date:', eventData.date);
              events = events.filter(event => {
                const eventStart = new Date(event.start.dateTime || event.start.date);
                const eventDateStr = eventStart.toISOString().split('T')[0];
                return eventDateStr === eventData.date;
              });
              console.log('UPDATE: After date filter, found', events.length, 'events');
            }

            if (events.length === 0) {
              console.log('UPDATE: No events found');
              await sendLineMessage(
                userId,
                `「${eventData.keyword}」に該当する予定が見つかりませんでした。`,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            }

            if (events.length > 1) {
              console.log('UPDATE: Multiple events found');
              let message = `「${eventData.keyword}」に該当する予定が複数あります：\n\n`;
              for (let i = 0; i < events.length; i++) {
                const event = events[i];
                const { dateStr, timeStr } = formatEventDateTime(event);
                message += `${i + 1}. ${event.summary} (${dateStr} ${timeStr})\n`;
              }
              message += '\n変更したい予定の番号を送信してください（例：1）';

              // pending_update に保存（番号選択用）
              await env.NOTIFICATIONS.put(
                `pending_update_${userId}`,
                JSON.stringify(events.map(e => ({
                  id: e.id,
                  summary: e.summary,
                  start: e.start
                }))),
                { expirationTtl: 600 }
              );
              console.log('UPDATE: Pending update saved');

              await sendLineMessage(
                userId,
                message,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              // 文脈を保存
              await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message, { expirationTtl: 300 });
              return;
            }

            // 1件のみ見つかった場合は更新
            console.log('UPDATE: Single event found, updating...');
            const event = events[0];
            const updateData = {};

            if (eventData.startTime) {
              updateData.startTime = eventData.startTime;
              updateData.endTime = eventData.endTime || eventData.startTime;
              console.log('UPDATE: New time:', updateData.startTime, '-', updateData.endTime);
            }

            if (eventData.title && eventData.title !== eventData.keyword) {
              updateData.title = eventData.title;
              console.log('UPDATE: New title:', updateData.title);
            }

            console.log('UPDATE: Calling updateEvent...');
            await updateEvent(event.id, updateData, userId, env);
            console.log('UPDATE: Event updated successfully');

            let message = `✅ 「${event.summary}」を変更しました`;
            if (updateData.startTime) {
              message += `\n⏰ 新しい時刻: ${updateData.startTime}`;
            }

          console.log('UPDATE: Sending success message...');
          await sendLineMessage(
            userId,
            message,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          console.log('UPDATE: Success message sent');
          return;
        }

        // 新規登録（既存のコード）
        // 予定の場合のみ日付必須チェック（タスクは期限なしOK）
        if (!eventData.date && eventData.type === 'event') {
          console.log('Date missing for event create action');

          // 部分データをKVに保存（10分間有効）
          await env.NOTIFICATIONS.put(
            `pending_event_${userId}`,
            JSON.stringify({ ...eventData, needsDate: true }),
            { expirationTtl: 600 }
          );

          await sendLineMessage(
            userId,
            '📅 いつの予定ですか？\n\n以下のような形式で日付を教えてください：\n・明日\n・2月10日\n・来週月曜日\n・今日',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          return;
        }

        // タイトルがない場合
        if (!eventData.title) {
          console.log('Title missing for create action');

          // 部分データをKVに保存（10分間有効）
          await env.NOTIFICATIONS.put(
            `pending_event_${userId}`,
            JSON.stringify({ ...eventData, needsTitle: true }),
            { expirationTtl: 600 }
          );

          await sendLineMessage(
            userId,
            '📝 予定の内容を教えてください。\n\n例：\n・ミーティング\n・歯医者\n・飲み会',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          return;
        }

        // 曖昧性の検出: 予定かタスクか判断しにくい場合
        console.log('Checking ambiguity for message:', userMessage);
        const hasExplicitTaskKeyword = userMessage.includes('タスク');
        const hasExplicitEventKeyword = userMessage.includes('会議') || userMessage.includes('ミーティング') ||
                                       userMessage.includes('打ち合わせ') || userMessage.includes('面談') ||
                                       userMessage.includes('予定');
        console.log('Has task keyword:', hasExplicitTaskKeyword);
        console.log('Has event keyword:', hasExplicitEventKeyword);

        // ユーザーメッセージから時刻・日付パターンを検出
        const timePattern = /(\d{1,2})[時:：]|(\d{1,2}:\d{2})/;
        const datePattern = /(\d{1,2})月|(\d{1,2})日|明日|今日|明後日|来週|再来週|今週|来月/;
        const hasTimeInMessage = timePattern.test(userMessage);
        const hasDateInMessage = datePattern.test(userMessage);

        // 明示的なキーワードがない場合は、常に予定かタスクかを確認する
        const isAmbiguous = !hasExplicitTaskKeyword && !hasExplicitEventKeyword;
        console.log('Is ambiguous:', isAmbiguous);

        if (isAmbiguous) {
          console.log('Ambiguous input detected - asking user for clarification');
          console.log('EventData title:', eventData.title);

          // 部分データをKVに保存
          await env.NOTIFICATIONS.put(
            `pending_clarification_${userId}`,
            JSON.stringify(eventData),
            { expirationTtl: 600 }
          );

          // Quick Replyで聞き返す
          const clarificationMessage = {
            type: 'text',
            text: `「${eventData.title}」を登録します。\n\nこれは予定ですか、それともタスクですか？`,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '📅 予定として登録',
                    text: '予定として登録'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '✅ タスクとして登録',
                    text: 'タスクとして登録'
                  }
                }
              ]
            }
          };

          await sendLineMessage(
            userId,
            clarificationMessage,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          return;
        }

        // タスクか予定かを判定
        const isTask = eventData.type === 'task';

        if (!isTask && !eventData.startTime) {
          // 予定なのに時刻がない場合は終日予定として扱う
          console.log('Event without time - treating as all-day event');
          eventData.startTime = '00:00';
          eventData.endTime = '23:59';
          eventData.isAllDay = true;
        }

        // タスクの場合
        if (isTask) {
          console.log('Detected as TASK');
          console.log('DEBUG: Starting task confirmation flow...');

          // 最終確認へ進む
          console.log('DEBUG: Saving to pending_final_confirm...');
          await env.NOTIFICATIONS.put(
            `pending_final_confirm_${userId}`,
            JSON.stringify(eventData),
            { expirationTtl: 600 }
          );
          console.log('DEBUG: Pending data saved');

          let confirmText = `✅ 以下の内容で登録しますか？\n\n📝 ${eventData.title}`;
          if (eventData.date) {
            confirmText += `\n📅 期限: ${eventData.date}`;
          } else {
            confirmText += `\n📅 期限: なし`;
          }
          if (eventData.location) {
            confirmText += `\n📍 ${eventData.location}`;
          }
          if (eventData.url) {
            confirmText += `\n🔗 ${eventData.url}`;
          }

          console.log('DEBUG: Building confirmation message...');
          const confirmMessage = {
            type: 'text',
            text: confirmText,
            quickReply: {
              items: [
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '✅ はい',
                    text: '登録確定'
                  }
                },
                {
                  type: 'action',
                  action: {
                    type: 'message',
                    label: '❌ いいえ',
                    text: '登録キャンセル'
                  }
                }
              ]
            }
          };

          console.log('DEBUG: Sending confirmation message to LINE...');
          await sendLineMessage(
            userId,
            confirmMessage,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          console.log('DEBUG: Confirmation message sent successfully');
          return;
        }

        // 予定の場合
        console.log('Detected as EVENT');

        // 最終確認へ進む
        await env.NOTIFICATIONS.put(
          `pending_final_confirm_${userId}`,
          JSON.stringify(eventData),
          { expirationTtl: 600 }
        );

        let confirmText = `📅 以下の内容で登録しますか？\n\n📝 ${eventData.title}\n📅 ${eventData.date}`;
        if (!eventData.isAllDay) {
          confirmText += `\n⏰ ${eventData.startTime}`;
          if (eventData.endTime) {
            confirmText += ` - ${eventData.endTime}`;
          }
        } else {
          confirmText += `\n⏰ 終日`;
        }
        if (eventData.location) {
          confirmText += `\n📍 ${eventData.location}`;
        }
        if (eventData.url) {
          confirmText += `\n🔗 ${eventData.url}`;
        }

        const confirmMessage = {
          type: 'text',
          text: confirmText,
          quickReply: {
            items: [
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '✅ はい',
                  text: '登録確定'
                }
              },
              {
                type: 'action',
                action: {
                  type: 'message',
                  label: '❌ いいえ',
                  text: '登録キャンセル'
                }
              }
            ]
          }
        };

        await sendLineMessage(
          userId,
          confirmMessage,
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
      } catch (error) {
        console.error('Message handling error:', error);
        await sendLineMessage(
          userId,
          '⚠️ 処理中にエラーが発生しました。\n\n' +
          '以下をお試しください：\n' +
          '・メッセージをもう一度送信\n' +
          '・「ヘルプ」と送信して使い方を確認\n' +
          '・しばらく時間をおいてから再度お試しください\n\n' +
          '問題が続く場合は、システムの一時的な問題の可能性があります。',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
      }
    })()
  );
}

// 通知チェック＆送信（マルチユーザー対応）
async function checkAndSendNotifications(env) {
  try {
    const now = getJSTDate(); // 日本時間で取得

    // 全認証済みユーザーを取得
    const usersList = await env.NOTIFICATIONS.get('authenticated_users', { type: 'json' }) || [];
    console.log('Checking notifications for', usersList.length, 'users');

    for (const userId of usersList) {
      try {
        // トークンチェック
        const tokens = await env.NOTIFICATIONS.get(`user_tokens:${userId}`, { type: 'json' });
        if (!tokens) {
          console.log('No tokens for user:', userId);
          continue;
        }

        console.log('Processing notifications for user:', userId);

        // 日曜21時の週次レポート
        await checkWeeklyReport(now, userId, env);

        // スヌーズされたタスクのチェック
        await checkSnoozedTasks(userId, env);

        // カレンダー予定の通知
        const events = await getUpcomingEvents(userId, env);
        for (const event of events) {
          if (!event.start || !event.start.dateTime) continue;

          const eventStart = new Date(event.start.dateTime);

          // 前日18時の通知
          await checkDayBeforeNotification(event, eventStart, now, userId, env);

          // 当日朝9時の通知
          await checkEventMorningNotification(event, eventStart, now, userId, env);

          // 1時間前の通知
          await checkOneHourBeforeNotification(event, eventStart, now, userId, env);
        }

        // タスクの通知
        const tasks = await getUpcomingTasks(userId, env);
        for (const task of tasks) {
          if (!task.due) continue;

          const taskDue = new Date(task.due);

          // タスクの前日18時通知
          await checkTaskDayBeforeNotification(task, taskDue, now, userId, env);

          // タスクの当日9時通知
          await checkTaskMorningNotification(task, taskDue, now, userId, env);

          // タスクの3日前通知
          await checkTask3DaysBeforeNotification(task, taskDue, now, userId, env);

          // タスクの1週間前通知
          await checkTask1WeekBeforeNotification(task, taskDue, now, userId, env);
        }
      } catch (error) {
        console.error('Notification error for user', userId, ':', error);
        // Continue processing other users
      }
    }
  } catch (error) {
    console.error('Notification check error:', error);
  }
}

// 日曜21時の週次レポート
async function checkWeeklyReport(now, userId, env) {
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours();
  const minute = now.getMinutes();

  // 日曜日の21時00分〜21時14分
  if (day === 0 && hour === 21 && minute < 15) {
    const reportKey = `weekly_report_${userId}_${now.toISOString().split('T')[0]}`;
    const alreadySent = await env.NOTIFICATIONS.get(reportKey);

    if (!alreadySent) {
      try {
        // 未完了タスク一覧を取得
        const allTasks = await getAllIncompleteTasks(userId, env);

        if (allTasks.length === 0) {
          const message = '📋 今週の未完了タスク\n\nタスクはありません！お疲れさまでした🎉';
          await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
        } else {
          // タスクをソート順で表示
          let message = '📋 今週の未完了タスク\n\n';

          let currentList = '';
          for (const task of allTasks) {
            // リストが変わったら見出しを表示
            if (currentList !== task.listTitle) {
              if (currentList !== '') message += '\n';
              message += `【${task.listTitle}】\n`;
              currentList = task.listTitle;
            }

            // スター付きタスクは ⭐ を先頭に表示
            const icon = task.starred ? '⭐' : '□';
            message += `${icon} ${task.title}`;

            if (task.due) {
              const dueDate = new Date(task.due);
              message += ` (期限: ${dueDate.getMonth() + 1}/${dueDate.getDate()})`;
            }
            message += '\n';
          }

          await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
        }

        // 送信済みフラグ保存（7日間保持）
        await env.NOTIFICATIONS.put(reportKey, 'sent', { expirationTtl: 604800 });
        console.log('週次レポート送信 for user:', userId);
      } catch (error) {
        console.error('Weekly report error for user', userId, ':', error);
      }
    }
  }
}

// タスクの前日18時通知
async function checkTaskDayBeforeNotification(task, taskDue, now, userId, env) {
  // リマインダー設定をチェック（配列として取得）
  const remindersJson = await env.NOTIFICATIONS.get(`task_reminder_${userId}_${task.id}`);
  if (!remindersJson) return;

  const reminders = JSON.parse(remindersJson);

  // このタスクに前日18時のリマインダーが設定されていない場合はスキップ
  if (!reminders.includes('前日18時')) {
    return;
  }

  const dueDate = new Date(taskDue);
  dueDate.setHours(0, 0, 0, 0);

  const notificationTime = new Date(dueDate);
  notificationTime.setDate(notificationTime.getDate() - 1);
  notificationTime.setHours(18, 0, 0, 0);

  const timeDiff = now - notificationTime;

  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${userId}_${task.id}_task_day_before`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const dueStr = `${dueDate.getMonth() + 1}/${dueDate.getDate()}`;
      const messageText = `📅 明日が期限のタスク\n\n📝 ${task.title}\n📋 リスト: ${task.listTitle}\n📅 期限: ${dueStr}`;

      const messageWithSnooze = buildTaskNotificationWithSnooze(task, messageText);
      await sendLineMessage(userId, messageWithSnooze, env.LINE_CHANNEL_ACCESS_TOKEN);

      // 通知済みフラグ保存（24時間保持）
      await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });

      console.log('タスク前日通知送信 for user', userId, ':', task.title);
    }
  }
}

// タスクの当日9時通知
async function checkTaskMorningNotification(task, taskDue, now, userId, env) {
  // リマインダー設定をチェック（配列として取得）
  const remindersJson = await env.NOTIFICATIONS.get(`task_reminder_${userId}_${task.id}`);
  if (!remindersJson) return;

  const reminders = JSON.parse(remindersJson);

  // このタスクに当日朝9時のリマインダーが設定されていない場合はスキップ
  if (!reminders.includes('当日朝9時')) {
    return;
  }

  const dueDate = new Date(taskDue);
  dueDate.setHours(9, 0, 0, 0);

  const timeDiff = now - dueDate;

  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${userId}_${task.id}_task_morning`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const messageText = `⏰ 今日が期限のタスク\n\n📝 ${task.title}\n📋 リスト: ${task.listTitle}`;

      const messageWithSnooze = buildTaskNotificationWithSnooze(task, messageText);
      await sendLineMessage(userId, messageWithSnooze, env.LINE_CHANNEL_ACCESS_TOKEN);

      // 通知済みフラグ保存（24時間保持）
      await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });

      console.log('タスク当日通知送信 for user', userId, ':', task.title);
    }
  }
}

// タスクの3日前通知
async function checkTask3DaysBeforeNotification(task, taskDue, now, userId, env) {
  // リマインダー設定をチェック（配列として取得）
  const remindersJson = await env.NOTIFICATIONS.get(`task_reminder_${userId}_${task.id}`);
  if (!remindersJson) return;

  const reminders = JSON.parse(remindersJson);

  // このタスクに3日前のリマインダーが設定されていない場合はスキップ
  if (!reminders.includes('3日前')) {
    return;
  }

  const dueDate = new Date(taskDue);
  dueDate.setHours(0, 0, 0, 0);

  const notificationTime = new Date(dueDate);
  notificationTime.setDate(notificationTime.getDate() - 3);
  notificationTime.setHours(18, 0, 0, 0);

  const timeDiff = now - notificationTime;

  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${userId}_${task.id}_task_3days`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const dueStr = `${dueDate.getMonth() + 1}/${dueDate.getDate()}`;
      const messageText = `📅 3日後が期限のタスク\n\n📝 ${task.title}\n📋 リスト: ${task.listTitle}\n📅 期限: ${dueStr}`;

      const messageWithSnooze = buildTaskNotificationWithSnooze(task, messageText);
      await sendLineMessage(userId, messageWithSnooze, env.LINE_CHANNEL_ACCESS_TOKEN);

      // 通知済みフラグ保存（24時間保持）
      await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });

      console.log('タスク3日前通知送信 for user', userId, ':', task.title);
    }
  }
}

// タスクの1週間前通知
async function checkTask1WeekBeforeNotification(task, taskDue, now, userId, env) {
  // リマインダー設定をチェック（配列として取得）
  const remindersJson = await env.NOTIFICATIONS.get(`task_reminder_${userId}_${task.id}`);
  if (!remindersJson) return;

  const reminders = JSON.parse(remindersJson);

  // このタスクに1週間前のリマインダーが設定されていない場合はスキップ
  if (!reminders.includes('1週間前')) {
    return;
  }

  const dueDate = new Date(taskDue);
  dueDate.setHours(0, 0, 0, 0);

  const notificationTime = new Date(dueDate);
  notificationTime.setDate(notificationTime.getDate() - 7);
  notificationTime.setHours(18, 0, 0, 0);

  const timeDiff = now - notificationTime;

  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${userId}_${task.id}_task_1week`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const dueStr = `${dueDate.getMonth() + 1}/${dueDate.getDate()}`;
      const messageText = `📅 1週間後が期限のタスク\n\n📝 ${task.title}\n📋 リスト: ${task.listTitle}\n📅 期限: ${dueStr}`;

      const messageWithSnooze = buildTaskNotificationWithSnooze(task, messageText);
      await sendLineMessage(userId, messageWithSnooze, env.LINE_CHANNEL_ACCESS_TOKEN);

      // 通知済みフラグ保存（24時間保持）
      await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });

      console.log('タスク1週間前通知送信 for user', userId, ':', task.title);
    }
  }
}

// 前日18時通知チェック
async function checkDayBeforeNotification(event, eventStart, now, userId, env) {
  // リマインダー設定をチェック
  const remindersJson = await env.NOTIFICATIONS.get(`event_reminder_${userId}_${event.id}`);
  if (!remindersJson) return;

  const reminders = JSON.parse(remindersJson);

  // このイベントに前日18時のリマインダーが設定されていない場合はスキップ
  if (!reminders.includes('前日18時')) {
    return;
  }

  const eventDate = new Date(eventStart);
  eventDate.setHours(0, 0, 0, 0);

  const notificationTime = new Date(eventDate);
  notificationTime.setDate(notificationTime.getDate() - 1);
  notificationTime.setHours(18, 0, 0, 0);

  const timeDiff = now - notificationTime;

  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${userId}_${event.id}_day_before`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const message = `📅 明日の予定\n\n⏰ ${formatDateTime(eventStart)}\n📝 ${event.summary || '予定'}`;

      await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);

      // 通知済みフラグ保存（24時間保持）
      await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });

      console.log('前日通知送信 for user', userId, ':', event.summary);
    }
  }
}

// 1時間前通知チェック
async function checkOneHourBeforeNotification(event, eventStart, now, userId, env) {
  // リマインダー設定をチェック
  const remindersJson = await env.NOTIFICATIONS.get(`event_reminder_${userId}_${event.id}`);
  if (!remindersJson) return;

  const reminders = JSON.parse(remindersJson);

  // このイベントに1時間前のリマインダーが設定されていない場合はスキップ
  if (!reminders.includes('1時間前')) {
    return;
  }

  const oneHourBefore = new Date(eventStart.getTime() - 60 * 60 * 1000);
  const timeDiff = now - oneHourBefore;

  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${userId}_${event.id}_1hour_before`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const message = `⏰ 1時間後に予定があります\n\n⏰ ${formatDateTime(eventStart)}\n📝 ${event.summary || '予定'}`;

      await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);

      // 通知済みフラグ保存（24時間保持）
      await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });

      console.log('1時間前通知送信 for user', userId, ':', event.summary);
    }
  }
}

// 当日朝9時通知チェック（イベント用）
async function checkEventMorningNotification(event, eventStart, now, userId, env) {
  // リマインダー設定をチェック
  const remindersJson = await env.NOTIFICATIONS.get(`event_reminder_${userId}_${event.id}`);
  if (!remindersJson) return;

  const reminders = JSON.parse(remindersJson);

  // このイベントに当日朝9時のリマインダーが設定されていない場合はスキップ
  if (!reminders.includes('当日朝9時')) {
    return;
  }

  const eventDate = new Date(eventStart);
  eventDate.setHours(0, 0, 0, 0);

  const notificationTime = new Date(eventDate);
  notificationTime.setHours(9, 0, 0, 0);

  const timeDiff = now - notificationTime;

  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${userId}_${event.id}_event_morning`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const message = `🌅 今日の予定\n\n⏰ ${formatDateTime(eventStart)}\n📝 ${event.summary || '予定'}`;

      await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);

      // 通知済みフラグ保存（24時間保持）
      await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });

      console.log('イベント当日朝9時通知送信 for user', userId, ':', event.summary);
    }
  }
}

// 日時フォーマット（通知用）
function formatDateTime(dateTime) {
  const date = new Date(dateTime);
  // UTCから日本時間に変換（+9時間）
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  const month = jstDate.getUTCMonth() + 1;
  const day = jstDate.getUTCDate();
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
}

// Pending actionを実行
async function executePendingAction(actionType, selectedEvent, userId, replyToken, env, pendingAction) {
  console.log('executePendingAction:', actionType, 'for event:', selectedEvent.id);

  try {
    if (actionType === 'cancel') {
      // すぐに返信
      await replyLineMessage(
        replyToken,
        '⏳ 予定を削除しています...',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      // 削除処理
      await deleteEvent(selectedEvent.id, userId, env);
      console.log('Event deleted:', selectedEvent.id);

      // 成功メッセージを送信
      await sendLineMessage(
        userId,
        `✅ 「${selectedEvent.summary}」をキャンセルしました`,
        env.LINE_CHANNEL_ACCESS_TOKEN
      );
    } else if (actionType === 'update') {
      // すぐに返信
      await replyLineMessage(
        replyToken,
        '⏳ 予定を変更しています...',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      // 更新データを取得
      const updateData = pendingAction.updateData;
      console.log('Update data:', updateData);

      // 更新処理
      await updateEvent(selectedEvent.id, updateData, userId, env);
      console.log('Event updated:', selectedEvent.id);

      // 成功メッセージを送信
      let message = `✅ 「${selectedEvent.summary}」を変更しました`;
      if (updateData.startTime) {
        message += `\n⏰ 新しい時刻: ${updateData.startTime}`;
      }

      await sendLineMessage(
        userId,
        message,
        env.LINE_CHANNEL_ACCESS_TOKEN
      );
    }
  } catch (error) {
    console.error('executePendingAction error:', error);
    await sendLineMessage(
      userId,
      '⚠️ 処理に失敗しました',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
  }
}

/**
 * 期限までの日数に基づいて利用可能なリマインダーオプションを取得
 * @param {string} dueDate - 期限日 (YYYY-MM-DD)
 * @param {Array} selectedReminders - 既に選択済みのリマインダー
 * @returns {Array} 利用可能なリマインダーオプション
 */
function getAvailableReminders(dueDate, selectedReminders = []) {
  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  const allReminders = [
    { value: '1週間前', label: '📅 1週間前', minDays: 7 },
    { value: '3日前', label: '📅 3日前', minDays: 3 },
    { value: '前日18時', label: '📅 前日18時', minDays: 1 },
    { value: '当日朝9時', label: '🌅 当日朝9時', minDays: 0 }
  ];

  // 期限までの日数でフィルタリング & 既に選択済みのものを除外
  return allReminders.filter(reminder => 
    daysUntilDue >= reminder.minDays && !selectedReminders.includes(reminder.value)
  );
}

/**
 * リマインダー選択メッセージを構築
 * @param {string} title - タスクタイトル
 * @param {string} date - 期限日
 * @param {Array} availableReminders - 利用可能なリマインダー
 * @param {boolean} isFirst - 最初の選択かどうか
 * @returns {Object} LINE Quick Replyメッセージ
 */
function buildReminderSelectionMessage(title, date, availableReminders, isFirst = false) {
  const text = isFirst 
    ? `⏰ リマインダーを設定しますか？\n\n📝 ${title}\n📅 期限: ${date}`
    : `⏰ 他にも設定しますか？\n\n📝 ${title}\n📅 期限: ${date}`;

  const items = availableReminders.map(reminder => ({
    type: 'action',
    action: {
      type: 'message',
      label: reminder.label,
      text: `リマインダー:${reminder.value}`
    }
  }));

  // "なし" または "これで終わり" ボタンを追加
  items.push({
    type: 'action',
    action: {
      type: 'message',
      label: isFirst ? '🔕 なし' : '✅ これで終わり',
      text: isFirst ? 'リマインダー:なし' : 'リマインダー:終わり'
    }
  });

  return {
    type: 'text',
    text: text,
    quickReply: { items }
  };
}

/**
 * イベント用のリマインダーオプションを取得
 * @param {string} startDateTime - 開始日時（ISO8601形式）
 * @param {boolean} hasTime - 時刻が指定されているか
 * @param {Array} selectedReminders - 既に選択済みのリマインダー
 * @returns {Array} 利用可能なリマインダーオプション
 */
function getAvailableEventReminders(startDateTime, hasTime, selectedReminders = []) {
  const now = new Date();
  const start = new Date(startDateTime);
  const hoursUntilStart = (start - now) / (1000 * 60 * 60);

  const allReminders = [
    { value: '前日18時', label: '📅 前日18時', minHours: 24 },
    { value: '当日朝9時', label: '🌅 当日朝9時', minHours: 0 }
  ];

  // 時刻付きイベントの場合のみ「1時間前」を追加
  if (hasTime) {
    allReminders.push({ value: '1時間前', label: '⏰ 1時間前', minHours: 1 });
  }

  // 開始までの時間でフィルタリング & 既に選択済みのものを除外
  return allReminders.filter(reminder =>
    hoursUntilStart >= reminder.minHours && !selectedReminders.includes(reminder.value)
  );
}

/**
 * イベントリマインダー選択メッセージを構築
 * @param {string} title - イベントタイトル
 * @param {string} dateTimeStr - 日時文字列
 * @param {Array} availableReminders - 利用可能なリマインダー
 * @param {boolean} isFirst - 最初の選択かどうか
 * @returns {Object} LINE Quick Replyメッセージ
 */
function buildEventReminderSelectionMessage(title, dateTimeStr, availableReminders, isFirst = false) {
  const text = isFirst
    ? `⏰ リマインダーを設定しますか？\n\n📝 ${title}\n📅 ${dateTimeStr}`
    : `⏰ 他にも設定しますか？\n\n📝 ${title}\n📅 ${dateTimeStr}`;

  const items = availableReminders.map(reminder => ({
    type: 'action',
    action: {
      type: 'message',
      label: reminder.label,
      text: `イベントリマインダー:${reminder.value}`
    }
  }));

  // "なし" または "これで終わり" ボタンを追加
  items.push({
    type: 'action',
    action: {
      type: 'message',
      label: isFirst ? '🔕 なし' : '✅ これで終わり',
      text: isFirst ? 'イベントリマインダー:なし' : 'イベントリマインダー:終わり'
    }
  });

  return {
    type: 'text',
    text: text,
    quickReply: { items }
  };
}

/**
 * スヌーズボタン付きタスク通知メッセージを構築
 * @param {Object} task - タスクオブジェクト
 * @param {string} messageText - 通知メッセージテキスト
 * @returns {Object} LINE Quick Replyメッセージ
 */
function buildTaskNotificationWithSnooze(task, messageText) {
  return {
    type: 'text',
    text: messageText,
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '⏰ 10分後',
            text: `スヌーズ:${task.id}:10分`
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '⏰ 30分後',
            text: `スヌーズ:${task.id}:30分`
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '⏰ 1時間後',
            text: `スヌーズ:${task.id}:1時間`
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '⏰ 3時間後',
            text: `スヌーズ:${task.id}:3時間`
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '🌅 明日朝9時',
            text: `スヌーズ:${task.id}:明日朝`
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '✅ 完了',
            text: `タスク完了:${task.id}:${task.listId}`
          }
        }
      ]
    }
  };
}

// スヌーズされたタスクの通知チェック
async function checkSnoozedTasks(userId, env) {
  try {
    const tasks = await getAllIncompleteTasks(userId, env);
    const now = new Date();

    for (const task of tasks) {
      const snoozeDataJson = await env.NOTIFICATIONS.get(`task_snooze_${userId}_${task.id}`);
      if (!snoozeDataJson) continue;

      const snoozeData = JSON.parse(snoozeDataJson);
      const snoozeUntil = new Date(snoozeData.snoozeUntil);

      const timeDiff = now - snoozeUntil;
      if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
        let messageText = `⏰ スヌーズしたタスクのリマインダー\n\n📝 ${task.title}\n📋 リスト: ${task.listTitle}`;
        
        if (task.due) {
          const dueDate = new Date(task.due);
          const dueStr = dueDate.getMonth() + 1 + '/' + dueDate.getDate();
          messageText += '\n📅 期限: ' + dueStr;
        }

        const messageWithSnooze = buildTaskNotificationWithSnooze(task, messageText);
        await sendLineMessage(userId, messageWithSnooze, env.LINE_CHANNEL_ACCESS_TOKEN);

        await env.NOTIFICATIONS.delete(`task_snooze_${userId}_${task.id}`);

        console.log('Snoozed task notification sent for user', userId, ':', task.title);
      }
    }
  } catch (error) {
    console.error('Error checking snoozed tasks for user', userId, ':', error);
  }
}

/**
 * タスクの期限日をJSTで取得
 * @param {string} dueString - ISO8601形式の期限日
 * @returns {Date} JST日付オブジェクト
 */
function getTaskDueDateInJST(dueString) {
  // ISO日付文字列から日付部分のみを抽出（タイムゾーン変換なし）
  // "2026-02-03T00:00:00Z" → Date(2026, 1, 3) (月は0始まり)
  const date = new Date(dueString);
  return date;
}

/**
 * LIFF HTMLを生成
 */
function generateLiffHtml(liffId, apiBase) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calendar & Tasks</title>
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }
    .container { max-width: 600px; margin: 0 auto; padding: 16px; }
    .header { background: linear-gradient(135deg, #06c755 0%, #00b341 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 16px; text-align: center; }
    .header h1 { font-size: 20px; margin-bottom: 4px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .tabs { display: flex; background: white; border-radius: 12px; padding: 4px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .tab { flex: 1; padding: 12px; text-align: center; border: none; background: transparent; font-size: 14px; font-weight: 600; color: #666; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
    .tab.active { background: #06c755; color: white; }
    .section { display: none; }
    .section.active { display: block; }
    .calendar-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .calendar-header h2 { font-size: 18px; }
    .nav-btn { width: 36px; height: 36px; border: none; background: #f0f0f0; border-radius: 8px; cursor: pointer; font-size: 16px; }
    .calendar-grid { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px; }
    .weekday { text-align: center; font-size: 12px; color: #999; padding: 8px 0; }
    .calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .day { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; cursor: pointer; position: relative; }
    .day:hover { background: #f0f0f0; }
    .day.today { background: #06c755; color: white; }
    .day.has-event::after { content: ''; width: 6px; height: 6px; background: #ff6b6b; border-radius: 50%; position: absolute; bottom: 4px; }
    .day.other-month { color: #ccc; }
    .events-list { margin-top: 16px; }
    .event-item { background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid #06c755; }
    .event-item h3 { font-size: 16px; margin-bottom: 4px; }
    .event-item p { font-size: 13px; color: #666; }
    .task-list { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .task-item { display: flex; align-items: center; padding: 16px; border-bottom: 1px solid #f0f0f0; gap: 12px; }
    .task-item:last-child { border-bottom: none; }
    .task-checkbox { width: 24px; height: 24px; border: 2px solid #ddd; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
    .task-checkbox:hover { border-color: #06c755; }
    .task-checkbox.checked { background: #06c755; border-color: #06c755; }
    .task-checkbox.checked::after { content: '\u2713'; color: white; font-size: 14px; }
    .task-content { flex: 1; }
    .task-title { font-size: 15px; margin-bottom: 2px; }
    .task-title.completed { text-decoration: line-through; color: #999; }
    .task-due { font-size: 12px; color: #999; }
    .task-star { color: #ffc107; font-size: 18px; }
    .loading { text-align: center; padding: 40px; color: #999; }
    .empty { text-align: center; padding: 40px; color: #999; }
    .error { background: #ffebee; color: #c62828; padding: 16px; border-radius: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Calendar & Tasks</h1>
      <p id="user-name">読み込み中...</p>
    </div>
    <div class="tabs">
      <button class="tab active" data-tab="calendar">カレンダー</button>
      <button class="tab" data-tab="tasks">タスク</button>
    </div>
    <div id="calendar" class="section active">
      <div class="calendar-header">
        <button class="nav-btn" id="prev-month">&lt;</button>
        <h2 id="current-month">2024年1月</h2>
        <button class="nav-btn" id="next-month">&gt;</button>
      </div>
      <div class="calendar-grid">
        <div class="calendar-weekdays">
          <div class="weekday">日</div><div class="weekday">月</div><div class="weekday">火</div>
          <div class="weekday">水</div><div class="weekday">木</div><div class="weekday">金</div><div class="weekday">土</div>
        </div>
        <div class="calendar-days" id="calendar-days"></div>
      </div>
      <div class="events-list" id="events-list"><div class="loading">予定を読み込み中...</div></div>
    </div>
    <div id="tasks" class="section">
      <div class="task-list" id="task-list"><div class="loading">タスクを読み込み中...</div></div>
    </div>
  </div>
  <script>
    const LIFF_ID = '${liffId}';
    const API_BASE = '${apiBase}';
    let currentDate = new Date();
    let events = [];
    let tasks = [];
    let userId = null;

    async function initializeLiff() {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        userId = profile.userId;
        document.getElementById('user-name').textContent = profile.displayName;
        await loadEvents();
        await loadTasks();
        renderCalendar();
      } catch (error) {
        console.error('LIFF initialization failed:', error);
        document.getElementById('user-name').textContent = 'エラーが発生しました';
      }
    }

    async function loadEvents() {
      try {
        const response = await fetch(API_BASE + '/api/events?userId=' + userId);
        if (response.ok) { events = await response.json(); }
      } catch (error) { console.error('Failed to load events:', error); }
    }

    async function loadTasks() {
      try {
        const response = await fetch(API_BASE + '/api/tasks?userId=' + userId);
        if (response.ok) { tasks = await response.json(); renderTasks(); }
      } catch (error) { console.error('Failed to load tasks:', error); }
    }

    function renderCalendar() {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      document.getElementById('current-month').textContent = year + '年' + (month + 1) + '月';
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDayOfWeek = firstDay.getDay();
      const daysContainer = document.getElementById('calendar-days');
      daysContainer.innerHTML = '';
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dayEl = createDayElement(prevMonthLastDay - i, true);
        daysContainer.appendChild(dayEl);
      }
      const today = new Date();
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const hasEvent = events.some(e => (e.start.dateTime && e.start.dateTime.startsWith(dateStr)) || e.start.date === dateStr);
        const dayEl = createDayElement(day, false, isToday, hasEvent);
        dayEl.addEventListener('click', () => showDayEvents(year, month, day));
        daysContainer.appendChild(dayEl);
      }
      const remainingDays = 42 - daysContainer.children.length;
      for (let i = 1; i <= remainingDays; i++) {
        const dayEl = createDayElement(i, true);
        daysContainer.appendChild(dayEl);
      }
      showDayEvents(today.getFullYear(), today.getMonth(), today.getDate());
    }

    function createDayElement(day, isOtherMonth, isToday = false, hasEvent = false) {
      const el = document.createElement('div');
      el.className = 'day';
      if (isOtherMonth) el.classList.add('other-month');
      if (isToday) el.classList.add('today');
      if (hasEvent) el.classList.add('has-event');
      el.textContent = day;
      return el;
    }

    function showDayEvents(year, month, day) {
      const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const dayEvents = events.filter(e => (e.start.dateTime && e.start.dateTime.startsWith(dateStr)) || e.start.date === dateStr);
      const container = document.getElementById('events-list');
      if (dayEvents.length === 0) { container.innerHTML = '<div class="empty">この日の予定はありません</div>'; return; }
      container.innerHTML = dayEvents.map(event => '<div class="event-item"><h3>' + (event.summary || '予定') + '</h3><p>' + formatEventTime(event) + '</p></div>').join('');
    }

    function formatEventTime(event) {
      if (event.start.date) return '終日';
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      return start.getHours() + ':' + String(start.getMinutes()).padStart(2, '0') + ' - ' + end.getHours() + ':' + String(end.getMinutes()).padStart(2, '0');
    }

    function renderTasks() {
      const container = document.getElementById('task-list');
      if (tasks.length === 0) { container.innerHTML = '<div class="empty">未完了のタスクはありません</div>'; return; }
      container.innerHTML = tasks.map((task, index) =>
        '<div class="task-item" data-index="' + index + '">' +
        '<div class="task-checkbox" onclick="toggleTask(' + index + ')"></div>' +
        '<div class="task-content"><div class="task-title">' + task.title + '</div>' +
        (task.due ? '<div class="task-due">期限: ' + formatDueDate(task.due) + '</div>' : '') +
        '</div>' + (task.starred ? '<div class="task-star">★</div>' : '') + '</div>'
      ).join('');
    }

    function formatDueDate(due) {
      const date = new Date(due);
      return (date.getMonth() + 1) + '/' + date.getDate();
    }

    async function toggleTask(index) {
      const task = tasks[index];
      const checkbox = document.querySelectorAll('.task-checkbox')[index];
      checkbox.classList.add('checked');
      try {
        await fetch(API_BASE + '/api/tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, taskId: task.id, listId: task.listId })
        });
        setTimeout(() => { tasks.splice(index, 1); renderTasks(); }, 300);
      } catch (error) {
        console.error('Failed to complete task:', error);
        checkbox.classList.remove('checked');
      }
    }

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

    document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

    // Check URL parameter for tab switching
    function switchTabFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'tasks' || tab === 'calendar') {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
        document.getElementById(tab).classList.add('active');
      }
    }
    switchTabFromUrl();

    initializeLiff();
  </script>
</body>
</html>`;
}
