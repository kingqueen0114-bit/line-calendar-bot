/**
 * Tags Routes - タグ管理API
 */
import { Router } from 'express';
import { env } from '../env-adapter.js';
import { setCors, requireUserId, asyncHandler } from '../middleware/common.js';
import {
  getUserTags,
  getProjectTags,
  createTag,
  updateTag,
  deleteTag,
  getAllTagsForUser
} from '../tags.js';
import { getUserProjects } from '../project.js';

const router = Router();

router.use(setCors);

// ==================== 個人タグ ====================

// タグ一覧取得
router.get('/', requireUserId, asyncHandler(async (req, res) => {
  const { includeProjects } = req.query;

  if (includeProjects === 'true') {
    // 個人タグ + 参加プロジェクトのタグを取得
    const projects = await getUserProjects(req.userId, env);
    const projectIds = projects.map(p => p.id);
    const allTags = await getAllTagsForUser(req.userId, env, projectIds);
    res.json(allTags);
  } else {
    // 個人タグのみ
    const tags = await getUserTags(req.userId, env);
    res.json(tags);
  }
}));

// タグ作成
router.post('/', asyncHandler(async (req, res) => {
  const { userId, name, color, projectId } = req.body;

  if (!userId || !name) {
    return res.status(400).json({ error: 'userId, name required' });
  }

  // カラーバリデーション
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Invalid color format. Use hex code like #ff4757' });
  }

  const tag = await createTag({ name, color }, userId, env, projectId);
  res.json(tag);
}));

// タグ更新
router.put('/', asyncHandler(async (req, res) => {
  const { userId, tagId, name, color, projectId } = req.body;

  if (!userId || !tagId) {
    return res.status(400).json({ error: 'userId, tagId required' });
  }

  // カラーバリデーション
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Invalid color format. Use hex code like #ff4757' });
  }

  try {
    const tag = await updateTag(tagId, { name, color }, userId, env, projectId);
    res.json(tag);
  } catch (err) {
    if (err.message === 'Tag not found') {
      return res.status(404).json({ error: 'Tag not found' });
    }
    throw err;
  }
}));

// タグ削除
router.delete('/', asyncHandler(async (req, res) => {
  const { userId, tagId, projectId } = req.body;

  if (!userId || !tagId) {
    return res.status(400).json({ error: 'userId, tagId required' });
  }

  try {
    await deleteTag(tagId, userId, env, projectId);
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'Tag not found') {
      return res.status(404).json({ error: 'Tag not found' });
    }
    throw err;
  }
}));

// ==================== プロジェクトタグ ====================

// プロジェクトタグ一覧取得
router.get('/project/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId required' });
  }

  const tags = await getProjectTags(projectId, env);
  res.json(tags);
}));

export default router;
