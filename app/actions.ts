'use server';

import { GoogleGenAI, Type } from '@google/genai';
import { getBigQueryClient, serializeBigQueryResults } from '@/lib/bigquery-client';
import { getGA4Client, getGA4PropertyId } from '@/lib/ga4-client';
import { BIGQUERY_DATASET_DESCRIPTIONS } from '@/lib/bigquery-schema';

/**
 * @google/genai クライアントの初期化
 * 
 * 【Why】
 * 現在は軽量に API をテスト・検証するため、Genkit を直接使わずに
 * GoogleGenAI SDK を用いたスタンドアロンな実装を採用しています。
 */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * BigQuery 実行用ツールの宣言定義
 * 
 * 【Why】
 * Gemini に BigQuery への標準 SQL クエリ発行が可能なことを伝え、
 * 必要に応じて自動で呼び出させるための Function Declaration です。
 */
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

/**
 * GA4 ページビュー取得用ツールの宣言定義
 * 
 * 【Why】
 * 指定された日付範囲におけるページビュー統計を GA4 から
 * 取得できるように設計された Function Declaration です。
 */
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
 * ユーザーからのプロンプト（問い合わせ）を受け取り、
 * Gemini エージェントを介して BigQuery や GA4 ツールを自律実行し、最終回答を生成する Server Action です。
 * 
 * @param {string} userPrompt - ユーザーが入力した自然言語の質問テキスト
 * @returns {Promise<{ answer: string; context: string; error: string | null }>}
 *   - answer: Geminiが最終的に生成した日本語の回答テキスト
 *   - context: 内部でエージェントが実行したツール呼び出しの履歴デバッグ用文字列
 *   - error: 処理中に回復不能なエラーが発生した場合のエラーメッセージ
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

    /**
     * エージェントの最大ターン数
     * 
     * 【Why】
     * ツール実行結果にエラーが含まれる場合や、エージェントが自己修復・再クエリを繰り返す際、
     * 無限ループに陥って API コストが急増するのを防止するために最大ターン数を「5」に制限しています。
     */
    let maxTurns = 5;
    let turn = 0;

    // Geminiがツール（関数）の呼び出しを要求している間、自律ループを実行
    while (response.functionCalls && response.functionCalls.length > 0 && turn < maxTurns) {
      turn++;
      const functionResponses = [];

      for (const call of response.functionCalls) {
        let toolData: any = {};
        
        if (call.name === 'query_bigquery') {
          const sqlQuery = (call.args as any).sqlQuery;
          toolContext += `[BigQuery] Query: ${sqlQuery}\n`;
          try {
            const bq = await getBigQueryClient();
            const [rows] = await bq.query(sqlQuery);
            toolData = { results: serializeBigQueryResults(rows) };
            toolContext += `[BigQuery] Success: returned ${rows.length} rows\n`;
          } catch(e: any) {
            // エラーが発生した場合も、エラーメッセージをGeminiに返却して自己修正を促します
            toolData = { error: e.message };
            toolContext += `[BigQuery] Error: ${e.message}\n`;
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
            // エラー情報をGeminiに返し、日付範囲の調整などの代替手段を検討させます
            toolData = { error: e.message };
            toolContext += `[GA4] Error: ${e.message}\n`;
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

      // ツールの実行結果をGeminiにフィードバックし、次の指示を仰ぐ
      response = await chat.sendMessage({
        message: functionResponses
      });
    }
    
    let finalAnswer = '';
    try {
      finalAnswer = response.text || '';
    } catch (e) {
      // 最終レスポンスにテキストが含まれなかった場合のフォールバック（例：ツール呼び出しのみで終わった場合など）
      finalAnswer = '申し訳ありません。回答テキストの生成に失敗しました。';
    }

    return { answer: finalAnswer, context: toolContext, error: null };
  } catch (error: any) {
    // 回復不能なシステムエラー（ネットワークエラーやAPIキーの無効化など）が発生した場合のハンドリング
    return { answer: '', context: '', error: error.message };
  }
}
