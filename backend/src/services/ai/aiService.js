const { getBusinessAIConfig, logError } = require('../../firebase/admin');
const { buildSystemPrompt, shouldHandoff } = require('./buildSystemPrompt');
const geminiProvider = require('./geminiProvider');
const { normalizeModel } = require('./modelMapping');
const { resolveGeminiApiKeys } = require('../aiConfigService');

(function logProviderStatus() {
  const envKeys = resolveGeminiApiKeys({});
  if (envKeys.length) {
    console.log(`[AI] ${envKeys.length} Gemini key(s) available from backend .env (fallback)`);
  } else {
    console.log('[AI] No Gemini keys in .env — businesses can set keys in Admin → AI Settings');
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

async function getAIResponse(businessId, conversationHistory, userMessage, sessionData, userRecords = []) {
  const aiConfig = await getBusinessAIConfig(businessId);
  aiConfig._businessId = businessId;

  if (aiConfig.enableAI === false) {
    return aiConfig.fallbackMessage || 'How can I help you today?';
  }

  if (!geminiProvider.isConfigured(aiConfig)) {
    console.error(`[AI] Cannot answer for business ${businessId} — no Gemini API keys (set in Admin → AI Settings)`);
    return (
      aiConfig.fallbackMessage ||
      'Thanks for your message! Please add your Gemini API key in Admin → AI Settings to enable AI replies.'
    );
  }

  const systemPrompt = buildSystemPrompt(aiConfig, sessionData, userRecords);
  const messages = formatMessages(conversationHistory, userMessage);

  try {
    const result = await geminiProvider.complete({
      aiConfig,
      systemPrompt,
      messages,
      preferredModel: normalizeModel(aiConfig.model) || aiConfig.model,
      maxTokens: aiConfig.maxTokens || 1024,
      temperature: aiConfig.temperature ?? 0.7,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AI] Reply via Gemini ${result.model} (key ${result.keyUsed})`);
    }
    return result.text;
  } catch (error) {
    console.error('[AI] All Gemini keys/models exhausted:', error.message);
    await logError(
      new Error(`Gemini failed for business ${businessId}: ${error.message}`),
      businessId
    ).catch(() => {});

    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('prepayment') || msg.includes('depleted') || msg.includes('billing')) {
      return (
        aiConfig.fallbackMessage ||
        'Gemini API key has no credits left. Use a free-tier key from aistudio.google.com/apikey (no billing linked), or top up at https://ai.studio/projects.'
      );
    }

    return aiConfig.fallbackMessage ||
      'Thanks for your message! Our AI is briefly at capacity — please try again in a minute.';
  }
}

module.exports = {
  getAIResponse,
  buildSystemPrompt,
  shouldHandoff,
};
