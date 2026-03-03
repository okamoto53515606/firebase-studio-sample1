/**
 * MCPツールのJSON Schemaを再帰的にパッチし、
 * type: "object" で properties が未定義のノードに properties: {} を追加する。
 * これにより @genkit-ai/google-genai の toGeminiSchemaProperty でのクラッシュを防ぐ。
 */
export function patchSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  
  const patched = { ...schema };
  
  if (patched.type === 'object' && !patched.properties) {
    patched.properties = {};
    console.log(`[MCP Schema Patch] Added empty properties to object schema: ${patched.description || '(no description)'}`);
  }
  
  if (patched.properties && typeof patched.properties === 'object') {
    const patchedProps: Record<string, any> = {};
    for (const [key, value] of Object.entries(patched.properties)) {
      patchedProps[key] = patchSchema(value);
    }
    patched.properties = patchedProps;
  }
  
  if (patched.items) {
    patched.items = patchSchema(patched.items);
  }
  
  return patched;
}
