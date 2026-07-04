import { BigQuery } from '@google-cloud/bigquery';

// クライアントを再利用するためのシングルトンインスタンスを保持します。
// サーバーレス環境でのコールドスタートや同時実行時に、
// 接続のオーバーヘッドを減らすためにグローバルでインスタンスをキャッシュしています。
let bigqueryClient: BigQuery | null = null;

/**
 * BigQuery クライアントのシングルトンインスタンスを取得します。
 * 
 * @returns {Promise<BigQuery>} BigQuery クライアントインスタンス
 */
export async function getBigQueryClient(): Promise<BigQuery> {
  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId: process.env.BIGQUERY_PROJECT_ID,
    });
  }
  return bigqueryClient;
}

/**
 * BigQueryから返された生の行データを、Next.jsのServer Actionsなどでシリアライズ可能な形式に変換します。
 * 
 * 【なぜこの処理が必要か（Why）】
 * 1. BigQueryの一部の数値は JavaScript の bigint 型として返されますが、
 *    JSON.stringify() は標準で bigint のシリアライズに対応していないため、TypeError が発生します。
 *    そのため、文字列型（string）に変換して安全にシリアライズできるようにしています。
 * 2. BigQueryDate などの特殊な日付オブジェクトはそのままではシリアライズしにくいため、
 *    オブジェクトの value プロパティから生の日付文字列を抽出して返します。
 * 
 * @param {any[]} rows - BigQueryのクエリ結果から得られた生データの配列
 * @returns {any[]} シリアライズ可能に変換されたデータの配列
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
