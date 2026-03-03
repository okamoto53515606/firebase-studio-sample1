import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { bigQueryTool, listDatasetsTool } from '@/ai/tools/bigquery';
import { BIGQUERY_DATASET_DESCRIPTIONS } from '@/lib/bigquery-schema';
import { mcpHost } from '@/ai/mcp';
import { patchSchema } from '@/ai/mcp-schema-fix';

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
      // MCPホストからツールを取得
      const ga4Tools = await mcpHost.getActiveTools(ai);
      
      // MCPツールのスキーマをパッチしてクラッシュを防ぐ
      for (const tool of ga4Tools) {
        const action = (tool as any).__action;
        if (action?.metadata?.inputSchema) {
          action.metadata.inputSchema = patchSchema(action.metadata.inputSchema);
        }
        if (action?.inputJsonSchema) {
          action.inputJsonSchema = patchSchema(action.inputJsonSchema);
        }
      }

      const ga4ToolNames = ga4Tools.map(t => (t as any).__action?.name || 'unknown');
      console.log('[Agent] GA4 tools:', ga4ToolNames.join(', ') || 'none');

      const allTools = [bigQueryTool, listDatasetsTool, ...ga4Tools];
      console.log('[Agent] Total tools:', allTools.length, '(BQ: 2 + GA4:', ga4Tools.length, ')');

      const ga4ToolListText = ga4ToolNames.length > 0 
        ? `利用可能なGA4ツール: ${ga4ToolNames.join(', ')}`
        : 'GA4ツールは現在利用できません。';

      const systemPrompt = `
あなたは優秀なデータ分析アシスタントです。BigQuery と Google Analytics 4 (GA4) の両方にアクセスできます。

利用可能なデータセット情報 (BigQuery): ${BIGQUERY_DATASET_DESCRIPTIONS}

GA4 (Google Analytics 4) に関する機能:
- GA4のツール（ga4/で始まるツール群）を使って、アクティブユーザー数、ページビュー、イベント数、セッション数などを取得できます。
- ${ga4ToolListText}
- ユーザーがアクセス解析やWebサイトのパフォーマンス、ユーザー行動に関する質問をした場合は、GA4ツールを積極的に使用してください。

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
- 必ず「ga4/」プレフィックス付きの正式なツール名を使用してください。

分析の手順:
1. 質問内容に基づき、適切なツールを選択します。
   - BigQueryが必要な場合は listDatasets や executeBigQuery を使用。
   - GA4のデータが必要な場合は ga4/ ツール群を使用。
2. 必要に応じてテーブル定義を確認したり、GA4のメトリクス/ディメンションを確認します。
3. データを取得・分析し、最終的な回答を日本語で提供します。

制約:
- SQLは SELECT 文のみ使用。
- 丁寧な日本語で回答してください。
- 今日は ${new Date().toISOString().split('T')[0]} です。
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
      return { answer: "エラーが発生しました。再度お試しください。 " + (error.message || "") };
    }
  }
);
