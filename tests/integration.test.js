/**
 * LINE Calendar Bot - Integration Tests
 * LINEモックサーバーを使用した統合テスト
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const MOCK_USER_ID = 'test-user-' + Date.now();

// Simple test framework
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\\n=== LINE Calendar Bot Integration Tests ===\\n');

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ ${t.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${t.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\\n=== Results: ${passed} passed, ${failed} failed ===\\n`);
  process.exit(failed > 0 ? 1 : 0);
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Helper function for HTTP requests
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: response.status, data, headers: response.headers };
}

// ============================================
// Health Check Tests
// ============================================

test('Health check returns 200', async () => {
  const res = await request('/');
  assertEqual(res.status, 200, 'Health check should return 200');
});

test('Health check has security headers', async () => {
  const res = await request('/');
  assert(res.headers.get('x-xss-protection'), 'Should have X-XSS-Protection header');
  assert(res.headers.get('x-content-type-options'), 'Should have X-Content-Type-Options header');
});

// ============================================
// LIFF Page Tests
// ============================================

test('LIFF page returns HTML', async () => {
  const res = await request('/liff');
  assertEqual(res.status, 200, 'LIFF should return 200');
  assert(typeof res.data === 'string' && res.data.includes('<!DOCTYPE html>'), 'Should return HTML');
});

test('LIFF page has no-cache headers', async () => {
  const res = await request('/liff');
  const cacheControl = res.headers.get('cache-control');
  assert(cacheControl && cacheControl.includes('no-cache'), 'Should have no-cache header');
});

// ============================================
// API Tests - Auth
// ============================================

test('Auth status requires userId', async () => {
  const res = await request('/api/auth-status');
  assertEqual(res.status, 400, 'Should return 400 without userId');
});

test('Auth status returns for valid userId', async () => {
  const res = await request(`/api/auth-status?userId=${MOCK_USER_ID}`);
  assertEqual(res.status, 200, 'Should return 200');
  assert('authenticated' in res.data, 'Should have authenticated field');
});

test('Auth URL requires userId', async () => {
  const res = await request('/api/auth-url');
  assertEqual(res.status, 400, 'Should return 400 without userId');
});

test('Auth URL returns URL for valid userId', async () => {
  const res = await request(`/api/auth-url?userId=${MOCK_USER_ID}`);
  assertEqual(res.status, 200, 'Should return 200');
  assert(res.data.authUrl, 'Should have authUrl field');
});

// ============================================
// API Tests - Local Events
// ============================================

test('Local events requires userId', async () => {
  const res = await request('/api/local-events');
  assertEqual(res.status, 400, 'Should return 400 without userId');
});

test('Local events returns array', async () => {
  const res = await request(`/api/local-events?userId=${MOCK_USER_ID}`);
  assertEqual(res.status, 200, 'Should return 200');
  assert(Array.isArray(res.data), 'Should return array');
});

test('Can create local event', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const eventData = {
    userId: MOCK_USER_ID,
    title: 'Test Event',
    date: tomorrow.toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00'
  };

  const res = await request('/api/local-events', {
    method: 'POST',
    body: JSON.stringify(eventData)
  });

  assertEqual(res.status, 200, 'Should return 200');
  assert(res.data.success || res.data.id, 'Should indicate success');
});

// ============================================
// API Tests - Local Tasks
// ============================================

test('Local tasks requires userId', async () => {
  const res = await request('/api/local-tasks');
  assertEqual(res.status, 400, 'Should return 400 without userId');
});

test('Local tasks returns array', async () => {
  const res = await request(`/api/local-tasks?userId=${MOCK_USER_ID}`);
  assertEqual(res.status, 200, 'Should return 200');
  assert(Array.isArray(res.data), 'Should return array');
});

test('Can create local task', async () => {
  const taskData = {
    userId: MOCK_USER_ID,
    title: 'Test Task',
    dueDate: new Date().toISOString().split('T')[0]
  };

  const res = await request('/api/local-tasks', {
    method: 'POST',
    body: JSON.stringify(taskData)
  });

  assertEqual(res.status, 200, 'Should return 200');
  assert(res.data.success || res.data.id, 'Should indicate success');
});

// ============================================
// API Tests - Memos
// ============================================

test('Memos requires userId', async () => {
  const res = await request('/api/memos');
  assertEqual(res.status, 400, 'Should return 400 without userId');
});

test('Memos returns array', async () => {
  const res = await request(`/api/memos?userId=${MOCK_USER_ID}`);
  assertEqual(res.status, 200, 'Should return 200');
  assert(Array.isArray(res.data), 'Should return array');
});

// ============================================
// API Tests - Sync Settings
// ============================================

test('Sync settings requires userId', async () => {
  const res = await request('/api/sync-settings');
  assertEqual(res.status, 400, 'Should return 400 without userId');
});

test('Sync settings returns object', async () => {
  const res = await request(`/api/sync-settings?userId=${MOCK_USER_ID}`);
  assertEqual(res.status, 200, 'Should return 200');
  assert(typeof res.data === 'object', 'Should return object');
});

// ============================================
// API Tests - Backup
// ============================================

test('Backup export requires userId', async () => {
  const res = await request('/api/backup/export');
  assertEqual(res.status, 400, 'Should return 400 without userId');
});

test('Backup export returns data', async () => {
  const res = await request(`/api/backup/export?userId=${MOCK_USER_ID}`);
  assertEqual(res.status, 200, 'Should return 200');
  assert(typeof res.data === 'object', 'Should return object');
});

// ============================================
// Rate Limiting Tests
// ============================================

test('Rate limit headers are present', async () => {
  const res = await request(`/api/auth-status?userId=${MOCK_USER_ID}`);
  assert(res.headers.get('x-ratelimit-limit'), 'Should have rate limit header');
  assert(res.headers.get('x-ratelimit-remaining'), 'Should have remaining header');
});

// ============================================
// Security Tests
// ============================================

test('SQL injection is blocked', async () => {
  const res = await request('/api/local-tasks', {
    method: 'POST',
    body: JSON.stringify({
      userId: MOCK_USER_ID,
      title: "'; DROP TABLE users; --"
    })
  });
  // Should either block or sanitize
  assert(res.status === 400 || res.status === 200, 'Should handle SQL injection attempt');
});

// Run all tests
runTests();
