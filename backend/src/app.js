require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initFirebase, logError } = require('./firebase/admin');
const { startReminderCron } = require('./services/reminderService');

const whatsappRoutes = require('./routes/whatsapp');
const telegramRoutes = require('./routes/telegram');
const widgetRoutes = require('./routes/widget');
const appointmentRoutes = require('./routes/appointments');
const broadcastRoutes = require('./routes/broadcast');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;

// Required behind Railway / Render / any reverse proxy so express-rate-limit
// reads X-Forwarded-For correctly (avoids ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
const trustProxy =
  process.env.TRUST_PROXY !== 'false' &&
  (process.env.NODE_ENV === 'production' ||
    process.env.TRUST_PROXY === 'true' ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RENDER);
if (trustProxy) {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  initFirebase();
  console.log('Firebase Admin initialized');
} catch (error) {
  console.warn('Firebase init warning:', error.message);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(whatsappRoutes);
app.use(telegramRoutes);
app.use(widgetRoutes);
app.use(appointmentRoutes);
app.use(broadcastRoutes);
app.use(adminRoutes);
app.use(paymentRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  logError(err).catch(() => {});
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  startReminderCron();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
