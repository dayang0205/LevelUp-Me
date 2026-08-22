// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: ['https://levelupme.org', 'https://www.levelupme.org'] }));
app.use(express.json());
app.use(express.static('public'));

const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) { console.error('❌ 错误：请设置环境变量 DEEPSEEK_API_KEY'); process.exit(1); }

// =============== 超强清洗函数（兼容各种乱格式） ===============
function cleanJSON(text) {
    if (!text) return '';
    text = text.trim();

    // 1. 去掉开头 ```json 或 ``` 的代码块标记
    text = text.replace(/^```(?:json)?\s*/i, '');
    // 2. 去掉结尾的 ``` 代码块标记
    text = text.replace(/\s*```$/, '');

    // 3. 找到第一个 { 和最后一个 } 之间的内容（提取最外层 JSON 对象）
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        text = text.substring(firstBrace, lastBrace + 1);
    }

    // 4. 如果还是没有 JSON 大括号，就尝试提取数组（用于兼容纯数组格式）
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBrace === -1 && firstBracket !== -1 && lastBracket !== -1) {
        text = text.substring(firstBracket, lastBracket + 1);
    }

    return text;
}

// 接口1：多轮对话式生成目标计划
app.post('/api/generate-plan', async (req, res) => {
    const { action, history = [], bio, expect } = req.body;

    const systemPrompt = `你是一位睿智且温暖的人生教练。请根据用户的历史对话，针对用户当前的设想，提出一个清晰的、能帮他明确方向的澄清问题（例如：你练习英语口语的具体场景是什么？是商务会议还是日常交流？）。直接回复这一句话。
    如果用户要求生成最终计划，则严格按以下JSON格式输出，不要包含任何其他文字：
    {
      "mainGoal": "主要目标描述（长期）",
      "weeklyGoal": "本周需要达成的具体目标",
      "todayTasks": ["今日具体的1个小任务", "今日具体的第2个小任务", "今日具体的第3个小任务"]
    }
    注意：任务要精简、易完成，最多3个。`;

    try {
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history
        ];

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages,
                max_tokens: 1500,
                temperature: 1.0,
                top_p: 1.0
            })
        });

        const data = await response.json();
        if (!response.ok || !data.choices) {
            console.error('DeepSeek API 错误:', data.error || '未知错误');
            throw new Error(data.error?.message || 'API请求失败');
        }

        const content = data.choices[0].message.content;

        if (action === 'generate') {
            try {
                const cleaned = cleanJSON(content);
                const parsed = JSON.parse(cleaned);
                
                // 二次校验：如果缺少关键字段，提供友好提示
                if (!parsed.mainGoal || !parsed.weeklyGoal || !parsed.todayTasks) {
                    throw new Error('返回字段不完整');
                }
                res.json(parsed);
            } catch (e) {
                console.error('生成模式解析失败:', e, '\n原始内容:', content);
                res.status(500).json({ error: 'AI思考超时或格式异常，请再试一次' });
            }
        } else {
            // chat 模式直接返回文本
            res.json({ reply: content });
        }
    } catch (error) {
        console.error('AI错误:', error);
        res.status(500).json({ error: 'AI 服务暂时不可用，请稍后重试' });
    }
});

// 接口2：根据用户反馈更新任务进度
app.post('/api/process-feedback', async (req, res) => {
    const { feedback, goalTitle } = req.body;
    const systemPrompt = `你是一位关注细节的教练。用户在完成今日任务后写下了反馈："${feedback}"。请用2句话指出进步点和改进点，并输出JSON：{"reply": "...", "xpBonus": 0-15的数字}`;
    
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: [{ role: 'system', content: systemPrompt }],
                max_tokens: 300,
                temperature: 0.7
            })
        });
        const data = await response.json();
        if (!data.choices) throw new Error('无返回值');
        const cleaned = cleanJSON(data.choices[0].message.content);
        res.json(JSON.parse(cleaned));
    } catch (error) {
        console.error('反馈处理失败:', error);
        res.status(500).json({ error: 'AI 服务暂时不可用' });
    }
});

app.get('/health', (req, res) => res.send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ 后端启动，端口 ${PORT}`));
