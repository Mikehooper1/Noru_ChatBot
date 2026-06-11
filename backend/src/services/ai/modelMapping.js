// Gemini model catalog — updated June 2026.
// Gemini 2.0 / 1.5 models are shut down; use 2.5 / 3.x instead.

const LEGACY_MODEL_MAP = {
  'gemini-2.0-flash-lite': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite-001': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-001': 'gemini-2.5-flash',
  'gemini-2.5-flash-lite': 'gemini-2.5-flash',
  'gemini-2.5-flash-lite-001': 'gemini-2.5-flash',
  'gemini-3.1-flash-lite': 'gemini-2.5-flash',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-flash-8b': 'gemini-2.5-flash',
  'gemini-1.5-flash-001': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-1.5-pro-002': 'gemini-2.5-pro',
};

// Free-tier Flash only — gemini-2.5-flash has a no-billing free quota in AI Studio.
const FREE_MODELS = ['gemini-2.5-flash'];

// Pro models — only when admin sets modelTier to "pro"
const PRO_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.5-pro',
];

const DEFAULT_FREE_MODEL = 'gemini-2.5-flash';
const DEFAULT_PRO_MODEL = 'gemini-2.5-flash';

function normalizeModel(model) {
  if (!model || typeof model !== 'string') return model;
  return LEGACY_MODEL_MAP[model] || model;
}

function isValidModel(model) {
  return typeof model === 'string' && model.startsWith('gemini');
}

function isProModel(model) {
  return PRO_MODELS.includes(normalizeModel(model));
}

function getPrimaryModel(preferredModel, modelTier = 'free') {
  const tier = modelTier === 'pro' ? 'pro' : 'free';
  const catalog = tier === 'pro' ? PRO_MODELS : FREE_MODELS;
  const normalized = normalizeModel(preferredModel);

  if (isValidModel(normalized) && catalog.includes(normalized)) {
    return normalized;
  }

  return tier === 'pro' ? DEFAULT_PRO_MODEL : DEFAULT_FREE_MODEL;
}

function buildModelChain(preferredModel, modelTier = 'free') {
  const tier = modelTier === 'pro' ? 'pro' : 'free';
  const catalog = tier === 'pro' ? PRO_MODELS : FREE_MODELS;
  const primary = getPrimaryModel(preferredModel, tier);

  const chain = [primary];
  for (const model of catalog) {
    if (!chain.includes(model)) chain.push(model);
  }

  if (tier === 'pro') {
    for (const model of FREE_MODELS) {
      if (!chain.includes(model)) chain.push(model);
    }
  }

  return chain;
}

module.exports = {
  FREE_MODELS,
  PRO_MODELS,
  DEFAULT_FREE_MODEL,
  DEFAULT_PRO_MODEL,
  LEGACY_MODEL_MAP,
  normalizeModel,
  isValidModel,
  isProModel,
  getPrimaryModel,
  buildModelChain,
};
