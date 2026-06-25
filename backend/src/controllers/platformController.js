const {
  getBillingConfigForAdmin,
  saveBillingConfig,
  testBillingConfig,
} = require('../services/billingConfigService');
const { getPlansForAdmin, savePlansCatalog } = require('../services/planCatalogService');

async function getPlatformBilling(req, res) {
  try {
    const config = await getBillingConfigForAdmin();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updatePlatformBilling(req, res) {
  try {
    const config = await saveBillingConfig(req.body || {});
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function testPlatformBilling(req, res) {
  try {
    const result = await testBillingConfig();
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getPlatformPlans(req, res) {
  try {
    const data = await getPlansForAdmin();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updatePlatformPlans(req, res) {
  try {
    const data = await savePlansCatalog(req.body?.plans);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  getPlatformBilling,
  updatePlatformBilling,
  testPlatformBilling,
  getPlatformPlans,
  updatePlatformPlans,
};
