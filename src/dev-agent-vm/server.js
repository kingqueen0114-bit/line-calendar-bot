/**
 * Dev Agent VM Server - Multi-Project Version
 * 複数プロジェクト対応の自律開発エージェント
 *
 * Claude Proアカウントで複数リポジトリを処理
 */

import express from 'express';
import { spawn, execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const app = express();

app.use('/webhook/github', express.raw({ type: 'application/json' }));
app.use(express.json());

const PORT = process.env.PORT || 8080;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
const REPOS_BASE_PATH = process.env.REPOS_BASE_PATH || '/home/dev-agent/repos';
const ALLOWED_TOOLS = 'Bash,Read,Write,Edit,Glob,Grep,Task';

// Task queue
let taskQueue = [];
let isProcessing = false;
const QUEUE_FILE = '/home/dev-agent/task-queue.json';

// Project registry - tracks all managed projects
let projects = {};
const PROJECTS_FILE = '/home/dev-agent/projects.json';

// Load data on startup
async function loadData() {
  try {
    const queueData = await fs.readFile(QUEUE_FILE, 'utf-8');
    taskQueue = JSON.parse(queueData);
    console.log(`Loaded ${taskQueue.length} tasks`);
  } catch {
    taskQueue = [];
  }

  try {
    const projectsData = await fs.readFile(PROJECTS_FILE, 'utf-8');
    projects = JSON.parse(projectsData);
    console.log(`Loaded ${Object.keys(projects).length} projects`);
  } catch {
    projects = {};
  }
}

async function saveQueue() {
  await fs.writeFile(QUEUE_FILE, JSON.stringify(taskQueue, null, 2));
}

async function saveProjects() {
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// LINE notification
async function sendLineNotification(message) {
  if (!LINE_CHANNEL_ACCESS_TOKEN || !ADMIN_USER_ID) {
    console.log('LINE:', message);
    return;
  }

  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: ADMIN_USER_ID,
        messages: [{ type: 'text', text: message.slice(0, 2000) }]
      })
    });
  } catch (error) {
    console.error('LINE error:', error.message);
  }
}

// Verify GitHub webhook
function verifyGitHubSignature(payload, signature) {
  if (!GITHUB_WEBHOOK_SECRET || !signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Get or create project
async function getOrCreateProject(owner, repo, cloneUrl) {
  const projectKey = `${owner}/${repo}`;
  const repoPath = path.join(REPOS_BASE_PATH, owner, repo);

  if (!projects[projectKey]) {
    console.log(`New project: ${projectKey}`);

    // Create directory
    await fs.mkdir(path.dirname(repoPath), { recursive: true });

    // Clone if not exists
    try {
      await fs.access(repoPath);
      console.log(`Repository exists: ${repoPath}`);
    } catch {
      console.log(`Cloning: ${cloneUrl}`);
      execSync(`git clone ${cloneUrl} ${repoPath}`, { stdio: 'inherit' });
    }

    projects[projectKey] = {
      owner,
      repo,
      path: repoPath,
      cloneUrl,
      addedAt: new Date().toISOString(),
      taskCount: 0
    };
    await saveProjects();

    await sendLineNotification(`📁 新規プロジェクト登録\n${projectKey}`);
  }

  return projects[projectKey];
}

// Run Claude Code
async function runClaudeCode(prompt, cwd) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--allowedTools', ALLOWED_TOOLS, '--dangerously-skip-permissions'];

    console.log(`\n[Claude Code] ${cwd}\n$ claude ${args.slice(0, 2).join(' ')}...`);

    const proc = spawn('claude', args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Timeout (10min)'));
    }, 10 * 60 * 1000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Exit code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Run shell command
function runShell(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    throw new Error(`Shell error: ${error.message}`);
  }
}

// Process task
async function processTask(task) {
  const project = projects[task.project];
  if (!project) {
    throw new Error(`Project not found: ${task.project}`);
  }

  const repoPath = project.path;
  console.log(`\n${'='.repeat(60)}\nProcessing: ${task.title}\nProject: ${task.project}\n${'='.repeat(60)}`);

  task.status = 'processing';
  task.startedAt = new Date().toISOString();
  await saveQueue();

  await sendLineNotification(`⚙️ タスク開始\n📁 ${task.project}\n📋 ${task.title}`);

  try {
    // Update repo
    runShell('git fetch origin', repoPath);
    runShell('git checkout main || git checkout master', repoPath);
    runShell('git pull', repoPath);

    // Create branch
    const branchName = `auto/${task.type || 'feature'}/${task.id}`;
    try {
      runShell(`git checkout -b ${branchName}`, repoPath);
    } catch {
      runShell(`git checkout ${branchName}`, repoPath);
      runShell('git pull origin ' + branchName + ' || true', repoPath);
    }

    // Build prompt
    const prompt = `あなたは自律開発エージェントです。以下のタスクを実装してください。

## プロジェクト
リポジトリ: ${task.project}

## タスク
タイトル: ${task.title}
タイプ: ${task.type || 'feature'}

## 説明
${task.description || '説明なし'}

## 指示
1. 必要なファイルを読んでコードベースを理解
2. 実装計画を立てる
3. コードを実装
4. 変更を確認

注意:
- セキュリティに配慮
- 既存スタイルに従う
- 最小限の変更
${task.issueUrl ? `\n関連Issue: ${task.issueUrl}` : ''}`;

    // Run Claude Code
    await runClaudeCode(prompt, repoPath);

    // Check changes
    const status = runShell('git status --porcelain', repoPath).trim();

    if (status) {
      // Commit and push
      runShell('git add -A', repoPath);
      runShell(`git commit -m "[Auto] ${task.title}"`, repoPath);
      runShell(`git push -u origin ${branchName}`, repoPath);

      // Create PR
      const prResult = runShell(
        `gh pr create --title "[Auto] ${task.title}" --body "🤖 自動生成 by Dev Agent\n\nTask: ${task.title}\n\n${task.description || ''}" --base main || echo "PR exists"`,
        repoPath
      );

      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = 'PR created';

      await sendLineNotification(`✅ 完了: ${task.title}\n📁 ${task.project}\n🔀 PRを作成しました`);
    } else {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = 'No changes needed';

      await sendLineNotification(`✅ 完了: ${task.title}\n📁 ${task.project}\n変更なし`);
    }

    // Return to main
    runShell('git checkout main || git checkout master', repoPath);

  } catch (error) {
    console.error('Task error:', error);
    task.status = 'failed';
    task.error = error.message;
    task.failedAt = new Date().toISOString();

    await sendLineNotification(`❌ 失敗: ${task.title}\n📁 ${task.project}\n${error.message.slice(0, 200)}`);

    try {
      runShell('git checkout main || git checkout master', repoPath);
    } catch {}
  }

  // Update project stats
  project.taskCount = (project.taskCount || 0) + 1;
  project.lastTaskAt = new Date().toISOString();
  await saveProjects();
  await saveQueue();
}

// Process queue
async function processQueue() {
  if (isProcessing) return;

  const pending = taskQueue.filter(t => t.status === 'pending');
  if (pending.length === 0) return;

  isProcessing = true;

  try {
    for (const task of pending.slice(0, 2)) {
      await processTask(task);
    }
  } finally {
    isProcessing = false;
  }
}

// === API Routes ===

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'dev-agent-vm',
    version: '2.0.0',
    multiProject: true,
    projects: Object.keys(projects).length,
    pendingTasks: taskQueue.filter(t => t.status === 'pending').length,
    processing: isProcessing,
    timestamp: new Date().toISOString()
  });
});

// GitHub Webhook
app.post('/webhook/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];

    if (!verifyGitHubSignature(req.body, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(req.body.toString());
    const repo = payload.repository;
    console.log(`\nWebhook: ${event} from ${repo.full_name}`);

    // Register/update project
    await getOrCreateProject(repo.owner.login, repo.name, repo.clone_url);

    // Handle issues with auto-dev label
    if (event === 'issues' && (payload.action === 'labeled' || payload.action === 'opened')) {
      const hasAutoLabel = payload.issue.labels?.some(
        l => l.name === 'auto-dev' || l.name === 'claude-agent'
      );

      if (hasAutoLabel) {
        const task = {
          id: `issue-${payload.issue.number}-${Date.now()}`,
          project: repo.full_name,
          title: payload.issue.title,
          description: payload.issue.body,
          type: getIssueType(payload.issue),
          source: 'github-issue',
          issueNumber: payload.issue.number,
          issueUrl: payload.issue.html_url,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        taskQueue.push(task);
        await saveQueue();
        await sendLineNotification(`📥 新規タスク\n📁 ${repo.full_name}\n📋 ${task.title}`);

        setImmediate(processQueue);
      }
    }

    // Handle @dev-agent mentions
    if (event === 'issue_comment' && payload.action === 'created') {
      const body = payload.comment.body || '';
      if (body.includes('@dev-agent') || body.includes('@claude-agent')) {
        const task = {
          id: `comment-${payload.comment.id}`,
          project: repo.full_name,
          title: `#${payload.issue.number}: ${body.slice(0, 50)}...`,
          description: body,
          type: 'comment-request',
          source: 'github-comment',
          issueNumber: payload.issue.number,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        taskQueue.push(task);
        await saveQueue();
        await sendLineNotification(`📥 コメントリクエスト\n📁 ${repo.full_name}\n#${payload.issue.number}`);

        setImmediate(processQueue);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scheduler trigger
app.post('/trigger/process', async (req, res) => {
  console.log('Scheduler trigger');
  setImmediate(processQueue);
  res.json({
    status: 'ok',
    pending: taskQueue.filter(t => t.status === 'pending').length
  });
});

// List projects
app.get('/api/projects', (req, res) => {
  res.json({
    projects: Object.values(projects),
    count: Object.keys(projects).length
  });
});

// Add project manually
app.post('/api/projects', async (req, res) => {
  try {
    const { owner, repo, cloneUrl } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'owner and repo required' });
    }

    const url = cloneUrl || `https://github.com/${owner}/${repo}.git`;
    const project = await getOrCreateProject(owner, repo, url);

    res.json({ status: 'ok', project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List tasks
app.get('/api/tasks', (req, res) => {
  const { project, status } = req.query;
  let filtered = taskQueue;

  if (project) {
    filtered = filtered.filter(t => t.project === project);
  }
  if (status) {
    filtered = filtered.filter(t => t.status === status);
  }

  res.json({
    tasks: filtered.slice(-50),
    total: filtered.length,
    pending: taskQueue.filter(t => t.status === 'pending').length,
    processing: taskQueue.filter(t => t.status === 'processing').length
  });
});

// Add task manually
app.post('/api/tasks', async (req, res) => {
  try {
    const { project, title, description, type } = req.body;

    if (!project || !title) {
      return res.status(400).json({ error: 'project and title required' });
    }

    if (!projects[project]) {
      return res.status(400).json({ error: `Project not registered: ${project}` });
    }

    const task = {
      id: `manual-${Date.now()}`,
      project,
      title,
      description: description || '',
      type: type || 'feature',
      source: 'manual',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    taskQueue.push(task);
    await saveQueue();
    await sendLineNotification(`📝 手動タスク\n📁 ${project}\n📋 ${title}`);

    setImmediate(processQueue);

    res.json({ status: 'ok', task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup old tasks
app.delete('/api/tasks/cleanup', async (req, res) => {
  const before = taskQueue.length;
  taskQueue = taskQueue.filter(t =>
    t.status === 'pending' || t.status === 'processing'
  );
  await saveQueue();
  res.json({ removed: before - taskQueue.length, remaining: taskQueue.length });
});

function getIssueType(issue) {
  const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
  if (labels.includes('bug')) return 'bugfix';
  if (labels.includes('enhancement') || labels.includes('feature')) return 'feature';
  if (labels.includes('refactor')) return 'refactor';
  if (labels.includes('docs')) return 'docs';
  return 'feature';
}

// Start
loadData().then(() => {
  // Ensure repos directory exists
  fs.mkdir(REPOS_BASE_PATH, { recursive: true }).catch(() => {});

  app.listen(PORT, () => {
    console.log(`\nDev Agent VM (Multi-Project) running on port ${PORT}`);
    console.log(`Projects: ${Object.keys(projects).length}`);
    console.log(`Pending tasks: ${taskQueue.filter(t => t.status === 'pending').length}\n`);
    sendLineNotification(`🚀 Dev Agent VM 起動\n📁 ${Object.keys(projects).length} プロジェクト`);
  });
});
