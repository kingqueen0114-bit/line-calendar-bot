/**
 * 構造化ログユーティリティ
 * Cloud Logging の JSON フォーマットに準拠
 */

/**
 * 構造化ログエントリを出力
 * @param {'INFO'|'WARNING'|'ERROR'|'DEBUG'} level
 * @param {string} message
 * @param {object} meta - 追加メタデータ
 */
export function log(level, message, meta = {}) {
    const entry = {
        severity: level,
        message,
        timestamp: new Date().toISOString(),
        ...meta
    };
    console.log(JSON.stringify(entry));
}

export const logger = {
    info: (msg, meta) => log('INFO', msg, meta),
    warn: (msg, meta) => log('WARNING', msg, meta),
    error: (msg, meta) => log('ERROR', msg, meta),
    debug: (msg, meta) => log('DEBUG', msg, meta),
};
