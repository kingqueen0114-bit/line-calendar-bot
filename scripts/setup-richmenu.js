/**
 * リッチメニュー設定スクリプト
 * 4つのボタン: カレンダー, タスク, メモ, 設定
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LIFF_ID = process.env.LIFF_ID;
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

async function createRichMenu() {
  // リッチメニューの定義（2行2列 = 4ボタン）
  const richMenuObject = {
    size: {
      width: 2500,
      height: 1686
    },
    selected: true,
    name: "Project Sync Menu",
    chatBarText: "メニュー",
    areas: [
      {
        // 左上: カレンダー
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: { type: "uri", uri: `${LIFF_URL}?tab=calendar` }
      },
      {
        // 右上: タスク
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: { type: "uri", uri: `${LIFF_URL}?tab=tasks` }
      },
      {
        // 左下: メモ
        bounds: { x: 0, y: 843, width: 1250, height: 843 },
        action: { type: "uri", uri: `${LIFF_URL}?tab=memo` }
      },
      {
        // 右下: 設定
        bounds: { x: 1250, y: 843, width: 1250, height: 843 },
        action: { type: "uri", uri: `${LIFF_URL}?tab=settings` }
      }
    ]
  };

  console.log('Creating rich menu...');

  // リッチメニューを作成
  const createResponse = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify(richMenuObject)
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create rich menu: ${error}`);
  }

  const { richMenuId } = await createResponse.json();
  console.log(`Rich menu created: ${richMenuId}`);

  return richMenuId;
}

async function uploadRichMenuImage(richMenuId, imagePath) {
  console.log(`Uploading image for rich menu ${richMenuId}...`);

  const imageBuffer = fs.readFileSync(imagePath);

  const uploadResponse = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
      },
      body: imageBuffer
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload image: ${error}`);
  }

  console.log('Image uploaded successfully');
}

async function setDefaultRichMenu(richMenuId) {
  console.log(`Setting rich menu ${richMenuId} as default...`);

  const response = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set default rich menu: ${error}`);
  }

  console.log('Default rich menu set successfully');
}

async function deleteAllRichMenus() {
  console.log('Fetching existing rich menus...');

  const listResponse = await fetch('https://api.line.me/v2/bot/richmenu/list', {
    headers: {
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    }
  });

  if (!listResponse.ok) {
    const error = await listResponse.text();
    throw new Error(`Failed to list rich menus: ${error}`);
  }

  const { richmenus } = await listResponse.json();
  console.log(`Found ${richmenus.length} rich menus`);

  for (const menu of richmenus) {
    console.log(`Deleting rich menu ${menu.richMenuId}...`);
    await fetch(`https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
      }
    });
  }

  console.log('All rich menus deleted');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!CHANNEL_ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is required');
    process.exit(1);
  }

  if (!LIFF_ID) {
    console.error('LIFF_ID is required');
    process.exit(1);
  }

  try {
    if (command === 'delete') {
      await deleteAllRichMenus();
    } else if (command === 'create') {
      const imagePath = args[1];
      if (!imagePath) {
        console.error('Usage: node setup-richmenu.js create <image-path>');
        console.error('Image should be 2500x1686 pixels, PNG or JPEG, max 1MB');
        process.exit(1);
      }

      // 既存のリッチメニューを削除
      await deleteAllRichMenus();

      // 新しいリッチメニューを作成
      const richMenuId = await createRichMenu();

      // 画像をアップロード
      await uploadRichMenuImage(richMenuId, imagePath);

      // デフォルトに設定
      await setDefaultRichMenu(richMenuId);

      console.log('\n✅ Rich menu setup complete!');
      console.log(`LIFF URL: ${LIFF_URL}`);
    } else {
      console.log('Usage:');
      console.log('  node setup-richmenu.js create <image-path>  - Create and set rich menu');
      console.log('  node setup-richmenu.js delete               - Delete all rich menus');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
