# Cloud Monitoring Setup for LINE Calendar Bot

このディレクトリには、LINE Calendar BotのCloud Monitoring設定が含まれています。

## 📊 含まれる設定

### 1. Monitoring Dashboard (`dashboard.json`)
Cloud Runサービスの包括的な監視ダッシュボード:
- **Request Count**: リクエスト数（req/sec）
- **Request Latencies**: レスポンス時間（P50, P95, P99）
- **Error Rate**: エラーレート（4xx, 5xx）
- **Container Instance Count**: コンテナインスタンス数
- **Memory Utilization**: メモリ使用率
- **CPU Utilization**: CPU使用率
- **Error Logs**: エラーログビューア

### 2. Alert Policies (`alerts.yaml`)
5つのアラートポリシー:
1. **High 5xx Error Rate**: 5xxエラーレート > 5%
2. **High Request Latency**: P95レイテンシ > 3秒
3. **High Instance Count**: インスタンス数 > 10
4. **High Memory Utilization**: メモリ使用率 > 90%
5. **High CPU Utilization**: CPU使用率 > 80%

### 3. Cost Budget (`cost-budget.yaml`)
月次予算とアラート:
- 月次予算: $100 USD
- アラート閾値: 50%, 75%, 90%, 100%, 120%

## 🚀 セットアップ手順

### 前提条件
- Google Cloud SDK (`gcloud`) がインストールされていること
- プロジェクトに対する適切な権限（Monitoring Admin, Billing Account Admin）

### 1. 監視ダッシュボードとアラートのセットアップ

```bash
cd infrastructure/monitoring
./setup-monitoring.sh
```

このスクリプトは以下を実行します:
- Cloud Monitoring ダッシュボードの作成
- 5つのアラートポリシーの作成
- 設定の検証

### 2. コスト監視のセットアップ

```bash
./setup-cost-monitoring.sh
```

このスクリプトは以下を実行します:
- 月次予算の作成
- 予算アラートの設定

### 3. 通知チャネルの追加（オプションだが推奨）

#### メール通知の設定:
1. [Notification Channels](https://console.cloud.google.com/monitoring/alerting/notifications) にアクセス
2. "Create Notification Channel" をクリック
3. "Email" を選択して、メールアドレスを入力
4. 各アラートポリシーを編集して、作成した通知チャネルを追加

#### Slack通知の設定:
1. [Notification Channels](https://console.cloud.google.com/monitoring/alerting/notifications) にアクセス
2. "Create Notification Channel" をクリック
3. "Slack" を選択して、Workspace URLとチャネル名を入力
4. 各アラートポリシーを編集して、作成した通知チャネルを追加

## 📈 監視の確認

### ダッシュボードの表示
```
https://console.cloud.google.com/monitoring/dashboards
```

### アラートポリシーの確認
```
https://console.cloud.google.com/monitoring/alerting/policies
```

### 予算の確認
```
https://console.cloud.google.com/billing/budgets
```

## 🔧 カスタマイズ

### ダッシュボードのカスタマイズ
`dashboard.json` を編集して、新しいウィジェットを追加したり、既存のウィジェットを変更できます。

変更を適用:
```bash
# 既存のダッシュボードを削除してから再作成
gcloud monitoring dashboards delete DASHBOARD_ID
./setup-monitoring.sh
```

### アラート閾値の変更
`alerts.yaml` のthresholdValueやdurationを編集して、アラート閾値を調整できます。

### 予算の変更
`cost-budget.yaml` の金額や閾値を編集できます。

変更を適用:
```bash
# 既存の予算を削除してから再作成
gcloud billing budgets delete BUDGET_ID --billing-account=BILLING_ACCOUNT_ID
./setup-cost-monitoring.sh
```

## 📝 ベストプラクティス

1. **通知チャネルを必ず設定する**: アラートが発生しても通知されないと意味がありません
2. **定期的にダッシュボードを確認する**: 少なくとも週1回はメトリクスを確認
3. **アラート閾値を適切に調整する**: 本番トラフィックに基づいて閾値を最適化
4. **予算アラートを真剣に受け止める**: 予想外のコスト増加を早期に発見

## 🔍 トラブルシューティング

### ダッシュボードが作成されない
- プロジェクトIDが正しいか確認
- Monitoring Admin権限があるか確認
- dashboard.jsonの構文エラーをチェック

### アラートが作成されない
- `gcloud alpha` コンポーネントがインストールされているか確認:
  ```bash
  gcloud components install alpha
  ```

### 予算が作成されない
- 請求アカウントが有効か確認
- Billing Account Admin権限があるか確認

## 📚 参考資料

- [Cloud Monitoring Documentation](https://cloud.google.com/monitoring/docs)
- [Cloud Run Monitoring](https://cloud.google.com/run/docs/monitoring)
- [Setting up Budget Alerts](https://cloud.google.com/billing/docs/how-to/budgets)
