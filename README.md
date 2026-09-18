# Qualit 公開商品データ取得 PoC

## 結論

これは MakeShop 公式APIを使う版ではありません。
Qualitの公開トップページをVercel Functionから取得し、サーバーHTMLに出ている「新着商品」「おすすめ商品」の商品情報を抽出してJSON化するPoCです。

そのため、APIキー・トークン・Qualit側の管理画面権限は不要です。

## Vercelでの確認手順

1. このフォルダをGitHubリポジトリに入れるか、Vercelにインポートする
2. Framework Preset は `Other` のままでOK
3. Environment Variables は不要
4. Deployする
5. 公開URLを開く

`/api/products` にアクセスするとJSONが返り、`/` では商品カードとして表示されます。

## 取得元

- https://www.yrl-qualit.com/
- `#r_new` : 新着商品
- `#r_recommend` : おすすめ商品

QualitはEUC-JPなので、API側で `TextDecoder('euc-jp')` を使ってデコードしています。

## 注意

- HTMLの構造が変更されると取得ロジックの修正が必要です。
- awooのピックアップ商品はJavaScriptで後から描画される可能性があるため、このPoCでは対象外です。
- 本番運用では、MakeShop公式APIまたはQualit/awoo側から正式なデータ連携手段を取得できるなら、そちらを優先してください。
