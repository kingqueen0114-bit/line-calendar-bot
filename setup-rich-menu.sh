#!/bin/bash

# リッチメニューセットアップスクリプト
# 使い方: ./setup-rich-menu.sh YOUR_CHANNEL_ACCESS_TOKEN

set -e

if [ -z "$1" ]; then
  echo "❌ エラー: Channel Access Tokenが必要です"
  echo ""
  echo "使い方:"
  echo "  ./setup-rich-menu.sh YOUR_CHANNEL_ACCESS_TOKEN"
  echo ""
  echo "または環境変数を設定:"
  echo "  export LINE_CHANNEL_ACCESS_TOKEN='your_token_here'"
  echo "  ./setup-rich-menu.sh"
  exit 1
fi

TOKEN="${1:-$LINE_CHANNEL_ACCESS_TOKEN}"

echo "🚀 リッチメニューをセットアップします..."
echo ""

# ファイルの存在確認
if [ ! -f "rich-menu.json" ]; then
  echo "❌ rich-menu.json が見つかりません"
  exit 1
fi

if [ ! -f "rich-menu-image.png" ]; then
  echo "❌ rich-menu-image.png が見つかりません"
  echo ""
  echo "📝 画像生成方法:"
  echo "  1. rich-menu-generator.html をブラウザで開く"
  echo "  2. 画像を右クリック → 名前を付けて保存"
  echo "  3. 'rich-menu-image.png' として保存"
  echo ""
  exit 1
fi

# 既存のデフォルトリッチメニューを確認
echo "🔍 既存のリッチメニューを確認中..."
CURRENT_MENU=$(curl -s -X GET https://api.line.me/v2/bot/user/all/richmenu \
  -H "Authorization: Bearer $TOKEN" | jq -r '.richMenuId // empty')

if [ -n "$CURRENT_MENU" ]; then
  echo "⚠️  既存のデフォルトリッチメニューが見つかりました: $CURRENT_MENU"
  echo ""
  read -p "削除して新しいメニューに置き換えますか？ (y/n): " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  既存のリッチメニューを削除中..."
    curl -s -X DELETE https://api.line.me/v2/bot/richmenu/$CURRENT_MENU \
      -H "Authorization: Bearer $TOKEN" > /dev/null
    echo "✅ 削除完了"
  fi
fi

# ステップ1: リッチメニューを作成
echo ""
echo "📋 ステップ1: リッチメニューを作成中..."
CREATE_RESPONSE=$(curl -s -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @rich-menu.json)

MENU_ID=$(echo "$CREATE_RESPONSE" | jq -r '.richMenuId // empty')

if [ -z "$MENU_ID" ]; then
  echo "❌ リッチメニューの作成に失敗しました"
  echo "$CREATE_RESPONSE" | jq .
  exit 1
fi

echo "✅ リッチメニュー作成完了: $MENU_ID"

# ステップ2: 画像をアップロード
echo ""
echo "🖼️  ステップ2: 画像をアップロード中..."
UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  https://api-data.line.me/v2/bot/richmenu/$MENU_ID/content \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @rich-menu-image.png)

HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ 画像アップロード完了"
else
  echo "❌ 画像アップロードに失敗しました (HTTP $HTTP_CODE)"
  echo "$UPLOAD_RESPONSE"
  exit 1
fi

# ステップ3: デフォルトリッチメニューに設定
echo ""
echo "⚙️  ステップ3: デフォルトリッチメニューに設定中..."
SET_DEFAULT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  https://api.line.me/v2/bot/user/all/richmenu/$MENU_ID \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$SET_DEFAULT_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ デフォルト設定完了"
else
  echo "❌ デフォルト設定に失敗しました (HTTP $HTTP_CODE)"
  echo "$SET_DEFAULT_RESPONSE"
  exit 1
fi

# 完了
echo ""
echo "🎉 リッチメニューのセットアップが完了しました！"
echo ""
echo "📱 確認方法:"
echo "  1. LINEアプリでボットのトークルームを開く"
echo "  2. 画面下部にリッチメニューが表示されます"
echo "  3. 各ボタンをタップして動作確認してください"
echo ""
echo "🔗 Rich Menu ID: $MENU_ID"
echo ""
echo "💡 リッチメニューを削除する場合:"
echo "  curl -X DELETE https://api.line.me/v2/bot/richmenu/$MENU_ID \\"
echo "    -H \"Authorization: Bearer $TOKEN\""
echo ""
