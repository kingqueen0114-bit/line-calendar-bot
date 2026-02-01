/**
 * LINEリッチメニュー作成スクリプト
 *
 * 使い方:
 * 1. LINE_CHANNEL_ACCESS_TOKEN環境変数を設定
 * 2. リッチメニュー画像を用意（richmenu.png）
 * 3. node create-richmenu.js を実行
 */

const fs = require('fs');

// 環境変数からアクセストークンを取得
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!CHANNEL_ACCESS_TOKEN) {
  console.error('エラー: LINE_CHANNEL_ACCESS_TOKEN環境変数が設定されていません');
  console.error('使い方: LINE_CHANNEL_ACCESS_TOKEN=your_token node create-richmenu.js');
  process.exit(1);
}

// リッチメニューの定義
const richMenu = {
  size: {
    width: 2500,
    height: 1686
  },
  selected: true,
  name: "Calendar Bot Menu",
  chatBarText: "メニュー",
  areas: [
    // 上段左: 予定変更
    {
      bounds: { x: 0, y: 0, width: 1250, height: 562 },
      action: { type: "message", text: "予定一覧" }
    },
    // 上段右: キャンセル
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 562 },
      action: { type: "message", text: "予定一覧" }
    },
    // 中段左: 登録
    {
      bounds: { x: 0, y: 562, width: 1250, height: 562 },
      action: { type: "message", text: "登録方法" }
    },
    // 中段右: タスク
    {
      bounds: { x: 1250, y: 562, width: 1250, height: 562 },
      action: { type: "message", text: "タスク" }
    },
    // 下段左: Google Tasks
    {
      bounds: { x: 0, y: 1124, width: 833, height: 562 },
      action: { type: "uri", uri: "https://tasks.google.com" }
    },
    // 下段中: Google Calendar
    {
      bounds: { x: 833, y: 1124, width: 834, height: 562 },
      action: { type: "uri", uri: "https://calendar.google.com" }
    },
    // 下段右: Gemini
    {
      bounds: { x: 1667, y: 1124, width: 833, height: 562 },
      action: { type: "uri", uri: "https://gemini.google.com" }
    }
  ]
};

async function createRichMenu() {
  try {
    console.log('リッチメニューを作成中...');

    // Step 1: リッチメニューを作成
    const createResponse = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(richMenu)
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`リッチメニュー作成失敗: ${error}`);
    }

    const { richMenuId } = await createResponse.json();
    console.log('リッチメニューID:', richMenuId);

    // Step 2: 画像をアップロード（richmenu.pngが存在する場合）
    if (fs.existsSync('richmenu.png')) {
      console.log('画像をアップロード中...');
      const imageData = fs.readFileSync('richmenu.png');

      const uploadResponse = await fetch(
        `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            'Content-Type': 'image/png'
          },
          body: imageData
        }
      );

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(`画像アップロード失敗: ${error}`);
      }

      console.log('画像アップロード成功');
    } else {
      console.log('⚠️  richmenu.png が見つかりません');
      console.log('画像を用意してから以下のコマンドで画像をアップロードしてください:');
      console.log(`curl -X POST https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content \\`);
      console.log(`  -H "Authorization: Bearer ${CHANNEL_ACCESS_TOKEN}" \\`);
      console.log(`  -H "Content-Type: image/png" \\`);
      console.log(`  --data-binary @richmenu.png`);
    }

    // Step 3: デフォルトのリッチメニューとして設定
    console.log('デフォルトリッチメニューとして設定中...');
    const setDefaultResponse = await fetch(
      `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        }
      }
    );

    if (!setDefaultResponse.ok) {
      const error = await setDefaultResponse.text();
      throw new Error(`デフォルト設定失敗: ${error}`);
    }

    console.log('✅ リッチメニューの作成が完了しました！');
    console.log('リッチメニューID:', richMenuId);

  } catch (error) {
    console.error('エラー:', error.message);
    process.exit(1);
  }
}

// リッチメニュー一覧を取得する関数
async function listRichMenus() {
  try {
    const response = await fetch('https://api.line.me/v2/bot/richmenu/list', {
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`リッチメニュー取得失敗: ${error}`);
    }

    const data = await response.json();
    console.log('既存のリッチメニュー:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('エラー:', error.message);
  }
}

// コマンドライン引数を処理
const args = process.argv.slice(2);
if (args[0] === 'list') {
  listRichMenus();
} else {
  createRichMenu();
}
