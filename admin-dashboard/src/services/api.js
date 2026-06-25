import { auth } from '../firebase/auth';

// Normalize the backend URL so a missing scheme (e.g. "host.up.railway.app")
// or a trailing slash can't silently turn requests into relative paths that
// hit the dev server and return an empty body.
function normalizeBaseUrl(url) {
  let u = (url || 'http://localhost:3000').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

const BASE_URL = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL);

// Safely parse a response body as JSON, surfacing a clear error instead of
// the cryptic "Unexpected end of JSON input" when the body is empty/HTML.
async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) {
    throw new Error(
      `Backend returned an empty response (HTTP ${res.status}). Check VITE_BACKEND_URL and that the backend is running.`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      'Backend returned a non-JSON response. Check VITE_BACKEND_URL points to your backend (with https://), not the dashboard.'
    );
  }
}

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request(path, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;
  const headers = await getAuthHeaders();
  const controller = timeoutMs ? new AbortController() : null;
  const timer =
    controller && timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...fetchOptions,
      signal: controller?.signal,
      headers: { ...headers, ...fetchOptions.headers },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText || `Request failed (${res.status})`);
    }
    return parseJsonSafe(res);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        'Request timed out. Check SMTP settings and that the backend can reach your mail server.'
      );
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  getAppointments: (businessId, params = {}) => {
    const qs = new URLSearchParams({ businessId, ...params }).toString();
    return request(`/api/appointments?${qs}`);
  },
  createAppointment: (data) =>
    request('/api/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id, data) =>
    request(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAppointment: (id) =>
    request(`/api/appointments/${id}`, { method: 'DELETE' }),
  getBroadcasts: (businessId) =>
    request(`/api/broadcasts?businessId=${businessId}`),
  createBroadcast: (data) =>
    request('/api/broadcasts', { method: 'POST', body: JSON.stringify(data) }),
  getDailyAnalytics: (businessId, date) =>
    request(`/api/analytics/daily?businessId=${businessId}&date=${date || ''}`),
  getAnalyticsRange: (businessId, days = 7) =>
    request(`/api/analytics/range?businessId=${businessId}&days=${days}`),
  getConversations: (businessId, params = {}) => {
    const qs = new URLSearchParams({ businessId, ...params }).toString();
    return request(`/api/conversations?${qs}`);
  },
  getHandoffQueue: (businessId) =>
    request(`/api/conversations/handoff?businessId=${businessId}`),
  replyToConversation: (id, message) =>
    request(`/api/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),
  resolveConversation: (id) =>
    request(`/api/conversations/${id}/resolve`, { method: 'POST' }),
  deleteConversation: (id) =>
    request(`/api/conversations/${id}`, { method: 'DELETE' }),
  getLeads: (businessId, params = {}) => {
    const qs = new URLSearchParams({ businessId, ...params }).toString();
    return request(`/api/leads?${qs}`);
  },
  createLead: (data) =>
    request('/api/leads', { method: 'POST', body: JSON.stringify(data), timeoutMs: 90000 }),
  updateLead: (id, data) =>
    request(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLead: (id) =>
    request(`/api/leads/${id}`, { method: 'DELETE' }),
  sendLeadFollowUp: (id) =>
    request(`/api/leads/${id}/followup`, { method: 'POST', timeoutMs: 90000 }),
  getLeadConfig: (businessId) =>
    request(`/api/lead-config?businessId=${encodeURIComponent(businessId)}`),
  saveLeadConfig: (data) =>
    request('/api/lead-config', { method: 'PUT', body: JSON.stringify(data) }),
  getPlans: () => fetch(`${BASE_URL}/api/plans`).then(parseJsonSafe),
  createPaymentOrder: (planId) =>
    request('/api/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),
  verifyPayment: (data) =>
    request('/api/payments/verify', { method: 'POST', body: JSON.stringify(data) }),
  getAIConfig: (businessId) =>
    request(`/api/ai-config?businessId=${encodeURIComponent(businessId)}`),
  saveAIConfig: (data) =>
    request('/api/ai-config', { method: 'PUT', body: JSON.stringify(data) }),
  syncServicesToKnowledgeBase: (businessId) =>
    request('/api/services/sync-knowledge-base', {
      method: 'POST',
      body: JSON.stringify({ businessId }),
    }),
  getWhatsAppConfig: (businessId) =>
    request(`/api/channels/whatsapp?businessId=${encodeURIComponent(businessId)}`),
  saveWhatsAppConfig: (data) =>
    request('/api/channels/whatsapp', { method: 'PUT', body: JSON.stringify(data) }),
  testWhatsAppConfig: (businessId) =>
    request('/api/channels/whatsapp/test', { method: 'POST', body: JSON.stringify({ businessId }) }),
  registerWhatsAppWebhook: (businessId) =>
    request('/api/channels/whatsapp/register-webhook', { method: 'POST', body: JSON.stringify({ businessId }) }),
  registerTelegramWebhook: (businessId) =>
    request('/api/channels/telegram/register-webhook', { method: 'POST', body: JSON.stringify({ businessId }) }),
  getPhoneConfig: (businessId) =>
    request(`/api/channels/phone?businessId=${encodeURIComponent(businessId)}`),
  savePhoneConfig: (data) =>
    request('/api/channels/phone', { method: 'PUT', body: JSON.stringify(data) }),
  testPhoneConfig: (businessId) =>
    request('/api/channels/phone/test', { method: 'POST', body: JSON.stringify({ businessId }) }),
  registerPhoneWebhook: (businessId) =>
    request('/api/channels/phone/register-webhook', { method: 'POST', body: JSON.stringify({ businessId }) }),
  getEmailConfig: (businessId) =>
    request(`/api/channels/email?businessId=${encodeURIComponent(businessId)}`),
  saveEmailConfig: (data) =>
    request('/api/channels/email', { method: 'PUT', body: JSON.stringify(data) }),
  testEmailConfig: (data) =>
    request('/api/channels/email/test', {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: 45000,
    }),
  testBot: async (businessId, message, sessionId) => {
    const res = await fetch(`${BASE_URL}/api/widget/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, message, sessionId }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
};
