/**
 * LINE Messaging API操作
 */

// 署名検証
export async function verifySignature(body, signature, channelSecret) {
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
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }]
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
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: message }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('LINE返信失敗: ' + error);
  }

  return await response.json();
}
