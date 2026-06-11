const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getModelForProvider } = require('./modelMapping');

function parseApiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEYS) {
    keys.push(...process.env.GEMINI_API_KEYS.split(',').map((k) => k.trim()).filter(Boolean));
  }
  if (process.env.GEMINI_API_KEY && !keys.includes(process.env.GEMINI_API_KEY)) {
    keys.unshift(process.env.GEMINI_API_KEY.trim());
  }
  for (let i = 2; i <= 5; i += 1) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key?.trim() && !keys.includes(key.trim())) keys.push(key.trim());
  }
  return keys;
}

const apiKeys = parseApiKeys();

function isConfigured() {
  return apiKeys.length > 0;
}

function toGeminiHistory(messages) {
  return messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

async function complete({ systemPrompt, messages, preferredModel, maxTokens, temperature }) {
  if (!apiKeys.length) {
    throw Object.assign(new Error('Gemini not configured'), { retryable: true });
  }

  const modelName = getModelForProvider('gemini', preferredModel);
  const lastUserMessage = messages[messages.length - 1]?.content || '';
  let lastError;

  for (const apiKey of apiKeys) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      });

      const history = toGeminiHistory(messages);
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastUserMessage);
      const text = result.response.text();

      return {
        text,
        provider: 'gemini',
        model: modelName,
        apiKeyIndex: apiKeys.indexOf(apiKey),
      };
    } catch (error) {
      lastError = error;
      console.warn(`[AI] Gemini key #${apiKeys.indexOf(apiKey) + 1} failed:`, error.message);
    }
  }

  throw lastError || new Error('Gemini request failed');
}

module.exports = { isConfigured, complete, apiKeys };
