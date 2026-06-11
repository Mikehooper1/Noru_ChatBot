// Free-tier Gemini models — used by default (best for API free quota).
const FREE_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash',
];

// Pro / higher-quota models — only when admin sets modelTier to "pro".
const PRO_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];

const DEFAULT_FREE_MODEL = 'gemini-2.0-flash-lite';
const DEFAULT_PRO_MODEL = 'gemini-2.0-flash';

function isValidModel(model) {
  return typeof model === 'string' && model.startsWith('gemini');
}

function isProModel(model) {
  return PRO_MODELS.includes(model);
}

function getPrimaryModel(preferredModel, modelTier = 'free') {
  const tier = modelTier === 'pro' ? 'pro' : 'free';
  const catalog = tier === 'pro' ? PRO_MODELS : FREE_MODELS;

  if (isValidModel(preferredModel) && catalog.includes(preferredModel)) {
    return preferredModel;
  }

  return tier === 'pro' ? DEFAULT_PRO_MODEL : DEFAULT_FREE_MODEL;
}

// Free tier → only free models (never burns pro/paid quota).
// Pro tier  → pro models first, then free models if pro quota is exhausted.
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
  isValidModel,
  isProModel,
  getPrimaryModel,
  buildModelChain,
};
