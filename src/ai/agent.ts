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
    try {
      // MCPホストからツールを取得
      const ga4Tools = await mcpHost.getActiveTools(ai);
      
      // MCPツールのスキーマをパッチしてクラッシュを防ぐ
      for (const tool of ga4Tools) {
        const action = (tool as any).__action;
        if (action?.metadata?.inputSchema) {
          action.metadata.inputSchema = patchSchema(action.metadata.inputSchema);
        }
        // Genkitの内部的な inputJsonSchema も存在する場合は念のためパッチ
        if (action?.inputJsonSchema) {
          action.inputJsonSchema = patchSchema(action.inputJsonSchema);
        }
      }

      const ga4ToolNames = ga4Tools.map(t => (t as any).__action?.name || 'unknown');
      console.log(`[MCP] GA4 tools (patched): ${ga4ToolNames.join(', ')}`);

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

重要: GA4関連のツールを呼び出す際は、必ず「ga4/」プレフィックス付きの正式なツール名を使用してください。
例:
- ga4/runReport（✓ 正しい）
- ga4/get_active_users（✓ 正しい）

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
