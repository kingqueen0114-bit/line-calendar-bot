/**
 * Agent Team Workflow Executor
 * 複雑なタスクを複数エージェントで協調実行
 */

import { AGENT_TEAM_CONFIG, getWorkflow } from './config.js';
import tracker from './tracker.js';

/**
 * ワークフローを実行
 */
export async function executeWorkflow(workflowName, context = {}) {
  const workflow = getWorkflow(workflowName);
  if (!workflow) {
    throw new Error(`Unknown workflow: ${workflowName}`);
  }

  const taskId = `wf-${Date.now()}`;
  await tracker.startTask(taskId, workflow.name, { workflow: workflowName, ...context });

  const results = [];

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const agent = AGENT_TEAM_CONFIG.agents[step.agent];

    console.log(`[Workflow] Step ${i + 1}/${workflow.steps.length}: ${step.action} (${agent.name})`);

    try {
      // ステップ実行（実際の実装では各エージェントを呼び出す）
      const result = {
        step: i + 1,
        agent: step.agent,
        action: step.action,
        success: true,
        timestamp: new Date().toISOString(),
      };

      await tracker.recordStep(taskId, step.action, step.agent, 'completed', true);
      results.push(result);
    } catch (error) {
      await tracker.recordStep(taskId, step.action, step.agent, error.message, false);
      await tracker.completeTask(taskId, 'failed', error.message);
      throw error;
    }
  }

  await tracker.completeTask(taskId, 'success');
  return results;
}

/**
 * クイックコマンド実行
 */
export const quickCommands = {
  // デプロイ
  deploy: async () => {
    return executeWorkflow('quickDeploy');
  },

  // 新機能追加
  newFeature: async (featureName) => {
    return executeWorkflow('newFeature', { feature: featureName });
  },

  // バグ修正
  bugFix: async (issueDescription) => {
    return executeWorkflow('bugFix', { issue: issueDescription });
  },

  // ステータス確認
  status: () => {
    return tracker.generateReport();
  },
};

/**
 * 推奨アクションを取得
 */
export function getRecommendedActions(taskDescription) {
  const category = require('./config.js').detectCategory(taskDescription);

  const recommendations = [];

  // カテゴリに基づく推奨
  switch (category.category) {
    case 'development':
      recommendations.push({
        action: '計画モードで開始',
        command: 'EnterPlanMode',
        reason: '複雑な実装は計画を立ててから',
      });
      break;

    case 'deployment':
      recommendations.push({
        action: 'クイックデプロイ',
        command: 'quickCommands.deploy()',
        reason: '標準デプロイワークフローを使用',
      });
      break;

    case 'investigation':
      recommendations.push({
        action: '探索エージェントを使用',
        command: 'Task (Explore)',
        reason: 'コードベースの効率的な探索',
      });
      break;

    case 'planning':
      recommendations.push({
        action: '計画エージェントを使用',
        command: 'Task (Plan)',
        reason: 'アーキテクチャ設計と計画策定',
      });
      break;
  }

  return {
    category: category.category,
    preferredAgent: category.preferredAgent,
    recommendations,
  };
}

export default {
  executeWorkflow,
  quickCommands,
  getRecommendedActions,
};
