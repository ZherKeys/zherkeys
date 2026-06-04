/**
 * Módulo de Geração de Código Inteligente
 * Detecta requisições do usuário e faz perguntas de contexto antes de gerar
 */

const CREATION_PATTERNS = {
  create: /\b(crie|cria|faça|faca|faz|implementar|implemente|desenvolva|desenvolver|construa|constrói|constroi|escreva|escreve)\b/i,
  game: /\b(jogo|game|games)\b/i,
  web: /\b(site|website|página|pagina|app|aplicativo|interface|front|html|react|vue|angular)\b/i,
  api: /\b(api|endpoint|backend|servidor|server|rota|route|rest)\b/i,
  script: /\b(script|automação|automacao|tool|ferramenta|programa|programa|utilitário|utilitario)\b/i,
  component: /\b(componente|component|widget|elemento|função|funcao|function|módulo|modulo)\b/i
};

const CONTEXT_QUESTIONS = {
  game: [
    {
      key: 'language',
      question: 'Qual linguagem? (JavaScript, Python, C#, etc)',
      followUp: 'language'
    },
    {
      key: 'complexity',
      question: 'Qual o nível de complexidade? (simples, médio, avançado)',
      followUp: 'complexity'
    },
    {
      key: 'features',
      question: 'Quais features principais? (ex: multiplayer, save/load, leaderboard, physics)',
      followUp: 'features'
    },
    {
      key: 'framework',
      question: 'Quer usar algum framework? (Phaser, Babylon.js, Unity, Godot, etc) ou vanilla?',
      followUp: 'framework'
    }
  ],
  web: [
    {
      key: 'language',
      question: 'Qual linguagem? (HTML/CSS/JS, React, Vue, Angular, Next.js, etc)',
      followUp: 'language'
    },
    {
      key: 'features',
      question: 'Quais features? (formulário, galeria, CRUD, autenticação, etc)',
      followUp: 'features'
    },
    {
      key: 'style',
      question: 'Qual estilo? (moderno, minimalista, corporativo, etc)',
      followUp: 'style'
    },
    {
      key: 'responsive',
      question: 'Precisa ser responsivo (funcionar em mobile)?',
      followUp: 'responsive'
    }
  ],
  api: [
    {
      key: 'language',
      question: 'Qual linguagem? (Node.js, Python, Java, C#, Go, etc)',
      followUp: 'language'
    },
    {
      key: 'database',
      question: 'Qual banco de dados? (MongoDB, PostgreSQL, MySQL, SQLite, etc)',
      followUp: 'database'
    },
    {
      key: 'features',
      question: 'Quais features? (autenticação, validação, paginação, cache, etc)',
      followUp: 'features'
    },
    {
      key: 'scale',
      question: 'Escala esperada? (hobby, pequeno projeto, produção)',
      followUp: 'scale'
    }
  ],
  script: [
    {
      key: 'language',
      question: 'Qual linguagem? (Python, JavaScript/Node.js, Bash, PowerShell, etc)',
      followUp: 'language'
    },
    {
      key: 'purpose',
      question: 'Qual é o propósito específico? (ex: processar arquivos, fazer web scraping, automação)',
      followUp: 'purpose'
    },
    {
      key: 'input',
      question: 'Qual é a entrada/dados? (arquivo, API, usuário, etc)',
      followUp: 'input'
    },
    {
      key: 'output',
      question: 'Qual é a saída esperada? (arquivo, console, banco de dados, etc)',
      followUp: 'output'
    }
  ],
  component: [
    {
      key: 'language',
      question: 'Qual linguagem? (JavaScript, Python, Java, C#, etc)',
      followUp: 'language'
    },
    {
      key: 'framework',
      question: 'Qual framework/ambiente? (React, Vue, Angular, Django, etc) ou vanilla?',
      followUp: 'framework'
    },
    {
      key: 'functionality',
      question: 'Qual é a funcionalidade principal? (ex: carrinho de compras, contador, lista de tarefas)',
      followUp: 'functionality'
    },
    {
      key: 'dependencies',
      question: 'Pode usar bibliotecas externas ou precisa ser puro?',
      followUp: 'dependencies'
    }
  ]
};

/**
 * Detecta tipo de requisição de criação
 */
function detectCreationType(text) {
  const t = String(text || '').toLowerCase();
  
  if (!CREATION_PATTERNS.create.test(t)) return null;
  
  if (CREATION_PATTERNS.game.test(t)) return 'game';
  if (CREATION_PATTERNS.web.test(t)) return 'web';
  if (CREATION_PATTERNS.api.test(t)) return 'api';
  if (CREATION_PATTERNS.script.test(t)) return 'script';
  if (CREATION_PATTERNS.component.test(t)) return 'component';
  
  return 'component'; // default
}

/**
 * Extrai descrição breve da requisição
 */
function extractDescription(text) {
  const t = String(text || '').trim();
  // Remove padrões comuns
  return t
    .replace(/^(crie|cria|faça|faca|faz|implementar|implemente|desenvolva|construa)\s+/i, '')
    .replace(/\s+(em|usando|com|para)\s+.*/i, '')
    .slice(0, 100)
    .trim();
}

/**
 * Inicializa estado de geração de código
 */
function initCodeGeneration(userId, type, description) {
  return {
    userId,
    type,
    description,
    stage: 'gathering_context',
    currentQuestionIndex: 0,
    answers: {},
    startedAt: Date.now()
  };
}

/**
 * Retorna próxima pergunta de contexto
 */
function getNextContextQuestion(genState) {
  const questions = CONTEXT_QUESTIONS[genState.type] || [];
  
  if (genState.currentQuestionIndex >= questions.length) {
    return null; // Todas as perguntas foram feitas
  }
  
  return questions[genState.currentQuestionIndex];
}

/**
 * Processa resposta do usuário e salva contexto
 */
function processContextAnswer(genState, userAnswer) {
  const questions = CONTEXT_QUESTIONS[genState.type] || [];
  const currentQuestion = questions[genState.currentQuestionIndex];
  
  if (!currentQuestion) return false;
  
  genState.answers[currentQuestion.key] = userAnswer;
  genState.currentQuestionIndex++;
  
  return true;
}

/**
 * Verifica se já tem contexto suficiente
 */
function hasEnoughContext(genState) {
  const questions = CONTEXT_QUESTIONS[genState.type] || [];
  return genState.currentQuestionIndex >= questions.length;
}

/**
 * Detecta se mensagem é resposta para o contexto
 */
function isContextResponse(text, genState) {
  if (!genState || genState.stage !== 'gathering_context') return false;
  
  const t = String(text || '').trim();
  return t.length > 0 && !t.startsWith('/');
}

/**
 * Gera prompt para o modelo de IA baseado em contexto
 */
function buildCodePrompt(genState) {
  const { type, description, answers } = genState;
  
  let prompt = '';
  
  if (type === 'game') {
    prompt = `
Você é um desenvolvedor de jogos experiente. Crie um código para um jogo com as seguintes especificações:

**Descrição:** ${description}
**Linguagem:** ${answers.language || 'não especificada'}
**Complexidade:** ${answers.complexity || 'média'}
**Features principais:** ${answers.features || 'não especificadas'}
**Framework/Engine:** ${answers.framework || 'vanilla/sem framework específico'}

Por favor, gere:
1. Código limpo e bem estruturado
2. Com comentários explicativos
3. Pronto para rodar
4. Com instruções de como usar

Comece com \`\`\`[linguagem]\n no início e termine com \`\`\` no final.
`;
  } else if (type === 'web') {
    prompt = `
Você é um desenvolvedor web experiente. Crie uma página/aplicação web com as seguintes especificações:

**Descrição:** ${description}
**Tecnologia:** ${answers.language || 'não especificada'}
**Features:** ${answers.features || 'não especificadas'}
**Estilo:** ${answers.style || 'moderno'}
**Responsivo:** ${answers.responsive || 'sim'}

Por favor, gere:
1. Código HTML/CSS/JS completo e funcional
2. Estrutura bem organizada
3. Responsivo para mobile
4. Pronto para usar

Comece com \`\`\`html\n no início e termine com \`\`\` no final.
`;
  } else if (type === 'api') {
    prompt = `
Você é um desenvolvedor backend experiente. Crie uma API com as seguintes especificações:

**Descrição:** ${description}
**Linguagem:** ${answers.language || 'não especificada'}
**Banco de dados:** ${answers.database || 'não especificado'}
**Features:** ${answers.features || 'não especificadas'}
**Escala:** ${answers.scale || 'pequeno projeto'}

Por favor, gere:
1. Estrutura de pasta adequada
2. Endpoints bem definidos
3. Validações e tratamento de erros
4. Exemplos de requisições
5. Instruções de setup

Comece com \`\`\`[linguagem]\n no início e termine com \`\`\` no final.
`;
  } else if (type === 'script') {
    prompt = `
Você é um desenvolvedor de scripts experiente. Crie um script com as seguintes especificações:

**Descrição:** ${description}
**Linguagem:** ${answers.language || 'não especificada'}
**Propósito:** ${answers.purpose || 'não especificado'}
**Entrada:** ${answers.input || 'não especificada'}
**Saída:** ${answers.output || 'não especificada'}

Por favor, gere:
1. Script funcional e bem comentado
2. Tratamento de erros
3. Instruções de uso
4. Exemplos de execução

Comece com \`\`\`[linguagem]\n no início e termine com \`\`\` no final.
`;
  } else {
    prompt = `
Você é um desenvolvedor experiente. Crie um componente/módulo com as seguintes especificações:

**Descrição:** ${description}
**Linguagem:** ${answers.language || 'não especificada'}
**Framework:** ${answers.framework || 'vanilla'}
**Funcionalidade:** ${answers.functionality || 'não especificada'}
**Dependências:** ${answers.dependencies || 'pode usar bibliotecas'}

Por favor, gere:
1. Código limpo e reutilizável
2. Bem comentado
3. Com exemplos de uso
4. Pronto para integrar

Comece com \`\`\`[linguagem]\n no início e termine com \`\`\` no final.
`;
  }
  
  return prompt;
}

module.exports = {
  detectCreationType,
  extractDescription,
  initCodeGeneration,
  getNextContextQuestion,
  processContextAnswer,
  hasEnoughContext,
  isContextResponse,
  buildCodePrompt,
  CONTEXT_QUESTIONS
};
