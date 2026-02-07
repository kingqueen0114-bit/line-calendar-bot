"""
Agent Optimizer using Agent Lightning
LINE Calendar Bot の応答を強化学習で最適化
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Callable
import agentlightning as agl

from config import AgentLightningConfig, PROMPT_TEMPLATES


class LineCalendarAgent:
    """
    LINE Calendar Bot のエージェント
    Agent Lightning で最適化可能なラッパー
    """

    def __init__(self, config: Optional[AgentLightningConfig] = None):
        self.config = config or AgentLightningConfig.from_env()
        self.system_prompt = PROMPT_TEMPLATES["system"]
        self.optimized_prompts: Dict[str, str] = {}
        self._load_optimized_prompts()

    def _load_optimized_prompts(self):
        """最適化済みプロンプトを読み込む"""
        prompt_file = Path(self.config.data_dir) / "optimized_prompts.json"
        if prompt_file.exists():
            with open(prompt_file, "r", encoding="utf-8") as f:
                self.optimized_prompts = json.load(f)
            print(f"Loaded {len(self.optimized_prompts)} optimized prompts")

    def _save_optimized_prompts(self):
        """最適化済みプロンプトを保存"""
        prompt_file = Path(self.config.data_dir) / "optimized_prompts.json"
        prompt_file.parent.mkdir(parents=True, exist_ok=True)
        with open(prompt_file, "w", encoding="utf-8") as f:
            json.dump(self.optimized_prompts, f, ensure_ascii=False, indent=2)

    def get_system_prompt(self, task_type: Optional[str] = None) -> str:
        """
        システムプロンプトを取得
        最適化済みのものがあればそれを使用

        Args:
            task_type: タスクの種類

        Returns:
            システムプロンプト
        """
        if task_type and task_type in self.optimized_prompts:
            return self.optimized_prompts[task_type]
        return self.system_prompt

    def update_optimized_prompt(self, task_type: str, prompt: str):
        """最適化されたプロンプトを更新"""
        self.optimized_prompts[task_type] = prompt
        self._save_optimized_prompts()


class AgentOptimizer:
    """
    Agent Lightning を使用したエージェント最適化
    """

    def __init__(self, config: Optional[AgentLightningConfig] = None):
        self.config = config or AgentLightningConfig.from_env()
        self.agent = LineCalendarAgent(config)
        self.training_history: List[Dict[str, Any]] = []

    def prepare_training_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Agent Lightning用のトレーニングデータを準備

        Args:
            data: collector.get_training_data() の出力

        Returns:
            Agent Lightning用にフォーマットされたデータ
        """
        formatted_data = []

        for item in data:
            formatted_data.append({
                "messages": [
                    {"role": "system", "content": self.agent.get_system_prompt(item.get("task_type"))},
                    {"role": "user", "content": item["input"]},
                    {"role": "assistant", "content": item["output"]},
                ],
                "reward": item.get("reward", 0.0),
                "task_type": item.get("task_type", "general"),
            })

        return formatted_data

    def create_reward_function(self) -> Callable[[str, str, Dict[str, Any]], float]:
        """
        報酬関数を作成

        Returns:
            報酬を計算する関数
        """
        def reward_fn(user_input: str, bot_output: str, context: Dict[str, Any]) -> float:
            """
            応答の品質に基づいて報酬を計算

            評価基準:
            - 日本語の自然さ
            - タスク完了度
            - 応答の簡潔さ
            - エラーハンドリング
            """
            reward = 0.0

            # 基本的な応答チェック
            if not bot_output or len(bot_output.strip()) == 0:
                return self.config.failure_reward

            # 成功キーワードチェック
            success_keywords = ["完了", "登録", "作成", "設定", "追加", "削除"]
            if any(kw in bot_output for kw in success_keywords):
                reward += 0.3

            # エラー応答チェック
            error_keywords = ["エラー", "失敗", "できません", "見つかりません"]
            if any(kw in bot_output for kw in error_keywords):
                # エラーでも適切に説明していれば部分点
                if len(bot_output) > 20:
                    reward += 0.1
                else:
                    reward -= 0.2

            # 応答の長さチェック（適切な長さを評価）
            output_len = len(bot_output)
            if 10 <= output_len <= 200:
                reward += 0.2
            elif output_len > 500:
                reward -= 0.1  # 長すぎる応答

            # 絵文字使用（親しみやすさ）
            emoji_chars = ["✅", "📅", "⏰", "📝", "🔔", "👍"]
            if any(e in bot_output for e in emoji_chars):
                reward += 0.1

            # 正規化
            reward = max(min(reward, self.config.success_reward), self.config.failure_reward)

            return reward

        return reward_fn

    def run_optimization(
        self,
        training_data: List[Dict[str, Any]],
        num_iterations: int = 100,
        callback: Optional[Callable[[int, float], None]] = None,
    ) -> Dict[str, Any]:
        """
        強化学習による最適化を実行

        Args:
            training_data: トレーニングデータ
            num_iterations: イテレーション数
            callback: 進捗コールバック (iteration, reward) -> None

        Returns:
            最適化結果
        """
        print(f"Starting optimization with {len(training_data)} samples...")

        formatted_data = self.prepare_training_data(training_data)
        reward_fn = self.create_reward_function()

        results = {
            "start_time": datetime.now().isoformat(),
            "num_samples": len(training_data),
            "num_iterations": num_iterations,
            "rewards": [],
            "best_reward": float("-inf"),
            "final_prompts": {},
        }

        try:
            # Agent Lightning トレーサーを初期化
            with agl.Tracer(
                name="line_calendar_bot_optimization",
                metadata={
                    "model": self.config.model_name,
                    "samples": len(training_data),
                }
            ) as tracer:
                for iteration in range(num_iterations):
                    total_reward = 0.0

                    for item in formatted_data:
                        # ステップを発行
                        agl.emit_step(
                            name=f"train_{item.get('task_type', 'general')}",
                            input=item["messages"][1]["content"],
                            output=item["messages"][2]["content"],
                        )

                        # 報酬を計算して発行
                        reward = reward_fn(
                            item["messages"][1]["content"],
                            item["messages"][2]["content"],
                            {"task_type": item.get("task_type")},
                        )
                        agl.emit_reward(reward=reward)
                        total_reward += reward

                    avg_reward = total_reward / len(formatted_data) if formatted_data else 0
                    results["rewards"].append(avg_reward)

                    if avg_reward > results["best_reward"]:
                        results["best_reward"] = avg_reward

                    if callback:
                        callback(iteration, avg_reward)

                    if (iteration + 1) % 10 == 0:
                        print(f"Iteration {iteration + 1}/{num_iterations}, Avg Reward: {avg_reward:.4f}")

        except Exception as e:
            print(f"Warning: Agent Lightning optimization error: {e}")
            # フォールバック: 基本的な統計のみ計算
            for item in formatted_data:
                reward = reward_fn(
                    item["messages"][1]["content"],
                    item["messages"][2]["content"],
                    {"task_type": item.get("task_type")},
                )
                results["rewards"].append(reward)

            if results["rewards"]:
                results["best_reward"] = max(results["rewards"])

        results["end_time"] = datetime.now().isoformat()
        results["avg_final_reward"] = sum(results["rewards"][-10:]) / min(10, len(results["rewards"])) if results["rewards"] else 0

        # 結果を保存
        self._save_results(results)

        return results

    def _save_results(self, results: Dict[str, Any]):
        """最適化結果を保存"""
        results_dir = Path(self.config.data_dir) / "optimization_results"
        results_dir.mkdir(parents=True, exist_ok=True)

        filename = f"result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_dir / filename, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print(f"Results saved to {results_dir / filename}")

    def get_optimization_history(self) -> List[Dict[str, Any]]:
        """最適化履歴を取得"""
        results_dir = Path(self.config.data_dir) / "optimization_results"
        if not results_dir.exists():
            return []

        history = []
        for result_file in sorted(results_dir.glob("result_*.json")):
            with open(result_file, "r", encoding="utf-8") as f:
                history.append(json.load(f))

        return history


if __name__ == "__main__":
    # テスト実行
    from collector import DataCollector

    collector = DataCollector()

    # サンプルデータを追加
    test_data = [
        {
            "user_message": "明日の午後3時に会議を入れて",
            "bot_response": "✅ 明日の15:00に「会議」を登録しました。",
            "task_type": "calendar_create",
        },
        {
            "user_message": "今週の予定を教えて",
            "bot_response": "📅 今週の予定です:\n- 2/7 15:00 会議\n- 2/8 10:00 歯医者",
            "task_type": "calendar_query",
        },
        {
            "user_message": "買い物リストに牛乳を追加",
            "bot_response": "✅ タスク「牛乳を買う」を追加しました。",
            "task_type": "task_create",
        },
    ]

    for item in test_data:
        collector.record_interaction(
            user_id="test_user",
            task_type=item["task_type"],
            user_message=item["user_message"],
            bot_response=item["bot_response"],
        )

    # 最適化を実行
    optimizer = AgentOptimizer()
    training_data = collector.get_training_data()

    results = optimizer.run_optimization(
        training_data,
        num_iterations=10,
        callback=lambda i, r: print(f"  Progress: {i+1}/10, Reward: {r:.4f}"),
    )

    print("\n=== Optimization Results ===")
    print(f"Best Reward: {results['best_reward']:.4f}")
    print(f"Final Avg Reward: {results['avg_final_reward']:.4f}")
