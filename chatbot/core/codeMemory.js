/**
 * Sistema de Memória para Código Gerado
 * O bot aprende e memoriza todo código gerado com Ollama
 */

const memory = require('./memoryManager');

const CODE_MEMORY_PREFIX = 'CODE::';
const CODE_METADATA_PREFIX = 'CODE_META::';

/**
 * Salva um código gerado na memória do bot
 */
function rememberGeneratedCode(db, userId, codeGenState, generatedCode) {
  const { type, description, answers } = codeGenState;
  
  // Chave única para este código
  const codeKey = `${CODE_MEMORY_PREFIX}${type}-${Date.now()}`;
  
  // Criar item de conhecimento
  const codeItem = {
    id: codeKey,
    query: `${type}: ${description}`, // Para busca futura
    content: generatedCode,
    tags: [type, ...Object.keys(answers)],
    metadata: {
      type,
      description,
      context: answers,
      generatedAt: Date.now(),
      userId,
      model: 'ollama-mistral'
    },
    created_at: Date.now()
  };
  
  // Adicionar à base de conhecimento
  memory.addKnowledge(codeItem);
  
  // Guardar metadados extras para busca eficiente
  const metadata = {
    id: codeKey,
    type,
    description,
    context: answers,
    generatedAt: Date.now(),
    userId
  };
  
  memory.addKnowledge({
    id: CODE_METADATA_PREFIX + codeKey,
    query: `metadata_${codeKey}`,
    content: JSON.stringify(metadata),
    created_at: Date.now()
  });
  
  return codeKey;
}

/**
 * Busca códigos anteriores similares
 */
function findSimilarCode(description, type = null) {
  // Buscar por descrição
  const results = memory.findKnowledgeByKeyword ? 
    memory.findKnowledgeByKeyword(description, 10) : [];
  
  // Filtrar por tipo se especificado
  if (type) {
    return results.filter(r => 
      r.id && r.id.startsWith(CODE_MEMORY_PREFIX) &&
      (r.metadata && r.metadata.type === type || 
       r.query && r.query.startsWith(`${type}:`))
    );
  }
  
  // Retornar apenas códigos gerados
  return results.filter(r => r.id && r.id.startsWith(CODE_MEMORY_PREFIX));
}

/**
 * Busca código por tipo
 */
function findCodeByType(type) {
  // Buscar palavras-chave relacionadas ao tipo
  const keywords = {
    'game': ['game', 'jogo', 'interactive'],
    'web': ['web', 'site', 'html', 'react', 'vue'],
    'api': ['api', 'backend', 'server', 'rest'],
    'script': ['script', 'automation', 'tool'],
    'component': ['component', 'module', 'function']
  };
  
  const searchTerms = keywords[type] || [type];
  let allResults = [];
  
  for (const term of searchTerms) {
    const results = memory.findKnowledgeByKeyword ? 
      memory.findKnowledgeByKeyword(term, 20) : [];
    allResults = allResults.concat(results);
  }
  
  // Remover duplicatas
  const seen = new Set();
  const unique = allResults.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  
  return unique.filter(r => r.id && r.id.startsWith(CODE_MEMORY_PREFIX));
}

/**
 * Gera um resumo do código memorizado
 */
function getCodeSummary(codeItem) {
  if (!codeItem) return null;
  
  const lines = String(codeItem.content || '').split('\n');
  const summary = {
    description: codeItem.query,
    language: detectLanguage(codeItem.content),
    lines: lines.length,
    preview: lines.slice(0, 5).join('\n') + (lines.length > 5 ? '\n...' : '')
  };
  
  return summary;
}

/**
 * Detecta linguagem do código
 */
function detectLanguage(code) {
  const codeStr = String(code || '').toLowerCase();
  
  if (codeStr.includes('```python') || codeStr.match(/^from |^import |def |import pygame/m)) return 'Python';
  if (codeStr.includes('```javascript') || codeStr.includes('```js') || codeStr.match(/const |let |function |console.log/m)) return 'JavaScript';
  if (codeStr.includes('```html') || codeStr.includes('```html') || codeStr.match(/<html|<div|<body/)) return 'HTML/CSS/JS';
  if (codeStr.match(/class.*:|def /)) return 'Python';
  if (codeStr.match(/function |const.*=>|let /)) return 'JavaScript';
  if (codeStr.match(/public class |private |protected /)) return 'Java';
  if (codeStr.match(/async def|import asyncio/)) return 'Python (Async)';
  
  return 'Unknown';
}

/**
 * Retorna estatísticas de aprendizado
 */
function getLearningStats(db) {
  // Buscar todos os códigos memorizados
  const knowledge = memory.findKnowledgeByKeyword ? 
    memory.findKnowledgeByKeyword('', 500) : [];
  
  const codes = knowledge.filter(k => k.id && k.id.startsWith(CODE_MEMORY_PREFIX));
  
  // Agrupar por tipo
  const byType = {};
  const languages = {};
  
  for (const code of codes) {
    const type = code.query?.split(':')[0] || 'unknown';
    const lang = detectLanguage(code.content);
    
    byType[type] = (byType[type] || 0) + 1;
    languages[lang] = (languages[lang] || 0) + 1;
  }
  
  return {
    totalCodes: codes.length,
    byType,
    byLanguage: languages,
    createdAt: Date.now()
  };
}

/**
 * Cria uma resposta inteligente baseada em memória
 */
function buildMemoryResponse(type, description, context) {
  const similar = findSimilarCode(description, type);
  
  if (similar.length === 0) {
    return {
      hasMemory: false,
      message: `Vou gerar um novo código ${type} para: ${description}`
    };
  }
  
  // Encontrou algo similar na memória!
  const best = similar[0];
  const summary = getCodeSummary(best);
  
  return {
    hasMemory: true,
    message: `🧠 Lembrei! Tenho um ${type} similar na minha memória!\n\n📝 ${summary.description}\n💾 ${summary.language} (${summary.lines} linhas)`,
    suggestion: `Quer usar o código anterior ou gerar um novo?`,
    existingCode: best,
    existingCodeId: best.id
  };
}

/**
 * Exporta estatísticas em texto formatado
 */
function formatStats(stats) {
  let text = `
📊 ESTATÍSTICAS DE APRENDIZADO DO BOT

Total de Códigos Memorizados: ${stats.totalCodes}

Por Tipo:
${Object.entries(stats.byType).map(([type, count]) => `  • ${type}: ${count}`).join('\n')}

Por Linguagem:
${Object.entries(stats.byLanguage).map(([lang, count]) => `  • ${lang}: ${count}`).join('\n')}

O seu bot aprendeu muito! 🤖
`;
  return text;
}

module.exports = {
  rememberGeneratedCode,
  findSimilarCode,
  findCodeByType,
  getCodeSummary,
  detectLanguage,
  getLearningStats,
  buildMemoryResponse,
  formatStats
};
