const { getAIConfigForAdmin, saveAIConfig } = require('../services/aiConfigService');
const { getBusiness } = require('../firebase/admin');

async function getAIConfig(req, res) {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const business = await getBusiness(businessId);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const config = await getAIConfigForAdmin(businessId);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateAIConfig(req, res) {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const business = await getBusiness(businessId);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const config = await saveAIConfig(businessId, req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getAIConfig, updateAIConfig };
