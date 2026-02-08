# LINE Calendar Bot - Automated Testing

このディレクトリには、LINE Calendar Botの自動テストが含まれています。

## 📋 テストの種類

### 統合テスト (`integration.test.js`)
アプリケーション全体の動作を検証する統合テスト:

- **ヘルスチェック**: サーバーの起動確認
- **セキュリティヘッダー**: XSS, CSRF対策のヘッダー確認
- **LIFF ページ**: HTML配信とキャッシュヘッダー
- **認証API**: auth-status, auth-url
- **ローカルイベントAPI**: CRUD操作
- **ローカルタスクAPI**: CRUD操作
- **メモAPI**: 一覧取得
- **同期設定API**: 設定の取得・更新
- **バックアップAPI**: エクスポート機能
- **レート制限**: レート制限ヘッダーの確認
- **セキュリティ**: SQLインジェクション対策

## 🚀 テストの実行方法

### ローカル環境でのテスト

1. **サーバーを起動**:
```bash
npm start
```

2. **別のターミナルでテストを実行**:
```bash
npm run test:local
```

### 本番環境に対するテスト

```bash
npm run test:prod
```

### カスタムURLに対するテスト

```bash
TEST_BASE_URL=http://your-url.com npm test
```

## 🔄 CI/CDでの自動テスト

### Cloud Build パイプライン

コードがmainブランチにpushされると、Cloud Buildが自動的に以下を実行します:

1. **依存関係のインストール**: `npm ci --omit=dev`
2. **統合テストの実行**: 本番環境に対してテストを実行
3. **テスト成功時**: Dockerイメージのビルドとデプロイ
4. **テスト失敗時**: ビルドを中止（デプロイされない）

### ビルドログの確認

```bash
# 最新のビルドを確認
gcloud builds list --limit=1

# ビルドの詳細を確認
gcloud builds describe BUILD_ID

# ビルドログを確認
gcloud builds log BUILD_ID
```

## 📊 テスト結果の確認

### ローカル実行時
テストの出力は以下の形式で表示されます:

```
=== LINE Calendar Bot Integration Tests ===

✅ Health check returns 200
✅ Health check has security headers
✅ LIFF page returns HTML
...
❌ Can create local event
   Error: Expected 200, got 500

=== Results: 20 passed, 1 failed ===
```

### CI/CD実行時
Cloud Buildのログから確認できます:
- [Cloud Build History](https://console.cloud.google.com/cloud-build/builds)

## 🛠️ テストの追加方法

新しいテストを追加するには、`integration.test.js`に以下の形式で追加します:

```javascript
test('Test description', async () => {
  const res = await request('/api/endpoint');
  assertEqual(res.status, 200, 'Should return 200');
  assert(res.data.someField, 'Should have someField');
});
```

### 利用可能なアサーション関数

- `assert(condition, message)`: 条件がtrueであることを確認
- `assertEqual(actual, expected, message)`: 値が等しいことを確認

### HTTPリクエストヘルパー

```javascript
const res = await request('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' }),
  headers: {
    'Custom-Header': 'value'
  }
});
```

## 📝 テストのベストプラクティス

1. **独立性**: 各テストは他のテストに依存しないようにする
2. **クリーンアップ**: テスト用のデータは`test-user-*`プレフィックスを使用
3. **明確な命名**: テスト名は何を検証しているか明確にする
4. **適切なエラーメッセージ**: アサーション失敗時に原因がわかるメッセージを記述

## 🔧 トラブルシューティング

### テストがタイムアウトする
- サーバーが起動しているか確認
- BASE_URLが正しいか確認
- ネットワーク接続を確認

### テストが失敗する
- エラーメッセージを確認
- サーバーログを確認
- 必要な環境変数が設定されているか確認

### CI/CDでテストが失敗するが、ローカルでは成功する
- 本番環境の環境変数が正しく設定されているか確認
- Cloud Buildのサービスアカウント権限を確認
- ビルドログで詳細なエラーメッセージを確認

## 📚 参考資料

- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#5-testing-and-overall-quality-practices)
