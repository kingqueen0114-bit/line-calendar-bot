/**
 * メモ機能 - Firestore + GCS連携
 */
import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'line-calendar-bot-memos';
let storage = null;

function getStorage() {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT
    });
  }
  return storage;
}

/**
 * 画像をGCSにアップロード
 * @param {Buffer} imageBuffer - 画像データ
 * @param {string} userId - ユーザーID
 * @param {string} mimeType - MIMEタイプ
 * @returns {Promise<string>} - 画像URL
 */
export async function uploadImage(imageBuffer, userId, mimeType = 'image/jpeg') {
  const bucket = getStorage().bucket(BUCKET_NAME);
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
  const file = bucket.file(fileName);

  await file.save(imageBuffer, {
    metadata: {
      contentType: mimeType
    }
  });

  // 公開URLを生成
  const url = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;
  return url;
}

/**
 * メモを作成
 * @param {object} memoData - メモデータ
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object>} - 作成されたメモ
 */
export async function createMemo(memoData, userId, env) {
  const memoId = `memo_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const memo = {
    id: memoId,
    userId,
    text: memoData.text || '',
    imageUrl: memoData.imageUrl || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Firestoreに保存
  await env.NOTIFICATIONS.put(
    `memo:${userId}:${memoId}`,
    JSON.stringify(memo)
  );

  // ユーザーのメモ一覧に追加
  const memoListKey = `memo_list:${userId}`;
  let memoList = await env.NOTIFICATIONS.get(memoListKey, { type: 'json' }) || [];
  memoList.unshift(memoId);
  await env.NOTIFICATIONS.put(memoListKey, JSON.stringify(memoList));

  return memo;
}

/**
 * ユーザーのメモ一覧を取得
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<Array>} - メモ一覧
 */
export async function getMemos(userId, env) {
  const memoListKey = `memo_list:${userId}`;
  const memoList = await env.NOTIFICATIONS.get(memoListKey, { type: 'json' }) || [];

  const memos = [];
  for (const memoId of memoList) {
    const memo = await env.NOTIFICATIONS.get(`memo:${userId}:${memoId}`, { type: 'json' });
    if (memo) {
      memos.push(memo);
    }
  }

  return memos;
}

/**
 * メモを削除
 * @param {string} memoId - メモID
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 */
export async function deleteMemo(memoId, userId, env) {
  // メモを取得して画像URLがあれば削除
  const memo = await env.NOTIFICATIONS.get(`memo:${userId}:${memoId}`, { type: 'json' });

  if (memo && memo.imageUrl) {
    try {
      // GCSから画像を削除（URLからファイル名を抽出）
      const urlParts = memo.imageUrl.split('/');
      const fileName = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
      const fullPath = `${userId}/${fileName}`;

      const bucket = getStorage().bucket(BUCKET_NAME);
      await bucket.file(fullPath).delete().catch(() => {});
    } catch (error) {
      console.error('Failed to delete image from GCS:', error);
    }
  }

  // Firestoreからメモを削除
  await env.NOTIFICATIONS.delete(`memo:${userId}:${memoId}`);

  // メモ一覧から削除
  const memoListKey = `memo_list:${userId}`;
  let memoList = await env.NOTIFICATIONS.get(memoListKey, { type: 'json' }) || [];
  memoList = memoList.filter(id => id !== memoId);
  await env.NOTIFICATIONS.put(memoListKey, JSON.stringify(memoList));
}
