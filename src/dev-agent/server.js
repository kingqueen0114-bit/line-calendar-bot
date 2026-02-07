/**
 * 自律開発エージェント - メインサーバー
 * Cloud Run上で24時間稼働し、GitHub WebhookやSchedulerからのリクエストを処理
 */

import express from 'express';
import { processGitHubWebhook, verifyGitHubSignature } from './github.js';
import { processTask, getTaskQueue, addTask, getTaskStats } from './task-processor.js';
import { sendLineNotification, sendDailySummary } from './line-reporter.js';

const app = express();

// Raw body for signature verification
app.use('/webhook/github', express.raw({ type: 'application/json' }));
app.use(express.json());

const PORT = process.env.PORT || 8081;

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'dev-agent',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// GitHub Webhook endpoint
app.post('/webhook/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    const body = req.body;

    // Verify signature
    if (!verifyGitHubSignature(body, signature)) {
      console.error('GitHub webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(body.toString());
    console.log(`Received GitHub event: ${event}`);

    // Process the webhook
    const result = await processGitHubWebhook(event, payload);

    if (result.task) {
      await addTask(result.task);
      await sendLineNotification(`📥 新しいタスク受信: ${result.task.title}`);
    }

    res.json({ status: 'ok', result });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cloud Scheduler trigger - 定期的なタスク処理
app.post('/trigger/process', async (req, res) => {
  try {
    console.log('Processing tasks from scheduler trigger');

    const queue = await getTaskQueue();
    if (queue.length === 0) {
      return res.json({ status: 'ok', message: 'No tasks to process' });
    }

    await sendLineNotification(`⚙️ タスク処理開始: ${queue.length}件のタスク`);

    const results = [];
    for (const task of queue.slice(0, 3)) { // 一度に最大3タスク処理
      try {
        const result = await processTask(task);
        results.push({ taskId: task.id, status: 'completed', result });
        await sendLineNotification(`✅ タスク完了: ${task.title}`);
      } catch (error) {
        results.push({ taskId: task.id, status: 'failed', error: error.message });
        await sendLineNotification(`❌ タスク失敗: ${task.title}\n${error.message}`);
      }
    }

    res.json({ status: 'ok', processed: results.length, results });
  } catch (error) {
    console.error('Task processing error:', error);
    await sendLineNotification(`🚨 エラー発生: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Manual task submission
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, type, priority } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description required' });
    }

    const task = {
      id: `task-${Date.now()}`,
      title,
      description,
      type: type || 'feature',
      priority: priority || 'medium',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await addTask(task);
    await sendLineNotification(`📝 手動タスク追加: ${title}`);

    res.json({ status: 'ok', task });
  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task queue status
app.get('/api/tasks', async (req, res) => {
  try {
    const queue = await getTaskQueue();
    res.json({ tasks: queue, count: queue.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Daily summary trigger
app.post('/trigger/daily-summary', async (req, res) => {
  try {
    console.log('Generating daily summary');
    const stats = await getTaskStats();
    await sendDailySummary(stats);
    res.json({ status: 'ok', stats });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Status endpoint for monitoring
app.get('/api/status', async (req, res) => {
  try {
    const queue = await getTaskQueue();
    res.json({
      status: 'running',
      pendingTasks: queue.filter(t => t.status === 'pending').length,
      processingTasks: queue.filter(t => t.status === 'processing').length,
      completedToday: queue.filter(t =>
        t.status === 'completed' &&
        t.completedAt?.startsWith(new Date().toISOString().split('T')[0])
      ).length,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Dev Agent server running on port ${PORT}`);
  sendLineNotification('🚀 自律開発エージェントが起動しました').catch(console.error);
});
