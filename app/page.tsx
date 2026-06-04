'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { runAgentAction } from '@/app/actions';

export default function Page() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRun = async () => {
    setLoading(true);
    setResult('');
    setContext('');
    setError('');
    
    const res = await runAgentAction(query);
    if (res.error) {
       setError(res.error);
    } else {
       setResult(res.answer);
       setContext(res.context);
    }
    setLoading(false);
  };
  
  return (
    <div className="max-w-4xl mx-auto py-10 px-6 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">データ分析AIエージェント</h1>
      <div className="flex flex-col gap-4">
        <textarea 
           value={query} 
           onChange={e => setQuery(e.target.value)} 
           className="w-full border rounded-lg p-3 min-h-[100px]"
           placeholder="BigQueryやGA4のデータについて質問してね！ 例: 今週のアクセス数は？"
        />
        <button 
           onClick={handleRun} 
           disabled={loading || !query}
           className="bg-black text-white px-6 py-2 rounded-md w-fit font-medium disabled:opacity-50"
        >
          {loading ? '考え中...' : '質問する'}
        </button>
      </div>

      {error && (
        <div className="mt-8 p-4 bg-red-50 text-red-600 rounded-lg">
          <p className="font-semibold">エラーが発生したわ😩:</p>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {context && (
        <div className="mt-8 p-4 bg-gray-50 text-gray-600 rounded-lg text-sm border">
          <p className="font-semibold mb-2">エージェントの思考プロセス (Internal Actions):</p>
          <pre>{context}</pre>
        </div>
      )}

      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">回答結果</h2>
          <div className="prose prose-slate max-w-none prose-table:border-collapse prose-th:border prose-th:bg-slate-100 prose-th:px-4 prose-th:py-2 prose-td:border prose-td:px-4 prose-td:py-2 text-gray-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
