/**
 * Rich Menu Image Generator
 * 6ボタンのリッチメニュー画像を生成
 */

const { createCanvas } = require('canvas');
const fs = require('fs');

const WIDTH = 2500;
const HEIGHT = 1686;
const COLS = 3;
const ROWS = 2;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#1a1a1a';
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Button labels
const buttons = [
  { label: 'カレンダー', icon: '📅', color: '#4CAF50' },
  { label: 'タスク', icon: '✅', color: '#2196F3' },
  { label: 'メモ', icon: '📝', color: '#FF9800' },
  { label: 'Claude', icon: '🤖', color: '#8B5CF6' },
  { label: '設定', icon: '⚙️', color: '#607D8B' },
  { label: 'ヘルプ', icon: '❓', color: '#9C27B0' }
];

const cellWidth = WIDTH / COLS;
const cellHeight = HEIGHT / ROWS;

buttons.forEach((btn, index) => {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = col * cellWidth;
  const y = row * cellHeight;

  // Button background with gradient effect
  const gradient = ctx.createLinearGradient(x, y, x, y + cellHeight);
  gradient.addColorStop(0, '#2a2a2a');
  gradient.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(x + 5, y + 5, cellWidth - 10, cellHeight - 10);

  // Border
  ctx.strokeStyle = btn.color;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 10, y + 10, cellWidth - 20, cellHeight - 20);

  // Icon
  ctx.font = '120px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.icon, x + cellWidth / 2, y + cellHeight / 2 - 60);

  // Label
  ctx.font = 'bold 80px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(btn.label, x + cellWidth / 2, y + cellHeight / 2 + 80);

  // Color accent bar at bottom
  ctx.fillStyle = btn.color;
  ctx.fillRect(x + 20, y + cellHeight - 30, cellWidth - 40, 10);
});

// Grid lines
ctx.strokeStyle = '#333333';
ctx.lineWidth = 2;

// Vertical lines
for (let i = 1; i < COLS; i++) {
  ctx.beginPath();
  ctx.moveTo(i * cellWidth, 0);
  ctx.lineTo(i * cellWidth, HEIGHT);
  ctx.stroke();
}

// Horizontal line
ctx.beginPath();
ctx.moveTo(0, cellHeight);
ctx.lineTo(WIDTH, cellHeight);
ctx.stroke();

// Save image
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('/tmp/richmenu.png', buffer);

console.log('Rich menu image saved to /tmp/richmenu.png');
console.log(`Size: ${WIDTH}x${HEIGHT}`);
