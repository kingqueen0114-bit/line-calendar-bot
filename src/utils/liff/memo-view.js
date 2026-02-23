/**
 * Memo tab rendering
 */
export function getMemoViewCode() {
  return `    // メモ描画
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
          html += '<div class="memo-card-text" style="white-space: pre-wrap; word-wrap: break-word;">' + (hasText ? escapeHtml(memo.text) : '画像メモ') + '</div>';
          html += '<div class="memo-card-date">' + formatMemoDate(memo.createdAt) + '</div>';
          html += '</div>';
        } else {
          // リスト/グリッド: 画像を上に表示
          if (hasImage) {
            html += '<img class="memo-card-image" src="' + memo.imageUrl + '" alt="">';
          }
          html += '<div class="memo-card-content">';
          if (hasText) {
            html += '<div class="memo-card-text" style="white-space: pre-wrap; word-wrap: break-word;">' + escapeHtml(memo.text) + '</div>';
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

    // ========================================`;
}
