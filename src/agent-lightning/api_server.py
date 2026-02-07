#!/usr/bin/env python3
"""
Agent Lightning API Server
Node.js LINE Bot から呼び出すための REST API
"""

import json
import os
from datetime import datetime
from typing import Optional
from flask import Flask, request, jsonify
from flask_cors import CORS

from config import AgentLightningConfig, TASK_TYPES
from collector import DataCollector, get_collector
from optimizer import AgentOptimizer, LineCalendarAgent

app = Flask(__name__)
CORS(app)

# グローバルインスタンス
config = AgentLightningConfig.from_env()
collector = get_collector()
optimizer = AgentOptimizer(config)
agent = LineCalendarAgent(config)


@app.route("/health", methods=["GET"])
def health_check():
    """ヘルスチェック"""
    return jsonify({
        "status": "healthy",
        "service": "agent-lightning",
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/api/record", methods=["POST"])
def record_interaction():
    """
    インタラクションを記録

    Request Body:
    {
        "user_id": "string",
        "task_type": "string",
        "user_message": "string",
        "bot_response": "string",
        "context": {} (optional),
        "reward": float (optional)
    }
    """
    data = request.json

    required_fields = ["user_id", "task_type", "user_message", "bot_response"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    try:
        interaction_id = collector.record_interaction(
            user_id=data["user_id"],
            task_type=data["task_type"],
            user_message=data["user_message"],
            bot_response=data["bot_response"],
            context=data.get("context"),
            reward=data.get("reward"),
        )

        return jsonify({
            "success": True,
            "interaction_id": interaction_id,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reward", methods=["POST"])
def set_reward():
    """
    インタラクションに報酬を設定

    Request Body:
    {
        "interaction_id": "string",
        "reward": float,
        "feedback": "string" (optional)
    }
    """
    data = request.json

    if "interaction_id" not in data or "reward" not in data:
        return jsonify({"error": "Missing interaction_id or reward"}), 400

    try:
        collector.set_reward(
            interaction_id=data["interaction_id"],
            reward=data["reward"],
            feedback=data.get("feedback"),
        )

        return jsonify({"success": True})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats", methods=["GET"])
def get_statistics():
    """データ統計を取得"""
    try:
        stats = collector.get_statistics()
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/prompt", methods=["GET"])
def get_prompt():
    """
    最適化済みプロンプトを取得

    Query Parameters:
        task_type: タスクの種類 (optional)
    """
    task_type = request.args.get("task_type")

    try:
        prompt = agent.get_system_prompt(task_type)
        return jsonify({
            "task_type": task_type or "default",
            "prompt": prompt,
            "is_optimized": task_type in agent.optimized_prompts if task_type else False,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/optimize", methods=["POST"])
def run_optimization():
    """
    最適化を実行

    Request Body:
    {
        "num_iterations": int (optional, default: 100),
        "min_reward": float (optional)
    }
    """
    data = request.json or {}
    num_iterations = data.get("num_iterations", 100)
    min_reward = data.get("min_reward")

    try:
        training_data = collector.get_training_data(min_reward=min_reward)

        if not training_data:
            return jsonify({
                "error": "No training data available",
                "suggestion": "Record some interactions first using /api/record"
            }), 400

        results = optimizer.run_optimization(
            training_data,
            num_iterations=num_iterations,
        )

        return jsonify({
            "success": True,
            "results": {
                "num_samples": results["num_samples"],
                "best_reward": results["best_reward"],
                "avg_final_reward": results["avg_final_reward"],
                "start_time": results["start_time"],
                "end_time": results["end_time"],
            },
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/export", methods=["GET"])
def export_data():
    """トレーニングデータをエクスポート"""
    try:
        output_path = collector.export_for_training()
        training_data = collector.get_training_data()

        return jsonify({
            "success": True,
            "output_path": output_path,
            "num_samples": len(training_data),
            "statistics": collector.get_statistics(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/history", methods=["GET"])
def get_optimization_history():
    """最適化履歴を取得"""
    try:
        history = optimizer.get_optimization_history()
        return jsonify({
            "history": history,
            "total_runs": len(history),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/task-types", methods=["GET"])
def get_task_types():
    """利用可能なタスクタイプを取得"""
    return jsonify({
        "task_types": TASK_TYPES,
    })


@app.route("/api/analyze", methods=["POST"])
def analyze_response():
    """
    応答を分析して報酬を推定

    Request Body:
    {
        "user_message": "string",
        "bot_response": "string",
        "task_type": "string" (optional)
    }
    """
    data = request.json

    if "user_message" not in data or "bot_response" not in data:
        return jsonify({"error": "Missing user_message or bot_response"}), 400

    try:
        reward_fn = optimizer.create_reward_function()
        reward = reward_fn(
            data["user_message"],
            data["bot_response"],
            {"task_type": data.get("task_type")},
        )

        # 詳細な分析
        analysis = {
            "reward": reward,
            "reward_level": "excellent" if reward > 0.7 else "good" if reward > 0.3 else "needs_improvement" if reward > 0 else "poor",
            "response_length": len(data["bot_response"]),
            "has_success_indicator": any(kw in data["bot_response"] for kw in ["完了", "登録", "作成", "設定"]),
            "has_error_indicator": any(kw in data["bot_response"] for kw in ["エラー", "失敗", "できません"]),
            "has_emoji": any(e in data["bot_response"] for e in ["✅", "📅", "⏰", "📝", "🔔"]),
        }

        return jsonify(analysis)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def main():
    """サーバーを起動"""
    print(f"Starting Agent Lightning API Server...")
    print(f"  Host: {config.api_host}")
    print(f"  Port: {config.api_port}")
    print(f"  Data directory: {config.data_dir}")

    app.run(
        host=config.api_host,
        port=config.api_port,
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )


if __name__ == "__main__":
    main()
