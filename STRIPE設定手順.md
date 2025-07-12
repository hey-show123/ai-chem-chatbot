# ChemGPT - Stripe決済設定手順

## 1. Supabaseデータベースの設定

### SQL実行手順
1. [Supabaseダッシュボード](https://app.supabase.com)にログイン
2. プロジェクトを選択
3. 左側メニューの「SQL Editor」をクリック
4. `setup-database.sql`の内容をコピー＆ペースト
5. 「Run」をクリックして実行

## 2. Stripeの設定

### 価格の作成
1. [Stripeダッシュボード](https://dashboard.stripe.com)にログイン
2. 「商品」→「商品を追加」

#### 基本プラン（月額1,000円）
- **商品名**: ChemGPT Basic
- **価格**: ¥1,000/月
- **価格ID**: メモしておく（例：`price_1ABC...`）

#### プロプラン（月額3,000円）
- **商品名**: ChemGPT Pro
- **価格**: ¥3,000/月
- **価格ID**: メモしておく（例：`price_1DEF...`）

### Webhook設定
1. 「開発者」→「Webhook」→「エンドポイントを追加」
2. **エンドポイントURL**: `https://your-app.onrender.com/api/webhook/stripe`
3. **イベント選択**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. 「エンドポイントを追加」をクリック
5. **署名シークレット**をコピー

## 3. 環境変数の更新

`.env`ファイルを以下のように更新：

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_あなたの本番用シークレットキー
STRIPE_PUBLISHABLE_KEY=pk_live_あなたの本番用公開可能キー
STRIPE_WEBHOOK_SECRET=whsec_あなたのWebhook署名シークレット

# Stripe Price IDs（上で作成した価格ID）
STRIPE_PRICE_BASIC_MONTHLY=price_あなたの基本プラン価格ID
STRIPE_PRICE_PRO_MONTHLY=price_あなたのプロプラン価格ID
```

## 4. テスト環境での確認

### Stripeテストカード
開発環境では以下のテストカードを使用：
- **番号**: 4242 4242 4242 4242
- **有効期限**: 未来の日付
- **CVC**: 任意の3桁
- **郵便番号**: 任意の5桁

## 5. トラブルシューティング

### 「チェックアウトセッションの作成に失敗しました」エラー

**原因1: データベーステーブルがない**
- 解決: 上記のSQL実行手順を完了する

**原因2: 価格IDが正しくない**
- 解決: Stripeダッシュボードで価格IDを確認し、環境変数を更新

**原因3: ユーザーがログインしていない**
- 解決: ログイン後に再試行

**原因4: Stripeキーが正しくない**
- 解決: 本番環境では`sk_live_`、テスト環境では`sk_test_`で始まるキーを使用

### デバッグ方法
1. ブラウザの開発者ツール（F12）でネットワークタブを確認
2. `/api/subscription/create-checkout`のレスポンスを確認
3. サーバーログでエラーメッセージを確認

## 6. 本番環境へのデプロイ

1. Renderの環境変数に本番用のキーを設定
2. Stripeを本番モードに切り替え
3. Webhookエンドポイントを本番URLに更新

## サポート

問題が解決しない場合は、以下の情報と共にお問い合わせください：
- エラーメッセージのスクリーンショット
- ブラウザの開発者ツールのコンソールログ
- 使用しているブラウザとOS 
