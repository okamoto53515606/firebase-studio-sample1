import { NextResponse } from 'next/server';
import { dataAgent } from '@/ai/agent';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    console.log('[API] Received query:', query);
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // 修正: オブジェクト形式で渡す
    const result = await dataAgent({ query });
    console.log('[API] Sending response, answer length:', result.answer?.length);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error:', error.message, error.stack);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error.message 
    }, { status: 500 });
  }
}
