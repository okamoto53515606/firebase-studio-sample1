# 修正依頼: GA4ツールが使われない問題の修正

## 背景・問題

`test-ga4-direct.ts` でGA4 MCP ツールを直接テストした結果、APIは正常に動作しています。
しかし、LLMがGA4ツールを一切呼び出さず、すべてBigQueryで回答しています。

テスト結果サマリ:
- ga4/getActiveUsers → 成功
- ga4/getPageViews（dimensionsなし） → INVALID_ARGUMENT（dimensionsが必須）
- ga4/getPageViews（dimensionsあり） → 成功
- ga4/getEvents → 成功
- ga4/getUserBehavior → 成功
- ga4/runReport（オブジェクト配列） → 成功

## 修正方針

GA4 MCPツールを直接LLMに渡すのではなく、シンプルなラッパーツールを `ai.defineTool` で定義し、内部でMCPツールを呼び出す方式に変更します。これによりLLMが理解しやすいスキーマになり、GA4ツールが確実に選択されるようになります。

## 修正対象ファイル

### 1. `src/ai/tools/ga4.ts` (新規作成)

GA4 MCP ツールのラッパーを定義するファイルです。MCPホストからツールを取得し、シンプルなGenkit toolとしてラップします。

```typescript
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { mcpHost } from '@/ai/mcp';
import { patchSchema } from '@/ai/mcp-schema-fix';

// MCPツールのキャッシュ
let cachedMcpTools: any[] | null = null;

async function getMcpTools() {
  if (!cachedMcpTools) {
    const tools = await mcpHost.getActiveTools(ai);
    // スキーマパッチ
    for (const tool of tools) {
      const action = (tool as any).__action;
      if (action?.metadata?.inputSchema) {
        action.metadata.inputSchema = patchSchema(action.metadata.inputSchema);
      }
      if (action?.inputJsonSchema) {
        action.inputJsonSchema = patchSchema(action.inputJsonSchema);
      }
    }
    cachedMcpTools = tools;
  }
  return cachedMcpTools;
}

async function callMcpTool(toolName: string, params: any): Promise<any> {
  const tools = await getMcpTools();
  const tool = tools.find((t: any) => {
    const name = t.__action?.name || '';
    return name === toolName || name.endsWith('/' + toolName);
  });
  if (!tool) {
    throw new Error(`GA4 tool not found: ${toolName}`);
  }
  return await tool(params);
}

/**
 * GA4 アクティブユーザー数を取得するツール。
 * Webサイトやアプリの利用者数を知りたいときに使います。
 */
export const ga4ActiveUsersTool = ai.defineTool(
  {
    name: 'getGA4ActiveUsers',
    description:
      'Google Analytics 4からアクティブユーザー数と新規ユーザー数を取得します。Webサイトの訪問者数やユーザー数に関する質問に使ってください。日付範囲を指定します。',
    inputSchema: z.object({
      startDate: z.string().describe('開始日 (YYYY-MM-DD形式)。例: "2026-03-01"'),
      endDate: z.string().describe('終了日 (YYYY-MM-DD形式)。例: "2026-03-04"'),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      console.log('[GA4] getActiveUsers:', JSON.stringify(input));
      const result = await callMcpTool('ga4/getActiveUsers', {
        startDate: input.startDate,
        endDate: input.endDate,
      });
      console.log('[GA4] getActiveUsers result:', JSON.stringify(result).substring(0, 500));
      return result;
    } catch (e: any) {
      console.error('[GA4] getActiveUsers error:', e.message);
      return { error: e.message };
    }
  }
);

/**
 * GA4 ページビュー数を取得するツール。
 * 注意: dimensions は内部で必ず付与する（APIが要求するため）
 */
export const ga4PageViewsTool = ai.defineTool(
  {
    name: 'getGA4PageViews',
    description:
      'Google Analytics 4からページビュー数（PV数）を取得します。Webサイトのページ閲覧数やアクセス数に関する質問に使ってください。',
    inputSchema: z.object({
      startDate: z.string().describe('開始日 (YYYY-MM-DD形式)'),
      endDate: z.string().describe('終了日 (YYYY-MM-DD形式)'),
      dimensions: z
        .array(z.string())
        .optional()
        .describe('グループ化するディメンション。例: ["date", "pagePath"]。省略時は "date" が自動的に使われます。'),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      // dimensionsが未指定の場合、["date"]をデフォルトとして必ず付与（GA4 APIがdimensionsを要求するため）
      const dimensions = input.dimensions && input.dimensions.length > 0 ? input.dimensions : ['date'];
      console.log('[GA4] getPageViews:', JSON.stringify({ ...input, dimensions }));
      const result = await callMcpTool('ga4/getPageViews', {
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions,
      });
      console.log('[GA4] getPageViews result:', JSON.stringify(result).substring(0, 500));
      return result;
    } catch (e: any) {
      console.error('[GA4] getPageViews error:', e.message);
      return { error: e.message };
    }
  }
);

/**
 * GA4 イベントデータを取得するツール。
 */
export const ga4EventsTool = ai.defineTool(
  {
    name: 'getGA4Events',
    description:
      'Google Analytics 4からイベントデータ（page_view, click, scrollなど）を取得します。Webサイトで発生したイベントやユーザーアクションに関する質問に使ってください。',
    inputSchema: z.object({
      startDate: z.string().describe('開始日 (YYYY-MM-DD形式)'),
      endDate: z.string().describe('終了日 (YYYY-MM-DD形式)'),
      eventName: z.string().optional().describe('特定のイベント名でフィルタ。例: "page_view", "click"'),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      console.log('[GA4] getEvents:', JSON.stringify(input));
      const params: any = {
        startDate: input.startDate,
        endDate: input.endDate,
      };
      if (input.eventName) {
        params.eventName = input.eventName;
      }
      const result = await callMcpTool('ga4/getEvents', params);
      console.log('[GA4] getEvents result:', JSON.stringify(result).substring(0, 500));
      return result;
    } catch (e: any) {
      console.error('[GA4] getEvents error:', e.message);
      return { error: e.message };
    }
  }
);

/**
 * GA4 ユーザー行動データを取得するツール。
 */
export const ga4UserBehaviorTool = ai.defineTool(
  {
    name: 'getGA4UserBehavior',
    description:
      'Google Analytics 4からユーザー行動データ（平均セッション時間、直帰率、セッション/ユーザー）を取得します。ユーザーの行動パターンやエンゲージメントに関する質問に使ってください。',
    inputSchema: z.object({
      startDate: z.string().describe('開始日 (YYYY-MM-DD形式)'),
      endDate: z.string().describe('終了日 (YYYY-MM-DD形式)'),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      console.log('[GA4] getUserBehavior:', JSON.stringify(input));
      const result = await callMcpTool('ga4/getUserBehavior', {
        startDate: input.startDate,
        endDate: input.endDate,
      });
      console.log('[GA4] getUserBehavior result:', JSON.stringify(result).substring(0, 500));
      return result;
    } catch (e: any) {
      console.error('[GA4] getUserBehavior error:', e.message);
      return { error: e.message };
    }
  }
);

/**
 * GA4 カスタムレポートツール。
 * 上記の専用ツールで対応できない高度なクエリに使用。
 */
export const ga4RunReportTool = ai.defineTool(
  {
    name: 'runGA4Report',
    description:
      'Google Analytics 4のカスタムレポートを実行します。任意のメトリクスとディメンションの組み合わせで分析できます。専用ツール（getGA4ActiveUsers等）で対応できない場合に使ってください。',
    inputSchema: z.object({
      startDate: z.string().describe('開始日 (YYYY-MM-DD形式)'),
      endDate: z.string().describe('終了日 (YYYY-MM-DD形式)'),
      metrics: z
        .array(z.string())
        .describe(
          'メトリクス名の配列。例: ["activeUsers", "sessions", "screenPageViews"]'
        ),
      dimensions: z
        .array(z.string())
        .describe(
          'ディメンション名の配列。例: ["date", "country", "pagePath"]'
        ),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      // ラッパーツール内でオブジェクト配列に変換（LLMは文字列配列で指定すればOK）
      const metrics = input.metrics.map((m) => ({ name: m }));
      const dimensions = input.dimensions.map((d) => ({ name: d }));
      console.log('[GA4] runReport:', JSON.stringify({ ...input, metrics, dimensions }));
      const result = await callMcpTool('ga4/runReport', {
        startDate: input.startDate,
        endDate: input.endDate,
        metrics,
        dimensions,
      });
      console.log('[GA4] runReport result:', JSON.stringify(result).substring(0, 500));
      return result;
    } catch (e: any) {
      console.error('[GA4] runReport error:', e.message);
      return { error: e.message };
    }
  }
);

/** 全GA4ラッパーツールの配列 */
export const ga4Tools = [
  ga4ActiveUsersTool,
  ga4PageViewsTool,
  ga4EventsTool,
  ga4UserBehaviorTool,
  ga4RunReportTool,
];
```

### 2. `src/ai/agent.ts` (修正)

MCPツールを直接渡す方式から、ラッパーツールを使う方式に変更。システムプロンプトもシンプルに。

```typescript
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { bigQueryTool, listDatasetsTool } from '@/ai/tools/bigquery';
import { ga4Tools } from '@/ai/tools/ga4';
import { BIGQUERY_DATASET_DESCRIPTIONS } from '@/lib/bigquery-schema';

export const DataAgentInputSchema = z.object({
  query: z.string(),
});
export const DataAgentOutputSchema = z.object({
  answer: z.string(),
});

export const dataAgent = ai.defineFlow(
  {
    name: 'dataAgent',
    inputSchema: DataAgentInputSchema,
    outputSchema: DataAgentOutputSchema,
  },
  async (input) => {
    console.log('[Agent] Starting flow with query:', input.query);
    try {
      const allTools = [bigQueryTool, listDatasetsTool, ...ga4Tools];
      console.log('[Agent] Total tools:', allTools.length, '(BQ: 2 + GA4:', ga4Tools.length, ')');

      const today = new Date().toISOString().split('T')[0];

      const systemPrompt = `あなたは優秀なデータ分析アシスタントです。2種類のデータソースにアクセスできます。

## データソース

### 1. Google Analytics 4 (GA4) — Webサイト分析
以下のGA4ツールが利用可能です:
- **getGA4ActiveUsers**: アクティブユーザー数・新規ユーザー数
- **getGA4PageViews**: ページビュー数（PV数）
- **getGA4Events**: イベントデータ（page_view, click, scroll等）
- **getGA4UserBehavior**: ユーザー行動（セッション時間、直帰率等）
- **runGA4Report**: カスタムレポート（任意のメトリクス×ディメンション）

### 2. BigQuery — データウェアハウス
利用可能なデータセット情報: ${BIGQUERY_DATASET_DESCRIPTIONS}
- **executeBigQuery**: SQLクエリの実行
- **listDatasets**: データセット一覧の取得

## ツール選択の判断基準（重要）

**以下のキーワードが質問に含まれる場合、必ずGA4ツールを使ってください:**
- アクティブユーザー、ユーザー数、訪問者数、利用者数 → getGA4ActiveUsers
- ページビュー、PV、閲覧数、アクセス数 → getGA4PageViews
- イベント、クリック、スクロール、コンバージョン → getGA4Events
- 直帰率、セッション時間、エンゲージメント、ユーザー行動 → getGA4UserBehavior
- 上記の組み合わせや高度な分析 → runGA4Report

**BigQueryを使うのは以下の場合のみ:**
- 質問が明示的にBigQueryやSQLに言及している場合
- GA4には存在しないビジネスデータ（売上、在庫、顧客マスタ等）を問う場合
- 質問内容がデータセット情報に記載されたテーブルに関する場合

## 日付の扱い
- 今日の日付: ${today}
- 「今日」「昨日」「過去7日間」などは具体的な日付に変換してください
- GA4ツールの日付はすべて "YYYY-MM-DD" 形式です

## 回答ルール
- 丁寧な日本語で回答してください
- データが空（rows: []）の場合は「指定期間にデータがありませんでした」と説明してください
- SQLは SELECT 文のみ使用（BigQuery利用時）
`;

      console.log('[Agent] Calling ai.generate...');
      const response = await ai.generate({
        system: systemPrompt,
        prompt: input.query,
        tools: allTools,
        maxTurns: 10,
      });

      console.log('[Agent] Tool calls in response:', JSON.stringify(response.toolRequests, null, 2));
      console.log('[Agent] Response received, length:', response.text?.length);
      return { answer: response.text };
    } catch (error: any) {
      console.error('[Agent] Error:', error.message, error.stack);
      return { answer: 'エラーが発生しました。再度お試しください。 ' + (error.message || '') };
    }
  }
);
```

### 3. `src/ai/mcp.ts` (変更なし)

現状のままで問題ありません。

### 4. `src/ai/mcp-schema-fix.ts` (変更なし)

現状のままで問題ありません。引き続きラッパーツール内部で使用されます。

### 5. `src/app/api/agent/route.ts` (変更なし)

前回の修正が適用済みです。

## 修正のポイント

1. **ラッパーツール方式**: GA4 MCPツールを直接LLMに渡さず、`ai.defineTool`でシンプルなラッパーを作成。LLMが理解しやすい日本語のdescriptionとシンプルなZodスキーマにより、ツール選択率が向上します。

2. **getPageViews の dimensions 自動付与**: `getPageViews` はGA4 APIの仕様上dimensionsが必須ですが、ラッパーツール内で未指定時に `["date"]` をデフォルト付与するため、LLMがdimensionsを省略してもエラーになりません。

3. **runReport のパラメータ自動変換**: LLMは `metrics: ["activeUsers"]` のようにシンプルな文字列配列で指定でき、ラッパー内部で `[{name: "activeUsers"}]` のオブジェクト配列に自動変換します。

4. **システムプロンプトの整理**: ツール選択の判断基準を明確なルールとして記載し、GA4ツールが優先的に選ばれるようにしました。

## テスト方法

修正適用後、以下のクエリでGA4ツールが呼ばれることを確認してください:
- 「今日のアクティブユーザー数を教えてください」→ getGA4ActiveUsers が呼ばれる
- 「過去7日間のページビュー数は？」→ getGA4PageViews が呼ばれる
- 「最近のイベント一覧を見せてください」→ getGA4Events が呼ばれる

CLIテスト:
```bash
npx tsx scripts/test-agent.ts "今日のアクティブユーザー数を教えてください"
```
ログに `[GA4] getActiveUsers:` が出力されればGA4ツールが正しく呼ばれています。
