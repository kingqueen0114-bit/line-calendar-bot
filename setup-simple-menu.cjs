const fs = require('fs');
const { createCanvas } = require('canvas');

async function main() {
  const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is required');
    process.exit(1);
  }

  // 1. Create rich menu image
  console.log('Creating menu image...');
  const canvas = createCanvas(2500, 843);
  const ctx = canvas.getContext('2d');

  // Calendar (left) - blue gradient
  const grad1 = ctx.createLinearGradient(0, 0, 1250, 843);
  grad1.addColorStop(0, '#4285F4');
  grad1.addColorStop(1, '#1967D2');
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, 1250, 843);

  // Tasks (right) - green gradient
  const grad2 = ctx.createLinearGradient(1250, 0, 2500, 843);
  grad2.addColorStop(0, '#06c755');
  grad2.addColorStop(1, '#00a040');
  ctx.fillStyle = grad2;
  ctx.fillRect(1250, 0, 1250, 843);

  // Text
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 80px sans-serif';
  ctx.fillText('📅 カレンダー', 625, 421);
  ctx.fillText('✅ タスク', 1875, 421);

  const imageBuffer = canvas.toBuffer('image/png');
  console.log('Image created');

  // 2. Delete existing rich menus
  console.log('Checking existing menus...');
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
  });
  const listData = await listRes.json();
  
  if (listData.richmenus && listData.richmenus.length > 0) {
    for (const menu of listData.richmenus) {
      console.log('Deleting menu:', menu.richMenuId);
      await fetch(`https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
      });
    }
  }

  // 3. Create new rich menu
  console.log('Creating new menu...');
  const menuData = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: "Simple Menu",
    chatBarText: "メニュー",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: { type: "uri", uri: "https://liff.line.me/2009033103-6cx2zHDu?tab=calendar" }
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: { type: "uri", uri: "https://liff.line.me/2009033103-6cx2zHDu?tab=tasks" }
      }
    ]
  };

  const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(menuData)
  });
  const createData = await createRes.json();
  console.log('Menu created:', createData);

  if (!createData.richMenuId) {
    console.error('Failed to create menu');
    process.exit(1);
  }

  const richMenuId = createData.richMenuId;

  // 4. Upload image
  console.log('Uploading image...');
  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'image/png'
    },
    body: imageBuffer
  });
  console.log('Image upload status:', uploadRes.status);

  // 5. Set as default
  console.log('Setting as default...');
  const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
  });
  console.log('Default set status:', defaultRes.status);

  console.log('Done! Rich menu is now active.');
}

main().catch(console.error);
