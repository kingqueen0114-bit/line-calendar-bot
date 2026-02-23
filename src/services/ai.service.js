/**
 * Gemini APIで自然言語からイベント情報を抽出（リトライ付き）
 * @param {string} text - ユーザーの入力テキスト
 * @param {string} apiKey - Gemini API キー
 * @param {string} context - 直前のボット返信（文脈）
 */
export async function parseEventText(text, apiKey, context = null) {
  const maxRetries = 3;
  let delay = 1000; // 1秒

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini API attempt ${attempt}/${maxRetries}`);
      const result = await parseEventTextInternal(text, apiKey, context);
      if (result) {
        console.log('Gemini API success on attempt', attempt);
        return result;
      }
    } catch (error) {
      console.error(`Gemini API error on attempt ${attempt}:`, error);
      if (attempt < maxRetries) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  console.error('Gemini API failed after', maxRetries, 'attempts');
  return null;
}

/**
 * 内部処理用の実際のAPI呼び出し
 */
async function parseEventTextInternal(text, apiKey, context = null) {
  // 日本時間（JST）の現在日時を取得
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000; // 9時間
  const jstDate = new Date(now.getTime() + jstOffset);
  const todayString = jstDate.toLocaleDateString('ja-JP', { timeZone: 'UTC' });

  // 文脈がある場合はプロンプトに追加
  const contextSection = context ? `
【直前のボット返信（文脈）】
${context}

` : '';

  const prompt = `
以下のテキストから情報を抽出してください。
今日は${todayString}です。
${contextSection}
ユーザーの入力: "${text}"

以下のJSON形式で返してください（JSONのみ、説明不要）：
{
  "action": "create" / "list" / "cancel" / "update" / "complete",
  "type": "event" または "task",
  "keyword": "検索キーワード（list/cancel/update/completeの場合）",
  "targetNumber": 数字（単一番号指定の場合、例: 3）,
  "targetNumbers": [数字の配列]（複数番号指定の場合、例: [5, 6, 7]）,
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM" (予定の場合のみ),
  "endTime": "HH:MM" (予定の場合のみ),
  "title": "タイトル",
  "location": "場所（あれば）",
  "url": "URL（あれば）",
  "listName": "タスクリスト名（タスクの場合、あれば）",
  "starred": true/false (タスクの場合のみ、重要度判定)
}

重要な操作判定ルール：

**文脈を考慮した判定（最優先）:**
- 直前のボット返信に「一覧」「番号を入力」「番号を送信」などがある場合：
  - ユーザーが数字だけ入力 → その一覧からの選択と判断
  - 「キャンセル」「変更」「完了」に関する一覧なら、対応するactionとtargetNumberを設定
  - 例: 文脈「予定をキャンセル...1. 会議...番号を送信」+ 入力「2」→ action: "cancel", targetNumber: 2
  - 例: 文脈「タスク一覧...1. 牛乳...」+ 入力「1完了」→ action: "complete", targetNumber: 1
  - 例: 文脈「どの予定を変更...」+ 入力「3」→ action: "update", targetNumber: 3

**action の判定:**
- **最優先**: 「タスク」キーワード + 新規作成の内容がある場合は "create" にする
- "complete": タスクを完了/終了/終わり/済み/できた/やった にする場合
  - 例: 「3完了」→ action: "complete", type: "task", targetNumber: 3
  - 例: 「5,6,7完了」→ action: "complete", type: "task", targetNumbers: [5, 6, 7]
  - 例: 「1、3、5終了」→ action: "complete", type: "task", targetNumbers: [1, 3, 5]
  - 例: 「牛乳買った完了」→ action: "complete", type: "task", keyword: "牛乳買った"
  - 例: 「布団のやつ終わり」→ action: "complete", type: "task", keyword: "布団"
  - 例: 「掃除できた」→ action: "complete", type: "task", keyword: "掃除"
- "list": 「予定一覧」「今日の予定」「明日の予定」「今週の予定」「タスク一覧」などの表現
- "cancel": **既存の予定/タスクを削除/キャンセルする場合**
  - 予定の場合: 「ミーティングをキャンセル」「明日の飲み会を削除」
  - タスクの場合: 「3番削除」「牛乳のタスク削除」
  - 例: 「16キャンセル」→ action: "cancel", type: "event", targetNumber: 16
  - 例: 「3番削除」→ action: "cancel", targetNumber: 3（typeは文脈で判断）
- "update": 「変更」「時間変更」「〜に変更」「延期」「前倒し」などの表現
  - 例: 「変更」→ action: "update", keyword: null（予定一覧を表示）
  - 例: 「予定変更」→ action: "update", keyword: null
  - 例: 「3変更」→ action: "update", targetNumber: 3
  - 例: 「ミーティングを16時に変更」→ action: "update", keyword: "ミーティング", startTime: "16:00"
- "create": 上記以外の新規登録

**タスク/予定の判定（actionがcreateの場合のみ）:**
- タスク: 「タスク」キーワードが**明示的に含まれている**場合のみ
  例: 「タスク 牛乳を買う」「タスク レポート提出 期限2月10日」
  例: 「タスク サブスクキャンセル」→ action="create", type="task", title="サブスクキャンセル"
  例: 「タスク 予約変更」→ action="create", type="task", title="予約変更"
  **重要**: タイトルに「キャンセル」「削除」「変更」が含まれていても、「タスク」があればaction="create"
- 予定: 上記以外はすべて予定として扱う
  - 時刻がある場合: 通常の予定
  - 時刻がない場合: 終日予定として登録
  例: 「明日 会議」→ 終日予定
  例: 「3月1日 テスト」→ 終日予定
  例: 「2月5日 旅行」→ 終日予定

**タスクの重要度判定（starredフィールド、タスクの場合のみ）:**
- 以下の条件に該当する場合、starred: true を設定
  1. タイトルに「★」「⭐」「重要」「緊急」「必須」が含まれる
  2. 「〜しないと」「絶対」「必ず」「忘れずに」などの強い表現がある
  3. 期限が「今日」「明日」で緊急性が高い
  4. ビジネス上重要なイベント（「プレゼン」「納品」「締切」「提出」「発表」など）
  5. 金銭や契約に関わる（「支払い」「請求」「契約」「振込」など）
- 上記以外は starred: false
- 予定の場合はstarredフィールドは不要（nullまたは省略）

**キーワード抽出（list/cancel/updateの場合）:**
- 予定のタイトルや識別できる単語を抽出
- できるだけ具体的なキーワードを抽出すること
- **重要**: 「キャンセル」「削除」「変更」「予定」などのアクションワードのみの場合はkeywordをnullにする
  - 例: 「キャンセル」→ keyword: null（対象の予定名がない）
  - 例: 「予定削除」→ keyword: null
  - 例: 「予定変更」→ keyword: null
- 例: 「テスト会議をキャンセル」→ keyword: "テスト会議"
- 例: 「ミーティングを16時に変更」→ keyword: "ミーティング", startTime: "16:00"
- 例: 「明日の飲み会キャンセル」→ keyword: "飲み会", date: "明日の日付"
- 例: 「2月2日の美容室」→ keyword: "美容室", date: "2026-02-02"

**日付の抽出:**
- 「今日」「明日」「明後日」は具体的な日付に変換
- 「来週月曜」「次の金曜」なども具体的な日付に変換
- 「2月2日」「2/2」なども正しく解釈
- **重要**: 日付が指定されていない場合の扱い：
  - 予定の場合：今日の日付を使用
  - タスクの場合：date を null に設定（期限なしタスク）
  - 「期限なし」「いつか」「そのうち」などの表現がある場合も null

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
- タスクの場合：
  - dateは期限日（期限が明示されている場合のみ。なければnull）
  - startTimeとendTimeは常にnull
  - 例: 「タスク 掃除する」→ date: null（期限の記載なし）
  - 例: 「タスク レポート提出 期限2月10日」→ date: "2026-02-10"
- 日付が「明日」「来週月曜」などの場合は具体的な日付に変換
- 時刻は24時間形式で返すこと（例：14:00、22:30）
- 場所・URL・listNameが明示されていない場合はnull
`;

  try {
    console.log('Gemini API: Starting fetch request...');
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

    console.log('Gemini API: Fetch completed, status:', response.status);
    const data = await response.json();
    console.log('Gemini API: JSON parsed');
    
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
