# Claude Code 運用指示

## システムアップデート時のルール

**必ず `docs/OPERATIONS_MANUAL.md` に従って作業すること**

## 重要なドキュメント

| ファイル | 用途 |
|----------|------|
| `docs/OPERATIONS_MANUAL.md` | 運用マニュアル（アップデート手順） |
| `docs/ERROR_LOG.md` | エラー記録と解決策 |
| `PROGRESS.md` | プロジェクト進捗 |

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
