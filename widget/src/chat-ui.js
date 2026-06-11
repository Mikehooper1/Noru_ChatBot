export class ChatUI {
  constructor(shadowRoot, config) {
    this.shadow = shadowRoot;
    this.config = config;
    this.isOpen = false;
    this.onSend = null;
    this.onIntroComplete = null;
    this.typingEl = null;
    this.introComplete = false;
    this.userName = '';
    this.userPhone = '';
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
        <div class="widget-intro" style="display:none">
          <div class="widget-intro-inner">
            <div class="widget-intro-icon">👋</div>
            <p class="widget-intro-welcome"></p>
            <p class="widget-intro-subtitle">Please share your details to get started</p>
            <div class="widget-intro-form">
              <label class="widget-intro-label">Your Name</label>
              <input class="widget-intro-input" id="widget-intro-name" type="text" placeholder="Enter your name" required />
              <label class="widget-intro-label">Phone Number</label>
              <input class="widget-intro-input" id="widget-intro-phone" type="tel" placeholder="Enter your phone number" required />
              <p class="widget-intro-error" style="display:none"></p>
              <button class="widget-intro-btn">Start Chat</button>
            </div>
          </div>
        </div>
        <div class="widget-messages" style="display:none"></div>
        <div class="widget-quick-replies"></div>
        <div class="widget-input-area" style="display:none">
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
    this.introEl = this.container.querySelector('.widget-intro');
    this.introWelcome = this.container.querySelector('.widget-intro-welcome');
    this.introError = this.container.querySelector('.widget-intro-error');
    this.introNameInput = this.container.querySelector('#widget-intro-name');
    this.introPhoneInput = this.container.querySelector('#widget-intro-phone');
    this.introBtn = this.container.querySelector('.widget-intro-btn');
    this.messagesEl = this.container.querySelector('.widget-messages');
    this.quickRepliesEl = this.container.querySelector('.widget-quick-replies');
    this.input = this.container.querySelector('.widget-input');
    this.inputArea = this.container.querySelector('.widget-input-area');
    this.sendBtn = this.container.querySelector('.widget-send');

    this.btn.addEventListener('click', () => this.toggle());
    this.container.querySelector('.widget-close').addEventListener('click', () => this.toggle());
    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSend();
    });

    // Intro form submit
    this.introBtn.addEventListener('click', () => this.handleIntroSubmit());
    this.introPhoneInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleIntroSubmit();
    });
    this.introNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.introPhoneInput.focus();
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.window.style.display = this.isOpen ? 'flex' : 'none';
    this.btn.style.display = this.isOpen ? 'none' : 'flex';

    if (this.isOpen) {
      if (this.introComplete) {
        this.input.focus();
      } else {
        this.showIntroScreen();
      }
    }
  }

  showIntroScreen() {
    const welcomeMsg = this.config.welcomeMessage || `Hello! Welcome to ${this.config.botName || 'our chat'}. How can I help you?`;
    this.introWelcome.textContent = welcomeMsg;
    this.introEl.style.display = 'flex';
    this.messagesEl.style.display = 'none';
    this.inputArea.style.display = 'none';
    this.introError.style.display = 'none';

    setTimeout(() => this.introNameInput.focus(), 100);
  }

  handleIntroSubmit() {
    const name = this.introNameInput.value.trim();
    const phone = this.introPhoneInput.value.trim();

    // Validate
    if (!name) {
      this.showIntroError('Please enter your name.');
      this.introNameInput.focus();
      return;
    }
    if (!phone) {
      this.showIntroError('Please enter your phone number.');
      this.introPhoneInput.focus();
      return;
    }

    // Basic phone validation (at least 7 digits)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      this.showIntroError('Please enter a valid phone number.');
      this.introPhoneInput.focus();
      return;
    }

    this.userName = name;
    this.userPhone = phone;
    this.introComplete = true;

    // Switch to chat view
    this.introEl.style.display = 'none';
    this.messagesEl.style.display = 'flex';
    this.inputArea.style.display = 'flex';

    // Show welcome message as bot message
    const welcomeMsg = this.config.welcomeMessage || `Hello! Welcome to ${this.config.botName || 'our chat'}. How can I help you?`;
    this.addMessage(`Hi ${name}! ${welcomeMsg}`, 'bot');

    this.input.focus();

    // Notify parent
    if (this.onIntroComplete) {
      this.onIntroComplete({ name, phone });
    }
  }

  showIntroError(msg) {
    this.introError.textContent = msg;
    this.introError.style.display = 'block';
  }

  setIntroComplete(name, phone) {
    this.userName = name || '';
    this.userPhone = phone || '';
    this.introComplete = true;
    this.introEl.style.display = 'none';
    this.messagesEl.style.display = 'flex';
    this.inputArea.style.display = 'flex';
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

  showUpgradeBanner(url) {
    if (!url || this.container.querySelector('.widget-upgrade')) return;
    const banner = document.createElement('a');
    banner.className = 'widget-upgrade';
    banner.href = url;
    banner.target = '_blank';
    banner.rel = 'noopener';
    banner.textContent = '💳 Upgrade plan — Pay with UPI or Card';
    banner.style.cssText = 'display:block;margin:8px 16px;padding:10px;background:#FEF3C7;color:#92400E;border-radius:8px;text-align:center;font-size:13px;font-weight:600;text-decoration:none';
    this.container.insertBefore(banner, this.container.querySelector('.widget-messages'));
  }
}
