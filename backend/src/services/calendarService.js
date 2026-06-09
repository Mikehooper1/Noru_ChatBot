const { google } = require('googleapis');
const { getDb } = require('../firebase/admin');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );
}

async function createCalendarEvent(businessId, appointment) {
  const oauth2Client = getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const startDateTime = new Date(`${appointment.date}T${appointment.time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + appointment.duration * 60000);

  const event = {
    summary: `${appointment.serviceName} — ${appointment.userName}`,
    description: `Phone: ${appointment.userPhone}\nEmail: ${appointment.userEmail || 'N/A'}\nNotes: ${appointment.notes || ''}`,
    start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
    end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
    attendees: appointment.userEmail ? [{ email: appointment.userEmail }] : [],
  };

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    return response.data.id;
  } catch (error) {
    console.warn('Calendar event creation failed:', error.message);
    return null;
  }
}

async function deleteCalendarEvent(eventId) {
  if (!eventId) return;
  const oauth2Client = getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (error) {
    console.warn('Calendar event deletion failed:', error.message);
  }
}

module.exports = { createCalendarEvent, deleteCalendarEvent, getOAuth2Client };
