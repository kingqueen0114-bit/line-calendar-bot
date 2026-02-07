/**
 * LINE notification integration for dev agent
 * Sends progress reports to admin via LINE
 */

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

/**
 * Send a notification to the admin via LINE
 */
export async function sendLineNotification(message, options = {}) {
  if (!LINE_CHANNEL_ACCESS_TOKEN || !ADMIN_USER_ID) {
    console.warn('LINE credentials not configured, skipping notification');
    console.log('Notification:', message);
    return;
  }

  try {
    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: ADMIN_USER_ID,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LINE API error:', error);
    }
  } catch (error) {
    console.error('Failed to send LINE notification:', error);
  }
}

/**
 * Send a task status update
 */
export async function sendTaskUpdate(task, status, details = '') {
  const statusEmoji = {
    pending: '📋',
    processing: '⚙️',
    analyzing: '🔍',
    generating: '✨',
    reviewing: '👀',
    creating_pr: '📝',
    completed: '✅',
    failed: '❌'
  };

  const emoji = statusEmoji[status] || '📌';
  let message = `${emoji} タスク更新\n\n`;
  message += `📎 ${task.title}\n`;
  message += `状態: ${status}\n`;

  if (details) {
    message += `\n${details}`;
  }

  if (task.issueUrl) {
    message += `\n\n🔗 ${task.issueUrl}`;
  }

  await sendLineNotification(message);
}

/**
 * Send a PR creation notification
 */
export async function sendPRNotification(task, prUrl, prNumber) {
  const message = `🎉 PR作成完了!\n\n` +
    `タスク: ${task.title}\n` +
    `PR #${prNumber}\n\n` +
    `🔗 ${prUrl}\n\n` +
    `レビューをお願いします!`;

  await sendLineNotification(message);
}

/**
 * Send an error notification
 */
export async function sendErrorNotification(task, error) {
  const message = `🚨 エラー発生\n\n` +
    `タスク: ${task.title}\n` +
    `エラー: ${error.message || error}\n\n` +
    `手動での対応が必要な可能性があります。`;

  await sendLineNotification(message);
}

/**
 * Send daily summary
 */
export async function sendDailySummary(stats) {
  const message = `📊 本日の開発レポート\n\n` +
    `✅ 完了: ${stats.completed}件\n` +
    `❌ 失敗: ${stats.failed}件\n` +
    `📋 保留中: ${stats.pending}件\n\n` +
    `PR作成: ${stats.prsCreated}件\n` +
    `コミット: ${stats.commits}件`;

  await sendLineNotification(message);
}

/**
 * Send flex message with rich content
 */
export async function sendFlexMessage(title, contents) {
  if (!LINE_CHANNEL_ACCESS_TOKEN || !ADMIN_USER_ID) {
    console.warn('LINE credentials not configured');
    return;
  }

  try {
    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: ADMIN_USER_ID,
        messages: [
          {
            type: 'flex',
            altText: title,
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: title,
                    weight: 'bold',
                    size: 'lg'
                  }
                ]
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: contents.map(item => ({
                  type: 'text',
                  text: item,
                  size: 'sm',
                  wrap: true
                }))
              }
            }
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LINE Flex API error:', error);
    }
  } catch (error) {
    console.error('Failed to send LINE flex message:', error);
  }
}
