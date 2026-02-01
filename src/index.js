/**
 * LINE × Google Calendar & Tasks 連携 Worker
 */
import { verifySignature, replyLineMessage, sendLineMessage } from './line.js';
import { createEvent, getUpcomingEvents, searchEvents, searchEventsInRange, deleteEvent, updateEvent } from './calendar.js';
import { createTask, getUpcomingTasks, getAllIncompleteTasks, getTaskLists } from './tasks.js';
import { parseEventText } from './gemini.js';

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

export default {
  // LINE Webhook処理
  async fetch(request, env, ctx) {
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

      if (event && event.type === 'message' && event.message.type === 'text') {
        await handleMessage(event, env, ctx);
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
  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  console.log('User message:', userMessage);

  // ユーザーIDを保存（初回メッセージ時に自動保存）
  await env.NOTIFICATIONS.put('LINE_USER_ID', userId);
  console.log('User ID saved');

  // 予定登録方法の検出
  if (userMessage.includes('予定を登録してください') || userMessage === '登録方法' || userMessage === 'ヘルプ') {
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

  // タスク登録方法の検出
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
          const tasks = await getAllIncompleteTasks(env);

          if (tasks.length === 0) {
            await sendLineMessage(
              userId,
              '✅ 未完了のタスクはありません！',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            return;
          }

          // タスクリスト別に整理
          const tasksByList = {};
          for (const task of tasks) {
            if (!tasksByList[task.listTitle]) {
              tasksByList[task.listTitle] = [];
            }
            tasksByList[task.listTitle].push(task);
          }

          let message = '📋 未完了タスク一覧\n\n';
          for (const [listTitle, listTasks] of Object.entries(tasksByList)) {
            message += `【${listTitle}】\n`;
            for (const task of listTasks) {
              message += `□ ${task.title}`;
              if (task.due) {
                const dueDate = new Date(task.due);
                message += ` (期限: ${dueDate.getMonth() + 1}/${dueDate.getDate()})`;
              }
              message += '\n';
            }
            message += '\n';
          }

          await sendLineMessage(
            userId,
            message.trim(),
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
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

  // 数字入力の検出（pending actionがある場合）
  const numberMatch = userMessage.match(/^(\d+)$/);
  if (numberMatch) {
    console.log('Number input detected:', numberMatch[1]);
    const pendingActionKey = `pending_action_${userId}`;
    const pendingActionJson = await env.NOTIFICATIONS.get(pendingActionKey);

    if (pendingActionJson) {
      console.log('Pending action found');
      const pendingAction = JSON.parse(pendingActionJson);
      const selectedIndex = parseInt(numberMatch[1]) - 1;

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

  try {
    console.log('Calling Gemini API...');
    // Gemini APIで自然言語解析
    const eventData = await parseEventText(userMessage, env.GEMINI_API_KEY);
    console.log('Gemini API result:', JSON.stringify(eventData));

    if (!eventData) {
      console.log('Data validation failed');
      await replyLineMessage(
        replyToken,
        '形式を認識できませんでした。\n\n例：\n・明日14時 ミーティング（予定）\n・タスク 牛乳を買う\n・予定一覧\n・テスト会議をキャンセル',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );
      return;
    }

    const action = eventData.action || 'create';
    console.log('Action:', action);

    // 予定一覧
    if (action === 'list') {
      console.log('Action: LIST');
      
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
            console.log('LIST: Starting progressive search...');
            const now = new Date();
            const jstOffset = 9 * 60 * 60 * 1000;
            const jstNow = new Date(now.getTime() + jstOffset);

            // 今月の開始日と終了日
            const thisMonthStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), 1);
            const thisMonthEnd = new Date(jstNow.getFullYear(), jstNow.getMonth() + 1, 1);

            console.log('LIST: Searching this month...');
            let events = await searchEventsInRange(
              thisMonthStart.toISOString(),
              thisMonthEnd.toISOString(),
              eventData.keyword || null,
              env
            );
            console.log('LIST: This month events:', events.length);

            let searchPeriod = '今月';

            // 今月に予定がなければ来月を検索
            if (events.length === 0) {
              console.log('LIST: No events this month, searching next month...');
              const nextMonthStart = thisMonthEnd;
              const nextMonthEnd = new Date(jstNow.getFullYear(), jstNow.getMonth() + 2, 1);

              events = await searchEventsInRange(
                nextMonthStart.toISOString(),
                nextMonthEnd.toISOString(),
                eventData.keyword || null,
                env
              );
              console.log('LIST: Next month events:', events.length);
              searchPeriod = '来月';
            }

            // 来月にもなければ翌々月を検索
            if (events.length === 0) {
              console.log('LIST: No events next month, searching month after next...');
              const monthAfterNextStart = new Date(jstNow.getFullYear(), jstNow.getMonth() + 2, 1);
              const monthAfterNextEnd = new Date(jstNow.getFullYear(), jstNow.getMonth() + 3, 1);

              events = await searchEventsInRange(
                monthAfterNextStart.toISOString(),
                monthAfterNextEnd.toISOString(),
                eventData.keyword || null,
                env
              );
              console.log('LIST: Month after next events:', events.length);
              searchPeriod = '翌々月';
            }

            if (events.length === 0) {
              await sendLineMessage(
                userId,
                '📅 今後3ヶ月の予定はありません',
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              return;
            }

            let message = `📅 予定一覧（${searchPeriod}）\n\n`;
            for (const event of events) {
              const { dateStr, timeStr } = formatEventDateTime(event);
              message += `📝 ${event.summary || '予定'}\n⏰ ${dateStr} ${timeStr}\n\n`;
            }

            await sendLineMessage(
              userId,
              message.trim(),
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          } catch (error) {
            console.error('List events error:', error);
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

    // 予定キャンセル
    if (action === 'cancel') {
      console.log('Action: CANCEL');
      
      if (!eventData.keyword) {
        await replyLineMessage(
          replyToken,
          'キャンセルする予定を指定してください。\n\n例：テスト会議をキャンセル',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }

      // すぐに返信
      await replyLineMessage(
        replyToken,
        '⏳ 予定を検索しています...',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      // 非同期で処理
      ctx.waitUntil(
        (async () => {
          try {
            console.log('CANCEL: Starting async search...');
            let events = await searchEvents(eventData.keyword, env);
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

              // pending actionをKVに保存（10分間有効）
              const pendingAction = {
                action: 'cancel',
                events: events.map(e => ({
                  id: e.id,
                  summary: e.summary,
                  start: e.start
                }))
              };
              const pendingActionKey = `pending_action_${userId}`;
              await env.NOTIFICATIONS.put(
                pendingActionKey,
                JSON.stringify(pendingAction),
                { expirationTtl: 600 }
              );
              console.log('CANCEL: Pending action saved');

              console.log('CANCEL: Sending multiple events message...');
              console.log('CANCEL: Message content:', message);
              await sendLineMessage(
                userId,
                message,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
              console.log('CANCEL: Multiple events message sent');
              return;
            }

            // 1件のみ見つかった場合は削除
            console.log('CANCEL: Single event found, deleting...');
            const event = events[0];
            await deleteEvent(event.id, env);
            console.log('CANCEL: Event deleted, sending success message...');

            await sendLineMessage(
              userId,
              `✅ 「${event.summary}」をキャンセルしました`,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            console.log('CANCEL: Success message sent');
          } catch (error) {
            console.error('Cancel event error:', error);
            console.error('Cancel event error stack:', error.stack);
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

    // 予定変更
    if (action === 'update') {
      console.log('Action: UPDATE');
      
      if (!eventData.keyword) {
        await replyLineMessage(
          replyToken,
          '変更する予定を指定してください。\n\n例：テスト会議を16時に変更',
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
        return;
      }

      // すぐに返信
      await replyLineMessage(
        replyToken,
        '⏳ 予定を検索しています...',
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      // 非同期で処理
      ctx.waitUntil(
        (async () => {
          try {
            console.log('UPDATE: Starting async search...');
            let events = await searchEvents(eventData.keyword, env);
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

              // pending actionをKVに保存（10分間有効）
              const pendingAction = {
                action: 'update',
                updateData: {
                  startTime: eventData.startTime,
                  endTime: eventData.endTime,
                  title: eventData.title !== eventData.keyword ? eventData.title : null
                },
                events: events.map(e => ({
                  id: e.id,
                  summary: e.summary,
                  start: e.start
                }))
              };
              const pendingActionKey = `pending_action_${userId}`;
              await env.NOTIFICATIONS.put(
                pendingActionKey,
                JSON.stringify(pendingAction),
                { expirationTtl: 600 }
              );
              console.log('UPDATE: Pending action saved');

              await sendLineMessage(
                userId,
                message,
                env.LINE_CHANNEL_ACCESS_TOKEN
              );
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
            await updateEvent(event.id, updateData, env);
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

    // 新規登録（既存のコード）
    if (!eventData.date) {
      console.log('Date missing for create action');
      await replyLineMessage(
        replyToken,
        '日付を指定してください。\n\n例：明日14時 ミーティング',
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
      // 先にLINEに返信（処理中メッセージ）
      let replyMessage = `⏳ タスクを登録しています...\n\n📝 ${eventData.title}`;
      if (eventData.date) {
        replyMessage += `\n📅 期限: ${eventData.date}`;
      }
      if (eventData.location) {
        replyMessage += `\n📍 ${eventData.location}`;
      }
      if (eventData.url) {
        replyMessage += `\n🔗 ${eventData.url}`;
      }
      
      await replyLineMessage(
        replyToken,
        replyMessage,
        env.LINE_CHANNEL_ACCESS_TOKEN
      );

      // タスク登録は非同期で実行
      ctx.waitUntil(
        (async () => {
          try {
            console.log('Creating task in background...');
            
            // タスクリストを取得してAIで振り分け
            const taskLists = await getTaskLists(env);
            const listNames = taskLists.map(list => list.title).join(', ');
            
            // AIでリスト名を判定（簡易版：eventData.listNameがあればそれを使う）
            const taskData = {
              title: eventData.title,
              due: eventData.date || null,
              notes: [eventData.location, eventData.url].filter(Boolean).join('\n') || null,
              listName: eventData.listName || null
            };
            
            const task = await createTask(taskData, env);
            console.log('Task created:', task.id);

            // 成功メッセージを送信
            let successMessage = `✅ タスクを登録しました！\n\n📝 ${eventData.title}\n📋 リスト: ${task.listTitle}`;
            if (eventData.date) {
              successMessage += `\n📅 期限: ${eventData.date}`;
            }
            if (eventData.location) {
              successMessage += `\n📍 ${eventData.location}`;
            }
            if (eventData.url) {
              successMessage += `\n🔗 ${eventData.url}`;
            }
            
            await sendLineMessage(
              userId,
              successMessage,
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
            console.log('Task success message sent');
          } catch (error) {
            console.error('Background task registration failed:', error);
            await sendLineMessage(
              userId,
              '⚠️ タスクの登録に失敗しました。もう一度お試しください。',
              env.LINE_CHANNEL_ACCESS_TOKEN
            );
          }
        })()
      );
      return;
    }

    // 予定の場合（既存のコード）
    console.log('Detected as EVENT');

    // 先にLINEに返信（処理中メッセージ）
    console.log('Sending immediate reply to LINE...');
    let replyMessage = `⏳ 予定を登録しています...\n\n📅 ${eventData.date}`;
    if (!eventData.isAllDay) {
      replyMessage += `\n⏰ ${eventData.startTime} - ${eventData.endTime}`;
    } else {
      replyMessage += `\n⏰ 終日`;
    }
    replyMessage += `\n📝 ${eventData.title}`;
    if (eventData.location) {
      replyMessage += `\n📍 ${eventData.location}`;
    }
    if (eventData.url) {
      replyMessage += `\n🔗 ${eventData.url}`;
    }
    
    await replyLineMessage(
      replyToken,
      replyMessage,
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
    console.log('Immediate reply sent');

    // カレンダー登録は非同期で実行（タイムアウト回避）
    console.log('Starting background calendar registration...');
    ctx.waitUntil(
      (async () => {
        try {
          console.log('Creating calendar event in background...');
          const calendarEvent = await createEvent(eventData, env);
          console.log('Calendar event created:', calendarEvent.id);

          // 成功メッセージを送信
          let successMessage = `✅ 予定を登録しました！\n\n📅 ${eventData.date}`;
          if (!eventData.isAllDay) {
            successMessage += `\n⏰ ${eventData.startTime} - ${eventData.endTime}`;
          } else {
            successMessage += `\n⏰ 終日`;
          }
          successMessage += `\n📝 ${eventData.title}`;
          if (eventData.location) {
            successMessage += `\n📍 ${eventData.location}`;
          }
          if (eventData.url) {
            successMessage += `\n🔗 ${eventData.url}`;
          }
          
          await sendLineMessage(
            userId,
            successMessage,
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
          console.log('Success message sent');
        } catch (error) {
          console.error('Background calendar registration failed:', error);
          await sendLineMessage(
            userId,
            '⚠️ 予定の登録に失敗しました。もう一度お試しください。',
            env.LINE_CHANNEL_ACCESS_TOKEN
          );
        }
      })()
    );

  } catch (error) {
    console.error('Message handling error:', error);
    await replyLineMessage(
      replyToken,
      '予定の登録に失敗しました。もう一度お試しください。',
      env.LINE_CHANNEL_ACCESS_TOKEN
    );
  }
}

// 通知チェック＆送信
async function checkAndSendNotifications(env) {
  try {
    const now = getJSTDate(); // 日本時間で取得
    
    // 日曜21時の週次レポート
    await checkWeeklyReport(now, env);

    // カレンダー予定の通知
    const events = await getUpcomingEvents(env);
    for (const event of events) {
      if (!event.start || !event.start.dateTime) continue;

      const eventStart = new Date(event.start.dateTime);
      const eventId = event.id;

      // 前日18時の通知
      await checkDayBeforeNotification(event, eventStart, now, env);

      // 1時間前の通知
      await checkOneHourBeforeNotification(event, eventStart, now, env);
    }

    // タスクの通知
    const tasks = await getUpcomingTasks(env);
    for (const task of tasks) {
      if (!task.due) continue;

      const taskDue = new Date(task.due);
      
      // タスクの前日18時通知
      await checkTaskDayBeforeNotification(task, taskDue, now, env);
      
      // タスクの当日9時通知
      await checkTaskMorningNotification(task, taskDue, now, env);
    }
  } catch (error) {
    console.error('Notification check error:', error);
  }
}

// 日曜21時の週次レポート
async function checkWeeklyReport(now, env) {
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // 日曜日の21時00分〜21時14分
  if (day === 0 && hour === 21 && minute < 15) {
    const reportKey = `weekly_report_${now.toISOString().split('T')[0]}`;
    const alreadySent = await env.NOTIFICATIONS.get(reportKey);
    
    if (!alreadySent) {
      const userId = await env.NOTIFICATIONS.get('LINE_USER_ID');
      
      if (userId) {
        // 未完了タスク一覧を取得
        const allTasks = await getAllIncompleteTasks(env);
        
        if (allTasks.length === 0) {
          const message = '📋 今週の未完了タスク\n\nタスクはありません！お疲れさまでした🎉';
          await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
        } else {
          // タスクリスト別に整理
          const tasksByList = {};
          for (const task of allTasks) {
            if (!tasksByList[task.listTitle]) {
              tasksByList[task.listTitle] = [];
            }
            tasksByList[task.listTitle].push(task);
          }
          
          let message = '📋 今週の未完了タスク\n\n';
          for (const [listTitle, tasks] of Object.entries(tasksByList)) {
            message += `【${listTitle}】\n`;
            for (const task of tasks) {
              message += `□ ${task.title}`;
              if (task.due) {
                const dueDate = new Date(task.due);
                message += ` (期限: ${dueDate.getMonth() + 1}/${dueDate.getDate()})`;
              }
              message += '\n';
            }
            message += '\n';
          }
          
          await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);
        }
        
        // 送信済みフラグ保存（7日間保持）
        await env.NOTIFICATIONS.put(reportKey, 'sent', { expirationTtl: 604800 });
        console.log('週次レポート送信');
      }
    }
  }
}

// タスクの前日18時通知
async function checkTaskDayBeforeNotification(task, taskDue, now, env) {
  const dueDate = new Date(taskDue);
  dueDate.setHours(0, 0, 0, 0);

  const notificationTime = new Date(dueDate);
  notificationTime.setDate(notificationTime.getDate() - 1);
  notificationTime.setHours(18, 0, 0, 0);

  const timeDiff = now - notificationTime;
  
  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${task.id}_task_day_before`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const userId = await env.NOTIFICATIONS.get('LINE_USER_ID');
      
      if (userId) {
        const dueStr = `${dueDate.getMonth() + 1}/${dueDate.getDate()}`;
        const message = `📅 明日が期限のタスク\n\n📝 ${task.title}\n📋 リスト: ${task.listTitle}\n📅 期限: ${dueStr}`;
        
        await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);

        // 通知済みフラグ保存（24時間保持）
        await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });
        
        console.log('タスク前日通知送信:', task.title);
      }
    }
  }
}

// タスクの当日9時通知
async function checkTaskMorningNotification(task, taskDue, now, env) {
  const dueDate = new Date(taskDue);
  dueDate.setHours(9, 0, 0, 0);

  const timeDiff = now - dueDate;
  
  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${task.id}_task_morning`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      const userId = await env.NOTIFICATIONS.get('LINE_USER_ID');
      
      if (userId) {
        const message = `⏰ 今日が期限のタスク\n\n📝 ${task.title}\n📋 リスト: ${task.listTitle}`;
        
        await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);

        // 通知済みフラグ保存（24時間保持）
        await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });
        
        console.log('タスク当日通知送信:', task.title);
      }
    }
  }
}

// 前日18時通知チェック
async function checkDayBeforeNotification(event, eventStart, now, env) {
  const eventDate = new Date(eventStart);
  eventDate.setHours(0, 0, 0, 0);

  const notificationTime = new Date(eventDate);
  notificationTime.setDate(notificationTime.getDate() - 1);
  notificationTime.setHours(18, 0, 0, 0);

  const timeDiff = now - notificationTime;
  
  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${event.id}_day_before`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      // 保存されたユーザーIDを取得
      const userId = await env.NOTIFICATIONS.get('LINE_USER_ID');
      
      if (userId) {
        const message = `📅 明日の予定\n\n⏰ ${formatDateTime(eventStart)}\n📝 ${event.summary || '予定'}`;
        
        await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);

        // 通知済みフラグ保存（24時間保持）
        await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });
        
        console.log('前日通知送信:', event.summary);
      } else {
        console.log('ユーザーID未登録：LINEでメッセージを送信してください');
      }
    }
  }
}

// 1時間前通知チェック
async function checkOneHourBeforeNotification(event, eventStart, now, env) {
  const oneHourBefore = new Date(eventStart.getTime() - 60 * 60 * 1000);
  const timeDiff = now - oneHourBefore;

  // 15分以内（Cronの間隔）かつまだ通知していない
  if (timeDiff >= 0 && timeDiff <= 15 * 60 * 1000) {
    const notificationKey = `${event.id}_1hour_before`;
    const alreadyNotified = await env.NOTIFICATIONS.get(notificationKey);

    if (!alreadyNotified) {
      // 保存されたユーザーIDを取得
      const userId = await env.NOTIFICATIONS.get('LINE_USER_ID');
      
      if (userId) {
        const message = `⏰ 1時間後に予定があります\n\n⏰ ${formatDateTime(eventStart)}\n📝 ${event.summary || '予定'}`;
        
        await sendLineMessage(userId, message, env.LINE_CHANNEL_ACCESS_TOKEN);

        // 通知済みフラグ保存（24時間保持）
        await env.NOTIFICATIONS.put(notificationKey, 'sent', { expirationTtl: 86400 });
        
        console.log('1時間前通知送信:', event.summary);
      } else {
        console.log('ユーザーID未登録：LINEでメッセージを送信してください');
      }
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
      await deleteEvent(selectedEvent.id, env);
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
      await updateEvent(selectedEvent.id, updateData, env);
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
