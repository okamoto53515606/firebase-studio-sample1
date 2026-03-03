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
    try {
      const bigquery = await getBigQueryClient();
      const [datasets] = await bigquery.getDatasets();
      const datasetIds = datasets.map(d => d.id).filter((id): id is string => typeof id === 'string');
      return { datasets: datasetIds };
    } catch (error: any) {
      return { error: `Failed to list datasets: ${error.message}`, datasets: [] };
    }
  }
);
