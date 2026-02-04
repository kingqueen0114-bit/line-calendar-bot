/**
 * LINE Messaging API操作
 */
import crypto from 'crypto';

// 署名検証（Node.js と Cloudflare Workers 両対応）
export async function verifySignature(body, signature, channelSecret) {
  // Node.js 環境の場合
  if (typeof crypto.createHmac === 'function') {
    const hash = crypto
      .createHmac('SHA256', channelSecret)
      .update(body)
      .digest('base64');
    return hash === signature;
  }

  // Cloudflare Workers 環境の場合
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  );

  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signed))
  );

  return signature === expectedSignature;
}

// メッセージ送信
export async function sendLineMessage(userId, message, accessToken) {
  // messageがオブジェクトの場合（Flex Messageなど）はそのまま使用、文字列の場合はテキストメッセージとして扱う
  const messages = typeof message === 'string'
    ? [{ type: 'text', text: message }]
    : [message];

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      to: userId,
      messages: messages
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('LINE送信失敗: ' + error);
  }

  return await response.json();
}

// 返信メッセージ送信
export async function replyLineMessage(replyToken, message, accessToken) {
  // messageがオブジェクトの場合（Flex Messageなど）はそのまま使用、文字列の場合はテキストメッセージとして扱う
  const messages = typeof message === 'string'
    ? [{ type: 'text', text: message }]
    : [message];

  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: messages
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('LINE返信失敗: ' + error);
  }

  return await response.json();
}
