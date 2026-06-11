const { getBusinessAIConfig, logError } = require('../../firebase/admin');
const { buildSystemPrompt, shouldHandoff } = require('./buildSystemPrompt');
const { isRetryableError } = require('./providerErrors');
const { buildProviderChain } = require('./modelMapping');
const openaiProvider = require('./openaiProvider');
const geminiProvider = require('./geminiProvider');

const providers = {
  openai: openaiProvider,
  gemini: geminiProvider,
};

// Startup diagnostics
(function logProviderStatus() {
  const configured = Object.entries(providers)
    .filter(([, p]) => p.isConfigured())
    .map(([name]) => name);
  const missing = Object.entries(providers)
    .filter(([, p]) => !p.isConfigured())
    .map(([name]) => name);

  if (configured.length) {
    console.log(`[AI] Configured providers: ${configured.join(', ')}`);
  }
  if (missing.length) {
    console.warn(`[AI] ⚠ Unconfigured providers (no valid API key): ${missing.join(', ')}`);
  }
  if (!configured.length) {
    console.error('[AI] ❌ NO AI providers configured! Set OPENAI_API_KEY or GEMINI_API_KEY in .env');
  }

  // Warn about suspicious key formats
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('AIzaSy')) {
    console.warn('[AI] ⚠ GEMINI_API_KEY may be invalid — Gemini keys typically start with "AIzaSy"');
  }
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-')) {
    console.warn('[AI] ⚠ OPENAI_API_KEY may be invalid — OpenAI keys typically start with "sk-"');
  }
})();

function formatMessages(conversationHistory, userMessage) {
  return [
    ...conversationHistory.map((m) => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];
}

async function getAIResponse(businessId, conversationHistory, userMessage, sessionData) {
  const aiConfig = await getBusinessAIConfig(businessId);
  const systemPrompt = buildSystemPrompt(aiConfig, sessionData);
  const messages = formatMessages(conversationHistory, userMessage);
  const providerChain = buildProviderChain(aiConfig.model);
  const maxTokens = aiConfig.maxTokens || 1024;
  const temperature = aiConfig.temperature ?? 0.7;

  const errors = [];

  for (const providerName of providerChain) {
    const provider = providers[providerName];
    if (!provider?.isConfigured()) {
      continue;
    }

    try {
      const result = await provider.complete({
        systemPrompt,
        messages,
        preferredModel: aiConfig.model,
        maxTokens,
        temperature,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AI] Response via ${result.provider} (${result.model})`);
      }

      return result.text;
    } catch (error) {
      errors.push({ provider: providerName, error });
      console.warn(`[AI] Provider ${providerName} exhausted:`, error.message);

      if (!isRetryableError(error)) {
        await logError(error, businessId).catch(() => {});
      }

      continue;
    }
  }

  if (errors.length) {
    const errSummary = errors.map((e) => `${e.provider}: ${e.error.message}`).join(' | ');
    console.error('[AI] All providers failed:', errSummary);
    console.error('[AI] Check your API keys in .env — OpenAI key set:', !!process.env.OPENAI_API_KEY, '| Gemini key set:', !!process.env.GEMINI_API_KEY);
    await logError(new Error(`All AI providers failed: ${errors.map((e) => e.provider).join(', ')} — ${errSummary}`), businessId).catch(() => {});
  }

  return aiConfig.fallbackMessage || 'Thanks for your message! Let me connect you with our team to help you further.';
}

module.exports = {
  getAIResponse,
  buildSystemPrompt,
  shouldHandoff,
};
