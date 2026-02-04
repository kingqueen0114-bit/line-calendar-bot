# LINE Calendar Bot - 開発進捗

**最終更新**: 2026年2月4日 21:30

---

## 1. LINE Calendar Bot 機能開発 ✅

| 機能 | 状態 | 詳細 |
|------|------|------|
| 個人/共有カレンダー作成 | ✅ | 設定画面から作成可能 |
| 曜日バックグラウンドにテーマカラー | ✅ | 月・週表示に対応 |
| 通知機能 | ✅ | 15分ごとにチェック、10-35分前に通知 |
| タスク管理 | ✅ | Google Tasks連携 |
| 共有タスクリスト | ✅ | 招待コードで参加可能 |
| メモ機能 | ✅ | 検索機能付き |
| LIFF UI | ✅ | カレンダー/タスク/メモ/設定タブ |

**本番URL**: https://line-calendar-bot-67385363897.asia-northeast1.run.app/

---

## 2. リポジトリ情報

| 項目 | 値 |
|------|-----|
| GitHub | https://github.com/kingqueen0114-bit/line-calendar-bot |
| ブランチ | main |
| 最新コミット | Google Cloud移設準備: 全ファイルを整理 |

### ファイル構成
```
line-calendar-bot/
├── src/
│   ├── server.js          # Expressサーバー
│   ├── app.js             # アプリケーションロジック
│   ├── liff.js            # LIFF HTMLテンプレート
│   ├── calendar.js        # Google Calendar API
│   ├── tasks.js           # Google Tasks API
│   ├── oauth.js           # OAuth認証
│   ├── gemini.js          # Gemini AI解析
│   ├── line.js            # LINE Messaging API
│   ├── project.js         # 共有カレンダー
│   ├── shared-calendar.js # 共有イベント
│   ├── shared-tasklist.js # 共有タスク
│   ├── memo.js            # メモ機能
│   └── storage.js         # ストレージ
├── Dockerfile
├── cloudbuild.yaml
├── deploy.sh
├── migration.md           # 移設手順書
└── package.json
```

---

## 3. GCP環境

### Cloud Run（本番）
| 項目 | 値 |
|------|-----|
| サービス名 | line-calendar-bot |
| リージョン | asia-northeast1 |
| URL | https://line-calendar-bot-67385363897.asia-northeast1.run.app |
| プロジェクトID | line-calendar-bot-20260203 |

### Cloud Scheduler
| 項目 | 値 |
|------|-----|
| ジョブ名 | line-calendar-reminder |
| スケジュール | */15 * * * * (15分ごと) |
| エンドポイント | POST /scheduled |

### GCP VM（開発用サンドボックス）
| 項目 | 値 |
|------|-----|
| VM名 | line-app-sandbox |
| 外部IP | 35.190.237.16 |
| ゾーン | asia-northeast1-a |
| マシンタイプ | e2-medium (2vCPU, 4GB RAM) |
| OS | Ubuntu 22.04 LTS |
| ディスク | 20GB |

### VMにインストール済み
- Node.js v20.20.0
- npm v10.8.2
- git v2.34.1
- gcloud SDK v555.0.0
- Claude Code v2.1.31

### VMのデプロイスクリプト
```bash
# SSHでVMに接続後
cd ~/line-calendar-bot
./deploy-vm.sh
```

---

## 4. 環境変数

### 必要な環境変数（Cloud Runに設定済み）
| 変数名 | 説明 |
|--------|------|
| LINE_CHANNEL_ACCESS_TOKEN | LINE Botアクセストークン |
| LINE_CHANNEL_SECRET | LINE Botシークレット |
| GOOGLE_CLIENT_ID | Google OAuth クライアントID |
| GOOGLE_CLIENT_SECRET | Google OAuth シークレット |
| OAUTH_REDIRECT_URI | OAuthコールバックURL |
| GEMINI_API_KEY | Gemini APIキー |
| LIFF_ID | LINE LIFF ID |

---

## 5. 現在の開発フロー

```
[Mac] Claude Code で開発
    ↓
[Mac] git add → git commit → git push
    ↓
[スマホ] GCPアプリでVMにSSH
    ↓
[VM] cd ~/line-calendar-bot && ./deploy-vm.sh
    ↓
[Cloud Run] 自動デプロイ完了
```

---

## 6. 未完了・今後の課題

### VMでのClaude Code認証
- **問題**: OAuth認証がヘッドレスVM環境で動作しない
- **解決策**: Anthropic APIクレジット（$5〜）を追加してAPIキー認証を使用

### スマホ完結の開発環境
- **目標**: Macを閉じていてもスマホだけで開発・承認・デプロイ
- **必要なもの**:
  1. Anthropic APIクレジット追加
  2. VMに `ANTHROPIC_API_KEY` 環境変数設定
  3. スマホからSSHしてClaude Codeを操作

### APIキー（作成済み、未使用）
- `gcp-vm`: sk-ant-api03--Rz...FQAA

---

## 7. 接続情報

### GCPコンソール
https://console.cloud.google.com/compute?project=line-calendar-bot-20260203

### VMにSSH（ローカルから）
```bash
gcloud compute ssh line-app-sandbox \
  --zone=asia-northeast1-a \
  --project=line-calendar-bot-20260203
```

### VMにSSH（スマホから）
1. Google Cloudアプリを開く
2. Compute Engine → line-app-sandbox → SSH

---

## 8. トラブルシューティング

### デプロイ失敗時
```bash
# VMでログ確認
gcloud run services logs read line-calendar-bot \
  --region=asia-northeast1 \
  --limit=50
```

### 通知が届かない場合
1. LIFFアプリを開いて通知リストに登録される
2. Cloud Schedulerの状態確認
3. ユーザーの通知設定がONか確認

---

**この進捗ファイルは `/Users/yuiyane/line-calendar-bot/PROGRESS.md` に保存されています。**
