export class ChatUI {
  constructor(shadowRoot, config) {
    this.shadow = shadowRoot;
    this.config = config;
    this.isOpen = false;
    this.onSend = null;
    this.typingEl = null;
  }

  render() {
    const pos = this.config.position || 'bottom-right';
    const isRight = pos.includes('right');

    this.container = document.createElement('div');
    this.container.className = 'widget-container';
    this.container.style.setProperty('--widget-primary', this.config.primaryColor || '#4F46E5');

    this.container.innerHTML = `
      <button class="widget-btn" style="background:${this.config.primaryColor || '#4F46E5'};${isRight ? 'right:20px' : 'left:20px'};bottom:20px">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      </button>
      <div class="widget-window" style="display:none;${isRight ? 'right:20px' : 'left:20px'};bottom:90px">
        <div class="widget-header" style="background:${this.config.primaryColor || '#4F46E5'}">
          <div class="widget-avatar">${this.config.botAvatar ? `<img src="${this.config.botAvatar}" style="width:100%;height:100%;border-radius:50%">` : '🤖'}</div>
          <div class="widget-header-info">
            <h4>${this.config.botName || 'ChatBot'}</h4>
            <p>Online</p>
          </div>
          <button class="widget-close">&times;</button>
        </div>
        <div class="widget-messages"></div>
        <div class="widget-quick-replies"></div>
        <div class="widget-input-area">
          <input class="widget-input" placeholder="Type a message..." />
          <button class="widget-send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;

    this.shadow.appendChild(this.container);

    this.btn = this.container.querySelector('.widget-btn');
    this.window = this.container.querySelector('.widget-window');
    this.messagesEl = this.container.querySelector('.widget-messages');
    this.quickRepliesEl = this.container.querySelector('.widget-quick-replies');
    this.input = this.container.querySelector('.widget-input');
    this.sendBtn = this.container.querySelector('.widget-send');

    this.btn.addEventListener('click', () => this.toggle());
    this.container.querySelector('.widget-close').addEventListener('click', () => this.toggle());
    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSend();
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.window.style.display = this.isOpen ? 'flex' : 'none';
    this.btn.style.display = this.isOpen ? 'none' : 'flex';
    if (this.isOpen) this.input.focus();
  }

  handleSend() {
    const text = this.input.value.trim();
    if (!text || !this.onSend) return;
    this.input.value = '';
    this.addMessage(text, 'user');
    this.onSend(text);
  }

  addMessage(text, role) {
    const msg = document.createElement('div');
    msg.className = `widget-msg widget-msg-${role}`;
    msg.textContent = text;
    this.messagesEl.appendChild(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  showTyping() {
    this.typingEl = document.createElement('div');
    this.typingEl.className = 'widget-typing';
    this.typingEl.innerHTML = '<span></span><span></span><span></span>';
    this.messagesEl.appendChild(this.typingEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  hideTyping() {
    if (this.typingEl) {
      this.typingEl.remove();
      this.typingEl = null;
    }
  }

  showQuickReplies(replies) {
    this.quickRepliesEl.innerHTML = '';
    if (!replies?.length) return;

    replies.forEach((reply) => {
      const chip = document.createElement('button');
      chip.className = 'widget-chip';
      chip.textContent = reply;
      chip.addEventListener('click', () => {
        this.quickRepliesEl.innerHTML = '';
        this.addMessage(reply, 'user');
        if (this.onSend) this.onSend(reply);
      });
      this.quickRepliesEl.appendChild(chip);
    });
  }

  showWelcome(message) {
    if (message) this.addMessage(message, 'bot');
  }
}
