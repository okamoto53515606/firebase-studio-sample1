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

export const ga4Tools = [
  ga4ActiveUsersTool,
  ga4PageViewsTool,
  ga4EventsTool,
  ga4UserBehaviorTool,
  ga4RunReportTool,
];
