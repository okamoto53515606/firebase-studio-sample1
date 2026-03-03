import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { bigQueryTool, listDatasetsTool } from '@/ai/tools/bigquery';
import { BIGQUERY_DATASET_DESCRIPTIONS } from '@/lib/bigquery-schema';
import { mcpHost } from '@/ai/mcp';

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
    const systemPrompt = `
あなたは優秀なデータ分析アシスタントです。BigQuery と Google Analytics 4 (GA4) の両方にアクセスできます。

利用可能なデータセット情報 (BigQuery): ${BIGQUERY_DATASET_DESCRIPTIONS}

GA4 (Google Analytics 4) に関する機能:
- GA4のツール（ga4/で始まるツール群）を使って、アクティブユーザー数、ページビュー、イベント数、セッション数などを取得できます。
- ユーザーがアクセス解析やWebサイトのパフォーマンス、ユーザー行動に関する質問をした場合は、GA4ツールを積極的に使用してください。
- 必要に応じて、BigQueryのデータとGA4のデータを組み合わせて分析を行うことも可能です。

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
    try {
      // 修正: MCPホストからツールを「毎回取得」する
      const ga4Tools = await mcpHost.getActiveTools(ai);
      
      const response = await ai.generate({
        system: systemPrompt,
        prompt: input.query,
        tools: [bigQueryTool, listDatasetsTool, ...ga4Tools],
        maxTurns: 10,
      });
      return { answer: response.text };
    } catch (error: any) {
      console.error('Agent error:', error);
      return { answer: "エラーが発生しました。再度お試しください。 " + (error.message || "") };
    } finally {
      await mcpHost.close();
    }
  }
);
