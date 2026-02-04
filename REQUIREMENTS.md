# 最終要件定義書：LINE Project Sync Assistant

## 1. プロジェクトの全体像

LINE LIFFをフロントエンドとし、Google Cloud Run（Node.js/Express）をバックエンドとする、個人・チーム向けの統合スケジュール管理システム。

## 2. コア機能要件

### ① 4タブ構成のメインUI（LIFF）

#### カレンダー画面
- 上部サブタブ：【月 / 週 / 日】の表示切り替え
- Googleカレンダーと双方向リアルタイム同期
- プロジェクトごとの色分け表示

#### タスク画面
- リスト（カテゴリ）による分類管理
- Googleタスクとの連携（期限設定、完了ステータス）

#### メモ画面
- 画像添付およびカメラ撮影機能（直接起動）
- 画像は Google Cloud Storage (GCS) に保存

#### 設定画面
- プロジェクト作成・招待・共有設定
- Stripeによるサブスクリプション決済

### ② プロジェクト共有・編集システム

- **共有ロジック**: 予定に `project_id` を紐付け、`is_public` フラグで公開・非公開を制御
- **招待機能**: `liff.shareTargetPicker` を使い、LINEの友だちへ招待Flex Messageを送信
- **代理編集**: 権限を持つゲストが予定を修正した際、サーバーがオーナーの権限でGoogle APIを叩き、オーナーへ差分を通知

## 3. 技術仕様（Google Cloud 構成）

| 項目 | 選定テクノロジー |
|------|------------------|
| 実行環境 | Google Cloud Run (Node.js/Express/TypeScript) |
| データベース | PostgreSQL (Prisma) |
| ストレージ | Google Cloud Storage (GCS) |
| API連携 | googleapis, @line/bot-sdk, Stripe |
| 認証 | OAuth 2.0 (Google), LIFF Login (LINE) |

## 4. ユーザー体験（UX）フロー

- **カレンダー閲覧**: 画面を開くとドーンとカレンダー。タブ一つで詳細度を切り替え
- **共有の瞬間**: 共有したい相手をLINEの友達リストからポチポチ選ぶだけ
- **安心の通知**: 誰かが予定を変えたら、自分に「誰がどこをどう変えたか」がLINEで届く

## 5. 開発ロードマップ

### Phase 1 (UI/UX)
4つのメインタブと、カレンダーの「月/週/日」表示ロジックを完成させる。

### Phase 2 (Data Sync)
Googleカレンダー・タスクの同期処理を新UIに統合。

### Phase 3 (Media)
GCS連携による画像付きメモ機能の実装。

### Phase 4 (Social)
シェアターゲットピッカーによる招待と、代理編集・通知の実装。

---

## 現在の状態

- ✅ Google Cloud Run への移行完了
- ✅ Firestore によるデータ保存
- ✅ LINE Webhook 動作確認済み
- ✅ Google OAuth 認証動作確認済み
- ✅ Gemini AI による自然言語処理動作確認済み

## サービス情報

- **Cloud Run URL**: `https://line-calendar-bot-67385363897.asia-northeast1.run.app/`
- **LIFF URL**: `https://line-calendar-bot-67385363897.asia-northeast1.run.app/liff`
- **GCP Project**: `line-calendar-bot-20260203`
