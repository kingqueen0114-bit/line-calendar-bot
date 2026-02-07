# Agent Lightning Integration

LINE Calendar Bot に Microsoft Agent Lightning を統合したモジュールです。
強化学習によりボットの応答品質を最適化できます。

## セットアップ

### 1. 依存関係のインストール

```bash
pip3 install -r src/agent-lightning/requirements.txt
```

### 2. API サーバーの起動

```bash
npm run agl:start
# または
cd src/agent-lightning && ./start.sh
```

サーバーは `http://localhost:8081` で起動します。

## 使い方

### Node.js から利用

```javascript
import { getClient, detectTaskType, estimateReward } from './agent-lightning/client.js';

const client = getClient();

// インタラクションを記録
const result = await client.recordInteraction({
  userId: 'user123',
  taskType: 'calendar_create',
  userMessage: '明日の午後3時に会議を入れて',
  botResponse: '✅ 明日の15:00に「会議」を登録しました。',
});

// 報酬を設定（ユーザーフィードバック後）
await client.setReward(result.interaction_id, 1.0, 'positive');

// 応答を分析
const analysis = await client.analyzeResponse(
  '今週の予定を教えて',
  '📅 今週の予定です: ...',
  'calendar_query'
);
console.log(analysis.reward, analysis.reward_level);
```

### Python から利用

```python
from collector import get_collector
from optimizer import AgentOptimizer

# データ収集
collector = get_collector()
collector.record_interaction(
    user_id="user123",
    task_type="calendar_create",
    user_message="明日の午後3時に会議を入れて",
    bot_response="✅ 明日の15:00に「会議」を登録しました。",
)

# 最適化実行
optimizer = AgentOptimizer()
training_data = collector.get_training_data()
results = optimizer.run_optimization(training_data, num_iterations=100)
```

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/health` | ヘルスチェック |
| POST | `/api/record` | インタラクションを記録 |
| POST | `/api/reward` | 報酬を設定 |
| GET | `/api/stats` | 統計を取得 |
| GET | `/api/prompt` | 最適化済みプロンプトを取得 |
| POST | `/api/optimize` | 最適化を実行 |
| POST | `/api/analyze` | 応答を分析 |
| GET | `/api/history` | 最適化履歴を取得 |
| GET | `/api/task-types` | タスクタイプ一覧 |

## 環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `AGL_API_HOST` | `0.0.0.0` | APIサーバーのホスト |
| `AGL_API_PORT` | `8081` | APIサーバーのポート |
| `AGL_DATA_DIR` | `training_data` | データ保存ディレクトリ |
| `AGL_MODEL_NAME` | `gemini-1.5-flash` | 対象モデル |
| `AGL_BATCH_SIZE` | `8` | トレーニングバッチサイズ |

## ファイル構成

```
src/agent-lightning/
├── __init__.py        # パッケージ初期化
├── config.py          # 設定とタスクタイプ定義
├── collector.py       # データ収集
├── optimizer.py       # 最適化エンジン
├── api_server.py      # REST API サーバー
├── client.js          # Node.js クライアント
├── integration.js     # LINE Bot 統合
├── requirements.txt   # Python 依存関係
├── start.sh          # 起動スクリプト
└── README.md         # このファイル
```

## 参考リンク

- [Agent Lightning GitHub](https://github.com/microsoft/agent-lightning)
- [Agent Lightning Documentation](https://microsoft.github.io/agent-lightning/latest/)
- [Microsoft Research Blog](https://www.microsoft.com/en-us/research/blog/agent-lightning-adding-reinforcement-learning-to-ai-agents-without-code-rewrites/)
