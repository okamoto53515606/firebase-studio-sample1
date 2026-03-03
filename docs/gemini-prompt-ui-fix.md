# Firebase Studio Gemini 修正依頼プロンプト（画面動作しない問題の修正）

以下をFirebase StudioのGeminiチャットにコピー&ペーストしてください。

---

## プロンプト本文

```
画面（チャットUI）からエージェントを呼び出すと正しく動作しない問題があります。
`npx tsx scripts/test-agent.ts` では動くのに画面だと動かない状態です。
以下の2つの原因を修正し、デバッグ用の詳細ログも追加してください。

## 原因1: APIルートの引数の渡し方が間違っている

`src/app/api/agent/route.ts` で:
```typescript
const result = await dataAgent(query); // ← 文字列を直接渡している
```

`dataAgent` は `ai.defineFlow` で定義されており、入力スキーマは `z.object({ query: z.string() })` です。
テストスクリプトでは `dataAgent({ query: queryText })` とオブジェクトで渡しています。
しかしAPIルートでは文字列をそのまま渡しているため、フロー内の `input.query` が `undefined` になります。

### 修正
```typescript
const result = await dataAgent({ query }); // ← オブジェクトで渡す
```

## 原因2: MCPホストのライフサイクル管理

現在 `agent.ts` の `finally` で毎回 `mcpHost.close()` を呼んでいます。
これにより1回目のリクエスト後にMCPサーバー（GA4）が終了し、2回目以降GA4ツールが取得できなくなります。

### 修正方針
`mcpHost.close()` を毎回呼ばず、MCPホストをアプリケーションライフサイクルで管理してください。

- `src/ai/mcp.ts` で `mcpHost` をモジュールレベルのシングルトンとして維持
- `src/ai/agent.ts` の `finally` ブロックから `mcpHost.close()` を削除
- MCPサーバーは Node.js プロセスが終了するときに自然に終了するので問題なし

## 追加要件: 詳細ログの出力

画面からの呼び出し時にも問題を追跡できるよう、以下のログを追加してください。

### APIルート (`src/app/api/agent/route.ts`)
- リクエスト受信時: `console.log('[API] Received query:', query)`
- レスポンス返却時: `console.log('[API] Sending response, answer length:', result.answer?.length)`
- エラー時: `console.error('[API] Error:', error.message, error.stack)`

### エージェントフロー (`src/ai/agent.ts`)
- フロー開始時: `console.log('[Agent] Starting flow with query:', input.query)`
- MCPツール取得後: `console.log('[Agent] GA4 tools:', ga4ToolNames.join(', ') || 'none')`（既存ログを活用）
- ツール合計数: `console.log('[Agent] Total tools:', allTools.length, '(BQ:', 2, '+ GA4:', ga4Tools.length, ')')`
- `ai.generate()` 呼び出し前: `console.log('[Agent] Calling ai.generate...')`
- 応答取得後: `console.log('[Agent] Response received, length:', response.text?.length)`
- エラー時: `console.error('[Agent] Error:', error.message, error.stack)`

### MCPホスト (`src/ai/mcp.ts`)
- MCP初期化時のログ（既存があればそのまま）

## 修正対象ファイル
- `src/app/api/agent/route.ts` （引数修正 + ログ追加）
- `src/ai/agent.ts` （finally の mcpHost.close() 削除 + ログ追加）

## 修正後の期待動作
1. 画面からの質問がエージェントに正しく渡される
2. 複数回の質問でもGA4ツールが毎回利用可能
3. サーバーログに処理の各ステップが出力され、問題追跡が容易
```

---
