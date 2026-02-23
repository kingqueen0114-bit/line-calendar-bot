/**
 * Calendar tab rendering (month/week/day)
 */
export function getCalendarViewCode() {
  return `    // カレンダー描画
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
          html += '<div class="timeline-event" style="' + bgStyle + '" onclick="showEventDetailModal(\\\\'' + event.id + '\\\\', ' + isShared + ', \\\\'' + (event.projectId || '') + '\\\\')">';
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
        html += '<div class="event-card" style="' + borderStyle + '" onclick="showEventDetailModal(\\\\'' + event.id + '\\\\', ' + isShared + ', \\\\'' + (event.projectId || '') + '\\\\')">';
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
          html += '<div class="day-detail-event" style="border-left-color:' + bgColor + ';" onclick="showEventDetailModal(\\\\'' + event.id + '\\\\', ' + (event.isShared ? 'true' : 'false') + ', \\\\'' + (event.projectId || '') + '\\\\')">';
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
      const lines = desc.split('\\\\n');
      const urlLine = lines.find(l => l.startsWith('http'));
      const memoLines = lines.filter(l => !l.startsWith('http') && l.trim()).join('\\\\n');

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
      const lines = desc.split('\\\\n');
      const urlLine = lines.find(l => l.startsWith('http'));
      document.getElementById('event-url').value = urlLine || '';
      document.getElementById('event-memo').value = lines.filter(l => !l.startsWith('http')).join('\\\\n').trim();

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

    // ========================================`;
}
