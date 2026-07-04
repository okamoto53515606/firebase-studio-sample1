# Analytics Agent Dashboard

これは、Google AI StudioのGeminiモデルを活用した、Google Analytics 4（GA4）およびGoogle BigQueryのデータを自然言語で分析できるサンプルアプリケーションです。

詳細な解説や背景については、以下の記事をご覧ください。
[【実録】既存のGA4分析サンプルアプリをGoogle AI Studioへ移行！エラー・コストと本音レビュー](https://www.okamomedia.tokyo/articles/google-ai-studio-migration-ga4-analytics-record)

---

## セットアップ手順

後続の開発者の皆様がスムーズに開発を開始できるように、セットアップ手順を記載します。

### 1. 必要環境の準備
本アプリケーションは、Google Cloud（BigQuery）およびGoogle Analytics 4のデータを取得します。あらかじめ、アクセス権限を持つサービスアカウントの鍵をダウンロードするか、Application Default Credentials (ADC) をローカル環境に構成してください。

### 2. 環境変数の設定
プロジェクトのルートディレクトリに `.env.local` ファイルを作成し、以下の必要な環境変数を定義します。(`.env.example` を参考にしてください)

```env
# Gemini APIを使用するためのAPIキー
GEMINI_API_KEY=your_gemini_api_key_here

# 対象とするBigQueryのGoogle CloudプロジェクトID
BIGQUERY_PROJECT_ID=your_gcp_project_id_here

# 対象とするGoogle Analytics 4のプロパティID
GA_PROPERTY_ID=your_ga_property_id_here
```

### 3. 依存ライブラリのインストール
以下のコマンドを実行して、必要なパッケージをインストールします。

```bash
npm install
```

### 4. 開発サーバーの起動
ローカル環境でアプリケーションを起動します。

```bash
npm run dev
```

起動後、ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスすると、ダッシュボード画面が表示されます。

---

## 開発者向けライセンスと注意事項
- このコードは解説用のサンプルです。本番環境への導入時には、セキュリティ制限（SQLインジェクション対策やアクセス権制限）を詳細に検証してください。
- 破壊的なクエリ（INSERT/UPDATE/DELETEなど）の実行を防ぐ簡易的なバリデーションを導入していますが、サービスアカウントの権限自体を「閲覧のみ」に設定することを強く推奨します。
