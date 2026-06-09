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
.widget-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#f9fafb}
.widget-msg{max-width:80%;padding:10px 14px;border-radius:12px;word-wrap:break-word}
.widget-msg-bot{background:white;border:1px solid #e5e7eb;align-self:flex-start;border-bottom-left-radius:4px}
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

(function () {
  const config = window.BotConfig || {};
  const businessId = config.businessId;
  const backendUrl = config.backendUrl || 'http://localhost:3000';
  const storageKey = `noru_chat_${businessId}`;

  if (!businessId) {
    console.error('[Noru ChatBot] businessId is required in window.BotConfig');
    return;
  }

  let sessionId = localStorage.getItem(storageKey);

  const host = document.createElement('div');
  host.id = 'noru-chatbot-widget';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = WIDGET_CSS;
  shadow.appendChild(style);

  async function loadConfig() {
    try {
      const res = await fetch(`${backendUrl}/api/widget/config/${businessId}`);
      if (res.ok) return res.json();
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

  async function sendMessage(message) {
    chatUI.showTyping();
    try {
      const res = await fetch(`${backendUrl}/api/widget/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, message }),
      });
      const data = await res.json();
      chatUI.hideTyping();

      if (data.sessionId) {
        sessionId = data.sessionId;
        localStorage.setItem(storageKey, sessionId);
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

  let chatUI;

  loadConfig().then((widgetConfig) => {
    chatUI = new ChatUI(shadow, { ...config, ...widgetConfig });
    chatUI.render();
    chatUI.onSend = sendMessage;
    chatUI.showWelcome(widgetConfig.welcomeMessage);
  });
})();

