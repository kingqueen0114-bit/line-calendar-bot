/**
 * Agent Lightning Client for Node.js
 * LINE Calendar Bot から Agent Lightning API を呼び出すためのクライアント
 */

const AGL_API_URL = process.env.AGL_API_URL || 'http://localhost:8081';

/**
 * Agent Lightning API クライアント
 */
class AgentLightningClient {
  constructor(baseUrl = AGL_API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * APIリクエストを送信
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      // Agent Lightning サーバーが起動していない場合は静かに失敗
      if (error.cause?.code === 'ECONNREFUSED') {
        console.log('[AgentLightning] Server not available, skipping...');
        return null;
      }
      console.error('[AgentLightning] API Error:', error.message);
      return null;
    }
  }

  /**
   * ヘルスチェック
   */
  async healthCheck() {
    return this.request('/health');
  }

  /**
   * インタラクションを記録
   * @param {Object} params
   * @param {string} params.userId - ユーザーID
   * @param {string} params.taskType - タスクの種類
   * @param {string} params.userMessage - ユーザーのメッセージ
   * @param {string} params.botResponse - ボットの応答
   * @param {Object} [params.context] - 追加コンテキスト
   * @param {number} [params.reward] - 報酬値
   */
  async recordInteraction({ userId, taskType, userMessage, botResponse, context, reward }) {
    return this.request('/api/record', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        task_type: taskType,
        user_message: userMessage,
        bot_response: botResponse,
        context,
        reward,
      }),
    });
  }

  /**
   * 報酬を設定
   * @param {string} interactionId - インタラクションID
   * @param {number} reward - 報酬値 (-1.0 ~ 1.0)
   * @param {string} [feedback] - フィードバックテキスト
   */
  async setReward(interactionId, reward, feedback) {
    return this.request('/api/reward', {
      method: 'POST',
      body: JSON.stringify({
        interaction_id: interactionId,
        reward,
        feedback,
      }),
    });
  }

  /**
   * 統計を取得
   */
  async getStatistics() {
    return this.request('/api/stats');
  }

  /**
   * 最適化済みプロンプトを取得
   * @param {string} [taskType] - タスクの種類
   */
  async getPrompt(taskType) {
    const params = taskType ? `?task_type=${encodeURIComponent(taskType)}` : '';
    return this.request(`/api/prompt${params}`);
  }

  /**
   * 応答を分析
   * @param {string} userMessage - ユーザーのメッセージ
   * @param {string} botResponse - ボットの応答
   * @param {string} [taskType] - タスクの種類
   */
  async analyzeResponse(userMessage, botResponse, taskType) {
    return this.request('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        user_message: userMessage,
        bot_response: botResponse,
        task_type: taskType,
      }),
    });
  }

  /**
   * 最適化を実行
   * @param {Object} [options]
   * @param {number} [options.numIterations] - イテレーション数
   * @param {number} [options.minReward] - 最小報酬値
   */
  async runOptimization({ numIterations, minReward } = {}) {
    return this.request('/api/optimize', {
      method: 'POST',
      body: JSON.stringify({
        num_iterations: numIterations,
        min_reward: minReward,
      }),
    });
  }

  /**
   * 最適化履歴を取得
   */
  async getOptimizationHistory() {
    return this.request('/api/history');
  }

  /**
   * タスクタイプ一覧を取得
   */
  async getTaskTypes() {
    return this.request('/api/task-types');
  }
}

// タスクタイプの判定ヘルパー
const TASK_PATTERNS = {
  calendar_create: [
    /予定.*(?:入れ|登録|追加|作成)/,
    /(?:入れ|登録|追加|作成).*予定/,
    /スケジュール.*(?:入れ|登録|追加)/,
    /(?:明日|今日|来週|.*日).*(?:時|午前|午後)/,
  ],
  calendar_query: [
    /予定.*(?:教え|確認|見せ|表示)/,
    /(?:今日|明日|今週|来週).*予定/,
    /スケジュール.*(?:教え|確認)/,
  ],
  task_create: [
    /タスク.*(?:追加|作成|登録)/,
    /(?:買い物|やること).*(?:追加|リスト)/,
    /(?:追加|登録).*タスク/,
    /TODO/i,
  ],
  task_complete: [
    /タスク.*(?:完了|終了|済み)/,
    /(?:完了|終わっ|済み)/,
  ],
  reminder_set: [
    /リマインダー.*(?:設定|追加)/,
    /通知.*(?:設定|追加)/,
    /(?:時間|分).*(?:前|後).*(?:通知|教え)/,
  ],
};

/**
 * メッセージからタスクタイプを推定
 * @param {string} message - ユーザーメッセージ
 * @returns {string} タスクタイプ
 */
function detectTaskType(message) {
  for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return taskType;
      }
    }
  }
  return 'general_query';
}

/**
 * ボット応答から自動的に報酬を推定
 * @param {string} response - ボットの応答
 * @returns {number} 推定報酬値
 */
function estimateReward(response) {
  if (!response || response.length === 0) {
    return -0.5;
  }

  let reward = 0;

  // 成功インジケーター
  const successKeywords = ['完了', '登録', '作成', '設定', '追加', '削除', '✅', '📅'];
  if (successKeywords.some(kw => response.includes(kw))) {
    reward += 0.4;
  }

  // エラーインジケーター
  const errorKeywords = ['エラー', '失敗', 'できません', '見つかりません'];
  if (errorKeywords.some(kw => response.includes(kw))) {
    reward -= 0.3;
  }

  // 適切な長さ
  if (response.length >= 10 && response.length <= 200) {
    reward += 0.2;
  }

  // 絵文字（親しみやすさ）
  if (/[\u{1F300}-\u{1F9FF}]/u.test(response)) {
    reward += 0.1;
  }

  return Math.max(-1, Math.min(1, reward));
}

// シングルトンインスタンス
let clientInstance = null;

/**
 * Agent Lightning クライアントを取得
 * @returns {AgentLightningClient}
 */
function getClient() {
  if (!clientInstance) {
    clientInstance = new AgentLightningClient();
  }
  return clientInstance;
}

// エクスポート
export {
  AgentLightningClient,
  getClient,
  detectTaskType,
  estimateReward,
};

export default AgentLightningClient;
