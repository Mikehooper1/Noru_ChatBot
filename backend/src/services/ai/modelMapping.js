const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
];

function getProviderForModel(model) {
  if (!model) return null;
  if (model.startsWith('gemini')) return 'gemini';
  if (model.startsWith('gpt-')) return 'openai';
  return null;
}

function getModelForProvider(provider, preferredModel) {
  if (provider === 'openai') {
    if (OPENAI_MODELS.includes(preferredModel)) return preferredModel;
    return process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
  }
  if (provider === 'gemini') {
    if (GEMINI_MODELS.includes(preferredModel) || preferredModel?.startsWith('gemini')) {
      return preferredModel;
    }
    return process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash';
  }
  return preferredModel;
}

function buildProviderChain(preferredModel) {
  const order = (process.env.AI_PROVIDER_ORDER || 'openai,gemini')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const primary = getProviderForModel(preferredModel);
  const chain = [];

  if (primary && order.includes(primary)) {
    chain.push(primary);
  }

  for (const provider of order) {
    if (!chain.includes(provider)) chain.push(provider);
  }

  return chain.length ? chain : ['openai', 'gemini'];
}

module.exports = {
  OPENAI_MODELS,
  GEMINI_MODELS,
  getProviderForModel,
  getModelForProvider,
  buildProviderChain,
};
