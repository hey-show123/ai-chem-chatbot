#!/bin/bash

echo "🚀 ChemGPTをRenderにデプロイします..."

# Renderダッシュボードを開く
echo "📝 以下の手順でデプロイを完了してください："
echo ""
echo "1. Renderダッシュボードが開きます"
echo "2. 'New +' → 'Web Service' をクリック"
echo "3. GitHubリポジトリ 'hey-show123/ai-chem-chatbot' を選択"
echo "4. 以下の環境変数をコピー＆ペーストで設定してください："
echo ""
echo "========== 環境変数（コピー用） =========="

# .envファイルから環境変数を読み込んで表示
if [ -f .env ]; then
    while IFS= read -r line; do
        # コメント行と空行をスキップ
        if [[ ! "$line" =~ ^#.*$ ]] && [[ ! -z "$line" ]]; then
            echo "$line"
        fi
    done < .env
else
    echo "⚠️  .envファイルが見つかりません"
fi

echo "=========================================="
echo ""
echo "5. 'Create Web Service' をクリック"
echo ""
echo "📌 設定推奨値："
echo "   - Region: Singapore"
echo "   - Branch: main"
echo "   - Build Command: npm install"
echo "   - Start Command: npm start"
echo "   - Plan: Free"
echo ""
echo "Renderダッシュボードを開いています..."

# Renderダッシュボードを開く
open "https://dashboard.render.com/new/web" 