const memory = require('./memoryManager');
const contextManager = require('./contextManager');
const phrases = require('./phrases');
const vocab = require('./vocab');

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
    // paraphrase hits into natural-sounding sentences (não exibir tabelas/metadados)
    const paras = hits.map(h => phrases.paraphraseKnowledge(h));
    const combined = paras.join('\n\n');
    return { reply: combined, sources: hits.map(h=>h.query) };
  }
  // Detect direct definition/question requests first
  const qText = String(message||'').trim();
  const isQuestion = /\?$/i.test(qText) || /^o que é\b|^o que são\b|^o que quer dizer\b|^what is\b|^what are\b|^define\b|^defina\b/i.test(qText);
  if (isQuestion){
    // try KB again more broadly
    if (hits && hits.length){
      const paras = hits.map(h => phrases.paraphraseKnowledge(h));
      return { reply: paras.join('\n\n') };
    }
    // not found -> varied replies offering to learn or apologize conversationally
    const notFoundPt = [
      'Ainda não tenho conhecimento suficiente sobre isso — quer me ensinar?',
      'Boa pergunta — não tenho isso no meu banco local, quer que eu aprenda agora?',
      'Hum, não encontrei referência local. Posso tentar buscar ou você pode me explicar?'
    ];
    const notFoundEn = [
      "I don't have enough info about that yet — would you like to teach me?",
      "Good question — I don't have that in my local knowledge, shall I learn it now?",
      "Hmm, couldn't find a local reference. I can try to look it up or you can explain it to me."
    ];
    const useEnQ = (/\b(the|is|you|please|hello|thanks)\b/i.test(message));
    const pick = useEnQ ? notFoundEn[Math.floor(Math.random()*notFoundEn.length)] : notFoundPt[Math.floor(Math.random()*notFoundPt.length)];
    return { reply: pick };
  }

  // vocabulary detection: match user words to conversational follow-ups
  try {
    const vMatches = vocab.findVocabMatches(message);
    if (vMatches && vMatches.length){
      // pick first match and build follow-up based on detected language
      const word = vMatches[0];
      // simple language detection
      const lang = (/\b(the|is|you|please|hello|thanks)\b/i.test(message)) ? 'en' : 'pt';
      const follow = vocab.pickFollowUp(word, lang);
      return { reply: follow };
    }
  } catch(e){ /* ignore */ }

  // If reached here: no KB hits and no vocab match -> respond with varied human-like replies
  const unknownPt = [
    'Ainda não tenho muito conhecimento sobre isso — quer me explicar?',
    'Boa pergunta; não tenho essa informação agora, mas posso aprender se você quiser ensinar.',
    'Interessante! Não encontrei referência local. Quer que eu pesquise ou você me conte mais?'
  ];
  const unknownEn = [
    "I don't have much info about that yet — would you like to tell me?",
    "Good question; I don't have that info right now, but I can learn if you teach me.",
    "Interesting! I couldn't find local references. Should I look it up or would you like to explain?"
  ];
  // language heuristic
  const useEn = (/\b(the|is|you|please|hello|thanks)\b/i.test(message));
  const pickUnknown = useEn ? unknownEn[Math.floor(Math.random()*unknownEn.length)] : unknownPt[Math.floor(Math.random()*unknownPt.length)];
  return { reply: pickUnknown };

  // use user-provided logic
  // detect simple greetings and answer with one of the generated variants
  const greetings = phrases.generateGreetings(1000);
  const simple = String(message||'').trim().toLowerCase();
  if (simple === 'oi' || simple === 'ola' || simple === 'olá' || simple === 'oie' || simple === 'hello' || simple === 'hi'){
    const pick = greetings[Math.floor(Math.random()*greetings.length)];
    return { reply: pick };
  }

  const reply = userLogicGenerate(message, context);
  return { reply };
}

module.exports = { generateReply };
