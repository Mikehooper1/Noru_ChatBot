const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  listLeads,
  createLeadManual,
  updateLead,
  deleteLead,
  sendFollowUpNow,
  getLeadConfig,
  updateLeadConfig,
  captureWidgetLead,
} = require('../controllers/leadController');

const router = express.Router();

// Public capture endpoint for the website widget lead form.
router.post('/api/widget/lead', apiLimiter, captureWidgetLead);

router.get('/api/leads', verifyFirebaseToken, listLeads);
router.post('/api/leads', verifyFirebaseToken, createLeadManual);
router.patch('/api/leads/:id', verifyFirebaseToken, updateLead);
router.delete('/api/leads/:id', verifyFirebaseToken, deleteLead);
router.post('/api/leads/:id/followup', verifyFirebaseToken, sendFollowUpNow);

router.get('/api/lead-config', verifyFirebaseToken, getLeadConfig);
router.put('/api/lead-config', verifyFirebaseToken, updateLeadConfig);

module.exports = router;
