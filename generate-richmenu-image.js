/**
 * リッチメニュー画像自動生成スクリプト
 */

const { createCanvas } = require('canvas');
const fs = require('fs');

// 画像サイズ
const WIDTH = 2500;
const HEIGHT = 1686;
const ROW_HEIGHT = 562;

// ボタン定義
const buttons = [
  // 上段
  { x: 0, y: 0, width: 1250, height: ROW_HEIGHT, icon: '🔄', text: '予定変更', subtext: 'Change', color: '#667eea' },
  { x: 1250, y: 0, width: 1250, height: ROW_HEIGHT, icon: '❌', text: 'キャンセル', subtext: 'Cancel', color: '#f5576c' },

  // 中段
  { x: 0, y: ROW_HEIGHT, width: 1250, height: ROW_HEIGHT, icon: '➕', text: '登録', subtext: 'Add', color: '#4facfe' },
  { x: 1250, y: ROW_HEIGHT, width: 1250, height: ROW_HEIGHT, icon: '✅', text: 'タスク', subtext: 'Tasks', color: '#43e97b' },

  // 下段
  { x: 0, y: ROW_HEIGHT * 2, width: 833, height: ROW_HEIGHT, icon: '📋', text: 'Google\nTasks', subtext: '', color: '#fa709a', fontSize: 50 },
  { x: 833, y: ROW_HEIGHT * 2, width: 834, height: ROW_HEIGHT, icon: '📅', text: 'Google\nCalendar', subtext: '', color: '#30cfd0', fontSize: 45 },
  { x: 1667, y: ROW_HEIGHT * 2, width: 833, height: ROW_HEIGHT, icon: '✨', text: 'Gemini', subtext: '', color: '#a8edea', fontSize: 55 }
];

function createRichMenuImage() {
  console.log('リッチメニュー画像を生成中...');

  // Canvasを作成
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // 背景グラデーション
  const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGradient.addColorStop(0, '#667eea');
  bgGradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ボタンを描画
  buttons.forEach((button, index) => {
    // ボタンの背景
    ctx.fillStyle = button.color;
    ctx.fillRect(button.x, button.y, button.width, button.height);

    // ボタンの枠線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 5;
    ctx.strokeRect(button.x, button.y, button.width, button.height);

    // アイコン
    ctx.font = '120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    const iconY = button.y + button.height / 2 - 80;
    ctx.fillText(button.icon, button.x + button.width / 2, iconY);

    // テキスト
    const fontSize = button.fontSize || 60;
    ctx.font = `bold ${fontSize}px Arial`;
    const textY = button.y + button.height / 2 + 40;

    if (button.text.includes('\n')) {
      // 改行がある場合
      const lines = button.text.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, button.x + button.width / 2, textY + (i - 0.5) * (fontSize + 10));
      });
    } else {
      ctx.fillText(button.text, button.x + button.width / 2, textY);
    }

    // サブテキスト
    if (button.subtext) {
      ctx.font = '40px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      const subtextY = button.y + button.height / 2 + 100;
      ctx.fillText(button.subtext, button.x + button.width / 2, subtextY);
    }
  });

  // 画像を保存
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('richmenu.png', buffer);
  console.log('✅ リッチメニュー画像を生成しました: richmenu.png');
  console.log(`   サイズ: ${WIDTH}x${HEIGHT}px`);
}

createRichMenuImage();
