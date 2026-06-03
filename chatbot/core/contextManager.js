const phrases = require('./phrases');

function getShortTermTexts(user) {
  if (!user || !user.memory || !Array.isArray(user.memory.short_term)) return [];
  return user.memory.short_term.map((m) => (typeof m === 'string' ? m : m.text)).filter(Boolean);
}

function extractTopicFromText(text) {
  const t = String(text || '').trim();
  const sobre = t.match(/\b(?:sobre|de|on)\s+(.+?)(?:\?|$)/i);
  if (sobre && sobre[1]) return sobre[1].trim();
  const oque = t.match(/^o\s+que\s+(?:é|e|são|sao)\s+(.+?)(?:\?|$)/i);
  if (oque && oque[1]) return oque[1].trim();
  return t;
}

function getLastUserTopic(user) {
  const texts = getShortTermTexts(user);
  for (let i = texts.length - 1; i >= 0; i--) {
    let t = String(texts[i] || '').trim();
    if (!t || t.startsWith('[ZH]')) continue;
    if (/^\/learn\b/i.test(t)) continue;
    if (phrases.isAffirmative(t) || phrases.isNegative(t)) continue;
    if (phrases.isGreeting(t)) continue;
    if (phrases.wantsSearch(t)) continue;
    if (t.length < 3) continue;
    t = extractTopicFromText(t);
    if (t.length >= 2 && t.length <= 80) return t;
  }
  return user && user.state && user.state.lastTopic ? user.state.lastTopic : '';
}

function buildContext(user) {
  const recent = getShortTermTexts(user).slice(-8).join('\n');
  const summary = (user && user.memory && user.memory.summaries)
    ? user.memory.summaries.slice(-3).join('\n')
    : '';
  const profile = `\nNome: ${user && user.profile && user.profile.name ? user.profile.name : 'desconhecido'}\nEstilo: ${user && user.profile && user.profile.style ? user.profile.style : 'casual'}\nInteresses: ${(user && user.profile && user.profile.interests) ? user.profile.interests.join(', ') : ''}\n`;
  const lastTopic = getLastUserTopic(user);
  const topicLine = lastTopic ? `\n[TÓPICO ATUAL]\n${lastTopic}\n` : '';
  return `\n[PERFIL]${profile}\n[RESUMO]\n${summary}\n${topicLine}\n[RECENTE]\n${recent}\n`;
}

module.exports = { buildContext, getLastUserTopic, getShortTermTexts, extractTopicFromText };
