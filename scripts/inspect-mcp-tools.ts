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

async function inspectMcpTools() {
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
    console.log('Fetching GA4 MCP tools...');
    const tools = await mcpHost.getActiveTools(ai);
    console.log(`Found ${tools.length} tools\n`);

    for (const tool of tools) {
      const action = (tool as any).__action;
      const name = action?.name || 'unknown';
      const desc = action?.description || '';
      const inputSchema = action?.metadata?.inputSchema;

      console.log(`=== Tool: ${name} ===`);
      console.log(`Description: ${desc}`);
      console.log(`InputSchema (full JSON):`);
      console.log(JSON.stringify(inputSchema, null, 2));
      console.log('');

      // Deep check for null properties
      function checkNullProperties(obj: any, path: string) {
        if (obj === null || obj === undefined) {
          console.log(`  *** NULL/UNDEFINED at path: ${path}`);
          return;
        }
        if (typeof obj !== 'object') return;
        
        if (obj.type === 'object' && (obj.properties === null || obj.properties === undefined)) {
          console.log(`  *** PROBLEM: type=object but properties=${obj.properties} at path: ${path}`);
        }
        
        if (obj.properties && typeof obj.properties === 'object') {
          for (const key of Object.keys(obj.properties)) {
            checkNullProperties(obj.properties[key], `${path}.properties.${key}`);
          }
        }
        if (obj.items) {
          checkNullProperties(obj.items, `${path}.items`);
        }
      }
      
      checkNullProperties(inputSchema, 'root');
    }
  } finally {
    await mcpHost.close();
  }
}

inspectMcpTools().catch(console.error);
