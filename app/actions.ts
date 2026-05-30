'use server';

import { GoogleGenAI, Type } from '@google/genai';
import { getBigQueryClient, serializeBigQueryResults } from '@/lib/bigquery-client';
import { getGA4Client, getGA4PropertyId } from '@/lib/ga4-client';
import { BIGQUERY_DATASET_DESCRIPTIONS } from '@/lib/bigquery-schema';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    let maxTurns = 5;
    let turn = 0;

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

      response = await chat.sendMessage({
        message: functionResponses
      });
    }
    
    let finalAnswer = '';
    try {
      finalAnswer = response.text || '';
    } catch (e) {
      // Ignore text extraction errors, or log them
    }

    return { answer: finalAnswer, context: toolContext, error: null };
  } catch (error: any) {
    return { answer: '', context: '', error: error.message };
  }
}
