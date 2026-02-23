/**
 * Utilities (toast, escape, helpers)
 */
export function getCommonCode() {
  return `    // Google認証ステータス
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

      if (isGoogleAuthenticated) {
        authBanner.classList.remove('show');
        document.body.classList.remove('needs-auth');
        googleAuthValue.innerHTML = '<span style="color:var(--primary);">✓ 連携済み</span>';
      } else {
        authBanner.classList.add('show');
        document.body.classList.add('needs-auth');
        if (googleAuthUrl) {
          googleAuthValue.innerHTML = '<button onclick="openGoogleAuth()" style="color:#ff9800;background:none;border:none;text-decoration:underline;font-size:inherit;cursor:pointer;">連携する</button>';
        } else {
          googleAuthValue.textContent = '未連携';
        }
      }
    }

    let isAuthenticatingExternal = false;

    function openGoogleAuth() {
      if (googleAuthUrl) {
        isAuthenticatingExternal = true;
        liff.openWindow({
          url: googleAuthUrl,
          external: true
        });
      } else {
        showToast('認証URLを取得中...');
        getGoogleAuthUrl().then(() => {
          if (googleAuthUrl) {
            isAuthenticatingExternal = true;
            liff.openWindow({
              url: googleAuthUrl,
              external: true
            });
          }
        });
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isAuthenticatingExternal) {
        isAuthenticatingExternal = false;
        showToast('認証状況を確認しています...');
        
        // Slightly delay the status check to give the backend time to save the token
        setTimeout(() => {
          fetch(API_BASE + '/api/auth-status?userId=' + userId)
            .then(res => res.json())
            .then(data => {
              isGoogleAuthenticated = data.authenticated;
              updateAuthDisplay();
              
              if (isGoogleAuthenticated) {
                showToast('連携が完了しました');
                // Switch to calendar tab safely
                document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                document.querySelector('[data-tab="calendar"]').classList.add('active');
                document.getElementById('calendar').classList.add('active');
                currentTab = 'calendar';
                
                // Reload calendar events
                loadEventsAndTasks();
                loadCalendarSettings();
              }
            })
            .catch(err => console.error('Auth verification failed on return', err));
        }, 1000);
      }
    });

    function handle401Error() {
      if (isGoogleAuthenticated) {
        isGoogleAuthenticated = false;
        showToast('Googleの権限更新のため、再度「連携する」をお願いします');
        getGoogleAuthUrl().then(() => updateAuthDisplay());
      }
    }

    // ========================================`;
}
