# Node.js 20 ベースイメージ
FROM node:20-slim

# 作業ディレクトリ
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# ポート設定（Cloud Run は PORT 環境変数を使用）
ENV PORT=8080
EXPOSE 8080

# アプリケーション起動
CMD ["node", "src/server.js"]
