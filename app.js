// ================================================================
// 1. 数据持久化核心（初始数据为空，经验为0）
// ================================================================
const STORAGE_KEY = 'xiushen_data';
let goals = [];
let userProfile = {};
let selectedGoalId = null;
let pendingCheckinGoalId = null;
let pendingCheckinTaskId = null;

// 境界系统
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

// 头像选项
const avatarOptions = ['🧘', '🧝', '🧙', '🦊', '🐉', '🌿', '🌟', '⚡', '🌸', '🍃', '💫', '🌙', '☀️', '🪷'];

// 全新用户数据（没有任何预设目标和经验）
function getSeedData() {
    return {
        goals: [],
        userProfile: {
            name: '无名道友',
            avatar: '🧘',
            bio: '一名对自我成长充满热情的探索者。',
            expect: '希望 AI 能温柔而坚定地陪伴我。'
        }
    };
}

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            if (data.goals && data.userProfile) return data;
        } catch(e) {}
    }
    const seed = getSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
}

function saveData() {
    const payload = { goals, userProfile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ================================================================
// 2. 导出 / 导入 / 重置
// ================================================================
function showToast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

function exportData() {
    const payload = { goals, userProfile, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xiushen_存档_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ 存档已导出！');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.goals || !data.userProfile) {
                showToast('❌ 无效的存档文件');
                return;
            }
            if (!confirm('导入将覆盖当前所有数据，确定继续吗？')) return;
            goals = data.goals;
            userProfile = data.userProfile;
            saveData();
            updateAllUI();
            showToast('✅ 存档导入成功！');
        } catch(err) {
            showToast('❌ 文件解析失败');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function resetAllData() {
    if (!confirm('⚠️ 确定要清除所有修炼数据吗？此操作不可撤销！')) return;
    if (!confirm('⚠️ 再次确认：所有打卡记录、修为、目标都将被清除！')) return;
    localStorage.removeItem(STORAGE_KEY);
    const seed = getSeedData();
    goals = seed.goals;
    userProfile = seed.userProfile;
    saveData();
    updateAllUI();
    showToast('🗑️ 已重置所有数据');
}

// ================================================================
// 3. 工具函数
// ================================================================
function getTotalXp() { return goals.reduce((s, g) => s + g.totalXp, 0); }
function getRealm(xp) { let r = REALMS[0]; for (let i=REALMS.length-1;i>=0;i--) if (xp>=REALMS[i].xpRequired) { r=REALMS[i]; break; } return r; }
function getNextRealm(xp) { for (let r of REALMS) if (xp < r.xpRequired) return r; return REALMS[REALMS.length-1]; }
function getProgress(xp) {
    const next = getNextRealm(xp);
    const prev = REALMS[Math.max(0, next.level - 1)];
    const needed = next.xpRequired - prev.xpRequired;
    const current = xp - prev.xpRequired;
    return Math.min(100, Math.round((current / needed) * 100));
}
function getActive() { return goals.filter(g => g.status === 'active'); }
function getCompleted() { return goals.filter(g => g.status === 'completed'); }

// ================================================================
// 4. UI 渲染（包含所有主界面更新）
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
        container.innerHTML = `<div class="text-secondary text-center" style="padding:24px 0;">暂无修炼目标，立下一个吧</div>`;
    } else {
        container.innerHTML = active.map(g => {
            const done = g.tasks.filter(t => t.status === 'done').length;
            const total = g.tasks.length;
            const pct = total > 0 ? Math.round((done/total)*100) : 0;
            return `<div class="active-goal-card" onclick="openDetail('${g.id}')">
                <div class="info"><div class="title">${g.title}</div><div class="sub">打卡 ${done}/${total} 天 · ⭐ ${g.totalXp}</div></div>
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
    if (!list.length) { container.innerHTML = `<div class="text-secondary text-center" style="padding:40px 0;">暂无记录</div>`; return; }
    if (view === 'active') {
        container.innerHTML = list.map(g => {
            const done = g.tasks.filter(t => t.status === 'done').length;
            const total = g.tasks.length;
            return `<div class="goal-list-item" onclick="openDetail('${g.id}')">
                <div class="flex-between"><h4>${g.title}</h4><span class="badge-soft">${Math.round((done/total)*100)}%</span></div>
                <div class="text-secondary" style="font-size:13px;">打卡 ${done}/${total} 天 · ⭐ ${g.totalXp}</div>
            </div>`;
        }).join('');
    } else {
        container.innerHTML = list.map(g => `<div class="capsule-item" onclick="openDetail('${g.id}')">
            <div style="font-weight:600;">✅ ${g.title}</div>
            <div class="text-secondary" style="font-size:13px;">⭐ ${g.totalXp} 修为 · ${g.history.length ? g.history[g.history.length-1].action : '已完成'}</div>
        </div>`).join('');
    }
}

// ================================================================
// 5. 创建用户界面（新手引导）
// ================================================================
let selectedAvatar = '🧘';

function initOnboarding() {
    const container = document.getElementById('avatarPicker');
    if (!container) return;
    container.innerHTML = avatarOptions.map(av => 
        `<span class="${av === '🧘' ? 'selected' : ''}" onclick="selectAvatar('${av}')">${av}</span>`
    ).join('');
}

function selectAvatar(av) {
    selectedAvatar = av;
    document.querySelectorAll('#avatarPicker span').forEach(s => s.classList.remove('selected'));
    event.target.classList.add('selected');
}

function finishOnboarding() {
    const name = document.getElementById('inputName').value.trim() || '无名道友';
    userProfile = {
        name: name,
        avatar: selectedAvatar,
        bio: '一名对自我成长充满热情的探索者。',
        expect: '希望 AI 能温柔而坚定地陪伴我。'
    };
    localStorage.setItem('hasOnboarded', 'true');
    saveData();
    updateAllUI();
    document.getElementById('onboarding').style.display = 'none';
    document.querySelector('.bottom-nav').style.display = 'flex';
}

// ================================================================
// 6. 头像 & 道号
// ================================================================
function editAvatar() {
    const current = userProfile.avatar || '🧘';
    let idx = avatarOptions.indexOf(current);
    if (idx === -1) idx = 0;
    userProfile.avatar = avatarOptions[(idx + 1) % avatarOptions.length];
    updateAllUI();
    saveData();
    const el = document.getElementById('profileAvatar');
    el.style.transform = 'scale(0.8)';
    setTimeout(() => el.style.transform = 'scale(1)', 200);
}

function editName() {
    const newName = prompt('输入你的道号：', userProfile.name || '无名道友');
    if (newName && newName.trim()) {
        userProfile.name = newName.trim();
        updateAllUI();
        saveData();
    }
}

function updateProfileFromName() {
    const val = document.getElementById('profileNameInput').value.trim();
    if (val) userProfile.name = val;
    else document.getElementById('profileNameInput').value = userProfile.name || '无名道友';
    updateAllUI();
    saveData();
}

function updateProfile() {
    userProfile.bio = document.getElementById('userBio').value;
    userProfile.expect = document.getElementById('userExpect').value;
    saveData();
}

// ================================================================
// 7. AI 模拟与反馈
// ================================================================
function aiEnhance(type) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '⏳ 推演中...';
    btn.disabled = true;
    setTimeout(() => {
        if (type === 'bio') {
            const current = document.getElementById('userBio').value;
            const enhanced = current + ' 我热爱学习新事物，相信持续的小进步会带来巨大的改变。在日常生活中，我注重平衡工作与自我提升，希望能找到一条既高效又可持续的成长路径。';
            document.getElementById('userBio').value = enhanced;
            userProfile.bio = enhanced;
        } else if (type === 'expect') {
            const current = document.getElementById('userExpect').value;
            const enhanced = current + ' 我希望AI能在关键时刻给予精准的提醒，而不是泛泛的鼓励。同时，我也希望AI能根据我的状态动态调整节奏——当我疲惫时降低强度，当我状态好时适当加码。';
            document.getElementById('userExpect').value = enhanced;
            userProfile.expect = enhanced;
        }
        saveData();
        btn.textContent = '✅ 已完善';
        btn.style.background = 'var(--success)';
        btn.style.color = '#fff';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
            btn.disabled = false;
        }, 2000);
    }, 1200);
}

function generateAIReply(userFeedback) {
    const replies = [
        '很好！你正在稳步前进。继续保持这种节奏，你会看到更大的进步。',
        '今天的执行很到位。如果能在细节上多花5分钟，效果会更好。',
        '收获很大！你已经开始看到成果了，期待你明天的突破。',
        '遇到困难是正常的，这说明你在挑战自己。建议明天先从简单的部分开始。',
        '数据记录很清晰，你正在用行动积累证据。继续加油！',
        '你的反思很有深度，这就是成长的关键。今天做得很棒。'
    ];
    if (userFeedback.includes('困难') || userFeedback.includes('难')) {
        return '遇到困难是修炼的一部分。建议把大问题拆解成小步骤，明天试试看。';
    }
    if (userFeedback.includes('顺利') || userFeedback.includes('完成')) {
        return '顺利完成就是最好的正向反馈。明天可以尝试稍微提高一点点难度。';
    }
    if (userFeedback.includes('收获')) {
        return '能感受到你的收获感！记得把这种成就感转化为明天的动力。';
    }
    if (userFeedback.includes('改进') || userFeedback.includes('明天')) {
        return '有改进意识说明你在主动思考。明天执行时留意那个改进点，会有惊喜。';
    }
    return replies[Math.floor(Math.random() * replies.length)];
}

// ================================================================
// 8. 详情 & 打卡
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
        const dayNum = idx + 1;
        const hasFeedback = t.feedback && t.feedback.length > 0;
        return `<div class="day-task">
            <div class="row">
                <div class="left">
                    <span class="day-label">第${dayNum}天</span>
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
                <div class="ai-reply">🧠 ${generateAIReply(t.feedback)}</div>
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

// ================================================================
// 9. 打卡反馈
// ================================================================
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
    const prefix = input.value ? input.value + ' ' : '';
    input.value = prefix + '【' + tag + '】 ';
    input.focus();
}
document.getElementById('feedbackVoiceBtn').addEventListener('click', function() {
    const mocks = [
        '顺利完成了今天的任务，感觉状态不错，跑了2.5公里，比昨天快了20秒。',
        '今天遇到了一些困难，Pandas的merge函数参数没搞明白，卡了半小时。',
        '收获很大！学会了新的技巧，明天可以应用到实际项目中。',
        '顺利完成，但感觉效率还可以提升，明天尝试用番茄工作法。'
    ];
    document.getElementById('feedbackInput').value = mocks[Math.floor(Math.random()*mocks.length)];
});

function submitFeedback() {
    const feedback = document.getElementById('feedbackInput').value.trim();
    if (!feedback) { alert('请写下你的今日感悟，AI 才能给你反馈哦'); return; }
    if (!pendingCheckinGoalId || !pendingCheckinTaskId) return;

    const g = goals.find(go => go.id === pendingCheckinGoalId);
    if (!g) return;
    const task = g.tasks.find(t => t.id === pendingCheckinTaskId);
    if (!task || task.status === 'done') return;

    task.status = 'done';
    task.feedback = feedback;
    const bonus = Math.min(15, Math.floor(feedback.length / 10));
    const xpGain = 15 + bonus;
    g.totalXp += xpGain;

    const dayNum = g.tasks.indexOf(task) + 1;
    g.history.push({
        date: new Date().toLocaleDateString('zh-CN'),
        action: `第${dayNum}天打卡: ${feedback.slice(0, 20)}${feedback.length > 20 ? '...' : ''}`,
        xp: xpGain
    });

    const allDone = g.tasks.every(t => t.status === 'done');
    if (allDone) g.status = 'completed';

    closeFeedbackModal();
    saveData();
    updateAllUI();
    openDetail(g.id);
}

// ================================================================
// 10. 新目标
// ================================================================
function openNewGoalModal() {
    document.getElementById('newGoalModal').classList.add('show');
    document.getElementById('aiPlanContainer').style.display = 'none';
    document.getElementById('newGoalInput').value = '';
    document.getElementById('goalDays').value = '';
}
function closeModal() { document.getElementById('newGoalModal').classList.remove('show'); }

document.getElementById('newGoalVoiceBtn').addEventListener('click', function() {
    const mocks = ['每天跑步3公里，提升体能', '每日学习Python 1小时', '每天阅读30分钟'];
    document.getElementById('newGoalInput').value = mocks[Math.floor(Math.random()*mocks.length)];
});

function generateAIPlan() {
    const text = document.getElementById('newGoalInput').value.trim();
    const days = parseInt(document.getElementById('goalDays').value);
    if (!text) { alert('请描述目标'); return; }
    if (!days || days < 1) { alert('请输入有效的修炼天数'); return; }
    if (days > 365) { alert('天数不宜超过365天'); return; }

    const container = document.getElementById('aiPlanContainer');
    container.style.display = 'block';
    document.getElementById('aiPlanContent').innerHTML = '⏳ 推演每日任务...';

    setTimeout(() => {
        let taskTemplate = '';
        if (text.includes('跑') || text.includes('步')) {
            taskTemplate = '跑步 {distance} 公里，记录配速';
        } else if (text.includes('Python') || text.includes('编程') || text.includes('数据')) {
            taskTemplate = '学习 Python {topic} 30分钟，记录代码片段';
        } else if (text.includes('阅读') || text.includes('书')) {
            taskTemplate = '阅读 {book} 20页，记录核心观点';
        } else {
            taskTemplate = '完成 {goal} 相关练习，记录产出';
        }

        const previewTasks = [];
        for (let i = 1; i <= Math.min(days, 5); i++) {
            let desc = taskTemplate
                .replace('{distance}', (2 + (i % 3)) + '')
                .replace('{topic}', ['基础', '函数', '数据处理', '可视化', '项目'][i % 5])
                .replace('{book}', ['第一章', '第二章', '第三章', '第四章', '第五章'][i % 5])
                .replace('{goal}', text.slice(0, 10));
            previewTasks.push(`第${i}天：${desc}`);
        }
        const more = days > 5 ? `… 共 ${days} 天` : '';

        document.getElementById('aiPlanContent').innerHTML = `
            <div class="text-secondary" style="margin-bottom:6px;">📌 ${text}</div>
            <div style="font-weight:500; margin:6px 0;">📅 每日修炼（共 ${days} 天）</div>
            ${previewTasks.map(t => `<div style="padding:4px 0; border-bottom:1px solid var(--card-border); font-size:14px;">${t}</div>`).join('')}
            ${more ? `<div class="text-secondary" style="margin-top:6px;">${more}</div>` : ''}
            <div style="font-size:12px; color:var(--text-secondary); margin-top:8px;">🧠 每完成一天并记录反馈，可获得 15~30 修为</div>
        `;

        const fullTasks = [];
        for (let i = 1; i <= days; i++) {
            let desc = taskTemplate
                .replace('{distance}', (2 + (i % 3)) + '')
                .replace('{topic}', ['基础', '函数', '数据处理', '可视化', '项目'][i % 5])
                .replace('{book}', ['第一章', '第二章', '第三章', '第四章', '第五章'][i % 5])
                .replace('{goal}', text.slice(0, 10));
            fullTasks.push(`第${i}天：${desc}`);
        }
        window._tempPlan = { title: text, tasks: fullTasks };
    }, 1200);
}

function confirmNewGoal() {
    const plan = window._tempPlan;
    if (!plan) { alert('请先生成AI计划'); return; }
    const newGoal = {
        id: 'g'+Date.now(),
        title: plan.title,
        status: 'active',
        totalXp: 0,
        tasks: plan.tasks.map((t, idx) => ({
            id: 't'+Date.now()+idx,
            title: t,
            status: 'pending',
            feedback: ''
        })),
        history: []
    };
    goals.push(newGoal);
    closeModal();
    saveData();
    updateAllUI();
    openDetail(newGoal.id);
    window._tempPlan = null;
}

// ================================================================
// 11. 主题切换
// ================================================================
function switchTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-option .check').forEach(c => c.textContent = '');
    const check = document.getElementById('check-' + theme);
    if (check) check.textContent = '✓';
    document.getElementById('headerThemeDot').style.background = 
        getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#9CAF8D';
    document.getElementById('themeDropdown').classList.remove('open');
}

function toggleThemeDropdown() {
    const dd = document.getElementById('themeDropdown');
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) {
        setTimeout(() => {
            document.addEventListener('click', closeThemeDropdownOutside, { once: true });
        }, 10);
    }
}
function closeThemeDropdownOutside(e) {
    const toggler = document.querySelector('.theme-toggler');
    if (!toggler.contains(e.target)) {
        document.getElementById('themeDropdown').classList.remove('open');
    }
}

const savedTheme = localStorage.getItem('theme') || 'sage';
switchTheme(savedTheme);

// ================================================================
// 12. 导航
// ================================================================
const navItems = document.querySelectorAll('.nav-item');
const pages = [
    document.getElementById('page-home'),
    document.getElementById('page-goals'),
    document.getElementById('page-profile')
];
navItems.forEach((item, index) => {
    item.addEventListener('click', function() {
        if (document.getElementById('detailOverlay').classList.contains('show')) closeDetail();
        if (document.getElementById('feedbackModal').classList.contains('show')) closeFeedbackModal();
        navItems.forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        pages.forEach((p, i) => p.classList.toggle('active', i === index));
        if (index === 0 || index === 1) updateAllUI();
        if (index === 2) updateAllUI();
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
// 13. 启动逻辑（包含首次进入判断）
// ================================================================
const saved = loadData();
goals = saved.goals;
userProfile = saved.userProfile;

// 判断是否显示创建用户界面
const hasOnboarded = localStorage.getItem('hasOnboarded');
if (!hasOnboarded) {
    // 没创建过：显示引导页，隐藏底部导航
    document.getElementById('onboarding').style.display = 'flex';
    document.querySelector('.bottom-nav').style.display = 'none';
    initOnboarding();
} else {
    // 已创建：隐藏引导页，显示主界面
    document.getElementById('onboarding').style.display = 'none';
}

// 更新UI
updateAllUI();
console.log('🧘 灵犀版已启动！数据自动保存在浏览器本地。');
