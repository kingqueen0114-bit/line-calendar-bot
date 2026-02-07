/**
 * Rich Menu Image Generator - User Version (5 buttons, no Claude)
 */

const { createCanvas } = require('canvas');
const fs = require('fs');

const WIDTH = 2500;
const HEIGHT = 1686;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#1a1a1a';
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Top row: 3 buttons (Calendar, Tasks, Memo)
const topButtons = [
  { label: 'カレンダー', icon: '📅', color: '#4CAF50' },
  { label: 'タスク', icon: '✅', color: '#2196F3' },
  { label: 'メモ', icon: '📝', color: '#FF9800' }
];

// Bottom row: 2 buttons (Settings, Help)
const bottomButtons = [
  { label: '設定', icon: '⚙️', color: '#607D8B' },
  { label: 'ヘルプ', icon: '❓', color: '#9C27B0' }
];

const cellHeight = HEIGHT / 2;

// Draw top row (3 buttons)
const topCellWidth = WIDTH / 3;
topButtons.forEach((btn, index) => {
  const x = index * topCellWidth;
  const y = 0;

  // Button background
  const gradient = ctx.createLinearGradient(x, y, x, y + cellHeight);
  gradient.addColorStop(0, '#2a2a2a');
  gradient.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(x + 5, y + 5, topCellWidth - 10, cellHeight - 10);

  // Border
  ctx.strokeStyle = btn.color;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 10, y + 10, topCellWidth - 20, cellHeight - 20);

  // Icon
  ctx.font = '120px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.icon, x + topCellWidth / 2, y + cellHeight / 2 - 60);

  // Label
  ctx.font = 'bold 80px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(btn.label, x + topCellWidth / 2, y + cellHeight / 2 + 80);

  // Color accent bar
  ctx.fillStyle = btn.color;
  ctx.fillRect(x + 20, y + cellHeight - 30, topCellWidth - 40, 10);
});

// Draw bottom row (2 buttons)
const bottomCellWidth = WIDTH / 2;
bottomButtons.forEach((btn, index) => {
  const x = index * bottomCellWidth;
  const y = cellHeight;

  // Button background
  const gradient = ctx.createLinearGradient(x, y, x, y + cellHeight);
  gradient.addColorStop(0, '#2a2a2a');
  gradient.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(x + 5, y + 5, bottomCellWidth - 10, cellHeight - 10);

  // Border
  ctx.strokeStyle = btn.color;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 10, y + 10, bottomCellWidth - 20, cellHeight - 20);

  // Icon
  ctx.font = '120px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.icon, x + bottomCellWidth / 2, y + cellHeight / 2 - 60);

  // Label
  ctx.font = 'bold 80px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(btn.label, x + bottomCellWidth / 2, y + cellHeight / 2 + 80);

  // Color accent bar
  ctx.fillStyle = btn.color;
  ctx.fillRect(x + 20, y + cellHeight - 30, bottomCellWidth - 40, 10);
});

// Grid lines
ctx.strokeStyle = '#333333';
ctx.lineWidth = 2;

// Vertical lines (top row)
for (let i = 1; i < 3; i++) {
  ctx.beginPath();
  ctx.moveTo(i * topCellWidth, 0);
  ctx.lineTo(i * topCellWidth, cellHeight);
  ctx.stroke();
}

// Vertical line (bottom row)
ctx.beginPath();
ctx.moveTo(bottomCellWidth, cellHeight);
ctx.lineTo(bottomCellWidth, HEIGHT);
ctx.stroke();

// Horizontal line
ctx.beginPath();
ctx.moveTo(0, cellHeight);
ctx.lineTo(WIDTH, cellHeight);
ctx.stroke();

// Save image
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('/tmp/richmenu-user.png', buffer);

console.log('User rich menu image saved to /tmp/richmenu-user.png');
