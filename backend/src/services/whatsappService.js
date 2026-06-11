const axios = require('axios');
const { getChannelConfig } = require('../firebase/admin');

class WhatsAppService {
  constructor(businessId) {
    this.businessId = businessId;
    this.config = null;
  }

  async init() {
    this.config = await getChannelConfig(this.businessId, 'whatsapp');
    if (!this.config?.enabled) throw new Error('WhatsApp channel not enabled');
    return this;
  }

  get apiUrl() {
    return `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`;
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async sendTextMessage(to, text) {
    return axios.post(
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
