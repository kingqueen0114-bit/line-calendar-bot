/**
 * Gemini APIで自然言語からイベント情報を抽出
 */
export async function parseEventText(text, apiKey) {
  const prompt = `
以下のテキストから情報を抽出してください。
今日は${new Date().toLocaleDateString('ja-JP')}です。

テキスト: "${text}"

以下のJSON形式で返してください（JSONのみ、説明不要）：
{
  "action": "create" / "list" / "cancel" / "update",
  "type": "event" または "task",
  "keyword": "検索キーワード（list/cancel/updateの場合）",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM" (予定の場合のみ),
  "endTime": "HH:MM" (予定の場合のみ),
  "title": "タイトル",
  "location": "場所（あれば）",
  "url": "URL（あれば）",
  "listName": "タスクリスト名（タスクの場合、あれば）"
}

重要な操作判定ルール：
**action の判定:**
- "list": 「予定一覧」「今日の予定」「明日の予定」「今週の予定」などの表現
- "cancel": 「キャンセル」「削除」「取り消し」「やめる」などの表現
- "update": 「変更」「時間変更」「〜に変更」「延期」「前倒し」などの表現
- "create": 上記以外の新規登録

**タスク/予定の判定（actionがcreateの場合のみ）:**
- タスク: 「タスク」キーワードが**明示的に含まれている**場合のみ
  例: 「タスク 牛乳を買う」「タスク レポート提出 期限2月10日」
- 予定: 上記以外はすべて予定として扱う
  - 時刻がある場合: 通常の予定
  - 時刻がない場合: 終日予定として登録
  例: 「明日 会議」→ 終日予定
  例: 「3月1日 テスト」→ 終日予定
  例: 「2月5日 旅行」→ 終日予定

**キーワード抽出（list/cancel/updateの場合）:**
- 予定のタイトルや識別できる単語を抽出
- できるだけ具体的なキーワードを抽出すること
- 例: 「テスト会議をキャンセル」→ keyword: "テスト会議"
- 例: 「ミーティングを16時に変更」→ keyword: "ミーティング", startTime: "16:00"
- 例: 「明日の飲み会キャンセル」→ keyword: "飲み会", date: "明日の日付"
- 例: 「2月2日の美容室」→ keyword: "美容室", date: "2026-02-02"

**日付の抽出:**
- 「今日」「明日」「明後日」は具体的な日付に変換
- 「来週月曜」「次の金曜」なども具体的な日付に変換
- 「2月2日」「2/2」なども正しく解釈
- 日付が指定されていない場合は、今日の日付を使用

**updateアクションの重要なルール:**
- 「〜時を〜時に変更」「〜時に変更」の場合、startTimeには**新しい時刻のみ**を設定すること
- endTimeはstartTimeの1時間後を設定すること（デフォルト）
- 例: 「15時を19時に変更」→ startTime: "19:00", endTime: "20:00"
- 例: 「デバックテストを19時に変更」→ startTime: "19:00", endTime: "20:00"
- 例: 「明日14時のミーティングを16時に」→ keyword: "ミーティング", date: "明日", startTime: "16:00", endTime: "17:00"
- 元の時刻（この例では15時や14時）は無視してください

**キーワード抽出の重要なポイント:**
- 日付や時刻の表現は除外し、予定の本質的なタイトルのみを抽出
- 例: 「2月2日15時のデバックテスト」→ keyword: "デバックテスト" (「2月2日15時」は含めない)
- 例: 「明日の美容室」→ keyword: "美容室" (「明日」は含めない)

その他の注意事項：
- 予定の場合：終了時刻が指定されていない場合は、開始時刻の1時間後を設定
- タスクの場合：dateは期限日、startTimeとendTimeはnull
- 日付が「明日」「来週月曜」などの場合は具体的な日付に変換
- 時刻は24時間形式で返すこと（例：14:00、22:30）
- 場所・URL・listNameが明示されていない場合はnull
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    const data = await response.json();
    
    // エラーチェック
    if (!response.ok || !data.candidates || data.candidates.length === 0) {
      console.error('Gemini API Error Response:', JSON.stringify(data));
      return null;
    }
    
    const resultText = data.candidates[0].content.parts[0].text;
    console.log('Gemini API Response Text:', resultText); // デバッグ用
    
    // JSONを抽出（マークダウンコードブロック対応）
    const jsonMatch = resultText.match(/```json\n([\s\S]*?)\n```/) || 
                      resultText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonText);
    }
    
    throw new Error('JSON解析失敗');
  } catch (error) {
    console.error('Gemini API Error:', error);
    return null;
  }
}
