/**
 * LINE Calendar Bot - メインアプリケーションロジック
 * Cloudflare Workers と Google Cloud Run の両方で使用
 */
import { env, createContext } from './utils/env-adapter.js';
import { verifySignature, replyLineMessage, sendLineMessage } from './services/line.service.js';
import { createEvent, getUpcomingEvents, searchEvents, searchEventsInRange, deleteEvent, updateEvent } from './services/google-calendar.service.js';
import { createTask, getUpcomingTasks, getAllIncompleteTasks, getTaskLists, completeTask } from './services/google-tasks.service.js';
import { parseEventText } from './services/ai.service.js';
import { handleOAuthCallback, getAuthorizationUrl, isUserAuthenticated, getUserAccessToken, revokeUserTokens } from './services/auth.service.js';

// index.js からハンドラー関数をインポート（リファクタリング後）
// 現在は index.js の内容を直接使用

/**
 * Webhook を処理
 * @param {object} body - LINE Webhook のボディ
 */
export async function handleWebhook(body) {
  const ctx = createContext();
  const event = body.events && body.events[0];

  if (!event) {
    return;
  }

  try {
    if (event.type === 'follow') {
      await handleFollowEvent(event, env);
    } else if (event.type === 'message' && event.message.type === 'text') {
      await handleMessage(event, env, ctx);
    }
  } catch (error) {
    console.error('Webhook handling error:', error);
  }
}

/**
 * スケジュールタスクを実行（15分ごと）
 */
export async function runScheduledTask() {
  try {
    await checkAndSendNotifications(env);
  } catch (error) {
    console.error('Scheduled task error:', error);
  }
}

// ========================================
// 以下、index.js から移植した関数群
// （簡略化のため、主要な関数のみ）
// ========================================

// 日本時間を取得
function getJSTDate() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  return new Date(now.getTime() + jstOffset);
}

// フォローイベント処理
async function handleFollowEvent(event, env) {
  const userId = event.source.userId;
  const replyToken = event.replyToken;

  console.log('Follow event from user:', userId);

  const isAuthenticated = await isUserAuthenticated(userId, env);

  if (isAuthenticated) {
    await replyLineMessage(
      replyToken,
      '再度友だち追加ありがとうございます！\n\n既に認証済みですので、そのままご利用いただけます。\n\n⚠️ 他の人のデータが表示される場合は「リセット」と送信してください。',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  const liffUrl = `https://liff.line.me/${env.LIFF_ID}`;

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

// メッセージ処理（メイン）
async function handleMessage(event, env, ctx) {
  console.log('=== handleMessage START ===');
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userMessage = event.message.text.trim();

  console.log('User message:', userMessage);

  // リセットコマンド（認証前でも実行可能）
  if (userMessage === 'リセット' || userMessage === 'reset' || userMessage === 'RESET') {
    await revokeUserTokens(userId, env);
    const liffUrl = `https://liff.line.me/${env.LIFF_ID}`;
    await replyLineMessage(
      replyToken,
      '🔄 認証情報をリセットしました。\n\n下のリンクをタップして、アプリ内で再認証してください👇\n\n' + liffUrl + '\n\n⚠️ 必ずご自身のGoogleアカウントでログインしてください。',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  // 認証チェック
  const isAuthenticated = await isUserAuthenticated(userId, env);

  if (!isAuthenticated) {
    const liffUrl = `https://liff.line.me/${env.LIFF_ID}`;
    await replyLineMessage(
      replyToken,
      '🔐 Googleアカウントとの連携が必要です。\n\n下のリンクをタップして、アプリ内で認証してください👇\n\n' + liffUrl,
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    return;
  }

  console.log('User authenticated, processing message');

  // 処理中メッセージを返信
  await replyLineMessage(
    replyToken,
    '⏳ 処理しています...',
    env.LINE_CHANNEL_ACCESS_TOKEN
  );

  // 非同期でGemini処理
  ctx.waitUntil(
    (async () => {
      try {
        console.log('Calling Gemini API...');
        const lastBotResponse = await env.NOTIFICATIONS.get(`last_bot_response_${userId}`);
        const eventData = await parseEventText(userMessage, env.GEMINI_API_KEY, lastBotResponse);

        console.log('Gemini API result:', JSON.stringify(eventData));

        if (!eventData) {
          await sendLineMessage(
            userId,
            '⚠️ メッセージを理解できませんでした。\n\nもう一度、以下の形式で送信してください：\n\n【予定の例】\n・明日14時 ミーティング\n・2月5日19時 飲み会\n\n【タスクの例】\n・タスク 牛乳を買う\n・タスク 書類提出 期限明日',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          return;
        }

        const action = eventData.action || 'create';
        console.log('Action:', action);

        // アクションに応じて処理
        if (action === 'list') {
          await handleListAction(eventData, userId, env);
        } else if (action === 'create') {
          await handleCreateAction(eventData, userId, env);
        } else if (action === 'cancel') {
          await handleCancelAction(eventData, userId, env);
        } else if (action === 'complete') {
          await handleCompleteAction(eventData, userId, env);
        } else {
          await sendLineMessage(
            userId,
            '⚠️ 処理方法を理解できませんでした。',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      } catch (error) {
        console.error('Message handling error:', error);
        if (error.code === 'AUTH_EXPIRED') {
          const liffUrl = `https://liff.line.me/${env.LIFF_ID}`;
          await sendLineMessage(
            userId,
            '🔐 Googleアカウントとの連携が切れました。\n\nお手数ですが、下のリンクをタップして再認証してください👇\n\n' + liffUrl,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        } else {
          await sendLineMessage(
            userId,
            '⚠️ 処理中にエラーが発生しました。\n\nもう一度お試しください。',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      }
    })()
  );
}

// 一覧表示アクション
async function handleListAction(eventData, userId, env) {
  const type = eventData.type;

  if (type === 'task') {
    const tasks = await getAllIncompleteTasks(userId, env);

    if (tasks.length === 0) {
      await sendLineMessage(userId, '✅ 未完了のタスクはありません', env.LINE_CHANNEL_ACCESS_TOKEN);
      return;
    }

    let message = '📝 タスク一覧\n\n';
    tasks.forEach((task, index) => {
      const star = task.starred ? '⭐' : '□';
      const due = task.due ? ` (期限: ${formatDueDate(task.due)})` : '';
      message += `${index + 1}. ${star} ${task.title}${due}\n`;
    });
    message += '\n完了にするには番号を入力（例: 1完了）';

    await env.NOTIFICATIONS.put(
      `pending_complete_${userId}`,
      JSON.stringify(tasks),
      { expirationTtl: 600 }
    );
    await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message, { expirationTtl: 300 });
    await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
  } else {
    const events = await getUpcomingEvents(userId, env, 90);

    if (events.length === 0) {
      await sendLineMessage(userId, '📅 今後3ヶ月の予定はありません', env.LINE_CHANNEL_ACCESS_TOKEN);
      return;
    }

    let message = '📅 今後の予定\n\n';
    events.slice(0, 20).forEach((event, index) => {
      const dateTime = formatEventDateTime(event);
      message += `${index + 1}. ${event.summary || '予定'}\n⏰ ${dateTime.dateStr} ${dateTime.timeStr}\n\n`;
    });

    await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message, { expirationTtl: 300 });
    await sendLineMessage(userId, message.trim(), env.LINE_CHANNEL_ACCESS_TOKEN);
  }
}

// 作成アクション
async function handleCreateAction(eventData, userId, env) {
  const isTask = eventData.type === 'task';

  if (isTask) {
    const taskData = {
      title: eventData.title,
      due: eventData.date || null,
      notes: null,
      listName: eventData.listName || null,
      starred: eventData.starred || false
    };

    const task = await createTask(taskData, userId, env);

    await sendLineMessage(
      userId,
      `✅ タスクを登録しました！\n\n📝 ${eventData.title}\n📋 リスト: ${task.listTitle}${eventData.date ? `\n📅 期限: ${eventData.date}` : ''}`,
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
  } else {
    // 予定作成
    if (!eventData.date) {
      eventData.date = getJSTDate().toISOString().split('T')[0];
    }
    if (!eventData.startTime) {
      eventData.startTime = '00:00';
      eventData.endTime = '23:59';
      eventData.isAllDay = true;
    }

    await createEvent(eventData, userId, env);

    const timeStr = eventData.isAllDay ? '終日' : `${eventData.startTime}${eventData.endTime ? ' - ' + eventData.endTime : ''}`;
    await sendLineMessage(
      userId,
      `📅 予定を登録しました！\n\n📝 ${eventData.title}\n📅 ${eventData.date}\n⏰ ${timeStr}`,
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
  }
}

// キャンセルアクション
async function handleCancelAction(eventData, userId, env) {
  try {
    const keyword = eventData.title || eventData.keyword;

    if (!keyword) {
      await sendLineMessage(userId, '⚠️ キャンセルしたい予定のキーワードを教えてください。\n\n例: 「ミーティングをキャンセル」', env.LINE_CHANNEL_ACCESS_TOKEN);
      return;
    }

    // 今後90日以内の予定からキーワードで検索
    const events = await getUpcomingEvents(userId, env, 90);
    const matched = events.filter(e =>
      e.summary && e.summary.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matched.length === 0) {
      await sendLineMessage(userId, `❌ 「${keyword}」に一致する予定が見つかりませんでした。`, env.LINE_CHANNEL_ACCESS_TOKEN);
      return;
    }

    if (matched.length === 1) {
      // 1件だけなら即削除
      await deleteEvent(matched[0].id, userId, env);
      const dt = formatEventDateTime(matched[0]);
      await sendLineMessage(userId, `🗑️ 予定をキャンセルしました\n\n📅 ${matched[0].summary}\n⏰ ${dt.dateStr} ${dt.timeStr}`, env.LINE_CHANNEL_ACCESS_TOKEN);
      return;
    }

    // 複数候補 → 一覧を表示して選択させる
    let message = `📅 「${keyword}」に一致する予定が ${matched.length} 件あります\n\n`;
    matched.slice(0, 10).forEach((event, index) => {
      const dt = formatEventDateTime(event);
      message += `${index + 1}. ${event.summary}\n⏰ ${dt.dateStr} ${dt.timeStr}\n\n`;
    });
    message += 'キャンセルしたい予定の番号を送信してください（例: 1キャンセル）';

    // 候補をKVに保存（10分間有効）
    await env.NOTIFICATIONS.put(
      `pending_cancel_${userId}`,
      JSON.stringify(matched.slice(0, 10)),
      { expirationTtl: 600 }
    );
    await env.NOTIFICATIONS.put(`last_bot_response_${userId}`, message, { expirationTtl: 300 });
    await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
  } catch (error) {
    console.error('Cancel action error:', error);
    if (error.code === 'AUTH_EXPIRED') throw error;
    await sendLineMessage(userId, '⚠️ 予定のキャンセルに失敗しました。もう一度お試しください。', env.LINE_CHANNEL_ACCESS_TOKEN);
  }
}

// 完了アクション
async function handleCompleteAction(eventData, userId, env) {
  if (eventData.targetNumber) {
    const pendingData = await env.NOTIFICATIONS.get(`pending_complete_${userId}`, { type: 'json' });

    if (pendingData) {
      const index = eventData.targetNumber - 1;
      if (index >= 0 && index < pendingData.length) {
        const task = pendingData[index];
        await completeTask(task.id, task.listId, userId, env);
        await env.NOTIFICATIONS.delete(`pending_complete_${userId}`);
        await sendLineMessage(
          userId,
          `✅ タスクを完了しました\n\n📝 ${task.title}`,
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }
    } else {
      // pending データが期限切れ（TTL 600s）
      await sendLineMessage(
        userId,
        '⏰ 操作がタイムアウトしました。\n\nもう一度「タスク一覧」と送信して、完了したいタスクを選び直してください。',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );
      return;
    }
  }

  await sendLineMessage(userId, '⚠️ タスクが見つかりませんでした', env.LINE_CHANNEL_ACCESS_TOKEN);
}

// 通知チェック・送信
async function checkAndSendNotifications(env) {
  console.log('Running scheduled notification check...');

  try {
    // 通知対象ユーザーリストを取得
    const usersJson = await env.NOTIFICATIONS.get('notification_users', { type: 'json' });
    const users = usersJson || [];

    if (users.length === 0) {
      console.log('No users registered for notifications');
      return;
    }

    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    for (const userId of users) {
      try {
        // ユーザーの通知設定を確認
        const settings = await env.NOTIFICATIONS.get(`settings:${userId}`, { type: 'json' });
        if (settings && settings.reminderEnabled === false) {
          continue;
        }

        // 認証チェック
        const isAuthenticated = await isUserAuthenticated(userId, env);
        if (!isAuthenticated) {
          continue;
        }

        // 今後30分以内の予定を取得
        const events = await getUpcomingEvents(userId, env, 1);

        for (const event of events) {
          const eventStart = event.start.dateTime
            ? new Date(event.start.dateTime)
            : new Date(event.start.date);

          const timeDiff = eventStart.getTime() - now.getTime();
          const minutesUntil = Math.floor(timeDiff / (1000 * 60));

          // 15分前〜30分前の予定に通知
          if (minutesUntil >= 10 && minutesUntil <= 35) {
            // 重複チェック
            const notificationKey = `notified:${userId}:${event.id}`;
            const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

            if (!alreadyNotified) {
              const dateTime = formatEventDateTime(event);
              const message = `⏰ まもなく予定があります\n\n📅 ${event.summary || '予定'}\n⏰ ${dateTime.dateStr} ${dateTime.timeStr}\n\n約${minutesUntil}分後に開始します`;

              await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);

              // 通知済みとしてマーク（24時間有効）
              await env.NOTIFICATIONS.put(notificationKey, 'true', { expirationTtl: 86400 });
              console.log(`Notification sent to ${userId} for event: ${event.summary}`);
            }
          }
        }

        // 今日期限のタスクを通知（朝9時頃）
        const jstHour = jstNow.getUTCHours();
        if (jstHour >= 8 && jstHour <= 10) {
          const todayKey = `task_notified:${userId}:${jstNow.toISOString().split('T')[0]}`;
          const taskNotified = await env.NOTIFICATIONS.get(todayKey);

          if (!taskNotified) {
            const tasks = await getAllIncompleteTasks(userId, env);
            const today = jstNow.toISOString().split('T')[0];
            const todayTasks = tasks.filter(task => {
              if (!task.due) return false;
              return task.due.startsWith(today);
            });

            if (todayTasks.length > 0) {
              let message = `📝 今日期限のタスクがあります\n\n`;
              todayTasks.forEach((task, index) => {
                message += `${index + 1}. ${task.title}\n`;
              });

              await sendLineMessage(userId, message.trim(), env.LINE_CHANNEL_ACCESS_TOKEN);
              await env.NOTIFICATIONS.put(todayKey, 'true', { expirationTtl: 86400 });
              console.log(`Task reminder sent to ${userId}`);
            }
          }
        }
      } catch (userError) {
        console.error(`Notification error for user ${userId}:`, userError);
        if (userError.code === 'AUTH_EXPIRED') {
          try {
            const liffUrl = `https://liff.line.me/${env.LIFF_ID}`;
            await sendLineMessage(
              userId,
              '🔐 Googleアカウントとの連携が切れました。\n\nリマインダー通知を続けるには、再認証が必要です👇\n\n' + liffUrl,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          } catch (e) {
            console.error('Failed to send re-auth message:', e);
          }
        }
      }
    }

    console.log('Notification check completed');
  } catch (error) {
    console.error('Notification check error:', error);
  }
}

// ユーザーを通知リストに登録
export async function registerUserForNotifications(userId, env) {
  const usersJson = await env.NOTIFICATIONS.get('notification_users', { type: 'json' });
  const users = usersJson || [];

  if (!users.includes(userId)) {
    users.push(userId);
    await env.NOTIFICATIONS.put('notification_users', JSON.stringify(users));
  }
}

// ユーザーの通知設定を更新
export async function updateUserNotificationSettings(userId, settings, env) {
  await env.NOTIFICATIONS.put(`settings:${userId}`, JSON.stringify(settings));
}

// ヘルパー関数
function formatEventDateTime(event) {
  if (event.start.dateTime) {
    const date = new Date(event.start.dateTime);
    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return {
      dateStr: `${jstDate.getUTCMonth() + 1}/${jstDate.getUTCDate()}`,
      timeStr: `${String(jstDate.getUTCHours()).padStart(2, '0')}:${String(jstDate.getUTCMinutes()).padStart(2, '0')}`
    };
  } else {
    const date = new Date(event.start.date);
    return {
      dateStr: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
      timeStr: '終日'
    };
  }
}

function formatDueDate(due) {
  const date = new Date(due);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
