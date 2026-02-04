import { createCanvas } from 'canvas';
import fs from 'fs';

// キャンバス作成
const canvas = createCanvas(2500, 1686);
const ctx = canvas.getContext('2d');

// カラー設定
const bgColor = '#ffffff';
const textColor = '#333333';
const borderColor = '#e0e0e0';
const accentColor = '#06C755';
const fontSize = 44;
const emojiSize = 60;

// リッチメニュー項目定義
const menuItems = [
  // Row 1
  { x: 0, y: 0, width: 833, height: 421, emoji: '📅', text: '予定一覧', isExternal: false },
  { x: 833, y: 0, width: 834, height: 421, emoji: '➕', text: '予定登録', isExternal: false },
  { x: 1667, y: 0, width: 833, height: 421, emoji: '✏️', text: '予定の変更', isExternal: false },

  // Row 2
  { x: 0, y: 421, width: 833, height: 422, emoji: '🗑️', text: 'キャンセル', isExternal: false },
  { x: 833, y: 421, width: 834, height: 422, emoji: '✅', text: 'タスク一覧', isExternal: false },
  { x: 1667, y: 421, width: 833, height: 422, emoji: '📝', text: 'タスク登録', isExternal: false },

  // Row 3
  { x: 0, y: 843, width: 833, height: 422, emoji: '✔️', text: 'タスク完了', isExternal: false },
  { x: 833, y: 843, width: 834, height: 422, emoji: '📆', text: 'Calendar', isExternal: true },
  { x: 1667, y: 843, width: 833, height: 422, emoji: '📋', text: 'Tasks', isExternal: true },

  // Row 4 (full width)
  { x: 0, y: 1265, width: 2500, height: 421, emoji: '🤖', text: 'Gemini', isExternal: true }
];

// 背景を塗りつぶし
ctx.fillStyle = bgColor;
ctx.fillRect(0, 0, canvas.width, canvas.height);

// 各メニューアイテムを描画
menuItems.forEach(item => {
  // ボックスの背景（外部リンクは薄い緑色）
  if (item.isExternal) {
    ctx.fillStyle = '#f0fdf4'; // 薄い緑
  } else {
    ctx.fillStyle = bgColor;
  }
  ctx.fillRect(item.x, item.y, item.width, item.height);

  // ボーダー
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(item.x, item.y, item.width, item.height);

  // 絵文字
  ctx.font = `${emojiSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const emojiY = item.y + item.height / 2 - 30;
  ctx.fillText(item.emoji, item.x + item.width / 2, emojiY);

  // テキスト
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = item.isExternal ? accentColor : textColor;
  const textY = item.y + item.height / 2 + 40;
  ctx.fillText(item.text, item.x + item.width / 2, textY);
});

// PNG画像として保存
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('rich-menu-image.png', buffer);

console.log('✅ Rich menu image generated: rich-menu-image.png');
console.log('📏 Size: 2500 x 1686 pixels');
console.log('💾 File size:', (buffer.length / 1024).toFixed(2), 'KB');
