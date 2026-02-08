#!/bin/bash
# Setup Cloud Monitoring for LINE Calendar Bot

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== LINE Calendar Bot - Monitoring Setup ===${NC}\n"

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No GCP project configured${NC}"
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID"
echo -e "${YELLOW}Service:${NC} line-calendar-bot"
echo -e "${YELLOW}Region:${NC} asia-northeast1\n"

# Check if service exists
echo "Checking if Cloud Run service exists..."
if ! gcloud run services describe line-calendar-bot --region=asia-northeast1 &>/dev/null; then
    echo -e "${RED}Error: Cloud Run service 'line-calendar-bot' not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Service found${NC}\n"

# Update dashboard.json with project ID
echo "Updating dashboard configuration..."
sed -i.bak "s/YOUR_PROJECT_ID/$PROJECT_ID/g" dashboard.json
rm -f dashboard.json.bak
echo -e "${GREEN}✓ Dashboard configuration updated${NC}\n"

# Create dashboard
echo "Creating Cloud Monitoring dashboard..."
if gcloud monitoring dashboards create --config-from-file=dashboard.json 2>/dev/null; then
    echo -e "${GREEN}✓ Dashboard created successfully${NC}"
    DASHBOARD_URL="https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
    echo -e "${YELLOW}Dashboard URL:${NC} $DASHBOARD_URL"
else
    echo -e "${YELLOW}⚠ Dashboard may already exist or creation failed${NC}"
fi
echo ""

# Create alert policies
echo "Creating alert policies..."

# Split alerts.yaml into individual policy files
csplit -f alert- -b %02d.yaml alerts.yaml '/^---$/' '{*}' 2>/dev/null || true

ALERT_COUNT=0
for alert_file in alert-*.yaml; do
    if [ -f "$alert_file" ] && [ -s "$alert_file" ]; then
        ALERT_NAME=$(grep "displayName:" "$alert_file" | head -1 | cut -d'"' -f2)
        echo "  Creating: $ALERT_NAME"

        if gcloud alpha monitoring policies create --policy-from-file="$alert_file" 2>/dev/null; then
            echo -e "  ${GREEN}✓ Created${NC}"
            ((ALERT_COUNT++))
        else
            echo -e "  ${YELLOW}⚠ May already exist or creation failed${NC}"
        fi
    fi
done

# Cleanup temporary files
rm -f alert-*.yaml

echo ""
echo -e "${GREEN}✓ Alert policies setup complete${NC}"
echo -e "${YELLOW}Total alerts created:${NC} $ALERT_COUNT\n"

# Create notification channel (optional)
echo -e "${YELLOW}Note:${NC} Alert policies created without notification channels."
echo "To add email notifications:"
echo "1. Go to: https://console.cloud.google.com/monitoring/alerting/notifications?project=$PROJECT_ID"
echo "2. Create a notification channel (email, Slack, etc.)"
echo "3. Edit each alert policy to add the notification channel"
echo ""

# Summary
echo -e "${GREEN}=== Setup Complete ===${NC}\n"
echo "Resources created:"
echo "  ✓ Cloud Monitoring Dashboard"
echo "  ✓ 5 Alert Policies:"
echo "    - High 5xx Error Rate"
echo "    - High Request Latency"
echo "    - High Instance Count"
echo "    - High Memory Utilization"
echo "    - High CPU Utilization"
echo ""
echo "View your monitoring dashboard:"
echo "  $DASHBOARD_URL"
echo ""
echo "View alert policies:"
echo "  https://console.cloud.google.com/monitoring/alerting/policies?project=$PROJECT_ID"
echo ""
