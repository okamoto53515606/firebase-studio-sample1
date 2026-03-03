# Firebase Stdio Sample1 設定手順

## 📝 事前準備：メモ用のテキストファイルを用意してください

セットアップ中に、いくつかの**APIキー**や**設定値**をメモしておく必要があります。  
お手元にテキストエディタ（メモ帳など）を開いておくと便利です。

### メモする項目一覧

| 項目名 | メモするタイミング |
|--------|-------------------|
| Gemini API Key | 手順3 |
| プロジェクトID（studio-〜） | 手順9 |

---

> **💡 この手順書で使用するドメイン名について**
> 
> 以降の説明では、あなたのサイトのドメインが `test.okamomedia.tokyo` だと仮定して説明を進めます。  
> 実際の作業では、**ご自身で取得したドメイン名に置き換えて**ください。

---

## GCPコンソールにログイン

Google Cloud Platform（GCP）は、Googleが提供するクラウドサービスです。  
このシステムの基盤となります。

### 手順

1. Googleアカウントを持っていない場合は、先に作成してください
2. 以下のURLにアクセスしてログインします

👉 https://console.cloud.google.com/

![GCPコンソール](screenshot/gcp.png)

> **🎉 ここまでお疲れさまでした！**  
> GCPへのログインが完了しました。次はAI機能のためのAPIキーを取得します。

---

## 手順3: Gemini API Key を取得する

記事作成をAIがサポートするための「Gemini API Key」を取得します。

### 手順

1. 以下のURLにアクセスします

👉 https://aistudio.google.com/api-keys

2. 「APIキーを作成」ボタンをクリック

![APIキーを作成](screenshot/google_ai_studio_get_api_key.png)

3. APIキーが作成されたら、「コピー」ボタンをクリック

![APIキーをコピー](screenshot/google_ai_studio_get_api_key2.png)

4. **コピーしたAPIキーをメモ帳などに保存しておいてください**

> **⚠️ 重要**  
> このAPIキーは後で使用します。必ずメモしておいてください！

---

## 手順4: Firebase Studio でサイトを公開する

Firebase Studio を使って、まずは「Hello World」と表示されるだけのシンプルなサイトを公開します。  
これが、あなたのサイトの土台になります。

### 手順

1. 以下のURLにアクセスします

👉 https://studio.firebase.google.com/?hl=ja

2. 以下の文章を**そのままコピー＆ペースト**して、エンターキーを押します

```
App Name: MyHomepage
Core Features:
hello worldを表示するだけのアプリ
```

![Firebase Studio 初期画面](screenshot/FirebaseStudio1.png)

5. 「Prototype this App」ボタンをクリック

6. **数分待った後**、右上の「Publish」ボタンをクリック

![Publishボタン](screenshot/FirebaseStudio4.png)

> **⏰ 補足**  
> 処理には数分かかることがあります。画面が動いていれば、そのままお待ちください。

7. 「Create a Cloud Billing account」のリンクが表示されたら、クリックしてクレジットカード情報などを登録

![Billing設定](screenshot/FirebaseStudio5.png)

> **💳 課金について**  
> クレジットカードを登録しますが、このセットアップ手順で大きな費用は発生しません。  
> 無料枠の範囲内で十分に試すことができます。

8. 「Link Google Cloud Billing account」ボタンをクリック

![Billingリンク](screenshot/FirebaseStudio6.png)

9. 「Set up services」ボタンをクリック

![Set up services](screenshot/FirebaseStudio7.png)

10. 「Publish now」ボタンをクリック

![Publish now](screenshot/FirebaseStudio8.png)

11. 処理が終わったら、「Visit your app」の下のURLをクリック

![Visit your app](screenshot/FirebaseStudio9.png)

12. 「hello world」と表示されれば成功です！🎉

![Hello World](screenshot/HelloWorld.png)

> **🎉 素晴らしい！**  
> あなたのサイトが初めてインターネット上に公開されました！  

---

## 手順10: Firebase Studio でターミナルを開く

ここからは、Firebase Studio のターミナル（コマンド入力画面）を使って設定を行います。

> **💡 ターミナルとは？**  
> 黒い画面に文字を入力してコンピュータに命令を出す画面です。  
> 難しそうに見えますが、**コピー＆ペーストするだけ**なので安心してください！

### 手順

1. Firebase Studio で右上の「</>」をクリック

![コード画面へ](screenshot/Terminal1.png)

2. App overview の右の「×」ボタンをクリックして閉じる  
   次に、GEMINI の下の「＋」ボタンをクリック → 「New Chat」を選択

![New Chat](screenshot/Terminal2.png)

> **📌 ポイント**  
> 「New Chat」でGemini 3 Proに切り替えます。経験上、こちらの方がトラブルが少ないです。

3. 左上のハンバーガーメニュー（三本線マーク）から「Terminal」→「New Terminal」を選択

![新規ターミナル](screenshot/Terminal3.png)

4. ターミナルが表示されます

![ターミナル画面](screenshot/Terminal4.png)

---

## 手順11: Firebase Studioで作ったアプリのサービスアカウントを調べる
画像：screenshot/GCP_ServiceAcount.png
firebase-app-hosting-compute@studio-XXX.iam.gserviceaccount.com

---

## 手順12: GCPコンソールにてBigqueryのプロジェクトにてサービスアカウントに閲覧権限を追加する。
画像：screenshot/BigQuery_IAM.png
BigQuery ジョブユーザー
BigQuery データ閲覧者
BigQuery メタデータ閲覧者

---

## 手順13: GA4の管理画面にてGA4のサービスアカウントに閲覧権限を追加する。
画像：screenshot/GA4_IAM.png

---

## 手順14: 本番サイトに反映する

ここまでの設定を本番サイトに反映（デプロイ）します。

### 手順

1. 右上の「Publish」ボタンをクリック

![Publishボタン](screenshot/FirebaseStudio4.png)

2. 「Publish」ボタンをクリック

![Publish確認](screenshot/FirebaseStudio8.png)

> **⏰ デプロイには数分かかります**  
> 完了するまでお待ちください。

---
