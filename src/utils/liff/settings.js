/**
 * Event listeners + settings
 */
export function getSettingsCode() {
  return `    // ユーティリティ
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
      date.setHours(0,0,0,0);
      
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const diffTime = date - today;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      const dateStr = (date.getMonth() + 1) + '/' + date.getDate();

      if (diffDays < 0) {
        return '<span style="color:var(--text-danger);font-weight:bold;">期限切れ (' + dateStr + ')</span>';
      } else if (diffDays === 0) {
        return '<span style="color:var(--primary);font-weight:bold;">今日</span>';
      } else if (diffDays === 1) {
        return '<span style="color:var(--text-color);font-weight:bold;">明日 (' + dateStr + ')</span>';
      } else {
        return dateStr;
      }
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

    let enabledCalendars = [];

    async function handleCalendarToggle(e) {
      const calId = e.target.dataset.id;
      const isChecked = e.target.checked;
      
      if (isChecked) {
        if (!enabledCalendars.includes(calId)) enabledCalendars.push(calId);
      } else {
        enabledCalendars = enabledCalendars.filter(id => id !== calId);
      }

      if (enabledCalendars.length === 0) {
          showToast('少なくとも1つのカレンダーを同期する必要があります');
          e.target.checked = true;
          enabledCalendars.push(calId);
          return;
      }

      try {
        const response = await fetch(API_BASE + '/api/settings/calendars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, enabledCalendars })
        });
        if (response.ok) {
          showToast('同期設定を保存しました。再読み込み後、カレンダーに反映されます。');
          // 必要であればここで loadEventsAndTasks() を呼ぶ。初回はリロードを促す
        }
      } catch (error) {
        console.error('Failed to save calendar setting:', error);
        e.target.checked = !isChecked; // エラー時は入力を元に戻す
        showToast('設定の保存に失敗しました');
      }
    }

    async function loadCalendarSettings() {
      try {
        const [calendarsRes, settingsRes] = await Promise.all([
          fetch(API_BASE + '/api/calendars?userId=' + userId),
          fetch(API_BASE + '/api/settings/calendars?userId=' + userId)
        ]);

        const container = document.getElementById('calendar-sync-list');

        if (calendarsRes.status === 401 || settingsRes.status === 401) {
          handle401Error();
          return;
        }

        if (calendarsRes.ok && settingsRes.ok) {
          const availableCalendars = await calendarsRes.json();
          const loadedSettings = await settingsRes.json();

          if (!availableCalendars || availableCalendars.length === 0) {
            container.innerHTML = '<div style="padding:14px 16px;color:var(--text-muted);font-size:14px;">Googleカレンダーが見つかりません。</div>';
            return;
          }

          if (loadedSettings && loadedSettings.length > 0) {
            enabledCalendars = loadedSettings;
          } else {
            // 設定が無い場合は主カレンダーのみデフォルトONにする
            const primary = availableCalendars.find(c => c.primary);
            enabledCalendars = primary ? [primary.id] : [availableCalendars[0].id];
          }

          let html = '';
          availableCalendars.forEach(cal => {
            const isChecked = enabledCalendars.includes(cal.id);
            html += '<div class="settings-item" style="border-bottom: 1px solid var(--border-color);">';
            html += '<div style="display:flex;align-items:center;gap:10px;">';
            if (cal.backgroundColor) {
               html += '<div style="width:12px;height:12px;border-radius:50%;background-color:' + cal.backgroundColor + '"></div>';
            }
            html += '<span class="settings-item-label">' + escapeHtml(cal.summary) + '</span>';
            html += '</div>';
            html += '<label class="toggle-switch">';
            html += '<input type="checkbox" class="calendar-sync-toggle" data-id="' + escapeHtml(cal.id) + '" ' + (isChecked ? 'checked' : '') + '>';
            html += '<span class="toggle-slider"></span>';
            html += '</label>';
            html += '</div>';
          });
          container.innerHTML = html;

          document.querySelectorAll('.calendar-sync-toggle').forEach(el => {
            el.addEventListener('change', handleCalendarToggle);
          });
        } else {
           container.innerHTML = '<div style="padding:14px 16px;color:var(--text-danger);font-size:14px;">カレンダーの読み込みに失敗しました</div>';
        }
      } catch (error) {
        console.error('Failed to load calendar settings:', error);
        document.getElementById('calendar-sync-list').innerHTML = '<div style="padding:14px 16px;color:var(--text-danger);font-size:14px;">通信エラーが発生しました</div>';
      }
    }

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
  </script>`;
}
