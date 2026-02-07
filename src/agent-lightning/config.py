"""
Agent Lightning Configuration for LINE Calendar Bot
エージェント最適化の設定ファイル
"""

import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class AgentLightningConfig:
    """Agent Lightning の設定"""

    # モデル設定
    model_name: str = "gemini-1.5-flash"  # LINE BotのGeminiモデル
    optimization_model: str = "gpt-4o-mini"  # 最適化用モデル

    # トレーニング設定
    batch_size: int = 8
    learning_rate: float = 1e-4
    num_epochs: int = 3

    # データ収集設定
    data_dir: str = "training_data"
    max_samples: int = 10000

    # 報酬設定
    success_reward: float = 1.0
    partial_reward: float = 0.5
    failure_reward: float = -0.5

    # API設定
    api_host: str = "0.0.0.0"
    api_port: int = 8081

    @classmethod
    def from_env(cls) -> "AgentLightningConfig":
        """環境変数から設定を読み込む"""
        return cls(
            model_name=os.getenv("AGL_MODEL_NAME", "gemini-1.5-flash"),
            optimization_model=os.getenv("AGL_OPT_MODEL", "gpt-4o-mini"),
            batch_size=int(os.getenv("AGL_BATCH_SIZE", "8")),
            learning_rate=float(os.getenv("AGL_LEARNING_RATE", "1e-4")),
            num_epochs=int(os.getenv("AGL_NUM_EPOCHS", "3")),
            data_dir=os.getenv("AGL_DATA_DIR", "training_data"),
            max_samples=int(os.getenv("AGL_MAX_SAMPLES", "10000")),
            api_host=os.getenv("AGL_API_HOST", "0.0.0.0"),
            api_port=int(os.getenv("AGL_API_PORT", "8081")),
        )


# LINE Calendar Bot のタスクタイプ定義
TASK_TYPES = {
    "calendar_create": "カレンダー予定作成",
    "calendar_query": "カレンダー予定確認",
    "task_create": "タスク作成",
    "task_complete": "タスク完了",
    "reminder_set": "リマインダー設定",
    "general_query": "一般質問",
    "error_handling": "エラー対応",
}

# プロンプトテンプレート
PROMPT_TEMPLATES = {
    "system": """あなたはLINE Calendar Botのアシスタントです。
ユーザーの予定管理、タスク管理、リマインダー設定をサポートします。
日本語で簡潔に、親しみやすく応答してください。""",

    "calendar_create": """予定を作成します。
タイトル: {title}
日付: {date}
時間: {time}
場所: {location}""",

    "task_create": """タスクを作成します。
タイトル: {title}
期限: {due}""",
}
