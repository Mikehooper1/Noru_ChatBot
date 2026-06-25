const { isHealthBusiness, buildClinicSystemPromptSection } = require('../clinicQuestionService');

function buildSystemPrompt(aiConfig, sessionData, userRecords = [], businessType = '', channel = '', catalogText = '') {
  const recordsContext = userRecords.length
    ? `\nUser's existing bookings/orders:\n${userRecords
        .map(
          (r) =>
            `- ${r.recordType === 'order' ? 'Order' : 'Appointment'}: ${r.serviceName || r.orderNumber} on ${r.date} at ${r.time} (${r.status})`
        )
        .join('\n')}`
    : '';

  const catalogSection = catalogText
    ? `\n\nAvailable Products & Services (use ONLY these when suggesting options or checking budget):\n${catalogText}`
    : '';

  return `${aiConfig.systemPrompt}

Current session data collected so far: ${JSON.stringify(sessionData)}${recordsContext}

Tone: ${aiConfig.tone}
Language: ${aiConfig.language}

Business Knowledge Base:
${aiConfig.knowledgeBase}${catalogSection}
${isHealthBusiness(businessType) ? buildClinicSystemPromptSection() : ''}

Rules:
- Keep responses concise and conversational (max 3 sentences unless listing options)${channel === 'phone' ? '\n- This is a PHONE CALL: keep answers very short (1-2 sentences), speak naturally, no emojis or bullet symbols, spell out numbers and dates clearly' : ''}
- NEVER repeat a question the user already answered — check session data and conversation history first
- NEVER send a welcome/greeting message again if the conversation already started
- If user asks something outside your knowledge base, say you'll connect them to a human
- When user mentions a budget, check the catalog: if nothing fits, clearly say "no properties/items available in your budget" and suggest the closest available options
- When items match the budget, list up to 3 matching options with prices and offer to book or share details
- Accept flexible date formats (DD-MM-YYYY, DD/MM/YYYY, tomorrow, next Monday) and times (2pm, 14:30, 2:30 PM)
- When user asks to recall, show, or check their appointments/orders, summarize their bookings from the list above
- When user asks to change, reschedule, or cancel an appointment, update their existing booking — do NOT start a new booking flow
- When updating an appointment, append:
  ACTION:UPDATE_APPOINTMENT|{"appointmentId":"...","date":"YYYY-MM-DD","time":"HH:MM"}
- When cancelling an appointment, append:
  ACTION:CANCEL_APPOINTMENT|{"appointmentId":"..."}
- When you confirm a new appointment booking, append:
  ACTION:BOOK_APPOINTMENT|{"serviceName":"...","date":"YYYY-MM-DD","time":"HH:MM","notes":"..."}
- When you take or confirm a customer order, append this exact line at the end:
  ACTION:CREATE_ORDER|{"serviceName":"...","orderNumber":"ORD-...","items":"...","notes":"..."}
- LEAD GENERATION: When a new prospect shares contact details (name, phone, email, or Instagram ID) and what they are looking for, capture them as a lead by appending:
  ACTION:CAPTURE_LEAD|{"name":"...","phone":"...","email":"...","instagramUserId":"...","interest":"what they want","notes":"..."}
- When an existing prospect clearly shows interest (wants to proceed, asks to be contacted, requests details/a call/a visit), append:
  ACTION:LEAD_STATUS|{"status":"interested"}
- When a prospect says they are not interested, append:
  ACTION:LEAD_STATUS|{"status":"not_interested"}
- When a prospect asks to stop being contacted or unsubscribe, append:
  ACTION:LEAD_STATUS|{"status":"unsubscribed"}
- Only append ACTION lines when you have enough details (date required for appointments)
- Always end booking confirmations with the full appointment/order summary
- Detect intent: if user says "${(aiConfig.handoffTriggers || []).join('" or "')}", trigger handoff`;
}

function shouldHandoff(message, aiConfig) {
  const triggers = aiConfig.handoffTriggers || ['human', 'agent'];
  const lower = message.toLowerCase();
  return triggers.some((t) => {
    const trigger = t.toLowerCase().trim();
    if (!trigger) return false;
    const pattern = new RegExp(`\\b${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return pattern.test(lower);
  });
}

module.exports = { buildSystemPrompt, shouldHandoff };
