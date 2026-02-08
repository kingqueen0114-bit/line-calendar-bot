/**
 * Tags Module - タグ管理機能
 * 個人タグとプロジェクト共有タグの両方に対応
 */

/**
 * ユーザーのタグ一覧を取得
 */
export async function getUserTags(userId, env) {
  const tags = await env.NOTIFICATIONS.get(`tags:${userId}`, { type: 'json' });
  return tags || [];
}

/**
 * プロジェクトの共有タグ一覧を取得
 */
export async function getProjectTags(projectId, env) {
  const tags = await env.NOTIFICATIONS.get(`project_tags:${projectId}`, { type: 'json' });
  return tags || [];
}

/**
 * タグを作成
 */
export async function createTag(tagData, userId, env, projectId = null) {
  const tagId = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const tag = {
    id: tagId,
    name: tagData.name,
    color: tagData.color || '#06c755',
    createdAt: now,
    updatedAt: now
  };

  if (projectId) {
    // プロジェクト共有タグ
    const tags = await getProjectTags(projectId, env);
    tags.push(tag);
    await env.NOTIFICATIONS.put(`project_tags:${projectId}`, JSON.stringify(tags));
  } else {
    // 個人タグ
    const tags = await getUserTags(userId, env);
    tags.push(tag);
    await env.NOTIFICATIONS.put(`tags:${userId}`, JSON.stringify(tags));
  }

  return tag;
}

/**
 * タグを更新
 */
export async function updateTag(tagId, tagData, userId, env, projectId = null) {
  const storageKey = projectId ? `project_tags:${projectId}` : `tags:${userId}`;
  const tags = await env.NOTIFICATIONS.get(storageKey, { type: 'json' }) || [];

  const tagIndex = tags.findIndex(t => t.id === tagId);
  if (tagIndex === -1) {
    throw new Error('Tag not found');
  }

  tags[tagIndex] = {
    ...tags[tagIndex],
    name: tagData.name !== undefined ? tagData.name : tags[tagIndex].name,
    color: tagData.color !== undefined ? tagData.color : tags[tagIndex].color,
    updatedAt: new Date().toISOString()
  };

  await env.NOTIFICATIONS.put(storageKey, JSON.stringify(tags));
  return tags[tagIndex];
}

/**
 * タグを削除
 */
export async function deleteTag(tagId, userId, env, projectId = null) {
  const storageKey = projectId ? `project_tags:${projectId}` : `tags:${userId}`;
  const tags = await env.NOTIFICATIONS.get(storageKey, { type: 'json' }) || [];

  const filteredTags = tags.filter(t => t.id !== tagId);
  if (filteredTags.length === tags.length) {
    throw new Error('Tag not found');
  }

  await env.NOTIFICATIONS.put(storageKey, JSON.stringify(filteredTags));
  return { success: true };
}

/**
 * タグIDから詳細を取得（複数対応）
 */
export async function getTagsByIds(tagIds, userId, env, projectId = null) {
  if (!tagIds || tagIds.length === 0) {
    return [];
  }

  const tags = projectId
    ? await getProjectTags(projectId, env)
    : await getUserTags(userId, env);

  return tagIds
    .map(id => tags.find(t => t.id === id))
    .filter(Boolean);
}

/**
 * 全タグを取得（個人 + プロジェクト）
 */
export async function getAllTagsForUser(userId, env, projectIds = []) {
  const userTags = await getUserTags(userId, env);

  const projectTagsPromises = projectIds.map(pid => getProjectTags(pid, env));
  const projectTagsArrays = await Promise.all(projectTagsPromises);

  const projectTags = projectTagsArrays.flat().map(tag => ({
    ...tag,
    isProjectTag: true
  }));

  return {
    userTags,
    projectTags,
    allTags: [...userTags, ...projectTags]
  };
}
