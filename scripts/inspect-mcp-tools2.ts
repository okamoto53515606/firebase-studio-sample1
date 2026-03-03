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
      console.log(`=== Tool: ${action?.name || 'unknown'} ===`);
      
      // Dump all top-level keys of __action
      if (action) {
        console.log('__action keys:', Object.keys(action));
        
        // Check metadata
        if (action.metadata) {
          console.log('metadata keys:', Object.keys(action.metadata));
          console.log('metadata.inputSchema:', JSON.stringify(action.metadata.inputSchema));
          console.log('metadata.outputSchema:', JSON.stringify(action.metadata.outputSchema));
        }
        
        // Check inputSchema directly on action
        console.log('action.inputSchema:', JSON.stringify(action.inputSchema));
        console.log('action.outputSchema:', JSON.stringify(action.outputSchema));
        
        // Check inputJsonSchema
        if (action.inputJsonSchema) {
          console.log('action.inputJsonSchema:', JSON.stringify(action.inputJsonSchema));
        }
      }

      // Also check the tool function itself for properties
      const toolAny = tool as any;
      const possibleSchemaKeys = ['inputSchema', 'outputSchema', '__inputSchema', '__outputSchema', 'schema', 'definition'];
      for (const key of possibleSchemaKeys) {
        if (toolAny[key] !== undefined) {
          console.log(`tool.${key}:`, JSON.stringify(toolAny[key]));
        }
      }

      // Full dump of __action (limited depth)
      try {
        const actionCopy: any = {};
        for (const key of Object.keys(action)) {
          const val = action[key];
          if (typeof val === 'function') {
            actionCopy[key] = '[Function]';
          } else {
            actionCopy[key] = val;
          }
        }
        console.log('__action full:', JSON.stringify(actionCopy, null, 2));
      } catch (e) {
        console.log('Could not stringify __action:', e);
      }
      
      console.log('');
    }
  } finally {
    await mcpHost.close();
  }
}

inspectMcpTools().catch(console.error);
