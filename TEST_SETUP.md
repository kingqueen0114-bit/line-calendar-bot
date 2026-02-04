# テスト環境セットアップガイド

## 概要

本番環境に影響を与えずに、テスト環境でマルチユーザーOAuthシステムをテストします。

## テスト環境の構成

```
本番環境: line-calendar-bot (既存)
  ├─ 既存のKV namespace
  ├─ 既存のLINEチャネル
  └─ 既存のユーザーデータ

テスト環境: line-calendar-bot-test (新規)
  ├─ 新しいKV namespace
  ├─ テスト用LINEチャネル（または同じチャネルでテスト）
  └─ 独立したユーザーデータ
```

## ステップ1: テスト用KV Namespaceの作成

```bash
# プロジェクトディレクトリに移動
cd /Users/yuiyane/line-calendar-bot

# テスト用KV namespaceを作成
wrangler kv:namespace create "NOTIFICATIONS" --preview false

# 出力例:
# 🌀 Creating namespace with title "line-calendar-bot-test-NOTIFICATIONS"
# ✨ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "NOTIFICATIONS", id = "abc123..." }
```

**重要**: 出力されたIDをメモしてください！

## ステップ2: wrangler.test.toml の更新

`wrangler.test.toml`を開いて、KV IDを更新:

```toml
kv_namespaces = [
  { binding = "NOTIFICATIONS", id = "ここに実際のIDを貼り付け" }
]
```

## ステップ3: Google OAuth設定

### オプションA: 既存のOAuth認証情報を使用（簡単）

同じGoogle Cloud Projectを使用し、テスト用のリダイレクトURIを追加:

1. https://console.cloud.google.com/apis/credentials
2. OAuth 2.0クライアントIDを開く
3. 「承認済みのリダイレクトURI」に追加:
   ```
   https://line-calendar-bot-test.あなたのサブドメイン.workers.dev/oauth/callback
   ```

### オプションB: 別のOAuth認証情報を作成（完全分離）

1. Google Cloud Consoleで新しいOAuth 2.0クライアントIDを作成
2. リダイレクトURIを設定
3. 新しいClient IDとClient Secretを取得

## ステップ4: テスト用環境変数の設定

```bash
# テスト用Workerに環境変数を設定
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN --config wrangler.test.toml
wrangler secret put LINE_CHANNEL_SECRET --config wrangler.test.toml
wrangler secret put GOOGLE_CLIENT_ID --config wrangler.test.toml
wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.test.toml
wrangler secret put OAUTH_REDIRECT_URI --config wrangler.test.toml
# 入力: https://line-calendar-bot-test.あなたのサブドメイン.workers.dev/oauth/callback
wrangler secret put GEMINI_API_KEY --config wrangler.test.toml
```

### テスト用LINEチャネルの設定

#### オプションA: 新しいテストチャネルを作成（推奨）

1. LINE Developers Console: https://developers.line.biz/console/
2. 新しいチャネルを作成: "Calendar Bot Test"
3. Messaging API設定を有効化
4. アクセストークンとチャネルシークレットを取得
5. Webhook URL設定:
   ```
   https://line-calendar-bot-test.あなたのサブドメイン.workers.dev
   ```

#### オプションB: 既存チャネルを使用

既存のLINEチャネルで、Webhook URLを一時的にテスト環境に変更

⚠️ **注意**: この方法だと本番ユーザーがテスト環境にアクセスします

## ステップ5: テスト環境へデプロイ

```bash
# テスト用設定ファイルを使用してデプロイ
wrangler deploy --config wrangler.test.toml

# デプロイ成功の確認
# 出力:
# ✨ Success! Uploaded 5 files
# 🌎 https://line-calendar-bot-test.あなたのサブドメイン.workers.dev
```

## ステップ6: テスト実行

### 6.1 基本動作テスト

```bash
# OAuth callbackエンドポイントのテスト
curl https://line-calendar-bot-test.あなたのサブドメイン.workers.dev/oauth/callback

# 期待される出力: "無効なリクエストです" (正常)
```

### 6.2 LINEボットのテスト

1. **友だち追加**
   - テストLINEチャネルのQRコードをスキャン
   - ウェルカムメッセージが表示されるか確認

2. **OAuth認証**
   - 「Google認証を開始」ボタンをクリック
   - Googleアカウントでログイン
   - 権限を許可
   - 成功メッセージが表示されるか確認

3. **予定作成テスト**
   ```
   明日14時 テストミーティング
   ```
   - 処理中メッセージ表示
   - 成功メッセージ表示
   - Googleカレンダーに登録されているか確認

4. **タスク作成テスト**
   ```
   タスク ★重要なテスト 期限明日
   ```
   - スター付きタスクとして登録されるか確認

5. **タスク一覧テスト**
   ```
   タスク一覧
   ```
   - スター付きタスクが⭐で表示されるか確認
   - ソート順が正しいか確認

6. **予定一覧テスト**
   ```
   予定一覧
   ```
   - 今月の予定が表示されるか確認

7. **予定キャンセルテスト**
   ```
   テストミーティングをキャンセル
   ```
   - 予定が削除されるか確認

8. **エラーハンドリングテスト**
   ```
   あいうえお
   ```
   - 親切なエラーメッセージが表示されるか確認

### 6.3 マルチユーザーテスト

1. **別のユーザーで友だち追加**
   - 別のLINEアカウントで同じボットを追加
   - 別のGoogleアカウントで認証

2. **データ分離の確認**
   - ユーザーAが作成した予定
   - ユーザーBの予定一覧に表示されないことを確認

3. **同時アクセステスト**
   - ユーザーAとユーザーBが同時に予定を作成
   - どちらも正常に動作することを確認

## ステップ7: ログの確認

```bash
# リアルタイムでログを表示
wrangler tail --config wrangler.test.toml

# 別のターミナルでテストを実行しながらログを監視
```

### 確認すべきログ

- ✅ `Follow event from user: U...`
- ✅ `OAuth completed for user: U...`
- ✅ `User authenticated, processing message`
- ✅ `Event created successfully`
- ✅ `Task created: ...`

## ステップ8: KVデータの確認

```bash
# 認証済みユーザーの確認
wrangler kv:key get --binding=NOTIFICATIONS --config wrangler.test.toml "authenticated_users"

# 特定ユーザーのトークン確認
wrangler kv:key get --binding=NOTIFICATIONS --config wrangler.test.toml "user_tokens:U1234567890"

# すべてのキーのリスト
wrangler kv:key list --binding=NOTIFICATIONS --config wrangler.test.toml
```

## テストチェックリスト

### 基本機能
- [ ] OAuth認証フローが動作する
- [ ] ウェルカムメッセージが表示される
- [ ] 予定作成が動作する
- [ ] タスク作成が動作する
- [ ] 予定一覧が表示される
- [ ] タスク一覧が表示される

### スター付きタスク
- [ ] 「★」付きタスクがスター付きで保存される
- [ ] 「重要」「緊急」キーワードでスター付きになる
- [ ] タスク一覧でスター付きタスクが最初に表示される
- [ ] ⭐アイコンが表示される

### エラーハンドリング
- [ ] 認識できないメッセージで親切なエラーメッセージ
- [ ] 日付なしで送信すると日付を聞かれる
- [ ] Gemini APIエラー時にリトライする
- [ ] カレンダーAPI失敗時に詳細な説明

### マルチユーザー
- [ ] 複数ユーザーが同時に認証できる
- [ ] ユーザーAの予定がユーザーBに見えない
- [ ] ユーザーAのタスクがユーザーBに見えない
- [ ] 各ユーザーが独立して動作する

### セキュリティ
- [ ] 未認証ユーザーは機能を使えない
- [ ] 認証URLが正しく生成される
- [ ] トークンが自動更新される
- [ ] State parameterが検証される

## トラブルシューティング

### "redirect_uri_mismatch"
**原因**: Google Cloud ConsoleのリダイレクトURIが一致していない

**解決**:
```bash
# 設定したURIを確認
wrangler secret list --config wrangler.test.toml | grep OAUTH

# Google Cloud Consoleで完全一致するURIを追加
```

### "Invalid signature"
**原因**: LINE_CHANNEL_SECRETが間違っている

**解決**:
```bash
wrangler secret put LINE_CHANNEL_SECRET --config wrangler.test.toml
# 正しい値を入力
```

### トークンが保存されない
**原因**: KV namespaceのIDが間違っている

**解決**:
```bash
# 正しいKV IDを確認
wrangler kv:namespace list

# wrangler.test.toml のIDを更新
```

## テスト完了後

### 本番環境へのデプロイ準備

テスト環境で問題なければ、本番環境にデプロイ:

```bash
# 本番用設定ファイルで同じ環境変数を設定
wrangler secret put OAUTH_REDIRECT_URI --config wrangler.toml
# 入力: https://line-calendar-bot.あなたのサブドメイン.workers.dev/oauth/callback

# 本番環境にデプロイ
wrangler deploy --config wrangler.toml
```

### テスト環境の維持

テスト環境は残しておくと便利です：
- 将来の機能追加のテスト
- バグ修正の検証
- パフォーマンステスト

### テスト環境の削除（オプション）

不要になった場合:

```bash
# Workerの削除
wrangler delete --config wrangler.test.toml

# KV namespaceの削除
wrangler kv:namespace delete --namespace-id="YOUR_TEST_KV_ID"
```

## よくある質問

**Q: 本番環境とテスト環境で同じGoogleアカウントを使えますか？**
A: はい、可能です。ただし、カレンダーとタスクが両方の環境で共有されます。

**Q: テスト環境のcronトリガーは動きますか？**
A: はい、15分ごとに通知チェックが実行されます。テスト中に不要な場合は`wrangler.test.toml`から削除できます。

**Q: テスト環境と本番環境を同時に動かせますか？**
A: はい、完全に独立して動作します。

**Q: テストユーザーのデータを削除するには？**
A: KVから該当ユーザーのキーを削除:
```bash
wrangler kv:key delete --binding=NOTIFICATIONS --config wrangler.test.toml "user_tokens:U123..."
```

## まとめ

このガイドに従えば、本番環境に影響を与えずに安全にテストできます。

**推奨フロー:**
1. テスト環境で全機能をテスト
2. 問題があれば修正して再デプロイ
3. すべてのテストをパス
4. 本番環境にデプロイ
5. 既存ユーザーに通知

何か問題があれば、ログを確認して対処してください！
