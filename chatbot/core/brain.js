const memory = require('./memoryManager');
const contextManager = require('./contextManager');

function userLogicGenerate(message, context) {
  const lower = String(message||'').toLowerCase();

  // idioma solicitado explicitamente
  const wantsEnglish = /fale em ingl(es|ês)|speak english|in english|please speak english/i.test(message);
  const wantsPortuguese = /fale em portug(u|ês)|speak portuguese|in portuguese|por favor em portugues/i.test(message);

  // heurística simples de detecção (fallback): procura frases-chave
  const isWhoAreYouEn = /who are you|who am i/i.test(message);
  const isWhoAreYouPt = /quem sou eu/i.test(message);

  // decide idioma
  let lang = 'pt';
  if (wantsEnglish || isWhoAreYouEn) lang = 'en';
  else if (wantsPortuguese || isWhoAreYouPt) lang = 'pt';
  else {
    // fallback: se mensagem contém palavras tipicamente inglesas, usa inglês
    const enHits = (message.match(/\b(the|is|you|please|hello|thanks)\b/gi)||[]).length;
    const ptHits = (message.match(/\b(quem|por|favor|obrigad|olá|tudo)\b/gi)||[]).length;
    if (enHits > ptHits) lang = 'en';
  }

  // continuidade
  if (lower.includes('continuar') || lower.includes('e depois') || /continue|and then/i.test(message)) {
    if (lang === 'en') return 'Alright, continuing what we were discussing... ' + context;
    return 'Beleza, continuando o que a gente tava falando... ' + context;
  }

  // memória / quem sou eu
  if (lower.includes('quem sou eu') || /who am i/i.test(message)) {
    if (lang === 'en') return 'From what I remember about you: ' + context;
    return 'Pelo que lembro de você: ' + context;
  }

  // padrão normal (resposta com base no idioma detectado)
  if (lang === 'en') {
    return `\nUnderstood.\n\nAbout what you said: "${message}"\n\nCurrent context:\n${context}\n\nWould you like me to dive deeper into this or do you want to apply it in practice?\n`;
  }
  return `\nEntendi.\n\nSobre isso que você falou: "${message}"\n\nContexto atual:\n${context}\n\nQuer que eu aprofunde isso ou você quer aplicar na prática?\n`;
}

function generateReply(userId, message, style){
  const db = memory.loadDB ? memory.loadDB() : memory.loadUsers();
  const user = memory.getUser ? memory.getUser(db, userId || 'anon') : (db.users && db.users[userId]) || {};

  // record in short term memory
  if (memory.remember) memory.remember(db, userId || 'anon', message);
  if (memory.saveDB) memory.saveDB && memory.saveDB(db);

  // support /learn command
  const trimmed = (message||'').trim();
  if (/^\/learn\s+/i.test(trimmed)){
    const payload = trimmed.replace(/^\/learn\s+/i,'').trim();
    const title = payload.split('|')[0].slice(0,80);
    const item = { id: `kb-${Date.now()}`, query: title, content: payload, created_at: Date.now() };
    if (memory.addKnowledge) memory.addKnowledge(item);
    return { reply: `Aprendi: ${item.query}`, saved: true, item };
  }

  // build context
  const context = contextManager && contextManager.buildContext ? contextManager.buildContext(user) : '';

  // try local knowledge lookup first
  const hits = memory.findKnowledgeByKeyword ? memory.findKnowledgeByKeyword(message, 5) : [];
  if (hits && hits.length){
    const text = hits.map(h => `Fonte: ${h.query}\n${h.content.slice(0,500)}`).join('\n\n---\n\n');
    return { reply: text, sources: hits.map(h=>h.query) };
  }

  // use user-provided logic
  const reply = userLogicGenerate(message, context);
  return { reply };
}

module.exports = { generateReply };
