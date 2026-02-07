/**
 * 5ボタンリッチメニュー画像生成スクリプト
 * 上段: カレンダー、タスク、メモ
 * 下段: 設定、使い方
 */

const { createCanvas } = require('canvas');
const fs = require('fs');

const WIDTH = 2500;
const HEIGHT = 1686;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// 背景色（グラデーション）
const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
gradient.addColorStop(0, '#00c6fb');
gradient.addColorStop(1, '#005bea');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// ボタン設定
const buttons = [
  // 上段（3つ）
  { x: 0, y: 0, w: 833, h: 843, icon: '📅', label: 'カレンダー', color: '#4CAF50' },
  { x: 833, y: 0, w: 834, h: 843, icon: '✅', label: 'タスク', color: '#2196F3' },
  { x: 1667, y: 0, w: 833, h: 843, icon: '📝', label: 'メモ', color: '#FF9800' },
  // 下段（2つ）
  { x: 0, y: 843, w: 1250, h: 843, icon: '⚙️', label: '設定', color: '#9C27B0' },
  { x: 1250, y: 843, w: 1250, h: 843, icon: '❓', label: '使い方', color: '#00BCD4' },
];

// 各ボタンを描画
buttons.forEach(btn => {
  // ボタン背景（角丸四角形）
  const padding = 20;
  const radius = 30;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, btn.x + padding, btn.y + padding, btn.w - padding * 2, btn.h - padding * 2, radius);
  ctx.fill();

  // アイコン
  ctx.font = '120px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(btn.icon, btn.x + btn.w / 2, btn.y + btn.h / 2 - 50);

  // ラベル
  ctx.font = 'bold 60px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 80);
});

// 角丸四角形を描画するヘルパー関数
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// PNG出力
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('/tmp/richmenu_5btn.png', buffer);
console.log('リッチメニュー画像を生成しました: /tmp/richmenu_5btn.png');
console.log(`サイズ: ${WIDTH}x${HEIGHT}`);
