/**
 * Agent Team Configuration
 * 複数のエージェントを効果的に連携させる設定
 */

export const AGENT_TEAM_CONFIG = {
  // プロジェクト識別子
  project: 'line-calendar-bot',

  // エージェントロール定義
  agents: {
    // コード探索エージェント
    explorer: {
      name: 'Explorer',
      description: 'コードベースの探索と理解',
      tasks: ['ファイル検索', 'コード分析', '依存関係調査'],
      subagent_type: 'Explore',
    },

    // 計画エージェント
    planner: {
      name: 'Planner',
      description: '実装計画の策定',
      tasks: ['要件分析', 'アーキテクチャ設計', 'タスク分解'],
      subagent_type: 'Plan',
    },

    // 実行エージェント
    executor: {
      name: 'Executor',
      description: 'コマンド実行とデプロイ',
      tasks: ['ビルド', 'テスト', 'デプロイ', 'Git操作'],
      subagent_type: 'Bash',
    },

    // 汎用エージェント
    general: {
      name: 'General',
      description: '複雑なマルチステップタスク',
      tasks: ['リファクタリング', 'バグ修正', '機能追加'],
      subagent_type: 'general-purpose',
    },
  },

  // タスクカテゴリとマッピング
  taskCategories: {
    development: {
      patterns: ['実装', '追加', '修正', 'fix', 'add', 'implement'],
      preferredAgent: 'general',
      trackSteps: true,
    },
    deployment: {
      patterns: ['デプロイ', 'deploy', 'リリース', 'release', 'push'],
      preferredAgent: 'executor',
      trackSteps: true,
    },
    investigation: {
      patterns: ['調査', '確認', '探す', 'find', 'search', 'where'],
      preferredAgent: 'explorer',
      trackSteps: false,
    },
    planning: {
      patterns: ['計画', '設計', 'plan', 'design', 'アーキテクチャ'],
      preferredAgent: 'planner',
      trackSteps: true,
    },
  },

  // ワークフロー定義
  workflows: {
    // 新機能追加ワークフロー
    newFeature: {
      name: '新機能追加',
      steps: [
        { agent: 'explorer', action: '既存コードの調査' },
        { agent: 'planner', action: '実装計画の策定' },
        { agent: 'general', action: 'コード実装' },
        { agent: 'executor', action: 'テスト実行' },
        { agent: 'executor', action: 'デプロイ' },
      ],
    },

    // バグ修正ワークフロー
    bugFix: {
      name: 'バグ修正',
      steps: [
        { agent: 'explorer', action: '問題箇所の特定' },
        { agent: 'general', action: '修正実装' },
        { agent: 'executor', action: 'テスト確認' },
        { agent: 'executor', action: 'デプロイ' },
      ],
    },

    // クイックデプロイ
    quickDeploy: {
      name: 'クイックデプロイ',
      steps: [
        { agent: 'executor', action: 'Git コミット' },
        { agent: 'executor', action: 'Git プッシュ' },
        { agent: 'executor', action: 'Cloud Run デプロイ' },
      ],
    },
  },

  // トラッキング設定
  tracking: {
    enabled: true,
    recordSteps: true,
    analyzeFailures: true,
    optimizationInterval: 100, // 100タスクごとに最適化
  },
};

/**
 * タスクカテゴリを検出
 */
export function detectCategory(taskDescription) {
  const desc = taskDescription.toLowerCase();

  for (const [category, config] of Object.entries(AGENT_TEAM_CONFIG.taskCategories)) {
    if (config.patterns.some(p => desc.includes(p.toLowerCase()))) {
      return { category, ...config };
    }
  }

  return { category: 'general', preferredAgent: 'general', trackSteps: true };
}

/**
 * ワークフローを取得
 */
export function getWorkflow(workflowName) {
  return AGENT_TEAM_CONFIG.workflows[workflowName];
}

export default AGENT_TEAM_CONFIG;
