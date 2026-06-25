const { getDb, getFieldValue } = require('../firebase/admin');
const { PLANS: DEFAULT_PLANS } = require('../constants/plans');

const DOC_PATH = { collection: 'platform', doc: 'plans' };

let cache = null;
let cacheAt = 0;
const CACHE_TTL_MS = 30_000;

function normalizePlan(planId, base, override = {}) {
  const price = Number(override.price ?? base.price ?? 0);
  const businesses = Number(override.businesses ?? base.businesses ?? 1);
  const messagesPerMonth = Number(override.messagesPerMonth ?? base.messagesPerMonth ?? 0);
  const channels = Array.isArray(override.channels) && override.channels.length
    ? override.channels
    : base.channels || ['website'];
  const features = Array.isArray(override.features) && override.features.length
    ? override.features
    : base.features || [];

  const merged = {
    ...base,
    ...override,
    id: planId,
    name: String(override.name ?? base.name ?? planId),
    price,
    pricePaise: Math.round(price * 100),
    businesses,
    messagesPerMonth,
    channels,
    features,
    reminders: override.reminders !== undefined ? override.reminders === true : base.reminders === true,
  };

  if (override.sessionRetentionHours != null) {
    merged.sessionRetentionHours = Number(override.sessionRetentionHours);
    delete merged.sessionRetentionDays;
  } else if (override.sessionRetentionDays != null) {
    merged.sessionRetentionDays = Number(override.sessionRetentionDays);
    delete merged.sessionRetentionHours;
  }

  return merged;
}

function mergeCatalog(overrides = {}) {
  const catalog = {};
  for (const planId of Object.keys(DEFAULT_PLANS)) {
    catalog[planId] = normalizePlan(planId, DEFAULT_PLANS[planId], overrides[planId] || {});
  }
  return catalog;
}

function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

async function getPlansMap(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache && now - cacheAt < CACHE_TTL_MS) {
    return cache;
  }

  const doc = await getDb().collection(DOC_PATH.collection).doc(DOC_PATH.doc).get();
  const overrides = doc.exists ? doc.data().overrides || {} : {};
  cache = mergeCatalog(overrides);
  cacheAt = now;
  return cache;
}

async function getAllPlans() {
  const map = await getPlansMap();
  return Object.values(map);
}

async function getPlan(planId) {
  const map = await getPlansMap();
  return map[planId] || map.free;
}

async function getPlansForAdmin() {
  const map = await getPlansMap(true);
  const doc = await getDb().collection(DOC_PATH.collection).doc(DOC_PATH.doc).get();
  return {
    plans: Object.values(map),
    defaults: DEFAULT_PLANS,
    hasOverrides: doc.exists && Object.keys(doc.data().overrides || {}).length > 0,
    updatedAt: doc.exists ? doc.data().updatedAt || null : null,
  };
}

async function savePlansCatalog(plansPayload) {
  if (!Array.isArray(plansPayload)) {
    throw new Error('plans array is required');
  }

  const overrides = {};
  for (const item of plansPayload) {
    if (!item?.id || !DEFAULT_PLANS[item.id]) {
      throw new Error(`Unknown plan id: ${item?.id}`);
    }

    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Invalid price for plan ${item.id}`);
    }

    overrides[item.id] = {
      name: String(item.name || DEFAULT_PLANS[item.id].name).trim(),
      price,
      businesses: Number(item.businesses) || DEFAULT_PLANS[item.id].businesses,
      messagesPerMonth: Number(item.messagesPerMonth) || DEFAULT_PLANS[item.id].messagesPerMonth,
      channels: Array.isArray(item.channels) ? item.channels : DEFAULT_PLANS[item.id].channels,
      features: Array.isArray(item.features)
        ? item.features.map((f) => String(f).trim()).filter(Boolean)
        : DEFAULT_PLANS[item.id].features,
      reminders: item.reminders === true,
    };

    if (item.sessionRetentionHours != null && item.sessionRetentionHours !== '') {
      overrides[item.id].sessionRetentionHours = Number(item.sessionRetentionHours);
    } else if (item.sessionRetentionDays != null && item.sessionRetentionDays !== '') {
      overrides[item.id].sessionRetentionDays = Number(item.sessionRetentionDays);
    }
  }

  await getDb()
    .collection(DOC_PATH.collection)
    .doc(DOC_PATH.doc)
    .set(
      {
        overrides,
        updatedAt: getFieldValue().serverTimestamp(),
      },
      { merge: true }
    );

  invalidateCache();
  return getPlansForAdmin();
}

module.exports = {
  getPlan,
  getAllPlans,
  getPlansMap,
  getPlansForAdmin,
  savePlansCatalog,
  invalidateCache,
  DEFAULT_PLANS,
};
