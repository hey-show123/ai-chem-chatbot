#!/bin/bash

echo "📝 Renderの環境変数を更新します..."
echo ""
echo "1. Renderダッシュボードを開きます"
echo "2. Environment タブに移動"
echo "3. 以下の環境変数を追加してください："
echo ""
echo "========== 追加する環境変数 =========="
echo "STRIPE_WEBHOOK_SECRET = whsec_あなたのWebhookシークレット"
echo "======================================="
echo ""
echo "4. 'Save Changes' をクリック"
echo "5. サービスが自動的に再デプロイされます"
echo ""
echo "Renderダッシュボードを開いています..."

open "https://dashboard.render.com" 