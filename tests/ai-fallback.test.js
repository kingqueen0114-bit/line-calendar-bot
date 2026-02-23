import { describe, it, expect } from 'vitest';
import { fallbackParse } from '../src/services/ai-fallback.js';

describe('fallbackParse', () => {
    // ========== 一覧系 ==========
    describe('一覧コマンド', () => {
        it('「予定確認」→ list events', () => {
            const result = fallbackParse('予定確認');
            expect(result).toEqual({ action: 'list', type: 'event' });
        });

        it('「予定一覧」→ list events', () => {
            const result = fallbackParse('予定一覧');
            expect(result).toEqual({ action: 'list', type: 'event' });
        });

        it('「タスク一覧」→ list tasks', () => {
            const result = fallbackParse('タスク一覧');
            expect(result).toEqual({ action: 'list', type: 'task' });
        });

        it('「タスク確認」→ list tasks', () => {
            const result = fallbackParse('タスク確認');
            expect(result).toEqual({ action: 'list', type: 'task' });
        });

        it('「スケジュール確認」→ list events', () => {
            const result = fallbackParse('スケジュール確認');
            expect(result).toEqual({ action: 'list', type: 'event' });
        });
    });

    // ========== 完了系 ==========
    describe('完了コマンド', () => {
        it('「1完了」→ complete #1', () => {
            const result = fallbackParse('1完了');
            expect(result).toEqual({ action: 'complete', targetNumber: 1 });
        });

        it('「3番完了」→ complete #3', () => {
            const result = fallbackParse('3番完了');
            expect(result).toEqual({ action: 'complete', targetNumber: 3 });
        });

        it('「2 done」→ complete #2', () => {
            const result = fallbackParse('2 done');
            expect(result).toEqual({ action: 'complete', targetNumber: 2 });
        });
    });

    // ========== キャンセル系 ==========
    describe('キャンセルコマンド', () => {
        it('「ミーティングをキャンセル」→ cancel event', () => {
            const result = fallbackParse('ミーティングをキャンセル');
            expect(result).toEqual({ action: 'cancel', type: 'event', title: 'ミーティング' });
        });

        it('「打ち合わせの削除」→ cancel event', () => {
            const result = fallbackParse('打ち合わせの削除');
            expect(result).toEqual({ action: 'cancel', type: 'event', title: '打ち合わせ' });
        });

        it('「飲み会取り消し」→ cancel event', () => {
            const result = fallbackParse('飲み会取り消し');
            expect(result).toEqual({ action: 'cancel', type: 'event', title: '飲み会' });
        });
    });

    // ========== タスク作成 ==========
    describe('タスク作成', () => {
        it('「タスク 牛乳を買う」→ create task', () => {
            const result = fallbackParse('タスク 牛乳を買う');
            expect(result).toEqual({
                action: 'create',
                type: 'task',
                title: '牛乳を買う'
            });
        });

        it('「タスク レポート提出 期限明日」→ create task with due', () => {
            const result = fallbackParse('タスク レポート提出 期限明日');
            expect(result).not.toBeNull();
            expect(result.action).toBe('create');
            expect(result.type).toBe('task');
            expect(result.title).toBe('レポート提出');
            expect(result.date).toBeDefined();
        });
    });

    // ========== 予定作成 ==========
    describe('予定作成', () => {
        it('「明日14時 ミーティング」→ create event', () => {
            const result = fallbackParse('明日14時 ミーティング');
            expect(result).not.toBeNull();
            expect(result.action).toBe('create');
            expect(result.type).toBe('event');
            expect(result.title).toBe('ミーティング');
            expect(result.startTime).toBe('14:00');
            expect(result.endTime).toBe('15:00');
        });

        it('「明後日 10:30 打ち合わせ」→ create event', () => {
            const result = fallbackParse('明後日10:30 打ち合わせ');
            expect(result).not.toBeNull();
            expect(result.action).toBe('create');
            expect(result.type).toBe('event');
            expect(result.title).toBe('打ち合わせ');
            expect(result.startTime).toBe('10:30');
        });

        it('「3/15 14時 会議」→ create event with absolute date', () => {
            const result = fallbackParse('3/15 14時 会議');
            expect(result).not.toBeNull();
            expect(result.action).toBe('create');
            expect(result.type).toBe('event');
            expect(result.title).toBe('会議');
            expect(result.date).toMatch(/^\d{4}-03-15$/);
            expect(result.startTime).toBe('14:00');
        });
    });

    // ========== 未知の入力 ==========
    describe('未知の入力', () => {
        it('パターンに一致しないテキスト → null', () => {
            expect(fallbackParse('こんにちは')).toBeNull();
        });

        it('空文字 → null', () => {
            expect(fallbackParse('')).toBeNull();
        });

        it('null → null', () => {
            expect(fallbackParse(null)).toBeNull();
        });
    });
});
