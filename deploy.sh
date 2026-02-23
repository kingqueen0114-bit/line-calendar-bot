#!/bin/bash

# LINE Calendar Bot - Cloud Run Deploy Script

echo "=== Building and Deploying to Cloud Run ==="

# Build
echo "Building container..."
~/google-cloud-sdk/bin/gcloud builds submit \
  --tag gcr.io/line-calendar-bot-20260203/line-calendar-bot \
  --project line-calendar-bot-20260203

if [ $? -ne 0 ]; then
  echo "Build failed!"
  exit 1
fi

# Deploy
echo "Deploying to Cloud Run..."

# Load .env variables
source .env

~/google-cloud-sdk/bin/gcloud run services update line-calendar-bot-v2 \
  --image=gcr.io/line-calendar-bot-20260203/line-calendar-bot \
  --region=asia-northeast1 \
  --project=line-calendar-bot-20260203 \
  --update-env-vars "^~^NODE_ENV=production~LINE_CHANNEL_ACCESS_TOKEN=$LINE_CHANNEL_ACCESS_TOKEN~LINE_CHANNEL_SECRET=$LINE_CHANNEL_SECRET~GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID~GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET~OAUTH_REDIRECT_URI=$OAUTH_REDIRECT_URI~GEMINI_API_KEY=$GEMINI_API_KEY~LIFF_ID=$LIFF_ID~GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT"

if [ $? -eq 0 ]; then
  echo ""
  echo "=== Deploy Complete ==="
  echo "URL: https://line-calendar-bot-v2-yuqfsqtspa-an.a.run.app/"
else
  echo "Deploy failed!"
  exit 1
fi
