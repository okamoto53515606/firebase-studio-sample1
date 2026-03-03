import * as dotenv from 'dotenv';
dotenv.config();

import { createMcpHost } from '@genkit-ai/mcp';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});

function buildGa4Env(): Record<string, string> {
  const env: Record<string, string> = {};
  if (process.env.GA_PROPERTY_ID) {
    env.GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  return env;
}

async function testGa4Direct() {
  const mcpHost = createMcpHost({
    name: 'ga4McpHost',
    mcpServers: {
      ga4: {
        command: 'npx',
        args: ['-y', 'mcp-server-ga4'],
        env: buildGa4Env(),
      },
    },
  });

  try {
    const tools = await mcpHost.getActiveTools(ai);
    console.log(`Found ${tools.length} tools`);

    // Find getActiveUsers tool
    const getActiveUsers = tools.find(t => (t as any).__action?.name === 'ga4/getActiveUsers');
    if (!getActiveUsers) {
      console.error('ga4/getActiveUsers not found');
      return;
    }

    // Test 1: getActiveUsers with simple params
    console.log('\n=== Test 1: ga4/getActiveUsers ===');
    try {
      const result1 = await getActiveUsers({ startDate: '2026-03-03', endDate: '2026-03-04' });
      console.log('SUCCESS:', JSON.stringify(result1, null, 2));
    } catch (e: any) {
      console.error('FAILED:', e.message);
    }

    // Test 2: getPageViews
    const getPageViews = tools.find(t => (t as any).__action?.name === 'ga4/getPageViews');
    if (getPageViews) {
      console.log('\n=== Test 2: ga4/getPageViews (no dimensions) ===');
      try {
        const result2 = await getPageViews({ startDate: '2026-03-01', endDate: '2026-03-04' });
        console.log('SUCCESS:', JSON.stringify(result2, null, 2));
      } catch (e: any) {
        console.error('FAILED:', e.message);
      }

      console.log('\n=== Test 3: ga4/getPageViews (with dimensions) ===');
      try {
        const result3 = await getPageViews({ startDate: '2026-03-01', endDate: '2026-03-04', dimensions: ['date'] });
        console.log('SUCCESS:', JSON.stringify(result3, null, 2));
      } catch (e: any) {
        console.error('FAILED:', e.message);
      }
    }

    // Test 4: getEvents
    const getEvents = tools.find(t => (t as any).__action?.name === 'ga4/getEvents');
    if (getEvents) {
      console.log('\n=== Test 4: ga4/getEvents ===');
      try {
        const result4 = await getEvents({ startDate: '2026-03-01', endDate: '2026-03-04' });
        console.log('SUCCESS:', JSON.stringify(result4, null, 2));
      } catch (e: any) {
        console.error('FAILED:', e.message);
      }
    }

    // Test 5: getUserBehavior
    const getUserBehavior = tools.find(t => (t as any).__action?.name === 'ga4/getUserBehavior');
    if (getUserBehavior) {
      console.log('\n=== Test 5: ga4/getUserBehavior ===');
      try {
        const result5 = await getUserBehavior({ startDate: '2026-03-01', endDate: '2026-03-04' });
        console.log('SUCCESS:', JSON.stringify(result5, null, 2));
      } catch (e: any) {
        console.error('FAILED:', e.message);
      }
    }

    // Test 6: runReport with object arrays
    const runReport = tools.find(t => (t as any).__action?.name === 'ga4/runReport');
    if (runReport) {
      console.log('\n=== Test 6: ga4/runReport (object array metrics/dimensions) ===');
      try {
        const result6 = await runReport({
          startDate: '2026-03-01',
          endDate: '2026-03-04',
          metrics: [{ name: 'activeUsers' }],
          dimensions: [{ name: 'date' }],
        });
        console.log('SUCCESS:', JSON.stringify(result6, null, 2));
      } catch (e: any) {
        console.error('FAILED:', e.message);
      }

      // Test 7: runReport with string metrics (to see if this is what's expected)
      console.log('\n=== Test 7: ga4/runReport (string array metrics - alternative) ===');
      try {
        const result7 = await runReport({
          startDate: '2026-03-01',
          endDate: '2026-03-04',
          metrics: ['activeUsers'],
          dimensions: ['date'],
        });
        console.log('SUCCESS:', JSON.stringify(result7, null, 2));
      } catch (e: any) {
        console.error('FAILED:', e.message);
      }
    }

  } finally {
    await mcpHost.close();
  }
}

testGa4Direct().catch(console.error);
