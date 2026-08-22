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

// 超强清洗函数
function cleanJSON(text) {
    if (!text) return '';
    text = text.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        text = text.substring(firstBrace, lastBrace + 1);
    }
    return text;
}

app.post('/api/generate-plan', async (req, res) => {
    const { action, history = [], bio, expect } = req.body;

    const systemPrompt = `你是一位温暖且智慧的人生教练。请像真人一样与用户交流。

1. 当用户在普通对话时（不是生成计划）：仔细阅读用户说的话，给予肯定或共情，并提出一个自然的追问，帮他把目标变得更具体（不超过2个问题）。

2. 当用户说“生成计划”或“确认”时：请根据历史对话，为用户生成完整的修炼计划。严格按以下JSON格式输出（不要包含任何其他文字）：
{
  "mainGoal": "主目标描述（长期）",
  "subGoals": [
    {"title": "小目标1：具体描述", "description": "独立完成的详细说明"},
    {"title": "小目标2：具体描述", "description": "独立完成的详细说明"},
    {"title": "小目标3：具体描述", "description": "独立完成的详细说明"}
  ]
}
注意：小目标之间要有递进关系，数量为3-5个，确保用户能独立完成。`;

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: [{ role: 'system', content: systemPrompt }, ...history],
                max_tokens: 1500,
                temperature: 1.0
            })
        });
        const data = await response.json();
        if (!response.ok || !data.choices) throw new Error('API请求失败');

        const content = data.choices[0].message.content;

        if (action === 'generate') {
            try {
                const parsed = JSON.parse(cleanJSON(content));
                if (!parsed.mainGoal || !parsed.subGoals) {
                    throw new Error('返回格式错误');
                }
                res.json(parsed);
            } catch (e) {
                res.status(500).json({ error: '生成失败，请再试一次' });
            }
        } else {
            res.json({ reply: content });
        }
    } catch (error) {
        res.status(500).json({ error: 'AI 服务暂时不可用' });
    }
});

app.post('/api/process-feedback', async (req, res) => {
    const { feedback, goalTitle } = req.body;

    const systemPrompt = `你是一位温暖的AI教练。用户刚刚完成了一个独立的小目标，写下了反馈："${feedback}"。
请给予：
1. 共情和肯定（1-2句）。
2. 指出一个具体的进步点和一个可改进点。
3. 温暖鼓励他继续前进。

根据反馈的深度，输出JSON并给出修为（xpBonus 0-15）：
{"reply": "...", "xpBonus": 数字}`;

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: [{ role: 'system', content: systemPrompt }],
                max_tokens: 300
            })
        });
        const data = await response.json();
        res.json(JSON.parse(cleanJSON(data.choices[0].message.content)));
    } catch (error) {
        res.status(500).json({ error: 'AI 服务暂时不可用' });
    }
});

app.get('/health', (req, res) => res.send('OK'));
app.listen(process.env.PORT || 3000, () => console.log(`✅ 后端启动`));
