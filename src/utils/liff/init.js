/**
 * LIFF initialization & data loading
 */
export function getInitCode() {
  return `    // ========================================
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

        // まずGoogle認証状態を確認
        await checkGoogleAuthStatus();

        await Promise.all([loadEvents(), loadTasks(), loadTaskLists(), loadMemos(), loadProjects(), loadSharedEvents(), loadSharedTaskLists(), loadSharedTasks()]);
        renderCalendar();
        renderTasks();
        renderMemos();
        renderProjects();
        renderTaskLists();
        loadNotificationSettings();
        loadCalendarSettings();

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
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) events = await response.json();
      } catch (error) {
        console.error('Failed to load events:', error);
      }
    }

    async function loadTasks() {
      try {
        const response = await fetch(API_BASE + '/api/tasks?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) tasks = await response.json();
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    }

    async function loadTaskLists() {
      try {
        const response = await fetch(API_BASE + '/api/tasklists?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) taskLists = await response.json();
      } catch (error) {
        console.error('Failed to load task lists:', error);
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
        const response = await fetch(API_BASE + '/api/tasks/completed?userId=' + userId + cacheBust(), { cache: 'no-store' });
        if (response.status === 401) { handle401Error(); return; }
        if (response.ok) completedTasks = await response.json();
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

    // ========================================`;
}
