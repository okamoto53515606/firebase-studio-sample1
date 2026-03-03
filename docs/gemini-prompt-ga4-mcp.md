# Firebase Studio Gemini 修正依頼プロンプト（GA4 MCP追加）

以下をFirebase StudioのGeminiチャットにコピー&ペーストしてください。

---

## プロンプト本文

```
既存のAIデータ分析エージェントに、GA4（Google Analytics 4）のデータ参照機能を追加してください。
MCP（Model Context Protocol）を利用して、GA4 MCPサーバーからツールを取得し、エージェントが利用できるようにします。

## 概要
現在のエージェントはBigQueryのみ参照可能ですが、GA4のデータも自然言語で質問・分析できるようにします。
Genkitの `@genkit-ai/mcp` プラグインを使い、`mcp-server-ga4` にstdio接続してGA4ツールを取得します。

## 技術スタック（追加分）
- `@genkit-ai/mcp` ← 新規追加
- `mcp-server-ga4` ← npx経由でstdio起動（npm installは不要）

## 要件

### 1. パッケージ追加 (`package.json`)
- `@genkit-ai/mcp` を dependencies に追加

### 2. MCP Host 設定 (`src/ai/mcp.ts` を新規作成)
- `createMcpHost` を使って GA4 MCPサーバーへの接続を定義
- stdio方式で `mcp-server-ga4` を起動
- 環境変数からGA4設定を渡す
- MCPホストのライフサイクル管理（初期化・クローズ）のヘルパーを提供

参考実装:
```typescript
import { createMcpHost } from '@genkit-ai/mcp';

function buildGa4Env(): Record<string, string> {
  const env: Record<string, string> = {};
  if (process.env.GA_PROPERTY_ID) {
    env.GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  return env;
}

export const mcpHost = createMcpHost({
  name: 'ga4McpHost',
  mcpServers: {
    ga4: {
      command: 'npx',
      args: ['-y', 'mcp-server-ga4'],
      env: buildGa4Env(),
    },
  },
});
```

### 3. エージェントフロー修正 (`src/ai/agent.ts`)
- MCPホストからGA4ツールを取得し、既存のBigQueryツールと合わせてエージェントに渡す
- `mcpHost.getActiveTools(ai)` でGA4ツール一覧を取得
- `ai.generate()` の `tools` 配列にBigQueryツールとGA4ツールの両方を含める
- 処理完了後に `mcpHost.close()` を呼ぶ（リソースリーク防止）
- システムプロンプトにGA4データの参照手順を追加

参考: エージェントフローの修正イメージ
```typescript
import { mcpHost } from '@/ai/mcp';

// agent flow の中:
const ga4Tools = await mcpHost.getActiveTools(ai);
const allTools = [bigQueryTool, listDatasetsTool, ...ga4Tools];

try {
  const response = await ai.generate({
    system: systemPrompt,
    prompt: input.query,
    tools: allTools,
    maxTurns: 10,
  });
  return { answer: response.text };
} finally {
  await mcpHost.close();
}
```

### 4. システムプロンプト修正 (`src/ai/agent.ts` 内)
以下の内容をシステムプロンプトに追記:
- GA4（Google Analytics 4）のデータにもアクセスできること
- GA4のツール（ga4/で始まるツール群）を使ってページビュー、ユーザー行動、イベント等を取得できること
- ユーザーがアクセス解析やWebサイト分析に関する質問をした場合はGA4ツールを使用すること
- BigQueryとGA4の両方のデータを組み合わせた分析も可能であること

### 5. 環境変数 (`.env` に追加済)
```
GA_PROPERTY_ID=your-ga4-property-id
```
- `GOOGLE_APPLICATION_CREDENTIALS` はADCで認証する環境（Firebase Studio等）では不要。設定されている場合のみMCPサーバーに渡す

### 6. テストスクリプト更新
- `scripts/test-agent.ts` にGA4関連の質問テストケースを追加
  - 例: 「今日のアクティブユーザー数を教えて」「過去7日間のページビュー推移は？」

### 7. チャットUIの変更
- UI側の変更は不要（エージェントが自動的にGA4ツールを使い分ける）
- ただし、プレースホルダーテキストに「例: 今日のアクティブユーザー数は？」等のGA4関連の質問例を追加

## 注意事項
- `src/ai/genkit.ts` は変更不要
- `mcp-server-ga4` は npx 経由で起動するため npm install 不要
- GA4 MCPサーバーのツールは `ga4/` というプレフィックスで名前空間が区切られる
- MCPホストは毎回のリクエストでcloseし、次のリクエストで再生成する設計にするか、アプリケーションレベルでシングルトンにするかはパフォーマンスを考慮して判断してよい
- BigQueryツール（直接定義）とGA4ツール（MCP経由）は共存可能
```

---
