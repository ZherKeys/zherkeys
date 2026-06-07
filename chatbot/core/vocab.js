const phrases = require('./phrases');

const bases = [
  'pão', 'arroz', 'feijão', 'carne', 'frango', 'peixe', 'macarrão', 'salada', 'sopa', 'bolo',
  'água', 'café', 'chá', 'leite', 'queijo', 'manteiga', 'ovos', 'fruta', 'banana', 'maçã',
  'cidade', 'rua', 'casa', 'apartamento', 'cozinha', 'quarto', 'banheiro', 'escola', 'trabalho', 'escritório',
  'computador', 'celular', 'internet', 'jogo', 'filme', 'música', 'livro', 'história', 'programação', 'python',
  'javascript', 'node', 'express', 'site', 'rede', 'segurança', 'senha', 'conta', 'email', 'perfil',
  'viagem', 'praia', 'montanha', 'hotel', 'passagem', 'carro', 'ônibus', 'trem', 'avião', 'rota',
  'amigo', 'família', 'mãe', 'pai', 'filho', 'irmão', 'namorado', 'namorada', 'parceiro', 'colega',
  'amor', 'felicidade', 'tristeza', 'raiva', 'medo', 'saúde', 'doença', 'consulta', 'hospital', 'remédio',
  'dinheiro', 'preço', 'compra', 'venda', 'loja', 'mercado', 'desconto', 'cartão', 'pagamento', 'boleto'
];

const vocab = bases;

const templates = {
  pt: {
    food: [
      'Você mencionou {w} — quer receita, curiosidade ou algo prático sobre isso?',
      'Sobre {w}: o que exatamente você quer saber?'
    ],
    tech: [
      'Quer uma explicação técnica de {w} ou um exemplo prático?',
      'Posso falar de {w} em nível básico ou avançado — qual prefere?'
    ],
    travel: [
      'Quer dicas de viagem envolvendo {w}?',
      'Posso sugerir ideias com base em {w} — prefere econômico ou confortável?'
    ],
    general: [
      'Você citou {w} — quer que eu explique o básico ou aprofunde algum ponto?',
      'Sobre {w}: me diga o que você precisa (definição, exemplo, passo a passo).'
    ]
  },
  en: {
    food: ['You mentioned {w} — recipe, facts, or practical tips?'],
    tech: ['Want a technical explanation of {w} or a practical example?'],
    travel: ['Need travel tips related to {w}?'],
    general: ['You mentioned {w} — definition, example, or step-by-step?']
  }
};

function categorize(word) {
  const w = String(word).toLowerCase();
  const foodKeys = ['pão', 'arroz', 'feijão', 'carne', 'frango', 'peixe', 'macarrão', 'salada', 'sopa', 'bolo', 'queijo', 'leite', 'fruta', 'banana', 'maçã'];
  const techKeys = ['computador', 'celular', 'internet', 'programação', 'python', 'javascript', 'node', 'express', 'site', 'rede', 'senha'];
  const travelKeys = ['cidade', 'rua', 'praia', 'hotel', 'viagem', 'avião', 'trem', 'ônibus', 'carro'];
  for (const k of foodKeys) if (w.includes(k)) return 'food';
  for (const k of techKeys) if (w.includes(k)) return 'tech';
  for (const k of travelKeys) if (w.includes(k)) return 'travel';
  return 'general';
}

function findVocabMatches(text) {
  if (!text) return [];
  const tokens = phrases.tokenize(text);
  if (!tokens.length) return [];
  const matches = [];
  for (const w of vocab) {
    const lw = w.toLowerCase();
    const wTokens = lw.split(/\s+/).filter(Boolean);
    let matched = false;
    if (wTokens.length === 1) {
      const tok = wTokens[0];
      if (tok.length < 4) continue;
      if (tokens.includes(tok)) matched = true;
      else if (tokens.some((t) => t.length >= 4 && phrases.fuzzyMatch(t, tok))) matched = true;
    } else {
      matched = wTokens.every((wt) => tokens.includes(wt));
    }
    if (matched) matches.push(w);
    if (matches.length >= 5) break;
  }
  return matches;
}

function shouldUseVocabFollowUp(message) {
  const tokens = phrases.tokenize(message);
  if (tokens.length === 0 || tokens.length > 4) return false;
  if (/\?/.test(message)) return false;
  if (/^(me\s+conte|o\s+que|como|por\s+que|what|how|why|defina|define)\b/i.test(phrases.normalizeText(message))) return false;
  return true;
}

function pickFollowUp(word, lang = 'pt') {
  const cat = categorize(word);
  const pool = (templates[lang] && templates[lang][cat]) ? templates[lang][cat] : templates[lang].general;
  const tmpl = pool[Math.floor(Math.random() * pool.length)];
  return tmpl.replace('{w}', word);
}

module.exports = { vocab, findVocabMatches, pickFollowUp, shouldUseVocabFollowUp };
