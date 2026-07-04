'use server';

import { GoogleGenAI, Type } from '@google/genai';
import { getBigQueryClient, serializeBigQueryResults } from '@/lib/bigquery-client';
import { getGA4Client, getGA4PropertyId } from '@/lib/ga4-client';
import { BIGQUERY_DATASET_DESCRIPTIONS } from '@/lib/bigquery-schema';

// Google Gen AI SDKのクライアント初期化
// 環境変数からAPIキーを取得して設定します。
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// BigQuery呼び出しツールの定義宣言
// モデルに対してどのようなパラメータを渡して実行するかを伝えるメタデータです。
const queryBigQueryDeclaration = {
  name: 'query_bigquery',
  description: 'Executes a SQL query against BigQuery and returns the resulting rows.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sqlQuery: {
        type: Type.STRING,
        description: 'The standard SQL query to execute.'
      }
    },
    required: ['sqlQuery']
  }
};

// Google Analytics 4のPVデータ取得ツールの定義宣言
const getGA4PageViewsDeclaration = {
  name: 'get_ga4_page_views',
  description: 'Gets page views data from Google Analytics 4 for a given date range.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      startDate: {
        type: Type.STRING,
        description: 'The start date in YYYY-MM-DD format.'
      },
      endDate: {
        type: Type.STRING,
        description: 'The end date in YYYY-MM-DD format.'
      }
    },
    required: ['startDate', 'endDate']
  }
};

/**
 * ユーザーからの自然言語による質問を受け取り、Geminiのエージェントが適切なツールを選択・実行して
 * 最終的な日本語の回答を生成するServer Actionです。
 * 
 * 【なぜこのループ処理が必要か（Why）】
 * 1. エージェントが一度のやり取りで回答を出せるケースだけでなく、
 *    「BigQueryを検索して結果を得てから、さらに別の検索をする」といった複数ステップ（マルチターン）の推論を
 *    おこなう必要があるため、whileループで関数呼び出し(functionCalls)がなくなるまで自動的に実行を継続します。
 * 2. 無限ループを防ぎ、APIの実行コストや実行時間の肥大化を防ぐために、
 *    安全策として `maxTurns`（最大5回）の制限を設定しています。
 * 
 * @param {string} userPrompt - ユーザーがダッシュボードに入力した自然言語の質問
 * @returns {Promise<{ answer: string; context: string; error: string | null }>} 回答、ログコンテキスト、エラーメッセージ
 */
export async function runAgentAction(userPrompt: string) {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        tools: [
          { functionDeclarations: [queryBigQueryDeclaration, getGA4PageViewsDeclaration] },
          { googleSearch: {} }
        ],
        toolConfig: {
          includeServerSideToolInvocations: true
        },
        systemInstruction: `You are an expert Data Analytics Assistant. Please always answer in Japanese.
You can query Google BigQuery and Google Analytics 4.
Always use the tools dynamically.
BigQuery context:
${BIGQUERY_DATASET_DESCRIPTIONS}
`
      }
    });

    let response = await chat.sendMessage({ message: userPrompt });
    let toolContext = '';

    const maxTurns = 5;
    let turn = 0;

    // 関数呼び出し要求（functionCalls）が存在する限り、処理を継続します
    while (response.functionCalls && response.functionCalls.length > 0 && turn < maxTurns) {
      turn++;
      const functionResponses = [];

      for (const call of response.functionCalls) {
        let toolData: any = {};
        
        if (call.name === 'query_bigquery') {
          const sqlQuery = (call.args as any).sqlQuery;
          toolContext += `[BigQuery] Query: ${sqlQuery}\n`;
          
          // 【セキュリティ上の重要ポイント（Why）】
          // 本ツールはデータ分析用のサンプルであるため、データの改ざん、削除、
          // テーブルやデータセットの削除といった予期せぬ破壊的変更（SQLインジェクションなど）を
          // 防ぐ目的で、SELECT文から始まる参照クエリのみを許可するバリデーションを挟んでいます。
          if (!sqlQuery || !sqlQuery.trim().toLowerCase().startsWith('select')) {
            toolData = { error: 'Only SELECT statements are allowed.' };
            toolContext += `[BigQuery] Rejected: non-SELECT statement\n`;
          } else {
            try {
              const bq = await getBigQueryClient();
              const [rows] = await bq.query(sqlQuery);
              toolData = { results: serializeBigQueryResults(rows) };
              toolContext += `[BigQuery] Success: returned ${rows.length} rows\n`;
            } catch(e: any) {
              // 開発時のデバッグ用にエラーログをサーバー側に出力しつつ、
              // クライアント側（ブラウザ）へは内部の生エラーをそのまま見せずに、分かりやすい日本語のエラーを返します。
              console.error('[BigQuery] Query error:', e);
              toolData = { error: 'BigQueryクエリの実行中にエラーが発生しました。' };
              toolContext += `[BigQuery] Error occurred\n`;
            }
          }
        } 
        else if (call.name === 'get_ga4_page_views') {
          const { startDate, endDate } = call.args as any;
          toolContext += `[GA4] Fetch for ${startDate} to ${endDate}\n`;
          try {
            const ga4 = getGA4Client();
            const propertyId = getGA4PropertyId();
            const [res] = await ga4.runReport({
               property: `properties/${propertyId}`,
               dateRanges: [{ startDate, endDate }],
               dimensions: [{ name: 'pageTitle' }],
               metrics: [{ name: 'screenPageViews' }]
            });
            const data = res.rows?.map(r => ({ title: r.dimensionValues?.[0]?.value, views: r.metricValues?.[0]?.value })) || [];
            toolData = { data };
            toolContext += `[GA4] Success: returned ${data.length} rows\n`;
          } catch(e: any) {
            // サーバー側にはエラー詳細を出力しつつ、ユーザー側へは優しいエラー文面で親切に対応します。
            console.error('[GA4] Report error:', e);
            toolData = { error: 'GA4レポートの取得中にエラーが発生しました。' };
            toolContext += `[GA4] Error occurred\n`;
          }
        }

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: toolData,
            id: call.id
          }
        });
      }

      // 実行したツールの結果をGeminiモデルに送り返し、次の回答や追加のツール呼び出し指示を受け取ります
      response = await chat.sendMessage({
        message: functionResponses
      });
    }
    
    let finalAnswer = '';
    try {
      finalAnswer = response.text || '';
    } catch (e) {
      // テキスト抽出時のエラーはログに流すなどし、クラッシュを未然に防ぎます
    }

    return { answer: finalAnswer, context: toolContext, error: null };
  } catch (error: any) {
    // 予期しないシステムエラー（API接続切れなど）が発生した場合のセーフティガード
    console.error('[Agent] Unexpected error:', error);
    return { answer: '', context: '', error: 'エージェントの実行中に予期しないエラーが発生しました。' };
  }
}
