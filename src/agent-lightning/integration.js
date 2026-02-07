/**
 * Agent Lightning Integration for LINE Calendar Bot
 * LINE Bot のメッセージ処理に Agent Lightning を統合
 */

import { getClient, detectTaskType, estimateReward } from './client.js';

// Agent Lightning クライアント
const aglClient = getClient();

/**
 * メッセージ処理をラップして Agent Lightning にデータを記録
 *
 * @param {Function} originalHandler - 元のメッセージハンドラー
 * @returns {Function} ラップされたハンドラー
 */
export function wrapMessageHandler(originalHandler) {
  return async function wrappedHandler(event, env, ctx) {
    const userId = event.source.userId;
    const userMessage = event.message?.text || '';
    const startTime = Date.now();

    // 元のハンドラーを実行
    let result;
    let botResponse = '';
    let error = null;

    try {
      result = await originalHandler(event, env, ctx);

      // レスポンスを取得（ハンドラーが返す場合）
      if (typeof result === 'string') {
        botResponse = result;
      }
    } catch (err) {
      error = err;
      botResponse = `エラー: ${err.message}`;
      throw err;
    } finally {
      // Agent Lightning にインタラクションを記録
      try {
        const taskType = detectTaskType(userMessage);
        const reward = error ? -0.5 : estimateReward(botResponse);

        await aglClient.recordInteraction({
          userId,
          taskType,
          userMessage,
          botResponse,
          context: {
            processingTime: Date.now() - startTime,
            hasError: !!error,
            eventType: event.type,
            messageType: event.message?.type,
          },
          reward,
        });
      } catch (recordError) {
        // 記録に失敗しても処理は継続
        console.log('[AgentLightning] Failed to record interaction:', recordError.message);
      }
    }

    return result;
  };
}

/**
 * Gemini 応答をラップして Agent Lightning にデータを記録
 *
 * @param {Function} parseEventText - 元の parseEventText 関数
 * @returns {Function} ラップされた関数
 */
export function wrapParseEventText(parseEventText) {
  return async function wrappedParseEventText(text, ...args) {
    const startTime = Date.now();

    try {
      const result = await parseEventText(text, ...args);

      // AI パース結果を分析
      await aglClient.analyzeResponse(text, JSON.stringify(result), 'calendar_parse');

      return result;
    } catch (error) {
      // エラー時も記録
      await aglClient.recordInteraction({
        userId: 'system',
        taskType: 'ai_parse_error',
        userMessage: text,
        botResponse: error.message,
        reward: -1.0,
      });
      throw error;
    }
  };
}

/**
 * ユーザーフィードバックを処理
 * ユーザーが「いいね」や「よくなかった」と送信した場合に報酬を更新
 *
 * @param {string} userId - ユーザーID
 * @param {string} feedback - フィードバックメッセージ
 * @param {string} lastInteractionId - 直前のインタラクションID
 */
export async function processFeedback(userId, feedback, lastInteractionId) {
  if (!lastInteractionId) return;

  const positiveFeedback = ['いいね', 'ありがとう', '完璧', '助かった', 'OK', 'GOOD', '👍', '😊'];
  const negativeFeedback = ['違う', 'ダメ', '間違い', 'やり直し', '❌', '😞'];

  const feedbackLower = feedback.toLowerCase();

  let reward = null;
  let feedbackType = null;

  if (positiveFeedback.some(p => feedbackLower.includes(p.toLowerCase()))) {
    reward = 1.0;
    feedbackType = 'positive';
  } else if (negativeFeedback.some(n => feedbackLower.includes(n.toLowerCase()))) {
    reward = -0.5;
    feedbackType = 'negative';
  }

  if (reward !== null) {
    await aglClient.setReward(lastInteractionId, reward, feedbackType);
    console.log(`[AgentLightning] Feedback recorded: ${feedbackType} (${reward})`);
  }
}

/**
 * 最適化を手動でトリガー（管理者コマンド用）
 */
export async function triggerOptimization() {
  console.log('[AgentLightning] Starting optimization...');

  const result = await aglClient.runOptimization({
    numIterations: 100,
    minReward: 0.0,
  });

  if (result) {
    console.log('[AgentLightning] Optimization completed:', result);
    return result;
  }

  return null;
}

/**
 * 統計レポートを生成
 */
export async function generateReport() {
  const stats = await aglClient.getStatistics();
  const history = await aglClient.getOptimizationHistory();

  if (!stats) {
    return '⚠️ Agent Lightning サーバーに接続できません';
  }

  let report = '📊 Agent Lightning レポート\n\n';
  report += `総インタラクション数: ${stats.total_interactions}\n`;
  report += `報酬付きデータ: ${stats.rewarded_count}\n`;
  report += `平均報酬: ${stats.average_reward?.toFixed(3) || 'N/A'}\n\n`;

  report += '【タスク別】\n';
  for (const [task, count] of Object.entries(stats.interactions_by_task || {})) {
    report += `  ${task}: ${count}件\n`;
  }

  if (history && history.total_runs > 0) {
    report += `\n最適化実行回数: ${history.total_runs}回`;
  }

  return report;
}

/**
 * Agent Lightning の状態を確認
 */
export async function checkHealth() {
  const health = await aglClient.healthCheck();
  return {
    available: !!health,
    status: health?.status || 'unavailable',
    timestamp: health?.timestamp || new Date().toISOString(),
  };
}

// 直前のインタラクションIDを保存（フィードバック用）
const lastInteractionIds = new Map();

/**
 * 直前のインタラクションIDを設定
 */
export function setLastInteractionId(userId, interactionId) {
  lastInteractionIds.set(userId, interactionId);
}

/**
 * 直前のインタラクションIDを取得
 */
export function getLastInteractionId(userId) {
  return lastInteractionIds.get(userId);
}

export default {
  wrapMessageHandler,
  wrapParseEventText,
  processFeedback,
  triggerOptimization,
  generateReport,
  checkHealth,
  setLastInteractionId,
  getLastInteractionId,
};
