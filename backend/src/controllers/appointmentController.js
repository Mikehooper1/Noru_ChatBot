const { v4: uuidv4 } = require('uuid');
const { getDb, getFieldValue } = require('../firebase/admin');
const { createCalendarEvent, deleteCalendarEvent } = require('../services/calendarService');
const { trackEvent } = require('../services/analyticsService');
const { sanitizeObject } = require('../utils/sanitize');
const WhatsAppService = require('../services/whatsappService');
const { sendBookingConfirmation } = require('../services/telegramService');
const { notifyAdminNewBooking } = require('../services/appointmentNotificationService');

async function createAppointment(req, res) {
  try {
    const data = sanitizeObject(req.body);
    const appointmentId = uuidv4();

    const calendarEventId = await createCalendarEvent(data.businessId, data);

    const appointment = {
      businessId: data.businessId,
      conversationId: data.conversationId || '',
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      userId: data.userId,
      userName: data.userName,
      userPhone: data.userPhone || '',
      userEmail: data.userEmail || '',
      date: data.date,
      time: data.time,
      duration: data.duration || 30,
      status: 'confirmed',
      channel: data.channel || 'website',
      notes: data.notes || '',
      googleCalendarEventId: calendarEventId,
      reminderSent: false,
      dailyReminderSent: false,
      createdAt: getFieldValue().serverTimestamp(),
      updatedAt: getFieldValue().serverTimestamp(),
    };

    await getDb().collection('appointments').doc(appointmentId).set(appointment);
    await trackEvent(data.businessId, data.channel || 'website', 'appointment');

    if (data.channel === 'whatsapp' && data.userPhone) {
      const wa = new WhatsAppService(data.businessId);
      await wa.init();
      await wa.sendTextMessage(
        data.userPhone,
        `✅ Appointment confirmed!\n${data.serviceName} on ${data.date} at ${data.time}`
      );
    } else if (data.channel === 'telegram' && data.userId) {
      await sendBookingConfirmation(data.businessId, data.userId, appointment);
    }

    await notifyAdminNewBooking(data.businessId, appointment);

    res.status(201).json({ id: appointmentId, ...appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getAppointments(req, res) {
  try {
    const { businessId, status, from, to } = req.query;
    let query = getDb().collection('appointments').where('businessId', '==', businessId);

    if (status) query = query.where('status', '==', status);

    let snap;
    try {
      snap = await query.orderBy('date', 'desc').get();
    } catch {
      snap = await query.get();
    }
    let appointments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    appointments.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

    if (from) appointments = appointments.filter((a) => a.date >= from);
    if (to) appointments = appointments.filter((a) => a.date <= to);

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateAppointment(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeObject(req.body);
    updates.updatedAt = getFieldValue().serverTimestamp();

    if (updates.status === 'cancelled') {
      const doc = await getDb().collection('appointments').doc(id).get();
      if (doc.exists && doc.data().googleCalendarEventId) {
        await deleteCalendarEvent(doc.data().googleCalendarEventId);
      }
    }

    await getDb().collection('appointments').doc(id).update(updates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { createAppointment, getAppointments, updateAppointment };
