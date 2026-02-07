/**
 * Backup Routes - バックアップ関連エンドポイント
 */
import { Router } from 'express';
import { env } from '../env-adapter.js';
import { setCors, requireUserId, asyncHandler } from '../middleware/common.js';
import { exportUserData, listBackups, getLastBackupTime, restoreFromBackup, createBackup, autoBackupSetting } from '../backup.js';

const router = Router();

router.use(setCors);

// バックアップエクスポート
router.get('/export', requireUserId, asyncHandler(async (req, res) => {
  const exportData = await exportUserData(req.userId, env);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="calendar-backup-${new Date().toISOString().split('T')[0]}.json"`);
  res.json(exportData);
}));

// バックアップ一覧
router.get('/list', requireUserId, asyncHandler(async (req, res) => {
  const backups = await listBackups(req.userId, env);
  const lastBackupTime = await getLastBackupTime(req.userId, env);
  res.json({ backups, lastBackupTime });
}));

// バックアップから復元
router.post('/restore', asyncHandler(async (req, res) => {
  const { userId, backupId } = req.body;
  if (!userId || !backupId) {
    return res.status(400).json({ error: 'userId and backupId are required' });
  }

  const result = await restoreFromBackup(userId, backupId, env);
  res.json({ success: true, result });
}));

// 手動バックアップ作成
router.post('/create', asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const result = await createBackup(userId, env);
  res.json({ success: true, backup: result });
}));

// 自動バックアップ設定取得
router.get('/settings', requireUserId, asyncHandler(async (req, res) => {
  const autoBackupEnabled = await autoBackupSetting(req.userId, env);
  const lastBackupTime = await getLastBackupTime(req.userId, env);
  res.json({ autoBackupEnabled, lastBackupTime });
}));

// 自動バックアップ設定更新
router.post('/settings', asyncHandler(async (req, res) => {
  const { userId, autoBackupEnabled } = req.body;
  if (!userId || autoBackupEnabled === undefined) {
    return res.status(400).json({ error: 'userId and autoBackupEnabled are required' });
  }

  await autoBackupSetting(userId, env, autoBackupEnabled);
  res.json({ success: true, autoBackupEnabled });
}));

export default router;
