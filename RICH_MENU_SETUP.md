# リッチメニュー設定ガイド

## 概要

LINEボットにリッチメニューを追加する手順を説明します。リッチメニューは、ユーザーがトークルーム下部から簡単に機能にアクセスできるUIです。

## 準備

### 必要なもの

1. `rich-menu.json` - リッチメニュー設定ファイル（既に作成済み）
2. リッチメニュー画像 (2500 x 1686 pixels)
3. LINE Channel Access Token

---

## ステップ1: リッチメニュー画像の作成

### 画像の仕様

- **サイズ**: 2500 x 1686 pixels（必須）
- **フォーマット**: PNG または JPEG
- **ファイルサイズ**: 1MB以下
- **カラーモード**: RGB

### レイアウト

```
┌────────────────────────────────────────────────────┐
│         予定一覧      │   タスク一覧   │ Google Calendar │  ← 421px
├────────────────────────────────────────────────────┤
│    予定のキャンセル   │  予定の変更   │  Google Tasks  │  ← 422px
├────────────────────────────────────────────────────┤
│     タスクを登録      │ タスク完了方法 │    Gemini      │  ← 422px
├────────────────────────────────────────────────────┤
│                    リマインド設定                    │  ← 421px
└────────────────────────────────────────────────────┘
     833px                 834px            833px
```

### 各エリアのサイズ詳細

| 行 | 列 | 機能 | X | Y | Width | Height |
|----|----|----|-----|-----|-------|--------|
| 1  | 1  | 予定一覧 | 0 | 0 | 833 | 421 |
| 1  | 2  | タスク一覧 | 833 | 0 | 834 | 421 |
| 1  | 3  | Google Calendar | 1667 | 0 | 833 | 421 |
| 2  | 1  | 予定のキャンセル | 0 | 421 | 833 | 422 |
| 2  | 2  | 予定の変更 | 833 | 421 | 834 | 422 |
| 2  | 3  | Google Tasks | 1667 | 421 | 833 | 422 |
| 3  | 1  | タスク登録 | 0 | 843 | 833 | 422 |
| 3  | 2  | タスク完了方法 | 833 | 843 | 834 | 422 |
| 3  | 3  | Gemini | 1667 | 843 | 833 | 422 |
| 4  | 1-3 | リマインド設定 | 0 | 1265 | 2500 | 421 |

### デザインのヒント

- **フォント**: 太字で読みやすく（18-24px推奨）
- **アイコン**: 絵文字や簡単なアイコンを配置
- **背景色**: 各ボタンを区別できるように色分け
- **外部リンク**: Google Calendar/Tasks/Geminiは別の色で強調

### 推奨テキスト配置

```
┌──────────────────┬──────────────────┬──────────────────┐
│   📅 予定一覧    │   ✅ タスク一覧  │  📆 Calendar     │
├──────────────────┼──────────────────┼──────────────────┤
│  🗑️ キャンセル   │   ✏️ 変更方法    │  📋 Tasks        │
├──────────────────┼──────────────────┼──────────────────┤
│  ➕ タスク登録   │   ✅ 完了方法    │  🤖 Gemini       │
├──────────────────┴──────────────────┴──────────────────┤
│                  ⏰ リマインド設定                      │
└──────────────────────────────────────────────────────┘
```

### 画像作成ツール

- **Figma**: https://www.figma.com （推奨）
- **Canva**: https://www.canva.com
- **Photoshop/Illustrator**: Adobe製品
- **オンラインツール**: Photopea (https://www.photopea.com)

### Figmaテンプレート（クイックスタート）

1. Figmaで新規ファイル作成
2. フレームサイズを 2500 x 1686 に設定
3. グリッドツールで3列4行に分割
4. 各セルにテキストとアイコンを配置
5. PNG形式でエクスポート

---

## ステップ2: リッチメニューのアップロード

### 方法A: curlコマンド（推奨）

```bash
# 1. リッチメニューを作成
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @rich-menu.json

# レスポンス例:
# {"richMenuId":"richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}

# 2. 画像をアップロード
curl -X POST https://api-data.line.me/v2/bot/richmenu/RICH_MENU_ID/content \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @rich-menu-image.png

# 3. デフォルトリッチメニューに設定
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/RICH_MENU_ID \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

### 方法B: Node.jsスクリプト

プロジェクトディレクトリに `setup-rich-menu.js` を作成:

```javascript
import fs from 'fs';
import fetch from 'node-fetch';

const CHANNEL_ACCESS_TOKEN = 'YOUR_CHANNEL_ACCESS_TOKEN';
const RICH_MENU_JSON_PATH = './rich-menu.json';
const RICH_MENU_IMAGE_PATH = './rich-menu-image.png';

async function setupRichMenu() {
  try {
    // 1. リッチメニューを作成
    const richMenuData = JSON.parse(fs.readFileSync(RICH_MENU_JSON_PATH, 'utf8'));

    const createResponse = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(richMenuData)
    });

    const { richMenuId } = await createResponse.json();
    console.log('✅ Rich menu created:', richMenuId);

    // 2. 画像をアップロード
    const imageBuffer = fs.readFileSync(RICH_MENU_IMAGE_PATH);

    const uploadResponse = await fetch(
      `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
          'Content-Type': 'image/png'
        },
        body: imageBuffer
      }
    );

    console.log('✅ Image uploaded');

    // 3. デフォルトリッチメニューに設定
    const setDefaultResponse = await fetch(
      `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        }
      }
    );

    console.log('✅ Set as default rich menu');
    console.log('\n🎉 Rich menu setup complete!');
    console.log(`Rich Menu ID: ${richMenuId}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupRichMenu();
```

実行:

```bash
node setup-rich-menu.js
```

### 方法C: LINE Developers Console（GUI）

1. https://developers.line.biz/console/ にアクセス
2. 自分のプロバイダーを選択
3. チャネルを選択
4. 左メニュー → **Messaging API** → **リッチメニュー**
5. 「作成」ボタンをクリック
6. 画像をアップロード
7. エリアを設定（タップ領域とアクション）
8. 保存して有効化

**注意**: Console経由では手動でエリア設定が必要です。JSONの座標を参照してください。

---

## ステップ3: 確認

### リッチメニューの確認

1. LINEアプリでボットのトークルームを開く
2. 画面下部にリッチメニューが表示されることを確認
3. 各ボタンをタップして動作確認

### トラブルシューティング

#### リッチメニューが表示されない

```bash
# 現在のリッチメニューを確認
curl -X GET https://api.line.me/v2/bot/richmenu/list \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"

# デフォルトリッチメニューを確認
curl -X GET https://api.line.me/v2/bot/user/all/richmenu \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

#### 画像がずれている

- 画像サイズが正確に 2500 x 1686 であることを確認
- `rich-menu.json`の座標が正しいことを確認
- 画像エディタで座標にガイドラインを引いて確認

#### ボタンが反応しない

- `rich-menu.json`の `areas` 配列を確認
- ログで受信メッセージを確認:
  ```bash
  wrangler tail
  ```

---

## リッチメニューの管理

### 既存リッチメニューの削除

```bash
# リッチメニュー一覧を取得
curl -X GET https://api.line.me/v2/bot/richmenu/list \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"

# 特定のリッチメニューを削除
curl -X DELETE https://api.line.me/v2/bot/richmenu/RICH_MENU_ID \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

### リッチメニューの更新

新しいリッチメニューを作成 → デフォルトに設定 → 古いリッチメニューを削除

```bash
# 新しいリッチメニューを作成（上記手順）
# ...

# 古いリッチメニューを削除
curl -X DELETE https://api.line.me/v2/bot/richmenu/OLD_RICH_MENU_ID \
  -H "Authorization: Bearer YOUR_CHANNEL_ACCESS_TOKEN"
```

---

## 実装済み機能一覧

### メッセージアクション（ボットに送信）

| ボタン | 送信メッセージ | 機能 |
|--------|---------------|------|
| 予定一覧 | `予定一覧` | 今月の予定を表示 |
| タスク一覧 | `タスク一覧` | 未完了タスクを表示（スター順） |
| 予定のキャンセル | `予定のキャンセル方法` | キャンセル方法のヘルプ表示 |
| 予定の変更 | `予定の変更方法` | 変更方法のヘルプ表示 |
| タスクを登録 | `タスク` | タスク登録方法のヘルプ表示 |
| タスク完了方法 | `タスク完了方法` | 完了方法のヘルプ表示 |
| リマインド設定 | `リマインド設定` | リマインド情報を表示 |

### URIアクション（外部リンク）

| ボタン | URL | 機能 |
|--------|-----|------|
| Google Calendar | `https://calendar.google.com` | Googleカレンダーを開く |
| Google Tasks | `https://tasks.google.com` | Google Tasksを開く |
| Gemini | `https://gemini.google.com` | Geminiを開く |

---

## 次のステップ

リッチメニューが動作したら、以下の機能拡張を検討できます：

### 1. タスク完了機能の実装

現在は「開発中」ですが、以下で実装可能:

```javascript
// src/tasks.js に追加
export async function completeTask(taskId, listId, userId, env) {
  const accessToken = await getUserAccessToken(userId, env);

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'completed' })
    }
  );

  if (!response.ok) {
    throw new Error('Task completion failed');
  }

  return await response.json();
}
```

### 2. リマインド時刻のカスタマイズ

KVに各ユーザーの設定を保存:

```javascript
// ユーザー設定のスキーマ
user_settings:{userId} → {
  reminderTimes: {
    dayBefore: "20:00",
    oneHourBefore: true,
    morningReminder: "09:00"
  },
  weeklyReport: {
    enabled: true,
    dayOfWeek: 1, // Monday
    time: "09:00"
  }
}
```

### 3. リッチメニューの切り替え

状況に応じてリッチメニューを切り替え:

- 未認証ユーザー → 認証専用メニュー
- 認証済みユーザー → フル機能メニュー

---

## よくある質問

**Q: リッチメニューは無料ですか？**
A: はい、LINE Messaging APIの無料枠で使用できます。

**Q: リッチメニューは必須ですか？**
A: いいえ、なくても機能は使えます。ユーザビリティ向上のための機能です。

**Q: 画像のデザインを変更したい**
A: 新しい画像を作成し、同じリッチメニューIDに上書きアップロードできます。

**Q: ユーザーごとに異なるリッチメニューを表示できますか？**
A: はい、`POST /v2/bot/user/{userId}/richmenu/{richMenuId}` でユーザー別設定が可能です。

**Q: リッチメニューの統計を見られますか？**
A: LINE公式アカウントの分析機能で、リッチメニューのタップ率を確認できます。

---

## まとめ

1. ✅ `rich-menu.json` 作成済み
2. ✅ メッセージハンドラー実装済み
3. ⏳ 画像を作成
4. ⏳ APIでアップロード
5. ⏳ 動作確認

画像さえ用意すれば、数分でセットアップ完了です！

---

## 参考リンク

- [LINE Messaging API - Rich Menu](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [Rich Menu Design Guide](https://developers.line.biz/en/docs/messaging-api/design-guideline/#rich-menu)
- [Figma Rich Menu Template](https://www.figma.com/community/search?model_type=files&q=line%20rich%20menu)
