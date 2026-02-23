/**
 * Google API リクエストユーティリティ
 * 429/5xx エラー時の指数バックオフリトライ付き fetch ラッパー
 */

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * 指数バックオフ付き fetch
 * @param {string} url
 * @param {object} options - fetch options
 * @param {number} retries - 残りリトライ回数
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    const response = await fetch(url, options);

    // 429 (Rate Limit) or 5xx (Server Error) → リトライ
    if ((response.status === 429 || response.status >= 500) && retries > 0) {
        const attempt = MAX_RETRIES - retries + 1;
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1); // 1s → 2s → 4s
        console.warn(`API ${response.status} on ${url}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1);
    }

    return response;
}

/**
 * Google API レスポンスを統一的にハンドリング
 * @param {Response} response
 * @param {string} context - エラーメッセージ用のコンテキスト
 * @returns {Promise<object>} parsed JSON
 */
export async function handleGoogleApiResponse(response, context = 'API call') {
    if (response.ok) {
        // 204 No Content (DELETE等)
        if (response.status === 204) return null;
        return await response.json();
    }

    const errorText = await response.text();

    if (response.status === 401 || response.status === 403) {
        const err = new Error(`${context}: ${errorText}`);
        err.status = 401;
        throw err;
    }

    if (response.status === 404) {
        const err = new Error(`${context}: リソースが見つかりません`);
        err.status = 404;
        throw err;
    }

    throw new Error(`${context}: ${errorText}`);
}
