/**
 * メモ機能 - Firestore + GCS連携
 * ファイル添付 & ボイスメモ対応
 */
import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'line-calendar-bot-memos';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
let storage = null;

function getStorage() {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT
    });
  }
  return storage;
}

function randomId() {
  return Math.random().toString(36).substring(7);
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
  const fileName = `${userId}/${Date.now()}-${randomId()}.jpg`;
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
 * 汎用ファイルアップロード
 * @param {Buffer} fileBuffer - ファイルデータ
 * @param {string} userId - ユーザーID
 * @param {string} fileName - 元のファイル名
 * @param {string} mimeType - MIMEタイプ
 * @returns {Promise<string>} - ファイルURL
 */
export async function uploadFile(fileBuffer, userId, fileName, mimeType) {
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error('ファイルサイズが10MBを超えています');
  }

  const bucket = getStorage().bucket(BUCKET_NAME);
  const ext = fileName.split('.').pop() || 'bin';
  const gcsFileName = `${userId}/files/${Date.now()}-${randomId()}.${ext}`;
  const file = bucket.file(gcsFileName);

  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType || 'application/octet-stream',
      metadata: { originalName: fileName }
    }
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${gcsFileName}`;
}

/**
 * 音声ファイルアップロード
 * @param {Buffer} audioBuffer - 音声データ
 * @param {string} userId - ユーザーID
 * @param {string} mimeType - MIMEタイプ (audio/m4a, audio/webm など)
 * @returns {Promise<string>} - 音声URL
 */
export async function uploadAudio(audioBuffer, userId, mimeType = 'audio/m4a') {
  const bucket = getStorage().bucket(BUCKET_NAME);
  const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
  const gcsFileName = `${userId}/audio/${Date.now()}-${randomId()}.${ext}`;
  const file = bucket.file(gcsFileName);

  await file.save(audioBuffer, {
    metadata: { contentType: mimeType }
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${gcsFileName}`;
}

/**
 * メモを作成
 * @param {object} memoData - メモデータ
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 * @returns {Promise<object>} - 作成されたメモ
 */
export async function createMemo(memoData, userId, env) {
  const memoId = `memo_${Date.now()}_${randomId()}`;

  const memo = {
    id: memoId,
    userId,
    text: memoData.text || '',
    imageUrl: memoData.imageUrl || null,
    // ファイル添付
    fileUrl: memoData.fileUrl || null,
    fileName: memoData.fileName || null,
    fileType: memoData.fileType || null,
    fileSize: memoData.fileSize || null,
    // ボイスメモ
    audioUrl: memoData.audioUrl || null,
    audioDuration: memoData.audioDuration || null,
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
 * GCSからファイルを削除するヘルパー
 * @param {string} url - GCS URL
 * @param {string} userId - ユーザーID
 * @param {string} subPath - サブパス (例: '', 'files/', 'audio/')
 */
async function deleteGcsFile(url, userId, subPath = '') {
  if (!url) return;

  try {
    const urlParts = url.split('/');
    const fileName = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    const fullPath = `${userId}/${subPath}${fileName}`;

    const bucket = getStorage().bucket(BUCKET_NAME);
    await bucket.file(fullPath).delete().catch(() => {});
  } catch (error) {
    console.error('Failed to delete file from GCS:', error);
  }
}

/**
 * メモを削除
 * @param {string} memoId - メモID
 * @param {string} userId - ユーザーID
 * @param {object} env - 環境オブジェクト
 */
export async function deleteMemo(memoId, userId, env) {
  // メモを取得してGCSファイルがあれば削除
  const memo = await env.NOTIFICATIONS.get(`memo:${userId}:${memoId}`, { type: 'json' });

  if (memo) {
    // 画像を削除
    if (memo.imageUrl) {
      await deleteGcsFile(memo.imageUrl, userId, '');
    }
    // ファイルを削除
    if (memo.fileUrl) {
      await deleteGcsFile(memo.fileUrl, userId, 'files/');
    }
    // 音声を削除
    if (memo.audioUrl) {
      await deleteGcsFile(memo.audioUrl, userId, 'audio/');
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
