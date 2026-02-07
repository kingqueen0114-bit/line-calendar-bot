"""
Training Data Collector for LINE Calendar Bot
ユーザーインタラクションデータを収集してAgent Lightning用にフォーマット
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
import agentlightning as agl

from config import AgentLightningConfig, TASK_TYPES


@dataclass
class Interaction:
    """ユーザーインタラクションデータ"""
    id: str
    timestamp: str
    user_id: str
    task_type: str
    user_message: str
    bot_response: str
    context: Dict[str, Any]
    reward: Optional[float] = None
    feedback: Optional[str] = None


class DataCollector:
    """
    LINE Bot のインタラクションデータを収集
    Agent Lightning のトレーニングデータとして使用
    """

    def __init__(self, config: Optional[AgentLightningConfig] = None):
        self.config = config or AgentLightningConfig.from_env()
        self.data_dir = Path(self.config.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.interactions: List[Interaction] = []
        self._load_existing_data()

    def _load_existing_data(self):
        """既存のデータを読み込む"""
        data_file = self.data_dir / "interactions.jsonl"
        if data_file.exists():
            with open(data_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        self.interactions.append(Interaction(**data))
            print(f"Loaded {len(self.interactions)} existing interactions")

    def record_interaction(
        self,
        user_id: str,
        task_type: str,
        user_message: str,
        bot_response: str,
        context: Optional[Dict[str, Any]] = None,
        reward: Optional[float] = None,
    ) -> str:
        """
        インタラクションを記録

        Args:
            user_id: ユーザーID
            task_type: タスクの種類 (calendar_create, task_create, etc.)
            user_message: ユーザーのメッセージ
            bot_response: ボットの応答
            context: 追加のコンテキスト情報
            reward: 報酬値（オプション、後から設定可能）

        Returns:
            interaction_id: 記録されたインタラクションのID
        """
        interaction_id = f"{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"

        interaction = Interaction(
            id=interaction_id,
            timestamp=datetime.now().isoformat(),
            user_id=user_id,
            task_type=task_type,
            user_message=user_message,
            bot_response=bot_response,
            context=context or {},
            reward=reward,
        )

        self.interactions.append(interaction)
        self._save_interaction(interaction)

        # Agent Lightningにイベントを発行
        try:
            agl.emit_step(
                name=f"line_bot_{task_type}",
                input=user_message,
                output=bot_response,
                metadata={
                    "user_id": user_id,
                    "task_type": task_type,
                    "timestamp": interaction.timestamp,
                }
            )
        except Exception as e:
            print(f"Warning: Failed to emit step to Agent Lightning: {e}")

        return interaction_id

    def _save_interaction(self, interaction: Interaction):
        """インタラクションをファイルに保存"""
        data_file = self.data_dir / "interactions.jsonl"
        with open(data_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(interaction), ensure_ascii=False) + "\n")

    def set_reward(self, interaction_id: str, reward: float, feedback: Optional[str] = None):
        """
        既存のインタラクションに報酬を設定

        Args:
            interaction_id: インタラクションID
            reward: 報酬値 (-1.0 ~ 1.0)
            feedback: オプションのフィードバックテキスト
        """
        for interaction in self.interactions:
            if interaction.id == interaction_id:
                interaction.reward = reward
                interaction.feedback = feedback

                # Agent Lightningに報酬を発行
                try:
                    agl.emit_reward(
                        reward=reward,
                        metadata={
                            "interaction_id": interaction_id,
                            "feedback": feedback,
                        }
                    )
                except Exception as e:
                    print(f"Warning: Failed to emit reward to Agent Lightning: {e}")

                self._update_data_file()
                return

        raise ValueError(f"Interaction {interaction_id} not found")

    def _update_data_file(self):
        """データファイルを更新"""
        data_file = self.data_dir / "interactions.jsonl"
        with open(data_file, "w", encoding="utf-8") as f:
            for interaction in self.interactions:
                f.write(json.dumps(asdict(interaction), ensure_ascii=False) + "\n")

    def get_training_data(self, min_reward: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        トレーニング用データを取得

        Args:
            min_reward: 最小報酬値（これ以上の報酬を持つデータのみ返す）

        Returns:
            Agent Lightning用にフォーマットされたトレーニングデータ
        """
        training_data = []

        for interaction in self.interactions:
            if min_reward is not None and (interaction.reward is None or interaction.reward < min_reward):
                continue

            training_data.append({
                "input": interaction.user_message,
                "output": interaction.bot_response,
                "task_type": interaction.task_type,
                "reward": interaction.reward or 0.0,
                "context": interaction.context,
            })

        return training_data

    def get_statistics(self) -> Dict[str, Any]:
        """データ統計を取得"""
        stats = {
            "total_interactions": len(self.interactions),
            "interactions_by_task": {},
            "average_reward": 0.0,
            "rewarded_count": 0,
        }

        total_reward = 0.0
        rewarded = 0

        for interaction in self.interactions:
            task_type = interaction.task_type
            stats["interactions_by_task"][task_type] = stats["interactions_by_task"].get(task_type, 0) + 1

            if interaction.reward is not None:
                total_reward += interaction.reward
                rewarded += 1

        if rewarded > 0:
            stats["average_reward"] = total_reward / rewarded
            stats["rewarded_count"] = rewarded

        return stats

    def export_for_training(self, output_path: Optional[str] = None) -> str:
        """
        Agent Lightningトレーニング用にデータをエクスポート

        Args:
            output_path: 出力パス（デフォルトは training_data/export.json）

        Returns:
            エクスポートされたファイルパス
        """
        output_path = output_path or str(self.data_dir / "export.json")
        training_data = self.get_training_data()

        export_data = {
            "metadata": {
                "exported_at": datetime.now().isoformat(),
                "total_samples": len(training_data),
                "statistics": self.get_statistics(),
            },
            "data": training_data,
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        print(f"Exported {len(training_data)} samples to {output_path}")
        return output_path


# シングルトンインスタンス
_collector: Optional[DataCollector] = None


def get_collector() -> DataCollector:
    """DataCollectorのシングルトンインスタンスを取得"""
    global _collector
    if _collector is None:
        _collector = DataCollector()
    return _collector


if __name__ == "__main__":
    # テスト
    collector = DataCollector()

    # サンプルインタラクションを記録
    interaction_id = collector.record_interaction(
        user_id="test_user",
        task_type="calendar_create",
        user_message="明日の午後3時に会議を入れて",
        bot_response="明日の15:00に「会議」を登録しました。",
        context={"date": "2026-02-07", "time": "15:00"},
    )

    # 報酬を設定
    collector.set_reward(interaction_id, reward=1.0, feedback="正確に処理された")

    # 統計を表示
    print(json.dumps(collector.get_statistics(), indent=2, ensure_ascii=False))
