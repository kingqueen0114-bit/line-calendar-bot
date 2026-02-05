#!/bin/bash
# Secret Manager Migration Script
# シークレットを更新してCloud Runに適用するスクリプト

set -e

PROJECT_ID="line-calendar-bot-20260203"
REGION="asia-northeast1"

echo "=== Secret Manager Migration ==="
echo ""
echo "以下のシークレットを更新してください："
echo ""

# Check each secret
for secret in line-channel-access-token line-channel-secret google-client-id google-client-secret gemini-api-key liff-id; do
    version=$(gcloud secrets versions list $secret --project=$PROJECT_ID --limit=1 --format="value(name)" 2>/dev/null || echo "none")
    if [ "$version" != "none" ]; then
        echo "✅ $secret - 設定済み"
    else
        echo "❌ $secret - 未設定"
    fi
done

echo ""
echo "シークレットを更新するには："
echo ""
echo "gcloud secrets versions add SECRET_NAME --project=$PROJECT_ID --data-file=- <<< 'YOUR_VALUE'"
echo ""
echo "または GCPコンソール:"
echo "https://console.cloud.google.com/security/secret-manager?project=$PROJECT_ID"
echo ""

read -p "シークレットを更新しましたか？ (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "キャンセルしました"
    exit 1
fi

echo ""
echo "Cloud RunをSecret Manager使用に更新中..."

gcloud run services update line-calendar-bot \
    --project=$PROJECT_ID \
    --region=$REGION \
    --set-env-vars="NODE_ENV=production,OAUTH_REDIRECT_URI=https://line-calendar-bot-67385363897.asia-northeast1.run.app/oauth/callback" \
    --set-secrets="LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,GEMINI_API_KEY=gemini-api-key:latest,LIFF_ID=liff-id:latest"

echo ""
echo "=== 完了 ==="
