# Firebase Studio Gemini 修正依頼プロンプト（GA4 MCP エラー修正 - 方針B v2）

以下をFirebase StudioのGeminiチャットにコピー&ペーストしてください。

---

## プロンプト本文

```
GA4 MCP連携でエラーが発生しています。根本原因を調査済みなので、以下の修正を行ってください。

## 根本原因の分析

### 原因1: MCPツールのスキーマに `properties` が未定義のオブジェクト型がある

`@genkit-ai/google-genai` の内部コンバーター `toGeminiSchemaProperty`（converters.ts 76行目付近）に以下のコードがあります:

```typescript
if (propertyType === 'object') {
  Object.keys(property.properties).forEach((key) => { // ← ここでクラッシュ
```

`type: "object"` のプロパティに対して `property.properties` を無条件に `Object.keys()` しています。

しかし、GA4 MCPサーバーの `ga4/runReport` ツールには以下のようなスキーマがあります:
```json
"dimensionFilter": {
  "type": "object",
  "description": "Filter for dimensions"
}
```
`properties` フィールドが存在しないため、`Object.keys(undefined)` でクラッシュします。

**重要**: この問題はトップレベルではなくネストされたプロパティで発生します。
ツール単位のフィルタリングでは解決できません。**スキーマ自体をパッチする必要があります**。

### 原因2: ツール名の変換による不整合（これは実は問題にならない）

`toGeminiTool` 内で `tool.name.replace(/\//g, '__')` により `ga4/runReport` → `ga4__runReport` に変換されます。
Genkitが内部的にこの変換を処理するため、通常は問題になりません。
ただし念のため、システムプロンプトにはGA4ツールの正式名（ga4/xxx）を明記してください。


## 修正内容

### 1. スキーマパッチユーティリティの作成 (`src/ai/mcp-schema-fix.ts` 新規)

MCPツールの `inputJsonSchema` を再帰的に走査し、`type: "object"` で `properties` が未定義のノードに
空の `properties: {}` を補完する関数を作成してください。

参考実装:
```typescript
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
```

### 2. エージェントフロー修正 (`src/ai/agent.ts`)

MCPホストからツールを取得した後、各ツールの `__action.inputJsonSchema` にパッチを適用してください。

参考実装:
```typescript
import { patchSchema } from '@/ai/mcp-schema-fix';

// MCPツール取得後にスキーマをパッチ
const ga4Tools = await mcpHost.getActiveTools(ai);
for (const tool of ga4Tools) {
  const action = (tool as any).__action;
  if (action?.inputJsonSchema) {
    action.inputJsonSchema = patchSchema(action.inputJsonSchema);
  }
}

// パッチ済みのツール名をログ出力
const ga4ToolNames = ga4Tools.map(t => (t as any).__action?.name || 'unknown');
console.log(`[MCP] GA4 tools (patched): ${ga4ToolNames.join(', ')}`);
```

### 3. システムプロンプト修正 (`src/ai/agent.ts` 内)

以下の内容をシステムプロンプトに追加:
- GA4ツールの利用可能一覧を動的に埋め込む
- GA4ツール名は `ga4/` プレフィックス付きであることを明記
- GA4のデータを使う場面（アクセス解析、PV、ユーザー行動など）を説明


## 修正対象ファイル
- `src/ai/mcp-schema-fix.ts` （新規作成）
- `src/ai/agent.ts` （修正）

## 修正後の期待動作
1. `ga4/runReport` の `dimensionFilter` 等、properties未定義のオブジェクト型スキーマが自動パッチされ、クラッシュが解消
2. パッチされたスキーマのログが出力され、どこが修正されたか確認可能
3. 全5つのGA4ツール（ga4/runReport, ga4/getPageViews, ga4/getActiveUsers, ga4/getEvents, ga4/getUserBehavior）が正常にエージェントで使用可能
4. BigQueryツールとGA4ツールが共存して正常動作
```

---
