const {
  CLINIC_CATEGORIES,
  CLINIC_QUESTIONS,
  CLINIC_MENU_QUICK_REPLIES,
  URGENT_REPLY,
  AGENT_REPLY,
} = require('../constants/clinicQuestions');

const HEALTH_BUSINESS_TYPES = new Set(['clinic', 'hospital']);

function isHealthBusiness(businessType) {
  return HEALTH_BUSINESS_TYPES.has(String(businessType || '').toLowerCase());
}

function normalizeText(text) {
  return (text || '').toLowerCase().trim();
}

function matchClinicQuestion(message) {
  const text = normalizeText(message);
  if (!text) return null;

  for (const question of CLINIC_QUESTIONS) {
    if (question.patterns.some((pattern) => pattern.test(text))) {
      return question;
    }
  }

  return null;
}

function matchClinicCategory(message) {
  const text = normalizeText(message);
  if (!text) return null;

  for (const category of CLINIC_CATEGORIES) {
    if (
      textsMatch(text, category.label) ||
      textsMatch(text, category.menuLabel) ||
      textsMatch(text, category.id)
    ) {
      return category;
    }
  }

  return null;
}

function textsMatch(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function getCategoryQuestions(categoryId) {
  return CLINIC_QUESTIONS.filter((q) => q.category === categoryId);
}

function buildCategoryReply(category) {
  const questions = getCategoryQuestions(category.id);
  const botExamples = questions.filter((q) => q.handling === 'bot_answer').slice(0, 4);
  const agentNote = questions.some((q) => q.handling === 'needs_agent')
    ? '\n\nFor records, billing disputes, or personal details, I can connect you to our receptionist.'
    : '';

  const examples = botExamples.map((q) => `• ${q.text}`).join('\n');

  if (category.id === 'emergency') {
    return (
      '🚨 **Emergency & urgent care**\n\n' +
      'If this is a life-threatening emergency, call **112** or go to the nearest ER immediately.\n\n' +
      'You can also ask:\n' +
      '• What is your emergency helpline number?\n' +
      '• Is there an ambulance service?\n' +
      '• Who should I call after clinic hours?\n\n' +
      'Describe your symptoms and I will escalate urgent cases to our team right away.'
    );
  }

  if (category.id === 'appointment') {
    return (
      `📅 **${category.label}**\n\n` +
      'Say "book appointment" to start scheduling, or ask things like:\n' +
      examples +
      '\n\nYou can also say "my appointments" to view upcoming visits.'
    );
  }

  return (
    `**${category.label}**\n\n${category.description}.\n\n` +
    'For example, you can ask:\n' +
    examples +
    agentNote
  );
}

function getCategoryQuickReplies(categoryId) {
  const questions = getCategoryQuestions(categoryId);
  return questions
    .filter((q) => q.handling === 'bot_answer')
    .slice(0, 3)
    .map((q) => q.text.replace(/\[.*?\]/g, '').trim());
}

function buildClinicSystemPromptSection() {
  const lines = CLINIC_CATEGORIES.map((cat) => {
    const counts = getCategoryQuestions(cat.id).reduce(
      (acc, q) => {
        acc[q.handling] = (acc[q.handling] || 0) + 1;
        return acc;
      },
      {}
    );
    return `- ${cat.label}: ${counts.bot_answer || 0} auto-answer, ${counts.needs_agent || 0} agent, ${counts.urgent || 0} urgent`;
  });

  const sampleQuestions = CLINIC_QUESTIONS.filter((q) => q.handling === 'bot_answer')
    .slice(0, 15)
    .map((q) => `- ${q.text}`)
    .join('\n');

  return `
Clinic receptionist question bank (answer from Business Knowledge Base when possible):
${lines.join('\n')}

Common patient questions you should answer directly when info is in the knowledge base:
${sampleQuestions}

Clinic rules:
- Never diagnose or prescribe medication
- For urgent symptoms (chest pain, breathing difficulty, high fever in children, accidents, worsening condition), tell the patient to call emergency services and that a human is being notified
- For records, billing disputes, certificates, complaints, and identity updates, offer to connect to receptionist
- For appointment booking/rescheduling/cancelling, use ACTION lines when you have enough details
`;
}

function resolveClinicMessage(message, businessType) {
  if (!isHealthBusiness(businessType)) return null;

  const matchedQuestion = matchClinicQuestion(message);
  if (matchedQuestion?.handling === 'urgent') {
    return { action: 'urgent', reply: URGENT_REPLY, matchedQuestion };
  }
  if (matchedQuestion?.handling === 'needs_agent') {
    return { action: 'handoff', reply: AGENT_REPLY, matchedQuestion };
  }

  const category = matchClinicCategory(message);
  if (category && !matchedQuestion) {
    return {
      action: 'category',
      reply: buildCategoryReply(category),
      quickReplies: getCategoryQuickReplies(category.id),
      category,
    };
  }

  if (matchedQuestion) {
    return { action: 'ai', matchedQuestion };
  }

  return null;
}

module.exports = {
  isHealthBusiness,
  matchClinicQuestion,
  matchClinicCategory,
  buildCategoryReply,
  getCategoryQuickReplies,
  buildClinicSystemPromptSection,
  resolveClinicMessage,
  CLINIC_MENU_QUICK_REPLIES,
  CLINIC_CATEGORIES,
  URGENT_REPLY,
  AGENT_REPLY,
};
