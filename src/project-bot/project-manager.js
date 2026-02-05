/**
 * プロジェクト管理・進捗報告システム
 * LINEで進捗確認とClaudeとのやり取りが可能
 */

// プロジェクトフェーズ定義
const PROJECT_PHASES = {
  PHASE1: {
    id: 'phase1',
    name: 'CI/CD自動デプロイ構築',
    tasks: [
      { id: 'p1-1', name: 'GitHub Actions設定', status: 'pending' },
      { id: 'p1-2', name: 'Cloud Buildトリガー', status: 'pending' },
      { id: 'p1-3', name: '環境分離（本番/ステージング）', status: 'pending' },
      { id: 'p1-4', name: '自動テスト設定', status: 'pending' }
    ]
  },
  PHASE2: {
    id: 'phase2',
    name: 'LINEモックサーバー構築',
    tasks: [
      { id: 'p2-1', name: 'Webhookシミュレーター', status: 'pending' },
      { id: 'p2-2', name: 'メッセージ送信モック', status: 'pending' },
      { id: 'p2-3', name: 'テストUI作成', status: 'pending' },
      { id: 'p2-4', name: '自動テストスクリプト', status: 'pending' }
    ]
  },
  PHASE3: {
    id: 'phase3',
    name: 'セキュリティ強化',
    tasks: [
      { id: 'p3-1', name: 'Cloud Armor設定', status: 'pending' },
      { id: 'p3-2', name: 'レート制限実装', status: 'pending' },
      { id: 'p3-3', name: 'Secret Manager統合', status: 'pending' },
      { id: 'p3-4', name: '監査ログ設定', status: 'pending' }
    ]
  },
  PHASE4: {
    id: 'phase4',
    name: '監視・アラート',
    tasks: [
      { id: 'p4-1', name: 'Monitoringダッシュボード', status: 'pending' },
      { id: 'p4-2', name: 'エラーアラート設定', status: 'pending' },
      { id: 'p4-3', name: 'パフォーマンス監視', status: 'pending' },
      { id: 'p4-4', name: 'コスト監視', status: 'pending' }
    ]
  }
};

/**
 * プロジェクト進捗を取得
 */
export async function getProjectProgress(env) {
  const progress = await env.NOTIFICATIONS.get('project_progress', { type: 'json' });
  return progress || JSON.parse(JSON.stringify(PROJECT_PHASES));
}

/**
 * プロジェクト進捗を保存
 */
export async function saveProjectProgress(progress, env) {
  await env.NOTIFICATIONS.put('project_progress', JSON.stringify(progress));
}

/**
 * タスクのステータスを更新
 */
export async function updateTaskStatus(phaseId, taskId, status, env) {
  const progress = await getProjectProgress(env);
  const phase = Object.values(progress).find(p => p.id === phaseId);
  if (phase) {
    const task = phase.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date().toISOString();
      await saveProjectProgress(progress, env);
      return true;
    }
  }
  return false;
}

/**
 * 進捗サマリーを生成
 */
export async function generateProgressSummary(env) {
  const progress = await getProjectProgress(env);

  let summary = '📊 プロジェクト進捗状況\n';
  summary += '━━━━━━━━━━━━━━━━\n\n';

  let totalTasks = 0;
  let completedTasks = 0;
  let inProgressTasks = 0;

  for (const phase of Object.values(progress)) {
    const phaseTasks = phase.tasks.length;
    const phaseCompleted = phase.tasks.filter(t => t.status === 'completed').length;
    const phaseInProgress = phase.tasks.filter(t => t.status === 'in_progress').length;

    totalTasks += phaseTasks;
    completedTasks += phaseCompleted;
    inProgressTasks += phaseInProgress;

    const phaseProgress = Math.round((phaseCompleted / phaseTasks) * 100);
    const progressBar = generateProgressBar(phaseProgress);

    summary += `【${phase.name}】\n`;
    summary += `${progressBar} ${phaseProgress}%\n`;
    summary += `完了: ${phaseCompleted}/${phaseTasks}`;
    if (phaseInProgress > 0) {
      summary += ` | 進行中: ${phaseInProgress}`;
    }
    summary += '\n\n';
  }

  const overallProgress = Math.round((completedTasks / totalTasks) * 100);
  summary += '━━━━━━━━━━━━━━━━\n';
  summary += `🎯 全体進捗: ${overallProgress}% (${completedTasks}/${totalTasks}タスク完了)\n`;

  if (inProgressTasks > 0) {
    summary += `🔄 進行中: ${inProgressTasks}タスク`;
  }

  return summary;
}

/**
 * 詳細進捗を生成
 */
export async function generateDetailedProgress(phaseId, env) {
  const progress = await getProjectProgress(env);
  const phase = Object.values(progress).find(p => p.id === phaseId);

  if (!phase) {
    return '指定されたフェーズが見つかりません。';
  }

  let detail = `📋 ${phase.name}\n`;
  detail += '━━━━━━━━━━━━━━━━\n\n';

  for (const task of phase.tasks) {
    const statusIcon = getStatusIcon(task.status);
    detail += `${statusIcon} ${task.name}\n`;
    if (task.updatedAt) {
      const date = new Date(task.updatedAt);
      detail += `   更新: ${date.toLocaleDateString('ja-JP')}\n`;
    }
  }

  return detail;
}

/**
 * プログレスバーを生成
 */
function generateProgressBar(percent) {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

/**
 * ステータスアイコンを取得
 */
function getStatusIcon(status) {
  switch (status) {
    case 'completed': return '✅';
    case 'in_progress': return '🔄';
    case 'blocked': return '🚫';
    default: return '⬜';
  }
}

/**
 * 活動ログを追加
 */
export async function addActivityLog(activity, env) {
  const logsKey = 'project_activity_logs';
  const logs = await env.NOTIFICATIONS.get(logsKey, { type: 'json' }) || [];

  logs.unshift({
    timestamp: new Date().toISOString(),
    activity: activity
  });

  // 最新100件のみ保持
  if (logs.length > 100) {
    logs.splice(100);
  }

  await env.NOTIFICATIONS.put(logsKey, JSON.stringify(logs));
}

/**
 * 最近の活動ログを取得
 */
export async function getRecentActivityLogs(limit, env) {
  const logs = await env.NOTIFICATIONS.get('project_activity_logs', { type: 'json' }) || [];
  return logs.slice(0, limit);
}

/**
 * メッセージを記録（Claudeとの会話用）
 */
export async function saveMessageForClaude(message, env) {
  const key = 'claude_messages';
  const messages = await env.NOTIFICATIONS.get(key, { type: 'json' }) || [];

  messages.push({
    timestamp: new Date().toISOString(),
    message: message
  });

  // 最新50件のみ保持
  if (messages.length > 50) {
    messages.splice(0, messages.length - 50);
  }

  await env.NOTIFICATIONS.put(key, JSON.stringify(messages));

  return `📝 メッセージを記録しました\n\n「${message}」\n\nClaude Codeで確認できます。`;
}

/**
 * 記録されたメッセージを取得
 */
export async function getMessagesForClaude(env) {
  const messages = await env.NOTIFICATIONS.get('claude_messages', { type: 'json' }) || [];
  return messages;
}

/**
 * コマンドをパース
 */
export function parseProjectCommand(text) {
  const lowerText = text.toLowerCase();

  // 進捗確認
  if (lowerText.includes('進捗') || lowerText.includes('status') || lowerText.includes('しんちょく')) {
    if (lowerText.includes('phase1') || lowerText.includes('cicd') || lowerText.includes('デプロイ')) {
      return { command: 'detail', phase: 'phase1' };
    }
    if (lowerText.includes('phase2') || lowerText.includes('モック') || lowerText.includes('mock')) {
      return { command: 'detail', phase: 'phase2' };
    }
    if (lowerText.includes('phase3') || lowerText.includes('セキュリティ')) {
      return { command: 'detail', phase: 'phase3' };
    }
    if (lowerText.includes('phase4') || lowerText.includes('監視')) {
      return { command: 'detail', phase: 'phase4' };
    }
    return { command: 'summary' };
  }

  // タスク完了
  if (lowerText.includes('完了') && lowerText.includes('タスク')) {
    const match = text.match(/([a-z]\d+-\d+)/i);
    if (match) {
      return { command: 'complete', taskId: match[1].toLowerCase() };
    }
  }

  // タスク開始
  if (lowerText.includes('開始') && lowerText.includes('タスク')) {
    const match = text.match(/([a-z]\d+-\d+)/i);
    if (match) {
      return { command: 'start', taskId: match[1].toLowerCase() };
    }
  }

  // ヘルプ
  if (lowerText.includes('ヘルプ') || lowerText === 'help' || lowerText === '?') {
    return { command: 'help' };
  }

  // Claudeに相談（デフォルト）
  return { command: 'claude', message: text };
}

/**
 * ヘルプメッセージを生成
 */
export function getHelpMessage() {
  return `📖 プロジェクト管理コマンド

【進捗確認】
・「進捗」- 全体の進捗を表示
・「Phase1 進捗」- CI/CDの詳細
・「Phase2 進捗」- モックサーバーの詳細
・「Phase3 進捗」- セキュリティの詳細
・「Phase4 進捗」- 監視の詳細

【タスク管理】
・「タスク開始 p1-1」- タスクを開始
・「タスク完了 p1-1」- タスクを完了

【Claude連携】
・メッセージを入力 → 記録されClaude Codeで確認可能
・「ヘルプ」- このメッセージを表示`;
}
