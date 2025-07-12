#!/bin/bash

echo "🔧 Stripeテストモード設定スクリプト"
echo "===================================="
echo ""
echo "このスクリプトは、Stripeのテストモード用の環境変数を設定するためのガイドです。"
echo ""
echo "⚠️  重要: 以下の手順を実行する前に、Stripeダッシュボードにログインしてください。"
echo ""
echo "1. Stripeダッシュボードを開く:"
echo "   https://dashboard.stripe.com"
echo ""
echo "2. 右上の「テストデータを表示」スイッチをONにする"
echo ""
echo "3. 「開発者」→「APIキー」に移動"
echo ""
echo "4. 以下のキーをコピー:"
echo "   - 公開可能キー: pk_test_... で始まるキー"
echo "   - シークレットキー: sk_test_... で始まるキー"
echo ""
echo "5. テストモードで商品と価格を作成:"
echo "   a. 「商品」→「商品を追加」"
echo "   b. 基本プラン（月額1,000円）を作成"
echo "   c. プロプラン（月額3,000円）を作成"
echo "   d. 各価格IDをメモ"
echo ""
echo "6. Webhook設定（ローカル開発用）:"
echo "   a. 「開発者」→「Webhook」→「エンドポイントを追加」"
echo "   b. URL: http://localhost:3000/api/webhook/stripe"
echo "   c. イベント: checkout.session.completed, customer.subscription.*"
echo "   d. 署名シークレットをコピー"
echo ""
echo "環境変数のテンプレート:"
echo "====================="
cat << 'EOF'

# .envファイルに以下を追加（既存の値を置き換え）:

# Stripe Configuration (TEST MODE)
STRIPE_SECRET_KEY=sk_test_あなたのテスト用シークレットキー
STRIPE_PUBLISHABLE_KEY=pk_test_あなたのテスト用公開可能キー
STRIPE_WEBHOOK_SECRET=whsec_あなたのWebhook署名シークレット

# Stripe Test Price IDs
STRIPE_PRICE_BASIC_MONTHLY=price_テスト用基本プラン価格ID
STRIPE_PRICE_PRO_MONTHLY=price_テスト用プロプラン価格ID

EOF

echo ""
echo "📝 注意事項:"
echo "- テストモードではテストカード（4242 4242 4242 4242）を使用"
echo "- 本番環境への移行時は、ライブモードのキーに切り替える"
echo "- 環境変数を変更後、サーバーを再起動する"
echo ""

# .envファイルのバックアップ確認
if [ -f ".env.backup" ]; then
    echo "✅ .envファイルのバックアップが存在します: .env.backup"
else
    echo "⚠️  .envファイルのバックアップを作成することを推奨します:"
    echo "   cp .env .env.backup"
fi

echo ""
echo "次のステップ:"
echo "1. 上記の情報を使って.envファイルを更新"
echo "2. npm start でサーバーを再起動"
echo "3. ブラウザでアプリケーションをテスト" 