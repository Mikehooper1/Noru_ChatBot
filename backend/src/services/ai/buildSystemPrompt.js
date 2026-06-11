function buildSystemPrompt(aiConfig, sessionData) {
  return `${aiConfig.systemPrompt}

Current session data collected so far: ${JSON.stringify(sessionData)}

Tone: ${aiConfig.tone}
Language: ${aiConfig.language}

Business Knowledge Base:
${aiConfig.knowledgeBase}

Rules:
- Keep responses concise and conversational (max 3 sentences unless listing options)
- If user asks something outside your knowledge base, say you'll connect them to a human
- Always end booking confirmations with the full appointment summary
- Detect intent: if user says "${(aiConfig.handoffTriggers || []).join('" or "')}", trigger handoff`;
}

function shouldHandoff(message, aiConfig) {
  const triggers = aiConfig.handoffTriggers || ['human', 'agent', 'help'];
  const lower = message.toLowerCase();
  return triggers.some((t) => lower.includes(t.toLowerCase()));
}

module.exports = { buildSystemPrompt, shouldHandoff };
