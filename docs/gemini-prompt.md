# Firebase Studio Gemini 修正依頼プロンプト

以下をFirebase StudioのGeminiチャットにコピー&ペーストしてください。

---

## プロンプト本文

```
このNext.jsプロジェクトを、Genkit + BigQuery を使ったAIデータ分析エージェントのサンプルアプリに改修してください。
解説用サンプルなのでシンプルな構成にしてください。

## 概要
ユーザーがチャットUIから自然言語で質問すると、AIエージェントがBigQueryにSQLを発行してデータを取得・分析し、日本語で回答するアプリです。

## 技術スタック（既存を活かす）
- Next.js 15 (App Router)
- Genkit (`genkit` + `@genkit-ai/google-genai`) ← 既に導入済み
- `@google-cloud/bigquery` ← 新規追加
- Gemini APIキーは `.env` の `GEMINI_API_KEY` を利用（Firebase Studioが自動生成済み）

## 要件

### 1. BigQueryクライアント (`src/lib/bigquery-client.ts`)
- `@google-cloud/bigquery` を使用
- 認証は ADC（Application Default Credentials）を使う。サービスアカウントキーは不要
- プロジェクトIDは環境変数 `BIGQUERY_PROJECT_ID` から取得
- BigQueryの結果をJSON安全にシリアライズするヘルパー関数も用意する（BigInt, Date等の対応）

### 2. データセット説明 (`src/lib/bigquery-schema.ts`)
- エージェントに渡すデータセットの説明文を定数として定義
- 初期値はプレースホルダーでよい（ユーザーが後で書き換える想定）

### 3. Genkitツール定義 (`src/ai/tools/bigquery.ts`)
- `ai.defineTool` で以下の2つのツールを定義:
  - `executeBigQuery`: SQLを受け取りBigQueryで実行して結果を返す。SELECT文のみ許可
  - `listDatasets`: プロジェクト内のデータセット一覧を返す
- `ai` インスタンスは既存の `src/ai/genkit.ts` からimportする

### 4. エージェントフロー (`src/ai/agent.ts`)
- `ai.defineFlow` でエージェントを定義
- 入力: ユーザーの自然言語クエリ（string）
- 出力: AIの回答（string）
- `ai.generate()` にシステムプロンプト、ユーザークエリ、ツール群を渡す
- システムプロンプトの要点:
  - 日本語で回答
  - まず listDatasets でデータセット一覧を確認
  - INFORMATION_SCHEMA でテーブル/カラム定義を確認
  - SQL作成→実行→結果分析→回答
  - SELECT文のみ使用
  - 今日の日付を動的に埋め込む

### 5. APIルート (`src/app/api/agent/route.ts`)
- POST エンドポイント
- リクエストbody: `{ query: string }`
- エージェントフローを呼び出し、結果を返す
- エラーハンドリングを含む

### 6. チャットUI (`src/app/page.tsx` を改修)
- シンプルな1問1答のチャット画面
- テキスト入力欄と送信ボタン
- AIの回答を表示するエリア
- ローディング状態の表示
- 既存の shadcn/ui コンポーネント（Card, Button, Input, Textarea等）を活用
- レスポンシブ対応

### 7. dev.tsの更新 (`src/ai/dev.ts`)
- エージェントフローをimportして、genkit devツールで動作確認できるようにする

### 8. テストスクリプト
- `scripts/test-tools.ts`: BigQueryツール単体のテスト
- `scripts/test-agent.ts`: エージェントフロー全体のテスト
- 実行方法: `npx tsx scripts/test-tools.ts`, `npx tsx scripts/test-agent.ts`
- dotenvで `.env` を読み込むこと

### 9. 環境変数
- `.env` に以下を追加（GEMINI_API_KEYは既存）:
  ```
  BIGQUERY_PROJECT_ID=your-project-id
  ```

### 10. package.json
- `@google-cloud/bigquery` を dependencies に追加
- genkit関連パッケージを `^1.29.0` にアップグレード
- `@genkit-ai/googleai` は不要なので削除し、`@genkit-ai/google-genai` に統一

## 参考コード

以下は動作確認済みの参考実装です。設計の参考にしてください。そのままコピーする必要はなく、要件を満たすようにアレンジしてください。

### 参考: src/ai/tools/bigquery.ts
```typescript
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getBigQueryClient, serializeBigQueryResults } from '@/lib/bigquery-client';

export const bigQueryTool = ai.defineTool(
  {
    name: 'executeBigQuery',
    description: 'Executes a SQL query on BigQuery. Use this to fetch data to answer user questions. Input should be a valid SQL SELECT statement.',
    inputSchema: z.object({
      sql: z.string().describe('The SQL query to execute. MUST be a SELECT statement.'),
    }),
    outputSchema: z.unknown(),
  },
  async (input) => {
    try {
      const { sql } = input;
      if (!sql.trim().toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT statements are allowed.');
      }
      const bigquery = await getBigQueryClient();
      const [rows] = await bigquery.query(sql);
      if (!rows || rows.length === 0) {
        return { message: "Query executed successfully but returned no data." };
      }
      const results = serializeBigQueryResults(rows);
      const MAX_ROWS = 100;
      if (results.length > MAX_ROWS) {
        return { warning: `Results truncated to ${MAX_ROWS} rows.`, data: results.slice(0, MAX_ROWS) };
      }
      return { data: results };
    } catch (error: any) {
      return { error: `Failed to execute query: ${error.message}` };
    }
  }
);

export const listDatasetsTool = ai.defineTool(
  {
    name: 'listDatasets',
    description: 'Lists all datasets in the current BigQuery project.',
    inputSchema: z.object({}),
    outputSchema: z.object({ datasets: z.array(z.string()) }),
  },
  async () => {
    const bigquery = await getBigQueryClient();
    const [datasets] = await bigquery.getDatasets();
    const datasetIds = datasets.map(d => d.id).filter((id): id is string => typeof id === 'string');
    return { datasets: datasetIds };
  }
);
```

### 参考: src/ai/agent.ts
```typescript
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { bigQueryTool, listDatasetsTool } from '@/ai/tools/bigquery';
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
    const systemPrompt = `
あなたは優秀なデータ分析アシスタントです。BigQueryにアクセスできます。
利用可能なデータセット情報: ${BIGQUERY_DATASET_DESCRIPTIONS}
手順:
1. listDatasets でデータセット一覧を確認
2. INFORMATION_SCHEMA でテーブル/カラム定義を確認
3. SQLクエリを作成・実行
4. 結果を分析して日本語で回答
制約: SELECT文のみ使用。今日は ${new Date().toISOString().split('T')[0]} です。
`;
    try {
      const response = await ai.generate({
        system: systemPrompt,
        prompt: input.query,
        tools: [bigQueryTool, listDatasetsTool],
        maxTurns: 10,
      });
      return { answer: response.text };
    } catch (error: any) {
      return { answer: "エラーが発生しました。再度お試しください。" };
    }
  }
);
```

### 参考: src/lib/bigquery-client.ts
```typescript
import { BigQuery } from '@google-cloud/bigquery';

let bigqueryClient: BigQuery | null = null;

export async function getBigQueryClient(): Promise<BigQuery> {
  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId: process.env.BIGQUERY_PROJECT_ID,
      // ADC を使うため credentials の指定は不要
    });
  }
  return bigqueryClient;
}

export function serializeBigQueryResults(rows: any[]): any[] {
  return JSON.parse(JSON.stringify(rows, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}
```

## 注意事項
- `src/ai/genkit.ts` は既に正しく設定されているので変更不要
- Genkitのgoogle-genaiプラグインは環境変数 `GEMINI_API_KEY` または `GOOGLE_GENAI_API_KEY` を自動で読む
- UIは既存の shadcn/ui コンポーネントを最大限活用してシンプルに
- すべてのソースファイルは `src/` 配下に配置
- テストスクリプトのみ `scripts/` 配下
```

---
