import { BigQuery } from '@google-cloud/bigquery';

let bigqueryClient: BigQuery | null = null;

export async function getBigQueryClient(): Promise<BigQuery> {
  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId: process.env.BIGQUERY_PROJECT_ID,
    });
  }
  return bigqueryClient;
}

export function serializeBigQueryResults(rows: any[]): any[] {
  return JSON.parse(JSON.stringify(rows, (_, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value && typeof value === 'object' && value.value && value.constructor.name === 'BigQueryDate') {
        return value.value;
    }
    return value;
  }));
}
