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

/**
 * BigQuery のクエリ結果を JSON として安全に扱えるようにシリアライズします。
 * Why: BigInt や BigQueryDate などの特殊な型はそのままでは JSON.stringify でエラーになってしまうの。
 * AI へのコンテキスト渡しなど後続処理で落ちないように、事前に文字列などに変換してあげる優しさよ❤️
 */
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
