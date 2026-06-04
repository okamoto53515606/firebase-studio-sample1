これは解説用のサンプルアプリです。
サンプルアプリの詳細は
[【実録】既存のGA4分析サンプルアプリをGoogle AI Studioへ移行！エラー・コストと本音レビュー](https://www.okamomedia.tokyo/articles/google-ai-studio-migration-ga4-analytics-record)
をご覧下さい。

## セットアップ手順

初めて実行する方は、以下の手順で環境設定を行ってください。

1. プロジェクトルートにある `.env.example` をコピーして、`.env.local` を作成します。
   ```bash
   cp .env.example .env.local
   ```
2. 作成した `.env.local` を開き、Gemini APIキーやBigQuery、GA4の設定など、必要な環境変数を入力してください。
3. 依存関係をインストールして開発サーバーを起動します。
   ```bash
   npm install
   npm run dev
   ```
