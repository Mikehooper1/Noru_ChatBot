function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatForVoice(text) {
  return String(text || '')
    .replace(/ACTION:[A-Z_]+\|[^\n]*/gi, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[*_#`]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

function buildGatherUrl(baseUrl, params) {
  const qs = new URLSearchParams(params).toString();
  return `${baseUrl.replace(/\/$/, '')}/webhook/phone/gather?${qs}`;
}

function twimlResponse(innerXml) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${innerXml}</Response>`;
}

function sayBlock(text, voice = 'Polly.Aditi', language = 'en-IN') {
  const safe = escapeXml(formatForVoice(text));
  if (!safe) return '';
  return `<Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${safe}</Say>`;
}

function gatherSpeech({ actionUrl, prompt, voice, language, timeout = 5 }) {
  const promptXml = prompt ? sayBlock(prompt, voice, language) : '';
  return `${promptXml}<Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" speechTimeout="auto" timeout="${timeout}" language="${escapeXml(language)}" />`;
}

function buildConversationTwiml({
  reply,
  actionUrl,
  voice,
  language,
  hangup = false,
  handoffNumber = null,
}) {
  if (handoffNumber) {
    const transferMsg = reply || 'Connecting you to a team member now. Please hold.';
    return twimlResponse(
      `${sayBlock(transferMsg, voice, language)}<Dial>${escapeXml(handoffNumber)}</Dial>`
    );
  }

  if (hangup) {
    const farewell = reply || 'Thank you for calling. Goodbye.';
    return twimlResponse(`${sayBlock(farewell, voice, language)}<Hangup/>`);
  }

  const spoken = reply || 'How can I help you?';
  return twimlResponse(gatherSpeech({ actionUrl, prompt: spoken, voice, language }));
}

function buildWelcomeTwiml({ greeting, actionUrl, voice, language }) {
  return twimlResponse(gatherSpeech({ actionUrl, prompt: greeting, voice, language }));
}

module.exports = {
  escapeXml,
  formatForVoice,
  buildGatherUrl,
  twimlResponse,
  sayBlock,
  gatherSpeech,
  buildConversationTwiml,
  buildWelcomeTwiml,
};
