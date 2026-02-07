/**
 * Routes Index - ルーター集約
 */
import { Router } from 'express';
import apiRouter from './api.js';
import liffRouter from './liff.js';
import backupRouter from './backup.js';
import projectRouter from './project.js';
import webhookRouter from './webhook.js';

const router = Router();

// API ルート
router.use('/api', apiRouter);

// LIFF ルート
router.use('/', liffRouter);

// バックアップ ルート
router.use('/api/backup', backupRouter);

// プロジェクト管理 ルート
router.use('/api/project', projectRouter);

// Webhook ルート
router.use('/', webhookRouter);

export default router;
