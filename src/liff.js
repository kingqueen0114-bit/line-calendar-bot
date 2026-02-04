/**
 * LIFF HTML Generator - Phase 3: メモ機能（GCS画像対応）
 */

export function generateLiffHtml(liffId, apiBase) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Project Sync</title>
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>
    :root {
      --primary: #06c755;
      --primary-dark: #00b341;
      --danger: #ff4757;
      --bg: #f5f7fa;
      --card: #ffffff;
      --text: #1a1a1a;
      --text-secondary: #666666;
      --text-muted: #999999;
      --border: #e8e8e8;
      --shadow: 0 2px 12px rgba(0,0,0,0.08);
      --tab-height: 54px;
      --header-height: 44px;
      --safe-bottom: env(safe-area-inset-bottom, 0px);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    html, body {
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    .app {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 100%;
    }

    .header {
      display: none;
    }

    .main {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .section {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px;
      padding-bottom: calc(70px + var(--safe-bottom));
      display: none;
      -webkit-overflow-scrolling: touch;
    }
    .section.active { display: block; }

    .tab-bar {
      display: flex;
      background: var(--card);
      border-top: 1px solid var(--border);
      padding-bottom: var(--safe-bottom);
      flex-shrink: 0;
    }
    .tab-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px 0;
      min-height: var(--tab-height);
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 10px;
      cursor: pointer;
      transition: color 0.2s;
    }
    .tab-item.active { color: var(--primary); }
    .tab-item svg { width: 24px; height: 24px; margin-bottom: 4px; }
    .tab-item.active svg { fill: var(--primary); }

    /* FAB */
    .fab {
      position: fixed;
      bottom: calc(80px + var(--safe-bottom));
      right: 20px;
      width: 56px;
      height: 56px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 50%;
      font-size: 28px;
      cursor: pointer;
      box-shadow: var(--fab-shadow, 0 4px 12px rgba(6, 199, 85, 0.4));
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .fab:active {
      transform: scale(0.95);
      box-shadow: 0 2px 8px rgba(6, 199, 85, 0.4);
    }

    /* モーダル */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 200;
      display: none;
      align-items: flex-end;
      justify-content: center;
    }
    .modal-overlay.active { display: flex; }

    .modal {
      background: var(--card);
      width: 100%;
      max-width: 500px;
      border-radius: 20px 20px 0 0;
      max-height: 85vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--card);
      z-index: 1;
    }
    .modal-header h3 { font-size: 17px; font-weight: 600; }
    .modal-close {
      width: 32px;
      height: 32px;
      border: none;
      background: var(--bg);
      border-radius: 50%;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
    }

    .modal-body { padding: 20px; }

    .form-group { margin-bottom: 16px; }
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }
    .form-input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 16px;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-input:focus { border-color: var(--primary); }

    .form-row {
      display: flex;
      gap: 12px;
    }
    .form-row .form-group { flex: 1; }

    .form-checkbox {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
    }
    .form-checkbox input {
      width: 22px;
      height: 22px;
      accent-color: var(--primary);
    }
    .form-checkbox label { font-size: 15px; }

    .form-select {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 16px;
      background: white;
      outline: none;
    }

    .btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:active { opacity: 0.8; }
    .btn-primary {
      background: var(--primary);
      color: white;
    }
    .btn-danger {
      background: var(--danger);
      color: white;
      margin-top: 12px;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* カレンダーサブタブ */
    .sub-tabs {
      display: flex;
      background: var(--card);
      border-radius: 8px;
      padding: 3px;
      margin-bottom: 8px;
      box-shadow: var(--shadow);
    }
    .sub-tab {
      flex: 1;
      padding: 6px;
      text-align: center;
      border: none;
      background: transparent;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .sub-tab.active {
      background: var(--primary);
      color: white;
    }

    .calendar-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card);
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 8px;
      box-shadow: var(--shadow);
    }
    .calendar-nav h2 { font-size: 15px; font-weight: 600; }
    .nav-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: var(--bg);
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .nav-btn:active { background: var(--border); }

    .calendar-month {
      background: var(--card);
      border-radius: 10px;
      padding: 8px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      height: calc(100vh - var(--header-height) - var(--tab-height) - var(--safe-bottom) - 100px);
      min-height: 400px;
    }
    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      flex-shrink: 0;
      background: var(--primary);
      border-radius: 8px 8px 0 0;
      overflow: hidden;
    }
    .weekday {
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: white;
      padding: 10px 0;
    }
    .weekday.sunday { background: #ff6b6b; }
    .weekday.saturday { background: #4dabf7; }

    .calendar-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      grid-template-rows: repeat(6, 1fr);
      gap: 1px;
      flex: 1;
      background: var(--border);
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      padding: 2px;
      background: var(--card);
      font-size: 12px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      min-height: 0;
    }
    .day-number {
      font-weight: 600;
      font-size: 13px;
      text-align: center;
      padding: 2px 0;
      flex-shrink: 0;
    }
    .day-events {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .day-event {
      font-size: 9px;
      padding: 1px 3px;
      background: var(--primary);
      color: white;
      border-radius: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
    .day-event.shared {
      opacity: 0.9;
    }
    .day-more {
      font-size: 9px;
      color: var(--text-muted);
      text-align: center;
      padding: 1px;
    }
    .day:active { background: var(--bg); }
    .day.today .day-number {
      background: var(--primary);
      color: white;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }
    .day.selected { background: rgba(6, 199, 85, 0.1); }
    .day.today.selected { background: rgba(6, 199, 85, 0.1); }
    .day.has-event-old::after {
      content: '';
      width: 5px;
      height: 5px;
      background: #ff6b6b;
      border-radius: 50%;
      position: absolute;
      bottom: 6px;
    }
    .day.other-month { background: var(--bg); }
    .day.other-month .day-number { color: var(--text-muted); }
    .day.sunday .day-number { color: #ff6b6b; }
    .day.saturday .day-number { color: #4dabf7; }
    .day.today.sunday .day-number, .day.today.saturday .day-number { color: white; }

    .calendar-week {
      background: var(--card);
      border-radius: 10px;
      padding: 12px;
      box-shadow: var(--shadow);
    }
    .week-header {
      display: grid;
      grid-template-columns: 50px repeat(7, 1fr);
      background: var(--primary);
      border-radius: 8px 8px 0 0;
      overflow: hidden;
      margin-bottom: 0;
    }
    .week-header-corner {
      background: var(--primary);
    }
    .week-header-cell {
      text-align: center;
      font-size: 11px;
      color: white;
      padding: 8px 0;
      background: var(--primary);
    }
    .week-header-cell.sunday {
      background: #ff6b6b;
    }
    .week-header-cell.saturday {
      background: #4dabf7;
    }
    .week-header-cell .date {
      font-size: 16px;
      font-weight: 600;
      color: white;
      margin-top: 2px;
    }
    .week-header-cell.today .date {
      background: rgba(255,255,255,0.3);
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .week-body { max-height: 400px; overflow-y: auto; }
    .week-row {
      display: grid;
      grid-template-columns: 50px repeat(7, 1fr);
      min-height: 48px;
      border-bottom: 1px solid var(--border);
    }
    .week-time {
      font-size: 11px;
      color: var(--text-muted);
      padding: 4px 8px 4px 0;
      text-align: right;
    }
    .week-cell {
      border-left: 1px solid var(--border);
      position: relative;
      min-height: 48px;
    }
    .week-event {
      position: absolute;
      left: 2px;
      right: 2px;
      background: var(--primary);
      color: white;
      font-size: 10px;
      padding: 2px 4px;
      border-radius: 4px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .calendar-day-view {
      background: var(--card);
      border-radius: 10px;
      padding: 12px;
      box-shadow: var(--shadow);
    }
    .day-header {
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 12px;
    }
    .day-header .date-large {
      font-size: 48px;
      font-weight: 300;
      color: var(--primary);
    }
    .day-header .date-info {
      font-size: 14px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .day-timeline { max-height: 450px; overflow-y: auto; }
    .timeline-row {
      display: flex;
      min-height: 60px;
      border-bottom: 1px solid var(--border);
    }
    .timeline-time {
      width: 60px;
      font-size: 12px;
      color: var(--text-muted);
      padding: 8px 8px 8px 0;
      text-align: right;
      flex-shrink: 0;
    }
    .timeline-content {
      flex: 1;
      border-left: 1px solid var(--border);
      padding: 4px 8px;
      position: relative;
    }
    .timeline-event {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 4px;
      cursor: pointer;
    }
    .timeline-event h4 { font-size: 14px; font-weight: 500; }
    .timeline-event p { font-size: 11px; opacity: 0.9; margin-top: 2px; }

    .events-section { margin-top: 8px; }
    .events-section h3 {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 6px;
      padding: 0 4px;
      padding-left: 4px;
    }
    .event-card {
      background: var(--card);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 8px;
      box-shadow: var(--shadow);
      border-left: 4px solid var(--primary);
      cursor: pointer;
      transition: transform 0.1s;
    }
    .event-card:active { transform: scale(0.98); }
    .event-card h4 { font-size: 15px; font-weight: 500; margin-bottom: 4px; }
    .event-card p { font-size: 13px; color: var(--text-secondary); }

    /* 日付詳細モーダル */
    .day-detail-event {
      padding: 12px;
      background: var(--bg);
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 4px solid var(--primary);
      cursor: pointer;
    }
    .day-detail-event:active { opacity: 0.7; }
    .day-detail-event-title {
      font-size: 15px;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .day-detail-event-time {
      font-size: 13px;
      color: var(--text-secondary);
    }
    .day-detail-event-location {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .day-detail-event .shared-badge {
      display: inline-block;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
      color: white;
    }
    .day-detail-empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
    }
    .day-detail-empty svg {
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    /* 詳細モーダル共通ボタン */
    .detail-btns {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }
    .detail-btns .btn {
      flex: 1;
      min-width: 0;
      padding: 12px 8px;
      font-size: 14px;
    }
    .btn-edit {
      background: #666 !important;
      color: #fff !important;
    }

    /* イベント詳細モーダル */
    .event-detail-content {
      padding: 12px 0;
    }
    .event-detail-row {
      display: flex;
      align-items: flex-start;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .event-detail-row:last-child {
      border-bottom: none;
    }
    .event-detail-icon {
      width: 20px;
      height: 20px;
      margin-right: 10px;
      color: var(--text-secondary);
      flex-shrink: 0;
    }
    .event-detail-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 2px;
    }
    .event-detail-value {
      font-size: 14px;
      color: var(--text);
    }

    .task-list {
      background: var(--card);
      border-radius: 10px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .task-list-header {
      padding: 14px 16px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
      background: var(--bg);
    }
    .task-item {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      gap: 12px;
      cursor: pointer;
    }
    .task-item:last-child { border-bottom: none; }
    .task-item:active { background: var(--bg); }
    .task-checkbox {
      width: 26px;
      height: 26px;
      border: 2px solid var(--border);
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .task-checkbox:active { transform: scale(0.9); }
    .task-checkbox.checked {
      background: var(--primary);
      border-color: var(--primary);
    }
    .task-checkbox.checked::after {
      content: '\\2713';
      color: white;
      font-size: 14px;
    }
    .task-content { flex: 1; min-width: 0; }
    .task-title {
      font-size: 15px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .task-title.completed {
      text-decoration: line-through;
      color: var(--text-muted);
    }
    .task-due {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .task-star { color: #ffc107; font-size: 18px; flex-shrink: 0; }

    /* タスク タブ切替 */
    .task-tabs {
      display: flex;
      background: var(--card);
      border-radius: 10px;
      padding: 4px;
      margin-bottom: 12px;
      box-shadow: var(--shadow);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .task-tab {
      flex: 0 0 auto;
      min-width: 70px;
      padding: 8px 12px;
      text-align: center;
      border: none;
      background: transparent;
      font-size: 12px;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .task-tab.active {
      background: var(--primary);
      color: white;
    }
    .task-tab .tab-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 4px;
      vertical-align: middle;
    }

    /* メモ検索 */
    .memo-search {
      display: flex;
      align-items: center;
      background: var(--card);
      border-radius: 10px;
      padding: 8px 12px;
      margin-bottom: 8px;
      box-shadow: var(--shadow);
      gap: 8px;
    }
    .memo-search svg {
      width: 18px;
      height: 18px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .memo-search input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 14px;
      color: var(--text);
      outline: none;
    }
    .memo-search input::placeholder {
      color: var(--text-muted);
    }
    .memo-search-clear {
      width: 20px;
      height: 20px;
      border: none;
      background: var(--text-muted);
      color: white;
      border-radius: 50%;
      font-size: 12px;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .memo-search-clear.show {
      display: flex;
    }

    /* メモ スタイル切替 */
    .memo-style-selector {
      display: flex;
      background: var(--card);
      border-radius: 10px;
      padding: 4px;
      margin-bottom: 8px;
      box-shadow: var(--shadow);
    }
    .memo-style-btn {
      flex: 1;
      padding: 8px;
      text-align: center;
      border: none;
      background: transparent;
      font-size: 12px;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .memo-style-btn.active {
      background: var(--primary);
      color: white;
    }
    .memo-style-btn svg {
      width: 16px;
      height: 16px;
    }

    /* メモ リスト表示 */
    .memo-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .memo-list .memo-card {
      background: var(--card);
      border-radius: 12px;
      box-shadow: var(--shadow);
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .memo-list .memo-card:active { transform: scale(0.98); }
    .memo-list .memo-card-image {
      width: 100%;
      max-height: 200px;
      object-fit: cover;
    }
    .memo-list .memo-card-content {
      padding: 14px 16px;
    }
    .memo-list .memo-card-text {
      font-size: 14px;
      line-height: 1.5;
      color: var(--text);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .memo-list .memo-card-date {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 8px;
    }

    /* メモ グリッド表示 */
    .memo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .memo-grid .memo-card {
      background: var(--card);
      border-radius: 10px;
      box-shadow: var(--shadow);
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .memo-grid .memo-card:active { transform: scale(0.98); }
    .memo-grid .memo-card-image {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
    }
    .memo-grid .memo-card-content {
      padding: 10px;
    }
    .memo-grid .memo-card-text {
      font-size: 12px;
      line-height: 1.4;
      color: var(--text);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .memo-grid .memo-card-date {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 6px;
    }
    .memo-grid .memo-card.image-only .memo-card-content {
      display: none;
    }

    /* メモ コンパクト表示 */
    .memo-compact {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .memo-compact .memo-card {
      background: var(--card);
      border-radius: 10px;
      box-shadow: var(--shadow);
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.1s;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
    }
    .memo-compact .memo-card:active { transform: scale(0.98); }
    .memo-compact .memo-card-image {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .memo-compact .memo-card-content {
      flex: 1;
      min-width: 0;
    }
    .memo-compact .memo-card-text {
      font-size: 13px;
      line-height: 1.4;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .memo-compact .memo-card-date {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .memo-empty {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
    .memo-empty svg { width: 64px; height: 64px; margin-bottom: 16px; opacity: 0.3; }

    .image-preview-container {
      margin-bottom: 16px;
      position: relative;
      display: none;
    }
    .image-preview-container.has-image { display: block; }
    .image-preview {
      width: 100%;
      max-height: 200px;
      object-fit: cover;
      border-radius: 10px;
    }
    .image-remove-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      background: rgba(0,0,0,0.6);
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
    }
    .image-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .image-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px;
      border: 2px dashed var(--border);
      border-radius: 10px;
      background: var(--bg);
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .image-action-btn:active {
      border-color: var(--primary);
      background: rgba(6, 199, 85, 0.05);
    }
    .image-action-btn svg {
      width: 20px;
      height: 20px;
    }

    .settings-group {
      background: var(--card);
      border-radius: 10px;
      margin-bottom: 12px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .settings-group-title {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--bg);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .settings-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .settings-item:last-child { border-bottom: none; }
    .settings-item.clickable { cursor: pointer; }
    .settings-item.clickable:active { background: var(--bg); }
    .settings-item-label { font-size: 15px; }
    .settings-item-value { font-size: 14px; color: var(--text-muted); }
    .settings-item-arrow { color: var(--text-muted); }

    /* 共有カレンダーカード */
    .project-item {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      gap: 12px;
    }
    .project-item:active { background: var(--bg); }
    .project-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .project-info { flex: 1; min-width: 0; }
    .project-name {
      font-size: 15px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .project-members {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .project-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--primary);
      color: white;
    }

    /* トグルスイッチ */
    .toggle-switch {
      position: relative;
      width: 50px;
      height: 28px;
    }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--border);
      border-radius: 28px;
      transition: 0.3s;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 22px;
      width: 22px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .toggle-switch input:checked + .toggle-slider { background: var(--primary); }
    .toggle-switch input:checked + .toggle-slider:before { transform: translateX(22px); }

    /* 招待コード */
    .invite-code-box {
      background: var(--bg);
      border-radius: 10px;
      padding: 16px;
      text-align: center;
      margin: 16px 0;
    }
    .invite-code {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 4px;
      color: var(--primary);
      font-family: monospace;
    }
    .invite-code-label {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    /* カラーピッカー */
    .color-picker {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .color-option {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid transparent;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .color-option:active { transform: scale(0.9); }
    .color-option.selected { border-color: var(--text); }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }

    .toast {
      position: fixed;
      bottom: calc(150px + var(--safe-bottom));
      left: 50%;
      transform: translateX(-50%);
      background: var(--text);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 300;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="app">
    <div class="header">
      <h1>Project Sync</h1>
      <span class="header-user" id="user-name"></span>
    </div>

    <div class="main">
      <div id="calendar" class="section active">
        <div class="sub-tabs">
          <button class="sub-tab active" data-view="month">月</button>
          <button class="sub-tab" data-view="week">週</button>
          <button class="sub-tab" data-view="day">日</button>
        </div>
        <div class="calendar-nav">
          <button class="nav-btn" id="prev-period">‹</button>
          <h2 id="current-period">2024年1月</h2>
          <button class="nav-btn" id="next-period">›</button>
        </div>
        <div id="calendar-view"></div>
        <div class="events-section" id="events-section"></div>
      </div>

      <div id="tasks" class="section">
        <div class="task-tabs" id="task-tabs"></div>
        <div class="task-list" id="task-list">
          <div class="loading"><div class="loading-spinner"></div>読み込み中...</div>
        </div>
      </div>

      <div id="memo" class="section">
        <div class="memo-search">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input type="text" id="memo-search-input" placeholder="メモを検索...">
          <button class="memo-search-clear" id="memo-search-clear" onclick="clearMemoSearch()">×</button>
        </div>
        <div class="memo-style-selector">
          <button class="memo-style-btn active" data-style="list">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
            リスト
          </button>
          <button class="memo-style-btn" data-style="grid">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z"/></svg>
            グリッド
          </button>
          <button class="memo-style-btn" data-style="compact">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/></svg>
            コンパクト
          </button>
        </div>
        <div id="memo-container">
          <div class="loading"><div class="loading-spinner"></div>読み込み中...</div>
        </div>
      </div>

      <div id="settings" class="section">
        <div class="settings-group">
          <div class="settings-group-title">アカウント</div>
          <div class="settings-item">
            <span class="settings-item-label">ユーザー名</span>
            <span class="settings-item-value" id="settings-username">-</span>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">Google連携</span>
            <span class="settings-item-value">連携済み</span>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">個人カレンダー</div>
          <div id="personal-project-list"></div>
          <div class="settings-item clickable" onclick="openCreateProjectModal(true)">
            <span class="settings-item-label" style="color:var(--primary);">+ 新規個人カレンダー作成</span>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">共有カレンダー</div>
          <div id="shared-project-list"></div>
          <div class="settings-item clickable" onclick="openCreateProjectModal(false)">
            <span class="settings-item-label" style="color:var(--primary);">+ 新規共有カレンダー作成</span>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">共有タスクリスト</div>
          <div id="tasklist-list"></div>
          <div class="settings-item clickable" onclick="openCreateTaskListModal()">
            <span class="settings-item-label" style="color:var(--primary);">+ 新規タスクリスト作成</span>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">テーマカラー</div>
          <div class="color-picker" id="theme-color-picker" style="padding:12px;">
            <div class="color-option selected" data-color="#06c755" style="background:#06c755;"></div>
            <div class="color-option" data-color="#10b981" style="background:#10b981;"></div>
            <div class="color-option" data-color="#14b8a6" style="background:#14b8a6;"></div>
            <div class="color-option" data-color="#06b6d4" style="background:#06b6d4;"></div>
            <div class="color-option" data-color="#0ea5e9" style="background:#0ea5e9;"></div>
            <div class="color-option" data-color="#3b82f6" style="background:#3b82f6;"></div>
            <div class="color-option" data-color="#6366f1" style="background:#6366f1;"></div>
            <div class="color-option" data-color="#8b5cf6" style="background:#8b5cf6;"></div>
            <div class="color-option" data-color="#a855f7" style="background:#a855f7;"></div>
            <div class="color-option" data-color="#d946ef" style="background:#d946ef;"></div>
            <div class="color-option" data-color="#ec4899" style="background:#ec4899;"></div>
            <div class="color-option" data-color="#f43f5e" style="background:#f43f5e;"></div>
            <div class="color-option" data-color="#ef4444" style="background:#ef4444;"></div>
            <div class="color-option" data-color="#f97316" style="background:#f97316;"></div>
            <div class="color-option" data-color="#f59e0b" style="background:#f59e0b;"></div>
            <div class="color-option" data-color="#eab308" style="background:#eab308;"></div>
            <div class="color-option" data-color="#84cc16" style="background:#84cc16;"></div>
            <div class="color-option" data-color="#22c55e" style="background:#22c55e;"></div>
            <div class="color-option" data-color="#78716c" style="background:#78716c;"></div>
            <div class="color-option" data-color="#64748b" style="background:#64748b;"></div>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">表示設定</div>
          <div class="settings-item">
            <span class="settings-item-label">カレンダー初期表示</span>
            <select class="form-select" id="default-view-select" style="width:auto;padding:8px 12px;font-size:14px;">
              <option value="month">月表示</option>
              <option value="week">週表示</option>
              <option value="day">日表示</option>
            </select>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">週の開始日</span>
            <select class="form-select" id="week-start-select" style="width:auto;padding:8px 12px;font-size:14px;">
              <option value="0">日曜日</option>
              <option value="1">月曜日</option>
            </select>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">曜日表記</span>
            <select class="form-select" id="weekday-format-select" style="width:auto;padding:8px 12px;font-size:14px;">
              <option value="ja">漢字 (日月火...)</option>
              <option value="en">英語 (Sun Mon...)</option>
            </select>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">タスクを期限順に表示</span>
            <label class="toggle-switch">
              <input type="checkbox" id="task-sort-toggle" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">通知設定</div>
          <div class="settings-item">
            <span class="settings-item-label">リマインダー通知</span>
            <label class="toggle-switch">
              <input type="checkbox" id="reminder-toggle" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <button class="fab" id="fab-add">+</button>

    <!-- 下部タブバー -->
    <div class="tab-bar">
      <button class="tab-item active" data-tab="calendar">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
        <span>カレンダー</span>
      </button>
      <button class="tab-item" data-tab="tasks">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <span>タスク</span>
      </button>
      <button class="tab-item" data-tab="memo">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
        <span>メモ</span>
      </button>
      <button class="tab-item" data-tab="settings">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        <span>設定</span>
      </button>
    </div>
  </div>

  <!-- 予定作成モーダル -->
  <div class="modal-overlay" id="event-modal">
    <div class="modal">
      <div class="modal-header">
        <h3 id="event-modal-title">予定を追加</h3>
        <button class="modal-close" onclick="closeEventModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">カレンダー</label>
          <select class="form-select" id="event-calendar"></select>
        </div>
        <div class="form-group">
          <label class="form-label">タイトル</label>
          <input type="text" class="form-input" id="event-title" placeholder="予定のタイトル">
        </div>
        <div class="form-group">
          <label class="form-label">日付</label>
          <input type="date" class="form-input" id="event-date">
        </div>
        <div class="form-checkbox">
          <input type="checkbox" id="event-allday">
          <label for="event-allday">終日</label>
        </div>
        <div class="form-row" id="event-time-row">
          <div class="form-group">
            <label class="form-label">開始</label>
            <input type="time" class="form-input" id="event-start" value="09:00">
          </div>
          <div class="form-group">
            <label class="form-label">終了</label>
            <input type="time" class="form-input" id="event-end" value="10:00">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">場所（任意）</label>
          <input type="text" class="form-input" id="event-location" placeholder="場所を入力">
        </div>
        <div class="form-group">
          <label class="form-label">URL（任意）</label>
          <input type="url" class="form-input" id="event-url" placeholder="https://...">
        </div>
        <div class="form-group">
          <label class="form-label">メモ（任意）</label>
          <textarea class="form-input" id="event-memo" placeholder="メモを入力" rows="2" style="resize:none;"></textarea>
        </div>
        <button class="btn btn-primary" id="event-submit" onclick="submitEvent()">追加</button>
        <button class="btn btn-danger" id="event-delete" style="display:none;" onclick="deleteEvent()">削除</button>
      </div>
    </div>
  </div>

  <!-- タスク作成モーダル -->
  <div class="modal-overlay" id="task-modal">
    <div class="modal">
      <div class="modal-header">
        <h3 id="task-modal-title">タスクを追加</h3>
        <button class="modal-close" onclick="closeTaskModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">タイトル</label>
          <input type="text" class="form-input" id="task-title" placeholder="タスクのタイトル">
        </div>
        <div class="form-group">
          <label class="form-label">期限（任意）</label>
          <input type="date" class="form-input" id="task-due">
        </div>
        <div class="form-group">
          <label class="form-label">リスト</label>
          <select class="form-select" id="task-list-select"></select>
        </div>
        <div id="task-create-btns">
          <button class="btn btn-primary" id="task-submit" onclick="submitTask()">追加</button>
        </div>
        <div id="task-detail-btns" class="detail-btns" style="display:none;">
          <button class="btn btn-primary" onclick="completeTaskFromDetail()">完了</button>
          <button class="btn btn-edit" onclick="updateTaskFromDetail()">更新</button>
          <button class="btn btn-danger" onclick="deleteTaskItem()">削除</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 日付詳細モーダル -->
  <div class="modal-overlay" id="day-detail-modal">
    <div class="modal" style="max-height:80vh;">
      <div class="modal-header">
        <h3 id="day-detail-title">1月1日</h3>
        <button class="modal-close" onclick="closeDayDetailModal()">×</button>
      </div>
      <div class="modal-body" id="day-detail-body" style="max-height:60vh;overflow-y:auto;">
      </div>
      <div style="padding:0 20px 20px;">
        <button class="btn btn-primary" onclick="openEventModalForDay()" style="width:100%;">+ 予定を追加</button>
      </div>
    </div>
  </div>

  <!-- イベント詳細モーダル -->
  <div class="modal-overlay" id="event-detail-modal">
    <div class="modal">
      <div class="modal-header">
        <h3 id="event-detail-title">予定の詳細</h3>
        <button class="modal-close" onclick="closeEventDetailModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="event-detail-content">
          <div class="event-detail-row">
            <svg class="event-detail-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
            <div>
              <div class="event-detail-label">日時</div>
              <div class="event-detail-value" id="event-detail-datetime"></div>
            </div>
          </div>
          <div class="event-detail-row" id="event-detail-location-row" style="display:none;">
            <svg class="event-detail-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <div>
              <div class="event-detail-label">場所</div>
              <div class="event-detail-value" id="event-detail-location"></div>
            </div>
          </div>
          <div class="event-detail-row" id="event-detail-url-row" style="display:none;">
            <svg class="event-detail-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
            <div>
              <div class="event-detail-label">URL</div>
              <div class="event-detail-value" id="event-detail-url" style="word-break:break-all;"></div>
            </div>
          </div>
          <div class="event-detail-row" id="event-detail-memo-row" style="display:none;">
            <svg class="event-detail-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            <div>
              <div class="event-detail-label">メモ</div>
              <div class="event-detail-value" id="event-detail-memo" style="white-space:pre-wrap;"></div>
            </div>
          </div>
          <div class="event-detail-row" id="event-detail-calendar-row">
            <svg class="event-detail-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <div>
              <div class="event-detail-label">カレンダー</div>
              <div class="event-detail-value" id="event-detail-calendar"></div>
            </div>
          </div>
        </div>
        <div class="detail-btns">
          <button class="btn btn-edit" onclick="editEventFromDetail()">編集</button>
          <button class="btn btn-danger" onclick="deleteEventFromDetail()">削除</button>
        </div>
      </div>
    </div>
  </div>

  <!-- メモ作成モーダル -->
  <div class="modal-overlay" id="memo-modal">
    <div class="modal">
      <div class="modal-header">
        <h3 id="memo-modal-title">メモを追加</h3>
        <button class="modal-close" onclick="closeMemoModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="image-preview-container" id="image-preview-container">
          <img class="image-preview" id="image-preview">
          <button class="image-remove-btn" onclick="removeImage()">×</button>
        </div>
        <div class="image-actions">
          <label class="image-action-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm9-4h-3.17l-1.83-2H8l-1.83 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>
            撮影
            <input type="file" accept="image/*" capture="environment" style="display:none" onchange="handleImageSelect(event)">
          </label>
          <label class="image-action-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
            選択
            <input type="file" accept="image/*" style="display:none" onchange="handleImageSelect(event)">
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">メモ</label>
          <textarea class="form-input" id="memo-text" placeholder="メモを入力..." rows="4" style="resize:none;"></textarea>
        </div>
        <button class="btn btn-primary" id="memo-submit" onclick="submitMemo()">保存</button>
        <button class="btn btn-danger" id="memo-delete" style="display:none;" onclick="deleteMemoItem()">削除</button>
      </div>
    </div>
  </div>

  <!-- カレンダー作成モーダル -->
  <div class="modal-overlay" id="create-project-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>新規カレンダー作成</h3>
        <button class="modal-close" onclick="closeCreateProjectModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">カレンダー名</label>
          <input type="text" class="form-input" id="project-name" placeholder="例: 家族の予定">
        </div>
        <div class="form-group">
          <label class="form-label">説明（任意）</label>
          <input type="text" class="form-input" id="project-description" placeholder="カレンダーの説明">
        </div>
        <div class="form-group">
          <label class="form-label">カラー</label>
          <div class="color-picker" id="color-picker">
            <div class="color-option selected" data-color="#06c755" style="background:#06c755;"></div>
            <div class="color-option" data-color="#10b981" style="background:#10b981;"></div>
            <div class="color-option" data-color="#14b8a6" style="background:#14b8a6;"></div>
            <div class="color-option" data-color="#06b6d4" style="background:#06b6d4;"></div>
            <div class="color-option" data-color="#0ea5e9" style="background:#0ea5e9;"></div>
            <div class="color-option" data-color="#3b82f6" style="background:#3b82f6;"></div>
            <div class="color-option" data-color="#6366f1" style="background:#6366f1;"></div>
            <div class="color-option" data-color="#8b5cf6" style="background:#8b5cf6;"></div>
            <div class="color-option" data-color="#a855f7" style="background:#a855f7;"></div>
            <div class="color-option" data-color="#d946ef" style="background:#d946ef;"></div>
            <div class="color-option" data-color="#ec4899" style="background:#ec4899;"></div>
            <div class="color-option" data-color="#f43f5e" style="background:#f43f5e;"></div>
            <div class="color-option" data-color="#ef4444" style="background:#ef4444;"></div>
            <div class="color-option" data-color="#f97316" style="background:#f97316;"></div>
            <div class="color-option" data-color="#f59e0b" style="background:#f59e0b;"></div>
            <div class="color-option" data-color="#eab308" style="background:#eab308;"></div>
            <div class="color-option" data-color="#84cc16" style="background:#84cc16;"></div>
            <div class="color-option" data-color="#22c55e" style="background:#22c55e;"></div>
            <div class="color-option" data-color="#78716c" style="background:#78716c;"></div>
            <div class="color-option" data-color="#64748b" style="background:#64748b;"></div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="submitCreateProject()">作成</button>
      </div>
    </div>
  </div>

  <!-- カレンダー参加モーダル -->
  <div class="modal-overlay" id="join-project-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>招待コードで参加</h3>
        <button class="modal-close" onclick="closeJoinProjectModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">招待コード</label>
          <input type="text" class="form-input" id="invite-code-input" placeholder="8桁のコードを入力" maxlength="8" style="text-transform:uppercase;letter-spacing:2px;text-align:center;font-size:18px;">
        </div>
        <button class="btn btn-primary" onclick="submitJoinProject()">参加</button>
      </div>
    </div>
  </div>

  <!-- カレンダー詳細モーダル -->
  <div class="modal-overlay" id="project-detail-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>カレンダー設定</h3>
        <button class="modal-close" onclick="closeProjectDetailModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">カレンダー名</label>
          <input type="text" class="form-input" id="edit-project-name" placeholder="カレンダー名">
        </div>
        <div class="form-group">
          <label class="form-label">カラー</label>
          <div class="color-picker" id="edit-color-picker">
            <div class="color-option selected" data-color="#06c755" style="background:#06c755;"></div>
            <div class="color-option" data-color="#10b981" style="background:#10b981;"></div>
            <div class="color-option" data-color="#14b8a6" style="background:#14b8a6;"></div>
            <div class="color-option" data-color="#06b6d4" style="background:#06b6d4;"></div>
            <div class="color-option" data-color="#0ea5e9" style="background:#0ea5e9;"></div>
            <div class="color-option" data-color="#3b82f6" style="background:#3b82f6;"></div>
            <div class="color-option" data-color="#6366f1" style="background:#6366f1;"></div>
            <div class="color-option" data-color="#8b5cf6" style="background:#8b5cf6;"></div>
            <div class="color-option" data-color="#a855f7" style="background:#a855f7;"></div>
            <div class="color-option" data-color="#d946ef" style="background:#d946ef;"></div>
            <div class="color-option" data-color="#ec4899" style="background:#ec4899;"></div>
            <div class="color-option" data-color="#f43f5e" style="background:#f43f5e;"></div>
            <div class="color-option" data-color="#ef4444" style="background:#ef4444;"></div>
            <div class="color-option" data-color="#f97316" style="background:#f97316;"></div>
            <div class="color-option" data-color="#f59e0b" style="background:#f59e0b;"></div>
            <div class="color-option" data-color="#eab308" style="background:#eab308;"></div>
            <div class="color-option" data-color="#84cc16" style="background:#84cc16;"></div>
            <div class="color-option" data-color="#22c55e" style="background:#22c55e;"></div>
            <div class="color-option" data-color="#78716c" style="background:#78716c;"></div>
            <div class="color-option" data-color="#64748b" style="background:#64748b;"></div>
          </div>
        </div>
        <div class="form-group" id="project-members-group">
          <label class="form-label">メンバー</label>
          <div id="project-members-list"></div>
        </div>
        <button class="btn btn-primary" onclick="saveProjectChanges()" style="margin-bottom:12px;">保存</button>
        <button class="btn btn-primary" id="project-share-btn" onclick="shareProject()" style="margin-bottom:12px;background:#4dabf7;">友だちを招待</button>
        <button class="btn btn-danger" id="project-leave-btn" onclick="leaveCurrentProject()">退出</button>
      </div>
    </div>
  </div>

  <!-- 共有タスクリスト作成モーダル -->
  <div class="modal-overlay" id="create-tasklist-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>新規タスクリスト作成</h3>
        <button class="modal-close" onclick="closeCreateTaskListModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">リスト名</label>
          <input type="text" class="form-input" id="tasklist-name" placeholder="例: 買い物リスト">
        </div>
        <div class="form-group">
          <label class="form-label">カラー</label>
          <div class="color-picker" id="tasklist-color-picker">
            <div class="color-option selected" data-color="#06c755" style="background:#06c755;"></div>
            <div class="color-option" data-color="#10b981" style="background:#10b981;"></div>
            <div class="color-option" data-color="#14b8a6" style="background:#14b8a6;"></div>
            <div class="color-option" data-color="#06b6d4" style="background:#06b6d4;"></div>
            <div class="color-option" data-color="#0ea5e9" style="background:#0ea5e9;"></div>
            <div class="color-option" data-color="#3b82f6" style="background:#3b82f6;"></div>
            <div class="color-option" data-color="#6366f1" style="background:#6366f1;"></div>
            <div class="color-option" data-color="#8b5cf6" style="background:#8b5cf6;"></div>
            <div class="color-option" data-color="#a855f7" style="background:#a855f7;"></div>
            <div class="color-option" data-color="#d946ef" style="background:#d946ef;"></div>
            <div class="color-option" data-color="#ec4899" style="background:#ec4899;"></div>
            <div class="color-option" data-color="#f43f5e" style="background:#f43f5e;"></div>
            <div class="color-option" data-color="#ef4444" style="background:#ef4444;"></div>
            <div class="color-option" data-color="#f97316" style="background:#f97316;"></div>
            <div class="color-option" data-color="#f59e0b" style="background:#f59e0b;"></div>
            <div class="color-option" data-color="#eab308" style="background:#eab308;"></div>
            <div class="color-option" data-color="#84cc16" style="background:#84cc16;"></div>
            <div class="color-option" data-color="#22c55e" style="background:#22c55e;"></div>
            <div class="color-option" data-color="#78716c" style="background:#78716c;"></div>
            <div class="color-option" data-color="#64748b" style="background:#64748b;"></div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="submitCreateTaskList()">作成</button>
      </div>
    </div>
  </div>

  <!-- 共有タスクリスト詳細モーダル -->
  <div class="modal-overlay" id="tasklist-detail-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>タスクリスト設定</h3>
        <button class="modal-close" onclick="closeTaskListDetailModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">リスト名</label>
          <input type="text" class="form-input" id="edit-tasklist-name" placeholder="リスト名">
        </div>
        <div class="form-group">
          <label class="form-label">カラー</label>
          <div class="color-picker" id="edit-tasklist-color-picker">
            <div class="color-option selected" data-color="#06c755" style="background:#06c755;"></div>
            <div class="color-option" data-color="#10b981" style="background:#10b981;"></div>
            <div class="color-option" data-color="#14b8a6" style="background:#14b8a6;"></div>
            <div class="color-option" data-color="#06b6d4" style="background:#06b6d4;"></div>
            <div class="color-option" data-color="#0ea5e9" style="background:#0ea5e9;"></div>
            <div class="color-option" data-color="#3b82f6" style="background:#3b82f6;"></div>
            <div class="color-option" data-color="#6366f1" style="background:#6366f1;"></div>
            <div class="color-option" data-color="#8b5cf6" style="background:#8b5cf6;"></div>
            <div class="color-option" data-color="#a855f7" style="background:#a855f7;"></div>
            <div class="color-option" data-color="#d946ef" style="background:#d946ef;"></div>
            <div class="color-option" data-color="#ec4899" style="background:#ec4899;"></div>
            <div class="color-option" data-color="#f43f5e" style="background:#f43f5e;"></div>
            <div class="color-option" data-color="#ef4444" style="background:#ef4444;"></div>
            <div class="color-option" data-color="#f97316" style="background:#f97316;"></div>
            <div class="color-option" data-color="#f59e0b" style="background:#f59e0b;"></div>
            <div class="color-option" data-color="#eab308" style="background:#eab308;"></div>
            <div class="color-option" data-color="#84cc16" style="background:#84cc16;"></div>
            <div class="color-option" data-color="#22c55e" style="background:#22c55e;"></div>
            <div class="color-option" data-color="#78716c" style="background:#78716c;"></div>
            <div class="color-option" data-color="#64748b" style="background:#64748b;"></div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">メンバー</label>
          <div id="tasklist-members-list"></div>
        </div>
        <button class="btn btn-primary" onclick="saveTaskListChanges()" style="margin-bottom:12px;">保存</button>
        <button class="btn btn-primary" onclick="shareTaskList()" style="margin-bottom:12px;background:#4dabf7;">友だちを招待</button>
        <button class="btn btn-danger" id="tasklist-leave-btn" onclick="leaveCurrentTaskList()">退出</button>
      </div>
    </div>
  </div>

  <!-- トースト -->
  <div class="toast" id="toast"></div>

  <script>
    const LIFF_ID = '${liffId}';
    const API_BASE = '${apiBase}';

    let currentDate = new Date();
    let selectedDate = new Date();
    let currentView = localStorage.getItem('defaultView') || 'month';
    let currentTab = 'calendar';
    let events = [];
    let sharedEvents = [];
    let tasks = [];
    let sharedTasks = [];
    let sharedTaskLists = [];
    let currentTaskList = null;
    let taskLists = [];
    let memos = [];
    let memoStyle = localStorage.getItem('memoStyle') || 'list';
    let themeColor = localStorage.getItem('themeColor') || '#06c755';
    let defaultView = localStorage.getItem('defaultView') || 'month';
    let weekStart = localStorage.getItem('weekStart') || '0';
    let taskSortByDue = localStorage.getItem('taskSortByDue') !== 'false';
    let taskFilter = 'all'; // 'all', 'personal', 'shared', or specific list ID
    let selectedImageBase64 = null;
    let editingMemo = null;
    let projects = [];
    let currentProject = null;
    let selectedProjectColor = '#06c755';
    let userId = null;
    let editingEvent = null;
    let editingTask = null;

    const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
    const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const WEEKDAYS_FULL_JA = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const WEEKDAYS_FULL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let weekdayFormat = localStorage.getItem('weekdayFormat') || 'ja';

    function getWeekdaysBase() {
      return weekdayFormat === 'en' ? WEEKDAYS_EN : WEEKDAYS_JA;
    }

    function getWeekdaysFull() {
      return weekdayFormat === 'en' ? WEEKDAYS_FULL_EN : WEEKDAYS_FULL_JA;
    }

    function getWeekdays() {
      const base = getWeekdaysBase();
      const start = parseInt(weekStart);
      if (start === 0) return base;
      return [...base.slice(start), ...base.slice(0, start)];
    }

    // ========================================
    // LIFF 初期化
    // ========================================
    async function initializeLiff() {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const profile = await liff.getProfile();
        userId = profile.userId;
        document.getElementById('user-name').textContent = profile.displayName;
        document.getElementById('settings-username').textContent = profile.displayName;

        await Promise.all([loadEvents(), loadTasks(), loadTaskLists(), loadMemos(), loadProjects(), loadSharedEvents(), loadSharedTaskLists(), loadSharedTasks()]);
        renderCalendar();
        renderTasks();
        renderMemos();
        renderProjects();
        renderTaskLists();
        loadNotificationSettings();

        // 招待リンクからの参加処理
        await handleJoinFromUrl();

        // テーマカラーと表示設定を適用
        applyThemeColor(themeColor);
        initDisplaySettings();
      } catch (error) {
        console.error('LIFF initialization failed:', error);
        document.getElementById('user-name').textContent = 'エラー';
      }
    }

    function applyThemeColor(color) {
      document.documentElement.style.setProperty('--primary', color);
      // 少し暗いバージョンを生成
      const darkerColor = adjustColor(color, -20);
      document.documentElement.style.setProperty('--primary-dark', darkerColor);
      // FABの影も更新
      const fabShadow = color + '66';
      document.documentElement.style.setProperty('--fab-shadow', '0 4px 12px ' + fabShadow);
    }

    function adjustColor(hex, amount) {
      const num = parseInt(hex.slice(1), 16);
      const r = Math.max(0, Math.min(255, (num >> 16) + amount));
      const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
      const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
      return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function initDisplaySettings() {
      // テーマカラーピッカーの初期化
      document.querySelectorAll('#theme-color-picker .color-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === themeColor);
        el.onclick = function() {
          document.querySelectorAll('#theme-color-picker .color-option').forEach(o => o.classList.remove('selected'));
          this.classList.add('selected');
          themeColor = this.dataset.color;
          localStorage.setItem('themeColor', themeColor);
          applyThemeColor(themeColor);
          showToast('テーマカラーを変更しました');
        };
      });

      // 表示設定の初期化
      const viewSelect = document.getElementById('default-view-select');
      viewSelect.value = defaultView;
      viewSelect.onchange = function() {
        defaultView = this.value;
        localStorage.setItem('defaultView', defaultView);
        showToast('初期表示を変更しました');
      };

      const weekStartSelect = document.getElementById('week-start-select');
      weekStartSelect.value = weekStart;
      weekStartSelect.onchange = function() {
        weekStart = this.value;
        localStorage.setItem('weekStart', weekStart);
        renderCalendar();
        showToast('週の開始日を変更しました');
      };

      const weekdayFormatSelect = document.getElementById('weekday-format-select');
      weekdayFormatSelect.value = weekdayFormat;
      weekdayFormatSelect.onchange = function() {
        weekdayFormat = this.value;
        localStorage.setItem('weekdayFormat', weekdayFormat);
        renderCalendar();
        showToast('曜日表記を変更しました');
      };

      const taskSortToggle = document.getElementById('task-sort-toggle');
      taskSortToggle.checked = taskSortByDue;
      taskSortToggle.onchange = function() {
        taskSortByDue = this.checked;
        localStorage.setItem('taskSortByDue', taskSortByDue);
        renderTasks();
        showToast('タスク表示を変更しました');
      };
    }

    async function handleJoinFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join');
      const joinTaskListCode = params.get('joinTaskList');

      // 共有カレンダーへの参加
      if (joinCode) {
        try {
          const response = await fetch(API_BASE + '/api/projects/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, inviteCode: joinCode })
          });

          const data = await response.json();
          if (response.ok) {
            showToast('「' + data.name + '」に参加しました！');
            await loadProjects();
            renderProjects();
            switchToSettingsTab();
          } else {
            if (data.error.includes('すでに')) {
              showToast('すでにこのカレンダーに参加しています');
            } else {
              showToast(data.error || '参加できませんでした');
            }
          }
        } catch (error) {
          console.error('Failed to join from URL:', error);
          showToast('参加処理中にエラーが発生しました');
        }
      }

      // 共有タスクリストへの参加
      if (joinTaskListCode) {
        try {
          const response = await fetch(API_BASE + '/api/shared-tasklists/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, inviteCode: joinTaskListCode })
          });

          const data = await response.json();
          if (response.ok) {
            showToast('「' + data.name + '」に参加しました！');
            await loadSharedTaskLists();
            await loadSharedTasks();
            renderTaskLists();
            renderTasks();
            switchToSettingsTab();
          } else {
            if (data.error.includes('すでに')) {
              showToast('すでにこのタスクリストに参加しています');
            } else {
              showToast(data.error || '参加できませんでした');
            }
          }
        } catch (error) {
          console.error('Failed to join task list from URL:', error);
          showToast('参加処理中にエラーが発生しました');
        }
      }
    }

    function switchToSettingsTab() {
      const newUrl = window.location.pathname + '?tab=settings';
      window.history.replaceState({}, '', newUrl);
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelector('[data-tab="settings"]').classList.add('active');
      document.getElementById('settings').classList.add('active');
      currentTab = 'settings';
    }

    // ========================================
    // データ読み込み
    // ========================================
    function cacheBust() {
      return '&_t=' + Date.now();
    }

    async function loadEvents() {
      try {
        const response = await fetch(API_BASE + '/api/events?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.ok) events = await response.json();
      } catch (error) {
        console.error('Failed to load events:', error);
      }
    }

    async function loadTasks() {
      try {
        const response = await fetch(API_BASE + '/api/tasks?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.ok) tasks = await response.json();
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    }

    async function loadTaskLists() {
      try {
        const response = await fetch(API_BASE + '/api/tasklists?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.ok) taskLists = await response.json();
      } catch (error) {
        console.error('Failed to load task lists:', error);
      }
    }

    async function loadMemos() {
      try {
        const response = await fetch(API_BASE + '/api/memos?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.ok) memos = await response.json();
      } catch (error) {
        console.error('Failed to load memos:', error);
      }
    }

    async function loadProjects() {
      try {
        const response = await fetch(API_BASE + '/api/projects?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.ok) projects = await response.json();
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    }

    async function loadSharedEvents() {
      try {
        const response = await fetch(API_BASE + '/api/shared-events?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.ok) sharedEvents = await response.json();
      } catch (error) {
        console.error('Failed to load shared events:', error);
      }
    }

    async function loadSharedTaskLists() {
      try {
        const response = await fetch(API_BASE + '/api/shared-tasklists?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.ok) sharedTaskLists = await response.json();
      } catch (error) {
        console.error('Failed to load shared task lists:', error);
      }
    }

    async function loadSharedTasks() {
      try {
        const response = await fetch(API_BASE + '/api/shared-tasks?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.ok) sharedTasks = await response.json();
      } catch (error) {
        console.error('Failed to load shared tasks:', error);
      }
    }

    // 全てのイベント（個人 + 共有）を取得
    function getAllEvents() {
      return [...events, ...sharedEvents];
    }

    // 全てのタスク（個人 + 共有）を取得
    function getAllTasks() {
      return [...tasks, ...sharedTasks];
    }

    // ========================================
    // カレンダー描画
    // ========================================
    function renderCalendar() {
      updatePeriodLabel();
      const container = document.getElementById('calendar-view');
      if (currentView === 'month') container.innerHTML = renderMonthView();
      else if (currentView === 'week') container.innerHTML = renderWeekView();
      else container.innerHTML = renderDayView();
      renderEventsSection();
      attachCalendarListeners();
    }

    function updatePeriodLabel() {
      const label = document.getElementById('current-period');
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      if (currentView === 'month') {
        label.textContent = year + '年' + (month + 1) + '月';
      } else if (currentView === 'week') {
        const ws = getWeekStartDate(currentDate);
        const weekEnd = new Date(ws);
        weekEnd.setDate(weekEnd.getDate() + 6);
        label.textContent = (ws.getMonth() + 1) + '/' + ws.getDate() + ' - ' + (weekEnd.getMonth() + 1) + '/' + weekEnd.getDate();
      } else {
        label.textContent = (month + 1) + '月' + currentDate.getDate() + '日(' + getWeekdaysBase()[currentDate.getDay()] + ')';
      }
    }

    function renderMonthView() {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const ws = parseInt(weekStart);
      let startDayOfWeek = firstDay.getDay() - ws;
      if (startDayOfWeek < 0) startDayOfWeek += 7;
      const today = new Date();
      const weekdays = getWeekdays();
      const allEvents = getAllEvents();
      const maxEventsToShow = 3;

      let html = '<div class="calendar-month"><div class="calendar-weekdays">';
      weekdays.forEach((day, i) => {
        const actualDay = (i + ws) % 7;
        let weekdayClass = 'weekday';
        if (actualDay === 0) weekdayClass += ' sunday';
        else if (actualDay === 6) weekdayClass += ' saturday';
        html += '<div class="' + weekdayClass + '">' + day + '</div>';
      });
      html += '</div><div class="calendar-days">';

      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const d = prevMonthLastDay - i;
        html += '<div class="day other-month"><div class="day-number">' + d + '</div><div class="day-events"></div></div>';
      }

      for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateObj = new Date(year, month, day);
        const isToday = isSameDay(dateObj, today);
        const isSelected = isSameDay(dateObj, selectedDate);
        const dayOfWeek = dateObj.getDay();
        const dateStr = formatDateStr(dateObj);
        const dayEvents = allEvents.filter(e => getEventDateStr(e) === dateStr);

        let classes = ['day'];
        if (isToday) classes.push('today');
        if (isSelected) classes.push('selected');
        if (dayOfWeek === 0) classes.push('sunday');
        if (dayOfWeek === 6) classes.push('saturday');

        html += '<div class="' + classes.join(' ') + '" data-date="' + dateStr + '">';
        html += '<div class="day-number">' + day + '</div>';
        html += '<div class="day-events">';

        const eventsToShow = dayEvents.slice(0, maxEventsToShow);
        eventsToShow.forEach(event => {
          const bgColor = event.isShared && event.projectColor ? event.projectColor : 'var(--primary)';
          const sharedClass = event.isShared ? ' shared' : '';
          html += '<div class="day-event' + sharedClass + '" style="background:' + bgColor + ';">' + (event.summary || '予定') + '</div>';
        });

        if (dayEvents.length > maxEventsToShow) {
          html += '<div class="day-more">+' + (dayEvents.length - maxEventsToShow) + '件</div>';
        }

        html += '</div></div>';
      }

      const totalCells = startDayOfWeek + lastDay.getDate();
      const remaining = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
      for (let i = 1; i <= remaining; i++) {
        html += '<div class="day other-month"><div class="day-number">' + i + '</div><div class="day-events"></div></div>';
      }

      html += '</div></div>';
      return html;
    }

    function renderWeekView() {
      const weekStartDate = getWeekStartDate(currentDate);
      const today = new Date();
      const weekdays = getWeekdays();
      const ws = parseInt(weekStart);
      let html = '<div class="calendar-week"><div class="week-header"><div class="week-header-corner"></div>';

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStartDate);
        date.setDate(date.getDate() + i);
        const isToday = isSameDay(date, today);
        const actualDay = (i + ws) % 7;
        let cellClass = 'week-header-cell';
        if (actualDay === 0) cellClass += ' sunday';
        else if (actualDay === 6) cellClass += ' saturday';
        if (isToday) cellClass += ' today';
        html += '<div class="' + cellClass + '">';
        html += '<div>' + weekdays[i] + '</div>';
        html += '<div class="date">' + date.getDate() + '</div>';
        html += '</div>';
      }
      html += '</div><div class="week-body">';

      for (let hour = 6; hour <= 22; hour++) {
        html += '<div class="week-row"><div class="week-time">' + hour + ':00</div>';
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStartDate);
          date.setDate(date.getDate() + i);
          const dateStr = formatDateStr(date);
          const hourEvents = getEventsForHour(dateStr, hour);
          html += '<div class="week-cell">';
          hourEvents.forEach(event => {
            const bgColor = event.isShared && event.projectColor ? event.projectColor : 'var(--primary)';
            html += '<div class="week-event" style="background:' + bgColor + ';">' + (event.summary || '予定') + '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div></div>';
      return html;
    }

    function renderDayView() {
      const today = new Date();
      const isToday = isSameDay(currentDate, today);
      let html = '<div class="calendar-day-view"><div class="day-header">';
      html += '<div class="date-large">' + currentDate.getDate() + '</div>';
      html += '<div class="date-info">' + (currentDate.getMonth() + 1) + '月 ' + getWeekdaysFull()[currentDate.getDay()];
      if (isToday) html += ' (今日)';
      html += '</div></div><div class="day-timeline">';

      const dateStr = formatDateStr(currentDate);
      for (let hour = 6; hour <= 22; hour++) {
        const hourEvents = getEventsForHour(dateStr, hour);
        html += '<div class="timeline-row"><div class="timeline-time">' + hour + ':00</div><div class="timeline-content">';
        hourEvents.forEach(event => {
          const isShared = event.isShared;
          const bgStyle = isShared && event.projectColor ? 'background:linear-gradient(135deg, ' + event.projectColor + ' 0%, ' + event.projectColor + 'dd 100%);' : '';
          html += '<div class="timeline-event" style="' + bgStyle + '" onclick="showEventDetailModal(\\'' + event.id + '\\', ' + isShared + ', \\'' + (event.projectId || '') + '\\')">';
          if (isShared) html += '<span style="font-size:10px;opacity:0.9;">📅 ' + (event.projectName || '') + '</span>';
          html += '<h4>' + (event.summary || '予定') + '</h4>';
          html += '<p>' + formatEventTime(event) + '</p></div>';
        });
        html += '</div></div>';
      }
      html += '</div></div>';
      return html;
    }

    function renderEventsSection() {
      const container = document.getElementById('events-section');
      const dateStr = formatDateStr(selectedDate);
      const dayEvents = getAllEvents().filter(e => getEventDateStr(e) === dateStr);

      if (currentView !== 'month') { container.innerHTML = ''; return; }

      if (dayEvents.length === 0) {
        container.innerHTML = '<h3>' + (selectedDate.getMonth() + 1) + '/' + selectedDate.getDate() + ' の予定</h3><div class="empty">予定はありません</div>';
        return;
      }

      let html = '<h3>' + (selectedDate.getMonth() + 1) + '/' + selectedDate.getDate() + ' の予定</h3>';
      dayEvents.forEach(event => {
        const isShared = event.isShared;
        const projectName = event.projectName || '';
        const projectColor = event.projectColor || '#06c755';
        const borderStyle = isShared ? 'border-left: 4px solid ' + projectColor + ';' : '';
        html += '<div class="event-card" style="' + borderStyle + '" onclick="showEventDetailModal(\\'' + event.id + '\\', ' + isShared + ', \\'' + (event.projectId || '') + '\\')">';
        if (isShared) html += '<span style="font-size:10px;color:' + projectColor + ';">📅 ' + projectName + '</span>';
        html += '<h4>' + (event.summary || '予定') + '</h4>';
        html += '<p>' + formatEventTime(event) + '</p></div>';
      });
      container.innerHTML = html;
    }

    function attachCalendarListeners() {
      document.querySelectorAll('.day[data-date]').forEach(el => {
        el.addEventListener('click', () => {
          const dateStr = el.dataset.date;
          const parts = dateStr.split('-');
          selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
          renderCalendar();
          openDayDetailModal(dateStr);
        });
      });
    }

    let selectedDayForModal = null;

    function openDayDetailModal(dateStr) {
      selectedDayForModal = dateStr;
      const parts = dateStr.split('-');
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      const dayOfWeek = getWeekdaysBase()[date.getDay()];
      document.getElementById('day-detail-title').textContent = (date.getMonth() + 1) + '月' + date.getDate() + '日(' + dayOfWeek + ')';

      const allEvents = getAllEvents();
      const dayEvents = allEvents.filter(e => getEventDateStr(e) === dateStr);

      const body = document.getElementById('day-detail-body');

      if (dayEvents.length === 0) {
        body.innerHTML = '<div class="day-detail-empty"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg><p>この日に予定はありません</p></div>';
      } else {
        // 時間順にソート
        dayEvents.sort((a, b) => {
          if (a.start.date && !b.start.date) return -1;
          if (!a.start.date && b.start.date) return 1;
          if (a.start.date && b.start.date) return 0;
          return new Date(a.start.dateTime) - new Date(b.start.dateTime);
        });

        let html = '';
        dayEvents.forEach(event => {
          const bgColor = event.isShared && event.projectColor ? event.projectColor : 'var(--primary)';
          html += '<div class="day-detail-event" style="border-left-color:' + bgColor + ';" onclick="showEventDetailModal(\\'' + event.id + '\\', ' + (event.isShared ? 'true' : 'false') + ', \\'' + (event.projectId || '') + '\\')">';
          html += '<div class="day-detail-event-title">' + escapeHtml(event.summary || '予定');
          if (event.isShared) {
            html += '<span class="shared-badge" style="background:' + bgColor + ';">' + escapeHtml(event.projectName || '共有') + '</span>';
          }
          html += '</div>';
          html += '<div class="day-detail-event-time">' + formatEventTime(event) + '</div>';
          if (event.location) {
            html += '<div class="day-detail-event-location">📍 ' + escapeHtml(event.location) + '</div>';
          }
          html += '</div>';
        });
        body.innerHTML = html;
      }

      document.getElementById('day-detail-modal').classList.add('active');
    }

    function closeDayDetailModal() {
      document.getElementById('day-detail-modal').classList.remove('active');
      selectedDayForModal = null;
    }

    function openEventModalForDay() {
      closeDayDetailModal();
      openEventModal();
      if (selectedDayForModal) {
        document.getElementById('event-date').value = selectedDayForModal;
      }
    }

    function showEventDetailModal(eventId, isShared, projectId) {
      closeDayDetailModal();

      let event;
      if (isShared) {
        event = sharedEvents.find(e => e.id === eventId);
      } else {
        event = events.find(e => e.id === eventId);
      }
      if (!event) return;

      editingEvent = event;
      editingEvent._isShared = isShared;
      editingEvent._projectId = projectId || event.projectId;

      // タイトル
      document.getElementById('event-detail-title').textContent = event.summary || '予定';

      // 日時
      const dateStr = getEventDateStr(event);
      const parts = dateStr.split('-');
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      const dayOfWeek = getWeekdaysBase()[date.getDay()];
      let datetimeText = (date.getMonth() + 1) + '月' + date.getDate() + '日(' + dayOfWeek + ')';

      if (event.start.dateTime) {
        const startTime = event.start.dateTime.substring(11, 16);
        const endTime = event.end.dateTime.substring(11, 16);
        datetimeText += ' ' + startTime + ' - ' + endTime;
      } else {
        datetimeText += ' 終日';
      }
      document.getElementById('event-detail-datetime').textContent = datetimeText;

      // 場所
      if (event.location) {
        document.getElementById('event-detail-location').textContent = event.location;
        document.getElementById('event-detail-location-row').style.display = 'flex';
      } else {
        document.getElementById('event-detail-location-row').style.display = 'none';
      }

      // URLとメモ（descriptionから取得）
      const desc = event.description || '';
      const lines = desc.split('\\n');
      const urlLine = lines.find(l => l.startsWith('http'));
      const memoLines = lines.filter(l => !l.startsWith('http') && l.trim()).join('\\n');

      if (urlLine) {
        const urlEl = document.getElementById('event-detail-url');
        urlEl.innerHTML = '<a href="' + urlLine + '" target="_blank" style="color:var(--primary);">' + urlLine + '</a>';
        document.getElementById('event-detail-url-row').style.display = 'flex';
      } else {
        document.getElementById('event-detail-url-row').style.display = 'none';
      }

      if (memoLines) {
        document.getElementById('event-detail-memo').textContent = memoLines;
        document.getElementById('event-detail-memo-row').style.display = 'flex';
      } else {
        document.getElementById('event-detail-memo-row').style.display = 'none';
      }

      // カレンダー
      if (isShared && event.projectName) {
        document.getElementById('event-detail-calendar').textContent = event.projectName + ' (共有)';
      } else {
        document.getElementById('event-detail-calendar').textContent = 'マイカレンダー';
      }

      document.getElementById('event-detail-modal').classList.add('active');
    }

    function closeEventDetailModal() {
      document.getElementById('event-detail-modal').classList.remove('active');
    }

    function editEventFromDetail() {
      closeEventDetailModal();
      if (!editingEvent) return;

      const isShared = editingEvent._isShared;
      const projectId = editingEvent._projectId;

      updateCalendarSelector(isShared ? projectId : '');
      document.getElementById('event-calendar').disabled = true;
      document.getElementById('event-modal-title').textContent = '予定を編集';
      document.getElementById('event-title').value = editingEvent.summary || '';
      document.getElementById('event-date').value = getEventDateStr(editingEvent);

      const isAllDay = !editingEvent.start.dateTime;
      document.getElementById('event-allday').checked = isAllDay;
      document.getElementById('event-time-row').style.display = isAllDay ? 'none' : 'flex';

      if (!isAllDay) {
        document.getElementById('event-start').value = editingEvent.start.dateTime.substring(11, 16);
        document.getElementById('event-end').value = editingEvent.end.dateTime.substring(11, 16);
      }

      document.getElementById('event-location').value = editingEvent.location || '';
      // descriptionからURLとメモを分離（URLは最初の行、残りがメモ）
      const desc = editingEvent.description || '';
      const lines = desc.split('\\n');
      const urlLine = lines.find(l => l.startsWith('http'));
      document.getElementById('event-url').value = urlLine || '';
      document.getElementById('event-memo').value = lines.filter(l => !l.startsWith('http')).join('\\n').trim();

      document.getElementById('event-submit').textContent = '更新';
      document.getElementById('event-submit').style.display = 'block';
      document.getElementById('event-delete').style.display = 'none';
      document.getElementById('event-modal').classList.add('active');
    }

    async function deleteEventFromDetail() {
      if (!editingEvent) return;
      if (!confirm('この予定を削除しますか？')) return;

      try {
        if (editingEvent._isShared) {
          await fetch(API_BASE + '/api/shared-events', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, eventId: editingEvent.id, projectId: editingEvent._projectId })
          });
          showToast('予定を削除しました');
          closeEventDetailModal();
          await loadSharedEvents();
        } else {
          await fetch(API_BASE + '/api/events', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, eventId: editingEvent.id })
          });
          showToast('予定を削除しました');
          closeEventDetailModal();
          await loadEvents();
        }
        renderCalendar();
      } catch (error) {
        console.error('Failed to delete event:', error);
        showToast('削除に失敗しました');
      }
    }

    // ========================================
    // タスク描画
    // ========================================
    function renderTaskTabs() {
      const tabsContainer = document.getElementById('task-tabs');
      let tabsHtml = '';

      // すべてタブ
      tabsHtml += '<button class="task-tab' + (taskFilter === 'all' ? ' active' : '') + '" onclick="setTaskFilter(\\'all\\')">すべて</button>';

      // マイタスクタブ
      tabsHtml += '<button class="task-tab' + (taskFilter === 'personal' ? ' active' : '') + '" onclick="setTaskFilter(\\'personal\\')">マイタスク</button>';

      // 共有タスクリストのタブ
      sharedTaskLists.forEach(list => {
        const isActive = taskFilter === 'list_' + list.id;
        tabsHtml += '<button class="task-tab' + (isActive ? ' active' : '') + '" onclick="setTaskFilter(\\'list_' + list.id + '\\')">';
        tabsHtml += '<span class="tab-dot" style="background:' + list.color + ';"></span>';
        tabsHtml += escapeHtml(list.name);
        tabsHtml += '</button>';
      });

      tabsContainer.innerHTML = tabsHtml;
    }

    function setTaskFilter(filter) {
      taskFilter = filter;
      renderTasks();
    }

    function renderTasks() {
      renderTaskTabs();

      const container = document.getElementById('task-list');
      let allTasks = getAllTasks();

      // フィルタリング
      if (taskFilter === 'personal') {
        allTasks = allTasks.filter(t => !t.isShared);
      } else if (taskFilter.startsWith('list_')) {
        const listId = taskFilter.replace('list_', '');
        allTasks = allTasks.filter(t => t.isShared && t.listId === listId);
      }
      // 'all' の場合はフィルタなし

      if (allTasks.length === 0) {
        const emptyMsg = taskFilter === 'all' ? '未完了のタスクはありません' :
                         taskFilter === 'personal' ? 'マイタスクはありません' :
                         'このリストにタスクはありません';
        container.innerHTML = '<div class="empty">' + emptyMsg + '</div>';
        return;
      }

      // タスクをソート（期限順）
      if (taskSortByDue) {
        allTasks.sort((a, b) => {
          if (!a.due && !b.due) return 0;
          if (!a.due) return 1;
          if (!b.due) return -1;
          return new Date(a.due) - new Date(b.due);
        });
      }

      // フィルタが特定リストの場合はグループ化しない
      if (taskFilter.startsWith('list_')) {
        let html = '';
        allTasks.forEach((task) => {
          const taskIndex = 'shared_' + sharedTasks.indexOf(task);
          html += '<div class="task-item" onclick="openTaskDetail(\\'' + taskIndex + '\\')">';
          html += '<div class="task-checkbox" onclick="event.stopPropagation(); toggleTask(\\'' + taskIndex + '\\')"></div>';
          html += '<div class="task-content"><div class="task-title">' + escapeHtml(task.title) + '</div>';
          if (task.due) html += '<div class="task-due">期限: ' + formatDueDate(task.due) + '</div>';
          html += '</div>';
          if (task.starred) html += '<div class="task-star">★</div>';
          html += '</div>';
        });
        container.innerHTML = html;
        return;
      }

      const grouped = {};
      allTasks.forEach(task => {
        const listName = task.listTitle || (task.isShared ? task.listTitle : 'マイタスク');
        const listColor = task.listColor || null;
        const key = task.isShared ? 'shared_' + task.listId : listName;
        if (!grouped[key]) {
          grouped[key] = { name: listName, color: listColor, isShared: task.isShared, tasks: [] };
        }
        grouped[key].tasks.push(task);
      });

      let html = '';
      Object.entries(grouped).forEach(([key, group]) => {
        const colorStyle = group.color ? ' style="border-left:3px solid ' + group.color + ';padding-left:8px;"' : '';
        const sharedBadge = group.isShared ? '<span style="font-size:10px;color:' + (group.color || 'var(--primary)') + ';margin-left:8px;">共有</span>' : '';
        html += '<div class="task-list-header"' + colorStyle + '>' + group.name + sharedBadge + '</div>';

        group.tasks.forEach((task) => {
          const isShared = task.isShared;
          const taskIndex = isShared ? 'shared_' + sharedTasks.indexOf(task) : tasks.indexOf(task);
          html += '<div class="task-item" onclick="openTaskDetail(\\'' + taskIndex + '\\')">';
          html += '<div class="task-checkbox" onclick="event.stopPropagation(); toggleTask(\\'' + taskIndex + '\\')"></div>';
          html += '<div class="task-content"><div class="task-title">' + escapeHtml(task.title) + '</div>';
          if (task.due) html += '<div class="task-due">期限: ' + formatDueDate(task.due) + '</div>';
          html += '</div>';
          if (task.starred) html += '<div class="task-star">★</div>';
          html += '</div>';
        });
      });
      container.innerHTML = html;
    }

    async function toggleTask(indexStr) {
      const isShared = indexStr.toString().startsWith('shared_');
      const index = isShared ? parseInt(indexStr.replace('shared_', '')) : parseInt(indexStr);
      const task = isShared ? sharedTasks[index] : tasks[index];

      if (!task) return;

      try {
        if (isShared) {
          await fetch(API_BASE + '/api/shared-tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId: task.id, listId: task.listId })
          });
          showToast('タスクを完了しました');
          await loadSharedTasks();
          renderTasks();
        } else {
          await fetch(API_BASE + '/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId: task.id, listId: task.listId })
          });
          showToast('タスクを完了しました');
          tasks.splice(index, 1);
          renderTasks();
        }
      } catch (error) {
        console.error('Failed to complete task:', error);
      }
    }

    // ========================================
    // メモ描画
    // ========================================
    let memoSearchQuery = '';

    function renderMemos() {
      const container = document.getElementById('memo-container');

      // スタイルボタンの状態を更新
      document.querySelectorAll('.memo-style-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.style === memoStyle);
      });

      // 検索フィルタリング
      let filteredMemos = memos;
      if (memoSearchQuery) {
        const query = memoSearchQuery.toLowerCase();
        filteredMemos = memos.filter(memo => {
          const text = (memo.text || '').toLowerCase();
          return text.includes(query);
        });
      }

      if (memos.length === 0) {
        container.innerHTML = '<div class="memo-empty"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg><p>メモはまだありません</p><p style="font-size:12px;margin-top:8px;">+ボタンで追加できます</p></div>';
        return;
      }

      if (filteredMemos.length === 0) {
        container.innerHTML = '<div class="memo-empty"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg><p>「' + escapeHtml(memoSearchQuery) + '」に一致するメモはありません</p></div>';
        return;
      }

      const styleClass = memoStyle === 'grid' ? 'memo-grid' : memoStyle === 'compact' ? 'memo-compact' : 'memo-list';
      let html = '<div class="' + styleClass + '">';

      filteredMemos.forEach((memo) => {
        const index = memos.indexOf(memo);
        const hasImage = !!memo.imageUrl;
        const hasText = !!memo.text;
        const imageOnlyClass = (memoStyle === 'grid' && hasImage && !hasText) ? ' image-only' : '';

        html += '<div class="memo-card' + imageOnlyClass + '" onclick="openMemoDetail(' + index + ')">';

        if (memoStyle === 'compact') {
          // コンパクト: 画像を左に小さく表示
          if (hasImage) {
            html += '<img class="memo-card-image" src="' + memo.imageUrl + '" alt="">';
          }
          html += '<div class="memo-card-content">';
          html += '<div class="memo-card-text">' + (hasText ? escapeHtml(memo.text) : '画像メモ') + '</div>';
          html += '<div class="memo-card-date">' + formatMemoDate(memo.createdAt) + '</div>';
          html += '</div>';
        } else {
          // リスト/グリッド: 画像を上に表示
          if (hasImage) {
            html += '<img class="memo-card-image" src="' + memo.imageUrl + '" alt="">';
          }
          html += '<div class="memo-card-content">';
          if (hasText) {
            html += '<div class="memo-card-text">' + escapeHtml(memo.text) + '</div>';
          }
          html += '<div class="memo-card-date">' + formatMemoDate(memo.createdAt) + '</div>';
          html += '</div>';
        }

        html += '</div>';
      });

      html += '</div>';
      container.innerHTML = html;
    }

    function setMemoStyle(style) {
      memoStyle = style;
      localStorage.setItem('memoStyle', style);
      renderMemos();
    }

    function formatMemoDate(dateStr) {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours === 0) {
          const minutes = Math.floor(diff / (1000 * 60));
          return minutes <= 1 ? 'たった今' : minutes + '分前';
        }
        return hours + '時間前';
      } else if (days === 1) {
        return '昨日';
      } else if (days < 7) {
        return days + '日前';
      } else {
        return (date.getMonth() + 1) + '/' + date.getDate();
      }
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ========================================
    // 共有カレンダー描画
    // ========================================
    function renderProjects() {
      const personalContainer = document.getElementById('personal-project-list');
      const sharedContainer = document.getElementById('shared-project-list');

      const personalProjects = projects.filter(p => p.isPersonal);
      const sharedProjects = projects.filter(p => !p.isPersonal);

      // 個人カレンダー描画
      if (personalProjects.length === 0) {
        personalContainer.innerHTML = '<div style="padding:14px 16px;color:var(--text-muted);font-size:14px;">個人カレンダーはありません</div>';
      } else {
        let personalHtml = '';
        personalProjects.forEach((project) => {
          const index = projects.indexOf(project);
          personalHtml += '<div class="project-item" onclick="openProjectDetail(' + index + ')">';
          personalHtml += '<div class="project-color" style="background:' + project.color + ';"></div>';
          personalHtml += '<div class="project-info">';
          personalHtml += '<div class="project-name">' + escapeHtml(project.name) + '</div>';
          personalHtml += '<div class="project-members">個人用</div>';
          personalHtml += '</div>';
          personalHtml += '</div>';
        });
        personalContainer.innerHTML = personalHtml;
      }

      // 共有カレンダー描画
      if (sharedProjects.length === 0) {
        sharedContainer.innerHTML = '<div style="padding:14px 16px;color:var(--text-muted);font-size:14px;">参加中の共有カレンダーはありません</div>';
      } else {
        let sharedHtml = '';
        sharedProjects.forEach((project) => {
          const index = projects.indexOf(project);
          const isOwner = project.ownerId === userId;
          sharedHtml += '<div class="project-item" onclick="openProjectDetail(' + index + ')">';
          sharedHtml += '<div class="project-color" style="background:' + project.color + ';"></div>';
          sharedHtml += '<div class="project-info">';
          sharedHtml += '<div class="project-name">' + escapeHtml(project.name) + '</div>';
          sharedHtml += '<div class="project-members">' + project.members.length + '人のメンバー</div>';
          sharedHtml += '</div>';
          if (isOwner) sharedHtml += '<span class="project-badge">オーナー</span>';
          sharedHtml += '</div>';
        });
        sharedContainer.innerHTML = sharedHtml;
      }
    }

    // ========================================
    // カレンダーモーダル
    // ========================================
    let isCreatingPersonalCalendar = false;

    function openCreateProjectModal(isPersonal = false) {
      isCreatingPersonalCalendar = isPersonal;
      document.getElementById('project-name').value = '';
      document.getElementById('project-description').value = '';
      selectedProjectColor = '#06c755';
      document.querySelectorAll('.color-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === selectedProjectColor);
      });
      // モーダルタイトルを更新
      const modalTitle = document.querySelector('#create-project-modal h3');
      modalTitle.textContent = isPersonal ? '新規個人カレンダー作成' : '新規共有カレンダー作成';
      document.getElementById('create-project-modal').classList.add('active');
    }

    function closeCreateProjectModal() {
      document.getElementById('create-project-modal').classList.remove('active');
    }

    function openJoinProjectModal() {
      document.getElementById('invite-code-input').value = '';
      document.getElementById('join-project-modal').classList.add('active');
    }

    function closeJoinProjectModal() {
      document.getElementById('join-project-modal').classList.remove('active');
    }

    let editProjectColor = '#06c755';

    function openProjectDetail(index) {
      const project = projects[index];
      if (!project) return;

      currentProject = project;
      editProjectColor = project.color || '#06c755';
      const isPersonal = project.isPersonal;

      // モーダルタイトルを更新
      const modalTitle = document.querySelector('#project-detail-modal h3');
      modalTitle.textContent = isPersonal ? '個人カレンダー設定' : '共有カレンダー設定';

      // 編集フィールドに現在の値をセット
      document.getElementById('edit-project-name').value = project.name;
      document.getElementById('project-leave-btn').textContent = project.ownerId === userId ? 'カレンダーを削除' : '退出';

      // カラーピッカーの選択状態を更新
      document.querySelectorAll('#edit-color-picker .color-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === editProjectColor);
      });

      // メンバーリスト（個人カレンダーは非表示）
      const membersGroup = document.getElementById('project-members-group');
      const shareBtn = document.getElementById('project-share-btn');

      if (isPersonal) {
        membersGroup.style.display = 'none';
        shareBtn.style.display = 'none';
      } else {
        membersGroup.style.display = 'block';
        shareBtn.style.display = 'block';
        // メンバーリスト表示
        const membersList = document.getElementById('project-members-list');
        let membersHtml = '';
        project.members.forEach((memberId, i) => {
          const isOwner = memberId === project.ownerId;
          membersHtml += '<div class="settings-item">';
          membersHtml += '<span class="settings-item-label">メンバー ' + (i + 1) + (isOwner ? ' (オーナー)' : '') + '</span>';
          membersHtml += '</div>';
        });
        membersList.innerHTML = membersHtml;
      }

      // カラーピッカーのイベントリスナー
      document.querySelectorAll('#edit-color-picker .color-option').forEach(el => {
        el.onclick = function() {
          document.querySelectorAll('#edit-color-picker .color-option').forEach(o => o.classList.remove('selected'));
          this.classList.add('selected');
          editProjectColor = this.dataset.color;
        };
      });

      document.getElementById('project-detail-modal').classList.add('active');
    }

    function closeProjectDetailModal() {
      document.getElementById('project-detail-modal').classList.remove('active');
      currentProject = null;
    }

    async function saveProjectChanges() {
      if (!currentProject) return;

      const newName = document.getElementById('edit-project-name').value.trim();
      if (!newName) {
        showToast('カレンダー名を入力してください');
        return;
      }

      try {
        const response = await fetch(API_BASE + '/api/projects/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            projectId: currentProject.id,
            name: newName,
            color: editProjectColor
          })
        });

        if (response.ok) {
          showToast('カレンダーを更新しました');
          closeProjectDetailModal();
          await loadProjects();
          renderProjects();
        } else {
          const data = await response.json();
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (error) {
        console.error('Failed to update project:', error);
        showToast('エラーが発生しました');
      }
    }

    async function submitCreateProject() {
      const name = document.getElementById('project-name').value.trim();
      const description = document.getElementById('project-description').value.trim();

      if (!name) {
        showToast('カレンダー名を入力してください');
        return;
      }

      try {
        const response = await fetch(API_BASE + '/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, name, description, color: selectedProjectColor, isPersonal: isCreatingPersonalCalendar })
        });

        if (response.ok) {
          const calType = isCreatingPersonalCalendar ? '個人カレンダー' : '共有カレンダー';
          showToast(calType + 'を作成しました');
          closeCreateProjectModal();
          await loadProjects();
          renderProjects();
        } else {
          const data = await response.json();
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (error) {
        console.error('Failed to create project:', error);
        showToast('エラーが発生しました');
      }
    }

    async function submitJoinProject() {
      const inviteCode = document.getElementById('invite-code-input').value.trim();

      if (!inviteCode || inviteCode.length !== 8) {
        showToast('8桁の招待コードを入力してください');
        return;
      }

      try {
        const response = await fetch(API_BASE + '/api/projects/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, inviteCode })
        });

        const data = await response.json();
        if (response.ok) {
          showToast('カレンダーに参加しました');
          closeJoinProjectModal();
          await loadProjects();
          renderProjects();
        } else {
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (error) {
        console.error('Failed to join project:', error);
        showToast('エラーが発生しました');
      }
    }

    async function leaveCurrentProject() {
      if (!currentProject) return;

      const isOwner = currentProject.ownerId === userId;
      const message = isOwner ? 'このカレンダーを削除しますか？' : 'このカレンダーから退出しますか？';
      if (!confirm(message)) return;

      try {
        const endpoint = isOwner ? '/api/projects' : '/api/projects/leave';
        const method = isOwner ? 'DELETE' : 'POST';

        const response = await fetch(API_BASE + endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, projectId: currentProject.id })
        });

        if (response.ok) {
          showToast(isOwner ? 'カレンダーを削除しました' : 'カレンダーから退出しました');
          closeProjectDetailModal();
          await loadProjects();
          renderProjects();
        } else {
          const data = await response.json();
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (error) {
        console.error('Failed to leave/delete project:', error);
        showToast('エラーが発生しました');
      }
    }

    function copyInviteCode() {
      if (!currentProject) return;
      navigator.clipboard.writeText(currentProject.inviteCode).then(() => {
        showToast('招待コードをコピーしました');
      }).catch(() => {
        showToast('コピーできませんでした');
      });
    }

    function shareProject() {
      if (!currentProject || !liff.isApiAvailable('shareTargetPicker')) {
        showToast('共有機能が利用できません');
        return;
      }

      const joinUrl = 'https://liff.line.me/' + LIFF_ID + '?join=' + currentProject.inviteCode;

      liff.shareTargetPicker([
        {
          type: 'flex',
          altText: '📅 「' + currentProject.name + '」への招待',
          contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '📅 共有カレンダーへの招待',
                  weight: 'bold',
                  size: 'sm',
                  color: '#06c755'
                }
              ],
              paddingAll: '12px'
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: currentProject.name,
                  weight: 'bold',
                  size: 'lg',
                  wrap: true
                },
                {
                  type: 'text',
                  text: '一緒に予定を共有しましょう！',
                  size: 'sm',
                  color: '#888888',
                  margin: 'md'
                }
              ],
              paddingAll: '12px'
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: '#06c755',
                  action: {
                    type: 'uri',
                    label: '参加する',
                    uri: joinUrl
                  }
                }
              ],
              paddingAll: '12px'
            }
          }
        }
      ]).then((res) => {
        if (res) {
          showToast('招待を送信しました');
          closeProjectDetailModal();
        }
      }).catch((error) => {
        console.error('Share failed:', error);
      });
    }

    // ========================================
    // 共有タスクリスト描画
    // ========================================
    function renderTaskLists() {
      const container = document.getElementById('tasklist-list');
      if (sharedTaskLists.length === 0) {
        container.innerHTML = '<div style="padding:14px 16px;color:var(--text-muted);font-size:14px;">参加中の共有タスクリストはありません</div>';
        return;
      }

      let html = '';
      sharedTaskLists.forEach((list, index) => {
        const isOwner = list.ownerId === userId;
        html += '<div class="project-item" onclick="openTaskListDetail(' + index + ')">';
        html += '<div class="project-color" style="background:' + list.color + ';"></div>';
        html += '<div class="project-info">';
        html += '<div class="project-name">' + escapeHtml(list.name) + '</div>';
        html += '<div class="project-members">' + list.members.length + '人のメンバー</div>';
        html += '</div>';
        if (isOwner) html += '<span class="project-badge">オーナー</span>';
        html += '</div>';
      });
      container.innerHTML = html;
    }

    // ========================================
    // 共有タスクリストモーダル
    // ========================================
    let selectedTaskListColor = '#06c755';
    let editTaskListColor = '#06c755';

    function openCreateTaskListModal() {
      document.getElementById('tasklist-name').value = '';
      selectedTaskListColor = '#06c755';
      document.querySelectorAll('#tasklist-color-picker .color-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === selectedTaskListColor);
        el.onclick = function() {
          document.querySelectorAll('#tasklist-color-picker .color-option').forEach(o => o.classList.remove('selected'));
          this.classList.add('selected');
          selectedTaskListColor = this.dataset.color;
        };
      });
      document.getElementById('create-tasklist-modal').classList.add('active');
    }

    function closeCreateTaskListModal() {
      document.getElementById('create-tasklist-modal').classList.remove('active');
    }

    async function submitCreateTaskList() {
      const name = document.getElementById('tasklist-name').value.trim();

      if (!name) {
        showToast('リスト名を入力してください');
        return;
      }

      try {
        const response = await fetch(API_BASE + '/api/shared-tasklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, name, color: selectedTaskListColor })
        });

        if (response.ok) {
          showToast('タスクリストを作成しました');
          closeCreateTaskListModal();
          await loadSharedTaskLists();
          renderTaskLists();
        } else {
          const data = await response.json();
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (error) {
        console.error('Failed to create task list:', error);
        showToast('エラーが発生しました');
      }
    }

    function openTaskListDetail(index) {
      const list = sharedTaskLists[index];
      if (!list) return;

      currentTaskList = list;
      editTaskListColor = list.color || '#06c755';

      document.getElementById('edit-tasklist-name').value = list.name;
      document.getElementById('tasklist-leave-btn').textContent = list.ownerId === userId ? 'リストを削除' : '退出';

      document.querySelectorAll('#edit-tasklist-color-picker .color-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === editTaskListColor);
        el.onclick = function() {
          document.querySelectorAll('#edit-tasklist-color-picker .color-option').forEach(o => o.classList.remove('selected'));
          this.classList.add('selected');
          editTaskListColor = this.dataset.color;
        };
      });

      const membersList = document.getElementById('tasklist-members-list');
      let membersHtml = '';
      list.members.forEach((memberId, i) => {
        const isOwner = memberId === list.ownerId;
        membersHtml += '<div class="settings-item">';
        membersHtml += '<span class="settings-item-label">メンバー ' + (i + 1) + (isOwner ? ' (オーナー)' : '') + '</span>';
        membersHtml += '</div>';
      });
      membersList.innerHTML = membersHtml;

      document.getElementById('tasklist-detail-modal').classList.add('active');
    }

    function closeTaskListDetailModal() {
      document.getElementById('tasklist-detail-modal').classList.remove('active');
      currentTaskList = null;
    }

    async function saveTaskListChanges() {
      if (!currentTaskList) return;

      const newName = document.getElementById('edit-tasklist-name').value.trim();
      if (!newName) {
        showToast('リスト名を入力してください');
        return;
      }

      try {
        const response = await fetch(API_BASE + '/api/shared-tasklists/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            listId: currentTaskList.id,
            name: newName,
            color: editTaskListColor
          })
        });

        if (response.ok) {
          showToast('タスクリストを更新しました');
          closeTaskListDetailModal();
          await loadSharedTaskLists();
          await loadSharedTasks();
          renderTaskLists();
          renderTasks();
        } else {
          const data = await response.json();
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (error) {
        console.error('Failed to update task list:', error);
        showToast('エラーが発生しました');
      }
    }

    async function leaveCurrentTaskList() {
      if (!currentTaskList) return;

      const isOwner = currentTaskList.ownerId === userId;
      const message = isOwner ? 'このタスクリストを削除しますか？' : 'このタスクリストから退出しますか？';
      if (!confirm(message)) return;

      try {
        const endpoint = isOwner ? '/api/shared-tasklists' : '/api/shared-tasklists/leave';
        const method = isOwner ? 'DELETE' : 'POST';

        const response = await fetch(API_BASE + endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, listId: currentTaskList.id })
        });

        if (response.ok) {
          showToast(isOwner ? 'タスクリストを削除しました' : 'タスクリストから退出しました');
          closeTaskListDetailModal();
          await loadSharedTaskLists();
          await loadSharedTasks();
          renderTaskLists();
          renderTasks();
        } else {
          const data = await response.json();
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (error) {
        console.error('Failed to leave/delete task list:', error);
        showToast('エラーが発生しました');
      }
    }

    function shareTaskList() {
      if (!currentTaskList || !liff.isApiAvailable('shareTargetPicker')) {
        showToast('共有機能が利用できません');
        return;
      }

      const joinUrl = 'https://liff.line.me/' + LIFF_ID + '?joinTaskList=' + currentTaskList.inviteCode;

      liff.shareTargetPicker([
        {
          type: 'flex',
          altText: '✅ 「' + currentTaskList.name + '」への招待',
          contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '✅ 共有タスクリストへの招待',
                  weight: 'bold',
                  size: 'sm',
                  color: currentTaskList.color || '#06c755'
                }
              ],
              paddingAll: '12px'
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: currentTaskList.name,
                  weight: 'bold',
                  size: 'lg',
                  wrap: true
                },
                {
                  type: 'text',
                  text: '一緒にタスクを管理しましょう！',
                  size: 'sm',
                  color: '#888888',
                  margin: 'md'
                }
              ],
              paddingAll: '12px'
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: currentTaskList.color || '#06c755',
                  action: {
                    type: 'uri',
                    label: '参加する',
                    uri: joinUrl
                  }
                }
              ],
              paddingAll: '12px'
            }
          }
        }
      ]).then((res) => {
        if (res) {
          showToast('招待を送信しました');
          closeTaskListDetailModal();
        }
      }).catch((error) => {
        console.error('Share failed:', error);
      });
    }

    // ========================================
    // モーダル
    // ========================================
    function updateCalendarSelector(selectedProjectId = '') {
      const select = document.getElementById('event-calendar');
      let html = '<option value="">Googleカレンダー（個人）</option>';
      projects.forEach(p => {
        const selected = p.id === selectedProjectId ? ' selected' : '';
        html += '<option value="' + p.id + '"' + selected + '>' + p.name + '</option>';
      });
      select.innerHTML = html;
    }

    function openEventModal(isNew = true) {
      editingEvent = null;
      updateCalendarSelector('');
      document.getElementById('event-calendar').disabled = false;
      document.getElementById('event-modal-title').textContent = '予定を追加';
      document.getElementById('event-title').value = '';
      document.getElementById('event-date').value = formatDateStr(selectedDate);
      document.getElementById('event-allday').checked = false;
      document.getElementById('event-start').value = '09:00';
      document.getElementById('event-end').value = '10:00';
      document.getElementById('event-time-row').style.display = 'flex';
      document.getElementById('event-location').value = '';
      document.getElementById('event-url').value = '';
      document.getElementById('event-memo').value = '';
      document.getElementById('event-submit').textContent = '追加';
      document.getElementById('event-submit').style.display = 'block';
      document.getElementById('event-delete').style.display = 'none';
      document.getElementById('event-modal').classList.add('active');
    }

    function closeEventModal() {
      document.getElementById('event-modal').classList.remove('active');
      if (editingEvent) {
        delete editingEvent._isShared;
        delete editingEvent._projectId;
      }
      editingEvent = null;
    }

    function openTaskModal(isNew = true) {
      editingTask = null;
      document.getElementById('task-modal-title').textContent = 'タスクを追加';
      document.getElementById('task-title').value = '';
      document.getElementById('task-due').value = '';

      const select = document.getElementById('task-list-select');
      select.disabled = false;
      let html = '<optgroup label="Googleタスク">';
      html += taskLists.map(list => '<option value="google_' + list.title + '">' + list.title + '</option>').join('');
      html += '</optgroup>';
      if (sharedTaskLists.length > 0) {
        html += '<optgroup label="共有タスクリスト">';
        html += sharedTaskLists.map(list => '<option value="shared_' + list.id + '">' + list.name + '</option>').join('');
        html += '</optgroup>';
      }
      select.innerHTML = html;

      document.getElementById('task-create-btns').style.display = 'block';
      document.getElementById('task-detail-btns').style.display = 'none';
      document.getElementById('task-modal').classList.add('active');
    }

    function openTaskDetail(indexStr) {
      const isShared = indexStr.toString().startsWith('shared_');
      const index = isShared ? parseInt(indexStr.replace('shared_', '')) : parseInt(indexStr);
      const task = isShared ? sharedTasks[index] : tasks[index];
      if (!task) return;

      editingTask = task;
      editingTask._isShared = isShared;
      editingTask._indexStr = indexStr;
      document.getElementById('task-modal-title').textContent = 'タスクの詳細';
      document.getElementById('task-title').value = task.title;
      document.getElementById('task-due').value = task.due ? task.due.substring(0, 10) : '';

      const select = document.getElementById('task-list-select');
      if (isShared) {
        select.innerHTML = '<option value="shared_' + task.listId + '" selected>' + task.listTitle + '</option>';
        select.disabled = true;
      } else {
        select.innerHTML = taskLists.map(list => '<option value="google_' + list.title + '"' + (list.title === task.listTitle ? ' selected' : '') + '>' + list.title + '</option>').join('');
        select.disabled = true;
      }

      document.getElementById('task-create-btns').style.display = 'none';
      document.getElementById('task-detail-btns').style.display = 'flex';
      document.getElementById('task-modal').classList.add('active');
    }

    async function completeTaskFromDetail() {
      if (!editingTask) return;
      const indexStr = editingTask._indexStr;
      closeTaskModal();
      await toggleTask(indexStr);
    }

    async function updateTaskFromDetail() {
      if (!editingTask) return;

      const newTitle = document.getElementById('task-title').value.trim();
      const newDue = document.getElementById('task-due').value || null;

      if (!newTitle) {
        showToast('タイトルを入力してください');
        return;
      }

      try {
        if (editingTask._isShared) {
          // 共有タスクの更新はまだ未実装なので、完了と再作成で対応
          showToast('共有タスクの更新は現在サポートされていません');
          return;
        }

        await fetch(API_BASE + '/api/tasks/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            taskId: editingTask.id,
            listId: editingTask.listId,
            title: newTitle,
            due: newDue
          })
        });
        showToast('タスクを更新しました');
        closeTaskModal();
        await loadTasks();
        renderTasks();
      } catch (error) {
        console.error('Failed to update task:', error);
        showToast('更新に失敗しました');
      }
    }

    function closeTaskModal() {
      document.getElementById('task-modal').classList.remove('active');
      editingTask = null;
    }

    function openMemoModal() {
      editingMemo = null;
      selectedImageBase64 = null;
      document.getElementById('memo-modal-title').textContent = 'メモを追加';
      document.getElementById('memo-text').value = '';
      document.getElementById('image-preview-container').classList.remove('has-image');
      document.getElementById('memo-submit').textContent = '保存';
      document.getElementById('memo-delete').style.display = 'none';
      document.getElementById('memo-modal').classList.add('active');
    }

    function openMemoDetail(index) {
      const memo = memos[index];
      if (!memo) return;

      editingMemo = memo;
      selectedImageBase64 = null;
      document.getElementById('memo-modal-title').textContent = 'メモの詳細';
      document.getElementById('memo-text').value = memo.text || '';

      if (memo.imageUrl) {
        document.getElementById('image-preview').src = memo.imageUrl;
        document.getElementById('image-preview-container').classList.add('has-image');
      } else {
        document.getElementById('image-preview-container').classList.remove('has-image');
      }

      document.getElementById('memo-submit').textContent = '更新';
      document.getElementById('memo-delete').style.display = 'block';
      document.getElementById('memo-modal').classList.add('active');
    }

    function closeMemoModal() {
      document.getElementById('memo-modal').classList.remove('active');
      editingMemo = null;
      selectedImageBase64 = null;
    }

    function handleImageSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        document.getElementById('image-preview').src = dataUrl;
        document.getElementById('image-preview-container').classList.add('has-image');
        selectedImageBase64 = dataUrl.split(',')[1];
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }

    function removeImage() {
      document.getElementById('image-preview-container').classList.remove('has-image');
      selectedImageBase64 = null;
    }

    // ========================================
    // API呼び出し
    // ========================================
    async function submitEvent() {
      const title = document.getElementById('event-title').value.trim();
      const date = document.getElementById('event-date').value;
      const isAllDay = document.getElementById('event-allday').checked;
      const startTime = document.getElementById('event-start').value;
      const endTime = document.getElementById('event-end').value;
      const projectId = document.getElementById('event-calendar').value;
      const location = document.getElementById('event-location').value.trim();
      const url = document.getElementById('event-url').value.trim();
      const memo = document.getElementById('event-memo').value.trim();

      if (!title || !date) {
        showToast('タイトルと日付を入力してください');
        return;
      }

      const btn = document.getElementById('event-submit');
      btn.disabled = true;
      btn.textContent = '保存中...';

      try {
        if (projectId) {
          // 共有カレンダーに追加
          await fetch(API_BASE + '/api/shared-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, projectId, title, date, isAllDay, startTime: isAllDay ? null : startTime, endTime: isAllDay ? null : endTime, location, url, memo })
          });
          await loadSharedEvents();
        } else {
          // 個人のGoogleカレンダーに追加
          const response = await fetch(API_BASE + '/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, title, date, isAllDay, startTime, endTime, location, url, memo })
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || '予定の作成に失敗しました');
          }
          await loadEvents();
        }
        showToast('予定を追加しました');
        closeEventModal();
        renderCalendar();
      } catch (error) {
        console.error('Failed to create event:', error);
        showToast(error.message || 'エラーが発生しました');
      } finally {
        btn.disabled = false;
        btn.textContent = editingEvent ? '更新' : '追加';
      }
    }

    async function deleteEvent() {
      if (!editingEvent) return;
      if (!confirm('この予定を削除しますか？')) return;

      const btn = document.getElementById('event-delete');
      btn.disabled = true;

      try {
        if (editingEvent._isShared) {
          // 共有カレンダーの予定を削除
          await fetch(API_BASE + '/api/shared-events', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, eventId: editingEvent.id, projectId: editingEvent._projectId })
          });
          await loadSharedEvents();
        } else {
          // 個人カレンダーの予定を削除
          await fetch(API_BASE + '/api/events', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, eventId: editingEvent.id })
          });
          await loadEvents();
        }
        showToast('予定を削除しました');
        closeEventModal();
        renderCalendar();
      } catch (error) {
        console.error('Failed to delete event:', error);
        showToast('エラーが発生しました');
      } finally {
        btn.disabled = false;
      }
    }

    async function submitTask() {
      const title = document.getElementById('task-title').value.trim();
      const due = document.getElementById('task-due').value || null;
      const listValue = document.getElementById('task-list-select').value;

      if (!title) {
        showToast('タイトルを入力してください');
        return;
      }

      const btn = document.getElementById('task-submit');
      btn.disabled = true;

      try {
        if (listValue.startsWith('shared_')) {
          // 共有タスクリストに追加
          const listId = listValue.replace('shared_', '');
          await fetch(API_BASE + '/api/shared-tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, listId, title, due })
          });
          await loadSharedTasks();
        } else {
          // Googleタスクに追加
          const listName = listValue.replace('google_', '');
          await fetch(API_BASE + '/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, title, due, listName })
          });
          await loadTasks();
        }
        showToast('タスクを追加しました');
        closeTaskModal();
        renderTasks();
      } catch (error) {
        console.error('Failed to create task:', error);
        showToast('エラーが発生しました');
      } finally {
        btn.disabled = false;
      }
    }

    async function deleteTaskItem() {
      if (!editingTask) return;
      if (!confirm('このタスクを削除しますか？')) return;

      try {
        if (editingTask._isShared) {
          await fetch(API_BASE + '/api/shared-tasks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId: editingTask.id, listId: editingTask.listId })
          });
          showToast('タスクを削除しました');
          closeTaskModal();
          await loadSharedTasks();
        } else {
          await fetch(API_BASE + '/api/tasks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId: editingTask.id, listId: editingTask.listId })
          });
          showToast('タスクを削除しました');
          closeTaskModal();
          await loadTasks();
        }
        renderTasks();
      } catch (error) {
        console.error('Failed to delete task:', error);
        showToast('エラーが発生しました');
      }
    }

    async function submitMemo() {
      const text = document.getElementById('memo-text').value.trim();

      if (!text && !selectedImageBase64) {
        showToast('テキストまたは画像を入力してください');
        return;
      }

      const btn = document.getElementById('memo-submit');
      btn.disabled = true;
      btn.textContent = '保存中...';

      try {
        await fetch(API_BASE + '/api/memos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, text, imageBase64: selectedImageBase64 })
        });
        showToast('メモを保存しました');
        closeMemoModal();
        await loadMemos();
        renderMemos();
      } catch (error) {
        console.error('Failed to create memo:', error);
        showToast('エラーが発生しました');
      } finally {
        btn.disabled = false;
        btn.textContent = '保存';
      }
    }

    async function deleteMemoItem() {
      if (!editingMemo) return;
      if (!confirm('このメモを削除しますか？')) return;

      const btn = document.getElementById('memo-delete');
      btn.disabled = true;

      try {
        await fetch(API_BASE + '/api/memos', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, memoId: editingMemo.id })
        });
        showToast('メモを削除しました');
        closeMemoModal();
        await loadMemos();
        renderMemos();
      } catch (error) {
        console.error('Failed to delete memo:', error);
        showToast('エラーが発生しました');
      } finally {
        btn.disabled = false;
      }
    }

    // ========================================
    // ユーティリティ
    // ========================================
    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function formatDateStr(date) {
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    function getEventDateStr(event) {
      if (event.start.dateTime) return event.start.dateTime.substring(0, 10);
      return event.start.date;
    }

    function isSameDay(d1, d2) {
      return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    }

    function getWeekStartDate(date) {
      const d = new Date(date);
      const ws = parseInt(weekStart);
      let diff = d.getDay() - ws;
      if (diff < 0) diff += 7;
      d.setDate(d.getDate() - diff);
      return d;
    }

    function getEventsForHour(dateStr, hour) {
      return getAllEvents().filter(e => {
        if (!e.start.dateTime) return false;
        if (!e.start.dateTime.startsWith(dateStr)) return false;
        return parseInt(e.start.dateTime.substring(11, 13)) === hour;
      });
    }

    function formatEventTime(event) {
      if (event.start.date) return '終日';
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      return start.getHours() + ':' + String(start.getMinutes()).padStart(2, '0') + ' - ' + end.getHours() + ':' + String(end.getMinutes()).padStart(2, '0');
    }

    function formatDueDate(due) {
      const date = new Date(due);
      return (date.getMonth() + 1) + '/' + date.getDate();
    }

    // ========================================
    // イベントリスナー
    // ========================================
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        document.getElementById(currentTab).classList.add('active');
      });
    });

    document.querySelectorAll('.sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentView = tab.dataset.view;
        if (currentView === 'day') currentDate = new Date(selectedDate);
        renderCalendar();
      });
    });

    document.getElementById('prev-period').addEventListener('click', () => {
      if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
      else if (currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
      else { currentDate.setDate(currentDate.getDate() - 1); selectedDate = new Date(currentDate); }
      renderCalendar();
    });

    document.getElementById('next-period').addEventListener('click', () => {
      if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
      else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
      else { currentDate.setDate(currentDate.getDate() + 1); selectedDate = new Date(currentDate); }
      renderCalendar();
    });

    document.getElementById('fab-add').addEventListener('click', () => {
      if (currentTab === 'calendar') openEventModal();
      else if (currentTab === 'tasks') openTaskModal();
      else if (currentTab === 'memo') openMemoModal();
    });

    document.querySelectorAll('.memo-style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setMemoStyle(btn.dataset.style);
      });
    });

    document.getElementById('memo-search-input').addEventListener('input', (e) => {
      memoSearchQuery = e.target.value;
      const clearBtn = document.getElementById('memo-search-clear');
      clearBtn.classList.toggle('show', memoSearchQuery.length > 0);
      renderMemos();
    });

    function clearMemoSearch() {
      memoSearchQuery = '';
      document.getElementById('memo-search-input').value = '';
      document.getElementById('memo-search-clear').classList.remove('show');
      renderMemos();
    }

    document.querySelectorAll('.color-option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedProjectColor = el.dataset.color;
      });
    });

    document.getElementById('event-allday').addEventListener('change', (e) => {
      document.getElementById('event-time-row').style.display = e.target.checked ? 'none' : 'flex';
    });

    document.getElementById('event-start').addEventListener('change', (e) => {
      const startTime = e.target.value;
      if (startTime) {
        const [hours, minutes] = startTime.split(':').map(Number);
        let endHours = hours + 1;
        if (endHours >= 24) endHours = 23;
        const endTime = String(endHours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
        document.getElementById('event-end').value = endTime;
      }
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    document.getElementById('reminder-toggle').addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      try {
        await fetch(API_BASE + '/api/settings/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, reminderEnabled: enabled })
        });
        showToast(enabled ? '通知をオンにしました' : '通知をオフにしました');
      } catch (error) {
        console.error('Failed to update notification settings:', error);
        e.target.checked = !enabled;
        showToast('設定の更新に失敗しました');
      }
    });

    async function loadNotificationSettings() {
      try {
        const response = await fetch(API_BASE + '/api/settings/notifications?userId=' + userId);
        if (response.ok) {
          const settings = await response.json();
          document.getElementById('reminder-toggle').checked = settings.reminderEnabled !== false;
        }
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      }
    }

    function switchTabFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (['calendar', 'tasks', 'memo', 'settings'].includes(tab)) {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
        document.getElementById(tab).classList.add('active');
        currentTab = tab;
      }
    }
    switchTabFromUrl();

    initializeLiff();
  </script>
</body>
</html>`;
}
