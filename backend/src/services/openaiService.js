const OpenAI = require('openai');
const { getBusinessAIConfig } = require('../firebase/admin');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getAIResponse(businessId, conversationHistory, userMessage, sessionData) {
  const aiConfig = await getBusinessAIConfig(businessId);
  const systemPrompt = buildSystemPrompt(aiConfig, sessionData);

  const response = await client.chat.completions.create({
    model: aiConfig.model || 'gpt-4o',
    max_tokens: aiConfig.maxTokens || 1024,
    temperature: aiConfig.temperature ?? 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ],
  });

  return response.choices[0].message.content;
}

function buildSystemPrompt(aiConfig, sessionData) {
  return `${aiConfig.systemPrompt}

Current session data collected so far: ${JSON.stringify(sessionData)}

Tone: ${aiConfig.tone}
Language: ${aiConfig.language}

Business Knowledge Base:
${aiConfig.knowledgeBase}

Rules:
- Keep responses concise and conversational (max 3 sentences unless listing options)
- If user asks something outside your knowledge base, say you'll connect them to a human
- Always end booking confirmations with the full appointment summary
- Detect intent: if user says "${(aiConfig.handoffTriggers || []).join('" or "')}", trigger handoff`;
}

function shouldHandoff(message, aiConfig) {
  const triggers = aiConfig.handoffTriggers || ['human', 'agent', 'help'];
  const lower = message.toLowerCase();
  return triggers.some((t) => lower.includes(t.toLowerCase()));
}

module.exports = { getAIResponse, buildSystemPrompt, shouldHandoff };
