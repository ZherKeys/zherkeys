// Gerador leve de frases conversacionais e utilitários de conexão de palavras
// Gera dinamicamente variações (saudações) para evitar um arquivo gigantesco.

function generateGreetings(count = 1000){
  const templates = [
    'Oi', 'Olá', 'E aí', 'Oi, tudo bem?', 'Olá, como vai?', 'Oi! Como você está?', 'Boa tarde', 'Bom dia', 'Boa noite'
  ];
  const tails = [
    '', ' tudo bem por aí?', ' como você tem passado?', ' o que manda de novo?', ' em que posso ajudar hoje?', ' prazer em te ver por aqui!'
  ];
  const moods = ['🙂','😄','😉','👍','✨',''];
  const results = [];
  let i = 0;
  while (results.length < count){
    const t = templates[i % templates.length];
    const tail = tails[(i + Math.floor(i/3)) % tails.length];
    const mood = moods[(i + 2) % moods.length];
    const variant = `${t}${tail} ${mood}`.trim();
    if (!results.includes(variant)) results.push(variant);
    i++;
    // pequenas variações adicionais
    if (results.length < count && i % 7 === 0){
      results.push(`${t} — como vai? ${mood}`);
    }
  }
  return results.slice(0, count);
}

// Constrói conexões simples entre palavras usando sinônimos e stemming muito leve
const synonyms = {
  'oi': ['olá','e aí','oii','olaa','opa'],
  'obrigado': ['valeu','brigadão','agradecido','obrg'],
  'ajuda': ['socorro','assistência','apoio','suporte'],
  'comprar': ['adquirir','compras','obter','comprando'],
  'pão': ['pao','pã','pãzinho','pães'],
  'receita': ['receitas','caderno de receitas','modo de preparo'],
  'computador': ['pc','notebook','laptop','máquina']
};

function expandTokens(text){
  if (!text) return [];
  const t = String(text).toLowerCase().replace(/[^a-zA-ZÀ-ú0-9\s]/g,' ');
  const parts = t.split(/\s+/).filter(Boolean);
  const expanded = new Set();
  for (const p of parts){
    expanded.add(p);
    if (synonyms[p]) for (const s of synonyms[p]) expanded.add(s);
    // add short stems
    if (p.length > 4) expanded.add(p.slice(0,4));
    // add fuzzy variants: double-letter, missing accent
    expanded.add(p.replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/[í]/g,'i').replace(/[óôõ]/g,'o').replace(/[ú]/g,'u'));
  }
  return Array.from(expanded);
}

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  if (!a || !b) return (a||'').length + (b||'').length;
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i=0;i<=m;i++) dp[i][0]=i;
  for (let j=0;j<=n;j++) dp[0][j]=j;
  for (let i=1;i<=m;i++){
    for (let j=1;j<=n;j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(a, b){
  if (!a || !b) return false;
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  if (a === b) return true;
  const dist = levenshtein(a,b);
  const norm = dist / Math.max(a.length, b.length);
  return norm <= 0.25; // tolerate up to 25% difference
}

// Parafraseia um item de conhecimento para ser devolvido de forma conversacional
function paraphraseKnowledge(item){
  if (!item) return '';
  const q = item.query || '';
  const c = item.content || '';
  // evita mostrar metadados; cria frases naturais
  const start = `Sobre ${q.replace(/\.|\n/g,' ').trim()}: `;
  const snippet = c.split('\n').map(s=>s.trim()).filter(Boolean).join(' ').slice(0,600);
  const ending = snippet.endsWith('.') ? '' : '.';
  return `${start}${snippet}${ending} Se quiser mais detalhes, posso aprofundar.`;
}

module.exports = { generateGreetings, expandTokens, paraphraseKnowledge, levenshtein, fuzzyMatch };
