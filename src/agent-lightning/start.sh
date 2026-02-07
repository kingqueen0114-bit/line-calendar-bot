#!/bin/bash
# Agent Lightning API Server 起動スクリプト

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 環境変数のデフォルト値
export AGL_API_HOST="${AGL_API_HOST:-0.0.0.0}"
export AGL_API_PORT="${AGL_API_PORT:-8081}"
export AGL_DATA_DIR="${AGL_DATA_DIR:-training_data}"

echo "=========================================="
echo "  Agent Lightning API Server"
echo "=========================================="
echo "  Host: $AGL_API_HOST"
echo "  Port: $AGL_API_PORT"
echo "  Data: $AGL_DATA_DIR"
echo "=========================================="

# 依存関係の確認
if ! python3 -c "import agentlightning" 2>/dev/null; then
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
fi

# サーバー起動
python3 api_server.py
