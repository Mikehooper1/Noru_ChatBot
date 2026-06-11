import { auth } from '../firebase/auth';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

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
    throw new Error(err.error || res.statusText);
  }
  return res.json();
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
  getPlans: () => fetch(`${BASE_URL}/api/plans`).then((r) => r.json()),
  createPaymentOrder: (businessId, planId) =>
    request('/api/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ businessId, planId }),
    }),
  verifyPayment: (data) =>
    request('/api/payments/verify', { method: 'POST', body: JSON.stringify(data) }),
  testBot: async (businessId, message, sessionId) => {
    const res = await fetch(`${BASE_URL}/api/widget/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, message, sessionId }),
    });
    return res.json();
  },
};
