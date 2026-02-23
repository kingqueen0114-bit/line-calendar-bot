#!/bin/bash
# VM用デプロイスクリプト

echo "=== Building and Deploying to Cloud Run ==="

cd ~/line-calendar-bot

# 最新コードを取得
git pull origin main

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
~/google-cloud-sdk/bin/gcloud run services update line-calendar-bot \
  --image=gcr.io/line-calendar-bot-20260203/line-calendar-bot \
  --region=asia-northeast1 \
  --project=line-calendar-bot-20260203

if [ $? -eq 0 ]; then
  echo ""
  echo "=== Deploy Complete ==="
  echo "URL: https://line-calendar-bot-67385363897.asia-northeast1.run.app/"
else
  echo "Deploy failed!"
  exit 1
fi
