# タグ・カラー機能 実装進捗 (2026-02-08)

## 実装完了

### バックエンド
- `src/tags.js` - タグCRUD機能（個人・プロジェクト共有対応）
- `src/routes/tags.js` - GET/POST/PUT/DELETE /api/tags エンドポイント
- `src/server.js` - tagsRouter登録、tagIds対応

### カレンダー連携
- `src/local-calendar.js` - tagIds保存・更新対応
- `src/shared-calendar.js` - 共有イベントにtagIds対応

### フロントエンド (src/liff.js)
- 設定タブにタグ管理セクション
- タグ作成/編集モーダル（カラーピッカー付き）
- 予定フォームにタグセレクター
- 月表示にタグカラードット
- イベント詳細モーダルにタグバッジ

---

## 現在デバッグ中の問題

**問題**: 予定を編集してタグを変更しても反映されない

**状況**: デバッグログ追加済み（[TAG DEBUG]プレフィックス）

**デプロイ**: line-calendar-bot-00109-spk (正常稼働)

---

## デバッグログ確認ポイント

ブラウザのコンソールで以下のログを確認:

1. `[TAG DEBUG] editEventFromDetail` - editingEvent.tagIds確認
2. `[TAG DEBUG] renderEventTagSelector` - selectedIds, userTags数
3. `[TAG DEBUG] setupEventTagSelectorHandler` - ハンドラー設定状況
4. `[TAG DEBUG] Container clicked` - クリック検知
5. `[TAG DEBUG] toggleEventTag` - 選択状態変更
6. `[TAG DEBUG] submitEvent` - 送信時のtagIds

---

## Cloud Runデプロイコマンド

```bash
/Users/yuiyane/google-cloud-sdk/bin/gcloud run deploy line-calendar-bot \
  --source . --region asia-northeast1 --project line-calendar-bot-20260203 \
  --allow-unauthenticated \
  --set-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,LIFF_ID=liff-id:latest \
  --update-env-vars="DEV_AGENT_URL=http://35.221.93.66:8080" \
  --memory=512Mi --cpu=1 --max-instances=3 --min-instances=0 --timeout=60s
```

---

## シークレット名（kebab-case）

- `line-channel-access-token`
- `line-channel-secret`
- `google-client-id`
- `google-client-secret`
- `liff-id`

---

## 次のステップ

1. ユーザーにブラウザコンソールでデバッグログを確認してもらう
2. ログから問題箇所を特定して修正
3. 修正後、デバッグログを削除してクリーンなコードに戻す
