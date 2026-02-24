/**
 * バックアップサービス — .ics / JSON エクスポート・インポート
 */
import { env } from '../utils/env-adapter.js';

/**
 * .ics (iCalendar) 形式でエクスポート
 * iCloud, Google Calendar, Outlook 等にインポート可能
 */
export async function exportToICS(userId) {
    const { getLocalEvents } = await import('./local-calendar.service.js');
    const events = await getLocalEvents(userId, 365);

    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//LINE Calendar Bot//JP\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';

    for (const event of events) {
        ics += 'BEGIN:VEVENT\r\n';
        ics += `UID:${event.id}@line-calendar-bot\r\n`;
        ics += `SUMMARY:${escapeICS(event.summary || '')}\r\n`;

        if (event.start?.date) {
            ics += `DTSTART;VALUE=DATE:${event.start.date.replace(/-/g, '')}\r\n`;
            ics += `DTEND;VALUE=DATE:${event.start.date.replace(/-/g, '')}\r\n`;
        } else if (event.start?.dateTime) {
            ics += `DTSTART:${toICSDateTime(event.start.dateTime)}\r\n`;
            ics += `DTEND:${toICSDateTime(event.end?.dateTime || event.start.dateTime)}\r\n`;
        }

        if (event.location) ics += `LOCATION:${escapeICS(event.location)}\r\n`;
        if (event.description) ics += `DESCRIPTION:${escapeICS(event.description)}\r\n`;
        ics += `CREATED:${toICSDateTime(event.createdAt || new Date().toISOString())}\r\n`;
        ics += 'END:VEVENT\r\n';
    }

    ics += 'END:VCALENDAR\r\n';
    return ics;
}

/**
 * JSON形式で全データエクスポート
 */
export async function exportToJSON(userId) {
    const { getLocalEvents } = await import('./local-calendar.service.js');
    const { getLocalTasks, getLocalCompletedTasks } = await import('./local-calendar.service.js');

    const events = await getLocalEvents(userId, 9999);
    const tasks = await getLocalTasks(userId);
    const completedTasks = await getLocalCompletedTasks(userId);

    // メモ取得
    const memoResults = await env.NOTIFICATIONS.list(`memo:${userId}:`);
    const memos = [];
    for (const item of memoResults) {
        try {
            const memo = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            memos.push(memo);
        } catch (e) { /* skip */ }
    }

    return {
        exportedAt: new Date().toISOString(),
        userId,
        events,
        tasks,
        completedTasks,
        memos,
    };
}

/**
 * .ics ファイルからインポート
 */
export async function importFromICS(userId, icsText) {
    const { createLocalEvent } = await import('./local-calendar.service.js');

    const events = parseICS(icsText);
    let imported = 0;

    for (const evt of events) {
        await createLocalEvent(userId, {
            title: evt.summary || '',
            date: evt.date || '',
            startTime: evt.startTime || '',
            endTime: evt.endTime || '',
            isAllDay: evt.isAllDay || false,
            location: evt.location || '',
            memo: evt.description || '',
        });
        imported++;
    }

    return { imported };
}

// ========== ヘルパー ==========

function escapeICS(str) {
    return (str || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

function toICSDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) + 'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) + 'Z';
}

function parseICS(text) {
    const events = [];
    const lines = text.replace(/\r\n /g, '').split(/\r?\n/);
    let current = null;

    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
            current = {};
        } else if (line === 'END:VEVENT' && current) {
            events.push(current);
            current = null;
        } else if (current) {
            const [key, ...rest] = line.split(':');
            const value = rest.join(':');
            const baseKey = key.split(';')[0];

            if (baseKey === 'SUMMARY') current.summary = unescapeICS(value);
            else if (baseKey === 'LOCATION') current.location = unescapeICS(value);
            else if (baseKey === 'DESCRIPTION') current.description = unescapeICS(value);
            else if (baseKey === 'DTSTART') {
                if (key.includes('VALUE=DATE')) {
                    current.isAllDay = true;
                    current.date = value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6, 8);
                } else {
                    current.isAllDay = false;
                    const d = parseICSDate(value);
                    if (d) {
                        current.date = d.toISOString().slice(0, 10);
                        current.startTime = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                    }
                }
            } else if (baseKey === 'DTEND') {
                if (!key.includes('VALUE=DATE')) {
                    const d = parseICSDate(value);
                    if (d) {
                        current.endTime = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                    }
                }
            }
        }
    }

    return events;
}

function unescapeICS(str) {
    return (str || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseICSDate(str) {
    if (!str) return null;
    try {
        if (str.endsWith('Z')) {
            return new Date(
                str.slice(0, 4) + '-' + str.slice(4, 6) + '-' + str.slice(6, 8) + 'T' +
                str.slice(9, 11) + ':' + str.slice(11, 13) + ':' + str.slice(13, 15) + 'Z'
            );
        }
        return new Date(
            str.slice(0, 4) + '-' + str.slice(4, 6) + '-' + str.slice(6, 8) + 'T' +
            str.slice(9, 11) + ':' + str.slice(11, 13) + ':' + str.slice(13, 15)
        );
    } catch (e) { return null; }
}
