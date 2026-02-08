#!/bin/bash
# Setup Cost Monitoring (Budget Alerts) for LINE Calendar Bot

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== LINE Calendar Bot - Cost Monitoring Setup ===${NC}\n"

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No GCP project configured${NC}"
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID\n"

# Get billing account
echo "Getting billing account..."
BILLING_ACCOUNT=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingAccountName)" 2>/dev/null | cut -d'/' -f2)

if [ -z "$BILLING_ACCOUNT" ]; then
    echo -e "${RED}Error: No billing account found for this project${NC}"
    echo "This project may not have billing enabled."
    exit 1
fi

echo -e "${GREEN}✓ Billing account found:${NC} $BILLING_ACCOUNT\n"

# Update cost-budget.yaml with project ID
echo "Updating budget configuration..."
sed -i.bak "s/YOUR_PROJECT_ID/$PROJECT_ID/g" cost-budget.yaml
rm -f cost-budget.yaml.bak
echo -e "${GREEN}✓ Budget configuration updated${NC}\n"

# Create budget
echo "Creating budget..."
if gcloud billing budgets create \
    --billing-account="$BILLING_ACCOUNT" \
    --display-name="LINE Calendar Bot - Monthly Budget" \
    --budget-amount=100USD \
    --threshold-rule=percent=0.5 \
    --threshold-rule=percent=0.75 \
    --threshold-rule=percent=0.9 \
    --threshold-rule=percent=1.0 \
    --threshold-rule=percent=1.2 \
    2>/dev/null; then
    echo -e "${GREEN}✓ Budget created successfully${NC}"
else
    echo -e "${YELLOW}⚠ Budget may already exist or creation failed${NC}"
    echo "Note: You can only have one budget per billing account by default."
fi
echo ""

# Summary
echo -e "${GREEN}=== Setup Complete ===${NC}\n"
echo "Budget configuration:"
echo "  • Monthly budget: \$100 USD"
echo "  • Alerts at: 50%, 75%, 90%, 100%, 120% of budget"
echo ""
echo "View your budget:"
echo "  https://console.cloud.google.com/billing/${BILLING_ACCOUNT}/budgets?project=$PROJECT_ID"
echo ""
echo -e "${YELLOW}Note:${NC} To receive email notifications:"
echo "1. Go to the budget details page"
echo "2. Click 'Manage notifications'"
echo "3. Add email addresses or connect to Pub/Sub"
echo ""
