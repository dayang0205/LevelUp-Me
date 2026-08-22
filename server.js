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

// 【新增】清洗函数，兼容 AI 返回 Markdown 代码块格式的 JSON
function cleanJSON(text) {
    text = text.trim();
    // 如果以 ```json 或 ``` 开头，去掉前面的反引号和 json
    if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*/, '');
        // 去掉结尾的反引号
        text = text.replace(/\s*```$/, '');
    }
    return text;
}

// 接口1：多轮对话式生成目标计划
app.post('/api/generate-plan', async (req, res) => {
    const { action, history = [], bio, expect } = req.body;

    const systemPrompt = `你是一位睿智且温暖的人生教练。你的工作流程：
1. 当 action 为 'chat' 时：仔细阅读用户的历史对话，针对用户当前的设想，提出一个清晰的、能帮他明确方向的澄清问题（例如：你练习英语口语的具体场景是什么？是商务会议还是日常交流？），回复一句话。
2. 当 action 为 'generate' 时：根据所有的对话历史，为用户生成三个层级的计划，并严格按照JSON格式输出：
{
  "mainGoal": "主要目标描述（长期）",
  "weeklyGoal": "本周需要达成的具体目标",
  "todayTasks": ["今日具体的1个小任务", "今日具体的第2个小任务", "今日具体的第3个小任务"]
}
注意：每日任务极其精简，最多3个，确保用户易完成。不要输出任何其他文字。`;

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
                top_p: 1.0,
                thinking_mode: "thinking"
            })
        });

        const data = await response.json();
        if (!response.ok || !data.choices) throw new Error(data.error?.message || 'API错误');
        
        let content = data.choices[0].message.content;

        // 如果是生成模式，尝试解析 JSON
        if (action === 'generate') {
            try {
                // 【关键修复】先清洗内容，再解析
                const parsed = JSON.parse(cleanJSON(content));
                res.json(parsed);
            } catch (e) {
                // 如果AI返回的不是纯JSON，加个兜底
                res.status(500).json({ error: 'AI 返回格式错误，请重试' });
            }
        } else {
            // chat模式直接返回文本
            res.json({ reply: content });
        }
    } catch (error) {
        console.error('AI错误:', error);
        res.status(500).json({ error: 'AI 服务暂时不可用' });
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
        // 【关键修复】同样清洗一下再解析
        res.json(JSON.parse(cleanJSON(data.choices[0].message.content)));
    } catch (error) {
        res.status(500).json({ error: 'AI 服务暂时不可用' });
    }
});

app.get('/health', (req, res) => res.send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ 后端启动，端口 ${PORT}`));
