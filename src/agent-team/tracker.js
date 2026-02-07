/**
 * Agent Team Task Tracker
 * タスク実行を自動追跡し、パフォーマンスを最適化
 */

import { AGENT_TEAM_CONFIG, detectCategory } from './config.js';

class TaskTracker {
  constructor() {
    this.activeTasks = new Map();
    this.stepBuffer = [];
    this.project = AGENT_TEAM_CONFIG.project;
  }

  /**
   * タスク開始を記録
   */
  async startTask(taskId, taskName, metadata = {}) {
    const category = detectCategory(taskName);

    const task = {
      id: taskId,
      name: taskName,
      category: category.category,
      preferredAgent: category.preferredAgent,
      startTime: Date.now(),
      steps: [],
      metadata,
    };

    this.activeTasks.set(taskId, task);

    // MCP経由でタスク開始を記録
    console.log(`[AgentTeam] Task started: ${taskName} (${taskId})`);

    return task;
  }

  /**
   * ステップを記録
   */
  async recordStep(taskId, action, input, output, success) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const step = {
      action,
      input: input?.substring(0, 500), // 入力を短縮
      output: output?.substring(0, 500), // 出力を短縮
      success,
      duration: Date.now() - (task.lastStepTime || task.startTime),
      timestamp: new Date().toISOString(),
    };

    task.steps.push(step);
    task.lastStepTime = Date.now();

    console.log(`[AgentTeam] Step: ${action} - ${success ? '✓' : '✗'}`);

    return step;
  }

  /**
   * タスク完了を記録
   */
  async completeTask(taskId, status = 'success', error = null) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;
    task.status = status;
    task.error = error;

    // 完了したタスクを保存
    this.stepBuffer.push(task);

    // バッファが溜まったら分析
    if (this.stepBuffer.length >= 10) {
      await this.analyzePerformance();
    }

    this.activeTasks.delete(taskId);

    console.log(`[AgentTeam] Task ${status}: ${task.name} (${task.duration}ms)`);

    return task;
  }

  /**
   * パフォーマンス分析
   */
  async analyzePerformance() {
    if (this.stepBuffer.length === 0) return null;

    const analysis = {
      totalTasks: this.stepBuffer.length,
      successRate: this.stepBuffer.filter(t => t.status === 'success').length / this.stepBuffer.length,
      avgDuration: this.stepBuffer.reduce((sum, t) => sum + (t.duration || 0), 0) / this.stepBuffer.length,
      byCategory: {},
      failurePatterns: [],
    };

    // カテゴリ別分析
    for (const task of this.stepBuffer) {
      if (!analysis.byCategory[task.category]) {
        analysis.byCategory[task.category] = { count: 0, success: 0, totalDuration: 0 };
      }
      analysis.byCategory[task.category].count++;
      if (task.status === 'success') {
        analysis.byCategory[task.category].success++;
      }
      analysis.byCategory[task.category].totalDuration += task.duration || 0;
    }

    // 失敗パターン抽出
    const failures = this.stepBuffer.filter(t => t.status === 'failed');
    for (const failure of failures) {
      analysis.failurePatterns.push({
        task: failure.name,
        error: failure.error,
        steps: failure.steps.filter(s => !s.success).map(s => s.action),
      });
    }

    console.log('[AgentTeam] Performance Analysis:', JSON.stringify(analysis, null, 2));

    // バッファをクリア（最新10件は保持）
    this.stepBuffer = this.stepBuffer.slice(-10);

    return analysis;
  }

  /**
   * 現在のアクティブタスクを取得
   */
  getActiveTasks() {
    return Array.from(this.activeTasks.values());
  }

  /**
   * レポート生成
   */
  generateReport() {
    const active = this.getActiveTasks();
    const completed = this.stepBuffer;

    let report = '📊 Agent Team レポート\n\n';

    report += `【アクティブタスク】\n`;
    if (active.length === 0) {
      report += '  なし\n';
    } else {
      for (const task of active) {
        const elapsed = Math.round((Date.now() - task.startTime) / 1000);
        report += `  • ${task.name} (${elapsed}秒経過)\n`;
      }
    }

    report += `\n【最近完了したタスク】\n`;
    const recent = completed.slice(-5);
    if (recent.length === 0) {
      report += '  なし\n';
    } else {
      for (const task of recent) {
        const status = task.status === 'success' ? '✓' : '✗';
        report += `  ${status} ${task.name} (${Math.round(task.duration / 1000)}秒)\n`;
      }
    }

    return report;
  }
}

// シングルトンインスタンス
const tracker = new TaskTracker();

export default tracker;
export { TaskTracker };
