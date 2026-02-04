#!/bin/bash

# Cloud Run 環境変数設定スクリプト

echo "=== LINE Calendar Bot - Cloud Run 環境変数設定 ==="
echo ""
echo "Cloudflare Workersで使用していた値を入力してください。"
echo "（値は表示されません）"
echo ""

read -sp "LINE_CHANNEL_ACCESS_TOKEN: " LINE_CHANNEL_ACCESS_TOKEN
echo ""
read -sp "LINE_CHANNEL_SECRET: " LINE_CHANNEL_SECRET
echo ""
read -sp "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
echo ""
read -sp "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
echo ""
read -sp "GEMINI_API_KEY: " GEMINI_API_KEY
echo ""

OAUTH_REDIRECT_URI="https://line-calendar-bot-67385363897.asia-northeast1.run.app/oauth/callback"
LIFF_ID="2009033103-6cx2zHDu"
GOOGLE_CLOUD_PROJECT="line-calendar-bot-20260203"

echo ""
echo "=== 設定値確認 ==="
echo "OAUTH_REDIRECT_URI: $OAUTH_REDIRECT_URI"
echo "LIFF_ID: $LIFF_ID"
echo "GOOGLE_CLOUD_PROJECT: $GOOGLE_CLOUD_PROJECT"
echo ""

echo "Cloud Run に環境変数を設定中..."

~/google-cloud-sdk/bin/gcloud run services update line-calendar-bot \
  --region asia-northeast1 \
  --project line-calendar-bot-20260203 \
  --set-env-vars "LINE_CHANNEL_ACCESS_TOKEN=$LINE_CHANNEL_ACCESS_TOKEN,LINE_CHANNEL_SECRET=$LINE_CHANNEL_SECRET,GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET,OAUTH_REDIRECT_URI=$OAUTH_REDIRECT_URI,GEMINI_API_KEY=$GEMINI_API_KEY,LIFF_ID=$LIFF_ID,GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT"

if [ $? -eq 0 ]; then
  echo ""
  echo "=== 設定完了 ==="
  echo ""
  echo "次のステップ:"
  echo "1. LINE Developers Console で Webhook URL を更新："
  echo "   https://line-calendar-bot-67385363897.asia-northeast1.run.app/"
  echo ""
  echo "2. Google Cloud Console で OAuth リダイレクト URI を追加："
  echo "   https://line-calendar-bot-67385363897.asia-northeast1.run.app/oauth/callback"
  echo ""
  echo "3. サービスの動作確認："
  echo "   curl https://line-calendar-bot-67385363897.asia-northeast1.run.app/"
else
  echo ""
  echo "エラーが発生しました。値を確認して再度実行してください。"
fi
