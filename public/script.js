// Supabaseクライアントの初期化
const supabase = window.supabase.createClient(
    window.ENV.SUPABASE_URL,
    window.ENV.SUPABASE_ANON_KEY
);

// 現在のユーザー情報
let currentUser = null;

// DOM要素の取得
const elements = {
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeModal: document.getElementById('closeModal'),
    apiSelect: document.getElementById('apiSelect'),
    modelSelect: document.getElementById('modelSelect'),
    modelGroup: document.getElementById('modelGroup'),
    saveSettings: document.getElementById('saveSettings'),
    menuToggle: document.getElementById('menuToggle'),
    sidebar: document.querySelector('.sidebar'),
    clearChat: document.getElementById('clearChat'),
    toggleTheme: document.getElementById('toggleTheme'),
    charCount: document.getElementById('charCount'),
    newChatBtn: document.querySelector('.new-chat-btn'),
    todayHistory: document.getElementById('todayHistory'),
    yesterdayHistory: document.getElementById('yesterdayHistory'),
    weekHistory: document.getElementById('weekHistory'),
    // サブスクリプション関連
    subscriptionBtn: document.getElementById('subscriptionBtn'),
    subscriptionModal: document.getElementById('subscriptionModal'),
    closeSubscriptionModal: document.getElementById('closeSubscriptionModal'),
    basicPlanBtn: document.getElementById('basicPlanBtn'),
    proPlanBtn: document.getElementById('proPlanBtn'),
    subscriptionStatus: document.getElementById('subscriptionStatus'),
    currentPlan: document.getElementById('currentPlan'),
    managePlanBtn: document.getElementById('managePlanBtn'),
    // クレジット関連
    creditDisplay: document.getElementById('creditDisplay'),
    creditInfo: document.querySelector('.credit-info'),
    // 画像アップロード関連
    imageBtn: document.getElementById('imageBtn'),
    imageInput: document.getElementById('imageInput'),
    attachedImage: document.getElementById('attachedImage'),
    previewImage: document.getElementById('previewImage'),
    removeImageBtn: document.getElementById('removeImageBtn'),
    // フォントサイズ関連
    fontSizeSelect: document.getElementById('fontSizeSelect'),
    // 認証関連
    authBtn: document.getElementById('authBtn'),
    authBtnText: document.getElementById('authBtnText'),
    authModal: document.getElementById('authModal'),
    closeAuthModal: document.getElementById('closeAuthModal'),
    authForm: document.getElementById('authForm'),
    authEmail: document.getElementById('authEmail'),
    authPassword: document.getElementById('authPassword'),
    authFullName: document.getElementById('authFullName'),
    fullNameGroup: document.getElementById('fullNameGroup'),
    authTitle: document.getElementById('authTitle'),
    authSubmitBtn: document.getElementById('authSubmitBtn'),
    authError: document.getElementById('authError'),
    userInfo: document.getElementById('userInfo'),
    userEmail: document.getElementById('userEmail')
};

// 設定の保存と読み込み
const settings = {
    apiType: localStorage.getItem('apiType') || '',
    model: localStorage.getItem('model') || '',
    fontSize: localStorage.getItem('fontSize') || '16'
};

// 画像アップロードの状態
let attachedImageData = null;

// チャット履歴
let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
let currentChatId = null;
let currentChat = [];

// 利用可能なAPI
let availableApis = {};

// IME（日本語入力）の状態を管理
let isComposing = false;

// Stripeの初期化（サーバーから動的に取得）
let stripe = null;
async function initializeStripe() {
    try {
        const response = await fetch('/api/stripe-key');
        const data = await response.json();
        
        if (data.publishableKey && typeof Stripe !== 'undefined') {
            stripe = Stripe(data.publishableKey);
            console.log('Stripe initialized successfully');
        } else {
            console.warn('Stripe publishable key not found or Stripe.js not loaded');
        }
    } catch (error) {
        console.error('Failed to initialize Stripe:', error);
    }
}

// サブスクリプション情報
let subscriptionInfo = {
    plan: localStorage.getItem('subscriptionPlan') || 'free',
    expiresAt: localStorage.getItem('subscriptionExpires') || null,
    messageCount: parseInt(localStorage.getItem('messageCount') || '0'),
    resetDate: localStorage.getItem('resetDate') || new Date().toISOString().split('T')[0],
    credits: parseInt(localStorage.getItem('userCredits') || '50'), // 無料ユーザーは50クレジット
    creditResetDate: localStorage.getItem('creditResetDate') || new Date().toISOString().split('T')[0]
};

// メッセージ制限
const MESSAGE_LIMITS = {
    free: 10,      // 無料プラン: 1日10回
    basic: 100,    // 基本プラン: 月100回
    pro: Infinity  // プロプラン: 無制限
};

// クレジット制限
const CREDIT_LIMITS = {
    free: 50,      // 無料プラン: 50クレジット/月
    basic: 1000,   // 基本プラン: 1,000クレジット/月
    pro: 5000      // プロプラン: 5,000クレジット/月
};

// 無料プランで使用可能なモデル
const FREE_MODELS = [
    'gpt-4o',           // OpenAI
    'gemini-2.5-flash', // Google
    'claude-3.7-sonnet' // Anthropic
];

// モデルごとのコスト（1リクエストあたりの推定クレジット）
// 平均1000入力トークン + 500出力トークンと仮定
// 1ドル = 100クレジット換算
const MODEL_COSTS = {
    // OpenAI
    'gpt-4o': 3.75,                      // 3.75クレジット
    'o3-pro': 5.00,                      // 推定: 最高性能モデル
    'o3': 4.00,                          // 推定: 高性能モデル
    'gpt-4.1': 3.50,                     // 推定: GPT-4o相当
    'o4-mini-high': 2.00,                // 推定: 中間モデル
    'o4-mini': 1.00,                     // 推定: 軽量モデル
    'gpt-4.1-mini': 0.80,                // 推定: 軽量モデル
    'gpt-3.5-turbo': 0.20,               // 0.2クレジット
    
    // Gemini
    'gemini-2.5-pro': 4.00,              // 推定: 最高性能
    'gemini-2.5-flash': 2.00,            // 推定: 高速版
    'gemini-2.0-flash': 1.50,            // 推定: 標準版
    'gemini-2.0-flash-preview-image-generation': 2.50, // 画像生成は高め
    'gemini-1.5-pro': 1.00,              // レガシー
    'gemini-1.5-flash': 0.50,            // レガシー高速
    
    // Anthropic
    'claude-opus-4': 6.00,               // 最高性能モデル
    'claude-sonnet-4': 3.00,             // バランス型
    'claude-3.7-sonnet': 2.50,           // ハイブリッド
    'claude-3.5-sonnet': 2.00,           // 標準
    'claude-3.5-haiku': 1.00,            // 高速
    'claude-3-opus-20240229': 1.50,      // レガシー高性能
    'claude-3-sonnet-20240229': 0.80,    // レガシーバランス
    'claude-3-haiku-20240307': 0.30      // レガシー高速
};

// SmilesDrawerの初期化
let smilesDrawer = null;
if (typeof SmilesDrawer !== 'undefined') {
    // SmilesDrawer v1.2.0の初期化
    try {
        smilesDrawer = new SmilesDrawer.Drawer({
            width: 400,
            height: 400
        });
        console.log('SmilesDrawer initialized successfully');
    } catch (error) {
        console.error('SmilesDrawer initialization error:', error);
    }
}

// モデルの定義（2025年7月最新）
const models = {
    openai: [
        { value: 'gpt-4o', name: 'GPT-4o (最新・マルチモーダル)' },
        { value: 'o3-pro', name: 'o3-pro (高度な推論)' },
        { value: 'o3', name: 'o3 (推論特化)' },
        { value: 'gpt-4.1', name: 'GPT-4.1 (コーディング特化)' },
        { value: 'o4-mini-high', name: 'o4-mini-high (高速・詳細推論)' },
        { value: 'o4-mini', name: 'o4-mini (高速・低コスト)' },
        { value: 'gpt-4.1-mini', name: 'GPT-4.1 mini (軽量版)' },
        { value: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (レガシー)' }
    ],
    gemini: [
        { value: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (最新・最高性能)' },
        { value: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (最新・高速)' },
        { value: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (マルチモーダル)' },
        { value: 'gemini-2.0-flash-preview-image-generation', name: 'Gemini 2.0 Flash (画像生成)' },
        { value: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (レガシー)' },
        { value: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (レガシー)' }
    ],
    anthropic: [
        { value: 'claude-opus-4', name: 'Claude Opus 4 (最新・最高性能)' },
        { value: 'claude-sonnet-4', name: 'Claude Sonnet 4 (バランス型)' },
        { value: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet (ハイブリッド推論)' },
        { value: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { value: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku (高速)' },
        { value: 'claude-3-opus-20240229', name: 'Claude 3 Opus (レガシー)' },
        { value: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet (レガシー)' },
        { value: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (レガシー)' }
    ]
};

// 化学プロンプトの追加
const chemistryPrompt = `あなたは化学の専門家です。化学反応や有機化合物について質問された場合、以下のルールに従ってください：

1. 反応式の場合は、必ず最初に反応式を表示してから説明を行う

2. SMILES形式は次のフォーマットで記載：
   SMILES: [化合物のSMILES形式] (化合物名)

3. 化学反応の場合は以下のフォーマットを使用：
   - 反応物は + で繋ぐ
   - 反応条件は CONDITION: で指定
   例：
   SMILES: CC(=O)Cl (アセチルクロリド)
   +
   SMILES: c1ccccc1O (フェノール)
   CONDITION: 塩基（ピリジン）
   SMILES: CC(=O)Oc1ccccc1 (酢酸フェニル)

4. 複数の反応物や生成物がある場合は + で接続
5. 反応条件（触媒、温度、溶媒など）は CONDITION: として記載

重要: 
- 反応式は必ず説明の前に記載する
- 化合物名が出てきたら、必ずSMILES形式を含める
- 反応条件は明確に記載する`;

// 初期化
async function init() {
    // デフォルトはダークモード（シックなデザイン）
    // localStorage に 'theme' が 'light' の場合のみライトモード
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    elements.toggleTheme.innerHTML = theme === 'light' ? 
        '<i class="fas fa-moon"></i> ダークモード' : 
        '<i class="fas fa-sun"></i> ライトモード';
    
    // フォントサイズの適用
    applyFontSize(settings.fontSize);
    
    // Stripeの初期化
    await initializeStripe();
    
    // 利用可能なAPIを確認
    await checkAvailableApis();
    
    // 認証状態を確認
    await checkAuth();
    
    // ウェルカムメッセージを表示
    showWelcomeMessage();
    
    // イベントリスナーの設定
    setupEventListeners();
}

// 認証状態の確認
async function checkAuth() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            await updateUserUI();
            await loadUserData();
        } else {
            currentUser = null;
            updateUserUI();
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

// ユーザーUIの更新
async function updateUserUI() {
    if (currentUser) {
        // ログイン状態
        elements.authBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span id="authBtnText">ログアウト</span>';
        elements.authBtnText.textContent = 'ログアウト';
        elements.userInfo.style.display = 'flex';
        elements.userEmail.textContent = currentUser.email;
        
        // チャットを有効化
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.placeholder = 'メッセージを入力...';
        
        // ウェルカムメッセージを更新（ログイン後）
        if (elements.chatMessages.querySelector('.welcome-message')) {
            showWelcomeMessage();
        }
    } else {
        // ログアウト状態
        elements.authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span id="authBtnText">ログイン</span>';
        elements.authBtnText.textContent = 'ログイン';
        elements.userInfo.style.display = 'none';
        
        // チャットを無効化
        elements.messageInput.disabled = true;
        elements.sendBtn.disabled = true;
        elements.messageInput.placeholder = 'ログインしてメッセージを送信...';
        
        // クレジット表示をリセット
        subscriptionInfo = {
            plan: 'free',
            credits: 0.50
        };
        updateCreditDisplay();
        
        // ウェルカムメッセージを更新（ログアウト後）
        if (elements.chatMessages.querySelector('.welcome-message')) {
            showWelcomeMessage();
        }
    }
}

// ユーザーデータの読み込み
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // サブスクリプション情報を更新
            if (data.subscription) {
                subscriptionInfo.plan = data.subscription.plan || 'free';
                subscriptionInfo.status = data.subscription.status;
                subscriptionInfo.stripeCustomerId = data.subscription.stripe_customer_id;
            }
            
            // 使用状況を取得
            await updateUsageData();
            
            // チャット履歴を表示
            displayChatHistory();
            
            // 設定が保存されている場合はチャットを有効化
            if (settings.apiType && availableApis[settings.apiType]) {
                enableChat();
            }
        }
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

// 使用状況データの更新
async function updateUsageData() {
    // 実際のAPIから月間使用量を取得する処理をここに実装
    // 今は仮の実装
    const limits = {
        free: 50,
        basic: 1000,
        pro: 5000
    };
    
    subscriptionInfo.credits = limits[subscriptionInfo.plan] || 50;
    updateCreditDisplay();
}

// クレジット表示を更新
function updateCreditDisplay() {
    const maxCredit = CREDIT_LIMITS[subscriptionInfo.plan];
    const percentage = (subscriptionInfo.credits / maxCredit * 100).toFixed(0);
    
    // クレジット数をカンマ区切りで表示
    const creditText = subscriptionInfo.credits.toLocaleString();
    elements.creditDisplay.textContent = `${creditText} クレジット`;
    
    // クレジット残高に応じて色を変更
    if (subscriptionInfo.credits < 10 || percentage < 10) {
        elements.creditInfo.classList.add('low-credit');
        elements.creditInfo.classList.remove('medium-credit');
    } else if (percentage < 30) {
        elements.creditInfo.classList.add('medium-credit');
        elements.creditInfo.classList.remove('low-credit');
    } else {
        elements.creditInfo.classList.remove('low-credit', 'medium-credit');
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    // 基本的なボタン
    elements.settingsBtn.addEventListener('click', showSettings);
    elements.closeModal.addEventListener('click', hideSettings);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.apiSelect.addEventListener('change', handleApiChange);
    elements.sendBtn.addEventListener('click', sendMessage);
    
    // サイドバー関連
    elements.menuToggle.addEventListener('click', toggleSidebar);
    elements.clearChat.addEventListener('click', clearCurrentChat);
    elements.toggleTheme.addEventListener('click', toggleTheme);
    elements.newChatBtn.addEventListener('click', startNewChat);
    
    // 入力エリア
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    elements.messageInput.addEventListener('input', () => {
        updateCharCount();
        autoResizeTextarea();
    });
    
    // IME（日本語入力）の状態を監視
    elements.messageInput.addEventListener('compositionstart', () => {
        isComposing = true;
        // 送信ボタンを一時的に無効化（視覚的フィードバック）
        if (elements.sendBtn && !elements.sendBtn.disabled) {
            elements.sendBtn.style.opacity = '0.5';
            elements.sendBtn.style.cursor = 'not-allowed';
        }
    });
    
    elements.messageInput.addEventListener('compositionend', (e) => {
        // Mac OSでの動作を改善するため、より長い遅延を入れる
        setTimeout(() => {
            isComposing = false;
            // 送信ボタンを元に戻す
            if (elements.sendBtn && !elements.sendBtn.disabled) {
                elements.sendBtn.style.opacity = '';
                elements.sendBtn.style.cursor = '';
            }
        }, 100); // 100msの遅延に変更
    });
    
    // Mac OS用の追加対策
    elements.messageInput.addEventListener('compositionupdate', () => {
        isComposing = true;
    });
    
    // 提案プロンプト
    document.addEventListener('click', (e) => {
        if (e.target.closest('.prompt-btn')) {
            const prompt = e.target.closest('.prompt-btn').dataset.prompt;
            elements.messageInput.value = prompt;
            updateCharCount();
            autoResizeTextarea();
            sendMessage();
        }
    });
    
    // 画像アップロード関連
    elements.imageBtn.addEventListener('click', () => {
        elements.imageInput.click();
    });
    
    elements.imageInput.addEventListener('change', handleImageUpload);
    elements.removeImageBtn.addEventListener('click', removeAttachedImage);
    
    // ドラッグ＆ドロップ対応
    elements.chatMessages.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.chatMessages.classList.add('drag-over');
    });
    
    elements.chatMessages.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.chatMessages.classList.remove('drag-over');
    });
    
    elements.chatMessages.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.chatMessages.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            await processImage(files[0]);
        }
    });
    
    // モーダルの外側クリックで閉じる
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) hideSettings();
    });
    
    // サブスクリプション関連
    elements.subscriptionBtn.addEventListener('click', showSubscription);
    elements.closeSubscriptionModal.addEventListener('click', hideSubscription);
    elements.subscriptionModal.addEventListener('click', (e) => {
        if (e.target === elements.subscriptionModal) hideSubscription();
    });
    elements.basicPlanBtn.addEventListener('click', () => selectPlan('basic'));
    elements.proPlanBtn.addEventListener('click', () => selectPlan('pro'));
    if (elements.managePlanBtn) {
        elements.managePlanBtn.addEventListener('click', managePlan);
    }

    // 認証関連
    elements.authBtn.addEventListener('click', () => {
        if (currentUser) {
            // ログアウト
            handleLogout();
        } else {
            // ログインモーダルを表示
            showAuthModal(false);
        }
    });
    
    elements.closeAuthModal.addEventListener('click', hideAuthModal);
    elements.authModal.addEventListener('click', (e) => {
        if (e.target === elements.authModal) hideAuthModal();
    });
    
    elements.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = elements.authEmail.value;
        const password = elements.authPassword.value;
        const fullName = elements.authFullName.value;
        
        elements.authSubmitBtn.disabled = true;
        elements.authError.style.display = 'none';
        
        try {
            if (elements.authSubmitBtn.textContent === 'ログイン') {
                await handleLogin(email, password);
            } else {
                await handleSignup(email, password, fullName);
            }
        } catch (error) {
            console.error('Auth error:', error);
        } finally {
            elements.authSubmitBtn.disabled = false;
        }
    });
    
    // 動的に生成される切り替えボタンのイベント委譲
    elements.authModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('auth-switch-btn')) {
            const isSignup = elements.authTitle.textContent === 'ログイン';
            showAuthModal(isSignup);
        }
    });
    
    // フォントサイズ変更
    elements.fontSizeSelect.addEventListener('change', (e) => {
        const size = e.target.value;
        settings.fontSize = size;
        localStorage.setItem('fontSize', size);
        applyFontSize(size);
    });
}

// サイドバーのトグル
function toggleSidebar() {
    elements.sidebar.classList.toggle('hidden');
}

// ダークモードのトグル
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    elements.toggleTheme.innerHTML = newTheme === 'light' ? 
        '<i class="fas fa-moon"></i> ダークモード' : 
        '<i class="fas fa-sun"></i> ライトモード';
}

// 文字数カウントの更新
function updateCharCount() {
    const count = elements.messageInput.value.length;
    elements.charCount.textContent = `${count} / 4000`;
}

// テキストエリアの自動リサイズ
function autoResizeTextarea() {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 200) + 'px';
}

// 新しいチャットを開始
function startNewChat() {
    currentChatId = Date.now().toString();
    currentChat = [];
    elements.chatMessages.innerHTML = '';
    showWelcomeMessage();
    saveCurrentChat();
}

// チャットウィンドウに初期メッセージを表示
function showWelcomeMessage() {
    const welcomeHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-flask"></i>
            </div>
            <h2>AI化学チャットボットへようこそ</h2>
            <p>化学に関する質問をしてください。有機化合物について質問すると、AIが自動的にSMILES形式を生成し、構造式を描画します。</p>
            
            ${!currentUser ? `
                <div class="login-prompt">
                    <p class="setup-hint">
                        <i class="fas fa-info-circle"></i>
                        ご利用にはログインが必要です
                    </p>
                    <button class="login-btn-large" onclick="document.getElementById('authBtn').click()">
                        <i class="fas fa-sign-in-alt"></i>
                        ログインまたは新規登録
                    </button>
                </div>
            ` : `
                <div class="suggested-prompts">
                    <button class="prompt-btn" data-prompt="アスピリンの構造を教えて">
                        <i class="fas fa-pills"></i>
                        <span>アスピリンの構造を教えて</span>
                    </button>
                    <button class="prompt-btn" data-prompt="カフェインとニコチンの違いは？">
                        <i class="fas fa-coffee"></i>
                        <span>カフェインとニコチンの違いは？</span>
                    </button>
                    <button class="prompt-btn" data-prompt="ベンゼン環を持つ化合物の例を教えて">
                        <i class="fas fa-ring"></i>
                        <span>ベンゼン環を持つ化合物の例</span>
                    </button>
                    <button class="prompt-btn" data-prompt="エタノールの性質について説明して">
                        <i class="fas fa-wine-bottle"></i>
                        <span>エタノールの性質について</span>
                    </button>
                </div>
            `}
        </div>
    `;
    
    elements.chatMessages.innerHTML = welcomeHTML;
}

// 現在のチャットをクリア
function clearCurrentChat() {
    if (confirm('現在のチャットをクリアしますか？')) {
        startNewChat();
    }
}

// チャット履歴を表示
function displayChatHistory() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const todayItems = [];
    const yesterdayItems = [];
    const weekItems = [];
    
    chatHistory.forEach(chat => {
        const chatDate = new Date(parseInt(chat.id));
        const chatDateOnly = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());
        
        const item = createHistoryItem(chat);
        
        if (chatDateOnly.getTime() === today.getTime()) {
            todayItems.push(item);
        } else if (chatDateOnly.getTime() === yesterday.getTime()) {
            yesterdayItems.push(item);
        } else if (chatDateOnly.getTime() >= weekAgo.getTime()) {
            weekItems.push(item);
        }
    });
    
    elements.todayHistory.innerHTML = todayItems.join('');
    elements.yesterdayHistory.innerHTML = yesterdayItems.join('');
    elements.weekHistory.innerHTML = weekItems.join('');
}

// 履歴アイテムを作成
function createHistoryItem(chat) {
    const firstMessage = chat.messages[0]?.content || '新しいチャット';
    const title = firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : '');
    return `
        <div class="history-item ${chat.id === currentChatId ? 'active' : ''}" 
             data-chat-id="${chat.id}" onclick="loadChat('${chat.id}')">
            ${title}
        </div>
    `;
}

// チャットを読み込む
window.loadChat = function(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
        currentChatId = chatId;
        currentChat = [...chat.messages];
        displayChat();
        displayChatHistory();
    }
}

// チャットを表示
function displayChat() {
    elements.chatMessages.innerHTML = '';
    if (currentChat.length === 0) {
        showWelcomeMessage();
    } else {
        currentChat.forEach(msg => {
            addMessage(msg.content, msg.type, msg.type === 'bot');
        });
    }
}

// 現在のチャットを保存
function saveCurrentChat() {
    if (!currentChatId) return;
    
    const existingIndex = chatHistory.findIndex(c => c.id === currentChatId);
    const chatData = {
        id: currentChatId,
        messages: currentChat,
        timestamp: Date.now()
    };
    
    if (existingIndex >= 0) {
        chatHistory[existingIndex] = chatData;
    } else {
        chatHistory.unshift(chatData);
    }
    
    // 履歴を100件に制限
    chatHistory = chatHistory.slice(0, 100);
    
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    displayChatHistory();
}

// 利用可能なAPIを確認
async function checkAvailableApis() {
    try {
        const response = await fetch('/api/available-apis');
        availableApis = await response.json();
        
        // API選択オプションを更新
        updateApiSelectOptions();
        
        // 利用可能なAPIがない場合は警告
        if (!Object.values(availableApis).some(v => v)) {
            addMessage('警告: .envファイルにAPIキーが設定されていません。使用するAPIのキーを.envファイルに設定してください。', 'bot');
        }
    } catch (error) {
        console.error('APIチェックエラー:', error);
        addMessage('サーバーとの接続に失敗しました。', 'bot');
    }
}

// 利用可能なAPIを更新
function updateApiSelectOptions() {
    const apiSelect = elements.apiSelect;
    apiSelect.innerHTML = '<option value="">選択してください</option>';
    
    if (availableApis.openai) {
        apiSelect.innerHTML += '<option value="openai">OpenAI GPT</option>';
    }
    if (availableApis.gemini) {
        apiSelect.innerHTML += '<option value="gemini">Google Gemini</option>';
    }
    if (availableApis.anthropic) {
        apiSelect.innerHTML += '<option value="anthropic">Anthropic Claude</option>';
    }
}

// 設定モーダルの表示
function showSettings() {
    elements.settingsModal.classList.add('show');
    elements.apiSelect.value = settings.apiType;
    elements.fontSizeSelect.value = settings.fontSize;
    
    if (settings.apiType) {
        handleApiChange();
        elements.modelSelect.value = settings.model;
    }
    
    // モーダル表示時のアニメーション
    requestAnimationFrame(() => {
        elements.settingsModal.querySelector('.modal-content').style.transform = 'translateY(0)';
    });
}

// 設定モーダルの非表示
function hideSettings() {
    elements.settingsModal.classList.remove('show');
}

// API選択の変更処理
function handleApiChange() {
    const selectedApi = elements.apiSelect.value;
    
    if (selectedApi && availableApis[selectedApi]) {
        // モデル選択を表示
        elements.modelGroup.style.display = 'block';
        
        // モデルオプションを更新
        elements.modelSelect.innerHTML = '';
        models[selectedApi].forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            
            const isAvailable = subscriptionInfo.plan !== 'free' || FREE_MODELS.includes(model.value);
            const cost = MODEL_COSTS[model.value] || 0.01;
            const isPremium = !FREE_MODELS.includes(model.value);
            
            option.disabled = !isAvailable;
            option.className = isAvailable ? '' : 'disabled-option';
            
            if (isPremium) {
                option.textContent = `${model.name} (Premium) - ${cost}クレジット/回`;
            } else {
                option.textContent = `${model.name} - ${cost}クレジット/回`;
            }
            
            elements.modelSelect.appendChild(option);
        });
    } else {
        elements.modelGroup.style.display = 'none';
    }
}

// 設定の保存
function saveSettings() {
    const apiType = elements.apiSelect.value;
    const model = elements.modelSelect.value;
    const fontSize = elements.fontSizeSelect.value;
    
    if (!apiType) {
        alert('使用するAIを選択してください');
        return;
    }
    
    if (!model) {
        alert('モデルを選択してください');
        return;
    }
    
    if (!availableApis[apiType]) {
        alert('選択したAPIのキーが.envファイルに設定されていません');
        return;
    }
    
    // 無料プランのモデル制限チェック
    if (subscriptionInfo.plan === 'free' && !FREE_MODELS.includes(model)) {
        alert('このモデルはプレミアムプラン限定です。\n\n無料プランで利用可能なモデル:\n• GPT-4o\n• Gemini 2.5 Flash\n• Claude 3.7 Sonnet');
        return;
    }
    
    // ローカルストレージに保存
    localStorage.setItem('apiType', apiType);
    localStorage.setItem('model', model);
    localStorage.setItem('fontSize', fontSize);
    
    // 設定を更新
    settings.apiType = apiType;
    settings.model = model;
    settings.fontSize = fontSize;
    
    // フォントサイズを適用
    applyFontSize(fontSize);
    
    // チャットを有効化
    enableChat();
    hideSettings();
    
    // 成功メッセージを表示
    addMessage('設定が保存されました。チャットを開始できます！', 'bot');
}

// チャットの有効化
function enableChat() {
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.messageInput.placeholder = 'メッセージを入力...';
    
    // ウェルカムメッセージを更新
    const setupHint = document.querySelector('.setup-hint');
    if (setupHint) {
        setupHint.style.display = 'none';
    }
}

// 化学関連の質問かどうかを判定
function isChemistryQuestion(text) {
    const chemistryKeywords = /化学|分子|化合物|構造|有機|無機|原子|元素|結合|反応|酸|塩基|アルカリ|エステル|エーテル|アルコール|アルデヒド|ケトン|カルボン酸|アミン|アミド|ベンゼン|フェノール|アニリン|アスピリン|カフェイン|ニコチン|グルコース|アミノ酸|タンパク質|医薬品|薬|ビタミン|ステロイド|アルカン|アルケン|アルキン|芳香族|脂肪族|環状|鎖状|異性体|立体|SMILES|smiles/i;
    return chemistryKeywords.test(text);
}

// メッセージの送信
async function sendMessage() {
    // IMEが起動中の場合は送信しない
    if (isComposing) return;
    
    const message = elements.messageInput.value.trim();
    if (!message || message.length > 4000) return;
    
    // ログインチェック
    if (!currentUser) {
        addMessage('メッセージを送信するにはログインが必要です。', 'bot');
        showAuthModal();
        return;
    }
    
    // 初回メッセージの場合は新しいチャットを作成
    if (!currentChatId || currentChat.length === 0) {
        startNewChat();
    }
    
    // ウェルカムメッセージを削除
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    // ユーザーメッセージを追加（画像も含む）
    if (attachedImageData) {
        addMessage(message + '\n<img src="' + attachedImageData + '" style="max-width: 300px; margin-top: 10px; border-radius: 8px;">', 'user');
    } else {
        addMessage(message, 'user');
    }
    
    const savedImage = attachedImageData;
    elements.messageInput.value = '';
    updateCharCount();
    autoResizeTextarea();
    removeAttachedImage(); // 画像をクリア
    
    // チャット履歴に追加
    currentChat.push({ type: 'user', content: message });
    
    // AIが設定されているか確認
    if (!settings.apiType || !settings.model) {
        addMessage('AIが設定されていません。設定からAIを選択してください。', 'bot');
        return;
    }
    
    // ローディング表示
    const loadingId = addLoadingMessage();
    
    // 画像がある場合は画像認識のプロンプトを追加
    let finalMessage = message;
    if (savedImage) {
        finalMessage = '画像を分析して、以下の質問に答えてください。化学構造式を求められる問題では、必ずSMILES形式で構造式を生成してください。\n\n' + 
                      '質問: ' + message;
    } else if (isChemistryQuestion(message)) {
        finalMessage = chemistryPrompt + '\n\nユーザーの質問: ' + message;
    }
    
    try {
        const requestBody = {
            message: finalMessage,
            apiType: settings.apiType,
            model: settings.model
        };
        
        // 画像データがある場合は追加
        if (savedImage) {
            requestBody.image = savedImage;
        }
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        // ローディングを削除
        removeMessage(loadingId);
        
        if (response.ok) {
            // AIの回答を処理（SMILES形式の自動検出と描画）
            addMessage(data.response, 'bot', true);
            
            // チャット履歴に追加
            currentChat.push({ type: 'bot', content: data.response });
            saveCurrentChat();
            
            // 使用状況を更新
            await updateUsageData();
        } else {
            if (response.status === 401) {
                addMessage('セッションが期限切れです。再度ログインしてください。', 'bot');
                await handleLogout();
            } else if (response.status === 403) {
                addMessage(data.error, 'bot');
                if (data.error.includes('プレミアムプラン限定')) {
                    showSubscription();
                }
            } else {
                addMessage(`エラー: ${data.error}`, 'bot');
            }
        }
    } catch (error) {
        removeMessage(loadingId);
        addMessage('エラーが発生しました。接続を確認してください。', 'bot');
        console.error('Error:', error);
    }
}

// メッセージの追加（SMILES検出機能付き）
function addMessage(content, type, checkForSmiles = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.id = `msg-${Date.now()}`;
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = type === 'bot' ? 
        '<i class="fas fa-robot"></i>' : 
        '<i class="fas fa-user"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (checkForSmiles && smilesDrawer) {
        // AIの回答からSMILES形式を検出して描画
        contentDiv.innerHTML = processSmilesContent(content);
    } else {
        // 改行を<br>に変換
        const escapedContent = escapeHtml(content);
        contentDiv.innerHTML = escapedContent.replace(/\n/g, '<br>');
    }
    
    wrapperDiv.appendChild(avatarDiv);
    wrapperDiv.appendChild(contentDiv);
    messageDiv.appendChild(wrapperDiv);
    
    elements.chatMessages.appendChild(messageDiv);
    
    // スムーズなスクロール
    setTimeout(() => {
        elements.chatMessages.scrollTo({
            top: elements.chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
    
    return messageDiv.id;
}

// SMILES形式を検出して処理
function processSmilesContent(content) {
    // SMILES形式と反応条件のパターンを検出
    const smilesPattern = /SMILES:\s*([^\s\n。、,，.．]+)(?:\s*\(([^)]+)\))?/gi;
    const conditionPattern = /CONDITION:\s*([^\n]+)/gi;
    
    let processedContent = escapeHtml(content);
    const smilesMatches = [...content.matchAll(smilesPattern)];
    const conditionMatches = [...content.matchAll(conditionPattern)];
    
    if (smilesMatches.length > 0 && smilesDrawer) {
        // 反応式かどうかを判定
        const isReaction = smilesMatches.length > 1 || conditionMatches.length > 0;
        
        if (isReaction) {
            // 反応物と生成物を分離（CONDITIONの前後で分割）
            let reactants = [];
            let products = [];
            let conditions = conditionMatches.map(m => m[1]);
            
            // CONDITIONの位置を基準に反応物と生成物を分離
            if (conditionMatches.length > 0) {
                const conditionIndex = content.indexOf(conditionMatches[0][0]);
                smilesMatches.forEach((match) => {
                    const matchIndex = content.indexOf(match[0]);
                    if (matchIndex < conditionIndex) {
                        reactants.push(match);
                    } else if (matchIndex > conditionIndex) {
                        products.push(match);
                    }
                });
            } else {
                // CONDITIONがない場合は、中間点で分割
                const midPoint = Math.floor(smilesMatches.length / 2);
                reactants = smilesMatches.slice(0, midPoint);
                products = smilesMatches.slice(midPoint);
            }
            
            // 反応式のHTMLを生成
            let reactionHtml = '<div class="reaction-container">';
            
            // 反応物を描画
            reactants.forEach((match, index) => {
                let smilesString = match[1].replace(/[。、,，.．]+$/, '');
                const compoundName = match[2] || '';
                const canvasId = `molecule-canvas-${Date.now()}-r${index}`;
                
                reactionHtml += `
                    <div class="molecule-item">
                        ${compoundName ? `<div class="compound-name">${escapeHtml(compoundName)}</div>` : ''}
                        <canvas id="${canvasId}" class="molecule-canvas" width="250" height="250"></canvas>
                    </div>
                `;
                
                // 最後の反応物でなければ + を追加
                if (index < reactants.length - 1) {
                    reactionHtml += '<div class="plus-sign">+</div>';
                }
                
                // 描画を遅延実行
                setTimeout(() => {
                    const canvas = document.getElementById(canvasId);
                    if (canvas && smilesDrawer) {
                        try {
                            SmilesDrawer.parse(smilesString, function(tree) {
                                smilesDrawer.draw(tree, canvas, 'light', false);
                            });
                        } catch (error) {
                            console.error('SMILES描画エラー:', error);
                            showDrawError(canvas, error);
                        }
                    }
                }, 100);
            });
            
            // 矢印と反応条件を追加
            reactionHtml += `
                <div class="reaction-arrow-container">
                    ${conditions.length > 0 ? `<div class="reaction-conditions">${escapeHtml(conditions.join(', '))}</div>` : ''}
                    <div class="reaction-arrow">→</div>
                </div>
            `;
            
            // 生成物を描画
            products.forEach((match, index) => {
                let smilesString = match[1].replace(/[。、,，.．]+$/, '');
                const compoundName = match[2] || '';
                const canvasId = `molecule-canvas-${Date.now()}-p${index}`;
                
                reactionHtml += `
                    <div class="molecule-item">
                        ${compoundName ? `<div class="compound-name">${escapeHtml(compoundName)}</div>` : ''}
                        <canvas id="${canvasId}" class="molecule-canvas" width="250" height="250"></canvas>
                    </div>
                `;
                
                // 最後の生成物でなければ + を追加
                if (index < products.length - 1) {
                    reactionHtml += '<div class="plus-sign">+</div>';
                }
                
                // 描画を遅延実行
                setTimeout(() => {
                    const canvas = document.getElementById(canvasId);
                    if (canvas && smilesDrawer) {
                        try {
                            SmilesDrawer.parse(smilesString, function(tree) {
                                smilesDrawer.draw(tree, canvas, 'light', false);
                            });
                        } catch (error) {
                            console.error('SMILES描画エラー:', error);
                            showDrawError(canvas, error);
                        }
                    }
                }, 100);
            });
            
            reactionHtml += '</div>';
            
            // 元のコンテンツから反応式部分を削除して置換
            let tempContent = processedContent;
            
            // すべてのSMILESとCONDITIONを削除
            smilesMatches.forEach(match => {
                tempContent = tempContent.replace(escapeHtml(match[0]), '###REACTION_PLACEHOLDER###');
            });
            conditionMatches.forEach(match => {
                tempContent = tempContent.replace(escapeHtml(match[0]), '###REACTION_PLACEHOLDER###');
            });
            
            // + 記号も削除（反応式の一部として）
            tempContent = tempContent.replace(/###REACTION_PLACEHOLDER###\s*<br\/>\s*\+\s*<br\/>\s*###REACTION_PLACEHOLDER###/g, '###REACTION_PLACEHOLDER###');
            
            // 最初のプレースホルダーを反応式で置換
            tempContent = tempContent.replace('###REACTION_PLACEHOLDER###', reactionHtml);
            tempContent = tempContent.replace(/###REACTION_PLACEHOLDER###/g, '');
            
            processedContent = tempContent;
        } else {
            // 単一の分子の場合
            const match = smilesMatches[0];
            const fullMatch = match[0];
            let smilesString = match[1];
            const compoundName = match[2] || '';
            
            // 句読点が末尾にある場合は削除
            smilesString = smilesString.replace(/[。、,，.．]+$/, '');
            
            // キャンバスのIDを生成
            const canvasId = `molecule-canvas-${Date.now()}-0`;
            
            const replacement = `
                <div class="smiles-container">
                    ${compoundName ? `<div class="compound-name">${escapeHtml(compoundName)}</div>` : ''}
                    <canvas id="${canvasId}" class="molecule-canvas" width="400" height="400"></canvas>
                </div>
            `;
            
            processedContent = processedContent.replace(escapeHtml(fullMatch), replacement);
            
            // 描画を遅延実行
            setTimeout(() => {
                const canvas = document.getElementById(canvasId);
                if (canvas && smilesDrawer) {
                    try {
                        // SmilesDrawer v1.2.0の描画方法
                        SmilesDrawer.parse(smilesString, function(tree) {
                            smilesDrawer.draw(tree, canvas, 'light', false);
                        });
                    } catch (error) {
                        console.error('SMILES描画エラー:', error);
                        showDrawError(canvas, error);
                    }
                }
            }, 100);
        }
    }
    
    // 改行を<br>に変換
    processedContent = processedContent.replace(/\n/g, '<br>');
    
    return processedContent;
}

// 描画エラーを表示
function showDrawError(canvas, error) {
    canvas.style.display = 'none';
    const errorMsg = document.createElement('div');
    errorMsg.className = 'chemistry-error';
    errorMsg.textContent = '構造式の描画に失敗しました: ' + (error.message || error);
    canvas.parentNode.appendChild(errorMsg);
}

// HTMLエスケープ関数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ローディングメッセージの追加
function addLoadingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.id = `loading-${Date.now()}`;
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<div class="loading"></div> <span style="color: var(--text-tertiary); margin-left: 1rem;">考え中...</span>';
    
    wrapperDiv.appendChild(avatarDiv);
    wrapperDiv.appendChild(contentDiv);
    messageDiv.appendChild(wrapperDiv);
    
    elements.chatMessages.appendChild(messageDiv);
    
    // スムーズなスクロール
    setTimeout(() => {
        elements.chatMessages.scrollTo({
            top: elements.chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
    
    return messageDiv.id;
}

// メッセージの削除
function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

// サブスクリプション関連の関数
function showSubscription() {
    elements.subscriptionModal.classList.add('show');
    updateSubscriptionStatus();
    
    // モーダル表示時のアニメーション
    requestAnimationFrame(() => {
        elements.subscriptionModal.querySelector('.modal-content').style.transform = 'translateY(0)';
    });
}

function hideSubscription() {
    elements.subscriptionModal.classList.remove('show');
}

function updateSubscriptionStatus() {
    if (subscriptionInfo.plan !== 'free') {
        document.querySelector('.subscription-plans').style.display = 'none';
        elements.subscriptionStatus.style.display = 'block';
        
        const planNames = {
            basic: '基本プラン',
            pro: 'プロプラン'
        };
        
        elements.currentPlan.textContent = planNames[subscriptionInfo.plan] || '無料プラン';
    } else {
        document.querySelector('.subscription-plans').style.display = 'grid';
        elements.subscriptionStatus.style.display = 'none';
    }
}

// サブスクリプション関連の関数を更新
function selectPlan(planType) {
    if (!currentUser) {
        addMessage('サブスクリプションを開始するにはログインが必要です。', 'bot');
        showAuthModal();
        return;
    }
    
    if (!stripe) {
        alert('Stripeが初期化されていません。ページを再読み込みしてください。');
        return;
    }
    
    // Stripeチェックアウトセッションを作成
    createCheckoutSession(planType);
}

// Stripeチェックアウトセッションの作成
async function createCheckoutSession(plan) {
    try {
        const response = await fetch('/api/subscription/create-checkout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan })
        });
        
        const data = await response.json();
        
        if (response.ok && data.url) {
            // Stripeチェックアウトページにリダイレクト
            window.location.href = data.url;
        } else {
            const errorMessage = data.details ? `${data.error}: ${data.details}` : data.error || 'チェックアウトセッションの作成に失敗しました';
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Checkout error:', error);
        console.error('Error details:', error.message);
        addMessage(`エラー: ${error.message}`, 'bot');
    }
}

function managePlan() {
    if (!currentUser) {
        addMessage('プランを管理するにはログインが必要です。', 'bot');
        showAuthModal();
        return;
    }
    
    // Stripeカスタマーポータルを開く
    openCustomerPortal();
}

// Stripeカスタマーポータルを開く
async function openCustomerPortal() {
    try {
        const response = await fetch('/api/subscription/portal', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.url) {
            // カスタマーポータルにリダイレクト
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'ポータルセッションの作成に失敗しました');
        }
    } catch (error) {
        console.error('Portal error:', error);
        addMessage(`エラー: ${error.message}`, 'bot');
    }
}

// 認証モーダルの表示
function showAuthModal(isSignup = false) {
    elements.authModal.classList.add('show');
    elements.authError.style.display = 'none';
    elements.authForm.reset();
    
    const authSwitchText = document.getElementById('authSwitchText');
    
    if (isSignup) {
        elements.authTitle.textContent = '新規登録';
        elements.authSubmitBtn.textContent = '登録する';
        elements.fullNameGroup.style.display = 'block';
        if (authSwitchText) {
            authSwitchText.innerHTML = 'すでにアカウントをお持ちの方は <button type="button" class="auth-switch-btn">ログイン</button>';
        }
    } else {
        elements.authTitle.textContent = 'ログイン';
        elements.authSubmitBtn.textContent = 'ログイン';
        elements.fullNameGroup.style.display = 'none';
        if (authSwitchText) {
            authSwitchText.innerHTML = 'アカウントをお持ちでない方は <button type="button" class="auth-switch-btn">新規登録</button>';
        }
    }
    
    // モーダル表示時のアニメーション
    requestAnimationFrame(() => {
        elements.authModal.querySelector('.modal-content').style.transform = 'translateY(0)';
    });
}

// 認証モーダルを閉じる
function hideAuthModal() {
    elements.authModal.classList.remove('show');
}

// ログイン処理
async function handleLogin(email, password) {
    try {
        elements.authSubmitBtn.disabled = true;
        elements.authError.style.display = 'none';
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            hideAuthModal();
            await updateUserUI();
            await loadUserData();
            addMessage('ログインしました！', 'bot');
        } else {
            throw new Error(data.error || 'ログインに失敗しました');
        }
    } catch (error) {
        elements.authError.textContent = error.message;
        elements.authError.style.display = 'block';
    } finally {
        elements.authSubmitBtn.disabled = false;
    }
}

// サインアップ処理
async function handleSignup(email, password, fullName) {
    try {
        elements.authSubmitBtn.disabled = true;
        elements.authError.style.display = 'none';
        
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, fullName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            hideAuthModal();
            
            // 登録成功メッセージを表示
            addMessage('アカウントを作成しました！メールアドレスの確認後、すべての機能が利用可能になります。', 'bot');
            
            // 自動的にログインを試みる
            try {
                const loginResponse = await fetch('/api/auth/login', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const loginData = await loginResponse.json();
                
                if (loginResponse.ok) {
                    currentUser = loginData.user;
                    await updateUserUI();
                    await loadUserData();
                    addMessage('ようこそ！AI化学チャットボットへ', 'bot');
                }
            } catch (loginError) {
                console.error('Auto-login error:', loginError);
                // 自動ログインに失敗してもエラーは表示しない（メール確認が必要な場合があるため）
            }
        } else {
            throw new Error(data.error || '登録に失敗しました');
        }
    } catch (error) {
        elements.authError.textContent = error.message;
        elements.authError.style.display = 'block';
    } finally {
        elements.authSubmitBtn.disabled = false;
    }
}

// ログアウト処理
async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        await supabase.auth.signOut();
        currentUser = null;
        updateUserUI();
        
        // チャットをクリア
        currentChatId = null;
        currentChat = [];
        elements.chatMessages.innerHTML = '';
        showWelcomeMessage();
        
        addMessage('ログアウトしました', 'bot');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// 画像アップロード処理
async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        await processImage(file);
    }
}

// 画像処理
async function processImage(file) {
    // ファイルサイズチェック（10MB以下）
    if (file.size > 10 * 1024 * 1024) {
        alert('画像サイズは10MB以下にしてください。');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        attachedImageData = e.target.result;
        elements.previewImage.src = attachedImageData;
        elements.attachedImage.style.display = 'inline-flex';
        
        // 入力フィールドを有効化
        if (settings.apiType && settings.model) {
            elements.messageInput.disabled = false;
            elements.sendBtn.disabled = false;
            elements.messageInput.placeholder = '画像について質問してください...';
            elements.messageInput.focus();
        }
    };
    reader.readAsDataURL(file);
}

// 添付画像を削除
function removeAttachedImage() {
    attachedImageData = null;
    elements.attachedImage.style.display = 'none';
    elements.imageInput.value = '';
    elements.messageInput.placeholder = 'メッセージを入力...';
}

// フォントサイズを適用
function applyFontSize(size) {
    document.documentElement.style.setProperty('--message-font-size', `${size}px`);
    // メッセージコンテンツのフォントサイズを更新
    const messageContents = document.querySelectorAll('.message-content');
    messageContents.forEach(content => {
        content.style.fontSize = `${size}px`;
    });
}

// 初期化実行
document.addEventListener('DOMContentLoaded', init);