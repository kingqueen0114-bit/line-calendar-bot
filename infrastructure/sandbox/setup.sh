#!/bin/bash

# サンドボックス環境セットアップスクリプト

set -e

echo "🚀 サンドボックス環境をセットアップしています..."

# ディレクトリ作成
mkdir -p data ssl logs

# 環境変数ファイルの作成（存在しない場合）
if [ ! -f .env.project-bot ]; then
  echo "📝 .env.project-bot を作成しています..."
  cat > .env.project-bot << 'EOF'
# プロジェクト管理Bot設定
PROJECT_LINE_CHANNEL_ACCESS_TOKEN=your_project_bot_token
PROJECT_LINE_CHANNEL_SECRET=your_project_bot_secret
DATA_DIR=/app/data
EOF
  echo "⚠️  .env.project-bot を編集して、LINE認証情報を設定してください"
fi

# Dockerが利用可能か確認
if ! command -v docker &> /dev/null; then
  echo "❌ Dockerがインストールされていません"
  echo "   https://docs.docker.com/get-docker/ からインストールしてください"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "❌ Docker Composeがインストールされていません"
  exit 1
fi

echo "✅ 前提条件のチェック完了"

# イメージビルド
echo "🔨 Dockerイメージをビルドしています..."
docker compose build

echo ""
echo "✅ セットアップ完了！"
echo ""
echo "📌 次のステップ:"
echo "   1. .env.project-bot を編集してLINE認証情報を設定"
echo "   2. docker compose up -d で起動"
echo ""
echo "📍 サービスURL:"
echo "   - メインアプリ:     http://localhost:8080"
echo "   - プロジェクトBot:  http://localhost:8081"
echo "   - LINEモック:       http://localhost:8082"
echo ""
