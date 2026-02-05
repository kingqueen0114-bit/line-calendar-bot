#!/bin/bash
# Dev Agent Complete Deployment Script
# 自律開発エージェントの完全デプロイスクリプト

set -e

PROJECT_ID="line-calendar-bot-20260203"
REGION="asia-northeast1"
SERVICE_NAME="dev-agent"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       自律開発エージェント デプロイスクリプト                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Enable required APIs
echo "📦 Step 1: 必要なAPIを有効化..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  --project=$PROJECT_ID

echo "✅ APIが有効化されました"
echo ""

# Step 2: Create Firestore database if not exists
echo "📊 Step 2: Firestoreデータベースを確認..."
if ! gcloud firestore databases describe --project=$PROJECT_ID &>/dev/null; then
  echo "Firestoreデータベースを作成中..."
  gcloud firestore databases create \
    --project=$PROJECT_ID \
    --location=$REGION \
    --type=firestore-native
fi
echo "✅ Firestoreが準備完了"
echo ""

# Step 3: Create secrets
echo "🔐 Step 3: シークレットを作成..."
for secret in github-token github-webhook-secret anthropic-api-key admin-user-id; do
  if ! gcloud secrets describe $secret --project=$PROJECT_ID &>/dev/null 2>&1; then
    echo "  作成: $secret"
    gcloud secrets create $secret \
      --project=$PROJECT_ID \
      --replication-policy="automatic"
  else
    echo "  存在: $secret"
  fi
done
echo "✅ シークレットが作成されました"
echo ""

# Step 4: Grant permissions to Cloud Run service account
echo "🔑 Step 4: 権限を設定..."
COMPUTE_SA="${PROJECT_ID}-compute@developer.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
CLOUD_RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in github-token github-webhook-secret anthropic-api-key admin-user-id line-channel-access-token; do
  gcloud secrets add-iam-policy-binding $secret \
    --project=$PROJECT_ID \
    --member="serviceAccount:${CLOUD_RUN_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
done
echo "✅ 権限が設定されました"
echo ""

# Step 5: Check secret values
echo "📋 Step 5: シークレットの状態確認..."
echo ""
missing_secrets=0
for secret in github-token github-webhook-secret anthropic-api-key admin-user-id; do
  version=$(gcloud secrets versions list $secret --project=$PROJECT_ID --limit=1 --format="value(name)" 2>/dev/null || echo "none")
  if [ "$version" != "none" ] && [ -n "$version" ]; then
    echo "  ✅ $secret - 設定済み"
  else
    echo "  ❌ $secret - 未設定"
    missing_secrets=1
  fi
done
echo ""

if [ $missing_secrets -eq 1 ]; then
  echo "⚠️  未設定のシークレットがあります。以下のコマンドで設定してください:"
  echo ""
  echo "# GitHub Personal Access Token (repo権限必須):"
  echo "gcloud secrets versions add github-token --project=$PROJECT_ID --data-file=- <<< 'ghp_xxxxx'"
  echo ""
  echo "# GitHub Webhook Secret (任意の文字列):"
  echo "gcloud secrets versions add github-webhook-secret --project=$PROJECT_ID --data-file=- <<< '\$(openssl rand -hex 20)'"
  echo ""
  echo "# Anthropic API Key:"
  echo "gcloud secrets versions add anthropic-api-key --project=$PROJECT_ID --data-file=- <<< 'sk-ant-xxxxx'"
  echo ""
  echo "# Admin LINE User ID:"
  echo "gcloud secrets versions add admin-user-id --project=$PROJECT_ID --data-file=- <<< 'Uxxxxxxxx'"
  echo ""

  read -p "シークレットを設定しましたか？続行しますか？ (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "中断しました。シークレット設定後に再実行してください。"
    exit 1
  fi
fi

# Step 6: Build and deploy
echo ""
echo "🚀 Step 6: ビルドとデプロイ..."
echo ""

COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "manual-$(date +%Y%m%d%H%M%S)")

gcloud builds submit \
  --project=$PROJECT_ID \
  --config=infrastructure/cloudbuild-dev-agent.yaml \
  --substitutions=COMMIT_SHA=$COMMIT_SHA

echo "✅ デプロイが完了しました"
echo ""

# Step 7: Setup Cloud Scheduler
echo "⏰ Step 7: Cloud Schedulerを設定..."
bash infrastructure/setup-scheduler.sh
echo "✅ スケジューラーが設定されました"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --project=$PROJECT_ID \
  --region=$REGION \
  --format="value(status.url)" 2>/dev/null || echo "https://dev-agent-67385363897.asia-northeast1.run.app")

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    デプロイ完了                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Dev Agent URL: $SERVICE_URL"
echo ""
echo "📝 次のステップ:"
echo ""
echo "1. GitHub Webhookを設定:"
echo "   URL: $SERVICE_URL/webhook/github"
echo "   Content type: application/json"
echo "   Secret: (github-webhook-secretの値)"
echo "   Events: Issues, Issue comments, Pull requests"
echo ""
echo "   または以下のスクリプトを実行:"
echo "   bash infrastructure/setup-github-webhook.sh"
echo ""
echo "2. 動作確認:"
echo "   curl $SERVICE_URL"
echo "   curl $SERVICE_URL/api/status"
echo ""
echo "3. イシューに 'auto-dev' ラベルを付けて自動処理を開始"
echo ""
