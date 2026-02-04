# リッチメニュー クイックスタート

## 3ステップで完了！

### ステップ1: 画像を生成 🎨

```bash
# ブラウザでHTMLファイルを開く
open rich-menu-generator.html

# または
# Finderでrich-menu-generator.htmlをダブルクリック
```

画像が自動生成されます：
1. 好みに応じて色とフォントサイズを調整
2. 画像を右クリック → 「名前を付けて保存」
3. **ファイル名**: `rich-menu-image.png`
4. **保存場所**: プロジェクトディレクトリ

### ステップ2: セットアップスクリプトを実行 🚀

```bash
# Channel Access Tokenを環境変数に設定
export LINE_CHANNEL_ACCESS_TOKEN="YOUR_CHANNEL_ACCESS_TOKEN_HERE"

# スクリプトを実行
./setup-rich-menu.sh
```

または、直接トークンを渡す:

```bash
./setup-rich-menu.sh "YOUR_CHANNEL_ACCESS_TOKEN_HERE"
```

### ステップ3: 確認 ✅

1. LINEアプリを開く
2. ボットのトークルームに移動
3. 画面下部にリッチメニューが表示される
4. 各ボタンをタップして動作確認

---

## リッチメニューのレイアウト

```
┌──────────────────┬──────────────────┬──────────────────┐
│   📅 予定一覧    │   ➕ 予定登録    │  ✏️ 予定の変更    │
├──────────────────┼──────────────────┼──────────────────┤
│  🗑️ キャンセル   │   ✅ タスク一覧  │  📝 タスク登録    │
├──────────────────┼──────────────────┼──────────────────┤
│  ✔️ タスク完了   │   📆 Calendar    │  📋 Tasks        │
├──────────────────┴──────────────────┴──────────────────┤
│                     🤖 Gemini                          │
└──────────────────────────────────────────────────────┘
```

## 各ボタンの機能

| ボタン | アクション | 説明 |
|--------|-----------|------|
| **予定一覧** | メッセージ送信 | 今月の予定を表示 |
| **予定登録** | メッセージ送信 | 予定登録方法のヘルプを表示 |
| **予定の変更** | メッセージ送信 | 予定変更方法のヘルプを表示 |
| **キャンセル** | メッセージ送信 | 予定キャンセル方法のヘルプを表示 |
| **タスク一覧** | メッセージ送信 | 未完了タスクを表示（スター順） |
| **タスク登録** | メッセージ送信 | タスク登録方法のヘルプを表示 |
| **タスク完了** | メッセージ送信 | タスク完了方法のヘルプを表示 |
| **Calendar** | 外部リンク | Google Calendarを開く |
| **Tasks** | 外部リンク | Google Tasksを開く |
| **Gemini** | 外部リンク | Geminiを開く |

---

## トラブルシューティング

### 画像が見つからないエラー

```
❌ rich-menu-image.png が見つかりません
```

**解決方法**:
- `rich-menu-generator.html`で画像を生成して保存
- ファイル名が正確に `rich-menu-image.png` であることを確認
- プロジェクトディレクトリに保存されていることを確認

### リッチメニューが表示されない

**確認事項**:
1. スクリプトが正常に完了したか確認
2. LINEアプリを完全に再起動
3. トークルームを一度閉じて再度開く

**デバッグコマンド**:
```bash
# 現在のリッチメニューを確認
curl -X GET https://api.line.me/v2/bot/user/all/richmenu \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"

# リッチメニュー一覧を確認
curl -X GET https://api.line.me/v2/bot/richmenu/list \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"
```

### ボタンが反応しない

**確認事項**:
1. `wrangler deploy` が成功したか確認
2. ログを確認:
   ```bash
   wrangler tail
   ```
3. LINEでボタンをタップしてログに表示されるか確認

### 画像の位置がずれている

**原因**: 画像サイズが正確に 2500 x 1686 ではない

**解決方法**:
- `rich-menu-generator.html`を使用すれば自動的に正しいサイズで生成されます
- 外部ツールを使用した場合は、サイズを確認:
  ```bash
  file rich-menu-image.png
  # 出力: PNG image data, 2500 x 1686, ...
  ```

---

## リッチメニューの更新

デザインを変更したい場合:

```bash
# 1. rich-menu-generator.htmlで新しい画像を生成
# 2. 同じファイル名で保存（上書き）
# 3. セットアップスクリプトを再実行
./setup-rich-menu.sh

# 古いメニューを削除するか聞かれるので 'y' を入力
```

---

## リッチメニューの削除

リッチメニューを完全に削除する場合:

```bash
# 現在のメニューIDを取得
MENU_ID=$(curl -s -X GET https://api.line.me/v2/bot/user/all/richmenu \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" | jq -r '.richMenuId')

# 削除
curl -X DELETE https://api.line.me/v2/bot/richmenu/$MENU_ID \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"

echo "✅ リッチメニューを削除しました"
```

---

## 手動セットアップ（スクリプトを使わない場合）

### 方法A: curlコマンド

```bash
export TOKEN="YOUR_CHANNEL_ACCESS_TOKEN"

# 1. リッチメニューを作成
MENU_ID=$(curl -s -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @rich-menu.json | jq -r '.richMenuId')

echo "Created: $MENU_ID"

# 2. 画像をアップロード
curl -X POST https://api-data.line.me/v2/bot/richmenu/$MENU_ID/content \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @rich-menu-image.png

# 3. デフォルトに設定
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/$MENU_ID \
  -H "Authorization: Bearer $TOKEN"

echo "✅ Complete!"
```

### 方法B: LINE Developers Console

1. https://developers.line.biz/console/ にアクセス
2. プロバイダー → チャネル を選択
3. 左メニュー → **Messaging API** → **リッチメニュー**
4. 「作成」をクリック
5. 画像をアップロード
6. `rich-menu.json`の座標を参照して各エリアを設定
7. 保存して有効化

---

## カスタマイズ

### 色を変更

`rich-menu-generator.html`を開いて：
- **背景色**: 各ボタンの背景
- **テキスト色**: ボタンのテキスト
- **ボーダー色**: ボタンの境界線
- **アクセント色**: 外部リンク（Calendar, Tasks, Gemini）の強調色

### フォントサイズを調整

- **フォントサイズ**: テキストの大きさ（30-80px）
- **絵文字サイズ**: 絵文字の大きさ（40-100px）

リアルタイムでプレビューが更新されます！

### 絵文字を変更

`rich-menu-generator.html`の `menuItems` 配列を編集:

```javascript
const menuItems = [
  { x: 0, y: 0, width: 833, height: 421, emoji: '📅', text: '予定一覧', isExternal: false },
  // 絵文字を変更 ↑
  ...
];
```

---

## よくある質問

**Q: リッチメニューは無料ですか？**
A: はい、LINE Messaging APIの無料枠で使用できます。

**Q: スマホとPCで見え方が違う？**
A: LINEアプリのバージョンによって多少異なる場合がありますが、基本的なレイアウトは同じです。

**Q: ユーザーごとに違うメニューを表示できますか？**
A: はい、APIで個別設定が可能ですが、現在は全ユーザー共通のデフォルトメニューとして設定しています。

**Q: ボタンのサイズを変更できますか？**
A: `rich-menu.json`の座標を変更すれば可能ですが、画像も合わせて調整する必要があります。

**Q: アニメーションGIFは使えますか？**
A: いいえ、PNG または JPEG の静止画像のみです。

---

## 次のステップ

リッチメニューが動作したら、以下の機能拡張を検討できます：

### 1. タスク完了機能の実装

現在は「開発中」ですが、実装可能です。

### 2. 認証状態によるメニュー切り替え

- 未認証ユーザー → 認証専用メニュー
- 認証済みユーザー → フル機能メニュー

### 3. ユーザー設定の保存

リマインド時刻などをカスタマイズ可能にする。

---

## サポート

問題が解決しない場合:

1. ログを確認: `wrangler tail`
2. デプロイ状態を確認: `wrangler deployments list`
3. LINE Developers Consoleでチャネル設定を確認

それでも解決しない場合は、エラーメッセージとログを共有してください。
