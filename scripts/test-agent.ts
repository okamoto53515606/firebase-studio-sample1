import * as dotenv from 'dotenv';
dotenv.config();

import { dataAgent } from '../src/ai/agent';

async function testAgent() {
  const queries = [
    'あなたのプロジェクトで利用可能なデータセットを教えてください。',
    '今日のアクティブユーザー数は？',
    '過去7日間のページビュー数の推移を教えてください。'
  ];

  for (const queryText of queries) {
    console.log(`\n--- Testing Data Agent with query: "${queryText}" ---`);

    try {
      const response = await dataAgent({ query: queryText });
      console.log('Agent Response:', JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Agent flow error:', error);
    }
  }
}

testAgent();
