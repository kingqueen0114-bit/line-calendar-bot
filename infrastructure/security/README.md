# Security Infrastructure - Secret Manager

このディレクトリには、LINE Calendar BotのSecret Manager統合設定が含まれています。

## 🔐 Secret Managerとは

Google Cloud Secret Managerは、APIキー、パスワード、証明書などの機密データを安全に保存・管理するサービスです。

### メリット
- ✅ **集中管理**: すべてのシークレットを一元管理
- ✅ **アクセス制御**: IAMによる細かい権限設定
- ✅ **バージョン管理**: シークレットの履歴を保持
- ✅ **監査ログ**: アクセス履歴の記録
- ✅ **自動ローテーション**: シークレットの定期更新

## 📋 管理されるシークレット

以下のシークレットがSecret Managerで管理されます:

| シークレット名 | 説明 |
|---------------|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API アクセストークン |
| `LINE_CHANNEL_SECRET` | LINE Channel シークレット |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアントID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `OAUTH_REDIRECT_URI` | OAuth リダイレクトURI |
| `GEMINI_API_KEY` | Gemini API キー |
| `LIFF_ID` | LIFF アプリケーションID |
| `ADMIN_USER_ID` | 管理者ユーザーID |

## 🚀 セットアップ手順

### 1. Secret Manager APIの有効化とシークレットの作成

```bash
cd infrastructure/security
./setup-secret-manager.sh
```

このスクリプトは以下を実行します:
- Secret Manager APIの有効化
- 各シークレットの作成または更新
- Cloud Runサービスアカウントへの権限付与

### 2. アプリケーションでの使用

#### オプション A: 自動ロード（推奨）

`src/server.js`の先頭で Secret Managerから自動的にロード:

```javascript
import { loadSecretsToEnv } from './secret-manager.js';

// 起動時にシークレットをロード
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'YOUR_PROJECT_ID';
await loadSecretsToEnv(PROJECT_ID);

// 以降は process.env.LINE_CHANNEL_ACCESS_TOKEN などで使用可能
```

#### オプション B: 個別取得

```javascript
import { getSecret } from './secret-manager.js';

const apiKey = await getSecret('GEMINI_API_KEY', PROJECT_ID);
```

### 3. Cloud Runデプロイ設定の更新

`cloudbuild.yaml`から環境変数の設定を削除:

```yaml
# Before (削除)
- '--set-env-vars=LINE_CHANNEL_ACCESS_TOKEN=${_LINE_CHANNEL_ACCESS_TOKEN}'

# After (環境変数ではなくSecret Managerを使用)
# 何も設定しない、またはプロジェクトIDのみ設定
- '--set-env-vars=GOOGLE_CLOUD_PROJECT=${PROJECT_ID}'
```

## 🔄 シークレットの更新

### 新しいバージョンの作成

```bash
echo -n "NEW_SECRET_VALUE" | gcloud secrets versions add SECRET_NAME \
  --data-file=-
```

### 特定のバージョンの無効化

```bash
gcloud secrets versions disable VERSION_NUMBER --secret=SECRET_NAME
```

### シークレットの削除

```bash
gcloud secrets delete SECRET_NAME
```

## 📊 シークレットの確認

### コンソールで確認

```
https://console.cloud.google.com/security/secret-manager
```

### CLIで確認

```bash
# シークレット一覧
gcloud secrets list

# シークレットの詳細
gcloud secrets describe SECRET_NAME

# バージョン一覧
gcloud secrets versions list SECRET_NAME

# シークレットの値を取得（最新版）
gcloud secrets versions access latest --secret=SECRET_NAME
```

## 🔒 セキュリティベストプラクティス

### 1. 最小権限の原則
Cloud Runサービスアカウントには、必要なシークレットへのアクセス権限のみを付与:

```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

### 2. 定期的なローテーション
重要なシークレットは定期的に更新:

```bash
# 新しいバージョンを作成
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-

# 古いバージョンを無効化
gcloud secrets versions disable OLD_VERSION --secret=SECRET_NAME
```

### 3. 監査ログの有効化
Cloud Auditログでアクセス履歴を確認:

```
https://console.cloud.google.com/logs
```

フィルター:
```
resource.type="secretmanager.googleapis.com/Secret"
protoPayload.methodName="google.cloud.secretmanager.v1.SecretManagerService.AccessSecretVersion"
```

### 4. アクセス権限の定期的なレビュー

```bash
# シークレットのIAMポリシーを確認
gcloud secrets get-iam-policy SECRET_NAME
```

## 🛠️ トラブルシューティング

### シークレットにアクセスできない

**症状**: アプリケーションがシークレットを取得できない

**解決方法**:
1. サービスアカウントに適切な権限があるか確認:
   ```bash
   gcloud secrets get-iam-policy SECRET_NAME
   ```

2. Secret Manager APIが有効になっているか確認:
   ```bash
   gcloud services list --enabled | grep secretmanager
   ```

3. プロジェクトIDが正しいか確認

### パフォーマンスの問題

**症状**: アプリケーションの起動が遅い

**解決方法**:
- シークレットをキャッシュする（`src/secret-manager.js`で実装済み）
- 必要なシークレットのみを取得する
- 起動時に一度だけ取得し、以降はキャッシュを使用

### 環境変数とSecret Managerの混在

**症状**: どちらが優先されるかわからない

**動作**:
1. Secret Managerから取得
2. 失敗した場合は環境変数にフォールバック
3. `loadSecretsToEnv()`は既存の環境変数を上書きしない

## 📚 参考資料

- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Secret Manager Best Practices](https://cloud.google.com/secret-manager/docs/best-practices)
- [IAM Roles for Secret Manager](https://cloud.google.com/secret-manager/docs/access-control)
- [Using Secret Manager with Cloud Run](https://cloud.google.com/run/docs/configuring/secrets)

## 💰 コスト

Secret Managerの料金:
- アクティブなシークレットバージョン: $0.06/バージョン/月
- アクセス操作: $0.03/10,000回

**予想コスト** (8シークレット × 2バージョン):
- ストレージ: $0.96/月
- アクセス (月10万回): $0.30/月
- **合計**: 約$1.26/月
