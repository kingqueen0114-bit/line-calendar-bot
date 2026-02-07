# Claude Code 運用指示

## システムアップデート時のルール

**必ず `docs/OPERATIONS_MANUAL.md` に従って作業すること**

## 重要なドキュメント

| ファイル | 用途 |
|----------|------|
| `docs/OPERATIONS_MANUAL.md` | 運用マニュアル（アップデート手順） |
| `docs/ERROR_LOG.md` | エラー記録と解決策 |
| `docs/AGENT_TEAM_GUIDE.md` | エージェントチーム活用ガイド |
| `PROGRESS.md` | プロジェクト進捗 |

## Agent Team 活用（必須）

### タスク追跡

**作業開始時：**
```
mcp__agent-lightning__track_task({
  task_id: "一意のID",
  task_name: "タスク名",
  project: "line-calendar-bot",
  status: "running"
})
```

**作業完了時：**
```
mcp__agent-lightning__track_task({
  task_id: "同じID",
  task_name: "タスク名",
  project: "line-calendar-bot",
  status: "success" または "failed"
})
```

### エージェント使い分け

| 作業内容 | 使用するツール |
|----------|---------------|
| コード探索・調査 | `Task (subagent_type: Explore)` |
| 複雑な実装計画 | `EnterPlanMode` → `Task (subagent_type: Plan)` |
| コマンド実行 | `Bash` または `Task (subagent_type: Bash)` |
| 複合タスク | `Task (subagent_type: general-purpose)` |

### 定期分析

週次で失敗パターンを分析：
```
mcp__agent-lightning__analyze_failures({ project: "line-calendar-bot", days: 7 })
mcp__agent-lightning__get_optimization_hints({ project: "line-calendar-bot" })
```

## 機能分離ルール（厳守）

- **LINEメッセージ** → カレンダー/タスク機能のみ（全ユーザー共通）
- **Claudeボタン（LIFF）** → 開発管理機能（管理者のみ）
- 他のユーザーに影響を与えないよう、管理機能はClaudeボタンに集約

## デプロイ情報

```
Cloud Run: line-calendar-bot
リージョン: asia-northeast1
プロジェクト: line-calendar-bot-20260203
VM: dev-agent-vm (35.221.93.66)
```

## エラー発生時

1. `docs/ERROR_LOG.md` に記録
2. 原因・解決策・教訓を明記
3. 同じミスを繰り返さない
