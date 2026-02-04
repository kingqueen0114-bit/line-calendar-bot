/**
 * ストレージモジュール - Firestore を使用
 * Cloudflare KV の代替
 */
import { Firestore } from '@google-cloud/firestore';

let db = null;

function getDb() {
  if (!db) {
    db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT
    });
  }
  return db;
}

/**
 * 値を取得
 * @param {string} key - キー
 * @param {object} options - オプション（type: 'json' など）
 * @returns {Promise<any>}
 */
export async function get(key, options = {}) {
  try {
    console.log('Storage.get: fetching key:', key);
    const firestore = getDb();
    console.log('Storage.get: got firestore instance');
    const doc = await firestore.collection('kv').doc(key).get();
    console.log('Storage.get: query completed for key:', key);

    if (!doc.exists) {
      console.log('Storage.get: document does not exist for key:', key);
      return null;
    }
    console.log('Storage.get: document exists for key:', key);

    const data = doc.data();

    // TTL チェック
    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      await del(key);
      return null;
    }

    if (options.type === 'json') {
      return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    }

    return data.value;
  } catch (error) {
    console.error('Storage get error:', key, error);
    return null;
  }
}

/**
 * 値を保存
 * @param {string} key - キー
 * @param {any} value - 値
 * @param {object} options - オプション（expirationTtl など）
 * @returns {Promise<void>}
 */
export async function put(key, value, options = {}) {
  try {
    const docData = {
      value: typeof value === 'object' ? JSON.stringify(value) : value,
      updatedAt: Firestore.FieldValue.serverTimestamp()
    };

    // TTL 設定
    if (options.expirationTtl) {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + options.expirationTtl);
      docData.expiresAt = expiresAt;
    }

    await getDb().collection('kv').doc(key).set(docData);
  } catch (error) {
    console.error('Storage put error:', key, error);
    throw error;
  }
}

/**
 * 値を削除
 * @param {string} key - キー
 * @returns {Promise<void>}
 */
export async function del(key) {
  try {
    await getDb().collection('kv').doc(key).delete();
  } catch (error) {
    console.error('Storage delete error:', key, error);
  }
}

/**
 * プレフィックスでリスト取得
 * @param {string} prefix - プレフィックス
 * @returns {Promise<Array<{key: string, value: any}>>}
 */
export async function list(prefix) {
  try {
    const snapshot = await getDb()
      .collection('kv')
      .where('__name__', '>=', prefix)
      .where('__name__', '<', prefix + '\uf8ff')
      .get();

    const results = [];
    const now = new Date();

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // TTL チェック
      if (data.expiresAt && data.expiresAt.toDate() < now) {
        await del(doc.id);
        continue;
      }

      results.push({
        key: doc.id,
        value: data.value
      });
    }

    return results;
  } catch (error) {
    console.error('Storage list error:', prefix, error);
    return [];
  }
}

// 互換性のためのエクスポート
export default {
  get,
  put,
  delete: del,
  list
};
