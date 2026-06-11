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
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || `Request failed (${res.status})`);
  }
  return parseJsonSafe(res);
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
  getPlans: () => fetch(`${BASE_URL}/api/plans`).then(parseJsonSafe),
  createPaymentOrder: (businessId, planId) =>
    request('/api/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ businessId, planId }),
    }),
  verifyPayment: (data) =>
    request('/api/payments/verify', { method: 'POST', body: JSON.stringify(data) }),
  getAIConfig: (businessId) =>
    request(`/api/ai-config?businessId=${encodeURIComponent(businessId)}`),
  saveAIConfig: (data) =>
    request('/api/ai-config', { method: 'PUT', body: JSON.stringify(data) }),
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
