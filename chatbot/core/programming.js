/**
 * Assistente de programação local (sem API externa).
 * Monta exercícios, explica conceitos e ajuda a resolver/debugar código.
 */

const LANG_MAP = {
  python: ['python', 'py'],
  javascript: ['javascript', 'js', 'node', 'nodejs'],
  java: ['java'],
  csharp: ['c#', 'csharp', 'dotnet'],
  cpp: ['c++', 'cpp'],
  c: ['c '],
  html: ['html'],
  css: ['css'],
  sql: ['sql']
};

const PROG_SIGNAL =
  /\b(código|codigo|programa|programação|programacao|algoritmo|função|funcao|variável|variavel|loop|array|lista|debug|erro de|syntax|compilar|implementar|script|api|backend|frontend|classe|objeto|recursão|recursao|complexidade|big o|leetcode|exercício|exercicio|desafio|def|function|class|import|const|let|var|return|print|console\.log|fizzbuzz|fibonacci|fatorial)\b|```/i;

const TOPIC_ALIASES = {
  loop: ['loop', 'laço', 'laco', 'for', 'while', 'repetição', 'repeticao'],
  array: ['array', 'lista', 'vetor', 'matriz'],
  string: ['string', 'texto', 'palavra', 'caractere'],
  function: ['função', 'funcao', 'function', 'método', 'metodo'],
  conditional: ['if', 'else', 'condição', 'condicao', 'ternário', 'ternario'],
  recursion: ['recursão', 'recursao', 'recursiv'],
  oop: ['classe', 'objeto', 'poo', 'oop', 'herança', 'heranca'],
  file: ['arquivo', 'file', 'leitura', 'escrita'],
  api: ['api', 'rest', 'fetch', 'axios', 'endpoint']
};

const PROBLEM_BANK = [
  {
    id: 'sum-array',
    topics: ['array', 'loop'],
    difficulty: 'facil',
  },
  {
    id: 'max-array',
    topics: ['array', 'loop'],
    difficulty: 'facil',
  },
  {
    id: 'reverse-string',
    topics: ['string', 'loop'],
    difficulty: 'facil',
  },
  {
    id: 'fizzbuzz',
    topics: ['loop', 'conditional'],
    difficulty: 'facil',
  },
  {
    id: 'even-odd',
    topics: ['conditional'],
    difficulty: 'facil',
  },
  {
    id: 'factorial',
    topics: ['loop', 'recursion', 'function'],
    difficulty: 'medio',
  },
  {
    id: 'fibonacci',
    topics: ['loop', 'recursion', 'array'],
    difficulty: 'medio',
  },
  {
    id: 'palindrome',
    topics: ['string', 'loop'],
    difficulty: 'medio',
  },
  {
    id: 'count-vowels',
    topics: ['string', 'loop'],
    difficulty: 'facil',
  },
  {
    id: 'binary-search',
    topics: ['array', 'loop'],
    difficulty: 'medio',
  },
  {
    id: 'two-sum',
    topics: ['array', 'loop'],
    difficulty: 'medio',
  },
  {
    id: 'class-bank-account',
    topics: ['oop'],
    difficulty: 'medio',
  }
];

const STATEMENTS = {
  'sum-array': {
    title: 'Soma de uma lista',
    pt: 'Escreva um programa que leia uma lista de números inteiros e imprima a soma total.',
    examples: 'Entrada: [1, 2, 3, 4]\nSaída: 10',
    hints: ['Use um acumulador (soma = 0).', 'Percorra cada elemento com for ou for...of.']
  },
  'max-array': {
    title: 'Maior valor da lista',
    pt: 'Dada uma lista de inteiros, retorne o maior número. Lista não vazia.',
    examples: 'Entrada: [3, 9, 1, 4]\nSaída: 9',
    hints: ['Guarde o maior visto até agora.', 'Compare elemento a elemento.']
  },
  'reverse-string': {
    title: 'Inverter texto',
    pt: 'Receba uma string e retorne ela invertida.',
    examples: 'Entrada: "abc"\nSaída: "cba"',
    hints: ['Pode usar dois índices (início e fim) ou construir string nova.']
  },
  fizzbuzz: {
    title: 'FizzBuzz',
    pt: 'Para números de 1 a n: múltiplo de 3 imprime "Fizz", de 5 "Buzz", de ambos "FizzBuzz", senão o número.',
    examples: 'n=5 → 1, 2, Fizz, 4, Buzz',
    hints: ['Teste divisibilidade com % (resto zero).', 'Cuidado com o caso 15 (ambos).']
  },
  'even-odd': {
    title: 'Par ou ímpar',
    pt: 'Leia um inteiro n e diga se é par ou ímpar.',
    examples: 'Entrada: 7 → Saída: ímpar',
    hints: ['n % 2 === 0 (JS) ou n % 2 == 0 (Python) indica par.']
  },
  factorial: {
    title: 'Fatorial',
    pt: 'Calcule n! (fatorial de n) para n >= 0.',
    examples: '5! = 120',
    hints: ['Iterativo: multiplique de 1 até n.', 'Recursivo: n! = n * (n-1)!, base 0! = 1.']
  },
  fibonacci: {
    title: 'Fibonacci',
    pt: 'Retorne os primeiros n números da sequência de Fibonacci (começando em 0, 1).',
    examples: 'n=6 → 0, 1, 1, 2, 3, 5',
    hints: ['Cada termo é soma dos dois anteriores.', 'Cuidado com n=0 e n=1.']
  },
  palindrome: {
    title: 'Palíndromo',
    pt: 'Verifique se uma palavra é palíndromo (lê igual de trás para frente). Ignore maiúsculas.',
    examples: '"Ana" → true, "java" → false',
    hints: ['Compare com a versão invertida ou use dois índices.']
  },
  'count-vowels': {
    title: 'Contar vogais',
    pt: 'Conte quantas vogais (a,e,i,o,u) existem em um texto.',
    examples: '"programacao" → 5',
    hints: ['Percorra caractere a caractere.', 'Use conjunto ou includes de vogais.']
  },
  'binary-search': {
    title: 'Busca binária',
    pt: 'Em um array ORDENADO de inteiros, encontre o índice de target ou -1 se não existir.',
    examples: 'arr=[1,3,5,7], target=5 → índice 2',
    hints: ['left/right e meio = floor((l+r)/2).', 'Complexidade O(log n).']
  },
  'two-sum': {
    title: 'Two Sum (índices)',
    pt: 'Dado array de inteiros e um alvo, retorne índices de dois números que somam o alvo (existe uma solução).',
    examples: 'nums=[2,7,11,15], alvo=9 → [0,1]',
    hints: ['Força bruta: dois loops.', 'Melhor: hash map guardando valor→índice.']
  },
  'class-bank-account': {
    title: 'Classe Conta Bancária',
    pt: 'Modele uma conta com depositar, sacar e saldo. Não permita saldo negativo.',
    examples: 'depositar(100), sacar(30) → saldo 70',
    hints: ['Atributo privado saldo.', 'Validar saque antes de subtrair.']
  }
};

const SOLUTIONS = {
  python: {
    'sum-array': `def soma_lista(nums):
    total = 0
    for n in nums:
        total += n
    return total`,
    fizzbuzz: `def fizzbuzz(n):
    for i in range(1, n + 1):
        if i % 15 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)`,
    'reverse-string': `def inverter(s):
    return s[::-1]`,
    factorial: `def fatorial(n):
    if n <= 1:
        return 1
    return n * fatorial(n - 1)`,
    fibonacci: `def fib(n):
    a, b = 0, 1
    out = []
    for _ in range(n):
        out.append(a)
        a, b = b, a + b
    return out`
  },
  javascript: {
    'sum-array': `function somaLista(nums) {
  return nums.reduce((acc, n) => acc + n, 0);
}`,
    fizzbuzz: `function fizzBuzz(n) {
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) console.log('FizzBuzz');
    else if (i % 3 === 0) console.log('Fizz');
    else if (i % 5 === 0) console.log('Buzz');
    else console.log(i);
  }
}`,
    'reverse-string': `function inverter(s) {
  return s.split('').reverse().join('');
}`,
    factorial: `function fatorial(n) {
  if (n <= 1) return 1;
  return n * fatorial(n - 1);
}`,
    fibonacci: `function fib(n) {
  const out = [];
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) {
    out.push(a);
    [a, b] = [b, a + b];
  }
  return out;
}`
  }
};

const CONCEPT_GUIDES = {
  loop: {
    pt: 'Loops repetem um bloco enquanto uma condição for verdadeira. Use quando precisar percorrer listas ou repetir N vezes.',
    tips: ['for: sabe quantas voltas.', 'while: para até condição mudar.', 'Evite loop infinito sem break.']
  },
  array: {
    pt: 'Arrays/listas guardam vários valores em ordem. Acesso por índice (0-based na maioria das linguagens).',
    tips: ['Percorra com for ou métodos (map/filter/reduce em JS).', 'Cuidado com índice fora do tamanho.']
  },
  function: {
    pt: 'Funções encapsulam lógica reutilizável. Nome claro + parâmetros + return.',
    tips: ['Uma função, uma responsabilidade.', 'Teste com casos simples e extremos (vazio, 0, negativo).']
  },
  recursion: {
    pt: 'Recursão é quando a função chama a si mesma. Sempre defina caso base.',
    tips: ['Sem caso base → estouro de pilha.', 'Compare com versão iterativa para performance.']
  },
  conditional: {
    pt: 'if/else escolhe caminhos. Em cadeias longas, considere switch ou mapa de opções.',
    tips: ['Condições mais específicas primeiro (ex.: FizzBuzz 15 antes de 3 e 5).']
  },
  oop: {
    pt: 'POO modela dados + comportamento em classes/objetos (atributos e métodos).',
    tips: ['Encapsule estado interno.', 'Métodos pequenos e nomes verbos (depositar, sacar).']
  }
};

function detectLanguage(text) {
  const t = String(text || '').toLowerCase();
  for (const [lang, keys] of Object.entries(LANG_MAP)) {
    for (const k of keys) {
      if (new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t)) return lang;
    }
  }
  const fence = t.match(/```(\w+)/);
  if (fence && LANG_MAP[fence[1]]) return fence[1];
  if (fence && SOLUTIONS[fence[1]]) return fence[1];
  return 'python';
}

function extractCode(text) {
  const m = String(text || '').match(/```(\w+)?\s*\n([\s\S]*?)```/);
  if (m) return { language: m[1] || 'python', code: m[2].trim() };
  const lines = String(text || '').split('\n');
  const codey = lines.filter((l) => /^\s*(def |function |class |import |const |let |var |for |while |if |return |print|console\.)/.test(l));
  if (codey.length >= 2) return { language: detectLanguage(text), code: codey.join('\n') };
  return null;
}

function detectTopics(text) {
  const t = phrasesNormalize(text);
  const found = [];
  for (const [topic, words] of Object.entries(TOPIC_ALIASES)) {
    if (words.some((w) => t.includes(w))) found.push(topic);
  }
  return found.length ? found : ['loop'];
}

function phrasesNormalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function isProgrammingMessage(text, state) {
  const t = String(text || '').trim();
  if (/^\/(problema|resolver|gabarito|code)\b/i.test(t)) return true;
  if (state && state.programming && state.programming.activeProblemId && /\b(gabarito|dica|resolver|solução|solucao)\b/i.test(t)) return true;
  if (extractCode(t)) return true;
  return PROG_SIGNAL.test(t);
}

function parseDifficulty(text) {
  const t = phrasesNormalize(text);
  if (/\b(difícil|dificil|hard|avançado|avancado)\b/.test(t)) return 'dificil';
  if (/\b(médio|medio|medium|intermediário|intermediario)\b/.test(t)) return 'medio';
  return 'facil';
}

function parseIntent(text, state) {
  const t = String(text || '').trim();
  if (state && state.programming && state.programming.activeProblemId) {
    if (/\b(gabarito|solução completa|solucao completa)\b/i.test(t)) return { type: 'answer' };
    if (/\b(dica|resolver)\b/i.test(t)) return { type: 'hint' };
  }
  if (/^\/problema\b/i.test(t)) return { type: 'generate', raw: t };
  if (/^\/gabarito\b/i.test(t)) return { type: 'answer' };
  if (/^\/resolver\b/i.test(t)) return { type: 'hint' };
  if (/\b(mont(e|ar)|cri(e|ar)|ger(e|ar))\b.*\b(problema|exercício|exercicio|desafio)\b/i.test(t)) return { type: 'generate' };
  if (/\b(resolv(a|er)|solução|solucao|corrij(a|ir)|debug|consert(a|ar)|arrum(a|ar))\b/i.test(t) || extractCode(t)) return { type: 'solve' };
  if (/\b(como fazer|como criar|como implementar|me explique|explica)\b/i.test(t) && PROG_SIGNAL.test(t)) return { type: 'explain' };
  if (PROG_SIGNAL.test(t)) return { type: 'explain' };
  return null;
}

function pickProblem(topics, difficulty) {
  const diff = difficulty || 'facil';
  let pool = PROBLEM_BANK.filter((p) => p.difficulty === diff);
  if (!pool.length) pool = PROBLEM_BANK.filter((p) => p.difficulty === 'medio');
  if (topics && topics.length) {
    const filtered = pool.filter((p) => p.topics.some((t) => topics.includes(t)));
    if (filtered.length) pool = filtered;
    if (topics.includes('loop')) {
      const fav = pool.find((p) => p.id === 'fizzbuzz') || pool.find((p) => p.id === 'sum-array');
      if (fav) return fav;
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatProblem(problemId, language) {
  const meta = STATEMENTS[problemId];
  if (!meta) return 'Problema não encontrado.';
  const lang = language || 'python';
  return [
    `📋 ${meta.title}`,
    '',
    meta.pt,
    '',
    'Exemplos:',
    meta.examples,
    '',
    `Linguagem sugerida: ${lang}`,
    '',
    'Envie sua solução (pode colar código entre ```) ou peça "dica".',
    'Comandos: /resolver (dica) · /gabarito (solução) · /problema (outro exercício)'
  ].join('\n');
}

function getSolution(problemId, language) {
  const lang = SOLUTIONS[language] ? language : 'python';
  const code = (SOLUTIONS[lang] && SOLUTIONS[lang][problemId]) || null;
  const meta = STATEMENTS[problemId];
  if (!code) {
    return `Gabarito em ${lang} ainda não catalogado aqui. Estrutura:\n${(meta && meta.hints) ? meta.hints.join('\n') : 'Divida em passos menores.'}`;
  }
  return `Solução de referência (${lang}):\n\`\`\`${lang}\n${code}\n\`\`\`\n\n${meta ? 'Dica de estudo: ' + meta.hints[0] : ''}`;
}

function analyzeCode(code, language, problemId) {
  const issues = [];
  const tips = [];
  const c = String(code || '');
  const open = (c.match(/\{/g) || []).length;
  const close = (c.match(/\}/g) || []).length;
  const openP = (c.match(/\(/g) || []).length;
  const closeP = (c.match(/\)/g) || []).length;
  if (open !== close) issues.push('Chaves { } possivelmente desbalanceadas.');
  if (openP !== closeP) issues.push('Parênteses ( ) possivelmente desbalanceados.');

  if (!/\b(return|print|console\.log)\b/.test(c)) tips.push('Geralmente você precisa retornar um valor (return) ou imprimir o resultado.');

  if (problemId && STATEMENTS[problemId]) {
    const meta = STATEMENTS[problemId];
    if (problemId === 'fizzbuzz' && !/%/.test(c)) tips.push('FizzBuzz costuma usar operador % (módulo).');
    if (problemId.includes('array') && !/\b(for|while|reduce|map)\b/.test(c)) tips.push('Este problema costuma percorrer a lista com loop ou reduce.');
    tips.push('Lembrete: ' + meta.hints[0]);
  }

  if (/\bvar\b/.test(c) && language === 'javascript') tips.push('Em JS moderno, prefira const/let em vez de var.');

  const positive = [];
  if (/\b(for|while|def |function )\b/.test(c)) positive.push('Estrutura de repetição/função detectada — bom caminho.');

  let reply = '';
  if (issues.length) reply += '⚠️ Possíveis problemas:\n- ' + issues.join('\n- ') + '\n\n';
  if (positive.length) reply += '✓ ' + positive.join('\n✓ ') + '\n\n';
  if (tips.length) reply += 'Sugestões:\n- ' + tips.join('\n- ');
  if (!reply) reply = 'Código parece estruturado. Teste com os exemplos do enunciado e casos extremos (vazio, zero, negativo).';
  return reply;
}

function explainConcept(topics, language, style) {
  const topic = topics[0] || 'loop';
  const guide = CONCEPT_GUIDES[topic] || CONCEPT_GUIDES.loop;
  const lang = language || 'python';
  const sample = (SOLUTIONS[lang] && SOLUTIONS[lang]['sum-array']) || '';
  let out = guide.pt + '\n\nDicas:\n- ' + guide.tips.join('\n- ');
  if (style === 'explain' || style === 'technical') {
    out += '\n\nExemplo (' + lang + '):\n```' + lang + '\n' + sample + '\n```';
  }
  return out;
}

function handleProgrammingMessage(message, state, style) {
  const intent = parseIntent(message, state);
  if (!intent) return null;

  const language = detectLanguage(message);
  if (!state.programming) state.programming = { activeProblemId: null, language: 'python', difficulty: 'facil' };
  state.language = language;

  if (intent.type === 'generate' || /^\/problema/i.test(message)) {
    const topics = detectTopics(message);
    const difficulty = parseDifficulty(message);
    const problem = pickProblem(topics, difficulty);
    state.programming.activeProblemId = problem.id;
    state.programming.difficulty = difficulty;
    state.programming.language = language;
    return { reply: formatProblem(problem.id, language), problemId: problem.id };
  }

  if (intent.type === 'answer' || (/\b(gabarito|solução completa|solucao completa)\b/i.test(message) && state.programming.activeProblemId)) {
    const pid = state.programming.activeProblemId;
    if (!pid) return { reply: 'Nenhum exercício ativo. Peça: "monte um problema de arrays" ou /problema' };
    return { reply: getSolution(pid, state.programming.language || language) };
  }

  if (intent.type === 'hint' || /\bdica\b/i.test(message)) {
    const pid = state.programming.activeProblemId;
    if (!pid) return { reply: 'Peça um problema primeiro (ex.: "crie um exercício de loop em python").' };
    const meta = STATEMENTS[pid];
    const hint = meta.hints[Math.floor(Math.random() * meta.hints.length)];
    return { reply: `💡 Dica (${meta.title}): ${hint}` };
  }

  const codeBlock = extractCode(message);
  if (intent.type === 'solve' && codeBlock) {
    const pid = state.programming.activeProblemId;
    const analysis = analyzeCode(codeBlock.code, codeBlock.language || language, pid);
    const sol = pid ? getSolution(pid, codeBlock.language || language) : '';
    return {
      reply: analysis + (/\bgabarito|solução completa\b/i.test(message) ? '\n\n' + sol : '\n\nQuer ver o gabarito? Diga "gabarito" ou /gabarito.')
    };
  }

  if (intent.type === 'solve') {
    const pid = state.programming.activeProblemId;
    if (pid) {
      return {
        reply: `Para "${STATEMENTS[pid].title}":\n${STATEMENTS[pid].hints.join('\n')}\n\nCole seu código entre \`\`\` ou peça /gabarito.`
      };
    }
    const topics = detectTopics(message);
    return { reply: explainConcept(topics, language, style) + '\n\nQuer um exercício prático? Diga: "monte um problema de ' + (topics[0] || 'loop') + '"' };
  }

  if (intent.type === 'explain') {
    const topics = detectTopics(message);
    return { reply: explainConcept(topics, language, style) };
  }

  return null;
}

module.exports = {
  isProgrammingMessage,
  handleProgrammingMessage,
  detectLanguage,
  extractCode,
  parseIntent
};
