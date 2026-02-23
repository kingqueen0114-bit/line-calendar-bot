/**
 * プロジェクト/共有リスト権限チェックミドルウェア
 *
 * 権限マトリクス:
 * ┌────────────────────┬────────┬────────┬──────────┐
 * │ 操作               │ owner  │ member │ 非member │
 * ├────────────────────┼────────┼────────┼──────────┤
 * │ プロジェクト更新    │ ✅     │ ❌     │ ❌       │
 * │ プロジェクト削除    │ ✅     │ ❌     │ ❌       │
 * │ 招待コード再生成    │ ✅     │ ❌     │ ❌       │
 * │ メンバー一覧        │ ✅     │ ✅     │ ❌       │
 * │ 共有予定作成        │ ✅     │ ✅     │ ❌       │
 * │ 共有予定削除        │ ✅     │ ✅(※) │ ❌       │
 * │ プロジェクト退出    │ ❌     │ ✅     │ ❌       │
 * │ 招待コード参加      │ —      │ —      │ ✅       │
 * └────────────────────┴────────┴────────┴──────────┘
 * ※ メンバーは自分が作成した予定のみ削除可能
 */
import { env } from '../utils/env-adapter.js';

/**
 * プロジェクト権限チェック
 * @param {'owner'|'member'} role - 必要な最低権限
 */
export function requireProjectRole(role) {
    return async (req, res, next) => {
        const userId = req.userId || req.query.userId || req.body?.userId;
        const projectId = req.query.projectId || req.body?.projectId;

        if (!projectId) {
            return res.status(400).json({ error: 'projectId required' });
        }

        try {
            const project = await env.NOTIFICATIONS.get(`project:${projectId}`, { type: 'json' });
            if (!project) {
                return res.status(404).json({ error: 'プロジェクトが見つかりません' });
            }

            const isOwner = project.owner === userId;
            const isMember = project.members && project.members.includes(userId);

            if (role === 'owner' && !isOwner) {
                return res.status(403).json({ error: 'オーナー権限が必要です' });
            }

            if (role === 'member' && !isMember && !isOwner) {
                return res.status(403).json({ error: 'メンバー権限が必要です' });
            }

            // リクエストにプロジェクト情報を付加
            req.project = project;
            req.isOwner = isOwner;
            next();
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({ error: 'Permission check failed' });
        }
    };
}

/**
 * 共有タスクリスト権限チェック
 * @param {'owner'|'member'} role - 必要な最低権限
 */
export function requireTaskListRole(role) {
    return async (req, res, next) => {
        const userId = req.userId || req.query.userId || req.body?.userId;
        const listId = req.query.listId || req.body?.listId;

        if (!listId) {
            return res.status(400).json({ error: 'listId required' });
        }

        try {
            const list = await env.NOTIFICATIONS.get(`shared_tasklist:${listId}`, { type: 'json' });
            if (!list) {
                return res.status(404).json({ error: 'タスクリストが見つかりません' });
            }

            const isOwner = list.owner === userId;
            const isMember = list.members && list.members.includes(userId);

            if (role === 'owner' && !isOwner) {
                return res.status(403).json({ error: 'オーナー権限が必要です' });
            }

            if (role === 'member' && !isMember && !isOwner) {
                return res.status(403).json({ error: 'メンバー権限が必要です' });
            }

            req.taskList = list;
            req.isOwner = isOwner;
            next();
        } catch (error) {
            console.error('TaskList permission check error:', error);
            return res.status(500).json({ error: 'Permission check failed' });
        }
    };
}
