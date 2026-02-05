#!/bin/bash
# GitHub Webhook Setup Script
# GitHubリポジトリにWebhookを設定するスクリプト

set -e

REPO_OWNER="yuiyane"
REPO_NAME="line-calendar-bot"
WEBHOOK_URL="https://dev-agent-67385363897.asia-northeast1.run.app/webhook/github"

echo "=== GitHub Webhook Setup ==="
echo ""
echo "このスクリプトはGitHub CLIを使用してWebhookを設定します。"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
  echo "GitHub CLI (gh) がインストールされていません。"
  echo "インストール: brew install gh"
  exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
  echo "GitHub CLIにログインしてください:"
  gh auth login
fi

echo "Step 1: Webhook Secretの生成..."
WEBHOOK_SECRET=$(openssl rand -hex 20)
echo "Generated secret: $WEBHOOK_SECRET"
echo ""
echo "このシークレットをGoogle Cloud Secret Managerに保存してください:"
echo ""
echo "gcloud secrets versions add github-webhook-secret \\"
echo "  --project=line-calendar-bot-20260203 \\"
echo "  --data-file=- <<< '$WEBHOOK_SECRET'"
echo ""

read -p "シークレットを保存しましたか？ (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "キャンセルしました"
  exit 1
fi

echo ""
echo "Step 2: GitHubリポジトリにWebhookを作成..."
echo ""

# Create webhook using gh api
gh api repos/${REPO_OWNER}/${REPO_NAME}/hooks \
  --method POST \
  --field name='web' \
  --field active=true \
  --field config[url]="${WEBHOOK_URL}" \
  --field config[content_type]='json' \
  --field config[secret]="${WEBHOOK_SECRET}" \
  --field config[insecure_ssl]='0' \
  --field events[]='issues' \
  --field events[]='issue_comment' \
  --field events[]='pull_request' \
  --field events[]='push'

echo ""
echo "=== Webhook Setup Complete ==="
echo ""
echo "設定されたWebhook:"
gh api repos/${REPO_OWNER}/${REPO_NAME}/hooks --jq '.[] | {id, url: .config.url, events}'

echo ""
echo "使い方:"
echo "1. イシューに 'auto-dev' または 'claude-agent' ラベルを追加"
echo "2. コメントで @claude-agent または @dev-agent とメンション"
echo "3. 自動的にDev Agentがタスクをキューに追加して処理"
echo ""
