# 修正依頼: GA4 MCP依存を除去し、GA4 Data API 直接呼び出しに変更

## 概要

現在 GA4 のデータ取得に MCP（`@genkit-ai/mcp` + `mcp-server-ga4`）を経由していますが、
MCP を除去し、`@google-analytics/data`（BetaAnalyticsDataClient）を使って GA4 Data API を直接呼び出す方式に変更してください。

## 理由

- MCPのスキーマ問題（`properties` 未定義でクラッシュ）に対するパッチが必要だった
- MCPツールのスキーマが複雑でLLMがツールを選択しなかった
- 結局ラッパーツールを書いたのでMCPのメリットがない
- 依存パッケージが減り、起動も速くなる

## 修正内容

### 1. パッケージ変更 (`package.json`)

**追加:**
- `@google-analytics/data` — GA4 Data API クライアント

**削除:**
- `@genkit-ai/mcp` — もう不要

```bash
npm install @google-analytics/data
npm uninstall @genkit-ai/mcp
```

### 2. GA4 クライアント作成 (`src/lib/ga4-client.ts` 新規)

BigQuery クライアント（`src/lib/bigquery-client.ts`）と同様のパターンで、GA4 クライアントを作成してください。

```typescript
import { BetaAnalyticsDataClient } from '@google-analytics/data';

let ga4Client: BetaAnalyticsDataClient | null = null;

export function getGA4Client(): BetaAnalyticsDataClient {
  if (!ga4Client) {
    ga4Client = new BetaAnalyticsDataClient();
    // ADC（Application Default Credentials）を自動使用
    // GOOGLE_APPLICATION_CREDENTIALS が設定されていればそちらを使用
  }
  return ga4Client;
}

export function getGA4PropertyId(): string {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId) {
    throw new Error('環境変数 GA_PROPERTY_ID が設定されていません');
  }
  return propertyId;
}
```

### 3. GA4ツール書き換え (`src/ai/tools/ga4.ts` 完全書き換え)

MCP経由の呼び出しを、GA4 Data API の直接呼び出しに置き換えます。
**ツールの名前・description・inputSchema は現在のものをそのまま維持**してください（LLMの選択ロジックに影響するため）。
内部実装だけを差し替えます。

以下は `mcp-server-ga4` の実装を参考にした、各ツールの直接API呼び出し実装です:

```typescript
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getGA4Client, getGA4PropertyId } from '@/lib/ga4-client';

// GA4 Data API にレポートを実行する共通関数
async function runGA4Report(config: {
  dateRanges: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  dimensionFilter?: any;
}): Promise<any> {
  const client = getGA4Client();
  const propertyId = getGA4PropertyId();

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    ...config,
  });
  return response;
}

// --- ツール定義 ---
// ツール名・description・inputSchema は現在と同一にしてください

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
      const result = await runGA4Report({
        dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
        metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }],
        dimensions: [{ name: 'date' }],
      });
      return result;
    } catch (e: any) {
      console.error('[GA4] getActiveUsers error:', e.message);
      return { error: e.message };
    }
  }
);

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
      const dimensions = input.dimensions && input.dimensions.length > 0
        ? input.dimensions.map(d => ({ name: d }))
        : [{ name: 'date' }];
      console.log('[GA4] getPageViews:', JSON.stringify(input));
      const result = await runGA4Report({
        dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
        metrics: [{ name: 'screenPageViews' }],
        dimensions,
      });
      return result;
    } catch (e: any) {
      console.error('[GA4] getPageViews error:', e.message);
      return { error: e.message };
    }
  }
);

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
      const config: any = {
        dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
        dimensions: [{ name: 'eventName' }, { name: 'date' }],
        metrics: [{ name: 'eventCount' }],
      };
      if (input.eventName) {
        config.dimensionFilter = {
          filter: {
            fieldName: 'eventName',
            stringFilter: { value: input.eventName },
          },
        };
      }
      const result = await runGA4Report(config);
      return result;
    } catch (e: any) {
      console.error('[GA4] getEvents error:', e.message);
      return { error: e.message };
    }
  }
);

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
      const result = await runGA4Report({
        dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
        metrics: [
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'sessionsPerUser' },
        ],
        dimensions: [{ name: 'date' }],
      });
      return result;
    } catch (e: any) {
      console.error('[GA4] getUserBehavior error:', e.message);
      return { error: e.message };
    }
  }
);

export const ga4RunReportTool = ai.defineTool(
  {
    name: 'runGA4Report',
    description:
      'Google Analytics 4のカスタムレポートを実行します。任意のメトリクスとディメンションの組み合わせで分析できます。専用ツール（getGA4ActiveUsers等）で対応できない場合に使ってください。',
    inputSchema: z.object({
      startDate: z.string().describe('開始日 (YYYY-MM-DD形式)'),
      endDate: z.string().describe('終了日 (YYYY-MM-DD形式)'),
      metrics: z.array(z.string()).describe('メトリクス名の配列。例: ["activeUsers", "sessions", "screenPageViews"]'),
      dimensions: z.array(z.string()).describe('ディメンション名の配列。例: ["date", "country", "pagePath"]'),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const metrics = input.metrics.map(m => ({ name: m }));
      const dimensions = input.dimensions.map(d => ({ name: d }));
      console.log('[GA4] runReport:', JSON.stringify({ ...input, metrics, dimensions }));
      const result = await runGA4Report({
        dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
        metrics,
        dimensions,
      });
      return result;
    } catch (e: any) {
      console.error('[GA4] runReport error:', e.message);
      return { error: e.message };
    }
  }
);

/** 全GA4ツールの配列 */
export const ga4Tools = [
  ga4ActiveUsersTool,
  ga4PageViewsTool,
  ga4EventsTool,
  ga4UserBehaviorTool,
  ga4RunReportTool,
];
```

### 4. 不要ファイルの削除

以下のファイルはもう不要なので削除してください:

- `src/ai/mcp.ts` — MCP Host 設定（不要）
- `src/ai/mcp-schema-fix.ts` — MCPスキーマパッチ（不要）

### 5. `src/ai/agent.ts` の確認

`agent.ts` は現在すでにラッパーツール経由の構成（`import { ga4Tools } from '@/ai/tools/ga4'` のみ）になっているため、
**変更不要のはず**です。ただし以下を確認してください:
- `@/ai/mcp` や `@/ai/mcp-schema-fix` への import が残っていたら削除
- `mcpHost` への参照が残っていたら削除

### 6. テストスクリプトの更新 (`scripts/test-ga4-direct.ts`)

MCP経由のテストから、直接APIのテストに書き換えてください。

```typescript
import * as dotenv from 'dotenv';
dotenv.config();

import { BetaAnalyticsDataClient } from '@google-analytics/data';

async function testGA4Direct() {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId) {
    console.error('GA_PROPERTY_ID not set');
    return;
  }

  const client = new BetaAnalyticsDataClient();

  // Test 1: getActiveUsers 相当
  console.log('\n=== Test 1: Active Users ===');
  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2026-02-25', endDate: '2026-03-04' }],
      metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }],
      dimensions: [{ name: 'date' }],
    });
    console.log('SUCCESS:', JSON.stringify(response, null, 2).substring(0, 500));
  } catch (e: any) {
    console.error('FAILED:', e.message);
  }

  // Test 2: getPageViews 相当
  console.log('\n=== Test 2: Page Views ===');
  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2026-02-25', endDate: '2026-03-04' }],
      metrics: [{ name: 'screenPageViews' }],
      dimensions: [{ name: 'date' }],
    });
    console.log('SUCCESS:', JSON.stringify(response, null, 2).substring(0, 500));
  } catch (e: any) {
    console.error('FAILED:', e.message);
  }

  // Test 3: getEvents 相当
  console.log('\n=== Test 3: Events ===');
  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2026-02-25', endDate: '2026-03-04' }],
      dimensions: [{ name: 'eventName' }, { name: 'date' }],
      metrics: [{ name: 'eventCount' }],
    });
    console.log('SUCCESS:', JSON.stringify(response, null, 2).substring(0, 500));
  } catch (e: any) {
    console.error('FAILED:', e.message);
  }

  console.log('\nAll tests completed.');
}

testGA4Direct().catch(console.error);
```

## まとめ: 変更一覧

| 操作 | ファイル |
|------|----------|
| 新規作成 | `src/lib/ga4-client.ts` |
| 完全書き換え | `src/ai/tools/ga4.ts` |
| 更新 | `scripts/test-ga4-direct.ts` |
| 削除 | `src/ai/mcp.ts` |
| 削除 | `src/ai/mcp-schema-fix.ts` |
| パッケージ追加 | `@google-analytics/data` |
| パッケージ削除 | `@genkit-ai/mcp` |
| 確認のみ | `src/ai/agent.ts`（MCP import残存チェック） |

## 修正後の期待動作
1. MCP関連の依存・ファイルがすべて除去される
2. GA4 Data API を直接呼び出し、MCPと同じデータが取得できる
3. ツール名・スキーマ・descriptionは変更なし → LLMのツール選択に影響なし
4. `npx tsx scripts/test-ga4-direct.ts` で直接APIテストが成功する
5. `npx tsx scripts/test-agent.ts "今日のアクティブユーザー数は？"` で GA4 ツールが使われる
