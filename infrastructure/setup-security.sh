#!/bin/bash
# Setup Security for LINE Calendar Bot
# Usage: ./infrastructure/setup-security.sh

set -e

PROJECT_ID="line-calendar-bot-20260203"
REGION="asia-northeast1"
SERVICE_NAME="line-calendar-bot"
POLICY_NAME="line-calendar-bot-policy"

echo "=== LINE Calendar Bot Security Setup ==="

# 1. Enable required APIs
echo "1. Enabling required APIs..."
gcloud services enable compute.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudarmor.googleapis.com --project=$PROJECT_ID

# 2. Create Cloud Armor security policy
echo "2. Creating Cloud Armor security policy..."
if gcloud compute security-policies describe $POLICY_NAME --project=$PROJECT_ID &>/dev/null; then
    echo "Policy already exists, updating..."
    gcloud compute security-policies update $POLICY_NAME \
        --project=$PROJECT_ID \
        --description="Security policy for LINE Calendar Bot"
else
    echo "Creating new policy..."
    gcloud compute security-policies create $POLICY_NAME \
        --project=$PROJECT_ID \
        --description="Security policy for LINE Calendar Bot"
fi

# 3. Add security rules
echo "3. Adding security rules..."

# SQL Injection protection
gcloud compute security-policies rules create 1000 \
    --security-policy=$POLICY_NAME \
    --project=$PROJECT_ID \
    --expression="evaluatePreconfiguredExpr('sqli-v33-stable')" \
    --action=deny-403 \
    --description="Block SQL injection attacks" 2>/dev/null || echo "Rule 1000 exists"

# XSS protection
gcloud compute security-policies rules create 1001 \
    --security-policy=$POLICY_NAME \
    --project=$PROJECT_ID \
    --expression="evaluatePreconfiguredExpr('xss-v33-stable')" \
    --action=deny-403 \
    --description="Block XSS attacks" 2>/dev/null || echo "Rule 1001 exists"

# LFI protection
gcloud compute security-policies rules create 1002 \
    --security-policy=$POLICY_NAME \
    --project=$PROJECT_ID \
    --expression="evaluatePreconfiguredExpr('lfi-v33-stable')" \
    --action=deny-403 \
    --description="Block LFI attacks" 2>/dev/null || echo "Rule 1002 exists"

# RFI protection
gcloud compute security-policies rules create 1003 \
    --security-policy=$POLICY_NAME \
    --project=$PROJECT_ID \
    --expression="evaluatePreconfiguredExpr('rfi-v33-stable')" \
    --action=deny-403 \
    --description="Block RFI attacks" 2>/dev/null || echo "Rule 1003 exists"

# Rate limiting for non-Japan traffic
gcloud compute security-policies rules create 2000 \
    --security-policy=$POLICY_NAME \
    --project=$PROJECT_ID \
    --expression="origin.region_code != 'JP'" \
    --action=throttle \
    --rate-limit-threshold-count=100 \
    --rate-limit-threshold-interval-sec=60 \
    --conform-action=allow \
    --exceed-action=deny-429 \
    --enforce-on-key=IP \
    --description="Rate limit non-Japan traffic" 2>/dev/null || echo "Rule 2000 exists"

echo "4. Cloud Armor policy created successfully!"
echo ""
echo "Note: Cloud Armor requires a load balancer to be attached to Cloud Run."
echo "For serverless NEG setup, run:"
echo "  gcloud compute network-endpoint-groups create ${SERVICE_NAME}-neg \\"
echo "    --region=$REGION \\"
echo "    --network-endpoint-type=serverless \\"
echo "    --cloud-run-service=$SERVICE_NAME"
echo ""
echo "=== Security Setup Complete ==="
