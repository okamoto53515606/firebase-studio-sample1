# Firebase Studio Gemini 修正依頼プロンプト（GA4 INVALID_ARGUMENT エラー修正）

以下をFirebase StudioのGeminiチャットにコピー&ペーストしてください。

---

## プロンプト本文

```
GA4 MCPツールを呼び出すと `MCP error -32603: Google Analytics API error: 3 INVALID_ARGUMENT` が発生します。LLMがGA4ツールに渡すパラメータの形式が正しくないのが原因です。

以下の2点を修正してください。

## 修正1: システムプロンプトにGA4ツールの正しいパラメータ形式を追記

`src/ai/agent.ts` のシステムプロンプトに、GA4ツールの正確な使い方を追加してください。
LLMがパラメータ形式を間違えないよう、各ツールの具体的な呼び出し例を含めます。

以下をシステムプロンプトのGA4セクションに追記してください:

```
GA4ツールの正しいパラメータ形式:

■ ga4/getActiveUsers
  - startDate: "YYYY-MM-DD" 形式の文字列
  - endDate: "YYYY-MM-DD" 形式の文字列
  例: { "startDate": "2026-03-04", "endDate": "2026-03-04" }

■ ga4/getPageViews
  - startDate: "YYYY-MM-DD" 形式の文字列
  - endDate: "YYYY-MM-DD" 形式の文字列
  - dimensions: （オプション）文字列の配列。例: ["pagePath", "date"]
  例: { "startDate": "2026-02-25", "endDate": "2026-03-04", "dimensions": ["date"] }

■ ga4/getEvents
  - startDate: "YYYY-MM-DD" 形式の文字列
  - endDate: "YYYY-MM-DD" 形式の文字列
  - eventName: （オプション）特定のイベント名。例: "page_view"
  例: { "startDate": "2026-02-25", "endDate": "2026-03-04" }

■ ga4/getUserBehavior
  - startDate: "YYYY-MM-DD" 形式の文字列
  - endDate: "YYYY-MM-DD" 形式の文字列
  例: { "startDate": "2026-02-25", "endDate": "2026-03-04" }

■ ga4/runReport（最も汎用的。上記ツールで対応できない場合に使用）
  - startDate: "YYYY-MM-DD" 形式の文字列
  - endDate: "YYYY-MM-DD" 形式の文字列
  - metrics: オブジェクト配列。各要素は {"name": "メトリクス名"} の形式
    例: [{"name": "activeUsers"}, {"name": "sessions"}]
  - dimensions: オブジェクト配列。各要素は {"name": "ディメンション名"} の形式
    例: [{"name": "date"}, {"name": "country"}]
  - dimensionFilter: （オプション）ディメンションでのフィルタ
  例: { "startDate": "2026-02-25", "endDate": "2026-03-04", "metrics": [{"name": "screenPageViews"}], "dimensions": [{"name": "date"}] }

重要な注意:
- ga4/runReport の metrics と dimensions は文字列ではなくオブジェクト配列（{"name": "xxx"}）です
- ga4/getPageViews の dimensions は文字列配列（["date"]）です（runReportとは形式が異なります）
- 日付は必ず "YYYY-MM-DD" 形式にしてください
- 「今日」「過去7日」などの相対的な期間は、今日の日付から計算して具体的なYYYY-MM-DD形式に変換してください
- ga4/runReport よりも、目的に合った専用ツール（getActiveUsers, getPageViews, getEvents, getUserBehavior）を優先して使ってください
```

## 修正2: GA4ツール呼び出しのデバッグログ追加

GA4 MCPツールが実際にどのようなパラメータで呼ばれているかを確認するため、
ツール呼び出しのログを追加してください。

### 方法A（推奨）: ai.generate の toolCallHook を使う

もし Genkit の `ai.generate()` に `onToolCall` や類似のフックがあれば、それを使ってツール呼び出しをログ出力してください。

### 方法B: agentのcatch内でログ強化

`src/ai/agent.ts` のエラーハンドリングで、エラーメッセージに加えてスタックトレース全体をログ出力してください（現状のコードで既にやっているなら十分です）。

### 方法C: MCPツール呼び出しのラッパー（確実だが手間）

もしフックが使えない場合は、MCPツールをラッパーで包んでログ出力してください:

```typescript
// agent.ts 内、GA4ツール取得後
const ga4ToolsWithLogging = ga4Tools.map(tool => {
  const action = (tool as any).__action;
  const originalFn = tool;
  const name = action?.name || 'unknown';
  
  // ツールの実行をラップしてログ出力（構造を壊さないよう注意）
  // この方法が技術的に不可能な場合はスキップしてよい
  return tool;
});
```

もし上記のいずれも難しい場合は、少なくとも以下のログだけ追加してください:
- `ai.generate()` のレスポンスオブジェクトからツール呼び出し履歴が取得できる場合はそれをログ出力
  ```typescript
  const response = await ai.generate({...});
  console.log('[Agent] Tool calls in response:', JSON.stringify(response.toolRequests, null, 2));
  ```


## 修正対象ファイル
- `src/ai/agent.ts` （システムプロンプト修正 + ログ追加）

## 修正後の期待動作
1. LLMがGA4ツールを正しいパラメータ形式で呼び出すようになり、INVALID_ARGUMENTエラーが解消
2. GAに関する質問（アクティブユーザー、PV等）がGA4ツール経由で正常に回答される
3. GA4ツール呼び出し時のパラメータがサーバーログに出力される
```

---
