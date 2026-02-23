/**
 * Calendar/tasklist modals
 */
export function getModalsCode() {
  return `    // カレンダーモーダル
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

    // ========================================`;
}
