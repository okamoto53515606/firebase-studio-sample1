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
