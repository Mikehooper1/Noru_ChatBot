const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildModelChain } = require('./modelMapping');
const { isRetryableError } = require('./providerErrors');

// Parse every Gemini key the user provides, from any of:
//   GEMINI_API_KEYS=key1,key2,key3   (preferred, comma-separated)
//   GEMINI_API_KEY=key0              (single)
//   GEMINI_API_KEY_2 ... _10         (numbered)
function parseApiKeys() {
  const keys = [];
  const push = (raw) => {
    if (!raw) return;
    const k = String(raw).trim();
    if (k && !keys.includes(k)) keys.push(k);
  };

  push(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEYS) {
    process.env.GEMINI_API_KEYS.split(',').forEach(push);
  }
  for (let i = 2; i <= 10; i += 1) {
    push(process.env[`GEMINI_API_KEY_${i}`]);
  }
  return keys;
}

const apiKeys = parseApiKeys();

// Round-robin pointer so load is spread across keys instead of always
// hammering key #1 first.
let cursor = 0;

// Cache one client per key (constructing GoogleGenerativeAI is cheap but
// reusing avoids re-allocation under load).
const clientCache = new Map();
function getClient(apiKey) {
  if (!clientCache.has(apiKey)) {
    clientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return clientCache.get(apiKey);
}

function isConfigured() {
  return apiKeys.length > 0;
}

function maskKey(key) {
  if (!key) return 'none';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

// Order keys for this request starting at the round-robin cursor, so each
// request begins with the "next" key and falls through the rest on failure.
function orderedKeysForRequest() {
  if (!apiKeys.length) return [];
  const start = cursor % apiKeys.length;
  cursor = (cursor + 1) % apiKeys.length;
  return [...apiKeys.slice(start), ...apiKeys.slice(0, start)];
}

function toGeminiHistory(messages) {
  // Gemini requires the history to start with a user turn and exclude the
  // final user message (passed separately to sendMessage).
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  while (history.length && history[0].role !== 'user') history.shift();
  return history;
}

async function callGemini({ client, modelName, systemPrompt, history, lastUserMessage, maxTokens, temperature }) {
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt || undefined,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastUserMessage);
  const text = result.response.text();
  if (!text || !text.trim()) {
    throw Object.assign(new Error('Empty response from Gemini'), { retryable: true });
  }
  return text.trim();
}

// Tries every (model x key) combination until one succeeds. Retryable errors
// (rate limit / quota / overload) move on to the next key/model; hard errors
// for the current model still fall through to the next model so a single bad
// model name can't take the whole agent down.
async function complete({ systemPrompt, messages, preferredModel, maxTokens = 1024, temperature = 0.7 }) {
  if (!apiKeys.length) {
    throw Object.assign(new Error('Gemini not configured (no GEMINI_API_KEY)'), { retryable: false });
  }

  const modelChain = buildModelChain(preferredModel);
  const keyOrder = orderedKeysForRequest();
  const history = toGeminiHistory(messages);
  const lastUserMessage = messages[messages.length - 1]?.content || '';

  let lastError;

  for (const modelName of modelChain) {
    for (const apiKey of keyOrder) {
      try {
        const text = await callGemini({
          client: getClient(apiKey),
          modelName,
          systemPrompt,
          history,
          lastUserMessage,
          maxTokens,
          temperature,
        });
        return {
          text,
          provider: 'gemini',
          model: modelName,
          keyUsed: maskKey(apiKey),
        };
      } catch (error) {
        lastError = error;
        const retryable = isRetryableError(error);
        console.warn(
          `[AI] Gemini ${modelName} via ${maskKey(apiKey)} failed (${retryable ? 'retryable' : 'hard'}): ${error.message}`
        );
        // On a hard error (bad request, model not found), don't keep trying
        // the same model with other keys — break to the next model instead.
        if (!retryable) break;
      }
    }
  }

  throw lastError || new Error('All Gemini models/keys failed');
}

module.exports = { isConfigured, complete, apiKeys, maskKey };
