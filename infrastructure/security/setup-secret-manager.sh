#!/bin/bash
# Setup Google Cloud Secret Manager for LINE Calendar Bot

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== LINE Calendar Bot - Secret Manager Setup ===${NC}\n"

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No GCP project configured${NC}"
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID\n"

# Enable Secret Manager API
echo "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
echo -e "${GREEN}✓ Secret Manager API enabled${NC}\n"

# Define secrets to create
SECRETS=(
    "LINE_CHANNEL_ACCESS_TOKEN"
    "LINE_CHANNEL_SECRET"
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "OAUTH_REDIRECT_URI"
    "GEMINI_API_KEY"
    "LIFF_ID"
    "ADMIN_USER_ID"
)

echo -e "${BLUE}This script will create the following secrets:${NC}"
for secret in "${SECRETS[@]}"; do
    echo "  - $secret"
done
echo ""

read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""

# Function to create or update secret
create_or_update_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2

    if [ -z "$SECRET_VALUE" ]; then
        echo -e "${YELLOW}Skipping $SECRET_NAME (no value provided)${NC}"
        return
    fi

    # Check if secret exists
    if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
        echo "Updating existing secret: $SECRET_NAME"
        echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
            --data-file=- \
            --project="$PROJECT_ID" 2>/dev/null
    else
        echo "Creating new secret: $SECRET_NAME"
        echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" \
            --data-file=- \
            --replication-policy="automatic" \
            --project="$PROJECT_ID" 2>/dev/null
    fi

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $SECRET_NAME configured${NC}"
    else
        echo -e "${RED}✗ Failed to configure $SECRET_NAME${NC}"
    fi
}

# Create/update secrets
echo -e "${YELLOW}Enter values for each secret (or press Enter to skip):${NC}\n"

for secret in "${SECRETS[@]}"; do
    echo -n "$secret: "
    read -s SECRET_VALUE
    echo ""
    create_or_update_secret "$secret" "$SECRET_VALUE"
    echo ""
done

# Grant Cloud Run service account access to secrets
echo -e "\n${YELLOW}Granting Cloud Run service account access to secrets...${NC}"

# Get Cloud Run service account
SERVICE_ACCOUNT=$(gcloud run services describe line-calendar-bot \
    --region=asia-northeast1 \
    --platform=managed \
    --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null)

if [ -z "$SERVICE_ACCOUNT" ]; then
    # Use default compute service account
    PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
    SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
    echo "Using default compute service account: $SERVICE_ACCOUNT"
fi

for secret in "${SECRETS[@]}"; do
    if gcloud secrets describe "$secret" --project="$PROJECT_ID" &>/dev/null; then
        gcloud secrets add-iam-policy-binding "$secret" \
            --member="serviceAccount:$SERVICE_ACCOUNT" \
            --role="roles/secretmanager.secretAccessor" \
            --project="$PROJECT_ID" &>/dev/null || true
    fi
done

echo -e "${GREEN}✓ Service account permissions configured${NC}\n"

# Summary
echo -e "${GREEN}=== Setup Complete ===${NC}\n"
echo "Secrets created in Secret Manager:"
for secret in "${SECRETS[@]}"; do
    if gcloud secrets describe "$secret" --project="$PROJECT_ID" &>/dev/null; then
        VERSION_COUNT=$(gcloud secrets versions list "$secret" --project="$PROJECT_ID" --format="value(name)" | wc -l)
        echo "  ✓ $secret (${VERSION_COUNT} version(s))"
    else
        echo "  - $secret (not created)"
    fi
done

echo ""
echo "View secrets in console:"
echo "  https://console.cloud.google.com/security/secret-manager?project=$PROJECT_ID"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update Cloud Run service to use Secret Manager"
echo "2. Remove secrets from environment variables in cloudbuild.yaml"
echo "3. Test the application to ensure it can access secrets"
echo ""
