import * as dotenv from 'dotenv';
dotenv.config();

import { bigQueryTool, listDatasetsTool } from '../src/ai/tools/bigquery';

async function testTools() {
  console.log('--- Testing listDatasetsTool ---');
  try {
    const datasetsResult = await listDatasetsTool.run({});
    console.log('Datasets:', JSON.stringify(datasetsResult, null, 2));
  } catch (error) {
    console.error('listDatasetsTool error:', error);
  }

  console.log('\n--- Testing bigQueryTool with analytics_518441997 ---');
  try {
    // 修正: analytics_518441997 内のテーブル一覧を取得するクエリ
    const query = 'SELECT table_name FROM `analytics_518441997.INFORMATION_SCHEMA.TABLES` LIMIT 10';
    const queryResult = await bigQueryTool.run({ sql: query });
    console.log('Query Result (Tables in analytics_518441997):', JSON.stringify(queryResult, null, 2));
  } catch (error) {
    console.error('bigQueryTool error:', error);
  }
}

testTools();
