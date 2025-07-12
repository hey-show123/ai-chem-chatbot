# Stripeテストモード設定手順

## 問題の説明
現在、ライブモードのAPIキーが設定されていますが、Stripeアカウントがまだ本番決済を受け付ける状態になっていないため、「Your account cannot currently make live charges」エラーが発生しています。

## 解決手順

### 1. StripeダッシュボードでテストAPIキーを取得

1. [Stripeダッシュボード](https://dashboard.stripe.com)にログイン
2. 右上の「テストデータを表示」スイッチをONにする
3. 「開発者」→「APIキー」をクリック
4. 以下のキーをコピー：
   - **公開可能キー**: `pk_test_`で始まるキー
   - **シークレットキー**: `sk_test_`で始まるキー

### 2. テスト用の商品と価格を作成

テストモードで以下の商品を作成：

#### 基本プラン
1. 「商品」→「商品を追加」
2. 商品名: `ChemGPT Basic (Test)`
3. 価格: ¥1,000/月
4. 作成後、価格IDをメモ（例：`price_1ABC...`）

#### プロプラン
1. 「商品」→「商品を追加」
2. 商品名: `ChemGPT Pro (Test)`
3. 価格: ¥3,000/月
4. 作成後、価格IDをメモ（例：`price_1DEF...`）

### 3. Webhook設定（テスト用）

1. 「開発者」→「Webhook」→「エンドポイントを追加」
2. エンドポイントURL:
   - ローカル開発: `http://localhost:3000/api/webhook/stripe`
   - 本番: `https://your-app.onrender.com/api/webhook/stripe`
3. イベント選択:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. 署名シークレットをコピー

### 4. 環境変数の更新

`.env`ファイルを以下のように更新：

```bash
# Stripe Configuration (TEST MODE)
STRIPE_SECRET_KEY=sk_test_あなたのテスト用シークレットキー
STRIPE_PUBLISHABLE_KEY=pk_test_あなたのテスト用公開可能キー
STRIPE_WEBHOOK_SECRET=whsec_あなたのWebhook署名シークレット

# Stripe Test Price IDs
STRIPE_PRICE_BASIC_MONTHLY=price_テスト用基本プラン価格ID
STRIPE_PRICE_PRO_MONTHLY=price_テスト用プロプラン価格ID
```

### 5. フロントエンドの更新

`public/index.html`のStripe初期化部分を確認し、公開可能キーが環境変数と一致していることを確認。

### 6. テストカード情報

テストモードでは以下のカードを使用：
- **成功するカード**: 4242 4242 4242 4242
- **認証が必要なカード**: 4000 0025 0000 3155
- **拒否されるカード**: 4000 0000 0000 9995

その他の項目：
- **有効期限**: 未来の任意の日付（例：12/34）
- **CVC**: 任意の3桁（例：123）
- **郵便番号**: 任意の5桁（例：12345）

## テスト手順

1. サーバーを再起動
2. ブラウザでアプリケーションにアクセス
3. アカウントを作成またはログイン
4. サブスクリプションプランを選択
5. テストカードで決済を完了

## 本番環境への移行

テストが完了したら：

1. Stripeアカウントの本番化設定を完了
2. 本番用のAPIキーと価格IDに切り替え
3. Webhook URLを本番URLに更新

## トラブルシューティング

### よくあるエラー

1. **「No such price」エラー**
   - 価格IDが正しいか確認
   - テストモードで作成した価格を使用しているか確認

2. **Webhook署名検証エラー**
   - Webhook署名シークレットが正しいか確認
   - リクエストボディが改変されていないか確認

3. **「Invalid API Key」エラー**
   - APIキーのプレフィックスを確認（`sk_test_`）
   - 環境変数が正しく読み込まれているか確認 