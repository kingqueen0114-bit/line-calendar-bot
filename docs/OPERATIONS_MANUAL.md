# LINE Calendar Bot 運用マニュアル

**最終更新**: 2026年2月7日

---

## 1. システム構成

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   LINE      │────>│   Cloud Run     │────>│    GCP VM       │
│  ユーザー   │     │  (本番サーバー) │     │ (Claude Code)   │
└─────────────┘     └─────────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Firestore  │
                    │ (データ保存) │
                    └─────────────┘
```

### 環境情報

| 項目 | 値 |
|------|-----|
| Cloud Run URL | https://line-calendar-bot-67385363897.asia-northeast1.run.app |
| GCP プロジェクト | line-calendar-bot-20260203 |
| リージョン | asia-northeast1 |
| VM (Claude) | dev-agent-vm (35.221.93.66) |
| GitHub | https://github.com/kingqueen0114-bit/line-calendar-bot |
| LIFF ID | 2009033103-6cx2zHDu |

---

## 2. 通常のアップデート手順

### 2.1 パソコンで開発する場合

```bash
# 1. コード編集
# src/以下のファイルを編集

# 2. ローカルテスト（推奨）
npm run dev
# 別ターミナルで
npm run test:local

# 3. コミット＆プッシュ
git add .
git commit -m "変更内容の説明"
git push origin main

# 4. Cloud Runにデプロイ
gcloud run deploy line-calendar-bot \
  --source=. \
  --region=asia-northeast1 \
  --project=line-calendar-bot-20260203 \
  --allow-unauthenticated
```

### 2.2 スマホ（LINE）から開発する場合

```
1. リッチメニューの「Claude」ボタンをタップ
2. 指示を入力（例: "src/app.jsの100行目を修正して"）
3. 修正完了後「sync」と入力してVMを同期
4. 必要に応じてデプロイ指示
```

---

## 3. 機能追加ガイド

### 3.1 新しいLINEコマンド追加

**ファイル**: `src/app.js`

```javascript
// handleMessage関数内に追加
if (userMessage === '新コマンド') {
  await replyLineMessage(replyToken, '応答メッセージ', env.LINE_CHANNEL_ACCESS_TOKEN);
  return;
}
```

### 3.2 新しいAPIエンドポイント追加

**ファイル**: `src/server.js`

```javascript
// 既存のエンドポイント群の後に追加
app.get('/api/new-endpoint', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { userId } = req.query;

  // 処理

  res.json({ success: true, data: result });
});
```

### 3.3 LIFFに新しいタブ追加

**ファイル**: `src/liff.js`

1. タブバーにボタン追加（約2050行目）
2. セクションHTML追加（約1890行目）
3. タブ切り替えロジック更新（約2950行目と6450行目）
4. 関連JavaScript関数追加

### 3.4 リッチメニュー更新

```bash
# 現在のリッチメニュー確認
curl -s "https://api.line.me/v2/bot/richmenu/list" \
  -H "Authorization: Bearer $LINE_TOKEN" | jq .

# 新しいリッチメニュー作成（MCPツール使用推奨）
# または generate-richmenu.cjs を編集して実行
```

---

## 4. ユーザー増加時の対応

### 4.1 スケーリング設定

Cloud Runは自動スケーリングですが、必要に応じて調整：

```bash
gcloud run services update line-calendar-bot \
  --region=asia-northeast1 \
  --min-instances=1 \
  --max-instances=10 \
  --memory=512Mi
```

### 4.2 メッセージ上限確認

```bash
# LINE Messaging APIの月間メッセージ上限確認
curl -s "https://api.line.me/v2/bot/message/quota/consumption" \
  -H "Authorization: Bearer $LINE_TOKEN"
```

無料プラン: 月200通
有料プラン移行が必要な場合はLINE Developersコンソールで変更

### 4.3 Firestore利用量確認

GCPコンソール → Firestore → 使用状況

---

## 5. トラブルシューティング

### 5.1 デプロイ失敗時

```bash
# ビルドログ確認
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>

# Cloud Runログ確認
gcloud run services logs read line-calendar-bot \
  --region=asia-northeast1 \
  --limit=50
```

### 5.2 LINE Botが応答しない

1. Webhook URL確認（LINE Developersコンソール）
2. Cloud Runサービス状態確認
3. エラーログ確認

### 5.3 認証エラー

```bash
# 環境変数確認
gcloud run services describe line-calendar-bot \
  --region=asia-northeast1 \
  --format='yaml(spec.template.spec.containers[0].env)'
```

### 5.4 VMに接続できない

```bash
# VM状態確認
gcloud compute instances list --project=line-calendar-bot-20260203

# VM再起動
gcloud compute instances reset dev-agent-vm \
  --zone=asia-northeast1-b \
  --project=line-calendar-bot-20260203

# サービス状態確認
gcloud compute ssh dev-agent-vm --zone=asia-northeast1-b \
  --command="systemctl status dev-agent"
```

---

## 6. セキュリティ注意事項

### 6.1 機密情報の管理

- APIキー、トークンは絶対にコードにハードコードしない
- 環境変数またはSecret Managerを使用
- `.env`ファイルは`.gitignore`に含める

### 6.2 管理者機能

- Claudeボタン（LIFF）は管理者のみアクセス可
- `ADMIN_USER_ID`環境変数で管理者を指定
- 新しい管理者追加時は環境変数を更新してデプロイ

### 6.3 ユーザーデータ

- Firestoreのセキュリティルールを適切に設定
- ユーザーIDでデータを分離
- 他ユーザーのデータにアクセスできないよう注意

---

## 7. バックアップ

### 7.1 コード

GitHubに自動バックアップ（push時）

### 7.2 データ

```bash
# Firestoreエクスポート
gcloud firestore export gs://line-calendar-bot-backup/$(date +%Y%m%d)
```

---

## 8. 監視

### 8.1 Cloud Runメトリクス

GCPコンソール → Cloud Run → line-calendar-bot → メトリクス

- リクエスト数
- レイテンシ
- エラー率

### 8.2 アラート設定（推奨）

```bash
# エラー率が5%超えたらアラート
gcloud alpha monitoring policies create \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count"'
```

---

## 9. 連絡先・リソース

### ドキュメント

- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)
- [LIFF](https://developers.line.biz/ja/docs/liff/)
- [Cloud Run](https://cloud.google.com/run/docs)
- [Firestore](https://firebase.google.com/docs/firestore)

### プロジェクトファイル

| ファイル | 説明 |
|----------|------|
| `src/server.js` | Expressサーバー、APIエンドポイント |
| `src/app.js` | LINEメッセージ処理ロジック |
| `src/liff.js` | LIFFアプリHTML/CSS/JS |
| `docs/ERROR_LOG.md` | エラー記録と解決策 |
| `docs/OPERATIONS_MANUAL.md` | この運用マニュアル |

---

## 10. 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-02-07 | 初版作成 |
