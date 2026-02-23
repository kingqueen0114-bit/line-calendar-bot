import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env adapter
vi.mock('../src/utils/env-adapter.js', () => ({
    env: {
        NOTIFICATIONS: {
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        }
    }
}));

import { requireProjectRole, requireTaskListRole } from '../src/middleware/project-permission.js';
import { env } from '../src/utils/env-adapter.js';

function createMockReqRes(body = {}, query = {}) {
    const req = { body, query, userId: body.userId };
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
}

describe('requireProjectRole', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const project = {
        id: 'proj_1',
        name: 'Test',
        owner: 'owner_user',
        members: ['owner_user', 'member_user'],
        color: '#06c755',
    };

    it('オーナーはowner権限を通過する', async () => {
        env.NOTIFICATIONS.get.mockResolvedValue(project);
        const { req, res, next } = createMockReqRes({ userId: 'owner_user', projectId: 'proj_1' });

        await requireProjectRole('owner')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.project).toEqual(project);
        expect(req.isOwner).toBe(true);
    });

    it('メンバーはowner権限を拒否される', async () => {
        env.NOTIFICATIONS.get.mockResolvedValue(project);
        const { req, res, next } = createMockReqRes({ userId: 'member_user', projectId: 'proj_1' });

        await requireProjectRole('owner')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('メンバーはmember権限を通過する', async () => {
        env.NOTIFICATIONS.get.mockResolvedValue(project);
        const { req, res, next } = createMockReqRes({ userId: 'member_user', projectId: 'proj_1' });

        await requireProjectRole('member')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.isOwner).toBe(false);
    });

    it('非メンバーはmember権限を拒否される', async () => {
        env.NOTIFICATIONS.get.mockResolvedValue(project);
        const { req, res, next } = createMockReqRes({ userId: 'outsider', projectId: 'proj_1' });

        await requireProjectRole('member')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('存在しないプロジェクトは404', async () => {
        env.NOTIFICATIONS.get.mockResolvedValue(null);
        const { req, res, next } = createMockReqRes({ userId: 'any', projectId: 'nonexistent' });

        await requireProjectRole('member')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('projectIdが無い場合は400', async () => {
        const { req, res, next } = createMockReqRes({ userId: 'any' });

        await requireProjectRole('member')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('requireTaskListRole', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const taskList = {
        id: 'tl_1',
        name: 'Shopping',
        owner: 'owner_user',
        members: ['owner_user', 'member_user'],
    };

    it('オーナーはowner権限を通過する', async () => {
        env.NOTIFICATIONS.get.mockResolvedValue(taskList);
        const { req, res, next } = createMockReqRes({ userId: 'owner_user', listId: 'tl_1' });

        await requireTaskListRole('owner')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.taskList).toEqual(taskList);
    });

    it('非メンバーはmember権限を拒否される', async () => {
        env.NOTIFICATIONS.get.mockResolvedValue(taskList);
        const { req, res, next } = createMockReqRes({ userId: 'outsider', listId: 'tl_1' });

        await requireTaskListRole('member')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
    });
});
