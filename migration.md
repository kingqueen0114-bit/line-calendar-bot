# LINE Calendar Bot - Google Cloud 移設ガイド

## 現在の環境情報

### Node.js バージョン
- **ローカル開発**: v24.13.0
- **本番（Docker）**: Node.js 20-slim
- **engines設定**: `>=20.0.0`

### 依存ライブラリ（package.json）
```json
{
  "dependencies": {
    "@google-cloud/firestore": "^7.3.0",
    "@google-cloud/storage": "^7.7.0",
    "canvas": "^3.2.1",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1"
  }
}
```

### 環境変数（必須）
| 変数名 | 説明 | 取得元 |
|--------|------|--------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Botのアクセストークン | LINE Developers Console |
| `LINE_CHANNEL_SECRET` | LINE Botのチャンネルシークレット | LINE Developers Console |
| `GOOGLE_CLIENT_ID` | Google OAuth用クライアントID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth用クライアントシークレット | Google Cloud Console |
| `OAUTH_REDIRECT_URI` | OAuthコールバックURL | `https://<YOUR-CLOUD-RUN-URL>/oauth/callback` |
| `GEMINI_API_KEY` | Gemini API キー | Google AI Studio |
| `LIFF_ID` | LINE LIFF アプリID | LINE Developers Console |

### 環境変数（自動設定）
| 変数名 | 説明 |
|--------|------|
| `PORT` | Cloud Run が自動設定（8080） |
| `GOOGLE_CLOUD_PROJECT` | GCPが自動設定 |

---

## プロジェクト構成

```
line-calendar-bot/
├── src/
│   ├── server.js          # Expressサーバー（メインエントリーポイント）
│   ├── app.js             # アプリケーションロジック
│   ├── liff.js            # LIFF HTMLテンプレート
│   ├── calendar.js        # Google Calendar API操作
│   ├── tasks.js           # Google Tasks API操作
│   ├── oauth.js           # OAuth認証
│   ├── gemini.js          # Gemini AI解析
│   ├── line.js            # LINE Messaging API
│   ├── project.js         # 共有カレンダー機能
│   ├── shared-calendar.js # 共有カレンダーイベント
│   ├── shared-tasklist.js # 共有タスクリスト
│   ├── memo.js            # メモ機能
│   ├── storage.js         # ストレージ操作
│   ├── env-adapter.js     # 環境変数アダプター
│   └── index.js           # Cloudflare Workers用（参考）
├── Dockerfile             # Cloud Run用Dockerファイル
├── cloudbuild.yaml        # Cloud Build設定
├── deploy.sh              # デプロイスクリプト
├── package.json           # 依存関係
└── .env.example           # 環境変数サンプル
```

---

## Google Cloud サービス構成

### 使用中のサービス
1. **Cloud Run** - アプリケーションホスティング
2. **Cloud Firestore** - データストレージ（KVストア代替）
3. **Cloud Storage** - 画像アップロード（オプション）
4. **Cloud Scheduler** - 定期通知（15分ごと）
5. **Cloud Build** - CI/CDパイプライン
6. **Container Registry** - Dockerイメージ保存

### 現在のCloud Run設定
- **サービス名**: `line-calendar-bot`
- **リージョン**: `asia-northeast1`（東京）
- **URL**: `https://line-calendar-bot-67385363897.asia-northeast1.run.app`

### Cloud Scheduler設定
- **ジョブ名**: `line-calendar-reminder`
- **スケジュール**: `*/15 * * * *`（15分ごと）
- **ターゲット**: `POST /scheduled`

---

## 移設手順

### 1. Google Cloud プロジェクト作成
```bash
gcloud projects create YOUR-PROJECT-ID
gcloud config set project YOUR-PROJECT-ID
```

### 2. 必要なAPIを有効化
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable calendar-json.googleapis.com
gcloud services enable tasks.googleapis.com
```

### 3. Firestore初期化
```bash
gcloud firestore databases create --location=asia-northeast1
```

### 4. 環境変数をCloud Runに設定
```bash
gcloud run services update line-calendar-bot \
  --region asia-northeast1 \
  --set-env-vars "LINE_CHANNEL_ACCESS_TOKEN=xxx,LINE_CHANNEL_SECRET=xxx,..."
```

### 5. Cloud Schedulerジョブ作成
```bash
gcloud scheduler jobs create http line-calendar-reminder \
  --schedule="*/15 * * * *" \
  --uri="https://YOUR-CLOUD-RUN-URL/scheduled" \
  --http-method=POST \
  --location=asia-northeast1
```

### 6. デプロイ
```bash
# 方法1: deploy.shスクリプト
./deploy.sh

# 方法2: gcloud直接
gcloud run deploy line-calendar-bot \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated
```

---

## 外部サービス設定

### LINE Developers Console
1. Messaging API チャンネル作成
2. Webhook URL設定: `https://YOUR-CLOUD-RUN-URL/`
3. LIFF アプリ作成
   - Endpoint URL: `https://YOUR-CLOUD-RUN-URL/liff`

### Google Cloud Console（OAuth設定）
1. OAuth同意画面の設定
2. OAuth 2.0クライアントID作成
3. 承認済みリダイレクトURI追加: `https://YOUR-CLOUD-RUN-URL/oauth/callback`

### Google AI Studio
1. Gemini API キー取得

---

## データ移行

### Firestore コレクション構造
```
/users/{userId}
  - tokens (OAuth tokens)
  - settings (notification settings)

/projects/{projectId}
  - name, color, members, inviteCode

/shared_events/{eventId}
  - projectId, title, date, etc.

/memos/{memoId}
  - userId, content, createdAt
```

---

## 注意事項

1. **秘密情報の管理**
   - `.env` ファイルはGitに含めない
   - Cloud Run環境変数またはSecret Managerを使用

2. **コスト考慮**
   - Cloud Run: リクエストベース課金
   - Cloud Scheduler: 月3ジョブ無料
   - Firestore: 1GB無料枠

3. **スケーリング**
   - Cloud Runは自動スケール
   - Firestoreはサーバーレス

---

## トラブルシューティング

### よくある問題
1. **OAuth認証エラー** → リダイレクトURIを確認
2. **通知が届かない** → Cloud Schedulerの状態確認
3. **API制限** → Google APIのクォータ確認

### ログ確認
```bash
gcloud run services logs read line-calendar-bot \
  --region asia-northeast1 \
  --limit 50
```
