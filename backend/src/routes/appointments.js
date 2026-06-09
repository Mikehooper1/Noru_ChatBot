const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const {
  createAppointment,
  getAppointments,
  updateAppointment,
} = require('../controllers/appointmentController');

const router = express.Router();

router.post('/api/appointments', verifyFirebaseToken, createAppointment);
router.get('/api/appointments', verifyFirebaseToken, getAppointments);
router.patch('/api/appointments/:id', verifyFirebaseToken, updateAppointment);

module.exports = router;
