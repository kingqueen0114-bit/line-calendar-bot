/**
 * LINE Bot Commands for Dev Agent
 * スマホから操作するためのLINEコマンド処理
 */

const DEV_AGENT_URL = process.env.DEV_AGENT_URL || 'http://localhost:8080';

/**
 * Parse LINE message and execute command
 */
export async function handleDevAgentCommand(message) {
  const text = message.trim().toLowerCase();

  // Status check
  if (text === '状況' || text === 'status' || text === 'ステータス') {
    return await getStatus();
  }

  // List projects
  if (text === 'プロジェクト' || text === 'projects' || text === 'プロジェクト一覧') {
    return await getProjects();
  }

  // List tasks
  if (text === 'タスク' || text === 'tasks' || text === 'タスク一覧') {
    return await getTasks();
  }

  // Add task: タスク追加: プロジェクト名 タスク内容
  if (text.startsWith('タスク追加:') || text.startsWith('task:')) {
    const content = message.replace(/^(タスク追加:|task:)\s*/i, '');
    return await addTask(content);
  }

  // Help
  if (text === 'help' || text === 'ヘルプ' || text === '?') {
    return getHelp();
  }

  return null; // Not a dev-agent command
}

/**
 * Get dev agent status
 */
async function getStatus() {
  try {
    const res = await fetch(`${DEV_AGENT_URL}/`);
    const data = await res.json();

    return `📊 Dev Agent 状況\n\n` +
      `状態: ${data.processing ? '処理中' : '待機中'}\n` +
      `プロジェクト: ${data.projects}件\n` +
      `保留タスク: ${data.pendingTasks}件\n` +
      `最終更新: ${new Date(data.timestamp).toLocaleString('ja-JP')}`;
  } catch (error) {
    return `❌ エラー: ${error.message}`;
  }
}

/**
 * Get projects list
 */
async function getProjects() {
  try {
    const res = await fetch(`${DEV_AGENT_URL}/api/projects`);
    const data = await res.json();

    if (data.projects.length === 0) {
      return '📁 登録プロジェクトなし';
    }

    let msg = `📁 プロジェクト一覧 (${data.count}件)\n\n`;
    for (const p of data.projects) {
      msg += `• ${p.owner}/${p.repo}\n`;
      msg += `  タスク: ${p.taskCount || 0}件\n`;
    }
    return msg;
  } catch (error) {
    return `❌ エラー: ${error.message}`;
  }
}

/**
 * Get tasks list
 */
async function getTasks() {
  try {
    const res = await fetch(`${DEV_AGENT_URL}/api/tasks`);
    const data = await res.json();

    if (data.tasks.length === 0) {
      return '📋 タスクなし';
    }

    let msg = `📋 タスク一覧\n\n`;
    msg += `保留: ${data.pending}件\n`;
    msg += `処理中: ${data.processing}件\n\n`;

    for (const t of data.tasks.slice(-5)) {
      const status = t.status === 'completed' ? '✅' :
                     t.status === 'failed' ? '❌' :
                     t.status === 'processing' ? '⚙️' : '📋';
      msg += `${status} ${t.title}\n`;
      msg += `   ${t.project}\n`;
    }
    return msg;
  } catch (error) {
    return `❌ エラー: ${error.message}`;
  }
}

/**
 * Add a task
 * Format: プロジェクト名 タスク内容
 */
async function addTask(content) {
  try {
    // Get default project if only one
    const projectsRes = await fetch(`${DEV_AGENT_URL}/api/projects`);
    const projectsData = await projectsRes.json();

    let project, title;

    // Check if project is specified
    const parts = content.split(/\s+/);
    const possibleProject = parts[0];

    // Check if first part matches a project
    const matchedProject = projectsData.projects.find(p =>
      `${p.owner}/${p.repo}` === possibleProject ||
      p.repo === possibleProject
    );

    if (matchedProject) {
      project = `${matchedProject.owner}/${matchedProject.repo}`;
      title = parts.slice(1).join(' ');
    } else if (projectsData.projects.length === 1) {
      // Use default project
      project = `${projectsData.projects[0].owner}/${projectsData.projects[0].repo}`;
      title = content;
    } else {
      return `❌ プロジェクトを指定してください\n\n` +
        `形式: タスク追加: プロジェクト名 タスク内容\n\n` +
        `登録プロジェクト:\n` +
        projectsData.projects.map(p => `• ${p.repo}`).join('\n');
    }

    if (!title) {
      return '❌ タスク内容を入力してください';
    }

    const res = await fetch(`${DEV_AGENT_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, title })
    });

    const data = await res.json();

    if (data.status === 'ok') {
      return `✅ タスク追加完了\n\n` +
        `📁 ${project}\n` +
        `📋 ${title}\n\n` +
        `処理を開始します`;
    } else {
      return `❌ エラー: ${data.error}`;
    }
  } catch (error) {
    return `❌ エラー: ${error.message}`;
  }
}

/**
 * Get help message
 */
function getHelp() {
  return `🤖 Dev Agent コマンド\n\n` +
    `📊 状況 - ステータス確認\n` +
    `📁 プロジェクト - 一覧表示\n` +
    `📋 タスク - タスク一覧\n` +
    `✏️ タスク追加: 内容 - 新規タスク\n\n` +
    `例:\n` +
    `タスク追加: バグ修正してください`;
}
