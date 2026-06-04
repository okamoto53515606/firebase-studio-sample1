# Analytics Agent Dashboard

本リポジトリは、Google AI Studio（Gemini API）を活用して、Google BigQueryおよびGoogle Analytics 4（GA4）のデータを分析するAIエージェントのサンプルアプリケーションです。

アプリの背景や詳細な解説については、こちらの記事をご覧ください：
👉 [【実録】既存のGA4分析サンプルアプリをGoogle AI Studioへ移行！エラー・コストと本音レビュー](https://www.okamomedia.tokyo/articles/google-ai-studio-migration-ga4-analytics-record)

---

## 🚀 セットアップ手順

開発環境で本アプリケーションを起動するための手順です。

### 1. 必要要件
- Node.js (v18以上推奨)
- Google Cloud プロジェクト (BigQuery の利用権限があること)
- Google Analytics 4 プロパティへの閲覧アクセス権限

### 2. 環境変数の設定
プロジェクトのルートディレクトリに `.env.local` ファイルを作成し、以下の環境変数を設定してください。
（`.env.example` をコピーして利用できます）

```env
# Gemini APIのアクセスキー（Google AI Studioから取得してください）
GEMINI_API_KEY=your_gemini_api_key_here

# 分析対象のGoogle Cloud プロジェクトID
BIGQUERY_PROJECT_ID=your_bigquery_project_id_here

# Google Analytics 4 のプロパティID（数字のみ）
GA_PROPERTY_ID=your_ga4_property_id_here
```

### 3. Google Cloud 認証 (ADC) の設定
BigQuery および GA4 API の呼び出しには、Google Cloud の **Application Default Credentials (ADC)** を使用します。
ローカル開発環境では、事前に以下のコマンドを実行して認証を完了させてください。

```bash
gcloud auth application-default login
```

※ もしくは、サービスアカウントのキー（JSON）を作成し、環境変数 `GOOGLE_APPLICATION_CREDENTIALS` にそのパスを設定してください。

### 4. 依存パッケージのインストールと起動

```bash
# パッケージのインストール
npm install

# 開発用サーバーの起動
npm run dev
```

起動後、 [http://localhost:3000](http://localhost:3000) にアクセスするとダッシュボードが表示されます。

---

## 📂 ディレクトリ構成の注意点

本リポジトリには、現在以下の2パターンのAI実装が含まれています。

- **`app/actions.ts` (現在のアクティブな実装)**:
  `@google/genai` (GoogleGenAI SDK) を直接使用し、GeminiのFunction Calling機能を軽量に実装しています。ダッシュボード画面から直接呼び出されるのはこちらです。
- **`ai/` (将来的なGenkit移行用コード)**:
  `@genkit-ai/google-genai` を使った、より拡張性の高いGenkitベースのツール・エージェント構成です。現在は本番画面からは呼び出されていませんが、今後の機能拡張の参考設計として残されています。
