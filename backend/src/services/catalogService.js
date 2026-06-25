const { getDb, getFieldValue } = require('../firebase/admin');

const CATALOG_MARKER_START = '--- CATALOG (auto-synced from Products & Services) ---';
const CATALOG_MARKER_END = '--- END CATALOG ---';

const BUDGET_PATTERN =
  /\b(?:budget|under|below|max|maximum|upto|up to|within|around|about|less than|₹|rs\.?|inr)\s*[:\-]?\s*([\d,.]+)\s*(lakh|lac|crore|cr|k|thousand|million|m)?\b|\b([\d,.]+)\s*(lakh|lac|crore|cr|k)\b/i;

function formatPrice(pricePaise, currency = 'INR') {
  const amount = (pricePaise || 0) / 100;
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatBudget(amount) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} crore`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} lakh`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function parseBudgetAmount(raw, unit) {
  const num = parseFloat(String(raw).replace(/,/g, ''));
  if (Number.isNaN(num) || num <= 0) return null;
  const u = (unit || '').toLowerCase();
  if (u === 'crore' || u === 'cr') return Math.round(num * 10000000);
  if (u === 'lakh' || u === 'lac') return Math.round(num * 100000);
  if (u === 'k' || u === 'thousand') return Math.round(num * 1000);
  if (u === 'million' || u === 'm') return Math.round(num * 1000000);
  return Math.round(num);
}

function parseBudgetFromMessage(message) {
  const match = (message || '').match(BUDGET_PATTERN);
  if (!match) return null;
  const raw = match[1] || match[3];
  const unit = match[2] || match[4];
  return parseBudgetAmount(raw, unit);
}

function isCatalogBusiness(businessType = '') {
  const type = businessType.toLowerCase();
  return ['realestate', 'real-estate', 'real_estate', 'property', 'ecommerce', 'retail', 'saas', 'salon', 'default'].includes(type)
    || /real.?estate|property/i.test(type);
}

function catalogItemLabel(businessType = '') {
  const type = businessType.toLowerCase();
  if (/real.?estate|property/.test(type)) return 'properties';
  if (type === 'ecommerce' || type === 'retail') return 'products';
  return 'items';
}

async function fetchActiveServices(businessId) {
  const snap = await getDb()
    .collection('businesses')
    .doc(businessId)
    .collection('services')
    .where('isActive', '==', true)
    .get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function buildCatalogKnowledgeText(services = []) {
  if (!services.length) {
    return 'No products or services are currently listed.';
  }

  return services
    .map((s) => {
      const price = formatPrice(s.price, s.currency);
      const desc = s.description ? ` — ${s.description}` : '';
      const category = s.category && s.category !== 'general' ? ` [${s.category}]` : '';
      return `- ${s.name}${category}: ${price}${s.duration ? `, ${s.duration} min` : ''}${desc}`;
    })
    .join('\n');
}

function stripCatalogSection(knowledgeBase = '') {
  const start = knowledgeBase.indexOf(CATALOG_MARKER_START);
  if (start === -1) return knowledgeBase.trim();
  const end = knowledgeBase.indexOf(CATALOG_MARKER_END, start);
  if (end === -1) return knowledgeBase.slice(0, start).trim();
  return (knowledgeBase.slice(0, start) + knowledgeBase.slice(end + CATALOG_MARKER_END.length)).trim();
}

function mergeCatalogIntoKnowledgeBase(existingKb = '', catalogText = '') {
  const base = stripCatalogSection(existingKb);
  const section = `${CATALOG_MARKER_START}\n${catalogText}\n${CATALOG_MARKER_END}`;
  return base ? `${base}\n\n${section}` : section;
}

async function syncServicesToKnowledgeBase(businessId) {
  const services = await fetchActiveServices(businessId);
  const catalogText = buildCatalogKnowledgeText(services);
  const ref = getDb().collection('businesses').doc(businessId).collection('aiConfig').doc('default');
  const existing = (await ref.get()).data() || {};
  const merged = mergeCatalogIntoKnowledgeBase(existing.knowledgeBase || '', catalogText);

  await ref.set(
    {
      knowledgeBase: merged,
      catalogSyncedAt: getFieldValue().serverTimestamp(),
      catalogServiceCount: services.length,
    },
    { merge: true }
  );

  return { knowledgeBase: merged, serviceCount: services.length };
}

function filterServicesByBudget(services, budgetRupees) {
  const budgetPaise = budgetRupees * 100;
  return services.filter((s) => (s.price || 0) <= budgetPaise);
}

function buildBudgetReply(services, budgetRupees, businessType = '') {
  const label = catalogItemLabel(businessType);
  const matching = filterServicesByBudget(services, budgetRupees);
  const budgetText = formatBudget(budgetRupees);

  if (!services.length) {
    return {
      reply: `We don't have any ${label} listed at the moment. Please check back later or ask to speak with our team.`,
      quickReplies: [],
      action: 'catalog_empty',
    };
  }

  if (!matching.length) {
    const sorted = [...services].sort((a, b) => (a.price || 0) - (b.price || 0));
    const cheapest = sorted[0];
    const suggestions = sorted.slice(0, 3);
    const suggestLines = suggestions
      .map((s) => `• ${s.name} — ${formatPrice(s.price, s.currency)}`)
      .join('\n');

    return {
      reply:
        `Sorry, no ${label} available within your budget of ${budgetText}.\n\n` +
        `Here are the closest options we have:\n${suggestLines}\n\n` +
        `Would you like details on any of these, or should I note your budget for a callback?`,
      quickReplies: suggestions.map((s) => s.name).slice(0, 3),
      action: 'catalog_no_match',
    };
  }

  const lines = matching
    .slice(0, 5)
    .map((s) => `• ${s.name} — ${formatPrice(s.price, s.currency)}${s.description ? `: ${s.description}` : ''}`)
    .join('\n');

  return {
    reply:
      `Great! Here are ${matching.length} ${label} within your budget of ${budgetText}:\n\n${lines}\n\n` +
      `Would you like to book a viewing, get more details, or schedule an appointment?`,
    quickReplies: matching.slice(0, 3).map((s) => s.name),
    action: 'catalog_match',
  };
}

async function handleBudgetQuery(message, businessId, businessType = '') {
  const budget = parseBudgetFromMessage(message);
  if (!budget) return null;

  const services = await fetchActiveServices(businessId);
  return buildBudgetReply(services, budget, businessType);
}

module.exports = {
  CATALOG_MARKER_START,
  CATALOG_MARKER_END,
  fetchActiveServices,
  buildCatalogKnowledgeText,
  stripCatalogSection,
  mergeCatalogIntoKnowledgeBase,
  syncServicesToKnowledgeBase,
  parseBudgetFromMessage,
  filterServicesByBudget,
  buildBudgetReply,
  handleBudgetQuery,
  isCatalogBusiness,
  catalogItemLabel,
  formatPrice,
};
