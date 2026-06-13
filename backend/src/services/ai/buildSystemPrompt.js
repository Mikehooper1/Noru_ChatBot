function buildSystemPrompt(aiConfig, sessionData, userRecords = []) {
  const recordsContext = userRecords.length
    ? `\nUser's existing bookings/orders:\n${userRecords
        .map(
          (r) =>
            `- ${r.recordType === 'order' ? 'Order' : 'Appointment'}: ${r.serviceName || r.orderNumber} on ${r.date} at ${r.time} (${r.status})`
        )
        .join('\n')}`
    : '';

  return `${aiConfig.systemPrompt}

Current session data collected so far: ${JSON.stringify(sessionData)}${recordsContext}

Tone: ${aiConfig.tone}
Language: ${aiConfig.language}

Business Knowledge Base:
${aiConfig.knowledgeBase}

Rules:
- Keep responses concise and conversational (max 3 sentences unless listing options)
- If user asks something outside your knowledge base, say you'll connect them to a human
- When user asks to recall, show, or check their appointments/orders, summarize their bookings from the list above
- When you confirm an appointment booking, append this exact line at the end (hidden from user display):
  ACTION:BOOK_APPOINTMENT|{"serviceName":"...","date":"YYYY-MM-DD","time":"HH:MM","notes":"..."}
- When you take or confirm a customer order, append this exact line at the end:
  ACTION:CREATE_ORDER|{"serviceName":"...","orderNumber":"ORD-...","items":"...","notes":"..."}
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
