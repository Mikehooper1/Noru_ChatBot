export const navSections = [
  {
    title: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/agents', label: 'Live Chat', icon: 'inbox' },
      { to: '/leads', label: 'Contacts', icon: 'leads' },
      { to: '/broadcast', label: 'Campaigns', icon: 'broadcast' },
      { to: '/analytics', label: 'History & Analytics', icon: 'analytics' },
    ],
  },
  {
    title: 'Builder',
    items: [
      { to: '/flows', label: 'Flow Builder', icon: 'flow' },
      { to: '/ai-settings', label: 'AI Orchestrator', icon: 'ai' },
      { to: '/services', label: 'Products & Services', icon: 'service' },
      { to: '/appointments', label: 'Test Number', icon: 'calendar' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { to: '/channels', label: 'Channels', icon: 'channels' },
      { to: '/businesses', label: 'My Chatbots', icon: 'bot' },
      { to: '/plans', label: 'Plans & Billing', icon: 'card' },
    ],
  },
];
