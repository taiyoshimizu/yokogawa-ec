# Qualit 動的商品カード PoC

Qualitのブログ記事に「商品コード」だけを保存し、表示時にMakeShopの商品情報を取り直して、商品名・価格・画像・在庫・販売状態を最新化するための最小PoCです。

## 構成

- `index.html`: 商品カード表示ページ
- `api/products.js`: Vercel Serverless Function。MakeShopの管理系GraphQL API `searchProduct` をサーバー側から呼びます。
- `awoo-sdk-test.html`: Qualitで使われているawoo顧客別スクリプトをそのまま読み込む最小テスト
- `.env.example`: 必要な環境変数

## 推奨構成

ブラウザ → `/api/products?codes=...` → MakeShop GraphQL API

MakeShopのBearer tokenとAPI keyはブラウザに置かず、VercelのEnvironment Variablesに保存します。APIリクエスト時に `x-timestamp` も付与します。

## MakeShop側の準備

1. MakeShopでAPI利用登録 / 利用申請を行う
2. 発行・通知されたGraphQL endpoint、Bearer token、API keyを取得する
3. Vercelに `MAKESHOP_API_ENDPOINT`、`MAKESHOP_API_TOKEN`、`MAKESHOP_API_KEY` を設定する
4. `ALLOWED_ORIGIN` をブログのオリジンに設定する

## ローカル確認

`index.html`は `/api/products` が必要なので、Vercel Dev等で実行してください。

例:

```bash
npm i -g vercel
vercel dev
```

## 記事への組み込み方

記事本文には商品コードだけ持たせます。

```html
<div class="qualit-products" data-product-codes="000000015488,000000013443"></div>
```

共通JSで `data-product-codes` を読み、`/api/products?codes=...` を呼び、カードHTMLに変換します。

## 在庫切れの扱い

APIレスポンスの `available` が `false` の商品は、

- 非表示にする
- 「販売終了」と表示する
- 同カテゴリの商品へ差し替える

のいずれかにできます。記事のメンテナンス負荷を下げるなら、最終的には「販売終了時に代替候補を返す」ロジックをAPI側に入れるのがおすすめです。

## awooについて

`awoo-sdk-test.html` は、Qualitで読み込まれている顧客別awooスクリプト `5344500543` を利用した表示テストです。awoo側の契約・許可ドメイン・テンプレート仕様に依存するため、ブログ本番のデータ基盤としてはMakeShop APIを推奨します。
