import { createMcpHost } from '@genkit-ai/mcp';

function buildGa4Env(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (process.env.GA_PROPERTY_ID) {
    env.GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  return env;
}

export const mcpHost = createMcpHost({
  name: 'ga4McpHost',
  mcpServers: {
    ga4: {
      command: 'npx',
      args: ['-y', 'mcp-server-ga4'],
      env: buildGa4Env(),
    },
  },
});
