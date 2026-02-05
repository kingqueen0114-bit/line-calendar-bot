#!/bin/bash
# Dev Agent Setup Script
# 自律開発エージェントのセットアップスクリプト

set -e

PROJECT_ID="line-calendar-bot-20260203"
REGION="asia-northeast1"
SERVICE_NAME="dev-agent"

echo "=== Dev Agent Setup ==="
echo ""

# Step 1: Create secrets if they don't exist
echo "Step 1: Creating secrets..."

create_secret_if_not_exists() {
  local secret_name=$1
  if ! gcloud secrets describe $secret_name --project=$PROJECT_ID &>/dev/null; then
    echo "Creating secret: $secret_name"
    gcloud secrets create $secret_name --project=$PROJECT_ID --replication-policy="automatic"
  else
    echo "Secret exists: $secret_name"
  fi
}

create_secret_if_not_exists "github-token"
create_secret_if_not_exists "github-webhook-secret"
create_secret_if_not_exists "anthropic-api-key"
create_secret_if_not_exists "admin-user-id"

echo ""
echo "Step 2: Check secret values..."
echo ""

for secret in github-token github-webhook-secret anthropic-api-key admin-user-id; do
  version=$(gcloud secrets versions list $secret --project=$PROJECT_ID --limit=1 --format="value(name)" 2>/dev/null || echo "none")
  if [ "$version" != "none" ]; then
    echo "✅ $secret - 設定済み"
  else
    echo "❌ $secret - 未設定"
  fi
done

echo ""
echo "=== シークレットを設定してください ==="
echo ""
echo "1. GitHub Personal Access Token (repo, workflow権限):"
echo "   gcloud secrets versions add github-token --project=$PROJECT_ID --data-file=- <<< 'YOUR_TOKEN'"
echo ""
echo "2. GitHub Webhook Secret (任意の文字列):"
echo "   gcloud secrets versions add github-webhook-secret --project=$PROJECT_ID --data-file=- <<< 'YOUR_SECRET'"
echo ""
echo "3. Anthropic API Key:"
echo "   gcloud secrets versions add anthropic-api-key --project=$PROJECT_ID --data-file=- <<< 'YOUR_KEY'"
echo ""
echo "4. Admin User ID (LINE ユーザーID):"
echo "   gcloud secrets versions add admin-user-id --project=$PROJECT_ID --data-file=- <<< 'YOUR_USER_ID'"
echo ""

read -p "シークレットを設定しましたか？ (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "キャンセルしました"
  exit 1
fi

echo ""
echo "Step 3: Building and deploying Dev Agent..."
echo ""

# Build and push the image
gcloud builds submit \
  --project=$PROJECT_ID \
  --config=infrastructure/cloudbuild-dev-agent.yaml \
  --substitutions=COMMIT_SHA=$(git rev-parse HEAD)

echo ""
echo "Step 4: Creating Cloud Scheduler job..."
echo ""

# Create scheduler job for periodic task processing
gcloud scheduler jobs describe dev-agent-processor \
  --project=$PROJECT_ID \
  --location=$REGION &>/dev/null || \
gcloud scheduler jobs create http dev-agent-processor \
  --project=$PROJECT_ID \
  --location=$REGION \
  --schedule="*/15 * * * *" \
  --uri="https://dev-agent-67385363897.asia-northeast1.run.app/trigger/process" \
  --http-method=POST \
  --oidc-service-account-email="${PROJECT_ID}@appspot.gserviceaccount.com" \
  --description="Trigger dev agent task processing every 15 minutes"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Dev Agent URL: https://dev-agent-67385363897.asia-northeast1.run.app"
echo ""
echo "次のステップ:"
echo "1. GitHub リポジトリで Webhook を設定してください:"
echo "   - URL: https://dev-agent-67385363897.asia-northeast1.run.app/webhook/github"
echo "   - Content type: application/json"
echo "   - Secret: (設定したgithub-webhook-secret)"
echo "   - Events: Issues, Issue comments, Pull requests"
echo ""
echo "2. イシューに 'auto-dev' または 'claude-agent' ラベルを付けると自動処理されます"
echo ""
