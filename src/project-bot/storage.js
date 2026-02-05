/**
 * プロジェクトBot用ストレージ
 * ファイルベースのシンプルなKV互換ストレージ
 */
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';

// データディレクトリを作成
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // 既に存在する場合は無視
  }
}

// キーをファイル名に変換
function keyToFilename(key) {
  return path.join(DATA_DIR, encodeURIComponent(key) + '.json');
}

export const storage = {
  async get(key, options) {
    await ensureDataDir();
    try {
      const filename = keyToFilename(key);
      const data = await fs.readFile(filename, 'utf-8');
      const parsed = JSON.parse(data);

      // 有効期限チェック
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        await this.delete(key);
        return null;
      }

      if (options?.type === 'json') {
        return parsed.value;
      }
      return JSON.stringify(parsed.value);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  },

  async put(key, value, options) {
    await ensureDataDir();
    const filename = keyToFilename(key);

    let parsedValue;
    try {
      parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      parsedValue = value;
    }

    const data = {
      value: parsedValue,
      createdAt: new Date().toISOString()
    };

    if (options?.expirationTtl) {
      data.expiresAt = new Date(Date.now() + options.expirationTtl * 1000).toISOString();
    }

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
  },

  async delete(key) {
    try {
      const filename = keyToFilename(key);
      await fs.unlink(filename);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  },

  async list(prefix) {
    await ensureDataDir();
    try {
      const files = await fs.readdir(DATA_DIR);
      const keys = files
        .filter(f => f.endsWith('.json'))
        .map(f => decodeURIComponent(f.slice(0, -5)))
        .filter(k => !prefix || k.startsWith(prefix));
      return keys.map(name => ({ name }));
    } catch (error) {
      return [];
    }
  }
};

export default storage;
