const { getBusinessAIConfig, logError } = require('../../firebase/admin');
const { buildSystemPrompt, shouldHandoff } = require('./buildSystemPrompt');
const geminiProvider = require('./geminiProvider');

// Startup diagnostics — make misconfiguration obvious in the logs.
(function logProviderStatus() {
  if (geminiProvider.isConfigured()) {
    console.log(`[AI] Gemini configured with ${geminiProvider.apiKeys.length} API key(s)`);
    const invalid = geminiProvider.apiKeys.filter((k) => !k.startsWith('AIza'));
    if (invalid.length) {
      console.warn(`[AI] ⚠ ${invalid.length} Gemini key(s) look invalid — keys usually start with "AIza"`);
    }
  } else {
    console.error('[AI] ❌ No Gemini API key set. Add GEMINI_API_KEY (or GEMINI_API_KEYS) to backend/.env');
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

  if (aiConfig.enableAI === false) {
    return aiConfig.fallbackMessage || 'How can I help you today?';
  }

  if (!geminiProvider.isConfigured()) {
    console.error('[AI] Cannot answer — Gemini is not configured.');
    return aiConfig.fallbackMessage || 'Thanks for your message! Our team will get back to you shortly.';
  }

  const systemPrompt = buildSystemPrompt(aiConfig, sessionData);
  const messages = formatMessages(conversationHistory, userMessage);

  try {
    const result = await geminiProvider.complete({
      systemPrompt,
      messages,
      preferredModel: aiConfig.model,
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
    return aiConfig.fallbackMessage || 'Thanks for your message! Let me connect you with our team to help you further.';
  }
}

module.exports = {
  getAIResponse,
  buildSystemPrompt,
  shouldHandoff,
};
