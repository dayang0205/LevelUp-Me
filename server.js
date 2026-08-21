// server.js
require('dotenv').config(); // 读取 .env 文件中的 DEEPSEEK_API_KEY
const express = require('express');
const cors = require('cors');
const app = express();

// 允许跨域请求（只允许你的域名）
app.use(cors({
    origin: ['https://levelupme.org', 'https://www.levelupme.org']
}));
app.use(express.json());
app.use(express.static('public')); // 托管前端静态文件（非常重要！）

// 从环境变量读取 API 密钥
const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
    console.error('❌ 错误：请设置环境变量 DEEPSEEK_API_KEY');
    process.exit(1);
}

// ============================================================
// 接口1：生成每日修炼计划（场景化教学优化版）
// ============================================================
app.post('/api/generate-plan', async (req, res) => {
    const { goal, days, bio, expect } = req.body;

    const systemPrompt = `你是一位精通情境化教学的人生教练。用户想用 ${days} 天达成目标："${goal}"。
用户个人简述：${bio || '无'}
用户对AI的期望：${expect || '无'}

针对"${goal}"（如果是语言学习类，如英语口语），请生成 ${days} 天的每日修炼任务，要求：
1. 任务必须是具体的【模拟场景】练习，而不是抽象的“背单词”或“练口语”。
   例如："模拟向客户介绍产品并回答价格异议"，"用英文完成一次与合作伙伴的餐厅点餐对话"。
2. 每天的任务量要轻松，确保用户能抽出15-20分钟完成。
3. 每天任务用一句简短指令（<25字）。
4. 输出必须是纯 JSON 数组，格式：[{"day":1, "task":"..."}, ...]，不要包含任何其他文字。`;

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `目标：${goal}` }
                ],
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        const data = await response.json();
        // 【新增】检查 API 是否返回错误
        if (!response.ok) {
            console.error('DeepSeek API Error:', JSON.stringify(data));
            throw new Error(data.error?.message || `API 请求失败，状态码 ${response.status}`);
        }
        // 【新增】检查返回的数据结构是否正确
        if (!data.choices || !data.choices[0]) {
            console.error('DeepSeek API 返回格式错误:', JSON.stringify(data));
            throw new Error('API 返回数据格式错误');
        }
        const content = data.choices[0].message.content;
        
        if (Array.isArray(tasks)) {
            res.json({ tasks });
        } else if (tasks.tasks && Array.isArray(tasks.tasks)) {
            res.json({ tasks: tasks.tasks });
        } else {
            throw new Error('返回格式错误');
        }
    } catch (error) {
        console.error('生成计划失败:', error);
        res.status(500).json({ error: 'AI 服务暂时不可用，请稍后重试' });
    }
});

// ============================================================
// 接口2：处理打卡反馈（根据反思深度给经验值）
// ============================================================
app.post('/api/process-feedback', async (req, res) => {
    const { feedback, goalTitle } = req.body;

    const systemPrompt = `你是一位智慧且敏锐的AI学习教练。用户刚刚完成了当天的修炼，并写下了深刻的反思：
"${feedback}"
目标：${goalTitle || '未命名目标'}

请根据这段反思：
1. 敏锐地指出用户反思中体现出的【进步点】和【可改进点】（语气温暖且专业）。
2. 根据用户反思的深度、具体性和积极性，给出修为加成值（xpBonus）：
   - 如果反思非常具体（提到了具体表达、卡壳点、改进策略），给出 10~15 分。
   - 如果反思一般，给出 5~9 分。
   - 如果只是应付了事（比如“做了”、“还行”），给出 0~4 分。
3. 输出 JSON 格式：{"reply": "...", "xpBonus": 数字}`;

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: feedback }
                ],
                max_tokens: 300,
                temperature: 0.8
            })
        });

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);
        res.json(result);
    } catch (error) {
        console.error('处理反馈失败:', error);
        res.status(500).json({ error: 'AI 服务暂时不可用' });
    }
});

// 健康检查
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ LevelUp Me 后端已启动，端口 ${PORT}`);
    console.log(`📌 允许的域名: https://levelupme.org`);
});
