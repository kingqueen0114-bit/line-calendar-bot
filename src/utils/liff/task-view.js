/**
 * Task tab rendering
 */
export function getTaskViewCode() {
  return `    // タスク描画
    // ========================================
    function renderTaskTabs() {
      const tabsContainer = document.getElementById('task-tabs');
      let tabsHtml = '';

      // すべてタブ
      tabsHtml += '<button class="task-tab' + (taskFilter === 'all' ? ' active' : '') + '" onclick="setTaskFilter(\\\\'all\\\\')">すべて</button>';

      // マイタスクタブ
      tabsHtml += '<button class="task-tab' + (taskFilter === 'personal' ? ' active' : '') + '" onclick="setTaskFilter(\\\\'personal\\\\')">マイタスク</button>';

      // 共有タスクリストのタブ
      sharedTaskLists.forEach(list => {
        const isActive = taskFilter === 'list_' + list.id;
        tabsHtml += '<button class="task-tab' + (isActive ? ' active' : '') + '" onclick="setTaskFilter(\\\\'list_' + list.id + '\\\\')">';
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
          html += '<div class="task-item" onclick="openTaskDetail(\\\\'' + taskIndex + '\\\\')">';
          html += '<div class="task-checkbox" onclick="event.stopPropagation(); toggleTask(\\\\'' + taskIndex + '\\\\')"></div>';
          html += '<div class="task-content"><div class="task-title">' + escapeHtml(task.title) + '</div>';
          if (task.due) {
             html += '<div class="task-due" style="font-size:12px;margin-top:4px;">期限: ' + formatDueDate(task.due) + '</div>';
          }
          if (task.notes) {
             html += '<div class="task-notes" style="font-size:11px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + escapeHtml(task.notes) + '</div>';
          }
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
          html += '<div class="task-item" onclick="openTaskDetail(\\\\'' + taskIndex + '\\\\')">';
          html += '<div class="task-checkbox" onclick="event.stopPropagation(); toggleTask(\\\\'' + taskIndex + '\\\\')"></div>';
          html += '<div class="task-content"><div class="task-title">' + escapeHtml(task.title) + '</div>';
          if (task.due) {
             html += '<div class="task-due" style="font-size:12px;margin-top:4px;">期限: ' + formatDueDate(task.due) + '</div>';
          }
          if (task.notes) {
             html += '<div class="task-notes" style="font-size:11px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + escapeHtml(task.notes) + '</div>';
          }
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
            body: JSON.stringify({ userId, taskId: task.id, listId: task.listId, userName })
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
      const allCompleted = getAllCompletedTasks();
      const countEl = document.getElementById('completed-count');
      countEl.textContent = allCompleted.length + '件';

      if (allCompleted.length === 0) {
        container.innerHTML = '<div class="empty" style="padding:20px;">完了済みタスクはありません</div>';
        return;
      }

      let html = '';
      allCompleted.forEach((task, i) => {
        const isShared = task.isShared;
        const indexStr = isShared ? 'cshared_' + i : 'c_' + i;
        html += '<div class="completed-task-item">';
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
        html += '</div>';
        html += '<button class="uncomplete-btn" onclick="event.stopPropagation(); uncompleteTask(\\\\'' + indexStr + '\\\\')">戻す</button>';
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
          await fetch(API_BASE + '/api/tasks/uncomplete', {
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

    // ========================================`;
}
