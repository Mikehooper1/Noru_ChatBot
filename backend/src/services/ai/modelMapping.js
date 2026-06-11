// Gemini-only model configuration.
// Ordered by preference: fast/cheap first, stronger models as fallback.
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
];

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function isValidModel(model) {
  return typeof model === 'string' && model.startsWith('gemini');
}

function getPrimaryModel(preferredModel) {
  if (isValidModel(preferredModel)) return preferredModel;
  return DEFAULT_MODEL;
}

// Builds the ordered list of models to try: preferred first, then the rest
// of the catalog as fallback (so a model-specific outage still gets answered).
function buildModelChain(preferredModel) {
  const primary = getPrimaryModel(preferredModel);
  const chain = [primary];
  for (const model of GEMINI_MODELS) {
    if (!chain.includes(model)) chain.push(model);
  }
  const fallback = process.env.GEMINI_FALLBACK_MODEL;
  if (fallback && isValidModel(fallback) && !chain.includes(fallback)) {
    chain.push(fallback);
  }
  return chain;
}

module.exports = {
  GEMINI_MODELS,
  DEFAULT_MODEL,
  isValidModel,
  getPrimaryModel,
  buildModelChain,
};
