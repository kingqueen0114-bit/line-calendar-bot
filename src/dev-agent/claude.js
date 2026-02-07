/**
 * Claude API integration for code generation
 * Uses Anthropic API to generate code and analyze issues
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Send a message to Claude API
 */
async function sendMessage(messages, system = '', maxTokens = 4096) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Analyze an issue and create an implementation plan
 */
export async function analyzeIssue(issue, repoContext) {
  const system = `あなたは経験豊富なソフトウェアエンジニアです。
GitHubのイシューを分析し、実装計画を立ててください。

リポジトリのコンテキスト:
- プロジェクト名: ${repoContext.name}
- 言語: JavaScript (Node.js)
- フレームワーク: Express.js
- 主要なファイル構造:
${repoContext.structure}

レスポンスは以下のJSON形式で返してください:
{
  "analysis": "イシューの要約と理解",
  "approach": "実装アプローチの説明",
  "files_to_modify": ["変更が必要なファイルのリスト"],
  "files_to_create": ["新規作成が必要なファイルのリスト"],
  "estimated_complexity": "low|medium|high",
  "implementation_steps": ["具体的な実装ステップのリスト"],
  "risks": ["潜在的なリスクや注意点"]
}`;

  const userMessage = `以下のイシューを分析してください:

タイトル: ${issue.title}

説明:
${issue.description}

イシュータイプ: ${issue.type}
優先度: ${issue.priority}`;

  const response = await sendMessage([{ role: 'user', content: userMessage }], system);

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Failed to parse analysis response:', error);
    return {
      analysis: response,
      approach: 'Unable to parse structured response',
      files_to_modify: [],
      files_to_create: [],
      estimated_complexity: 'unknown',
      implementation_steps: [],
      risks: ['Failed to generate structured analysis']
    };
  }
}

/**
 * Generate code changes for a specific file
 */
export async function generateCode(task, fileContext, plan) {
  const system = `あなたは経験豊富なソフトウェアエンジニアです。
指定されたタスクに基づいてコードを生成してください。

重要なルール:
1. 既存のコードスタイルに合わせる
2. セキュリティベストプラクティスに従う
3. エラーハンドリングを適切に行う
4. 必要に応じてコメントを追加
5. ES Modules (import/export) を使用

レスポンスは以下のJSON形式で返してください:
{
  "files": [
    {
      "path": "ファイルパス",
      "action": "create|modify|delete",
      "content": "ファイルの完全な内容（modify/createの場合）",
      "changes_description": "変更内容の説明"
    }
  ],
  "commit_message": "コミットメッセージ",
  "pr_description": "PRの説明"
}`;

  const userMessage = `以下のタスクを実装してください:

タスク: ${task.title}
説明: ${task.description}
タイプ: ${task.type}

実装計画:
${JSON.stringify(plan, null, 2)}

関連ファイルの現在の内容:
${fileContext.map(f => `
=== ${f.path} ===
${f.content}
`).join('\n')}

上記の計画に基づいて、必要なコード変更を生成してください。`;

  const response = await sendMessage(
    [{ role: 'user', content: userMessage }],
    system,
    8192
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Failed to parse code generation response:', error);
    throw new Error('Failed to generate code: ' + error.message);
  }
}

/**
 * Review generated code for issues
 */
export async function reviewCode(files, task) {
  const system = `あなたはシニアコードレビュアーです。
生成されたコードをレビューし、問題点や改善点を指摘してください。

レスポンスは以下のJSON形式で返してください:
{
  "approved": true/false,
  "issues": [
    {
      "severity": "critical|warning|suggestion",
      "file": "ファイルパス",
      "line": 行番号（わかる場合）,
      "description": "問題の説明",
      "suggestion": "修正案"
    }
  ],
  "summary": "レビューの要約"
}`;

  const userMessage = `以下のコード変更をレビューしてください:

タスク: ${task.title}
説明: ${task.description}

生成されたファイル:
${files.map(f => `
=== ${f.path} (${f.action}) ===
${f.content || '(削除)'}
`).join('\n')}

セキュリティ、パフォーマンス、コード品質の観点からレビューしてください。`;

  const response = await sendMessage([{ role: 'user', content: userMessage }], system);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Failed to parse review response:', error);
    return {
      approved: false,
      issues: [{ severity: 'warning', description: 'Failed to parse review' }],
      summary: 'Review parsing failed'
    };
  }
}

/**
 * Generate a PR description
 */
export async function generatePRDescription(task, changes, plan) {
  const system = `あなたはテクニカルライターです。
Pull Requestの説明文を生成してください。

フォーマット:
## Summary
簡潔な要約（2-3文）

## Changes
変更点のリスト

## Testing
テスト方法

## Notes
その他の注意点`;

  const userMessage = `以下のタスクに対するPR説明文を生成してください:

タスク: ${task.title}
説明: ${task.description}

実装計画:
${JSON.stringify(plan, null, 2)}

変更ファイル:
${changes.files.map(f => `- ${f.path}: ${f.changes_description}`).join('\n')}`;

  return sendMessage([{ role: 'user', content: userMessage }], system, 1024);
}

/**
 * Analyze error and suggest fix
 */
export async function analyzeError(error, context) {
  const system = `あなたはデバッグの専門家です。
エラーを分析し、修正案を提案してください。

レスポンスは以下のJSON形式で返してください:
{
  "error_type": "エラーの種類",
  "root_cause": "根本原因の分析",
  "fix_suggestion": "修正案",
  "code_fix": "修正コード（該当する場合）"
}`;

  const userMessage = `以下のエラーを分析してください:

エラー:
${error}

コンテキスト:
${context}`;

  const response = await sendMessage([{ role: 'user', content: userMessage }], system);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return raw response if parsing fails
  }

  return { analysis: response };
}
