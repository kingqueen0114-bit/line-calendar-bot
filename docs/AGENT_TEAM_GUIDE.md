# Agent Team 活用ガイド

**最終更新**: 2026年2月7日

---

## 概要

Agent Team は複数のエージェントを効果的に連携させるシステムです。

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Team                            │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Explorer │ Planner  │ Executor │ General  │ MCP Tracker │
│ 探索     │ 計画     │ 実行     │ 汎用     │ 追跡・分析  │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

---

## エージェント一覧

| エージェント | 役割 | 使用場面 |
|-------------|------|---------|
| **Explorer** | コード探索 | ファイル検索、依存関係調査、コード理解 |
| **Planner** | 計画策定 | アーキテクチャ設計、タスク分解、実装計画 |
| **Executor** | コマンド実行 | ビルド、テスト、デプロイ、Git操作 |
| **General** | 汎用タスク | リファクタリング、バグ修正、機能追加 |

---

## ワークフロー

### 1. 新機能追加

```
Explorer → Planner → General → Executor (テスト) → Executor (デプロイ)
```

1. 既存コードの調査
2. 実装計画の策定
3. コード実装
4. テスト実行
5. デプロイ

### 2. バグ修正

```
Explorer → General → Executor (テスト) → Executor (デプロイ)
```

1. 問題箇所の特定
2. 修正実装
3. テスト確認
4. デプロイ

### 3. クイックデプロイ

```
Executor (コミット) → Executor (プッシュ) → Executor (デプロイ)
```

---

## MCP ツールとの連携

### タスク追跡

```javascript
// タスク開始
mcp__agent-lightning__track_task({
  task_id: "task-001",
  task_name: "新機能追加",
  project: "line-calendar-bot",
  status: "running"
});

// ステップ記録
mcp__agent-lightning__record_step({
  task_id: "task-001",
  project: "line-calendar-bot",
  action: "read_file",
  success: true,
  duration: 150
});

// タスク完了
mcp__agent-lightning__track_task({
  task_id: "task-001",
  task_name: "新機能追加",
  project: "line-calendar-bot",
  status: "success"
});
```

### 分析

```javascript
// 失敗パターン分析
mcp__agent-lightning__analyze_failures({
  project: "line-calendar-bot",
  days: 7
});

// 統計取得
mcp__agent-lightning__get_task_stats({
  project: "line-calendar-bot"
});

// 最適化ヒント
mcp__agent-lightning__get_optimization_hints({
  project: "line-calendar-bot"
});
```

---

## Claude Code での使い方

### 1. 探索タスク

「〜はどこにある？」「〜を調べて」のような質問には：

```
Task tool (subagent_type: Explore)
```

### 2. 計画が必要なタスク

「〜を実装して」「〜機能を追加して」のような複雑なタスクには：

```
1. EnterPlanMode で計画開始
2. Task tool (subagent_type: Plan) で設計
3. 実装
```

### 3. デプロイ作業

```
1. git status → 変更確認
2. git add & commit
3. git push
4. gcloud run deploy
```

### 4. 進捗追跡

MCPツールを使ってタスクを追跡：

```javascript
// 作業開始時
mcp__agent-lightning__track_task({ status: "running" })

// 作業完了時
mcp__agent-lightning__track_task({ status: "success" })
```

---

## ファイル構成

```
src/agent-team/
├── config.js      # エージェント・ワークフロー設定
├── tracker.js     # タスク追跡
├── workflow.js    # ワークフロー実行
└── index.js       # エクスポート

src/agent-lightning/
├── config.py      # Python設定
├── collector.py   # データ収集
├── optimizer.py   # 最適化エンジン
├── api_server.py  # REST API
├── client.js      # Node.jsクライアント
└── integration.js # LINE Bot統合
```

---

## 推奨プラクティス

1. **複雑なタスクは計画から** - EnterPlanMode を使用
2. **探索は Explorer に任せる** - 直接 grep/find しない
3. **タスクを追跡する** - MCP ツールで記録
4. **失敗から学ぶ** - analyze_failures で分析
5. **並列実行** - 独立したタスクは同時に実行

---

## トラブルシューティング

### Agent Lightning サーバーが動かない

```bash
cd src/agent-lightning
./start.sh
```

### 統計が取れない

```bash
# データディレクトリ確認
ls src/agent-lightning/training_data/
```

### MCP 接続エラー

`.mcp.json` の設定を確認してください。
