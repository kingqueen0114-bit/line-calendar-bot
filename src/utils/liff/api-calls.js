/**
 * Modal API call functions
 */
export function getApiCallsCode() {
  return `    // モーダル
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

    // ========================================`;
}
