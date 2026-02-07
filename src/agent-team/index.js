/**
 * Agent Team - エージェントチーム統合モジュール
 *
 * 複数のエージェントを効果的に連携させ、
 * タスク実行を追跡・最適化するシステム
 */

export { AGENT_TEAM_CONFIG, detectCategory, getWorkflow } from './config.js';
export { default as tracker, TaskTracker } from './tracker.js';
export { executeWorkflow, quickCommands, getRecommendedActions } from './workflow.js';

/**
 * Agent Team 初期化
 */
export function initAgentTeam() {
  console.log('[AgentTeam] Initialized');
  console.log(`[AgentTeam] Project: ${require('./config.js').AGENT_TEAM_CONFIG.project}`);
  console.log(`[AgentTeam] Agents: ${Object.keys(require('./config.js').AGENT_TEAM_CONFIG.agents).join(', ')}`);

  return {
    config: require('./config.js').AGENT_TEAM_CONFIG,
    tracker: require('./tracker.js').default,
    workflow: require('./workflow.js'),
  };
}

export default initAgentTeam;
