/**
 * Google auth status checks
 */
export function getAuthComponentsCode() {
  return `    // API呼び出し
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

    // ========================================`;
}
