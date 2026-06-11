const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const {
  createAppointment,
  getAppointments,
  updateAppointment,
  deleteAppointment,
} = require('../controllers/appointmentController');

const router = express.Router();

router.post('/api/appointments', verifyFirebaseToken, createAppointment);
router.get('/api/appointments', verifyFirebaseToken, getAppointments);
router.patch('/api/appointments/:id', verifyFirebaseToken, updateAppointment);
router.delete('/api/appointments/:id', verifyFirebaseToken, deleteAppointment);

module.exports = router;
