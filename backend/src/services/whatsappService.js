const axios = require('axios');
const { getChannelConfig } = require('../firebase/admin');

function formatWhatsAppApiError(error) {
  const status = error?.response?.status;
  const metaMessage = error?.response?.data?.error?.message;

  if (status === 401) {
    return (
      'WhatsApp access token is invalid or expired. Go to Meta Business Suite → WhatsApp → API Setup, ' +
      'generate a new permanent token, then paste it in Admin → Channels → WhatsApp → Access Token and Save.'
    );
  }
  if (status === 403) {
    return metaMessage || 'WhatsApp API permission denied — check your Meta app permissions and token scopes.';
  }
  if (status === 404) {
    return 'WhatsApp Phone Number ID not found — verify Phone Number ID in Channels → WhatsApp matches Meta API Setup.';
  }
  return metaMessage || error.message || 'WhatsApp API request failed';
}

class WhatsAppService {
  constructor(businessId) {
    this.businessId = businessId;
    this.config = null;
  }

  async init() {
    this.config = await getChannelConfig(this.businessId, 'whatsapp');
    if (!this.config?.enabled) throw new Error('WhatsApp channel not enabled');
    if (!this.config.phoneNumberId?.trim()) {
      throw new Error('WhatsApp Phone Number ID not configured — set it in Admin → Channels → WhatsApp');
    }
    if (!this.config.accessToken?.trim()) {
      throw new Error(
        'WhatsApp access token not configured — paste your Meta permanent token in Admin → Channels → WhatsApp'
      );
    }
    return this;
  }

  get apiUrl() {
    return `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}/messages`;
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.config.accessToken.trim()}`,
      'Content-Type': 'application/json',
    };
  }

  async verifyCredentials() {
    try {
      const url = `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}`;
      const { data } = await axios.get(url, {
        headers: this.headers,
        params: { fields: 'id,display_phone_number,verified_name' },
      });
      return { ok: true, phone: data.display_phone_number, name: data.verified_name };
    } catch (error) {
      return { ok: false, error: formatWhatsAppApiError(error) };
    }
  }

  async sendTextMessage(to, text) {
    try {
      return await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: text },
        },
        { headers: this.headers }
      );
    } catch (error) {
      throw Object.assign(new Error(formatWhatsAppApiError(error)), { status: error.response?.status });
    }
  }

  async sendCtaUrl(to, text, displayText, url) {
    return axios.post(
      this.apiUrl,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: text.substring(0, 1024) },
          action: {
            name: 'cta_url',
            parameters: {
              display_text: displayText.substring(0, 20),
              url,
            },
          },
        },
      },
      { headers: this.headers }
    );
  }

  async sendQuickReplies(to, text, buttons) {
    const replyButtons = buttons.slice(0, 3).map((btn, i) => ({
      type: 'reply',
      reply: { id: `btn_${i}`, title: btn.substring(0, 20) },
    }));

    return axios.post(
      this.apiUrl,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: { buttons: replyButtons },
        },
      },
      { headers: this.headers }
    );
  }

  async sendList(to, header, items) {
    const rows = items.slice(0, 10).map((item, i) => ({
      id: `item_${i}`,
      title: item.title.substring(0, 24),
      description: (item.description || '').substring(0, 72),
    }));

    return axios.post(
      this.apiUrl,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: header },
          body: { text: 'Please select an option:' },
          action: { button: 'View Options', sections: [{ rows }] },
        },
      },
      { headers: this.headers }
    );
  }

  async sendTemplate(to, templateName, params = []) {
    return axios.post(
      this.apiUrl,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: params.length
            ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) }]
            : [],
        },
      },
      { headers: this.headers }
    );
  }
}

module.exports = WhatsAppService;
