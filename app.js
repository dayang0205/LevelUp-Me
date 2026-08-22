// ================================================================
// 0. 国际化
// ================================================================
const translations = {
    zh: {
        home: "道场", goals: "目标录", profile: "我的法相",
        newGoal: "立下新目标", generateFinal: "生成最终计划",
        delete: "删除", cancel: "取消", xp: "修为",
        currentTraining: "当前修炼", active: "修炼中", completed: "已达成",
        welcome: "欢迎来到灵犀", intro: "开启你的修炼之旅，先创建你的角色吧",
        startTraining: "开始修炼 ⚔️", bio: "个人简述", expect: "对 AI 伴侣的期望",
        recordDaily: "完成小目标", submitFeedback: "提交并获取 AI 反馈",
        chat: "继续对话", mainGoal: "主要目标", subGoals: "小目标"
    },
    en: {
        home: "Dojo", goals: "Quest Log", profile: "Avatar",
        newGoal: "New Goal", generateFinal: "Generate Final Plan",
        delete: "Delete", cancel: "Cancel", xp: "XP",
        currentTraining: "Active Training", active: "Active", completed: "Completed",
        welcome: "Welcome to Lingxi", intro: "Start your journey by creating your avatar",
        startTraining: "Start Training ⚔️", bio: "Bio", expect: "Expectations",
        recordDaily: "Complete Sub-goal", submitFeedback: "Submit & Get AI Feedback",
        chat: "Chat", mainGoal: "Main Goal", subGoals: "Sub-goals"
    }
};

let currentLang = localStorage.getItem('lang') || 'zh';
function t(key) { return translations[currentLang][key] || translations.zh[key] || key; }

function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('lang', currentLang);
    applyLanguage();
    updateAllUI();
}
function applyLanguage() {
    document.documentElement.lang = currentLang;
    document.getElementById('langLabel').innerText = currentLang === 'zh' ? 'EN' : '中';
    document.querySelectorAll('[data-i18n]').forEach(el => el.innerText = t(el.dataset.i18n));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
}

// ================================================================
// 1. 数据（小目标结构）
// ================================================================
const STORAGE_KEY = 'xiushen_v3';
let goals = [];
let userProfile = {};
let selectedGoalId = null;
let pendingSubGoalId = null;
let chatHistory = [];

const REALMS = [
    { level: 0, name: '凡人', emoji: '🧘', xpRequired: 0 },
    { level: 1, name: '炼气', emoji: '🌪️', xpRequired: 100 },
    { level: 2, name: '筑基', emoji: '🪨', xpRequired: 300 },
    { level: 3, name: '金丹', emoji: '🔮', xpRequired: 600 }
];

function getSeedData() {
    return { goals: [], userProfile: { name: '无名道友', avatar: '🧘', bio: '探索者', expect: '陪伴' } };
}

// 自动迁移旧数据
function normalizeData(data) {
    if (data.goals) {
        data.goals = data.goals.map(g => {
            if (!g.subGoals && g.todayTasks) {
                g.subGoals = g.todayTasks.map(t => ({ title: t.text || t.title, description: '', done: t.done || false, feedback: '', reply: '' }));
            }
            if (!g.subGoals) g.subGoals = [];
            delete g.todayTasks;
            return g;
        });
    }
    return data;
}

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            if (data.goals && data.userProfile) return normalizeData(data);
        } catch (e) {}
    }
    const seed = getSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ goals, userProfile })); }

function getTotalXp() { return goals.reduce((s, g) => s + g.totalXp, 0); }
function getActive() { return goals.filter(g => g.status === 'active'); }

// ================================================================
// 2. UI 渲染（道场页面）
// ================================================================
function updateAllUI() {
    const xp = getTotalXp();
    document.getElementById('totalXpHome').textContent = xp;

    const active = getActive();
    document.getElementById('activeCount').textContent = active.length + ' 个';
    const container = document.getElementById('activeGoalsContainer');

    if (!active.length) {
        container.innerHTML = `<div class="text-secondary text-center" style="padding:24px 0;">暂无目标</div>`;
        return;
    }

    container.innerHTML = active.map(g => {
        const doneCount = g.subGoals.filter(s => s.done).length;
        const total = g.subGoals.length;
        return `
            <div class="active-goal-card" style="display:block; margin-bottom:16px;" onclick="openDetail('${g.id}')">
                <div style="font-weight:700; font-size:16px;">🎯 ${g.mainGoal}</div>
                <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">已完成 ${doneCount}/${total} 个小目标</div>
                <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                    ${g.subGoals.map((s, i) => `
                        <div style="background:${s.done ? 'var(--success)' : 'var(--input-bg)'}; padding:8px; border-radius:8px; font-size:14px;">
                            ${s.done ? '✅' : '⬜'} ${s.title}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// ================================================================
// 3. 多轮对话与生成计划
// ================================================================
function appendChat(sender, text) {
    const win = document.getElementById('chatWindow');
    win.innerHTML += `<div style="margin-bottom:8px;"><strong>${sender}:</strong> ${text}</div>`;
    win.scrollTop = win.scrollHeight;
}

async function chatWithAI() {
    const input = document.getElementById('newGoalInput').value.trim();
    if (!input) return;
    appendChat('你', input);
    document.getElementById('newGoalInput').value = '';
    chatHistory.push({ role: 'user', content: input });
    appendChat('AI教练', '🤔 思考中...');

    const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'chat', history: chatHistory })
    });
    const data = await res.json();
    chatHistory.push({ role: 'assistant', content: data.reply });
    // 替换“思考中”为回复
    const win = document.getElementById('chatWindow');
    win.lastElementChild.innerHTML = `<strong>AI教练:</strong> ${data.reply}`;
}

async function generateFinalPlan() {
    const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'generate', history: chatHistory })
    });
    const plan = await res.json();

    if (plan.mainGoal && plan.subGoals) {
        const newGoal = {
            id: 'g'+Date.now(),
            mainGoal: plan.mainGoal,
            subGoals: plan.subGoals.map(s => ({ id: 'sg'+Date.now()+Math.random(), title: s.title, description: s.description || '', done: false, feedback: '', reply: '' })),
            status: 'active',
            totalXp: 0
        };
        goals.push(newGoal);
        saveData();
        closeModal();
        updateAllUI();
        showToast('✅ 目标已生成！');
    } else {
        alert('生成失败，请重试');
    }
}

// ================================================================
// 4. 详情与独立小目标完成
// ================================================================
function openDetail(id) {
    selectedGoalId = id;
    const g = goals.find(go => go.id === id);
    if (!g) return;

    let html = `<div class="card" style="margin-bottom:16px;">
        <h3>🎯 ${g.mainGoal}</h3>
        <div style="margin-top:16px;">
            <div style="font-weight:600; margin-bottom:10px;">📌 ${t('subGoals')}</div>
            ${g.subGoals.map((s, i) => `
                <div style="border:1px solid var(--card-border); border-radius:12px; padding:12px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:500;">${s.done ? '✅' : '⬜'} ${s.title}</div>
                        <div style="display:flex; gap:8px;">
                            ${!s.done ? `<button class="day-btn" onclick="completeSubGoal('${g.id}', '${s.id}')">完成</button>` : ''}
                            ${s.feedback ? `<button class="btn-outline" onclick="viewSubGoalFeedback('${g.id}', '${s.id}')">看反馈</button>` : ''}
                        </div>
                    </div>
                    ${s.description ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${s.description}</div>` : ''}
                </div>
            `).join('')}
        </div>
        <div style="margin-top:12px; font-size:13px; color:var(--text-secondary);">${t('xp')}: ⭐ ${g.totalXp}</div>
    </div>
    <div style="text-align:center;">
        <button class="btn-outline" style="color:#c0392b;" onclick="deleteGoal('${g.id}')">${t('delete')}</button>
    </div>`;

    document.getElementById('detailTaskList').innerHTML = html;
    document.getElementById('detailOverlay').classList.add('show');
}

function completeSubGoal(goalId, subGoalId) {
    openSubGoalFeedback(goalId, subGoalId);
}

function openSubGoalFeedback(goalId, subGoalId) {
    pendingSubGoalId = subGoalId;
    selectedGoalId = goalId;
    document.getElementById('feedbackInput').value = '';
    document.getElementById('feedbackModal').classList.add('show');
}

async function submitFeedback() {
    const feedback = document.getElementById('feedbackInput').value.trim();
    if (!feedback) return;
    
    const g = goals.find(x => x.id === selectedGoalId);
    const s = g.subGoals.find(x => x.id === pendingSubGoalId);

    const res = await fetch('/api/process-feedback', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ feedback, goalTitle: g.mainGoal })
    });
    const data = await res.json();

    s.done = true;
    s.feedback = feedback;
    s.reply = data.reply;
    const xp = 15 + (data.xpBonus || 0);
    g.totalXp += xp;

    saveData();
    closeFeedbackModal();
    openDetail(selectedGoalId);
    showToast(`✅ 获得 ${xp} 修为！`);
}

function viewSubGoalFeedback(goalId, subGoalId) {
    const g = goals.find(x => x.id === goalId);
    const s = g.subGoals.find(x => x.id === subGoalId);
    alert(`💬 AI教练反馈：\n\n${s.reply}`);
}

function deleteGoal(id) {
    if (!confirm('确定删除这个目标吗？')) return;
    goals = goals.filter(g => g.id !== id);
    saveData(); closeDetail(); updateAllUI();
}

function closeDetail() { document.getElementById('detailOverlay').classList.remove('show'); }
function closeFeedbackModal() { document.getElementById('feedbackModal').classList.remove('show'); }
function openNewGoalModal() {
    document.getElementById('newGoalModal').classList.add('show');
    chatHistory = [];
    document.getElementById('chatWindow').innerHTML = 'AI教练：先告诉我你想突破的大方向吧...';
}
function closeModal() { document.getElementById('newGoalModal').classList.remove('show'); }

// ================================================================
// 5. 语音识别功能（稳定版 - 长按录音/松开停止/自动断句/防叠字）
// ================================================================
let recognition = null;
let isListening = false;
let accumulatedText = ''; // 保存已确认的最终文本
let voiceBtn = null;

function setupVoice() {
    if (!window.isSecureContext) {
        showToast('❌ 语音功能需要在 HTTPS 或 localhost 环境下使用');
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('❌ 当前浏览器不支持语音识别，请使用 Chrome 或 Edge');
        return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true; // 允许实时显示临时结果
    recognition.continuous = true;    // 持续识别，直到手动停止
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            let transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                // 自动断句：如果末尾没有标点，自动加句号
                if (transcript && !/[。！？!?]$/.test(transcript)) {
                    transcript += '。';
                }
                accumulatedText += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // 找出当前激活的输入框
        const activeInput = 
            document.getElementById('feedbackModal').classList.contains('show') ? document.getElementById('feedbackInput') :
            document.getElementById('newGoalModal').classList.contains('show') ? document.getElementById('newGoalInput') :
            null;

        if (activeInput) {
            // 【核心防叠字】显示 = 已确认文本 + 临时文本（绝不使用叠加方式）
            activeInput.value = accumulatedText + interimTranscript;
        }
    };

    recognition.onerror = function(event) {
        if (event.error !== 'aborted') {
            showToast('❌ 语音识别失败: ' + event.error);
        }
        stopListening();
    };

    recognition.onend = function() {
        // 【防停顿丢字】如果用户还按住没松开，自动重启识别
        if (isListening) {
            try { recognition.start(); } catch (e) {}
        } else {
            stopListening();
        }
    };
}

function startListening(e) {
    if (!recognition) setupVoice();
    if (!recognition) return;
    if (isListening) return;

    if (e) e.preventDefault();
    isListening = true;

    // 找出当前激活的语音按钮，修改样式
    const feedbackModal = document.getElementById('feedbackModal');
    const newGoalModal = document.getElementById('newGoalModal');
    if (feedbackModal && feedbackModal.classList.contains('show')) {
        voiceBtn = document.getElementById('feedbackVoiceBtn');
    } else if (newGoalModal && newGoalModal.classList.contains('show')) {
        voiceBtn = document.getElementById('newGoalVoiceBtn');
    }
    if (voiceBtn) {
        voiceBtn.innerHTML = '⏹ 松开结束';
        voiceBtn.style.background = '#e74c3c';
        voiceBtn.style.color = '#fff';
    }

    // 不覆盖已有内容，而是将当前输入框内容作为累积文本的基础
    const activeInput = 
        feedbackModal && feedbackModal.classList.contains('show') ? document.getElementById('feedbackInput') :
        newGoalModal && newGoalModal.classList.contains('show') ? document.getElementById('newGoalInput') :
        null;
    if (activeInput) {
        accumulatedText = activeInput.value;
    } else {
        accumulatedText = '';
    }

    try { recognition.start(); } catch (e) {}
    showToast('🎙️ 正在录音... 松开结束');
}

function stopListening() {
    if (recognition) recognition.stop();
    isListening = false;

    // 恢复按钮样式
    const feedbackModal = document.getElementById('feedbackModal');
    const newGoalModal = document.getElementById('newGoalModal');
    if (feedbackModal && feedbackModal.classList.contains('show')) {
        const btn = document.getElementById('feedbackVoiceBtn');
        if (btn) {
            btn.innerHTML = '🎙️ 按住说话';
            btn.style.background = '';
            btn.style.color = '';
        }
    } else if (newGoalModal && newGoalModal.classList.contains('show')) {
        const btn = document.getElementById('newGoalVoiceBtn');
        if (btn) {
            btn.innerHTML = '🎙️ 按住说话';
            btn.style.background = '';
            btn.style.color = '';
        }
    }
    voiceBtn = null;
    showToast('✅ 录音结束');
}

function cancelListening(e) {
    if (!isListening) return;
    if (e && voiceBtn) {
        const rect = voiceBtn.getBoundingClientRect();
        const x = e.clientX || (e.touches && e.touches[0].clientX);
        const y = e.clientY || (e.touches && e.touches[0].clientY);
        if (x < rect.left - 20 || x > rect.right + 20 || y < rect.top - 20 || y > rect.bottom + 20) {
            stopListening();
            showToast('🚫 已取消录音');
        }
    }
}

// ================================================================
// 6. 启动
// ================================================================
const saved = loadData();
goals = saved.goals;
userProfile = saved.userProfile;

const hasOnboarded = localStorage.getItem('hasOnboarded');
if (!hasOnboarded) {
    document.getElementById('onboarding').style.display = 'flex';
    document.querySelector('.bottom-nav').style.display = 'none';
    initOnboarding();
}

applyLanguage();
updateAllUI();
