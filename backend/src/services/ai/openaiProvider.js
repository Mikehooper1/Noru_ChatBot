const OpenAI = require('openai');
const { getModelForProvider } = require('./modelMapping');

function parseApiKeys() {
  const keys = [];
  if (process.env.OPENAI_API_KEYS) {
    keys.push(...process.env.OPENAI_API_KEYS.split(',').map((k) => k.trim()).filter(Boolean));
  }
  if (process.env.OPENAI_API_KEY && !keys.includes(process.env.OPENAI_API_KEY)) {
    keys.unshift(process.env.OPENAI_API_KEY.trim());
  }
  for (let i = 2; i <= 5; i += 1) {
    const key = process.env[`OPENAI_API_KEY_${i}`];
    if (key?.trim() && !keys.includes(key.trim())) keys.push(key.trim());
  }
  return keys;
}

const apiKeys = parseApiKeys();

function isConfigured() {
  return apiKeys.length > 0;
}

async function complete({ systemPrompt, messages, preferredModel, maxTokens, temperature }) {
  if (!apiKeys.length) {
    throw Object.assign(new Error('OpenAI not configured'), { retryable: true });
  }

  const model = getModelForProvider('openai', preferredModel);
  let lastError;

  for (const apiKey of apiKeys) {
    try {
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      });

      return {
        text: response.choices[0].message.content,
        provider: 'openai',
        model,
        apiKeyIndex: apiKeys.indexOf(apiKey),
      };
    } catch (error) {
      lastError = error;
      console.warn(`[AI] OpenAI key #${apiKeys.indexOf(apiKey) + 1} failed:`, error.message);
    }
  }

  throw lastError || new Error('OpenAI request failed');
}

module.exports = { isConfigured, complete, apiKeys };
