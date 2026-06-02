// Gera um vocabulário sintético de ~1000 entradas e templates de follow-up
function generateVocabulary(count = 2000){
  const bases = [
    'pão','arroz','feijão','carne','frango','peixe','macarrão','salada','sopa','bolo',
    'água','café','chá','leite','queijo','manteiga','ovos','fruta','banana','maçã',
    'cidade','rua','casa','apartamento','cozinha','quarto','banheiro','escola','trabalho','escritório',
    'computador','celular','internet','jogo','filme','música','livro','história','programação','python',
    'javascript','node','express','site','rede','segurança','senha','conta','email','perfil',
    'viagem','praia','montanha','hotel','passagem','carro','ônibus','trem','avião','rota',
    'amigo','família','mãe','pai','filho','irmão','namorado','namorada','parceiro','colega',
    'amor','felicidade','tristeza','raiva','medo','saúde','doença','consulta','hospital','remédio',
    'dinheiro','preço','compra','venda','loja','mercado','desconto','cartão','pagamento','boleto'
  ];

  const modifiers = ['doce','salgado','frito','assado','grande','pequeno','velho','novo','rápido','lento'];
  const results = new Set(bases);
  let i = 0;
  while (results.size < count){
    const a = bases[i % bases.length];
    const m = modifiers[(i + Math.floor(i/5)) % modifiers.length];
    results.add(`${a} ${m}`);
    results.add(`${m} ${a}`);
    results.add(`${a}-${m}`);
    if (results.size < count && i % 13 === 0) results.add(`${a}zinho`);
    i++;
  }
  return Array.from(results).slice(0, count);
}

const vocab = generateVocabulary(1000);

const phrases = require('./phrases');

// Map of templates per language and category
const templates = {
  pt: {
    food: [
      'Me conte mais sobre {w}.',
      'Interessante — o que você quer saber sobre {w}?',
      'Quer uma receita com {w}?',
      'Você costuma usar {w} com frequência?',
      'Por que o {w} é importante pra você?'
    ],
    tech: [
      'Você quer saber como o {w} funciona?',
      'Quer uma explicação técnica de {w}?',
      'Posso dar um exemplo prático sobre {w}. Deseja isso?'
    ],
    travel: [
      'Quer dicas de viagem envolvendo {w}?',
      'Posso sugerir roteiros com base em {w}.',
      'Prefere opções econômicas ou confortáveis para {w}?'    
    ],
    general: [
      'Me conte mais sobre {w}.',
      'O que exatamente você quer saber sobre {w}?',
      'Isso soa interessante — quer que eu aprofunde?'
    ]
  },
  en: {
    food: [
      'Tell me more about {w}.',
      'Would you like a recipe using {w}?',
      'Do you usually cook with {w} ?'
    ],
    tech: [
      'Do you want to know how {w} works?',
      'I can give a technical explanation of {w}, want that?'
    ],
    travel: [
      'Need travel tips related to {w}?',
      'I can suggest itineraries involving {w}.'
    ],
    general: [
      'Tell me more about {w}.',
      'What exactly would you like to know about {w}?'
    ]
  }
};

function findVocabMatches(text){
  if (!text) return [];
  const t = String(text).toLowerCase();
  const tokens = phrases.expandTokens(t);
  const matches = [];
  for (const w of vocab){
    const lw = w.toLowerCase();
    // exact substring
    if (t.includes(lw)) { matches.push(w); }
    else {
      // token intersection
      let found = false;
      for (const tok of tokens){
        if (lw.includes(tok) || tok.includes(lw) || phrases.fuzzyMatch(lw, tok)) { matches.push(w); found = true; break; }
      }
      if (found) { /* already added */ }
    }
    if (matches.length >= 8) break;
  }
  return matches;
}

function categorize(word){
  const w = String(word).toLowerCase();
  const foodKeys = ['pão','arroz','feijão','carne','frango','peixe','macarrão','salada','sopa','bolo','queijo','leite','bolo','fruta','banana','maçã'];
  const techKeys = ['computador','celular','internet','programação','python','javascript','node','express','site','rede','senha'];
  const travelKeys = ['cidade','rua','praia','hotel','viagem','avião','trem','ônibus','carro'];
  for (const k of foodKeys) if (w.includes(k)) return 'food';
  for (const k of techKeys) if (w.includes(k)) return 'tech';
  for (const k of travelKeys) if (w.includes(k)) return 'travel';
  return 'general';
}

function pickFollowUp(word, lang='pt'){
  const cat = categorize(word);
  const pool = (templates[lang] && templates[lang][cat]) ? templates[lang][cat] : templates[lang].general;
  const tmpl = pool[Math.floor(Math.random()*pool.length)];
  return tmpl.replace('{w}', word);
}

module.exports = { vocab, findVocabMatches, pickFollowUp };
