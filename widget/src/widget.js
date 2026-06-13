import { ChatUI } from './chat-ui.js';

const WIDGET_CSS = `
.widget-container{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5;box-sizing:border-box}
.widget-container *,.widget-container *::before,.widget-container *::after{box-sizing:border-box}
.widget-btn{position:fixed;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;z-index:999998;transition:transform .2s}
.widget-btn:hover{transform:scale(1.05)}
.widget-btn svg{width:28px;height:28px;fill:white}
.widget-window{position:fixed;width:380px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 100px);border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden;z-index:999999;background:#fff}
.widget-header{padding:16px;color:white;display:flex;align-items:center;gap:12px}
.widget-avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px}
.widget-header-info h4{margin:0;font-size:16px;font-weight:600}
.widget-header-info p{margin:0;font-size:12px;opacity:.85}
.widget-close{margin-left:auto;background:none;border:none;color:white;cursor:pointer;font-size:20px;padding:4px}
.widget-intro{flex:1;display:flex;align-items:center;justify-content:center;background:#f9fafb;padding:20px}
.widget-intro-inner{width:100%;max-width:300px;text-align:center}
.widget-intro-icon{font-size:40px;margin-bottom:12px;animation:widget-wave 1.5s ease-in-out infinite}
@keyframes widget-wave{0%,100%{transform:rotate(0deg)}25%{transform:rotate(20deg)}50%{transform:rotate(-10deg)}75%{transform:rotate(15deg)}}
.widget-intro-welcome{font-size:15px;color:#374151;margin:0 0 4px;font-weight:500;line-height:1.4}
.widget-intro-subtitle{font-size:12px;color:#9ca3af;margin:0 0 16px}
.widget-intro-form{text-align:left}
.widget-intro-label{display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
.widget-intro-input{width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;margin-bottom:12px;transition:border-color .2s}
.widget-intro-input:focus{border-color:var(--widget-primary,#4F46E5);box-shadow:0 0 0 3px rgba(79,70,229,.1)}
.widget-intro-error{font-size:12px;color:#ef4444;margin:0 0 8px;padding:6px 10px;background:#fef2f2;border-radius:6px}
.widget-intro-btn{width:100%;padding:12px;border:none;border-radius:10px;background:var(--widget-primary,#4F46E5);color:white;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s,transform .1s}
.widget-intro-btn:hover{opacity:.9}
.widget-intro-btn:active{transform:scale(.98)}
.widget-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#f9fafb}
.widget-msg{max-width:80%;padding:10px 14px;border-radius:12px;word-wrap:break-word;animation:widget-fadeIn .3s ease}
@keyframes widget-fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.widget-msg-bot{background:white;border:1px solid #e5e7eb;align-self:flex-start;border-bottom-left-radius:4px}
.widget-msg-agent{background:#fff7ed;border:1px solid #fed7aa;align-self:flex-start;border-bottom-left-radius:4px}
.widget-msg-agent::before{content:'Agent · ';font-size:11px;color:#c2410c;font-weight:600}
.widget-msg-user{background:var(--widget-primary,#4F46E5);color:white;align-self:flex-end;border-bottom-right-radius:4px}
.widget-typing{display:flex;gap:4px;padding:10px 14px;background:white;border:1px solid #e5e7eb;border-radius:12px;align-self:flex-start;width:fit-content}
.widget-typing span{width:8px;height:8px;border-radius:50%;background:#9ca3af;animation:widget-bounce 1.4s infinite ease-in-out both}
.widget-typing span:nth-child(1){animation-delay:-.32s}
.widget-typing span:nth-child(2){animation-delay:-.16s}
@keyframes widget-bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
.widget-quick-replies{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 8px}
.widget-chip{padding:6px 14px;border-radius:20px;border:1px solid var(--widget-primary,#4F46E5);color:var(--widget-primary,#4F46E5);background:white;cursor:pointer;font-size:13px;transition:all .15s}
.widget-chip:hover{background:var(--widget-primary,#4F46E5);color:white}
.widget-input-area{padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:8px;background:white}
.widget-input{flex:1;padding:10px 14px;border:1px solid #e5e7eb;border-radius:24px;outline:none;font-size:14px}
.widget-input:focus{border-color:var(--widget-primary,#4F46E5)}
.widget-send{width:40px;height:40px;border-radius:50%;border:none;background:var(--widget-primary,#4F46E5);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center}
@media(max-width:480px){.widget-window{width:calc(100vw - 16px);height:calc(100vh - 80px);bottom:8px!important;right:8px!important;left:8px!important}}
`;

function normalizeBackendUrl(url) {
  if (!url) return 'http://localhost:3000';
  const trimmed = String(url).trim().replace(/\/$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getMountTarget() {
  return document.body || document.documentElement;
}

function initWidget() {
  const config = window.BotConfig || {};
  const businessId = config.businessId;
  const backendUrl = normalizeBackendUrl(config.backendUrl);
  const storageKey = `noru_chat_${businessId}`;
  const convStorageKey = `noru_conv_${businessId}`;
  const userStorageKey = `noru_user_${businessId}`;

  if (!businessId) {
    console.error('[Noru ChatBot] businessId is required in window.BotConfig');
    return;
  }

  if (document.getElementById('noru-chatbot-widget')) {
    return;
  }

  let sessionId = localStorage.getItem(storageKey);
  let conversationId = localStorage.getItem(convStorageKey);

  // Load saved user info
  let savedUser = null;
  try {
    const raw = localStorage.getItem(userStorageKey);
    if (raw) savedUser = JSON.parse(raw);
  } catch (e) { /* ignore */ }

  const host = document.createElement('div');
  host.id = 'noru-chatbot-widget';
  getMountTarget().appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = WIDGET_CSS;
  shadow.appendChild(style);

  let chatUI;
  let widgetConfig;
  let userName = savedUser?.name || '';
  let userPhone = savedUser?.phone || '';
  let pollTimer = null;
  let lastPollAt = Date.now();
  const seenMessageIds = new Set();

  async function pollAgentMessages() {
    if (!chatUI?.isOpen || !sessionId || !chatUI.introComplete) return;
    try {
      const params = new URLSearchParams({
        businessId,
        sessionId,
        after: String(lastPollAt),
      });
      if (conversationId) params.set('conversationId', conversationId);
      const res = await fetch(`${backendUrl}/api/widget/messages?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      for (const msg of data.messages || []) {
        if (!msg.content || seenMessageIds.has(msg.id)) continue;
        seenMessageIds.add(msg.id);
        chatUI.addMessage(msg.content, 'agent', msg.id);
        lastPollAt = Math.max(lastPollAt, msg.timestamp || Date.now());
      }
    } catch {
      // ignore transient poll errors
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(pollAgentMessages, 3000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch(`${backendUrl}/api/widget/config/${businessId}`);
      if (res.ok) return res.json();
      if (res.status === 403) {
        console.warn('[Noru ChatBot] Website channel is disabled for this business');
      }
    } catch (e) {
      console.warn('[Noru ChatBot] Could not load config, using defaults');
    }
    return {
      botName: config.botName || 'ChatBot',
      welcomeMessage: config.welcomeMessage || 'Hello! How can I help you?',
      primaryColor: config.primaryColor || '#4F46E5',
      position: config.position || 'bottom-right',
    };
  }

  async function startChatSession() {
    if (!chatUI) return;
    try {
      const res = await fetch(`${backendUrl}/api/widget/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, userName, userPhone }),
      });
      const data = await res.json();

      if (data.sessionId) {
        sessionId = data.sessionId;
        localStorage.setItem(storageKey, sessionId);
      }
      if (data.conversationId) {
        conversationId = data.conversationId;
        localStorage.setItem(convStorageKey, conversationId);
      }

      if (data.welcome) {
        chatUI.addMessage(data.welcome, 'bot');
        chatUI.showQuickReplies(data.quickReplies);
      }
    } catch {
      const fallback = widgetConfig?.welcomeMessage || 'Hello! How can I help you today?';
      chatUI.addMessage(userName ? `Hi ${userName}! ${fallback}` : fallback, 'bot');
    }
  }

  async function sendMessage(message) {
    if (!chatUI) return;
    chatUI.showTyping();
    try {
      const res = await fetch(`${backendUrl}/api/widget/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, message, userName, userPhone }),
      });
      const data = await res.json();
      chatUI.hideTyping();

      if (!res.ok) {
        chatUI.addMessage(data.error || 'Sorry, something went wrong. Please try again.', 'bot');
        return;
      }

      if (data.sessionId) {
        sessionId = data.sessionId;
        localStorage.setItem(storageKey, sessionId);
      }
      if (data.conversationId) {
        conversationId = data.conversationId;
        localStorage.setItem(convStorageKey, conversationId);
      }
      lastPollAt = Date.now();

      if (data.upgradeUrl) {
        chatUI.showUpgradeBanner(data.upgradeUrl);
      }

      if (data.reply) {
        chatUI.addMessage(data.reply, 'bot');
        chatUI.showQuickReplies(data.quickReplies);
      }
    } catch (error) {
      chatUI.hideTyping();
      chatUI.addMessage('Sorry, something went wrong. Please try again.', 'bot');
    }
  }

  loadConfig().then((cfg) => {
    widgetConfig = cfg;
    if (widgetConfig.enabled === false) {
      host.remove();
      return;
    }

    chatUI = new ChatUI(shadow, { ...config, ...cfg });
    chatUI.render();
    chatUI.onSend = sendMessage;
    chatUI.onVisibilityChange = (open) => {
      if (open) {
        startPolling();
        pollAgentMessages();
      } else {
        stopPolling();
      }
    };

    startPolling();

    if (savedUser?.name && savedUser?.phone) {
      chatUI.setIntroComplete(savedUser.name, savedUser.phone);
      startChatSession();
    }

    chatUI.onIntroComplete = (userData) => {
      userName = userData.name;
      userPhone = userData.phone;

      localStorage.setItem(userStorageKey, JSON.stringify({
        name: userData.name,
        phone: userData.phone,
      }));

      startChatSession();
    };
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  initWidget();
}
