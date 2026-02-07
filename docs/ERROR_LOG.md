# LINE Calendar Bot - エラー記録と解決策

**最終更新**: 2026年2月7日

> 運用マニュアル: [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md)

---

## 認証関連

### 1. クロスユーザー認証問題
- **問題**: 複数ユーザーの認証情報が混在し、他ユーザーのカレンダーが表示される
- **原因**: OAuthトークンがユーザーIDと正しく紐付けされていなかった
- **解決策**: `reset`コマンドを追加し、認証情報をクリアする機能を実装
- **コミット**: 755d9e0
- **教訓**: 認証トークンは必ずユーザーIDとセットで保存すること

### 2. URL共有によるセキュリティ問題
- **問題**: LIFFアプリのURLを共有すると他人がアクセスできてしまう
- **原因**: URLパラメータのみで認証していた
- **解決策**: LIFF-only認証に変更し、LINEアプリ内からのみアクセス可能に
- **コミット**: 635f375
- **教訓**: 認証はLINE IDベースで行い、URLパラメータに依存しない

### 3. 認証ボタンが動作しない
- **問題**: Google認証ボタンをクリックしても遷移しない
- **原因**: LIFF内で通常の`<a href="...">`リンクが動作しない
- **解決策**: `liff.openWindow()`を使用して外部リンクを開く
- **コミット**: 50d0cd5
- **教訓**: LIFF内の外部リンクは必ず`liff.openWindow({ url: '...', external: true })`を使用

---

## 環境関連

### 4. VMでのClaude Code OAuth認証失敗
- **問題**: ヘッドレスVM環境でOAuth認証ができない
- **原因**: ブラウザが開けない環境
- **解決策**: Anthropic APIキー認証を使用（$5クレジット必要）
- **状態**: 未解決（APIキー作成済み、クレジット追加待ち）
- **APIキー名**: `gcp-vm`

---

## LIFF/UI関連

### 5. 外部リンクがLIFF内で開けない
- **パターン**: `<a href="...">` や `window.location.href` が動作しない
- **解決策**:
```javascript
liff.openWindow({
  url: 'https://example.com',
  external: true
});
```

### 6. ユーザーのGoogle認証状態が不明
- **問題**: ユーザーが認証済みかどうか判断できない
- **解決策**: `/auth-status` エンドポイントを追加
- **コミット**: 20a7abd

---

## デプロイ関連

### 7. Cloud Runデプロイ失敗時の対処
```bash
# ログ確認
gcloud run services logs read line-calendar-bot \
  --region=asia-northeast1 \
  --limit=50

# サービス状態確認
gcloud run services describe line-calendar-bot \
  --region=asia-northeast1
```

### 8. Cloud Build失敗時
```bash
# ビルドログ確認
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>
```

---

## ベストプラクティス

1. **認証トークンは必ずユーザーIDとセットで保存**
2. **LIFF内のリンクは`liff.openWindow()`を使用**
3. **機密情報（APIキー等）はSecret Managerで管理**
4. **新機能追加前に統合テストを実行**: `npm run test:prod`
5. **デプロイ前にローカルテスト**: `npm run test:local`

---

## 通知機能関連

### 9. 通知が届かない場合のチェックリスト
1. LIFFアプリを開いて通知リストに登録されているか確認
2. Cloud Schedulerの状態確認
3. ユーザーの通知設定がONか確認
4. LINE Messaging APIの月間メッセージ上限を確認

---

## LINE → Claude 直接指示

### 使い方
LINEで以下のように送信：
```
claude: 現在の状況を教えて
claude: src/server.jsの行数を教えて
claude: gitの状態を確認して
sync    ← パソコンでpush後、VMを最新化
```

### 設定済みの環境
- VM: dev-agent-vm (35.221.93.66:8080)
- systemd: dev-agent.service (自動起動)
- Cloud Run → VM転送設定済み

---

## 今後発生したエラーの記録方法

新しいエラーが発生した場合、以下の形式で追記してください：

```markdown
### N. エラー名
- **問題**: 具体的な症状
- **原因**: 根本原因
- **解決策**: 修正内容
- **コミット**: コミットハッシュ
- **教訓**: 今後同じミスを防ぐためのポイント
```
