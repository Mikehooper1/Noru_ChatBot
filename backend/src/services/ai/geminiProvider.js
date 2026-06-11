const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildModelChain } = require('./modelMapping');
const { isRetryableError, isModelUnavailableError, isBillingDepletedError } = require('./providerErrors');
const { resolveGeminiApiKeys } = require('../aiConfigService');

const clientCache = new Map();
const cursors = new Map();

function getClient(apiKey) {
  if (!clientCache.has(apiKey)) {
    clientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return clientCache.get(apiKey);
}

function maskKey(key) {
  if (!key) return 'none';
  if (key.length <= 10) return '***';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function orderedKeysForRequest(apiKeys, scope = 'env') {
  if (!apiKeys.length) return [];
  const cursorKey = scope;
  const cursor = cursors.get(cursorKey) || 0;
  const start = cursor % apiKeys.length;
  cursors.set(cursorKey, (cursor + 1) % apiKeys.length);
  return [...apiKeys.slice(start), ...apiKeys.slice(0, start)];
}

function isConfigured(aiConfig) {
  return resolveGeminiApiKeys(aiConfig).length > 0;
}

function toGeminiHistory(messages) {
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

async function complete({
  aiConfig,
  systemPrompt,
  messages,
  preferredModel,
  maxTokens = 1024,
  temperature = 0.7,
}) {
  const apiKeys = resolveGeminiApiKeys(aiConfig);
  if (!apiKeys.length) {
    throw Object.assign(
      new Error('Gemini not configured — add API keys in Admin → AI Settings'),
      { retryable: false }
    );
  }

  const modelChain = buildModelChain(preferredModel, aiConfig?.modelTier || 'free');
  const scope = aiConfig?.geminiApiKeysEncrypted?.length ? `biz-${aiConfig._businessId || 'x'}` : 'env';
  const keyOrder = orderedKeysForRequest(apiKeys, scope);
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
        const billingBlocked = isBillingDepletedError(error);
        const modelGone = isModelUnavailableError(error);
        const retryable = !billingBlocked && !modelGone && isRetryableError(error);
        console.warn(
          `[AI] Gemini ${modelName} via ${maskKey(apiKey)} failed (${billingBlocked ? 'billing blocked' : modelGone ? 'model unavailable' : retryable ? 'retryable' : 'hard'}): ${error.message}`
        );
        // Prepay $0 on this key — try the next API key (e.g. env fallback)
        if (billingBlocked) continue;
        // Wrong/shutdown model — skip remaining keys, try next model
        if (modelGone) break;
        if (!retryable) break;
      }
    }
  }

  throw lastError || new Error('All Gemini models/keys failed');
}

module.exports = { isConfigured, complete, maskKey, resolveGeminiApiKeys };
