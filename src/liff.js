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
  <title>Project Sync v6</title>
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <script>
    // 早期テーマカラー適用（ちらつき防止）
    (function() {
      var color = localStorage.getItem('themeColor');
      var css = 'body{opacity:0;transition:opacity 0.1s}body.ready{opacity:1}';
      if (color) {
        var num = parseInt(color.slice(1), 16);
        var r = Math.max(0, Math.min(255, (num >> 16) - 20));
        var g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) - 20));
        var b = Math.max(0, Math.min(255, (num & 0x0000FF) - 20));
        var darkerColor = '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
        css += ':root{--primary:' + color + ';--primary-dark:' + darkerColor + ';--fab-shadow:0 4px 12px ' + color + '66;}';
      }
      var style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    })();
  </script>
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

    /* 完了済みタスク */
    .completed-tasks-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px;
      margin-top: 12px;
      background: var(--card);
      border-radius: 10px;
      box-shadow: var(--shadow);
      cursor: pointer;
      font-size: 14px;
      color: var(--text-secondary);
    }
    .completed-tasks-toggle:active { opacity: 0.8; }
    #completed-toggle-icon {
      font-size: 10px;
      transition: transform 0.2s;
    }
    #completed-toggle-icon.open { transform: rotate(90deg); }
    .completed-count {
      margin-left: auto;
      background: var(--bg);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
    }
    .completed-task-list {
      background: var(--card);
      border-radius: 0 0 10px 10px;
      margin-top: -10px;
      padding-top: 10px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .completed-task-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      gap: 12px;
      cursor: pointer;
      opacity: 0.7;
    }
    .completed-task-item:last-child { border-bottom: none; }
    .completed-task-item:active { background: var(--bg); }
    .completed-task-item .task-title {
      text-decoration: line-through;
      color: var(--text-muted);
    }
    .completed-task-item .task-checkbox {
      background: var(--primary);
      border-color: var(--primary);
    }
    .completed-task-item .task-checkbox::after {
      content: '\\2713';
      color: white;
      font-size: 14px;
    }
    .completed-by {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .uncomplete-btn {
      padding: 4px 10px;
      font-size: 11px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .uncomplete-btn:active { background: var(--border); }

    /* メンバー通知トグル */
    .notify-toggle-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: var(--bg);
      border-radius: 10px;
      margin-top: 12px;
    }
    .notify-toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .notify-toggle-label svg {
      width: 20px;
      height: 20px;
      color: var(--primary);
    }
    .toggle-switch {
      position: relative;
      width: 50px;
      height: 28px;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .3s;
      border-radius: 28px;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 22px;
      width: 22px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
    .toggle-switch input:checked + .toggle-slider {
      background-color: var(--primary);
    }
    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(22px);
    }

    /* リマインダーオプション */
    .reminder-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .reminder-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: var(--bg);
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .reminder-option input {
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
    }

    /* カスタムリマインダー */
    .custom-reminder-section {
      margin-top: 12px;
      padding: 12px;
      background: var(--bg);
      border-radius: 10px;
    }
    .custom-reminder-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .custom-reminder-header span {
      font-size: 13px;
      color: var(--text-secondary);
    }
    .custom-reminder-add-btn {
      padding: 4px 10px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .custom-reminder-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .custom-reminder-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: var(--card);
      border-radius: 8px;
    }
    .custom-reminder-item input[type="number"] {
      width: 60px;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 14px;
      text-align: center;
    }
    .custom-reminder-item select {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 14px;
      background: white;
    }
    .custom-reminder-item input[type="time"] {
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 14px;
    }
    .custom-reminder-remove {
      width: 24px;
      height: 24px;
      border: none;
      background: var(--danger);
      color: white;
      border-radius: 50%;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .custom-reminder-empty {
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
      padding: 8px;
    }

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

    /* メモ 並び替え */
    .memo-sort-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .memo-sort-label {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .memo-sort-select {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      background: var(--card);
      color: var(--text);
      outline: none;
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

    /* ファイル添付 */
    .file-attach-section {
      margin-bottom: 16px;
    }
    .file-attach-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--bg);
      border: 1px dashed var(--border);
      border-radius: 10px;
      cursor: pointer;
      width: 100%;
      justify-content: center;
      transition: all 0.2s;
    }
    .file-attach-btn:active {
      border-color: var(--primary);
      background: rgba(6, 199, 85, 0.05);
    }
    .file-attach-btn svg {
      width: 20px;
      height: 20px;
    }
    .selected-file-info {
      display: none;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding: 10px 12px;
      background: var(--bg);
      border-radius: 8px;
    }
    .selected-file-info.show { display: flex; }
    .selected-file-name {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .selected-file-size {
      font-size: 12px;
      color: var(--text-muted);
    }
    .file-remove-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: var(--border);
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
    }

    /* 音声録音UI */
    .voice-recorder {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--bg);
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .record-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #ff4444;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .record-btn:active {
      transform: scale(0.95);
    }
    .record-btn.recording {
      animation: pulse 1s infinite;
    }
    .record-btn svg {
      width: 24px;
      height: 24px;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    .record-info {
      flex: 1;
    }
    .record-status {
      font-size: 14px;
      color: var(--text);
    }
    .record-time {
      font-size: 24px;
      font-weight: 600;
      color: var(--text);
      font-variant-numeric: tabular-nums;
      display: none;
    }
    .record-time.show { display: block; }

    /* 録音済み音声プレビュー */
    .recorded-audio {
      display: none;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding: 10px 12px;
      background: var(--bg);
      border-radius: 8px;
    }
    .recorded-audio.show { display: flex; }
    .recorded-audio audio {
      flex: 1;
      height: 36px;
    }
    .audio-remove-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: var(--border);
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
    }

    /* メモ一覧の音声・ファイル表示 */
    .memo-audio-player {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg);
      border-radius: 20px;
      margin-top: 8px;
    }
    .memo-audio-player audio {
      flex: 1;
      height: 32px;
    }
    .memo-audio-duration {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .memo-file-attachment {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--bg);
      border-radius: 8px;
      margin-top: 8px;
      text-decoration: none;
      color: var(--text);
      transition: background 0.2s;
    }
    .memo-file-attachment:active {
      background: var(--border);
    }
    .memo-file-attachment svg {
      width: 20px;
      height: 20px;
      color: var(--primary);
    }
    .memo-file-name {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .memo-file-size {
      font-size: 11px;
      color: var(--text-muted);
    }

    /* 使い方ガイド */
    .help-section {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .help-section:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
    }
    .help-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 10px;
      color: var(--text);
    }
    .help-icon {
      font-size: 20px;
    }
    .help-content {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-secondary);
    }
    .help-content p {
      margin-bottom: 8px;
    }
    .help-content p:last-child {
      margin-bottom: 0;
    }
    .help-content strong {
      color: var(--text);
    }

    /* バックアップリスト */
    .backup-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .backup-item {
      background: var(--bg);
      border-radius: 10px;
      padding: 14px;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .backup-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .backup-item:active {
      transform: translateY(0);
    }
    .backup-date {
      font-weight: 600;
      color: var(--text);
      margin-bottom: 6px;
      font-size: 14px;
    }
    .backup-info {
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Claude Chat */
    .claude-chat-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 180px);
      background: var(--card);
      border-radius: 12px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .claude-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 16px;
      text-align: center;
    }
    .claude-status {
      font-size: 13px;
      opacity: 0.9;
    }
    .claude-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .claude-message {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 18px;
      line-height: 1.5;
      font-size: 14px;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .claude-message.user {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .claude-message.assistant {
      background: var(--bg);
      color: var(--text);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .claude-message.system {
      background: var(--bg);
      color: var(--text-muted);
      align-self: center;
      font-size: 13px;
      padding: 8px 16px;
    }
    .claude-message.error {
      background: #ffebee;
      color: #c62828;
      align-self: center;
    }
    .claude-typing {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: var(--bg);
      border-radius: 18px;
      align-self: flex-start;
    }
    .claude-typing span {
      width: 8px;
      height: 8px;
      background: #667eea;
      border-radius: 50%;
      animation: claudeTyping 1.4s infinite ease-in-out;
    }
    .claude-typing span:nth-child(2) { animation-delay: 0.2s; }
    .claude-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes claudeTyping {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-8px); }
    }
    .claude-input-area {
      display: flex;
      gap: 10px;
      padding: 12px;
      background: var(--card);
      border-top: 1px solid var(--border);
    }
    .claude-input-area input {
      flex: 1;
      border: 2px solid var(--border);
      border-radius: 24px;
      padding: 12px 16px;
      font-size: 15px;
      outline: none;
      background: var(--bg);
      color: var(--text);
    }
    .claude-input-area input:focus {
      border-color: #667eea;
    }
    .claude-input-area button {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
    }
    .claude-input-area button:disabled {
      opacity: 0.5;
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

    .auth-banner {
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      color: white;
      padding: 16px;
      border-radius: 0 0 12px 12px;
      margin: 0;
      display: none;
      text-align: center;
      box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 200;
    }
    .auth-banner.show { display: block; }
    body.needs-auth .section { padding-top: 130px; }
    .auth-banner h3 {
      font-size: 16px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .auth-banner p {
      font-size: 13px;
      margin-bottom: 12px;
      opacity: 0.95;
    }
    .auth-banner-btn {
      display: inline-block;
      background: white;
      color: #f57c00;
      padding: 10px 24px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      border: none;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .auth-banner-btn:active {
      transform: scale(0.98);
      opacity: 0.9;
    }
  </style>
</head>
<body>
<script>document.body.classList.add('ready');</script>
  <div class="app">
    <div class="header">
      <h1>Project Sync</h1>
      <span class="header-user" id="user-name"></span>
    </div>

    <!-- Auth Banner -->
    <div class="auth-banner" id="auth-banner">
      <h3>🔐 Google連携が必要です</h3>
      <p>カレンダーやタスクを利用するには、<br>Googleアカウントとの連携が必要です。</p>
      <button class="auth-banner-btn" id="auth-banner-btn" onclick="openGoogleAuth()">Googleアカウントを連携</button>
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
        <div class="completed-tasks-toggle" onclick="toggleShowCompletedTasks()">
          <span id="completed-toggle-icon">▶</span>
          <span>完了済みタスク</span>
          <span id="completed-count" class="completed-count"></span>
        </div>
        <div class="completed-task-list" id="completed-task-list" style="display:none;"></div>
      </div>

      <div id="memo" class="section">
        <div class="memo-search">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input type="text" id="memo-search-input" placeholder="メモを検索...">
          <button class="memo-search-clear" id="memo-search-clear" onclick="clearMemoSearch()">×</button>
        </div>
        <div class="memo-sort-row">
          <span class="memo-sort-label">並び替え:</span>
          <select class="memo-sort-select" id="memo-sort-select" onchange="changeMemoSort(this.value)">
            <option value="created_desc">作成日（新しい順）</option>
            <option value="created_asc">作成日（古い順）</option>
            <option value="updated_desc">更新日（新しい順）</option>
            <option value="updated_asc">更新日（古い順）</option>
          </select>
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

      <!-- Claudeセクション -->
      <div id="claude" class="section">
        <div class="claude-chat-container">
          <div class="claude-header">
            <div class="claude-status" id="claude-status">接続中...</div>
          </div>
          <div class="claude-messages" id="claude-messages">
            <div class="claude-message system">Claude Code に何でも指示できます</div>
          </div>
          <div class="claude-input-area">
            <input type="text" id="claude-input" placeholder="メッセージを入力..." onkeypress="if(event.keyCode===13)sendClaudeMessage()">
            <button id="claude-send-btn" onclick="sendClaudeMessage()">➤</button>
          </div>
        </div>
      </div>

      <div id="settings" class="section">
        <div class="settings-group">
          <div class="settings-group-title">アカウント</div>
          <div class="settings-item">
            <span class="settings-item-label">ユーザー名</span>
            <span class="settings-item-value" id="settings-username">-</span>
          </div>
          <div class="settings-item" id="google-auth-status">
            <span class="settings-item-label">Google連携</span>
            <span class="settings-item-value" id="google-auth-value">確認中...</span>
            <button id="google-auth-revoke-btn" onclick="revokeGoogleAuth()" style="display:none;color:var(--danger);background:none;border:none;text-decoration:underline;font-size:12px;cursor:pointer;margin-left:8px;">解除</button>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">Google同期</div>
          <div class="settings-item">
            <span class="settings-item-label">Googleカレンダー同期</span>
            <label class="toggle-switch">
              <input type="checkbox" id="google-calendar-sync-toggle">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-item">
            <span class="settings-item-label">Googleタスク同期</span>
            <label class="toggle-switch">
              <input type="checkbox" id="google-tasks-sync-toggle">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div id="sync-status-message" style="padding:8px 16px;font-size:13px;color:var(--text-muted);display:none;"></div>
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
          <div class="settings-group-title">タグ管理</div>
          <div id="tag-list-container" style="padding:8px 16px;">
            <div id="tag-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;"></div>
          </div>
          <div class="settings-item clickable" onclick="openTagModal()">
            <span class="settings-item-label" style="color:var(--primary);">+ 新規タグ作成</span>
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
        <div class="settings-group">
          <div class="settings-group-title">データバックアップ</div>
          <div class="settings-item">
            <span class="settings-item-label">自動バックアップ</span>
            <label class="toggle-switch">
              <input type="checkbox" id="auto-backup-toggle" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-item" style="flex-direction:column;align-items:flex-start;gap:4px;">
            <span class="settings-item-label" style="font-size:12px;color:#666;" id="last-backup-time">最終バックアップ: --</span>
          </div>
          <div class="settings-item clickable" onclick="createManualBackup()">
            <span class="settings-item-label" style="color:var(--primary);">手動バックアップを作成</span>
          </div>
          <div class="settings-item clickable" onclick="openBackupListModal()">
            <span class="settings-item-label" style="color:var(--primary);">バックアップから復元</span>
          </div>
          <div class="settings-item clickable" onclick="exportBackupAsJson()">
            <span class="settings-item-label" style="color:var(--primary);">JSONエクスポート</span>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">ヘルプ</div>
          <div class="settings-item clickable" onclick="openHelpModal()">
            <span class="settings-item-label" style="color:var(--primary);">📖 使い方ガイドを見る</span>
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
      <button class="tab-item" data-tab="claude">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        <span>Claude</span>
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
        <div class="form-group" id="event-tags-group">
          <label class="form-label">タグ</label>
          <div id="event-tag-selector" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>
        <div class="form-group" id="event-reminder-group">
          <label class="form-label">リマインダー</label>
          <div class="reminder-options">
            <label class="reminder-option">
              <input type="checkbox" id="event-reminder-day-before" value="day_before">
              <span>前日18時</span>
            </label>
            <label class="reminder-option">
              <input type="checkbox" id="event-reminder-morning" value="morning">
              <span>当日朝9時</span>
            </label>
            <label class="reminder-option" id="event-reminder-1hour-option">
              <input type="checkbox" id="event-reminder-1hour" value="1hour_before">
              <span>1時間前</span>
            </label>
          </div>
          <div class="custom-reminder-section">
            <div class="custom-reminder-header">
              <span>カスタムリマインダー</span>
              <button type="button" class="custom-reminder-add-btn" onclick="addEventCustomReminder()">+ 追加</button>
            </div>
            <div class="custom-reminder-list" id="event-custom-reminders">
              <div class="custom-reminder-empty">カスタムリマインダーなし</div>
            </div>
          </div>
        </div>
        <div class="form-group" id="event-notify-group" style="display:none;">
          <div class="notify-toggle-group">
            <div class="notify-toggle-label">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
              <span>メンバーに通知</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="event-notify-members">
              <span class="toggle-slider"></span>
            </label>
          </div>
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
        <div class="form-group" id="task-time-row">
          <label class="form-label">時刻（任意）</label>
          <input type="time" class="form-input" id="task-due-time">
        </div>
        <div class="form-group" id="task-reminder-group">
          <label class="form-label">リマインダー</label>
          <div class="reminder-options">
            <label class="reminder-option">
              <input type="checkbox" id="task-reminder-1week" value="1week_before">
              <span>1週間前</span>
            </label>
            <label class="reminder-option">
              <input type="checkbox" id="task-reminder-3days" value="3days_before">
              <span>3日前</span>
            </label>
            <label class="reminder-option">
              <input type="checkbox" id="task-reminder-day-before" value="day_before">
              <span>前日18時</span>
            </label>
            <label class="reminder-option">
              <input type="checkbox" id="task-reminder-morning" value="morning">
              <span>当日朝9時</span>
            </label>
          </div>
          <div class="custom-reminder-section">
            <div class="custom-reminder-header">
              <span>カスタムリマインダー</span>
              <button type="button" class="custom-reminder-add-btn" onclick="addTaskCustomReminder()">+ 追加</button>
            </div>
            <div class="custom-reminder-list" id="task-custom-reminders">
              <div class="custom-reminder-empty">カスタムリマインダーなし</div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">リスト</label>
          <select class="form-select" id="task-list-select"></select>
        </div>
        <div class="form-group" id="task-reminder-display" style="display:none;">
          <label class="form-label">🔔 リマインダー</label>
          <div id="task-reminder-text" style="color:var(--text-secondary);font-size:14px;"></div>
        </div>
        <div class="form-group" id="task-notify-group" style="display:none;">
          <div class="notify-toggle-group">
            <div class="notify-toggle-label">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
              <span>メンバーに通知</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="task-notify-members">
              <span class="toggle-slider"></span>
            </label>
          </div>
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
          <div class="event-detail-row" id="event-detail-reminder-row" style="display:none;">
            <svg class="event-detail-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
            <div>
              <div class="event-detail-label">リマインダー</div>
              <div class="event-detail-value" id="event-detail-reminder"></div>
            </div>
          </div>
          <div class="event-detail-row" id="event-detail-tags-row" style="display:none;">
            <svg class="event-detail-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>
            <div>
              <div class="event-detail-label">タグ</div>
              <div class="event-detail-value" id="event-detail-tags" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
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
        <!-- 画像プレビュー -->
        <div class="image-preview-container" id="image-preview-container">
          <img class="image-preview" id="image-preview">
          <button class="image-remove-btn" onclick="removeImage()">×</button>
        </div>

        <!-- 画像選択 -->
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

        <!-- ファイル添付 -->
        <div class="file-attach-section" id="file-attach-section">
          <label class="file-attach-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
            ファイルを添付
            <input type="file" id="memo-file" style="display:none" onchange="handleFileSelect(event)">
          </label>
          <div class="selected-file-info" id="selected-file-info">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px;color:var(--primary);flex-shrink:0;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            <span class="selected-file-name" id="selected-file-name"></span>
            <span class="selected-file-size" id="selected-file-size"></span>
            <button class="file-remove-btn" onclick="clearSelectedFile()">×</button>
          </div>
        </div>

        <!-- 音声録音 -->
        <div class="form-group">
          <label class="form-label">ボイスメモ</label>
          <div class="voice-recorder" id="voice-recorder">
            <button type="button" id="record-btn" class="record-btn" onclick="toggleRecording()">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
            </button>
            <div class="record-info">
              <div class="record-status" id="record-status">タップして録音</div>
              <div class="record-time" id="record-time">00:00</div>
            </div>
          </div>
          <div class="recorded-audio" id="recorded-audio">
            <audio id="audio-preview" controls></audio>
            <button class="audio-remove-btn" onclick="clearRecordedAudio()">×</button>
          </div>
        </div>

        <!-- 既存の音声表示（編集時） -->
        <div class="memo-audio-player" id="existing-audio" style="display:none;">
          <audio id="existing-audio-player" controls></audio>
          <span id="existing-audio-duration" class="memo-audio-duration"></span>
        </div>

        <!-- 既存のファイル表示（編集時） -->
        <div id="existing-file" style="display:none;margin-bottom:16px;">
          <a id="existing-file-link" class="memo-file-attachment" href="#" target="_blank">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            <span class="memo-file-name" id="existing-file-name"></span>
          </a>
        </div>

        <!-- メモテキスト -->
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
        <div class="form-group">
          <label class="form-label">編集権限</label>
          <select class="form-input" id="project-edit-permission">
            <option value="all">全員が編集可能</option>
            <option value="owner">オーナーのみ編集可能</option>
          </select>
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
        <div class="form-group">
          <label class="form-label">編集権限</label>
          <select class="form-input" id="tasklist-edit-permission">
            <option value="all">全員が編集可能</option>
            <option value="owner">オーナーのみ編集可能</option>
          </select>
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

  <!-- タグ管理モーダル -->
  <div class="modal-overlay" id="tag-modal">
    <div class="modal">
      <div class="modal-header">
        <h3 id="tag-modal-title">タグを作成</h3>
        <button class="modal-close" onclick="closeTagModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">タグ名</label>
          <input type="text" class="form-input" id="tag-name-input" placeholder="例: 仕事、プライベート">
        </div>
        <div class="form-group">
          <label class="form-label">カラー</label>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <input type="color" id="tag-color-input" value="#06c755" style="width:50px;height:40px;border:none;cursor:pointer;border-radius:8px;">
            <span id="tag-color-preview" style="display:inline-block;width:100px;height:40px;border-radius:8px;background:#06c755;"></span>
          </div>
          <div class="color-picker" id="tag-color-picker" style="margin-top:8px;">
            <div class="color-option" data-color="#ff4757" style="background:#ff4757;" title="重要"></div>
            <div class="color-option" data-color="#ff7f50" style="background:#ff7f50;" title="注意"></div>
            <div class="color-option" data-color="#ffd93d" style="background:#ffd93d;" title="メモ"></div>
            <div class="color-option selected" data-color="#06c755" style="background:#06c755;" title="仕事"></div>
            <div class="color-option" data-color="#4dabf7" style="background:#4dabf7;" title="個人"></div>
            <div class="color-option" data-color="#a855f7" style="background:#a855f7;" title="趣味"></div>
            <div class="color-option" data-color="#ff6b9d" style="background:#ff6b9d;" title="家族"></div>
            <div class="color-option" data-color="#868e96" style="background:#868e96;" title="その他"></div>
          </div>
        </div>
        <input type="hidden" id="editing-tag-id">
        <button class="btn btn-primary" onclick="saveTag()" style="margin-bottom:12px;">保存</button>
        <button class="btn btn-danger" id="delete-tag-btn" onclick="deleteCurrentTag()" style="display:none;">削除</button>
      </div>
    </div>
  </div>

  <!-- 使い方モーダル -->
  <div class="modal-overlay" id="help-modal">
    <div class="modal" style="max-height:90vh;">
      <div class="modal-header">
        <h3>使い方ガイド</h3>
        <button class="modal-close" onclick="closeHelpModal()">×</button>
      </div>
      <div class="modal-body" style="padding:16px;">
        <!-- カレンダー -->
        <div class="help-section">
          <div class="help-title">
            <span class="help-icon">📅</span>
            <span>カレンダー</span>
          </div>
          <div class="help-content">
            <p><strong>予定を追加：</strong>右下の「+」ボタンをタップ、またはカレンダーの日付をタップして予定を作成できます。</p>
            <p><strong>表示切替：</strong>月・週・日表示を切り替えられます。</p>
            <p><strong>予定の編集・削除：</strong>予定をタップして詳細を開き、編集または削除できます。</p>
          </div>
        </div>

        <!-- タスク -->
        <div class="help-section">
          <div class="help-title">
            <span class="help-icon">✅</span>
            <span>タスク</span>
          </div>
          <div class="help-content">
            <p><strong>タスクを追加：</strong>右下の「+」ボタンをタップしてタスクを作成できます。</p>
            <p><strong>タスクを完了：</strong>タスク左のチェックボックスをタップすると完了になります。</p>
            <p><strong>期限設定：</strong>タスクには期限と時刻を設定できます。</p>
          </div>
        </div>

        <!-- メモ -->
        <div class="help-section">
          <div class="help-title">
            <span class="help-icon">📝</span>
            <span>メモ</span>
          </div>
          <div class="help-content">
            <p><strong>メモを追加：</strong>テキスト、画像、ファイル、音声を保存できます。</p>
            <p><strong>表示切替：</strong>リスト表示とグリッド表示を切り替えられます。</p>
          </div>
        </div>

        <!-- Google同期 -->
        <div class="help-section">
          <div class="help-title">
            <span class="help-icon">🔄</span>
            <span>Google同期</span>
          </div>
          <div class="help-content">
            <p><strong>同期オフ（初期状態）：</strong>データはローカルに保存されます。Googleアカウント不要です。</p>
            <p><strong>同期オン：</strong>設定画面で同期をオンにすると、Googleカレンダー・Googleタスクと連携できます。</p>
            <p><strong>切り替え：</strong>設定 → Google同期 から切り替えできます。</p>
          </div>
        </div>

        <!-- 共有機能 -->
        <div class="help-section">
          <div class="help-title">
            <span class="help-icon">👥</span>
            <span>共有カレンダー</span>
          </div>
          <div class="help-content">
            <p style="margin-bottom:12px;">家族や友人、チームで予定を共有できる機能です。</p>

            <p><strong>🆕 共有カレンダーを作成する</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">設定 → 共有カレンダー → 「+ 新規共有カレンダー作成」をタップ → 名前を入力して作成</p>

            <p><strong>📨 メンバーを招待する</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">作成したカレンダーをタップ → 「招待コード」が表示されます → このコードをLINEやメールで共有相手に送ってください</p>

            <p><strong>🔗 招待されたカレンダーに参加する</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">設定 → 共有カレンダー → 「招待コードで参加」をタップ → 受け取ったコードを入力 → 参加完了！</p>

            <p><strong>📅 共有カレンダーに予定を追加</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">予定作成時に「カレンダー」から共有カレンダーを選択 → 「メンバーに通知」をオンにすると、追加時に全員にLINE通知が届きます</p>

            <p><strong>🚪 退出・削除</strong></p>
            <p style="margin-left:12px;">カレンダーをタップ → 「退出」で自分だけ抜けられます。オーナーは「削除」でカレンダーごと削除できます</p>
          </div>
        </div>

        <!-- 共有タスクリスト -->
        <div class="help-section">
          <div class="help-title">
            <span class="help-icon">📋</span>
            <span>共有タスクリスト</span>
          </div>
          <div class="help-content">
            <p style="margin-bottom:12px;">買い物リストやTODOをみんなで共有できます。</p>

            <p><strong>🆕 共有タスクリストを作成する</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">設定 → 共有タスクリスト → 「+ 新規タスクリスト作成」をタップ</p>

            <p><strong>📨 メンバーを招待する</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">作成したリストをタップ → 招待コードを共有相手に送ってください</p>

            <p><strong>✅ タスクを追加・完了</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">タスク作成時にリストを選択 → 誰かがタスクを完了すると、完了者の名前が表示されます</p>

            <p><strong>💡 活用例</strong></p>
            <p style="margin-left:12px;">・家族で「買い物リスト」を共有<br>・チームで「やることリスト」を管理<br>・カップルで「週末の予定」を共有</p>
          </div>
        </div>

        <!-- 通知・リマインダー -->
        <div class="help-section">
          <div class="help-title">
            <span class="help-icon">🔔</span>
            <span>通知・リマインダー設定</span>
          </div>
          <div class="help-content">
            <p style="margin-bottom:12px;">予定やタスクの前にLINEで通知を受け取れます。</p>

            <p><strong>⚙️ 通知のオン/オフ</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">設定 → 通知設定 → 「リマインダー通知」をオン/オフ<br>オフにすると全ての通知が届かなくなります</p>

            <p><strong>📅 予定のリマインダー</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">予定作成時に以下から選べます：<br>・前日に通知<br>・当日朝9時に通知<br>・1時間前に通知（時間指定の予定のみ）</p>

            <p><strong>✅ タスクのリマインダー</strong></p>
            <p style="margin-left:12px;margin-bottom:12px;">期限付きタスク作成時に選べます：<br>・1週間前<br>・3日前<br>・前日<br>・当日朝</p>

            <p><strong>📱 通知が届くタイミング</strong></p>
            <p style="margin-left:12px;">設定した時間にLINEトークでメッセージが届きます。<br>※LINEの通知をオンにしておいてください</p>
          </div>
        </div>

        <!-- LINEメッセージ -->
        <div class="help-section">
          <div class="help-title">
            <span class="help-icon">💬</span>
            <span>LINEメッセージで操作</span>
          </div>
          <div class="help-content">
            <p style="margin-bottom:12px;">このBotにメッセージを送るだけで操作できます。</p>

            <p><strong>📖 予定を確認</strong></p>
            <p style="margin-left:12px;margin-bottom:8px;">「今日の予定」「明日の予定」「今週の予定」</p>

            <p><strong>➕ 予定を追加</strong></p>
            <p style="margin-left:12px;margin-bottom:8px;">「明日14時から会議」「来週月曜に歯医者」のように自然な言葉で送信</p>

            <p><strong>✅ タスクを追加</strong></p>
            <p style="margin-left:12px;margin-bottom:8px;">「牛乳を買う」「レポート提出」など、やることを送信</p>

            <p><strong>📝 メモを保存</strong></p>
            <p style="margin-left:12px;">テキストや画像を送ると自動でメモに保存されます</p>
          </div>
        </div>

        <div style="margin-top:20px;padding:16px;background:linear-gradient(135deg, var(--primary)22, var(--primary)11);border-radius:12px;font-size:13px;">
          <p style="margin-bottom:10px;font-weight:600;color:var(--text);">💡 便利なヒント</p>
          <p style="margin-bottom:6px;">・テーマカラーは設定画面で20色から選べます</p>
          <p style="margin-bottom:6px;">・カレンダーは月・週・日表示を切り替え可能</p>
          <p style="margin-bottom:6px;">・完了したタスクは「完了済み」から確認・復元できます</p>
          <p>・困ったときはこのガイドをいつでも確認できます</p>
        </div>
      </div>
    </div>
  </div>

  <!-- バックアップ一覧モーダル -->
  <div class="modal-overlay" id="backup-list-modal">
    <div class="modal" style="max-height:80vh;">
      <div class="modal-header">
        <h3>バックアップから復元</h3>
        <button class="modal-close" onclick="closeBackupListModal()">×</button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:#666;margin-bottom:16px;">
          復元すると現在のデータは上書きされます。復元前に自動で現在のデータがバックアップされます。
        </p>
        <div id="backup-list-container">
          <div style="text-align:center;padding:32px;color:#999;">読み込み中...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- トースト -->
  <div class="toast" id="toast"></div>

  <script>
    // グローバルエラーハンドラ（デバッグ用）
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      console.error('Global error:', msg, url, lineNo, columnNo, error);
      const errMsg = msg + ' (行:' + lineNo + ')';
      if (typeof showToast === 'function') {
        showToast('JS Error: ' + errMsg);
      } else {
        alert('Error: ' + errMsg);
      }
      return false;
    };

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
    let completedTasks = [];
    let completedSharedTasks = [];
    let showCompletedTasks = false;
    let sharedTaskLists = [];
    let currentTaskList = null;
    let taskLists = [];
    let memos = [];
    let memoStyle = localStorage.getItem('memoStyle') || 'list';
    let memoSort = localStorage.getItem('memoSort') || 'created_desc';
    let themeColor = localStorage.getItem('themeColor') || '#06c755';
    let defaultView = localStorage.getItem('defaultView') || 'month';
    let weekStart = localStorage.getItem('weekStart') || '0';
    let taskSortByDue = localStorage.getItem('taskSortByDue') !== 'false';
    let taskFilter = 'all'; // 'all', 'personal', 'shared', or specific list ID
    let selectedImageBase64 = null;
    let selectedFileBase64 = null;
    let selectedFileName = null;
    let selectedFileType = null;
    let selectedFileSize = null;
    let recordedAudioBlob = null;
    let recordedAudioDuration = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingStartTime = null;
    let recordingTimer = null;
    let editingMemo = null;
    let projects = [];
    let currentProject = null;
    let selectedProjectColor = '#06c755';
    let userId = null;
    let userName = null;
    let editingEvent = null;
    let eventCustomReminders = [];
    let taskCustomReminders = [];
    let editingTask = null;
    let isGoogleAuthenticated = true; // Will be updated on first API call
    let googleAuthUrl = null;
    let googleCalendarSync = false; // 初期状態は同期オフ
    let googleTasksSync = false; // 初期状態は同期オフ

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
        userName = profile.displayName;
        document.getElementById('user-name').textContent = profile.displayName;
        document.getElementById('settings-username').textContent = profile.displayName;

        // 同期設定を読み込み
        await loadSyncSettings();

        // Google認証状態を確認（同期がオンの場合のみ重要）
        await checkGoogleAuthStatus();

        // 同期設定に基づいてデータをロード
        await Promise.all([loadEvents(), loadTasks(), loadTaskLists(), loadMemos(), loadProjects(), loadSharedEvents(), loadSharedTaskLists(), loadSharedTasks(), loadUserTags()]);
        renderCalendar();
        renderTasks();
        renderMemos();
        renderProjects();
        renderTaskLists();
        loadNotificationSettings();
        loadBackupSettings();
        initSyncSettings();
        initClaudeChat();

        // 招待リンクからの参加処理
        await handleJoinFromUrl();

        // テーマカラーと表示設定を適用
        applyThemeColor(themeColor);
        initDisplaySettings();

        // URLパラメータからタブを切り替え
        handleTabFromUrl();
      } catch (error) {
        console.error('LIFF initialization failed:', error);
        document.getElementById('user-name').textContent = 'エラー';
      }
    }

    function handleTabFromUrl() {
      // URLパラメータを取得（LIFFの場合、liff.state経由で渡されることがある）
      let params = new URLSearchParams(window.location.search);

      // liff.stateからもパラメータを取得（LIFFがリダイレクト時にパラメータをエンコードする場合がある）
      const liffState = params.get('liff.state');
      if (liffState) {
        try {
          const decodedState = decodeURIComponent(liffState);
          const stateParams = new URLSearchParams(decodedState);
          stateParams.forEach((value, key) => {
            if (!params.has(key)) params.set(key, value);
          });
        } catch (e) {
          console.log('Failed to decode liff.state:', e);
        }
      }

      const tab = params.get('tab');
      const action = params.get('action');

      console.log('handleTabFromUrl - tab:', tab, 'action:', action, 'search:', window.location.search);

      if (tab && ['calendar', 'tasks', 'memo', 'claude', 'settings'].includes(tab)) {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
        document.getElementById(tab).classList.add('active');
        currentTab = tab;
      }

      // 使い方モーダルを開く
      if (action === 'help') {
        setTimeout(() => openHelpModal(), 500);
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
        // 同期設定に基づいてAPIを切り替え
        if (googleCalendarSync && isGoogleAuthenticated) {
          const response = await fetch(API_BASE + '/api/events?userId=' + userId + cacheBust(), { cache: 'no-store' });
          if (response.status === 401) { handle401Error(); return; }
          if (response.ok) events = await response.json();
        } else {
          // ローカルイベントを取得
          const response = await fetch(API_BASE + '/api/local-events?userId=' + userId + cacheBust(), { cache: 'no-store' });
          if (response.ok) events = await response.json();
        }
      } catch (error) {
        console.error('Failed to load events:', error);
      }
    }

    async function loadTasks() {
      try {
        // 同期設定に基づいてAPIを切り替え
        if (googleTasksSync && isGoogleAuthenticated) {
          const response = await fetch(API_BASE + '/api/tasks?userId=' + userId + cacheBust(), { cache: 'no-store' });
          if (response.status === 401) { handle401Error(); return; }
          if (response.ok) tasks = await response.json();
        } else {
          // ローカルタスクを取得
          const response = await fetch(API_BASE + '/api/local-tasks?userId=' + userId + cacheBust(), { cache: 'no-store' });
          if (response.ok) tasks = await response.json();
        }
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    }

    async function loadTaskLists() {
      try {
        // Google同期がオンの場合のみGoogleタスクリストを取得
        if (googleTasksSync && isGoogleAuthenticated) {
          const response = await fetch(API_BASE + '/api/tasklists?userId=' + userId + cacheBust(), { cache: 'no-store' });
          if (response.status === 401) { handle401Error(); return; }
          if (response.ok) taskLists = await response.json();
        } else {
          // ローカルモードではデフォルトのリストを使用
          taskLists = [{ id: 'local_default', title: 'マイタスク' }];
        }
      } catch (error) {
        console.error('Failed to load task lists:', error);
      }
    }

    // === Claude Chat ===
    var claudeProcessing = false;
    var claudeAdminId = null;

    async function initClaudeChat() {
      try {
        const res = await fetch(API_BASE + '/api/admin-check');
        const data = await res.json();
        if (data.adminUserId) {
          claudeAdminId = data.adminUserId;
          document.getElementById('claude-status').textContent = 'オンライン';
          document.getElementById('claude-status').style.color = '#4caf50';
        } else {
          document.getElementById('claude-status').textContent = '管理者未設定';
          document.getElementById('claude-status').style.color = '#f44336';
        }
      } catch (e) {
        document.getElementById('claude-status').textContent = '接続エラー';
        document.getElementById('claude-status').style.color = '#f44336';
      }
    }

    function addClaudeMessage(text, type) {
      var container = document.getElementById('claude-messages');
      var msg = document.createElement('div');
      msg.className = 'claude-message ' + (type || 'user');
      msg.textContent = text;
      container.appendChild(msg);
      container.scrollTop = container.scrollHeight;
    }

    function showClaudeTyping() {
      var container = document.getElementById('claude-messages');
      var existing = document.getElementById('claude-typing');
      if (existing) return;
      var typing = document.createElement('div');
      typing.id = 'claude-typing';
      typing.className = 'claude-typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      container.appendChild(typing);
      container.scrollTop = container.scrollHeight;
    }

    function hideClaudeTyping() {
      var typing = document.getElementById('claude-typing');
      if (typing) typing.remove();
    }

    async function sendClaudeMessage() {
      var input = document.getElementById('claude-input');
      var text = input.value.trim();
      if (!text || claudeProcessing) return;

      if (!claudeAdminId) {
        addClaudeMessage('接続中です。しばらくお待ちください。', 'error');
        return;
      }

      // 管理者チェック
      if (userId !== claudeAdminId) {
        addClaudeMessage('この機能は管理者のみ利用できます。', 'error');
        return;
      }

      addClaudeMessage(text, 'user');
      input.value = '';
      claudeProcessing = true;
      document.getElementById('claude-send-btn').disabled = true;
      showClaudeTyping();

      // 特殊コマンド処理
      var lowerText = text.toLowerCase();
      var actualMessage = text;

      if (lowerText === 'sync' || lowerText === '同期' || lowerText === '更新') {
        actualMessage = 'cd /home/dev-agent/repos/kingqueen0114-bit/line-calendar-bot && git fetch origin && git reset --hard origin/main && git log --oneline -5';
      } else if (lowerText === 'status' || lowerText === '状況') {
        actualMessage = 'VMの状態とline-calendar-botリポジトリの最新コミットを教えて';
      } else if (lowerText === 'help' || lowerText === 'ヘルプ' || lowerText === '?') {
        hideClaudeTyping();
        claudeProcessing = false;
        document.getElementById('claude-send-btn').disabled = false;
        addClaudeMessage('📋 コマンド一覧\\n\\nsync - リポジトリ同期\\nstatus - 状況確認\\nhelp - このヘルプ\\n\\nその他、自由に指示できます', 'assistant');
        return;
      }

      try {
        const res = await fetch(API_BASE + '/api/claude/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: claudeAdminId, message: actualMessage })
        });
        const data = await res.json();
        hideClaudeTyping();
        if (data.success && data.response) {
          addClaudeMessage(data.response, 'assistant');
        } else {
          addClaudeMessage('エラー: ' + (data.error || '不明'), 'error');
        }
      } catch (e) {
        hideClaudeTyping();
        addClaudeMessage('通信エラー: ' + e.message, 'error');
      } finally {
        claudeProcessing = false;
        document.getElementById('claude-send-btn').disabled = false;
      }
    }

    async function loadMemos() {
      try {
        const response = await fetch(API_BASE + '/api/memos?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) memos = await response.json();
      } catch (error) {
        console.error('Failed to load memos:', error);
      }
    }

    async function loadProjects() {
      try {
        const response = await fetch(API_BASE + '/api/projects?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) projects = await response.json();
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    }

    async function loadSharedEvents() {
      try {
        const response = await fetch(API_BASE + '/api/shared-events?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) sharedEvents = await response.json();
      } catch (error) {
        console.error('Failed to load shared events:', error);
      }
    }

    async function loadSharedTaskLists() {
      try {
        const response = await fetch(API_BASE + '/api/shared-tasklists?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) sharedTaskLists = await response.json();
      } catch (error) {
        console.error('Failed to load shared task lists:', error);
      }
    }

    async function loadSharedTasks() {
      try {
        const response = await fetch(API_BASE + '/api/shared-tasks?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) sharedTasks = await response.json();
      } catch (error) {
        console.error('Failed to load shared tasks:', error);
      }
    }

    async function loadCompletedTasks() {
      try {
        // 同期設定に基づいてAPIを切り替え
        if (googleTasksSync && isGoogleAuthenticated) {
          const response = await fetch(API_BASE + '/api/tasks/completed?userId=' + userId + cacheBust(), { cache: 'no-store' });
          if (response.status === 401) { handle401Error(); return; }
          if (response.ok) completedTasks = await response.json();
        } else {
          // ローカル完了済みタスクを取得
          const response = await fetch(API_BASE + '/api/local-tasks/completed?userId=' + userId + cacheBust(), { cache: 'no-store' });
          if (response.ok) completedTasks = await response.json();
        }
      } catch (error) {
        console.error('Failed to load completed tasks:', error);
      }
    }

    async function loadCompletedSharedTasks() {
      try {
        const response = await fetch(API_BASE + '/api/shared-tasks/completed?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) completedSharedTasks = await response.json();
      } catch (error) {
        console.error('Failed to load completed shared tasks:', error);
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

    // 全ての完了済みタスク（個人 + 共有）を取得
    function getAllCompletedTasks() {
      return [...completedTasks, ...completedSharedTasks];
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
          let tagDots = '';
          if (event.tagIds && event.tagIds.length > 0 && userTags.length > 0) {
            const eventTags = event.tagIds.map(function(id) { return userTags.find(function(t) { return t.id === id; }); }).filter(Boolean);
            if (eventTags.length > 0) {
              tagDots = '<span class="event-tag-dots" style="margin-left:4px;">' +
                eventTags.slice(0, 3).map(function(t) { return '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + t.color + ';margin-right:2px;"></span>'; }).join('') +
                '</span>';
            }
          }
          html += '<div class="day-event' + sharedClass + '" style="background:' + bgColor + ';">' + escapeHtml(event.summary || '予定') + tagDots + '</div>';
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

      // タグ
      const tagsRow = document.getElementById('event-detail-tags-row');
      const tagsContainer = document.getElementById('event-detail-tags');
      if (event.tagIds && event.tagIds.length > 0 && userTags.length > 0) {
        const eventTags = event.tagIds.map(function(id) { return userTags.find(function(t) { return t.id === id; }); }).filter(Boolean);
        if (eventTags.length > 0) {
          tagsContainer.innerHTML = eventTags.map(function(t) {
            return '<span style="display:inline-block;padding:4px 10px;border-radius:12px;font-size:12px;background:' + t.color + ';color:#fff;">' + escapeHtml(t.name) + '</span>';
          }).join('');
          tagsRow.style.display = 'flex';
        } else {
          tagsRow.style.display = 'none';
        }
      } else {
        tagsRow.style.display = 'none';
      }

      // カレンダー
      if (isShared && event.projectName) {
        document.getElementById('event-detail-calendar').textContent = event.projectName + ' (共有)';
      } else {
        document.getElementById('event-detail-calendar').textContent = 'マイカレンダー';
      }

      // リマインダー（非同期で取得）
      document.getElementById('event-detail-reminder-row').style.display = 'none';
      fetchEventReminders(event.id, isShared);

      document.getElementById('event-detail-modal').classList.add('active');
    }

    async function fetchEventReminders(eventId, isShared) {
      console.log('fetchEventReminders called:', { eventId, isShared, userId });
      if (isShared) {
        // 共有イベントはリマインダー非対応
        console.log('Skipping shared event');
        return;
      }

      try {
        const url = API_BASE + '/api/event-reminders?userId=' + encodeURIComponent(userId) + '&eventId=' + encodeURIComponent(eventId);
        console.log('Fetching reminders from:', url);
        const response = await fetch(url);
        console.log('Response status:', response.status);
        if (!response.ok) {
          console.log('Response not ok');
          return;
        }

        const reminderData = await response.json();
        console.log('Reminder data:', reminderData);
        if (!reminderData || !reminderData.reminders) {
          console.log('No reminder data or reminders array');
          return;
        }

        const reminders = reminderData.reminders;
        const reminderTexts = [];

        // プリセットリマインダー
        if (reminders.includes('day_before')) {
          reminderTexts.push('前日 18:00');
        }
        if (reminders.includes('morning')) {
          reminderTexts.push('当日 8:00');
        }
        if (reminders.includes('1hour_before')) {
          reminderTexts.push('1時間前');
        }

        // カスタムリマインダー
        if (reminders.filter(r => typeof r === 'object' && r.type === 'custom').length > 0) {
          reminders.filter(r => typeof r === 'object' && r.type === 'custom').forEach(r => {
            const unitText = r.unit === 'minutes' ? '分前' : r.unit === 'hours' ? '時間前' : '日前';
            let text = r.value + unitText;
            if (r.time && r.unit === 'days') {
              text = r.value + '日前 ' + r.time;
            }
            reminderTexts.push(text);
          });
        }

        if (reminderTexts.length > 0) {
          document.getElementById('event-detail-reminder').textContent = reminderTexts.join('、');
          document.getElementById('event-detail-reminder-row').style.display = 'flex';
        }
      } catch (err) {
        console.error('Failed to fetch event reminders:', err);
      }
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

      // タグを読み込んで表示
      const eventTagIds = editingEvent.tagIds || [];
      console.log('[TAG DEBUG] editEventFromDetail - editingEvent.tagIds:', JSON.stringify(editingEvent.tagIds), 'eventTagIds:', JSON.stringify(eventTagIds));
      renderEventTagSelector(eventTagIds);

      // リマインダーをリセット
      document.getElementById('event-reminder-day-before').checked = false;
      document.getElementById('event-reminder-morning').checked = false;
      document.getElementById('event-reminder-1hour').checked = false;
      document.getElementById('event-reminder-1hour-option').style.display = isAllDay ? 'none' : 'flex';

      // 既存のリマインダーを読み込んでチェックボックスに反映
      loadEventRemindersForEdit(editingEvent.id, isShared);

      document.getElementById('event-submit').textContent = '更新';
      document.getElementById('event-submit').style.display = 'block';
      document.getElementById('event-delete').style.display = 'none';
      document.getElementById('event-modal').classList.add('active');
    }

    async function loadEventRemindersForEdit(eventId, isShared) {
      if (isShared) return;

      try {
        const response = await fetch(API_BASE + '/api/event-reminders?userId=' + encodeURIComponent(userId) + '&eventId=' + encodeURIComponent(eventId));
        if (!response.ok) return;

        const reminderData = await response.json();
        if (!reminderData || !reminderData.reminders) return;

        const reminders = reminderData.reminders;

        if (reminders.includes('day_before')) {
          document.getElementById('event-reminder-day-before').checked = true;
        }
        if (reminders.includes('morning')) {
          document.getElementById('event-reminder-morning').checked = true;
        }
        if (reminders.includes('1hour_before')) {
          document.getElementById('event-reminder-1hour').checked = true;
        }
      } catch (err) {
        console.error('Failed to load event reminders for edit:', err);
      }
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
      // 完了済みタスクが表示中の場合は再描画
      if (showCompletedTasks) {
        renderCompletedTasks();
      }
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
          html += '<div class="task-checkbox" onclick="event.stopPropagation(); toggleTask(\\'' + taskIndex + '\\', this)"></div>';
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
          html += '<div class="task-checkbox" onclick="event.stopPropagation(); toggleTask(\\'' + taskIndex + '\\', this)"></div>';
          html += '<div class="task-content"><div class="task-title">' + escapeHtml(task.title) + '</div>';
          if (task.due) html += '<div class="task-due">期限: ' + formatDueDate(task.due) + '</div>';
          html += '</div>';
          if (task.starred) html += '<div class="task-star">★</div>';
          html += '</div>';
        });
      });
      container.innerHTML = html;
    }

    async function toggleTask(indexStr, checkboxEl) {
      const isShared = indexStr.toString().startsWith('shared_');
      const index = isShared ? parseInt(indexStr.replace('shared_', '')) : parseInt(indexStr);
      const task = isShared ? sharedTasks[index] : tasks[index];

      if (!task) return;

      // チェックマークを表示
      if (checkboxEl) {
        checkboxEl.classList.add('checked');
      }

      // 少し待ってからAPIを呼び出し（アニメーション効果）
      await new Promise(resolve => setTimeout(resolve, 300));

      try {
        if (isShared) {
          await fetch(API_BASE + '/api/shared-tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId: task.id, listId: task.listId, userName })
          });
          showToast('タスクを完了しました');
          await loadSharedTasks();
          renderTasks();
        } else {
          // ローカルタスクかGoogleタスクかで切り替え
          const isLocalTask = task.id && task.id.startsWith('local_');
          const apiEndpoint = isLocalTask ? '/api/local-tasks/complete' : '/api/tasks/complete';
          await fetch(API_BASE + apiEndpoint, {
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
        // エラー時はチェックを外す
        if (checkboxEl) {
          checkboxEl.classList.remove('checked');
        }
      }
    }

    async function toggleShowCompletedTasks() {
      showCompletedTasks = !showCompletedTasks;
      const icon = document.getElementById('completed-toggle-icon');
      const container = document.getElementById('completed-task-list');

      if (showCompletedTasks) {
        icon.classList.add('open');
        container.style.display = 'block';
        container.innerHTML = '<div class="loading"><div class="loading-spinner"></div>読み込み中...</div>';
        await Promise.all([loadCompletedTasks(), loadCompletedSharedTasks()]);
        renderCompletedTasks();
      } else {
        icon.classList.remove('open');
        container.style.display = 'none';
      }
    }

    function renderCompletedTasks() {
      const container = document.getElementById('completed-task-list');
      let allCompleted = getAllCompletedTasks();

      // フィルタリング（renderTasksと同じロジック）
      if (taskFilter === 'personal') {
        allCompleted = allCompleted.filter(t => !t.isShared);
      } else if (taskFilter.startsWith('list_')) {
        const listId = taskFilter.replace('list_', '');
        allCompleted = allCompleted.filter(t => t.isShared && t.listId === listId);
      }
      // 'all' の場合はフィルタなし

      const countEl = document.getElementById('completed-count');
      countEl.textContent = allCompleted.length + '件';

      if (allCompleted.length === 0) {
        const emptyMsg = taskFilter === 'all' ? '完了済みタスクはありません' :
                         taskFilter === 'personal' ? '完了済みマイタスクはありません' :
                         'このリストに完了済みタスクはありません';
        container.innerHTML = '<div class="empty" style="padding:20px;">' + emptyMsg + '</div>';
        return;
      }

      let html = '';
      allCompleted.forEach((task) => {
        const isShared = task.isShared;
        const actualIndex = isShared ? completedSharedTasks.indexOf(task) : completedTasks.indexOf(task);
        const indexStr = isShared ? 'cshared_' + actualIndex : 'c_' + actualIndex;
        const listColor = task.listColor || null;
        const borderStyle = isShared && listColor ? ' style="border-left: 4px solid ' + listColor + ';"' : '';
        html += '<div class="completed-task-item"' + borderStyle + '>';
        html += '<div class="task-checkbox"></div>';
        html += '<div class="task-content">';
        html += '<div class="task-title">' + escapeHtml(task.title) + '</div>';
        if (task.completedAt || task.completed) {
          const completedDate = task.completedAt || task.completed;
          html += '<div class="task-due">完了: ' + formatDateTime(completedDate) + '</div>';
        }
        if (isShared && task.completedBy) {
          html += '<div class="completed-by">完了者: ' + (task.completedByName || task.completedBy.substring(0, 8) + '...') + '</div>';
        }
        if (isShared && task.listTitle) {
          html += '<div style="font-size:10px;color:' + (listColor || 'var(--primary)') + ';">' + escapeHtml(task.listTitle) + '</div>';
        }
        html += '</div>';
        html += '<button class="uncomplete-btn" onclick="event.stopPropagation(); uncompleteTask(\\'' + indexStr + '\\')">戻す</button>';
        html += '</div>';
      });
      container.innerHTML = html;
    }

    function formatDateTime(dateStr) {
      const date = new Date(dateStr);
      return (date.getMonth() + 1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
    }

    async function uncompleteTask(indexStr) {
      const isShared = indexStr.startsWith('cshared_');
      const index = parseInt(indexStr.replace('cshared_', '').replace('c_', ''));
      const task = isShared ? completedSharedTasks[index] : completedTasks[index];

      if (!task) return;

      try {
        if (isShared) {
          await fetch(API_BASE + '/api/shared-tasks/uncomplete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId: task.id, listId: task.listId })
          });
          showToast('タスクを未完了に戻しました');
          await loadSharedTasks();
          await loadCompletedSharedTasks();
        } else {
          // ローカルタスクかGoogleタスクかで切り替え
          const isLocalTask = task.id && task.id.startsWith('local_');
          const apiEndpoint = isLocalTask ? '/api/local-tasks/uncomplete' : '/api/tasks/uncomplete';
          await fetch(API_BASE + apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId: task.id, listId: task.listId })
          });
          showToast('タスクを未完了に戻しました');
          await loadTasks();
          await loadCompletedTasks();
        }
        renderTasks();
        renderCompletedTasks();
      } catch (error) {
        console.error('Failed to uncomplete task:', error);
        showToast('エラーが発生しました');
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

      // 並び替えセレクトの状態を更新
      const sortSelect = document.getElementById('memo-sort-select');
      if (sortSelect) sortSelect.value = memoSort;

      // 検索フィルタリング
      let filteredMemos = [...memos];
      if (memoSearchQuery) {
        const query = memoSearchQuery.toLowerCase();
        filteredMemos = filteredMemos.filter(memo => {
          const text = (memo.text || '').toLowerCase();
          return text.includes(query);
        });
      }

      // 並び替え
      filteredMemos.sort((a, b) => {
        switch (memoSort) {
          case 'created_asc':
            return new Date(a.createdAt) - new Date(b.createdAt);
          case 'created_desc':
            return new Date(b.createdAt) - new Date(a.createdAt);
          case 'updated_asc':
            return new Date(a.updatedAt) - new Date(b.updatedAt);
          case 'updated_desc':
            return new Date(b.updatedAt) - new Date(a.updatedAt);
          default:
            return new Date(b.createdAt) - new Date(a.createdAt);
        }
      });

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
        const hasAudio = !!memo.audioUrl;
        const hasFile = !!memo.fileUrl;
        const imageOnlyClass = (memoStyle === 'grid' && hasImage && !hasText && !hasAudio && !hasFile) ? ' image-only' : '';

        html += '<div class="memo-card' + imageOnlyClass + '" onclick="openMemoDetail(' + index + ')">';

        if (memoStyle === 'compact') {
          // コンパクト: 画像を左に小さく表示
          if (hasImage) {
            html += '<img class="memo-card-image" src="' + memo.imageUrl + '" alt="">';
          }
          html += '<div class="memo-card-content">';
          let displayText = hasText ? escapeHtml(memo.text) : (hasImage ? '画像メモ' : (hasAudio ? '🎤 ボイスメモ' : (hasFile ? '📎 ' + escapeHtml(memo.fileName || 'ファイル') : '')));
          html += '<div class="memo-card-text">' + displayText + '</div>';
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
          // 音声プレーヤー
          if (hasAudio) {
            html += '<div class="memo-audio-player" onclick="event.stopPropagation()">';
            html += '<audio src="' + memo.audioUrl + '" controls></audio>';
            if (memo.audioDuration) {
              html += '<span class="memo-audio-duration">' + memo.audioDuration + '秒</span>';
            }
            html += '</div>';
          }
          // ファイル添付
          if (hasFile) {
            html += '<a href="' + memo.fileUrl + '" target="_blank" class="memo-file-attachment" onclick="event.stopPropagation()">';
            html += '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
            html += '<span class="memo-file-name">' + escapeHtml(memo.fileName || 'ファイル') + '</span>';
            if (memo.fileSize) {
              html += '<span class="memo-file-size">' + formatFileSize(memo.fileSize) + '</span>';
            }
            html += '</a>';
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

    function changeMemoSort(sort) {
      memoSort = sort;
      localStorage.setItem('memoSort', sort);
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

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ファイル選択ハンドラー
    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      // サイズチェック（10MB）
      if (file.size > 10 * 1024 * 1024) {
        showToast('ファイルサイズは10MB以下にしてください');
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        selectedFileBase64 = e.target.result.split(',')[1];
        selectedFileName = file.name;
        selectedFileType = file.type || 'application/octet-stream';
        selectedFileSize = file.size;

        document.getElementById('selected-file-name').textContent = file.name;
        document.getElementById('selected-file-size').textContent = formatFileSize(file.size);
        document.getElementById('selected-file-info').classList.add('show');
      };
      reader.readAsDataURL(file);
    }

    function clearSelectedFile() {
      selectedFileBase64 = null;
      selectedFileName = null;
      selectedFileType = null;
      selectedFileSize = null;
      const fileInfo = document.getElementById('selected-file-info');
      const memoFile = document.getElementById('memo-file');
      if (fileInfo) fileInfo.classList.remove('show');
      if (memoFile) memoFile.value = '';
    }

    // 音声録音機能
    async function toggleRecording() {
      // LIFFアプリ内ではマイクが使えない場合がある
      if (liff.isInClient()) {
        showToast('LINEアプリ内では録音できません。LINEのトーク画面から音声メッセージを送信してください。');
        return;
      }

      const btn = document.getElementById('record-btn');
      const status = document.getElementById('record-status');
      const timeDisplay = document.getElementById('record-time');

      if (mediaRecorder && mediaRecorder.state === 'recording') {
        // 録音停止
        mediaRecorder.stop();
        btn.classList.remove('recording');
        status.textContent = '録音完了';
        clearInterval(recordingTimer);
      } else {
        // 録音開始
        try {
          // マイクが利用可能かチェック
          if (!navigator.mediaDevices) {
            showToast('このブラウザでは録音機能を利用できません（mediaDevices未対応）');
            return;
          }
          if (!navigator.mediaDevices.getUserMedia) {
            showToast('このブラウザでは録音機能を利用できません（getUserMedia未対応）');
            return;
          }

          status.textContent = 'マイク許可を確認中...';
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

          // MediaRecorderが利用可能かチェック
          if (typeof MediaRecorder === 'undefined') {
            showToast('このブラウザでは録音機能を利用できません（MediaRecorder未対応）');
            stream.getTracks().forEach(track => track.stop());
            return;
          }

          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunks.push(e.data);
            }
          };

          mediaRecorder.onstop = () => {
            recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            recordedAudioDuration = Math.round((Date.now() - recordingStartTime) / 1000);
            const audioUrl = URL.createObjectURL(recordedAudioBlob);
            const audioPreview = document.getElementById('audio-preview');
            const recordedAudio = document.getElementById('recorded-audio');
            if (audioPreview) audioPreview.src = audioUrl;
            if (recordedAudio) recordedAudio.classList.add('show');
            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.onerror = (e) => {
            console.error('MediaRecorder error:', e);
            showToast('録音中にエラーが発生しました');
          };

          mediaRecorder.start();
          btn.classList.add('recording');
          recordingStartTime = Date.now();
          status.textContent = '録音中...';
          timeDisplay.classList.add('show');

          recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const secs = String(elapsed % 60).padStart(2, '0');
            timeDisplay.textContent = mins + ':' + secs;
          }, 1000);
        } catch (err) {
          console.error('Microphone access error:', err);
          status.textContent = 'タップして録音';
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            showToast('マイクへのアクセスを許可してください');
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            showToast('マイクが見つかりません');
          } else if (err.name === 'NotSupportedError') {
            showToast('このブラウザでは録音がサポートされていません');
          } else if (err.name === 'SecurityError') {
            showToast('セキュリティエラー: HTTPSが必要です');
          } else {
            showToast('録音エラー: ' + (err.name || '') + ' ' + (err.message || ''));
          }
        }
      }
    }

    function clearRecordedAudio() {
      recordedAudioBlob = null;
      recordedAudioDuration = null;
      const recordedAudio = document.getElementById('recorded-audio');
      const recordStatus = document.getElementById('record-status');
      const recordTime = document.getElementById('record-time');
      if (recordedAudio) recordedAudio.classList.remove('show');
      if (recordStatus) recordStatus.textContent = 'タップして録音';
      if (recordTime) {
        recordTime.textContent = '00:00';
        recordTime.classList.remove('show');
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
      const editPermission = document.getElementById('project-edit-permission').value;

      if (!name) {
        showToast('カレンダー名を入力してください');
        return;
      }

      try {
        const response = await fetch(API_BASE + '/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, name, description, color: selectedProjectColor, isPersonal: isCreatingPersonalCalendar, editPermission })
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
      const editPermission = document.getElementById('tasklist-edit-permission').value;

      if (!name) {
        showToast('リスト名を入力してください');
        return;
      }

      try {
        const response = await fetch(API_BASE + '/api/shared-tasklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, name, color: selectedTaskListColor, editPermission })
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

    let selectedTagIds = [];

    function setupEventTagSelectorHandler() {
      const container = document.getElementById('event-tag-selector');
      console.log('[TAG DEBUG] setupEventTagSelectorHandler called, container:', !!container, '_tagHandlerSet:', container?._tagHandlerSet);
      if (!container || container._tagHandlerSet) return;
      container._tagHandlerSet = true;
      console.log('[TAG DEBUG] Setting up click handler on container');
      container.addEventListener('click', function(e) {
        console.log('[TAG DEBUG] Container clicked, target:', e.target);
        const chip = e.target.closest('.event-tag-chip');
        if (chip) {
          const tagId = chip.dataset.tagId;
          console.log('[TAG DEBUG] Tag clicked:', tagId, 'current selectedTagIds:', JSON.stringify(selectedTagIds));
          toggleEventTag(tagId);
        }
      });
    }

    function renderEventTagSelector(selectedIds = []) {
      console.log('[TAG DEBUG] renderEventTagSelector called with selectedIds:', JSON.stringify(selectedIds), 'userTags count:', userTags.length);
      selectedTagIds = selectedIds ? selectedIds.slice() : [];
      console.log('[TAG DEBUG] selectedTagIds set to:', JSON.stringify(selectedTagIds));
      const container = document.getElementById('event-tag-selector');
      if (!container) {
        console.log('[TAG DEBUG] Container not found!');
        return;
      }

      if (userTags.length === 0) {
        container.innerHTML = '<span style="color:#999;font-size:12px;">タグがありません（設定から作成できます）</span>';
        return;
      }

      container.innerHTML = userTags.map(function(tag) {
        const isSelected = selectedTagIds.includes(tag.id);
        return '<div class="event-tag-chip ' + (isSelected ? 'selected' : '') + '" data-tag-id="' + tag.id + '" style="background:' + (isSelected ? tag.color : '#e0e0e0') + ';color:' + (isSelected ? '#fff' : '#666') + ';padding:6px 12px;border-radius:16px;font-size:12px;cursor:pointer;transition:all 0.2s;">' +
          escapeHtml(tag.name) +
          '</div>';
      }).join('');
      console.log('[TAG DEBUG] Chips rendered, calling setupEventTagSelectorHandler');

      // 一度だけハンドラーをセットアップ
      setupEventTagSelectorHandler();
    }

    function toggleEventTag(tagId) {
      console.log('[TAG DEBUG] toggleEventTag called with tagId:', tagId, 'before:', JSON.stringify(selectedTagIds));
      const index = selectedTagIds.indexOf(tagId);
      if (index === -1) {
        selectedTagIds.push(tagId);
      } else {
        selectedTagIds.splice(index, 1);
      }
      console.log('[TAG DEBUG] toggleEventTag after:', JSON.stringify(selectedTagIds));
      // HTMLのみ更新（ハンドラーは再設定しない）
      const container = document.getElementById('event-tag-selector');
      if (!container || userTags.length === 0) return;
      container.innerHTML = userTags.map(function(tag) {
        const isSelected = selectedTagIds.includes(tag.id);
        return '<div class="event-tag-chip ' + (isSelected ? 'selected' : '') + '" data-tag-id="' + tag.id + '" style="background:' + (isSelected ? tag.color : '#e0e0e0') + ';color:' + (isSelected ? '#fff' : '#666') + ';padding:6px 12px;border-radius:16px;font-size:12px;cursor:pointer;transition:all 0.2s;">' +
          escapeHtml(tag.name) +
          '</div>';
      }).join('');
    }

    function openEventModal(isNew = true) {
      editingEvent = null;
      selectedTagIds = [];
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
      // タグセレクターの初期化
      renderEventTagSelector([]);
      // リマインダーのリセット
      document.getElementById('event-reminder-day-before').checked = false;
      document.getElementById('event-reminder-morning').checked = false;
      document.getElementById('event-reminder-1hour').checked = false;
      document.getElementById('event-reminder-1hour-option').style.display = 'flex';
      clearEventCustomReminders();
      // 通知トグルの初期化（共有カレンダー選択時のみ表示）
      document.getElementById('event-notify-group').style.display = 'none';
      document.getElementById('event-notify-members').checked = false;
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
      document.getElementById('task-due-time').value = '';
      // 時刻とリマインダーを表示
      document.getElementById('task-time-row').style.display = 'block';
      document.getElementById('task-reminder-group').style.display = 'block';
      document.getElementById('task-reminder-display').style.display = 'none';
      document.getElementById('task-reminder-1week').checked = false;
      document.getElementById('task-reminder-3days').checked = false;
      document.getElementById('task-reminder-day-before').checked = false;
      document.getElementById('task-reminder-morning').checked = false;
      clearTaskCustomReminders();
      // 通知トグルの初期化（共有タスクリスト選択時のみ表示）
      document.getElementById('task-notify-group').style.display = 'none';
      document.getElementById('task-notify-members').checked = false;

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

      // 時刻を抽出（ISO形式から）
      const hasDate = !!task.due;
      let dueTime = '';
      if (task.due && task.due.includes('T')) {
        const timePart = task.due.split('T')[1];
        if (timePart && timePart !== '00:00:00Z' && timePart !== '00:00:00.000Z') {
          dueTime = timePart.substring(0, 5);
        }
      }
      document.getElementById('task-due-time').value = dueTime;
      // 詳細表示時はリマインダーオプションは非表示（新規作成時のみ設定可能）
      document.getElementById('task-reminder-group').style.display = 'none';
      document.getElementById('task-time-row').style.display = 'block';
      document.getElementById('task-reminder-1week').checked = false;
      document.getElementById('task-reminder-3days').checked = false;
      document.getElementById('task-reminder-day-before').checked = false;
      document.getElementById('task-reminder-morning').checked = false;

      const select = document.getElementById('task-list-select');
      if (isShared) {
        select.innerHTML = '<option value="shared_' + task.listId + '" selected>' + task.listTitle + '</option>';
        select.disabled = true;
      } else {
        select.innerHTML = taskLists.map(list => '<option value="google_' + list.title + '"' + (list.title === task.listTitle ? ' selected' : '') + '>' + list.title + '</option>').join('');
        select.disabled = true;
      }

      // リマインダー表示を取得（非同期）
      document.getElementById('task-reminder-display').style.display = 'none';
      fetchTaskReminders(task.id, isShared);

      document.getElementById('task-create-btns').style.display = 'none';
      document.getElementById('task-detail-btns').style.display = 'flex';
      document.getElementById('task-modal').classList.add('active');
    }

    async function fetchTaskReminders(taskId, isShared) {
      console.log('fetchTaskReminders called:', { taskId, isShared, userId });
      if (isShared) {
        // 共有タスクはリマインダー非対応
        console.log('Skipping shared task');
        return;
      }

      try {
        const url = API_BASE + '/api/task-reminders?userId=' + encodeURIComponent(userId) + '&taskId=' + encodeURIComponent(taskId);
        console.log('Fetching task reminders from:', url);
        const response = await fetch(url);
        console.log('Task reminder response status:', response.status);
        if (!response.ok) {
          console.log('Task reminder response not ok');
          return;
        }

        const reminderData = await response.json();
        console.log('Task reminder data:', reminderData);
        if (!reminderData || !reminderData.reminders) {
          console.log('No task reminder data or reminders array');
          return;
        }

        const reminders = reminderData.reminders;
        const reminderTexts = [];

        // プリセットリマインダー
        if (reminders.includes('1week_before')) {
          reminderTexts.push('1週間前');
        }
        if (reminders.includes('3days_before')) {
          reminderTexts.push('3日前');
        }
        if (reminders.includes('day_before')) {
          reminderTexts.push('前日 18:00');
        }
        if (reminders.includes('morning')) {
          reminderTexts.push('当日 8:00');
        }

        // カスタムリマインダー
        if (reminders.filter(r => typeof r === 'object' && r.type === 'custom').length > 0) {
          reminders.filter(r => typeof r === 'object' && r.type === 'custom').forEach(r => {
            const unitText = r.unit === 'minutes' ? '分前' : r.unit === 'hours' ? '時間前' : '日前';
            let text = r.value + unitText;
            if (r.time && r.unit === 'days') {
              text = r.value + '日前 ' + r.time;
            }
            reminderTexts.push(text);
          });
        }

        if (reminderTexts.length > 0) {
          document.getElementById('task-reminder-text').textContent = reminderTexts.join('、');
          document.getElementById('task-reminder-display').style.display = 'block';
        }
      } catch (err) {
        console.error('Failed to fetch task reminders:', err);
      }
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

        // ローカルタスクかGoogleタスクかで切り替え
        const isLocalTask = editingTask.id && editingTask.id.startsWith('local_');
        const apiEndpoint = isLocalTask ? '/api/local-tasks/update' : '/api/tasks/update';
        await fetch(API_BASE + apiEndpoint, {
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

    // ==================== タグ管理 ====================

    let userTags = [];
    let editingTagId = null;

    async function loadUserTags() {
      try {
        const response = await fetch(API_BASE + '/api/tags?userId=' + encodeURIComponent(userId));
        if (response.ok) {
          userTags = await response.json();
          renderTagList();
        }
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    }

    function renderTagList() {
      const container = document.getElementById('tag-list');
      if (!container) return;

      if (userTags.length === 0) {
        container.innerHTML = '<span style="color:#999;font-size:13px;">タグがありません</span>';
        return;
      }

      container.innerHTML = userTags.map(function(tag) {
        return '<div class="tag-chip" data-tag-id="' + tag.id + '" style="background:' + tag.color + ';color:#fff;padding:6px 12px;border-radius:16px;font-size:13px;cursor:pointer;">' +
          escapeHtml(tag.name) +
          '</div>';
      }).join('');

      // イベントデリゲーションでクリックを処理
      container.onclick = function(e) {
        const chip = e.target.closest('.tag-chip');
        if (chip) {
          const tagId = chip.dataset.tagId;
          openTagModal(tagId);
        }
      };
    }

    function openTagModal(tagId) {
      editingTagId = tagId || null;
      const modal = document.getElementById('tag-modal');
      const titleEl = document.getElementById('tag-modal-title');
      const nameInput = document.getElementById('tag-name-input');
      const colorInput = document.getElementById('tag-color-input');
      const colorPreview = document.getElementById('tag-color-preview');
      const deleteBtn = document.getElementById('delete-tag-btn');

      if (tagId) {
        const tag = userTags.find(function(t) { return t.id === tagId; });
        if (tag) {
          titleEl.textContent = 'タグを編集';
          nameInput.value = tag.name;
          colorInput.value = tag.color;
          colorPreview.style.background = tag.color;
          deleteBtn.style.display = 'block';

          // カラーピッカーの選択状態を更新
          document.querySelectorAll('#tag-color-picker .color-option').forEach(function(opt) {
            opt.classList.toggle('selected', opt.dataset.color === tag.color);
          });
        }
      } else {
        titleEl.textContent = 'タグを作成';
        nameInput.value = '';
        colorInput.value = '#06c755';
        colorPreview.style.background = '#06c755';
        deleteBtn.style.display = 'none';

        document.querySelectorAll('#tag-color-picker .color-option').forEach(function(opt) {
          opt.classList.toggle('selected', opt.dataset.color === '#06c755');
        });
      }

      document.getElementById('editing-tag-id').value = tagId || '';
      modal.classList.add('active');

      // カラーピッカーのイベント設定
      document.getElementById('tag-color-input').addEventListener('input', function(e) {
        document.getElementById('tag-color-preview').style.background = e.target.value;
        document.querySelectorAll('#tag-color-picker .color-option').forEach(function(opt) {
          opt.classList.remove('selected');
        });
      });

      document.querySelectorAll('#tag-color-picker .color-option').forEach(function(opt) {
        opt.onclick = function() {
          var color = this.dataset.color;
          document.getElementById('tag-color-input').value = color;
          document.getElementById('tag-color-preview').style.background = color;
          document.querySelectorAll('#tag-color-picker .color-option').forEach(function(o) {
            o.classList.remove('selected');
          });
          this.classList.add('selected');
        };
      });
    }

    function closeTagModal() {
      document.getElementById('tag-modal').classList.remove('active');
      editingTagId = null;
    }

    async function saveTag() {
      const name = document.getElementById('tag-name-input').value.trim();
      const color = document.getElementById('tag-color-input').value;
      const tagId = document.getElementById('editing-tag-id').value;

      if (!name) {
        showToast('タグ名を入力してください');
        return;
      }

      try {
        const url = API_BASE + '/api/tags';
        const method = tagId ? 'PUT' : 'POST';
        const body = {
          userId: userId,
          name: name,
          color: color
        };
        if (tagId) {
          body.tagId = tagId;
        }

        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          showToast(tagId ? 'タグを更新しました' : 'タグを作成しました');
          closeTagModal();
          await loadUserTags();
        } else {
          const data = await response.json();
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (err) {
        console.error('Save tag error:', err);
        showToast('エラーが発生しました');
      }
    }

    async function deleteCurrentTag() {
      const tagId = document.getElementById('editing-tag-id').value;
      if (!tagId) return;

      if (!confirm('このタグを削除しますか？')) return;

      try {
        const response = await fetch(API_BASE + '/api/tags', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            tagId: tagId
          })
        });

        if (response.ok) {
          showToast('タグを削除しました');
          closeTagModal();
          await loadUserTags();
        } else {
          const data = await response.json();
          showToast(data.error || 'エラーが発生しました');
        }
      } catch (err) {
        console.error('Delete tag error:', err);
        showToast('エラーが発生しました');
      }
    }

    function openHelpModal() {
      document.getElementById('help-modal').classList.add('active');
    }

    function closeHelpModal() {
      document.getElementById('help-modal').classList.remove('active');
    }

    // ==================== バックアップ機能 ====================

    async function loadBackupSettings() {
      try {
        const response = await fetch(API_BASE + '/api/backup/settings?userId=' + encodeURIComponent(userId));
        const data = await response.json();

        document.getElementById('auto-backup-toggle').checked = data.autoBackupEnabled;

        if (data.lastBackupTime) {
          const date = new Date(data.lastBackupTime);
          document.getElementById('last-backup-time').textContent =
            '最終バックアップ: ' + date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        } else {
          document.getElementById('last-backup-time').textContent = '最終バックアップ: なし';
        }
      } catch (err) {
        console.error('Failed to load backup settings:', err);
      }
    }

    async function toggleAutoBackup() {
      const enabled = document.getElementById('auto-backup-toggle').checked;
      try {
        await fetch(API_BASE + '/api/backup/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, autoBackupEnabled: enabled })
        });
        showToast(enabled ? '自動バックアップをオンにしました' : '自動バックアップをオフにしました');
      } catch (err) {
        console.error('Failed to update auto backup setting:', err);
        showToast('設定の更新に失敗しました');
      }
    }

    async function createManualBackup() {
      showToast('バックアップを作成中...');
      try {
        const response = await fetch(API_BASE + '/api/backup/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await response.json();
        if (data.success) {
          showToast('バックアップを作成しました');
          loadBackupSettings();
        } else {
          showToast('バックアップの作成に失敗しました');
        }
      } catch (err) {
        console.error('Failed to create backup:', err);
        showToast('バックアップの作成に失敗しました');
      }
    }

    async function openBackupListModal() {
      document.getElementById('backup-list-modal').classList.add('active');
      document.getElementById('backup-list-container').innerHTML =
        '<div style="text-align:center;padding:32px;color:#999;">読み込み中...</div>';

      try {
        const response = await fetch(API_BASE + '/api/backup/list?userId=' + encodeURIComponent(userId));
        const data = await response.json();

        if (!data.backups || data.backups.length === 0) {
          document.getElementById('backup-list-container').innerHTML =
            '<div style="text-align:center;padding:32px;color:#999;">バックアップがありません</div>';
          return;
        }

        let html = '<div class="backup-list">';
        data.backups.forEach((backup, index) => {
          const date = new Date(backup.timestamp);
          const formattedDate = date.toLocaleDateString('ja-JP') + ' ' +
            date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          html += '<div class="backup-item" onclick="restoreBackup(' + "'" + backup.id + "'" + ')">';
          html += '<div class="backup-date">' + formattedDate + '</div>';
          html += '<div class="backup-info">';
          html += '<span>予定: ' + backup.eventCount + '</span> | ';
          html += '<span>タスク: ' + backup.taskCount + '</span> | ';
          html += '<span>メモ: ' + backup.memoCount + '</span>';
          if (backup.sharedCalendarCount > 0 || backup.sharedTaskListCount > 0) {
            html += '<br><span>共有カレンダー: ' + (backup.sharedCalendarCount || 0) + '</span> | ';
            html += '<span>共有リスト: ' + (backup.sharedTaskListCount || 0) + '</span>';
          }
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';

        document.getElementById('backup-list-container').innerHTML = html;
      } catch (err) {
        console.error('Failed to load backups:', err);
        document.getElementById('backup-list-container').innerHTML =
          '<div style="text-align:center;padding:32px;color:#f44336;">読み込みに失敗しました</div>';
      }
    }

    function closeBackupListModal() {
      document.getElementById('backup-list-modal').classList.remove('active');
    }

    async function restoreBackup(backupId) {
      if (!confirm('このバックアップから復元しますか？\\n\\n現在のデータは上書きされます。\\n（復元前に自動でバックアップが作成されます）')) {
        return;
      }

      showToast('復元中...');
      try {
        const response = await fetch(API_BASE + '/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, backupId })
        });
        const data = await response.json();
        if (data.success) {
          showToast('復元しました');
          closeBackupListModal();
          // データを再読み込み
          await loadEvents();
          await loadTasks();
          await loadMemos();
        } else {
          showToast('復元に失敗しました: ' + (data.error || ''));
        }
      } catch (err) {
        console.error('Failed to restore backup:', err);
        showToast('復元に失敗しました');
      }
    }

    async function exportBackupAsJson() {
      showToast('エクスポート中...');

      try {
        const exportUrl = API_BASE + '/api/backup/export?userId=' + encodeURIComponent(userId);
        const response = await fetch(exportUrl);
        const data = await response.json();
        const jsonStr = JSON.stringify(data, null, 2);
        const fileName = 'calendar-backup-' + new Date().toISOString().split('T')[0] + '.json';

        // Web Share API が使える場合（iCloud, Google Driveなどに共有可能）
        if (navigator.share && navigator.canShare) {
          const file = new File([jsonStr], fileName, { type: 'application/json' });

          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                title: 'カレンダーバックアップ',
                text: 'カレンダー・タスク・メモのバックアップデータ',
                files: [file]
              });
              showToast('共有しました');
              return;
            } catch (shareErr) {
              if (shareErr.name !== 'AbortError') {
                console.log('Share failed, falling back to download:', shareErr);
              } else {
                return; // ユーザーがキャンセル
              }
            }
          }
        }

        // Web Share APIが使えない場合はダウンロード
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('ダウンロードしました');
      } catch (err) {
        console.error('Export failed:', err);
        showToast('エクスポートに失敗しました');
      }
    }

    function openMemoModal() {
      try {
        editingMemo = null;
        selectedImageBase64 = null;
        clearSelectedFile();
        clearRecordedAudio();
        document.getElementById('memo-modal-title').textContent = 'メモを追加';
        document.getElementById('memo-text').value = '';
        document.getElementById('image-preview-container').classList.remove('has-image');
        document.getElementById('memo-submit').textContent = '保存';
        document.getElementById('memo-delete').style.display = 'none';
        // 既存の音声・ファイル表示を隠す
        const existingAudio = document.getElementById('existing-audio');
        const existingFile = document.getElementById('existing-file');
        const fileAttachSection = document.getElementById('file-attach-section');
        const voiceRecorder = document.getElementById('voice-recorder');
        if (existingAudio) existingAudio.style.display = 'none';
        if (existingFile) existingFile.style.display = 'none';
        // 新規入力UIを表示
        if (fileAttachSection) fileAttachSection.style.display = 'block';
        if (voiceRecorder) voiceRecorder.style.display = 'flex';
        document.getElementById('memo-modal').classList.add('active');
      } catch (err) {
        console.error('openMemoModal error:', err);
        showToast('メモ作成画面を開けませんでした');
      }
    }

    function openMemoDetail(index) {
      try {
        const memo = memos[index];
        if (!memo) return;

        editingMemo = memo;
        selectedImageBase64 = null;
        clearSelectedFile();
        clearRecordedAudio();
        document.getElementById('memo-modal-title').textContent = 'メモの詳細';
        document.getElementById('memo-text').value = memo.text || '';

        if (memo.imageUrl) {
          document.getElementById('image-preview').src = memo.imageUrl;
          document.getElementById('image-preview-container').classList.add('has-image');
        } else {
          document.getElementById('image-preview-container').classList.remove('has-image');
        }

        // 既存の音声を表示
        const existingAudio = document.getElementById('existing-audio');
        const voiceRecorder = document.getElementById('voice-recorder');
        if (memo.audioUrl) {
          document.getElementById('existing-audio-player').src = memo.audioUrl;
          document.getElementById('existing-audio-duration').textContent = memo.audioDuration ? memo.audioDuration + '秒' : '';
          if (existingAudio) existingAudio.style.display = 'flex';
          if (voiceRecorder) voiceRecorder.style.display = 'none';
        } else {
          if (existingAudio) existingAudio.style.display = 'none';
          if (voiceRecorder) voiceRecorder.style.display = 'flex';
        }

        // 既存のファイルを表示
        const existingFile = document.getElementById('existing-file');
        const fileAttachSection = document.getElementById('file-attach-section');
        if (memo.fileUrl) {
          document.getElementById('existing-file-link').href = memo.fileUrl;
          document.getElementById('existing-file-name').textContent = memo.fileName || 'ファイル';
          if (existingFile) existingFile.style.display = 'block';
          if (fileAttachSection) fileAttachSection.style.display = 'none';
        } else {
          if (existingFile) existingFile.style.display = 'none';
          if (fileAttachSection) fileAttachSection.style.display = 'block';
        }

        document.getElementById('memo-submit').textContent = '更新';
        document.getElementById('memo-delete').style.display = 'block';
        document.getElementById('memo-modal').classList.add('active');
      } catch (err) {
        console.error('openMemoDetail error:', err);
        showToast('メモを開けませんでした');
      }
    }

    function closeMemoModal() {
      document.getElementById('memo-modal').classList.remove('active');
      editingMemo = null;
      selectedImageBase64 = null;
      clearSelectedFile();
      clearRecordedAudio();
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
    // カスタムリマインダー
    // ========================================
    let eventReminderCounter = 0;
    let taskReminderCounter = 0;

    function addEventCustomReminder() {
      const container = document.getElementById('event-custom-reminders');
      const emptyMsg = container.querySelector('.custom-reminder-empty');
      if (emptyMsg) emptyMsg.remove();

      const id = 'event-cr-' + (++eventReminderCounter);
      const item = document.createElement('div');
      item.className = 'custom-reminder-item';
      item.id = id;
      item.innerHTML = \`
        <input type="number" min="1" max="999" value="30" class="cr-value">
        <select class="cr-unit">
          <option value="minutes">分前</option>
          <option value="hours">時間前</option>
          <option value="days">日前</option>
        </select>
        <select class="cr-time" style="display:none;">
          <option value="09:00">9:00</option>
          <option value="12:00">12:00</option>
          <option value="18:00">18:00</option>
          <option value="21:00">21:00</option>
        </select>
        <button type="button" class="custom-reminder-remove" onclick="removeCustomReminder('\${id}', 'event')">×</button>
      \`;

      // 単位が「日前」の場合は時刻選択を表示
      const unitSelect = item.querySelector('.cr-unit');
      const timeSelect = item.querySelector('.cr-time');
      unitSelect.addEventListener('change', () => {
        timeSelect.style.display = unitSelect.value === 'days' ? 'block' : 'none';
      });

      container.appendChild(item);
      eventCustomReminders.push(id);
    }

    function addTaskCustomReminder() {
      const container = document.getElementById('task-custom-reminders');
      const emptyMsg = container.querySelector('.custom-reminder-empty');
      if (emptyMsg) emptyMsg.remove();

      const id = 'task-cr-' + (++taskReminderCounter);
      const item = document.createElement('div');
      item.className = 'custom-reminder-item';
      item.id = id;
      item.innerHTML = \`
        <input type="number" min="1" max="999" value="1" class="cr-value">
        <select class="cr-unit">
          <option value="days" selected>日前</option>
          <option value="hours">時間前</option>
        </select>
        <select class="cr-time">
          <option value="09:00">9:00</option>
          <option value="12:00">12:00</option>
          <option value="18:00" selected>18:00</option>
          <option value="21:00">21:00</option>
        </select>
        <button type="button" class="custom-reminder-remove" onclick="removeCustomReminder('\${id}', 'task')">×</button>
      \`;

      // 単位が「時間前」の場合は時刻選択を非表示
      const unitSelect = item.querySelector('.cr-unit');
      const timeSelect = item.querySelector('.cr-time');
      unitSelect.addEventListener('change', () => {
        timeSelect.style.display = unitSelect.value === 'days' ? 'block' : 'none';
      });

      container.appendChild(item);
      taskCustomReminders.push(id);
    }

    function removeCustomReminder(id, type) {
      const item = document.getElementById(id);
      if (item) item.remove();

      if (type === 'event') {
        eventCustomReminders = eventCustomReminders.filter(rid => rid !== id);
        if (eventCustomReminders.length === 0) {
          document.getElementById('event-custom-reminders').innerHTML = '<div class="custom-reminder-empty">カスタムリマインダーなし</div>';
        }
      } else {
        taskCustomReminders = taskCustomReminders.filter(rid => rid !== id);
        if (taskCustomReminders.length === 0) {
          document.getElementById('task-custom-reminders').innerHTML = '<div class="custom-reminder-empty">カスタムリマインダーなし</div>';
        }
      }
    }

    function getEventCustomReminders() {
      const reminders = [];
      eventCustomReminders.forEach(id => {
        const item = document.getElementById(id);
        if (item) {
          const value = parseInt(item.querySelector('.cr-value').value) || 1;
          const unit = item.querySelector('.cr-unit').value;
          const time = item.querySelector('.cr-time').value;
          reminders.push({ type: 'custom', value, unit, time });
        }
      });
      return reminders;
    }

    function getTaskCustomReminders() {
      const reminders = [];
      taskCustomReminders.forEach(id => {
        const item = document.getElementById(id);
        if (item) {
          const value = parseInt(item.querySelector('.cr-value').value) || 1;
          const unit = item.querySelector('.cr-unit').value;
          const time = item.querySelector('.cr-time').value;
          reminders.push({ type: 'custom', value, unit, time });
        }
      });
      return reminders;
    }

    function clearEventCustomReminders() {
      eventCustomReminders = [];
      eventReminderCounter = 0;
      document.getElementById('event-custom-reminders').innerHTML = '<div class="custom-reminder-empty">カスタムリマインダーなし</div>';
    }

    function clearTaskCustomReminders() {
      taskCustomReminders = [];
      taskReminderCounter = 0;
      document.getElementById('task-custom-reminders').innerHTML = '<div class="custom-reminder-empty">カスタムリマインダーなし</div>';
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

      // リマインダー収集
      const reminders = [];
      if (document.getElementById('event-reminder-day-before').checked) reminders.push('day_before');
      if (document.getElementById('event-reminder-morning').checked) reminders.push('morning');
      if (!isAllDay && document.getElementById('event-reminder-1hour').checked) reminders.push('1hour_before');
      // カスタムリマインダーを追加
      const customReminders = getEventCustomReminders();
      customReminders.forEach(cr => reminders.push(cr));

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
          const notifyMembers = document.getElementById('event-notify-members').checked;
          await fetch(API_BASE + '/api/shared-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, projectId, title, date, isAllDay, startTime: isAllDay ? null : startTime, endTime: isAllDay ? null : endTime, location, url, memo, reminders, notifyMembers, tagIds: selectedTagIds })
          });
          await loadSharedEvents();
        } else {
          // 編集モードかどうかをチェック
          const isEditing = editingEvent && !editingEvent._isShared;
          const isLocalEvent = isEditing && editingEvent.id && editingEvent.id.startsWith('local_');

          if (isEditing) {
            // 更新処理
            const apiEndpoint = isLocalEvent ? '/api/local-events' : '/api/events';
            const bodyData = { userId, eventId: editingEvent.id, title, date, isAllDay, startTime, endTime, location, url, memo, reminders };
            // ローカルイベントまたはGoogle Calendar以外の場合はタグを含める
            if (isLocalEvent || !googleCalendarSync) {
              bodyData.tagIds = selectedTagIds;
            }
            console.log('[TAG DEBUG] submitEvent - Updating event with selectedTagIds:', JSON.stringify(selectedTagIds), 'isLocalEvent:', isLocalEvent, 'googleCalendarSync:', googleCalendarSync, 'bodyData.tagIds:', JSON.stringify(bodyData.tagIds));
            const response = await fetch(API_BASE + apiEndpoint, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyData)
            });
            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || '予定の更新に失敗しました');
            }
          } else {
            // 新規作成
            const useGoogleCalendar = googleCalendarSync && isGoogleAuthenticated;
            const apiEndpoint = useGoogleCalendar ? '/api/events' : '/api/local-events';
            const bodyData = { userId, title, date, isAllDay, startTime, endTime, location, url, memo, reminders };
            if (!useGoogleCalendar) {
              bodyData.tagIds = selectedTagIds;
            }
            const response = await fetch(API_BASE + apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyData)
            });
            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || '予定の作成に失敗しました');
            }
          }
          await loadEvents();
        }
        showToast(editingEvent ? '予定を更新しました' : '予定を追加しました');
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
          // 同期設定に基づいてAPIを切り替え（ローカルイベントはIDがlocal_で始まる）
          const isLocalEvent = editingEvent.id && editingEvent.id.startsWith('local_');
          const apiEndpoint = isLocalEvent ? '/api/local-events' : '/api/events';
          await fetch(API_BASE + apiEndpoint, {
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
      const dueDate = document.getElementById('task-due').value || null;
      const dueTime = document.getElementById('task-due-time').value || null;
      const listValue = document.getElementById('task-list-select').value;

      // リマインダー収集
      const reminders = [];
      if (document.getElementById('task-reminder-1week').checked) reminders.push('1week_before');
      if (document.getElementById('task-reminder-3days').checked) reminders.push('3days_before');
      if (document.getElementById('task-reminder-day-before').checked) reminders.push('day_before');
      if (document.getElementById('task-reminder-morning').checked) reminders.push('morning');
      // カスタムリマインダーを追加
      const customReminders = getTaskCustomReminders();
      customReminders.forEach(cr => reminders.push(cr));

      // 時刻付き期限の作成
      let due = null;
      if (dueDate) {
        if (dueTime) {
          due = dueDate + 'T' + dueTime;
        } else {
          due = dueDate;
        }
      }

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
          const notifyMembers = document.getElementById('task-notify-members').checked;
          await fetch(API_BASE + '/api/shared-tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, listId, title, due, notifyMembers })
          });
          await loadSharedTasks();
        } else {
          // 同期設定に基づいてAPIを切り替え
          const listName = listValue.replace('google_', '');
          const apiEndpoint = (googleTasksSync && isGoogleAuthenticated) ? '/api/tasks' : '/api/local-tasks';
          await fetch(API_BASE + apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, title, due, listName, reminders })
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
          // ローカルタスクかGoogleタスクかで切り替え
          const isLocalTask = editingTask.id && editingTask.id.startsWith('local_');
          const apiEndpoint = isLocalTask ? '/api/local-tasks' : '/api/tasks';
          await fetch(API_BASE + apiEndpoint, {
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

      // 音声データをBase64に変換
      let audioBase64 = null;
      if (recordedAudioBlob) {
        audioBase64 = await blobToBase64(recordedAudioBlob);
      }

      if (!text && !selectedImageBase64 && !selectedFileBase64 && !audioBase64) {
        showToast('テキスト、画像、ファイル、または音声を入力してください');
        return;
      }

      const btn = document.getElementById('memo-submit');
      btn.disabled = true;
      btn.textContent = '保存中...';

      try {
        const payload = {
          userId,
          text,
          imageBase64: selectedImageBase64
        };

        // ファイル添付
        if (selectedFileBase64) {
          payload.fileBase64 = selectedFileBase64;
          payload.fileName = selectedFileName;
          payload.fileType = selectedFileType;
          payload.fileSize = selectedFileSize;
        }

        // 音声
        if (audioBase64) {
          payload.audioBase64 = audioBase64;
          payload.audioDuration = recordedAudioDuration;
        }

        const response = await fetch(API_BASE + '/api/memos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'メモの保存に失敗しました');
        }
        showToast('メモを保存しました');
        closeMemoModal();
        await loadMemos();
        renderMemos();
      } catch (error) {
        console.error('Failed to create memo:', error);
        showToast(error.message || 'エラーが発生しました');
      } finally {
        btn.disabled = false;
        btn.textContent = '保存';
      }
    }

    // BlobをBase64に変換
    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
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
    // 同期設定
    // ========================================
    async function loadSyncSettings() {
      try {
        const response = await fetch(API_BASE + '/api/sync-settings?userId=' + userId);
        if (response.ok) {
          const settings = await response.json();
          googleCalendarSync = settings.googleCalendarSync || false;
          googleTasksSync = settings.googleTasksSync || false;
        }
      } catch (error) {
        console.error('Failed to load sync settings:', error);
      }
    }

    async function saveSyncSettings() {
      try {
        await fetch(API_BASE + '/api/sync-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            googleCalendarSync,
            googleTasksSync
          })
        });
      } catch (error) {
        console.error('Failed to save sync settings:', error);
      }
    }

    function initSyncSettings() {
      const calendarToggle = document.getElementById('google-calendar-sync-toggle');
      const tasksToggle = document.getElementById('google-tasks-sync-toggle');
      const statusMessage = document.getElementById('sync-status-message');

      calendarToggle.checked = googleCalendarSync;
      tasksToggle.checked = googleTasksSync;

      calendarToggle.onchange = async function() {
        const wantsSync = this.checked;

        if (wantsSync && !isGoogleAuthenticated) {
          // 認証されていない場合は認証を促す
          this.checked = false;
          statusMessage.style.display = 'block';
          statusMessage.innerHTML = 'Googleカレンダー同期を有効にするには、<a href="#" onclick="openGoogleAuth(); return false;" style="color:var(--primary);">Google連携</a>が必要です';
          return;
        }

        googleCalendarSync = wantsSync;
        await saveSyncSettings();

        // データを再読み込み
        await loadEvents();
        renderCalendar();

        statusMessage.style.display = 'block';
        if (wantsSync) {
          statusMessage.textContent = 'Googleカレンダーと同期中...';
          setTimeout(() => { statusMessage.style.display = 'none'; }, 2000);
        } else {
          statusMessage.textContent = 'ローカル保存モードに切り替えました';
          setTimeout(() => { statusMessage.style.display = 'none'; }, 2000);
        }

        showToast(wantsSync ? 'Googleカレンダー同期をオンにしました' : 'ローカル保存に切り替えました');
      };

      tasksToggle.onchange = async function() {
        const wantsSync = this.checked;

        if (wantsSync && !isGoogleAuthenticated) {
          // 認証されていない場合は認証を促す
          this.checked = false;
          statusMessage.style.display = 'block';
          statusMessage.innerHTML = 'Googleタスク同期を有効にするには、<a href="#" onclick="openGoogleAuth(); return false;" style="color:var(--primary);">Google連携</a>が必要です';
          return;
        }

        googleTasksSync = wantsSync;
        await saveSyncSettings();

        // データを再読み込み
        await Promise.all([loadTasks(), loadTaskLists()]);
        renderTasks();
        renderTaskLists();

        statusMessage.style.display = 'block';
        if (wantsSync) {
          statusMessage.textContent = 'Googleタスクと同期中...';
          setTimeout(() => { statusMessage.style.display = 'none'; }, 2000);
        } else {
          statusMessage.textContent = 'ローカル保存モードに切り替えました';
          setTimeout(() => { statusMessage.style.display = 'none'; }, 2000);
        }

        showToast(wantsSync ? 'Googleタスク同期をオンにしました' : 'ローカル保存に切り替えました');
      };

      // 同期オフの場合、メッセージを表示
      if (!googleCalendarSync && !googleTasksSync) {
        statusMessage.style.display = 'block';
        statusMessage.textContent = 'データはローカルに保存されます';
      }
    }

    // ========================================
    // Google認証ステータス
    // ========================================
    async function checkGoogleAuthStatus() {
      try {
        const response = await fetch(API_BASE + '/api/auth-status?userId=' + userId);
        const data = await response.json();
        isGoogleAuthenticated = data.authenticated;

        if (!isGoogleAuthenticated) {
          await getGoogleAuthUrl();
        }

        updateAuthDisplay();
      } catch (error) {
        console.error('Failed to check auth status:', error);
      }
    }

    async function getGoogleAuthUrl() {
      try {
        const response = await fetch(API_BASE + '/api/auth-url?userId=' + userId);
        const data = await response.json();
        googleAuthUrl = data.authUrl;
      } catch (error) {
        console.error('Failed to get auth URL:', error);
      }
    }

    function updateAuthDisplay() {
      const authBanner = document.getElementById('auth-banner');
      const googleAuthValue = document.getElementById('google-auth-value');
      const revokeBtn = document.getElementById('google-auth-revoke-btn');

      if (isGoogleAuthenticated) {
        authBanner.classList.remove('show');
        document.body.classList.remove('needs-auth');
        googleAuthValue.innerHTML = '<span style="color:var(--primary);">✓ 連携済み</span>';
        if (revokeBtn) revokeBtn.style.display = 'inline';
      } else {
        if (revokeBtn) revokeBtn.style.display = 'none';
        // 同期がオフの場合はバナーを表示しない（ローカル保存モードなので認証不要）
        if (googleCalendarSync || googleTasksSync) {
          authBanner.classList.add('show');
          document.body.classList.add('needs-auth');
        } else {
          authBanner.classList.remove('show');
          document.body.classList.remove('needs-auth');
        }
        if (googleAuthUrl) {
          googleAuthValue.innerHTML = '<button onclick="openGoogleAuth()" style="color:#ff9800;background:none;border:none;text-decoration:underline;font-size:inherit;cursor:pointer;">連携する</button>';
        } else {
          googleAuthValue.textContent = '未連携';
        }
      }
    }

    function openGoogleAuth() {
      if (googleAuthUrl) {
        liff.openWindow({
          url: googleAuthUrl,
          external: true
        });
      } else {
        showToast('認証URLを取得中...');
        getGoogleAuthUrl().then(() => {
          if (googleAuthUrl) {
            liff.openWindow({
              url: googleAuthUrl,
              external: true
            });
          }
        });
      }
    }

    async function revokeGoogleAuth() {
      if (!confirm('Google連携を解除しますか？\\n\\n解除すると同期設定もオフになり、ローカル保存モードに切り替わります。')) {
        return;
      }

      try {
        showToast('連携を解除中...');
        const response = await fetch(API_BASE + '/api/auth-revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });

        if (response.ok) {
          // 状態を更新
          isGoogleAuthenticated = false;
          googleCalendarSync = false;
          googleTasksSync = false;

          // UIを更新
          document.getElementById('google-calendar-sync-toggle').checked = false;
          document.getElementById('google-tasks-sync-toggle').checked = false;
          const statusMessage = document.getElementById('sync-status-message');
          statusMessage.style.display = 'block';
          statusMessage.textContent = 'データはローカルに保存されます';

          // 認証URLを再取得
          await getGoogleAuthUrl();
          updateAuthDisplay();

          // ローカルデータを読み込み
          await Promise.all([loadEvents(), loadTasks(), loadTaskLists()]);
          renderCalendar();
          renderTasks();

          showToast('Google連携を解除しました');
        } else {
          throw new Error('連携解除に失敗しました');
        }
      } catch (error) {
        console.error('Failed to revoke auth:', error);
        showToast('エラーが発生しました');
      }
    }

    function handle401Error() {
      if (isGoogleAuthenticated) {
        isGoogleAuthenticated = false;
        getGoogleAuthUrl().then(() => updateAuthDisplay());
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
      const dateStr = (date.getMonth() + 1) + '/' + date.getDate();
      // 時刻が00:00:00以外の場合は時刻も表示
      const hours = date.getHours();
      const minutes = date.getMinutes();
      if (hours !== 0 || minutes !== 0) {
        const timeStr = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
        return dateStr + ' ' + timeStr;
      }
      return dateStr;
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
      // 終日予定の場合は「1時間前」リマインダーを非表示
      document.getElementById('event-reminder-1hour-option').style.display = e.target.checked ? 'none' : 'flex';
      if (e.target.checked) {
        document.getElementById('event-reminder-1hour').checked = false;
      }
    });

    // カレンダー選択変更時のハンドラー（共有カレンダー選択時に通知トグル表示）
    document.getElementById('event-calendar').addEventListener('change', (e) => {
      const isSharedCalendar = e.target.value !== '';
      document.getElementById('event-notify-group').style.display = isSharedCalendar ? 'block' : 'none';
    });

    // タスクリスト選択変更時のハンドラー（共有タスクリスト選択時に通知トグル表示）
    document.getElementById('task-list-select').addEventListener('change', (e) => {
      const isSharedList = e.target.value.startsWith('shared_');
      document.getElementById('task-notify-group').style.display = isSharedList ? 'block' : 'none';
    });

    // タスク期限日付変更時のハンドラー（change + input 両方で確実に発火）
    function handleTaskDueChange() {
      const hasDate = document.getElementById('task-due').value !== '';
      document.getElementById('task-time-row').style.display = hasDate ? 'block' : 'none';
      document.getElementById('task-reminder-group').style.display = hasDate ? 'block' : 'none';
      if (!hasDate) {
        document.getElementById('task-due-time').value = '';
        document.getElementById('task-reminder-1week').checked = false;
        document.getElementById('task-reminder-3days').checked = false;
        document.getElementById('task-reminder-day-before').checked = false;
        document.getElementById('task-reminder-morning').checked = false;
      }
    }
    document.getElementById('task-due').addEventListener('change', handleTaskDueChange);
    document.getElementById('task-due').addEventListener('input', handleTaskDueChange);
    document.getElementById('task-due').addEventListener('blur', handleTaskDueChange);

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

    document.getElementById('auto-backup-toggle').addEventListener('change', toggleAutoBackup);

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
