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

    const systemPrompt = `你是一位睿智、温暖、善于倾听的人生教练。你的任务是和用户进行一次真实、自然的多轮对话，帮助他理清目标。
    
    你的行为准则：
    1. 仔细阅读用户的历史对话，理解他正在谈论的内容。
    2. 就像和朋友聊天一样，先对用户刚才的分享给予肯定或共情（比如：“听起来你很有动力！”或“这个目标很实际。”）。
    3. 然后，根据对话的进展，提出一个或两个自然的追问，帮助他把目标变得更具体、可执行。问题要贴近生活，比如：“你每天大概能挤出多少时间？”“你希望这个目标在什么场景下见效？”。
    4. 绝对不要输出任何类似“当action为chat时...”或“根据您的指令...”这样的内部机制说明，也不要直接提“历史对话”这个词。你就是正在和他聊天的教练。
    5. 每次回复只围绕他当前的内容进行，不要一次性问一堆问题，最多问1-2个。
    6. 当用户明确表示“可以了”、“生成计划吧”或“就按这个来”时，你要立刻停止追问，并严格按照以下JSON格式输出最终计划：
    {
      "mainGoal": "主要目标描述（长期）",
      "weeklyGoal": "本周需要达成的具体目标",
      "todayTasks": ["今日具体的1个小任务", "今日具体的第2个小任务", "今日具体的第3个小任务"]
    }
    注意：任务要精简、易完成，且贴合对话中提到的具体场景。输出时不要包含任何其他文字。`;

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
    const systemPrompt = `你是一位温暖、敏锐、像朋友一样的AI人生教练。用户刚刚在完成修炼后，写下了自己的真实反馈和感受：
    
    "${feedback}"
    
    请根据这段反馈：
    1. 首先，用1-2句话表达你读到他反馈时的真实感受，给予共情和肯定（比如：“能感受到你今天很努力，特别是你在...上的思考很有价值。”或“这个卡壳点确实很磨人，但你写出来就是跨出了一大步。”）。
    2. 然后，敏锐地捕捉到他在反馈中体现出的【一个具体进步】和【一个具体可改进点】，用真诚、口语化的语言指出来，不要像领导训话，而是像朋友间的悄悄话。
    3. 最后，用温暖、有力量的一句话鼓励他明天继续（比如：“明天我们试着把大任务拆小一点，你肯定能轻松搞定。”）。
    4. 整个回复的语气要像真人对话，绝对不要出现“根据您的反馈”、“系统认为”这种机械词汇。
    
    另外，为了游戏化激励，请根据用户反馈的深度、具体性和积极性，给出一个修为加成值（xpBonus）：
    - 如果反思很具体（提到具体细节、卡壳点、改进策略），给出 10~15 分。
    - 如果反思一般，给出 5~9 分。
    - 如果只是应付了事（比如“做了”、“还行”），给出 0~4 分。
    
    输出格式必须是纯JSON：
    {"reply": "你的温暖回复", "xpBonus": 数字}`;
    
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
