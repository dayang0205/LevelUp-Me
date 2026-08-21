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
        aiPlan: "AI 推演每日功法", about: "关于此器", xp: "修为", checkinCount: "已打卡"
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
        aiPlan: "AI Generated Daily Plan", about: "About This App", xp: "XP", checkinCount: "Check-ins"
    }
};

let currentLang = localStorage.getItem('lang') || 'zh';

function t(key) {
    return translations[currentLang][key] || translations.zh[key] || key;
}

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

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerText = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
}

// ================================================================
// 1. 数据持久化核心（初始数据为空，经验为0）
// ================================================================
const STORAGE_KEY = 'xiushen_data';
let goals = [];
let userProfile = {};
let selectedGoalId = null;
let pendingCheckinGoalId = null;
let pendingCheckinTaskId = null;

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

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try { const data = JSON.parse(raw); if (data.goals && data.userProfile) return data; } catch(e) {}
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
// 3. UI 渲染（支持翻译）
// ================================================================
function updateAllUI() {
    const xp = getTotalXp();
    const realm = getRealm(xp);
    const next = getNextRealm(xp);
    const prog = getProgress(xp);

    document.getElementById('homeName').textContent = userProfile.name || t('home');
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
            const done = g.tasks.filter(t => t.status === 'done').length;
            const total = g.tasks.length;
            const pct = total > 0 ? Math.round((done/total)*100) : 0;
            return `<div class="active-goal-card" onclick="openDetail('${g.id}')">
                <div class="info"><div class="title">${g.title}</div><div class="sub">${t('checkinCount')} ${done}/${total} 天 · ⭐ ${g.totalXp}</div></div>
                <div class="progress-circle" style="background: conic-gradient(var(--primary) 0% ${pct}%, var(--input-bg) ${pct}% 100%);"><div class="inner">${pct}%</div></div>
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
            <div class="flex-between"><h4>${g.title}</h4><span class="badge-soft">${Math.round((g.tasks.filter(t=>t.status==='done').length/g.tasks.length)*100)}%</span></div>
            <div class="text-secondary" style="font-size:13px;">${t('checkinCount')} ${g.tasks.filter(t=>t.status==='done').length}/${g.tasks.length} 天 · ⭐ ${g.totalXp}</div>
        </div>`).join('');
    } else {
        container.innerHTML = list.map(g => `<div class="capsule-item" onclick="openDetail('${g.id}')">
            <div style="font-weight:600;">✅ ${g.title}</div>
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
// 5. 语音识别功能
// ================================================================
let recognition = null;
let isListening = false;

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
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        if (document.getElementById('feedbackModal').classList.contains('show')) {
            document.getElementById('feedbackInput').value = transcript;
        } else if (document.getElementById('newGoalModal').classList.contains('show')) {
            document.getElementById('newGoalInput').value = transcript;
        }
        stopListening();
    };
    recognition.onerror = function(event) {
        showToast('❌ 语音识别失败: ' + event.error);
        stopListening();
    };
    recognition.onend = function() { stopListening(); };
}

function startListening() {
    if (!recognition) setupVoice();
    if (!recognition) return;
    if (isListening) { stopListening(); return; }
    isListening = true;
    recognition.start();
    showToast('🎙️ 请开始说话...');
}

function stopListening() {
    if (recognition) recognition.stop();
    isListening = false;
    showToast('语音输入结束');
}

document.addEventListener('DOMContentLoaded', () => {
    const feedbackBtn = document.getElementById('feedbackVoiceBtn');
    const goalBtn = document.getElementById('newGoalVoiceBtn');
    if (feedbackBtn) feedbackBtn.addEventListener('click', startListening);
    if (goalBtn) goalBtn.addEventListener('click', startListening);
});

// ================================================================
// 6. AI 真实接入
// ================================================================
async function generateAIPlan() {
    const text = document.getElementById('newGoalInput').value.trim();
    const days = parseInt(document.getElementById('goalDays').value);
    if (!text) { alert('请描述目标'); return; }
    if (!days || days < 1) { alert('请输入有效的修炼天数'); return; }
    if (days > 365) { alert('天数不宜超过365天'); return; }

    const container = document.getElementById('aiPlanContainer');
    container.style.display = 'block';
    document.getElementById('aiPlanContent').innerHTML = '⏳ 正在请求 AI 推演每日任务...';

    try {
        const response = await fetch('/api/generate-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal: text, days: days, bio: userProfile.bio || '', expect: userProfile.expect || '' })
        });
        const data = await response.json();

        if (data.tasks && data.tasks.length > 0) {
            let editableTasks = data.tasks.map((t, i) => `
                <div style="margin-bottom:8px; display:flex; gap:8px; align-items:center;">
                    <span style="font-size:13px; font-weight:bold; min-width:45px; color:var(--text-secondary);">${t.day}</span>
                    <input type="text" id="task-${i}" value="${t.task}" style="flex:1; font-size:14px;">
                </div>
            `).join('');

            document.getElementById('aiPlanContent').innerHTML = `
                <div class="text-secondary" style="margin-bottom:6px;">📌 ${text}</div>
                <div style="font-weight:500; margin:6px 0;">📅 ${t('aiPlan')}</div>
                ${editableTasks}
            `;

            window._tempPlan = { title: text, tasks: data.tasks.map((t, i) => ({ day: t.day, task: document.getElementById(`task-${i}`).value })) };
        } else {
            throw new Error('AI返回格式错误');
        }
    } catch (error) {
        console.error('生成计划失败:', error);
        document.getElementById('aiPlanContent').innerHTML = `<div style="color:#c0392b;">❌ 生成失败，请检查后端服务或 API Key</div>`;
    }
}

function confirmNewGoal() {
    const plan = window._tempPlan;
    if (!plan) { alert('请先生成AI计划'); return; }
    
    const finalTasks = [];
    for (let i = 0; i < plan.tasks.length; i++) {
        const input = document.getElementById(`task-${i}`);
        if (input) finalTasks.push(input.value);
        else finalTasks.push(plan.tasks[i].task);
    }

    const newGoal = {
        id: 'g'+Date.now(),
        title: plan.title,
        status: 'active',
        totalXp: 0,
        tasks: finalTasks.map((t, idx) => ({ id: 't'+Date.now()+idx, title: t, status: 'pending', feedback: '', feedbackReply: '' })),
        history: []
    };
    goals.push(newGoal);
    closeModal();
    saveData();
    updateAllUI();
    openDetail(newGoal.id);
    window._tempPlan = null;
}

async function submitFeedback() {
    const feedback = document.getElementById('feedbackInput').value.trim();
    if (!feedback) { alert('请写下你的今日感悟'); return; }
    if (!pendingCheckinGoalId || !pendingCheckinTaskId) return;

    const g = goals.find(go => go.id === pendingCheckinGoalId);
    if (!g) return;
    const task = g.tasks.find(t => t.id === pendingCheckinTaskId);
    if (!task || task.status === 'done') return;

    const submitBtn = document.querySelector('.feedback-modal-box .btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ AI 反馈生成中...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/process-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback: feedback, goalTitle: g.title })
        });
        const result = await response.json();

        task.status = 'done';
        task.feedback = feedback;
        task.feedbackReply = result.reply || '继续加油！';
        const xpGain = 15 + (result.xpBonus || 0);
        g.totalXp += xpGain;

        const dayNum = g.tasks.indexOf(task) + 1;
        g.history.push({ date: new Date().toLocaleDateString('zh-CN'), action: `第${dayNum}天打卡: ${feedback.slice(0, 20)}${feedback.length > 20 ? '...' : ''}`, xp: xpGain });

        const allDone = g.tasks.every(t => t.status === 'done');
        if (allDone) g.status = 'completed';

        saveData();
        updateAllUI();
        closeFeedbackModal();
        openDetail(g.id);
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
// 7. 详情与反馈显示
// ================================================================
function openDetail(id) {
    selectedGoalId = id;
    const g = goals.find(go => go.id === id);
    if (!g) return;
    document.getElementById('detailTitle').textContent = g.title;
    document.getElementById('detailStatus').textContent = g.status === 'active' ? '修炼中' : '已达成';
    const done = g.tasks.filter(t => t.status === 'done').length;
    const total = g.tasks.length;
    const pct = total ? Math.round((done/total)*100) : 0;
    document.getElementById('detailProgressNum').textContent = pct + '%';
    document.getElementById('detailProgressBar').style.width = pct + '%';
    document.getElementById('detailXp').textContent = g.totalXp;
    document.getElementById('detailDoneDays').textContent = done;
    document.getElementById('detailTotalDays').textContent = total;

    const listHtml = g.tasks.map((t, idx) => {
        const isDone = t.status === 'done';
        const hasFeedback = t.feedback && t.feedback.length > 0;
        return `<div class="day-task">
            <div class="row">
                <div class="left">
                    <span class="day-label">第${idx+1}天</span>
                    <span class="task-desc">${t.title}</span>
                </div>
                <div>
                    ${isDone 
                        ? `<span class="task-status done">✅ 已反馈</span>`
                        : `<button class="day-btn" onclick="openFeedbackModal('${g.id}', '${t.id}')">打卡</button>`
                    }
                    ${isDone && hasFeedback ? `<button class="expand-toggle" onclick="toggleFeedback('${g.id}', '${t.id}')">📖 查看反馈</button>` : ''}
                </div>
            </div>
            ${isDone && hasFeedback ? `<div class="feedback-expand" id="feedback-${g.id}-${t.id}">
                <div class="user-note">📝 ${t.feedback}</div>
                <div class="ai-reply">🧠 ${t.feedbackReply || '反馈生成中...'}</div>
            </div>` : ''}
        </div>`;
    }).join('');
    document.getElementById('detailTaskList').innerHTML = listHtml;
    document.getElementById('detailOverlay').classList.add('show');
}

function closeDetail() { document.getElementById('detailOverlay').classList.remove('show'); selectedGoalId = null; }
function toggleFeedback(goalId, taskId) {
    const el = document.getElementById(`feedback-${goalId}-${taskId}`);
    if (el) el.classList.toggle('show');
}

function openFeedbackModal(goalId, taskId) {
    pendingCheckinGoalId = goalId;
    pendingCheckinTaskId = taskId;
    const g = goals.find(go => go.id === goalId);
    const task = g.tasks.find(t => t.id === taskId);
    const dayNum = g.tasks.indexOf(task) + 1;
    document.getElementById('feedbackTaskLabel').textContent = `第 ${dayNum} 天：${task.title}`;
    document.getElementById('feedbackInput').value = '';
    document.getElementById('feedbackModal').classList.add('show');
}
function closeFeedbackModal() {
    document.getElementById('feedbackModal').classList.remove('show');
    pendingCheckinGoalId = null;
    pendingCheckinTaskId = null;
}
function insertTag(tag) {
    const input = document.getElementById('feedbackInput');
    input.value = input.value ? input.value + ' 【' + tag + '】' : '【' + tag + '】';
    input.focus();
}

// ================================================================
// 8. 其他UI功能
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
// 9. 导航与主题
// ================================================================
function openNewGoalModal() {
    document.getElementById('newGoalModal').classList.add('show');
    document.getElementById('aiPlanContainer').style.display = 'none';
    document.getElementById('newGoalInput').value = '';
    document.getElementById('goalDays').value = '';
}
function closeModal() { document.getElementById('newGoalModal').classList.remove('show'); }

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
// 10. 启动
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
console.log('🧘 灵犀版已启动，AI和语音功能已接入！');
