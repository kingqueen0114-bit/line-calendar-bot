/**
 * プロジェクト/グループ機能 - Firestore連携
 */

/**
 * プロジェクトを作成
 * @param {object} projectData - プロジェクトデータ
 * @param {string} userId - 作成者のユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object>} - 作成されたプロジェクト
 */
export async function createProject(projectData, userId, env) {
  const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const isPersonal = projectData.isPersonal === true;
  const inviteCode = isPersonal ? null : generateInviteCode();

  const project = {
    id: projectId,
    name: projectData.name,
    description: projectData.description || '',
    color: projectData.color || '#06c755',
    ownerId: userId,
    members: [userId],
    isPersonal,
    inviteCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // プロジェクトを保存
  await env.NOTIFICATIONS.put(`project:${projectId}`, JSON.stringify(project));

  // 共有カレンダーの場合のみ招待コードのマッピングを保存
  if (!isPersonal && inviteCode) {
    await env.NOTIFICATIONS.put(`invite:${inviteCode}`, projectId);
  }

  // ユーザーのプロジェクトリストに追加
  await addProjectToUser(userId, projectId, env);

  return project;
}

/**
 * プロジェクトを取得
 * @param {string} projectId - プロジェクトID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object|null>} - プロジェクト
 */
export async function getProject(projectId, env) {
  return await env.NOTIFICATIONS.get(`project:${projectId}`, { type: 'json' });
}

/**
 * プロジェクトを更新
 * @param {string} projectId - プロジェクトID
 * @param {object} updates - 更新内容
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object>} - 更新されたプロジェクト
 */
export async function updateProject(projectId, updates, userId, env) {
  const project = await getProject(projectId, env);
  if (!project) {
    throw new Error('プロジェクトが見つかりません');
  }

  if (!project.members.includes(userId)) {
    throw new Error('このカレンダーを編集する権限がありません');
  }

  // 更新可能なフィールド
  if (updates.name) project.name = updates.name;
  if (updates.color) project.color = updates.color;
  if (updates.description !== undefined) project.description = updates.description;

  project.updatedAt = new Date().toISOString();

  await env.NOTIFICATIONS.put(`project:${projectId}`, JSON.stringify(project));

  return project;
}

/**
 * ユーザーのプロジェクト一覧を取得
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<Array>} - プロジェクト一覧
 */
export async function getUserProjects(userId, env) {
  const projectIds = await env.NOTIFICATIONS.get(`user_projects:${userId}`, { type: 'json' }) || [];
  const projects = [];

  for (const projectId of projectIds) {
    const project = await getProject(projectId, env);
    if (project) {
      projects.push(project);
    }
  }

  return projects;
}

/**
 * 招待コードでプロジェクトに参加
 * @param {string} inviteCode - 招待コード
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object>} - 参加したプロジェクト
 */
export async function joinProjectByCode(inviteCode, userId, env) {
  const projectId = await env.NOTIFICATIONS.get(`invite:${inviteCode}`);
  if (!projectId) {
    throw new Error('招待コードが無効です');
  }

  const project = await getProject(projectId, env);
  if (!project) {
    throw new Error('プロジェクトが見つかりません');
  }

  if (project.members.includes(userId)) {
    throw new Error('すでにこのプロジェクトに参加しています');
  }

  // メンバーに追加
  project.members.push(userId);
  project.updatedAt = new Date().toISOString();
  await env.NOTIFICATIONS.put(`project:${projectId}`, JSON.stringify(project));

  // ユーザーのプロジェクトリストに追加
  await addProjectToUser(userId, projectId, env);

  return project;
}

/**
 * プロジェクトから退出
 * @param {string} projectId - プロジェクトID
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 */
export async function leaveProject(projectId, userId, env) {
  const project = await getProject(projectId, env);
  if (!project) {
    throw new Error('プロジェクトが見つかりません');
  }

  if (project.ownerId === userId) {
    throw new Error('オーナーはプロジェクトから退出できません。プロジェクトを削除してください。');
  }

  // メンバーから削除
  project.members = project.members.filter(id => id !== userId);
  project.updatedAt = new Date().toISOString();
  await env.NOTIFICATIONS.put(`project:${projectId}`, JSON.stringify(project));

  // ユーザーのプロジェクトリストから削除
  await removeProjectFromUser(userId, projectId, env);
}

/**
 * プロジェクトを削除（オーナーのみ）
 * @param {string} projectId - プロジェクトID
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 */
export async function deleteProject(projectId, userId, env) {
  const project = await getProject(projectId, env);
  if (!project) {
    throw new Error('プロジェクトが見つかりません');
  }

  if (project.ownerId !== userId) {
    throw new Error('プロジェクトを削除できるのはオーナーのみです');
  }

  // 全メンバーのプロジェクトリストから削除
  for (const memberId of project.members) {
    await removeProjectFromUser(memberId, projectId, env);
  }

  // 招待コードを削除
  await env.NOTIFICATIONS.delete(`invite:${project.inviteCode}`);

  // プロジェクトを削除
  await env.NOTIFICATIONS.delete(`project:${projectId}`);
}

/**
 * プロジェクトの招待コードを再生成
 * @param {string} projectId - プロジェクトID
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<string>} - 新しい招待コード
 */
export async function regenerateInviteCode(projectId, userId, env) {
  const project = await getProject(projectId, env);
  if (!project) {
    throw new Error('プロジェクトが見つかりません');
  }

  if (project.ownerId !== userId) {
    throw new Error('招待コードを再生成できるのはオーナーのみです');
  }

  // 古い招待コードを削除
  await env.NOTIFICATIONS.delete(`invite:${project.inviteCode}`);

  // 新しい招待コードを生成
  const newInviteCode = generateInviteCode();
  project.inviteCode = newInviteCode;
  project.updatedAt = new Date().toISOString();

  await env.NOTIFICATIONS.put(`project:${projectId}`, JSON.stringify(project));
  await env.NOTIFICATIONS.put(`invite:${newInviteCode}`, projectId);

  return newInviteCode;
}

/**
 * プロジェクトのメンバー情報を取得
 * @param {string} projectId - プロジェクトID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<Array>} - メンバー情報
 */
export async function getProjectMembers(projectId, env) {
  const project = await getProject(projectId, env);
  if (!project) {
    return [];
  }

  const members = [];
  for (const memberId of project.members) {
    const userData = await env.NOTIFICATIONS.get(`user:${memberId}`, { type: 'json' });
    members.push({
      userId: memberId,
      displayName: userData?.displayName || '不明',
      isOwner: memberId === project.ownerId
    });
  }

  return members;
}

// ヘルパー関数

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function addProjectToUser(userId, projectId, env) {
  const key = `user_projects:${userId}`;
  const projects = await env.NOTIFICATIONS.get(key, { type: 'json' }) || [];
  if (!projects.includes(projectId)) {
    projects.push(projectId);
    await env.NOTIFICATIONS.put(key, JSON.stringify(projects));
  }
}

async function removeProjectFromUser(userId, projectId, env) {
  const key = `user_projects:${userId}`;
  let projects = await env.NOTIFICATIONS.get(key, { type: 'json' }) || [];
  projects = projects.filter(id => id !== projectId);
  await env.NOTIFICATIONS.put(key, JSON.stringify(projects));
}
