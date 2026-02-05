/**
 * 環境アダプター - Cloudflare Workers の env を Node.js 環境で再現
 */
import * as storage from './storage.js';

// 環境変数をロード
import dotenv from 'dotenv';
dotenv.config();

/**
 * Cloudflare Workers の env オブジェクトと互換性のある環境オブジェクト
 */
export const env = {
  // 環境変数
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  OAUTH_REDIRECT_URI: process.env.OAUTH_REDIRECT_URI,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  LIFF_ID: process.env.LIFF_ID,
  ADMIN_USER_ID: process.env.ADMIN_USER_ID,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  // KV Namespace 互換オブジェクト
  NOTIFICATIONS: {
    get: async (key, options) => storage.get(key, options),
    put: async (key, value, options) => storage.put(key, value, options),
    delete: async (key) => storage.del(key),
    list: async (options) => {
      if (options && options.prefix) {
        return { keys: await storage.list(options.prefix) };
      }
      return { keys: [] };
    }
  }
};

/**
 * waitUntil の互換実装（Promise を非同期で実行）
 */
export function createContext() {
  const promises = [];

  return {
    waitUntil: (promise) => {
      promises.push(promise);
      // バックグラウンドで実行（エラーをログ）
      promise.catch(err => console.error('Background task error:', err));
    },
    // すべての待機中のPromiseを待つ（テスト用）
    waitForAll: () => Promise.all(promises)
  };
}

export default env;
