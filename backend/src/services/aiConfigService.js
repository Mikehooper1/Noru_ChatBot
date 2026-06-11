const { getDb, getFieldValue, encrypt, decrypt, getBusinessAIConfig } = require('../firebase/admin');

function isLikelyGeminiKey(key) {
  if (!key || key.length < 20) return false;
  // Legacy AI Studio keys (AIzaSy...) and new auth keys (AQ....) are both valid
  return /^(AIza|AQ\.)/.test(key) || /^[A-Za-z0-9\-._~]+$/.test(key);
}

function parseGeminiKeysInput(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((k) => String(k).trim()).filter(Boolean);
  }
  return String(input)
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function decryptGeminiKeys(encryptedKeys = []) {
  if (!Array.isArray(encryptedKeys)) return [];
  return encryptedKeys.map((k) => decrypt(k)).filter(Boolean);
}

function resolveGeminiApiKeys(aiConfig) {
  const fromConfig = decryptGeminiKeys(aiConfig?.geminiApiKeysEncrypted);
  if (fromConfig.length) return fromConfig;

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

async function getAIConfigForAdmin(businessId) {
  const config = await getBusinessAIConfig(businessId);
  const keyCount = config.geminiApiKeysEncrypted?.length || 0;
  const { geminiApiKeysEncrypted, geminiApiKeys, ...safe } = config;
  return {
    ...safe,
    geminiApiKeyCount: keyCount,
    geminiKeysConfigured: keyCount > 0,
  };
}

async function saveAIConfig(businessId, body) {
  const ref = getDb().collection('businesses').doc(businessId).collection('aiConfig').doc('default');

  const existing = (await ref.get()).data() || {};
  const payload = {
    model: body.model || 'gemini-2.0-flash',
    systemPrompt: body.systemPrompt || '',
    temperature: body.temperature ?? 0.7,
    maxTokens: body.maxTokens || 1024,
    tone: body.tone || 'friendly',
    enableHandoff: body.enableHandoff !== false,
    handoffTriggers: Array.isArray(body.handoffTriggers)
      ? body.handoffTriggers
      : String(body.handoffTriggers || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    handoffMessage: body.handoffMessage || '',
    fallbackMessage: body.fallbackMessage || '',
    language: body.language || 'en',
    knowledgeBase: body.knowledgeBase || '',
    enableAI: body.enableAI !== false,
    updatedAt: getFieldValue().serverTimestamp(),
  };

  const newKeys = parseGeminiKeysInput(body.geminiApiKeys);
  if (newKeys.length) {
    payload.geminiApiKeysEncrypted = newKeys.map((k) => encrypt(k));
    payload.geminiApiKeyCount = newKeys.length;
  } else if (existing.geminiApiKeysEncrypted?.length) {
    payload.geminiApiKeysEncrypted = existing.geminiApiKeysEncrypted;
    payload.geminiApiKeyCount = existing.geminiApiKeysEncrypted.length;
  } else {
    payload.geminiApiKeysEncrypted = [];
    payload.geminiApiKeyCount = 0;
  }

  if (body.clearGeminiKeys === true) {
    payload.geminiApiKeysEncrypted = [];
    payload.geminiApiKeyCount = 0;
  }

  await ref.set(payload, { merge: true });
  return getAIConfigForAdmin(businessId);
}

module.exports = {
  parseGeminiKeysInput,
  decryptGeminiKeys,
  resolveGeminiApiKeys,
  getAIConfigForAdmin,
  saveAIConfig,
};
