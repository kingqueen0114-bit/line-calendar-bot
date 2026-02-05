#!/bin/bash
# Cloud Scheduler Setup for Dev Agent
# 定期実行のスケジューラー設定

set -e

PROJECT_ID="line-calendar-bot-20260203"
REGION="asia-northeast1"
DEV_AGENT_URL="https://dev-agent-67385363897.asia-northeast1.run.app"
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

echo "=== Cloud Scheduler Setup ==="
echo ""

# Enable Cloud Scheduler API
echo "Enabling Cloud Scheduler API..."
gcloud services enable cloudscheduler.googleapis.com --project=$PROJECT_ID

# Job 1: Process tasks every 15 minutes
echo "Creating scheduler job: dev-agent-processor..."
gcloud scheduler jobs delete dev-agent-processor \
  --project=$PROJECT_ID \
  --location=$REGION \
  --quiet 2>/dev/null || true

gcloud scheduler jobs create http dev-agent-processor \
  --project=$PROJECT_ID \
  --location=$REGION \
  --schedule="*/15 * * * *" \
  --uri="${DEV_AGENT_URL}/trigger/process" \
  --http-method=POST \
  --oidc-service-account-email=$SERVICE_ACCOUNT \
  --description="Process pending dev tasks every 15 minutes" \
  --time-zone="Asia/Tokyo"

# Job 2: Daily summary at 9 PM JST
echo "Creating scheduler job: dev-agent-daily-summary..."
gcloud scheduler jobs delete dev-agent-daily-summary \
  --project=$PROJECT_ID \
  --location=$REGION \
  --quiet 2>/dev/null || true

gcloud scheduler jobs create http dev-agent-daily-summary \
  --project=$PROJECT_ID \
  --location=$REGION \
  --schedule="0 21 * * *" \
  --uri="${DEV_AGENT_URL}/trigger/daily-summary" \
  --http-method=POST \
  --oidc-service-account-email=$SERVICE_ACCOUNT \
  --description="Send daily development summary at 9 PM" \
  --time-zone="Asia/Tokyo"

# Job 3: Health check every 5 minutes
echo "Creating scheduler job: dev-agent-health-check..."
gcloud scheduler jobs delete dev-agent-health-check \
  --project=$PROJECT_ID \
  --location=$REGION \
  --quiet 2>/dev/null || true

gcloud scheduler jobs create http dev-agent-health-check \
  --project=$PROJECT_ID \
  --location=$REGION \
  --schedule="*/5 * * * *" \
  --uri="${DEV_AGENT_URL}/" \
  --http-method=GET \
  --oidc-service-account-email=$SERVICE_ACCOUNT \
  --description="Health check to keep the service warm" \
  --time-zone="Asia/Tokyo"

echo ""
echo "=== Scheduler Jobs Created ==="
echo ""
gcloud scheduler jobs list --project=$PROJECT_ID --location=$REGION

echo ""
echo "Done! Scheduler jobs are now active."
echo ""
echo "Manual trigger commands:"
echo "  gcloud scheduler jobs run dev-agent-processor --project=$PROJECT_ID --location=$REGION"
echo "  gcloud scheduler jobs run dev-agent-daily-summary --project=$PROJECT_ID --location=$REGION"
