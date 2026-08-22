// ================================================================
// 0. 国际化 (i18n)
// ================================================================
const translations = {
    zh: {
        home: "道场", goals: "目标录", profile: "我的法相",
        newGoal: "立下新目标", generatePlan: "AI 生成每日计划",
        confirmStart: "确认，开始修炼", submitFeedback: "提交并获取 AI 反馈",
        delete: "删除", cancel: "取消", progress: "修炼进度",
        currentTraining: "当前修炼", active: "修炼中", completed: "已达成",
        welcome: "欢迎来到灵犀", intro: "开启你的修炼之旅，先创建你的角色吧",
        startTraining: "开始修炼 ⚔️", bio: "个人简述", expect: "对 AI 伴侣的期望",
        aiEnhance: "AI 润色", archive: "存档管理",
        exportData: "导出存档", importData: "导入存档", resetAll: "重置所有",
        inputName: "输入你的道号（如：无名道友）", bioPlaceholder: "简单介绍你自己...", expectPlaceholder: "你希望 AI 教练以什么风格陪伴你？", newGoalPlaceholder: "例如：每天跑步3公里，提升体能", daysPlaceholder: "修炼天数（如30）",
        recordDaily: "记录今日修炼", success: "顺利完成", difficulty: "遇到困难", gain: "收获很大", improve: "明日改进",
        aiPlan: "AI 推演每日功法", about: "关于此器", xp: "修为", checkinCount: "已打卡",
        chat: "继续对话", generateFinal: "生成最终计划",
        mainGoal: "主要目标", weeklyGoal: "本周目标", todayTasks: "今日任务"
    },
    en: {
        home: "Dojo", goals: "Quest Log", profile: "Avatar",
        newGoal: "New Goal", generatePlan: "AI Generate Plan",
        confirmStart: "Confirm & Start", submitFeedback: "Submit & Get AI Feedback",
        delete: "Delete", cancel: "Cancel", progress: "Progress",
        currentTraining: "Active Training", active: "Active", completed: "Completed",
        welcome: "Welcome to Lingxi", intro: "Start your journey by creating your avatar",
        startTraining: "Start Training ⚔️", bio: "Bio", expect: "Expectations",
        aiEnhance: "AI Enhance", archive: "Archive",
        exportData: "Export", importData: "Import", resetAll: "Reset All",
        inputName: "Enter your Dao name...", bioPlaceholder: "Briefly introduce yourself...", expectPlaceholder: "How should your AI coach style be?", newGoalPlaceholder: "e.g. Run 3km daily to boost energy", daysPlaceholder: "Number of days (e.g. 30)",
        recordDaily: "Record Daily Practice", success: "Completed", difficulty: "Struggled", gain: "Great Gain", improve: "Improve Tomorrow",
        aiPlan: "AI Generated Daily Plan", about: "About This App", xp: "XP", checkinCount: "Check-ins",
        chat: "Chat", generateFinal: "Generate Final Plan",
        mainGoal: "Main Goal", weeklyGoal: "Weekly Goal", todayTasks: "Today's Tasks"
    }
};

let currentLang = localStorage.getItem('lang') || 'zh';

function t(key) { return translations[currentLang][key] || translations.zh[key] || key; }

function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('lang', currentLang);
    applyLanguage();
    updateAllUI();
    if (document.getElementById('onboarding').style.display === 'flex') initOnboarding();
}

function applyLanguage() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    document.getElementById('langLabel').innerText = currentLang === 'zh' ? 'EN' : '中';

    document.querySelectorAll('[data-i18n]').forEach(el => { el.innerText = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}

// ================================================================
// 1. 数据持久化核心（新结构：主/周/日）
// ================================================================
const STORAGE_KEY = 'xiushen_data'; // 建议改为 'xiushen_data_v2' 以免冲突
let goals = [];
let userProfile = {};
let selectedGoalId = null;
let pendingCheckinGoalId = null;
let pendingCheckinTaskId = null;
let chatHistory = []; // 多轮对话历史

const REALMS = [
    { level: 0, name: '凡人', emoji: '🧘', xpRequired: 0 },
    { level: 1, name: '炼气', emoji: '🌪️', xpRequired: 100 },
    { level: 2, name: '筑基', emoji: '🪨', xpRequired: 300 },
    { level: 3, name: '金丹', emoji: '🔮', xpRequired: 600 },
    { level: 4, name: '元婴', emoji: '👶', xpRequired: 1000 },
    { level: 5, name: '化神', emoji: '✨', xpRequired: 1600 },
    { level: 6, name: '合体', emoji: '☯️', xpRequired: 2400 },
    { level: 7, name: '渡劫', emoji: '⚡', xpRequired: 3500 },
    { level: 8, name: '大乘', emoji: '🌟', xpRequired: 5000 },
    { level: 9, name: '宗师', emoji: '🏆', xpRequired: 8000 },
];

const avatarOptions = ['🧘', '🧝', '🧙', '🦊', '🐉', '🌿', '🌟', '⚡', '🌸', '🍃', '💫', '🌙', '☀️', '🪷'];

function getSeedData() {
    return { goals: [], userProfile: { name: '无名道友', avatar: '🧘', bio: '一名对自我成长充满热情的探索者。', expect: '希望 AI 能温柔而坚定地陪伴我。' } };
}

// 【新增】自动兼容旧数据，防止因格式不同导致 JS 崩溃
function normalizeData(data) {
    if (data.goals) {
        data.goals = data.goals.map(g => {
            // 如果旧数据是 tasks 数组，自动转换成 todayTasks
            if (!g.todayTasks && g.tasks) {
                g.todayTasks = g.tasks.map(t => ({ 
                    text: t.title || t.task || t, 
                    done: t.status === 'done' 
                }));
            }
            // 如果没有任务，设为空数组
            if (!g.todayTasks) g.todayTasks = [];
            delete g.tasks; // 删除旧字段，避免干扰
            return g;
        });
    }
    return data;
}

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            let data = JSON.parse(raw);
            // 【关键】调用 normalizeData，确保数据兼容
            if (data.goals && data.userProfile) return normalizeData(data);
        } catch (e) {}
    }
    const seed = getSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ goals, userProfile }));
}

// ================================================================
// 2. 通用工具
// ================================================================
function showToast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

function getTotalXp() { return goals.reduce((s, g) => s + g.totalXp, 0); }
function getRealm(xp) { let r = REALMS[0]; for (let i=REALMS.length-1;i>=0;i--) if (xp>=REALMS[i].xpRequired) { r=REALMS[i]; break; } return r; }
function getNextRealm(xp) { for (let r of REALMS) if (xp < r.xpRequired) return r; return REALMS[REALMS.length-1]; }
function getProgress(xp) {
    const next = getNextRealm(xp);
    const prev = REALMS[Math.max(0, next.level - 1)];
    const needed = next.xpRequired - prev.xpRequired;
    return Math.min(100, Math.round(((xp - prev.xpRequired) / needed) * 100));
}
function getActive() { return goals.filter(g => g.status === 'active'); }
function getCompleted() { return goals.filter(g => g.status === 'completed'); }

// ================================================================
// 3. UI 渲染（首页 & 目标录）
// ================================================================
function updateAllUI() {
    const xp = getTotalXp();
    const realm = getRealm(xp);
    const next = getNextRealm(xp);
    const prog = getProgress(xp);

    document.getElementById('homeName').textContent = userProfile.name || '无名道友';
    document.getElementById('homeAvatar').textContent = userProfile.avatar || '🧘';
    document.getElementById('homeRealmTag').textContent = realm.name;
    document.getElementById('realmEmoji').textContent = realm.emoji;
    document.getElementById('realmName').textContent = realm.name;
    document.getElementById('realmLevel').textContent = `Lv.${realm.level}`;
    document.getElementById('totalXpHome').textContent = xp;
    document.getElementById('xpBarHome').style.width = prog + '%';
    document.getElementById('nextRealmName').textContent = next.name;
    const prevXp = REALMS[Math.max(0, realm.level - 1)].xpRequired;
    document.getElementById('xpProgressText').textContent = `${xp - prevXp} / ${next.xpRequired - prevXp}`;

    document.getElementById('profileNameInput').value = userProfile.name || '';
    document.getElementById('profileAvatar').textContent = userProfile.avatar || '🧘';
    document.getElementById('userBio').value = userProfile.bio || '';
    document.getElementById('userExpect').value = userProfile.expect || '';

    const active = getActive();
    document.getElementById('activeCount').textContent = active.length + ' 个';
    const container = document.getElementById('activeGoalsContainer');
    if (!active.length) {
        container.innerHTML = `<div class="text-secondary text-center" style="padding:24px 0;">${t('noGoals')}</div>`;
    } else {
        container.innerHTML = active.map(g => {
            const doneCount = g.todayTasks.filter(task => task.done).length;
            const total = g.todayTasks.length;
            const pct = total > 0 ? Math.round((doneCount/total)*100) : 0;
            return `<div class="active-goal-card" onclick="openDetail('${g.id}')">
                <div class="info">
                    <div class="title">${g.mainGoal}</div>
                    <div class="sub">${t('weeklyGoal')}: ${g.weeklyGoal} | ${t('todayTasks')}: ${doneCount}/${total}</div>
                </div>
                <div class="progress-circle" style="background: conic-gradient(var(--primary) 0% ${pct}%, var(--input-bg) ${pct}% 100%);">
                    <div class="inner">${pct}%</div>
                </div>
            </div>`;
        }).join('');
    }
    renderGoalList();
}

function renderGoalList() {
    const view = document.querySelector('#goalViewTabs .active')?.dataset.view || 'active';
    const container = document.getElementById('goalListContainer');
    let list = view === 'active' ? getActive() : getCompleted();
    if (!list.length) { container.innerHTML = `<div class="text-secondary text-center" style="padding:40px 0;">${t('noGoals')}</div>`; return; }
    if (view === 'active') {
        container.innerHTML = list.map(g => `<div class="goal-list-item" onclick="openDetail('${g.id}')">
            <div class="flex-between"><h4>${g.mainGoal}</h4><span class="badge-soft">${g.todayTasks.filter(t=>t.done).length}/${g.todayTasks.length}</span></div>
            <div class="text-secondary" style="font-size:13px;">${t('weeklyGoal')}: ${g.weeklyGoal} · ⭐ ${g.totalXp}</div>
        </div>`).join('');
    } else {
        container.innerHTML = list.map(g => `<div class="capsule-item" onclick="openDetail('${g.id}')">
            <div style="font-weight:600;">✅ ${g.mainGoal}</div>
            <div class="text-secondary" style="font-size:13px;">⭐ ${g.totalXp} 修为 · ${g.history.length ? g.history[g.history.length-1].action : '已完成'}</div>
        </div>`).join('');
    }
}

// ================================================================
// 4. 用户创建引导
// ================================================================
let selectedAvatar = '🧘';
function initOnboarding() {
    const container = document.getElementById('avatarPicker');
    if (!container) return;
    container.innerHTML = avatarOptions.map(av => `<span class="${av === '🧘' ? 'selected' : ''}" onclick="selectAvatar('${av}')">${av}</span>`).join('');
}
function selectAvatar(av) {
    selectedAvatar = av;
    document.querySelectorAll('#avatarPicker span').forEach(s => s.classList.remove('selected'));
    event.target.classList.add('selected');
}
function finishOnboarding() {
    const name = document.getElementById('inputName').value.trim() || '无名道友';
    userProfile = { name, avatar: selectedAvatar, bio: '一名对自我成长充满热情的探索者。', expect: '希望 AI 能温柔而坚定地陪伴我。' };
    localStorage.setItem('hasOnboarded', 'true');
    saveData();
    updateAllUI();
    document.getElementById('onboarding').style.display = 'none';
    document.querySelector('.bottom-nav').style.display = 'flex';
}

// ================================================================
// 5. 语音识别功能（修复叠字问题）
// ================================================================
let recognition = null;
let isListening = false;
let voiceBaseText = ''; // 【关键修复】保存语音开始前输入框里已有的内容

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
    recognition.interimResults = true; 
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalTranscript += transcript;
            else interimTranscript += transcript;
        }
        
        const activeInput = 
            document.getElementById('feedbackModal').classList.contains('show') ? document.getElementById('feedbackInput') :
            document.getElementById('newGoalModal').classList.contains('show') ? document.getElementById('newGoalInput') :
            null;

        if (activeInput) {
            // 【核心修复】直接覆盖赋值：原内容 + 最终结果 + 临时结果，绝不使用 replace！
            activeInput.value = voiceBaseText + finalTranscript + interimTranscript;
        }
    };
    recognition.onerror = function(event) { showToast('❌ 语音识别失败: ' + event.error); stopListening(); };
    recognition.onend = function() { stopListening(); };
}

function startListening() {
    if (!recognition) setupVoice();
    if (!recognition) return;
    if (isListening) { stopListening(); return; }
    isListening = true;

    // 【关键修复】开始说话前，把当前输入框里的内容暂存起来
    const activeInput = 
        document.getElementById('feedbackModal').classList.contains('show') ? document.getElementById('feedbackInput') :
        document.getElementById('newGoalModal').classList.contains('show') ? document.getElementById('newGoalInput') :
        null;
    
    voiceBaseText = activeInput ? activeInput.value : '';
    
    recognition.start();
    showToast('🎙️ 请开始说话...');
}

function stopListening() {
    if (recognition) recognition.stop();
    isListening = false;
}

// ================================================================
// 6. AI 多轮对话与结构化目标生成
// ================================================================
function appendChat(sender, text) {
    const win = document.getElementById('chatWindow');
    if (!win) return;
    win.innerHTML += `<div style="margin-bottom:8px;"><strong>${sender}:</strong> ${text}</div>`;
    win.scrollTop = win.scrollHeight;
}

async function chatWithAI() {
    const input = document.getElementById('newGoalInput').value.trim();
    if (!input) return;
    appendChat('你', input);
    document.getElementById('newGoalInput').value = '';
    chatHistory.push({ role: 'user', content: input });

    try {
        const res = await fetch('/api/generate-plan', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'chat', history: chatHistory, bio: userProfile.bio })
        });
        const data = await res.json();
        if (data.reply) {
            appendChat('AI教练', data.reply);
            chatHistory.push({ role: 'assistant', content: data.reply });
        }
    } catch (e) {
        appendChat('系统', '网络错误，请重试');
    }
}

async function generateFinalPlan() {
    const input = document.getElementById('newGoalInput').value.trim();
    if (input) {
        chatHistory.push({ role: 'user', content: input });
        document.getElementById('newGoalInput').value = '';
    }
    const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'generate', history: chatHistory, bio: userProfile.bio })
    });
    const plan = await res.json();

    if (plan.mainGoal) {
        const newGoal = {
            id: 'g'+Date.now(),
            mainGoal: plan.mainGoal,
            weeklyGoal: plan.weeklyGoal,
            todayTasks: plan.todayTasks.map(t => ({ text: t, done: false })),
            status: 'active',
            totalXp: 0,
            history: []
        };
        goals.push(newGoal);
        saveData();
        closeModal();
        updateAllUI();
        showToast('✅ 目标已生成并激活！');
    } else {
        alert(plan.error || '生成失败，请再试一次');
    }
}

function openNewGoalModal() {
    document.getElementById('newGoalModal').classList.add('show');
    chatHistory = [];
    const win = document.getElementById('chatWindow');
    if (win) win.innerHTML = `<div class="text-secondary" style="font-size:13px;">AI教练：你好！先告诉我一个你想突破的大方向吧（比如：“我想练好英语口语”）。</div>`;
}
function closeModal() { document.getElementById('newGoalModal').classList.remove('show'); }

// ================================================================
// 7. 详情与今日任务
// ================================================================
function openDetail(id) {
    selectedGoalId = id;
    const g = goals.find(go => go.id === id);
    if (!g) return;
    
    document.getElementById('detailTitle').textContent = g.mainGoal;
    document.getElementById('detailStatus').textContent = g.status === 'active' ? '修炼中' : '已达成';
    
    const doneCount = g.todayTasks.filter(t => t.done).length;
    const total = g.todayTasks.length;
    const pct = total ? Math.round((doneCount/total)*100) : 0;
    document.getElementById('detailProgressNum').textContent = pct + '%';
    document.getElementById('detailProgressBar').style.width = pct + '%';
    document.getElementById('detailXp').textContent = g.totalXp;

    let detailHtml = `
        <div class="card" style="margin-bottom:16px;">
            <h3>🎯 ${g.mainGoal}</h3>
            <div style="color:var(--text-secondary); margin:8px 0;">${t('weeklyGoal')}: ${g.weeklyGoal}</div>
            <div style="margin-top:16px;">
                <div style="font-weight:600; margin-bottom:10px;">📌 ${t('todayTasks')}</div>
                ${g.todayTasks.map((task, i) => `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:8px; border:1px solid var(--card-border); border-radius:8px; cursor:pointer;" onclick="toggleTodayTask('${g.id}', ${i})">
                        <span style="font-size:20px;">${task.done ? '✅' : '⬜'}</span>
                        <span style="${task.done ? 'text-decoration:line-through; color:var(--text-secondary);' : ''}">${task.text}</span>
                    </div>`).join('')
                }
            </div>
            <div style="margin-top:12px; font-size:13px; color:var(--text-secondary);">${t('xp')}: ⭐ ${g.totalXp}</div>
        </div>
        <div style="text-align:center;">
            <button class="btn-primary" style="margin-bottom:10px;" onclick="openFeedbackModal('${g.id}')">📝 ${t('recordDaily')}</button>
            <button class="btn-outline" style="color:#c0392b;" onclick="deleteGoal('${g.id}')">${t('delete')}</button>
        </div>
    `;
    document.getElementById('detailTaskList').innerHTML = detailHtml;
    document.getElementById('detailOverlay').classList.add('show');
}

function closeDetail() { document.getElementById('detailOverlay').classList.remove('show'); selectedGoalId = null; }
function toggleFeedback(goalId, taskId) {
    const el = document.getElementById(`feedback-${goalId}-${taskId}`);
    if (el) el.classList.toggle('show');
}

function toggleTodayTask(goalId, taskIndex) {
    const g = goals.find(x => x.id === goalId);
    if (!g) return;
    const task = g.todayTasks[taskIndex];
    if (!task.done) {
        task.done = true;
        g.totalXp += 15;
        showToast('✅ 今日任务完成！+15修为');
    } else {
        task.done = false;
        g.totalXp -= 15;
        showToast('已取消完成');
    }
    saveData();
    openDetail(goalId);
}

// ================================================================
// 8. 反馈逻辑
// ================================================================
function openFeedbackModal(goalId) {
    pendingCheckinGoalId = goalId;
    document.getElementById('feedbackTaskLabel').textContent = `📝 ${t('recordDaily')}`;
    document.getElementById('feedbackInput').value = '';
    document.getElementById('feedbackModal').classList.add('show');
}
function closeFeedbackModal() {
    document.getElementById('feedbackModal').classList.remove('show');
    pendingCheckinGoalId = null;
}
function insertTag(tag) {
    const input = document.getElementById('feedbackInput');
    input.value = input.value ? input.value + ' 【' + tag + '】' : '【' + tag + '】';
    input.focus();
}

async function submitFeedback() {
    const feedback = document.getElementById('feedbackInput').value.trim();
    if (!feedback) { alert('请写下你的今日感悟'); return; }
    if (!pendingCheckinGoalId) return;

    const g = goals.find(go => go.id === pendingCheckinGoalId);
    if (!g) return;

    const submitBtn = document.querySelector('.feedback-modal-box .btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ AI 反馈生成中...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/process-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback: feedback, goalTitle: g.mainGoal })
        });
        const result = await response.json();

        const xpGain = 15 + (result.xpBonus || 0);
        g.totalXp += xpGain;
        g.history.push({ date: new Date().toLocaleDateString('zh-CN'), action: `反思: ${feedback.slice(0, 20)}${feedback.length > 20 ? '...' : ''}`, xp: xpGain });

        saveData();
        closeFeedbackModal();
        updateAllUI();
        openDetail(g.id);
        showToast('✅ 反馈已提交，获得 '+xpGain+' 修为！');
    } catch (error) {
        console.error('AI反馈失败:', error);
        alert('获取AI反馈失败，请稍后重试');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function deleteGoal(goalId) {
    if (!confirm('确定要删除这个目标吗？所有打卡记录将永久丢失！')) return;
    goals = goals.filter(g => g.id !== goalId);
    saveData();
    closeDetail();
    updateAllUI();
    showToast('🗑️ 目标已删除');
}

// ================================================================
// 9. 其他UI功能（保留原有的编辑、导出等）
// ================================================================
function editAvatar() {
    const current = userProfile.avatar || '🧘';
    let idx = avatarOptions.indexOf(current);
    if (idx === -1) idx = 0;
    userProfile.avatar = avatarOptions[(idx + 1) % avatarOptions.length];
    updateAllUI(); saveData();
}
function editName() {
    const newName = prompt('输入你的道号：', userProfile.name || '无名道友');
    if (newName && newName.trim()) { userProfile.name = newName.trim(); updateAllUI(); saveData(); }
}
function updateProfileFromName() {
    const val = document.getElementById('profileNameInput').value.trim();
    if (val) userProfile.name = val;
    else document.getElementById('profileNameInput').value = userProfile.name || '无名道友';
    updateAllUI(); saveData();
}
function updateProfile() {
    userProfile.bio = document.getElementById('userBio').value;
    userProfile.expect = document.getElementById('userExpect').value;
    saveData();
}

function exportData() {
    const payload = { goals, userProfile, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `xiushen_存档_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('✅ 存档已导出！');
}
function importData(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.goals || !data.userProfile) { showToast('❌ 无效文件'); return; }
            if (!confirm('导入将覆盖当前所有数据，确定吗？')) return;
            goals = data.goals; userProfile = data.userProfile;
            saveData(); updateAllUI(); showToast('✅ 导入成功！');
        } catch(err) { showToast('❌ 解析失败'); }
    };
    reader.readAsText(file); event.target.value = '';
}
function resetAllData() {
    if (!confirm('⚠️ 确定要清除所有修炼数据吗？')) return;
    localStorage.removeItem(STORAGE_KEY);
    const seed = getSeedData();
    goals = seed.goals; userProfile = seed.userProfile;
    saveData(); updateAllUI(); showToast('🗑️ 已重置');
}

// ================================================================
// 10. 导航与主题
// ================================================================
function switchTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-option .check').forEach(c => c.textContent = '');
    const check = document.getElementById('check-' + theme);
    if (check) check.textContent = '✓';
    document.getElementById('headerThemeDot').style.background = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#9CAF8D';
    document.getElementById('themeDropdown').classList.remove('open');
}
function toggleThemeDropdown() {
    const dd = document.getElementById('themeDropdown');
    dd.classList.toggle('open');
}
function closeThemeDropdownOutside(e) {
    const toggler = document.querySelector('.theme-toggler');
    if (!toggler.contains(e.target)) {
        document.getElementById('themeDropdown').classList.remove('open');
    }
}

const savedTheme = localStorage.getItem('theme') || 'sage';
switchTheme(savedTheme);

const navItems = document.querySelectorAll('.nav-item');
const pages = [document.getElementById('page-home'), document.getElementById('page-goals'), document.getElementById('page-profile')];
navItems.forEach((item, index) => {
    item.addEventListener('click', function() {
        navItems.forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        pages.forEach((p, i) => p.classList.toggle('active', i === index));
        updateAllUI();
    });
});
document.querySelectorAll('#goalViewTabs button').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('#goalViewTabs button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        renderGoalList();
    });
});

// ================================================================
// 11. 启动
// ================================================================
const saved = loadData();
goals = saved.goals;
userProfile = saved.userProfile;

const hasOnboarded = localStorage.getItem('hasOnboarded');
if (!hasOnboarded) {
    document.getElementById('onboarding').style.display = 'flex';
    document.querySelector('.bottom-nav').style.display = 'none';
    initOnboarding();
} else {
    document.getElementById('onboarding').style.display = 'none';
}

applyLanguage();
updateAllUI();
console.log('🧘 灵犀版已启动，多轮对话和语音功能已接入！');
