const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const { createBroadcast, getBroadcasts } = require('../controllers/broadcastController');

const router = express.Router();

router.post('/api/broadcasts', verifyFirebaseToken, createBroadcast);
router.get('/api/broadcasts', verifyFirebaseToken, getBroadcasts);

module.exports = router;
