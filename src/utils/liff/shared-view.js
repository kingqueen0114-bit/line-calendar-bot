/**
 * Shared calendar rendering
 */
export function getSharedViewCode() {
  return `    // 共有カレンダー描画
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

    // ========================================`;
}
