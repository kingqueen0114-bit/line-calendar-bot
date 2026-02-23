/**
 * Gemini API フォールバック - 正規表現ベースのテキストパーサー
 * Gemini API がダウンした場合に基本コマンドを処理するためのフォールバック
 */

/**
 * 自然言語テキストからイベント/タスク情報を抽出する（正規表現ベース）
 * @param {string} text - ユーザーの入力テキスト
 * @returns {object|null} - パース結果。パース不能なら null
 */
export function fallbackParse(text) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();
    const now = new Date();

    // ========== 一覧系 ==========

    // 予定確認 / 予定一覧 / スケジュール確認
    if (/^(予定|スケジュール)(確認|一覧|チェック|表示)$/.test(trimmed)) {
        return { action: 'list', type: 'event' };
    }

    // タスク一覧 / タスク確認
    if (/^タスク(一覧|確認|チェック|表示)$/.test(trimmed)) {
        return { action: 'list', type: 'task' };
    }

    // 今日の予定 / 明日の予定
    if (/^(今日|明日|明後日)の(予定|スケジュール)$/.test(trimmed)) {
        const match = trimmed.match(/^(今日|明日|明後日)/);
        const targetDate = new Date(now);
        if (match[1] === '明日') targetDate.setDate(targetDate.getDate() + 1);
        if (match[1] === '明後日') targetDate.setDate(targetDate.getDate() + 2);
        const dateStr = formatDate(targetDate);
        return { action: 'list', type: 'event', date: dateStr };
    }

    // ========== 完了系 ==========

    // 「1完了」「2番完了」「3 done」
    const completeMatch = trimmed.match(/^(\d+)\s*(番?\s*(完了|done|済み))/i);
    if (completeMatch) {
        return { action: 'complete', targetNumber: parseInt(completeMatch[1]) };
    }

    // ========== キャンセル系 ==========

    // 「ミーティングをキャンセル」「打ち合わせの削除」
    const cancelMatch = trimmed.match(/^(.+?)(を|の)?\s*(キャンセル|削除|取り消し?)$/);
    if (cancelMatch) {
        return { action: 'cancel', type: 'event', title: cancelMatch[1].trim() };
    }

    // ========== タスク作成 ==========

    // 「タスク 牛乳を買う」「タスク 牛乳を買う 期限明日」
    const taskMatch = trimmed.match(/^タスク\s+(.+?)(?:\s+期限\s*(.+))?$/);
    if (taskMatch) {
        const result = {
            action: 'create',
            type: 'task',
            title: taskMatch[1].trim()
        };
        if (taskMatch[2]) {
            const dueDate = parseRelativeDate(taskMatch[2].trim(), now);
            if (dueDate) result.date = dueDate;
        }
        return result;
    }

    // ========== 予定作成 ==========

    // 「明日14時 ミーティング」「明後日 10:00 打ち合わせ」
    const relDateTimeMatch = trimmed.match(/^(今日|明日|明後日)\s*(\d{1,2})[時:](\d{0,2})?\s+(.+)/);
    if (relDateTimeMatch) {
        const targetDate = new Date(now);
        if (relDateTimeMatch[1] === '明日') targetDate.setDate(targetDate.getDate() + 1);
        if (relDateTimeMatch[1] === '明後日') targetDate.setDate(targetDate.getDate() + 2);

        const hour = parseInt(relDateTimeMatch[2]);
        const minute = relDateTimeMatch[3] ? parseInt(relDateTimeMatch[3]) : 0;

        return {
            action: 'create',
            type: 'event',
            title: relDateTimeMatch[4].trim(),
            date: formatDate(targetDate),
            startTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            endTime: `${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        };
    }

    // 「3/15 14時 会議」「3月15日 10:00 打ち合わせ」
    const absDateMatch = trimmed.match(/^(\d{1,2})[月/](\d{1,2})日?\s*(?:(\d{1,2})[時:](\d{0,2})?)?\s+(.+)/);
    if (absDateMatch) {
        const targetDate = new Date(now.getFullYear(), parseInt(absDateMatch[1]) - 1, parseInt(absDateMatch[2]));
        // 過去の日付なら来年にする
        if (targetDate < now) targetDate.setFullYear(targetDate.getFullYear() + 1);

        const result = {
            action: 'create',
            type: 'event',
            title: absDateMatch[5].trim(),
            date: formatDate(targetDate)
        };

        if (absDateMatch[3]) {
            const hour = parseInt(absDateMatch[3]);
            const minute = absDateMatch[4] ? parseInt(absDateMatch[4]) : 0;
            result.startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            result.endTime = `${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        } else {
            result.isAllDay = true;
        }

        return result;
    }

    // パターンに一致しない場合
    return null;
}

// ========== ヘルパー関数 ==========

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseRelativeDate(text, now) {
    if (text === '今日') return formatDate(now);
    if (text === '明日') {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        return formatDate(d);
    }
    if (text === '明後日') {
        const d = new Date(now);
        d.setDate(d.getDate() + 2);
        return formatDate(d);
    }

    // 「3/15」「3月15日」
    const dateMatch = text.match(/^(\d{1,2})[月/](\d{1,2})日?$/);
    if (dateMatch) {
        const d = new Date(now.getFullYear(), parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
        if (d < now) d.setFullYear(d.getFullYear() + 1);
        return formatDate(d);
    }

    return null;
}
