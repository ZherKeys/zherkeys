// Gerador leve de frases conversacionais e utilitários de conexão de palavras

const GREETING_RE = /^(oi|olá|ola|oie|hey|hello|hi|e\s*aí|eai|opa|fala|salve|bom\s+dia|boa\s+tarde|boa\s+noite)([\s,!?.]+|$)/i;
const SMALLTALK_RE = /^(tudo\s+bem|como\s+vai|como\s+vc\s+está|beleza|e\s+aí\??)[\s!?.,]*$/i;
const AFFIRM_RE = /^(sim|s|yes|claro|ok|pode|pode\s+ser|isso|manda|bora)[\s!?.,]*$/i;
const NEGATIVE_RE = /^(não|nao|no|cancelar|cancela|n)[\s!?.,]*$/i;
const SEARCH_RE = /\b(pesquise|pesquisa|pesquisar|busque|buscar|procure|procurar|search|look\s+up)\b/i;

function normalizeText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isGreeting(message) {
  const s = normalizeText(message);
  return GREETING_RE.test(s) || SMALLTALK_RE.test(s);
}

function isAffirmative(message) {
  return AFFIRM_RE.test(normalizeText(message));
}

function isNegative(message) {
  return NEGATIVE_RE.test(normalizeText(message));
}

function wantsSearch(message) {
  return SEARCH_RE.test(String(message || ''));
}

function tokenize(text) {
  const norm = normalizeText(text).replace(/[^a-z0-9áàâãéêíóôõúç\s]/gi, ' ');
  const parts = norm.split(/\s+/).filter(Boolean);
  return parts;
}

function generateGreetings(count = 1000) {
  const templates = [
    'Oi', 'Olá', 'E aí', 'Oi, tudo bem?', 'Olá, como vai?', 'Oi! Como você está?', 'Boa tarde', 'Bom dia', 'Boa noite'
  ];
  const tails = [
    '', ' tudo bem por aí?', ' como você tem passado?', ' o que manda de novo?', ' em que posso ajudar hoje?', ' prazer em te ver por aqui!'
  ];
  const moods = ['🙂', '😄', '😉', '👍', '✨', ''];
  const results = [];
  let i = 0;
  while (results.length < count) {
    const t = templates[i % templates.length];
    const tail = tails[(i + Math.floor(i / 3)) % tails.length];
    const mood = moods[(i + 2) % moods.length];
    const variant = `${t}${tail} ${mood}`.trim();
    if (!results.includes(variant)) results.push(variant);
    i++;
    if (results.length < count && i % 7 === 0) {
      results.push(`${t} — como vai? ${mood}`);
    }
  }
  return results.slice(0, count);
}

const synonyms = {
  oi: ['olá', 'e aí', 'oii', 'olaa', 'opa'],
  obrigado: ['valeu', 'brigadão', 'agradecido', 'obrg'],
  ajuda: ['socorro', 'assistência', 'apoio', 'suporte'],
  escola: ['colégio', 'ensino', 'estudo', 'aula'],
  sol: ['solzinho', 'astro'],
};

const STOP_TOKENS = new Set([
  'oi', 'ola', 'olá', 'hi', 'hello', 'hey', 'sim', 'nao', 'não', 'ok', 'e', 'a', 'o', 'de', 'em', 'no', 'na', 'um', 'uma', 'the', 'is', 'me', 'te', 'se', 'voce', 'você', 'pra', 'para', 'que', 'com', 'por', 'sobre', 'mais', 'muito', 'bem'
]);

function expandTokens(text) {
  if (!text) return [];
  const parts = tokenize(text);
  const expanded = new Set();
  for (const p of parts) {
    if (STOP_TOKENS.has(p) || p.length < 2) continue;
    expanded.add(p);
    if (synonyms[p]) for (const s of synonyms[p]) expanded.add(s);
    if (p.length > 4) expanded.add(p.slice(0, 4));
    expanded.add(p.replace(/[áàâã]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u'));
  }
  return Array.from(expanded);
}

function levenshtein(a, b) {
  if (!a || !b) return (a || '').length + (b || '').length;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  a = String(a).toLowerCase();
  b = String(b).toLowerCase();
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const dist = levenshtein(a, b);
  const norm = dist / Math.max(a.length, b.length);
  return norm <= 0.2;
}

function paraphraseKnowledge(item) {
  if (!item) return '';
  const q = (item.query || '').replace(/\.|\n/g, ' ').trim();
  const c = (item.content || '').trim();
  if (!c) return `Tenho uma entrada sobre "${q}", mas ainda sem detalhes. Quer me ensinar com /learn ${q}=...?`;
  const snippet = c.split('\n').map((s) => s.trim()).filter(Boolean).join(' ').slice(0, 800);
  const ending = snippet.endsWith('.') ? '' : '.';
  return `Sobre "${q}": ${snippet}${ending}`;
}

function pickGreeting(lang) {
  const pt = [
    'Oi! Sou o ZherTalk, seu assistente de programação. O que vamos codar ou corrigir hoje?',
    'Fala aí! Tudo beleza? Manda seu código que eu analiso, ou me diz qual ideia de projeto você quer tirar do papel!',
    'Olá! Estou pronto para ajudar. Quer que eu crie um script do zero, encontre um bug no seu código ou bater um papo técnico?'
  ];
  const en = [
    'Hi! I am ZherTalk — ask me anything or teach me with /learn word=explanation.',
    'Hello! How can I help you today?'
  ];
  const pool = lang === 'en' ? en : pt;
  return pool[Math.floor(Math.random() * pool.length)];
}

function detectLang(message) {
  if (/\b(the|is|you|please|hello|thanks|what|how|why)\b/i.test(message)) return 'en';
  if (/\b(quem|obrigad|olá|tudo|por|favor|como|escola)\b/i.test(message)) return 'pt';
  return 'pt';
}

module.exports = {
  generateGreetings,
  expandTokens,
  tokenize,
  paraphraseKnowledge,
  levenshtein,
  fuzzyMatch,
  isGreeting,
  isAffirmative,
  isNegative,
  wantsSearch,
  normalizeText,
  pickGreeting,
  detectLang,
  STOP_TOKENS
};
