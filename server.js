const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config({ override: true }); // 既存の環境変数を上書き

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

// Stripe Webhookのための生データ保存
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

// その他のルート用のJSON parser
app.use(express.json({ limit: '50mb' })); // 画像データ対応のため上限を増やす
app.use(cookieParser());
app.use(express.static('public'));

// Import AI clients
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

// Import Supabase and Stripe
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize AI clients
let openaiClient = null;
let geminiClient = null;
let anthropicClient = null;

// Helper function to initialize AI clients
function initializeClients() {
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  if (process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
}

initializeClients();

// 認証ミドルウェア
async function requireAuth(req, res, next) {
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: '無効なトークンです' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: '認証エラー' });
  }
}

// 画像解析用の関数
async function analyzeImageWithVisionModel(image, userPrompt) {
  try {
    // GPT-4o miniが利用可能な場合はそれを使用（最も安価）
    if (openaiClient) {
      const messages = [{
        role: 'user',
        content: [
          { 
            type: 'text', 
            text: `画像を詳細に解析してください。特に以下の点に注意してください：
- 化学構造式、化学式、反応式が含まれている場合は、それらを正確に記述
- 数式、グラフ、図表が含まれている場合は、その内容を詳細に説明
- テキストが含まれている場合は、全て書き起こし
- その他、画像に含まれる全ての重要な情報を記述

ユーザーからの質問: ${userPrompt}`
          },
          { type: 'image_url', image_url: { url: image } }
        ]
      }];
      
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini', // 最も安価な画像対応モデル
        messages: messages,
        temperature: 0.3, // 正確性を重視
        max_tokens: 1000
      });
      
      return response.choices[0].message.content;
    }
    
    // Geminiが利用可能な場合（次に安価）
    if (geminiClient) {
      const geminiModel = geminiClient.getGenerativeModel({ 
        model: 'gemini-2.5-flash' // 安価なモデル
      });
      
      const imageData = image.split(',')[1];
      const geminiInput = [
        `画像を詳細に解析してください。特に以下の点に注意してください：
- 化学構造式、化学式、反応式が含まれている場合は、それらを正確に記述
- 数式、グラフ、図表が含まれている場合は、その内容を詳細に説明
- テキストが含まれている場合は、全て書き起こし
- その他、画像に含まれる全ての重要な情報を記述

ユーザーからの質問: ${userPrompt}`,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageData
          }
        }
      ];
      
      const result = await geminiModel.generateContent(geminiInput);
      const response = await result.response;
      return response.text();
    }
    
    throw new Error('画像解析用のAPIが利用できません');
  } catch (error) {
    console.error('画像解析エラー:', error);
    throw error;
  }
}

// デバッグ: APIキーの状態を確認
console.log('API Keys loaded:');
console.log('- OpenAI:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'Not set');
console.log('- Gemini:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'Not set');
console.log('- Anthropic:', process.env.ANTHROPIC_API_KEY ? `${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...` : 'Not set');

// Check available APIs endpoint
app.get('/api/available-apis', (req, res) => {
  const available = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY
  };
  res.json(available);
});

// Get Stripe publishable key
app.get('/api/stripe-key', (req, res) => {
  res.json({ 
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
  });
});

// 認証関連のエンドポイント
// サインアップ
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, fullName } = req.body;
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    
    if (error) throw error;
    
    res.json({ 
      message: '確認メールを送信しました。メールを確認してください。',
      user: data.user 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ログイン
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // アクセストークンをクッキーに設定
    res.cookie('access_token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000 // 7日間
    });
    
    res.json({ 
      user: data.user,
      session: data.session 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// ログアウト
app.post('/api/auth/logout', async (req, res) => {
  res.clearCookie('access_token');
  res.json({ message: 'ログアウトしました' });
});

// 現在のユーザー情報を取得
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    // プロフィールとサブスクリプション情報を取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();
    
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .single();
    
    res.json({
      user: req.user,
      profile,
      subscription
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
  }
});

// サブスクリプション関連のエンドポイント
// Checkout Session作成（サブスクリプション開始）
app.post('/api/subscription/create-checkout', requireAuth, async (req, res) => {
  const { plan } = req.body;
  
  console.log('Create checkout request:', { userId: req.user.id, plan });
  
  try {
    // Stripeカスタマーを作成または取得
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.user.id)
      .maybeSingle();
    
    console.log('Subscription lookup result:', { subscription, error: subError });
    
    // サブスクリプションレコードが存在しない場合は作成
    if (!subscription || subError?.code === 'PGRST116') {
      console.log('Creating new subscription record for user:', req.user.id);
      
      const { data: newSubscription, error: createError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: req.user.id,
          plan: 'free',
          status: 'active'
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create subscription record:', createError);
        throw new Error('サブスクリプションレコードの作成に失敗しました');
      }
      
      subscription = newSubscription;
    }
    
    let customerId = subscription?.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          supabase_user_id: req.user.id
        }
      });
      customerId = customer.id;
      
      // StripeカスタマーIDを保存
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', req.user.id);
    }
    
    // 価格IDを取得
    const priceId = plan === 'basic' 
      ? process.env.STRIPE_PRICE_BASIC_MONTHLY 
      : process.env.STRIPE_PRICE_PRO_MONTHLY;
    
    console.log('Price ID:', priceId);
    console.log('Customer ID:', customerId);
    
    // Stripeのモードを確認
    const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
    if (!isTestMode) {
      // 本番モードの場合の警告
      console.warn('⚠️  WARNING: Using live Stripe keys but account may not be activated');
    }
    
    // Checkout Sessionを作成
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${req.headers.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/subscription/cancel`,
      metadata: {
        user_id: req.user.id,
        plan: plan
      }
    });
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Create checkout error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      type: error.type,
      statusCode: error.statusCode
    });
    
    // Stripeアカウントが有効化されていない場合の特別なメッセージ
    let errorMessage = 'チェックアウトセッションの作成に失敗しました';
    let errorDetails = error.message;
    
    if (error.message?.includes('Your account cannot currently make live charges')) {
      errorMessage = 'Stripeアカウントが本番環境で有効化されていません';
      errorDetails = 'テストモードを使用するか、Stripeアカウントの本人確認を完了してください。詳細は「STRIPE_テストモード設定.md」を参照してください。';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails 
    });
  }
});

// サブスクリプションのキャンセル
app.post('/api/subscription/cancel', requireAuth, async (req, res) => {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', req.user.id)
      .single();
    
    if (!subscription?.stripe_subscription_id) {
      return res.status(400).json({ error: 'アクティブなサブスクリプションがありません' });
    }
    
    // Stripeでサブスクリプションをキャンセル（期間終了時）
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true }
    );
    
    // DBを更新
    await supabase
      .from('subscriptions')
      .update({ 
        cancel_at_period_end: true,
        status: 'cancelled'
      })
      .eq('user_id', req.user.id);
    
    res.json({ 
      message: '現在の請求期間の終了時にサブスクリプションがキャンセルされます',
      subscription: updatedSubscription 
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'サブスクリプションのキャンセルに失敗しました' });
  }
});

// カスタマーポータル（Stripe）へのリダイレクト
app.post('/api/subscription/portal', requireAuth, async (req, res) => {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.user.id)
      .single();
    
    if (!subscription?.stripe_customer_id) {
      return res.status(400).json({ error: 'Stripeカスタマーが見つかりません' });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${req.headers.origin}/account`
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({ error: 'ポータルセッションの作成に失敗しました' });
  }
});

// Stripe Webhookエンドポイント
app.post('/api/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // イベントの処理
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const plan = session.metadata.plan;
        
        // サブスクリプション情報を更新
        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: session.subscription,
            plan: plan,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('user_id', userId);
        
        console.log('Subscription activated for user:', userId);
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // サブスクリプションステータスを更新
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        
        console.log('Subscription updated:', subscription.id);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        // サブスクリプションを無料プランに戻す
        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: null,
            plan: 'free',
            status: 'active',
            cancel_at_period_end: false
          })
          .eq('stripe_subscription_id', subscription.id);
        
        console.log('Subscription cancelled:', subscription.id);
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

// 使用状況の記録（認証必須のChat endpointに変更）
app.post('/api/chat', requireAuth, async (req, res) => {
  const { message, apiType, model, image } = req.body;
  
  try {
    // サブスクリプション状態を確認
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .single();
    
    // 月間使用量を確認
    const now = new Date();
    const { data: monthlyUsage } = await supabase
      .from('monthly_usage')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('year', now.getFullYear())
      .eq('month', now.getMonth() + 1)
      .single();
    
    // プランに応じた制限を確認
    const limits = {
      free: { cost: 0.50, models: ['gpt-4o', 'gemini-2.5-flash', 'claude-3.7-sonnet'] },
      basic: { cost: 10.00, models: null }, // 全モデル利用可
      pro: { cost: 50.00, models: null }    // 全モデル利用可
    };
    
    const planLimit = limits[subscription.plan] || limits.free;
    const currentUsage = monthlyUsage?.total_cost || 0;
    
    // モデル制限チェック
    if (planLimit.models && !planLimit.models.includes(model)) {
      return res.status(403).json({ 
        error: 'このモデルはプレミアムプラン限定です',
        availableModels: planLimit.models
      });
    }
    
    // コスト制限チェック
    const estimatedCost = 0.01; // 実際にはモデルごとのコストを計算
    if (currentUsage + estimatedCost > planLimit.cost) {
      return res.status(403).json({ 
        error: 'クレジット制限に達しました',
        currentUsage,
        limit: planLimit.cost
      });
    }
    
    let response;
    let finalMessage = message;
    
    // 画像がある場合、まず画像を解析
    if (image) {
      try {
        const imageAnalysis = await analyzeImageWithVisionModel(image, message);
        // 解析結果を含めたプロンプトを生成
        finalMessage = `以下は画像の解析結果です：
---
${imageAnalysis}
---

上記の画像解析結果を踏まえて、以下の質問に答えてください：
${message}`;
        
        console.log('画像解析完了、メインモデルに送信:', finalMessage.substring(0, 200) + '...');
      } catch (error) {
        console.error('画像解析に失敗しました:', error);
        // 画像解析に失敗した場合は、元のメッセージをそのまま使用
        finalMessage = message + '\n\n（注：画像の解析に失敗しました）';
      }
    }
    
    switch(apiType) {
      case 'openai':
        if (!openaiClient) {
          throw new Error('OpenAI APIキーが.envファイルに設定されていません');
        }
        
        // 画像解析済みの場合は、テキストのみのメッセージとして送信
        const messages = [{ role: 'user', content: finalMessage }];
        
        const openaiResponse = await openaiClient.chat.completions.create({
          model: model || 'gpt-3.5-turbo',
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        });
        response = openaiResponse.choices[0].message.content;
        break;
        
      case 'gemini':
        if (!geminiClient) {
          throw new Error('Gemini APIキーが.envファイルに設定されていません');
        }
        
        const geminiModel = geminiClient.getGenerativeModel({ 
          model: model || 'gemini-pro' 
        });
        
        // 画像解析済みの場合は、テキストのみで送信
        const geminiResult = await geminiModel.generateContent(finalMessage);
        const geminiResponse = await geminiResult.response;
        response = geminiResponse.text();
        break;
        
      case 'anthropic':
        if (!anthropicClient) {
          throw new Error('Anthropic APIキーが.envファイルに設定されていません');
        }
        
        // 画像解析済みの場合は、テキストのみで送信
        const anthropicMessages = [{ role: 'user', content: finalMessage }];
        
        const anthropicResponse = await anthropicClient.messages.create({
          model: model || 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: anthropicMessages
        });
        response = anthropicResponse.content[0].text;
        break;
        
      default:
        throw new Error('不明なAPIタイプです');
    }
    
    // 使用状況を記録
    await supabase
      .from('usage_logs')
      .insert({
        user_id: req.user.id,
        api_type: apiType,
        model: model,
        cost: estimatedCost,
        tokens_used: 1500 // 概算
      });
    
    // 月間使用量を更新
    if (monthlyUsage) {
      await supabase
        .from('monthly_usage')
        .update({
          total_cost: monthlyUsage.total_cost + estimatedCost,
          message_count: monthlyUsage.message_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', monthlyUsage.id);
    } else {
      await supabase
        .from('monthly_usage')
        .insert({
          user_id: req.user.id,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          total_cost: estimatedCost,
          message_count: 1
        });
    }
    
    res.json({ response });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: error.message || 'エラーが発生しました' 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`サーバーが http://localhost:${PORT} で起動しました`);
}); 