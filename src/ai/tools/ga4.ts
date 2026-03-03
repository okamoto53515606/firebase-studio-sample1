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
