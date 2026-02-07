/**
 * LINE Bot モックテスト
 * サーバー API をテストしてボットの動作を確認
 */

const BASE_URL = 'https://line-calendar-bot-67385363897.asia-northeast1.run.app';
const TEST_USER_ID = 'U_mock_test_user_' + Date.now();

async function runTests() {
  console.log('🧪 LINE Bot モックテスト開始\n');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;

  // テスト1: ヘルスチェック
  console.log('\n1️⃣ ヘルスチェック...');
  try {
    const res = await fetch(BASE_URL + '/');
    const text = await res.text();
    if (text.includes('running')) {
      console.log('   ✅ サーバー稼働中');
      passed++;
    } else {
      console.log('   ❌ 予期しないレスポンス');
      failed++;
    }
  } catch (e) {
    console.log('   ❌ エラー:', e.message);
    failed++;
  }

  // テスト2: 認証状態確認 API
  console.log('\n2️⃣ 認証状態確認 API...');
  try {
    const res = await fetch(BASE_URL + '/api/auth-status?userId=' + TEST_USER_ID);
    const data = await res.json();
    console.log('   ✅ レスポンス:', JSON.stringify(data));
    passed++;
  } catch (e) {
    console.log('   ❌ エラー:', e.message);
    failed++;
  }

  // テスト3: ローカルイベント作成
  console.log('\n3️⃣ ローカルイベント作成...');
  let eventId = null;
  try {
    const res = await fetch(BASE_URL + '/api/local-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        title: 'モックテスト会議',
        date: '2026-02-07',
        startTime: '15:00',
        endTime: '16:00',
        isAllDay: false,
      }),
    });
    const data = await res.json();
    if (data.id) {
      eventId = data.id;
      console.log('   ✅ イベント作成成功:', data.id);
      passed++;
    } else {
      console.log('   ❌ 作成失敗:', JSON.stringify(data));
      failed++;
    }
  } catch (e) {
    console.log('   ❌ エラー:', e.message);
    failed++;
  }

  // テスト4: ローカルタスク作成
  console.log('\n4️⃣ ローカルタスク作成...');
  let taskId = null;
  try {
    const res = await fetch(BASE_URL + '/api/local-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        title: 'モックテストタスク',
        due: '2026-02-08T10:00:00Z',
      }),
    });
    const data = await res.json();
    if (data.id) {
      taskId = data.id;
      console.log('   ✅ タスク作成成功:', data.id);
      passed++;
    } else {
      console.log('   ❌ 作成失敗:', JSON.stringify(data));
      failed++;
    }
  } catch (e) {
    console.log('   ❌ エラー:', e.message);
    failed++;
  }

  // テスト5: イベント一覧取得
  console.log('\n5️⃣ ローカルイベント一覧取得...');
  try {
    const res = await fetch(BASE_URL + '/api/local-events?userId=' + TEST_USER_ID);
    const data = await res.json();
    console.log('   ✅ イベント数:', data.length);
    if (data.length > 0) {
      console.log('   📅', data[0].title, '-', data[0].date);
    }
    passed++;
  } catch (e) {
    console.log('   ❌ エラー:', e.message);
    failed++;
  }

  // テスト6: タスク一覧取得
  console.log('\n6️⃣ ローカルタスク一覧取得...');
  try {
    const res = await fetch(BASE_URL + '/api/local-tasks?userId=' + TEST_USER_ID);
    const data = await res.json();
    console.log('   ✅ タスク数:', data.length);
    if (data.length > 0) {
      console.log('   ✅', data[0].title);
    }
    passed++;
  } catch (e) {
    console.log('   ❌ エラー:', e.message);
    failed++;
  }

  // テスト7: メモ作成
  console.log('\n7️⃣ メモ作成...');
  try {
    const res = await fetch(BASE_URL + '/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        text: 'これはモックテストのメモです 📝',
      }),
    });
    const data = await res.json();
    if (data.id) {
      console.log('   ✅ メモ作成成功:', data.id);
      passed++;
    } else {
      console.log('   ❌ 作成失敗:', JSON.stringify(data));
      failed++;
    }
  } catch (e) {
    console.log('   ❌ エラー:', e.message);
    failed++;
  }

  // テスト8: 通知設定
  console.log('\n8️⃣ 通知設定取得...');
  try {
    const res = await fetch(BASE_URL + '/api/settings/notifications?userId=' + TEST_USER_ID);
    const data = await res.json();
    console.log('   ✅ 通知設定:', JSON.stringify(data));
    passed++;
  } catch (e) {
    console.log('   ❌ エラー:', e.message);
    failed++;
  }

  // 結果表示
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 テスト結果');
  console.log('   成功:', passed);
  console.log('   失敗:', failed);
  console.log('   成功率:', ((passed / (passed + failed)) * 100).toFixed(1) + '%');

  if (failed === 0) {
    console.log('\n🎉 全テスト合格！LINE Bot は正常に動作しています。');
  } else {
    console.log('\n⚠️ 一部テストが失敗しました。');
  }

  console.log('\n📱 スマホの LINE アプリでも以下をお試しください:');
  console.log('   ・「今日の予定」と送信');
  console.log('   ・「明日15時に会議」と送信');
  console.log('   ・「タスク追加 買い物」と送信');
}

runTests().catch(console.error);
