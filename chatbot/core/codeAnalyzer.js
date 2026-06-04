/**
 * Analisador de Código Inteligente
 * Analisa, resume e explica qualquer código usando Ollama
 */

const ollama = require('./ollamaIntegration');

/**
 * Detecta se mensagem contém código
 */
function detectCode(message) {
  const text = String(message || '');
  
  // Detecta bloco de código com ```
  const codeBlockMatch = text.match(/```(\w+)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return {
      found: true,
      language: codeBlockMatch[1] || 'unknown',
      code: codeBlockMatch[2].trim(),
      type: 'block'
    };
  }
  
  // Detecta código inline (linhas com indentação ou estrutura de código)
  const lines = text.split('\n');
  const codeLines = lines.filter(l => 
    /^\s{2,}|^(function|def|class|const|let|var|import|from|async|await|return|if|for|while|try|catch)/.test(l)
  );
  
  if (codeLines.length >= 3) {
    return {
      found: true,
      language: 'unknown',
      code: codeLines.join('\n'),
      type: 'inline'
    };
  }
  
  return { found: false };
}

/**
 * Gera prompt para análise de código
 */
function buildAnalysisPrompt(language, code, analysisType = 'summary') {
  const prompts = {
    summary: `
Analise este código ${language} e faça um RESUMO BREVE:

\`\`\`${language}
${code}
\`\`\`

Responda em máximo 3 parágrafos:
1. O que o código faz? (1 parágrafo)
2. Qual é a funcionalidade principal? (1 parágrafo)
3. Entrada, saída e dependências? (1 parágrafo)

Seja direto e objetivo.
`,
    detailed: `
Analise este código ${language} de forma DETALHADA:

\`\`\`${language}
${code}
\`\`\`

Explique:
1. Propósito geral do código
2. Funções/métodos principais
3. Fluxo de execução
4. Entradas e saídas esperadas
5. Possíveis problemas ou melhorias
`,
    learning: `
Você é um professor de programação. Explique este código ${language} para um iniciante:

\`\`\`${language}
${code}
\`\`\`

Explique:
1. O que cada parte faz?
2. Por que foi escrito assim?
3. Conceitos importantes?
4. Como usar este código?
`,
    optimization: `
Você é um especialista em otimização. Analise este código ${language}:

\`\`\`${language}
${code}
\`\`\`

Forneça:
1. Problemas de performance
2. Melhorias possíveis
3. Complexidade de tempo e espaço
4. Sugestões de refatoração
`,
    security: `
Você é um especialista em segurança. Analise este código ${language}:

\`\`\`${language}
${code}
\`\`\`

Identifique:
1. Vulnerabilidades de segurança
2. Inputs validados?
3. Tratamento de erros
4. Melhorias recomendadas
`
  };
  
  return prompts[analysisType] || prompts.summary;
}

/**
 * Detecta a linguagem do código
 */
function detectLanguage(code) {
  const codeStr = String(code || '').toLowerCase();
  
  if (codeStr.match(/^import |^from |def |class |\.py:|python/m)) return 'Python';
  if (codeStr.match(/const |let |function |=>|\.js:|async|await/m)) return 'JavaScript';
  if (codeStr.match(/public class |private |protected |import java/m)) return 'Java';
  if (codeStr.match(/function|procedure|begin|end;|pascal/m)) return 'Pascal';
  if (codeStr.match(/<\?php|=>|\$[a-zA-Z_]/m)) return 'PHP';
  if (codeStr.match(/#include|int main|cout|cin|c\+\+/m)) return 'C++';
  if (codeStr.match(/#include|int main|printf|scanf/m)) return 'C';
  if (codeStr.match(/public static void|class |interface /m)) return 'Java';
  if (codeStr.match(/def |class |import |python/m)) return 'Python';
  if (codeStr.match(/<html|<body|<div|<!DOCTYPE/m)) return 'HTML/CSS';
  if (codeStr.match(/\.sql:|SELECT|INSERT|UPDATE|DELETE|FROM/m)) return 'SQL';
  if (codeStr.match(/go run|package main|func /m)) return 'Go';
  if (codeStr.match(/fn |let |mut |rust/m)) return 'Rust';
  
  return 'unknown';
}

/**
 * Analisa código com Ollama
 */
async function analyzeCode(code, analysisType = 'summary') {
  try {
    const language = detectLanguage(code);
    const prompt = buildAnalysisPrompt(language, code, analysisType);
    
    const result = await ollama.generateCodeWithFallback(prompt);
    
    if (result.success) {
      return {
        success: true,
        language: language,
        analysisType: analysisType,
        analysis: result.code,
        codePreview: code.substring(0, 200) + (code.length > 200 ? '...' : '')
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Formata análise para exibição
 */
function formatAnalysis(analysisResult) {
  if (!analysisResult.success) {
    return `❌ Erro ao analisar: ${analysisResult.error}`;
  }
  
  const typeEmoji = {
    summary: '📝',
    detailed: '📖',
    learning: '🎓',
    optimization: '⚡',
    security: '🔒'
  };
  
  const emoji = typeEmoji[analysisResult.analysisType] || '📊';
  
  return `
${emoji} ANÁLISE DE CÓDIGO (${analysisResult.language})

${analysisResult.analysis}

---
📄 Código analisado: ${analysisResult.codePreview}
`;
}

/**
 * Gera sugestões baseadas em análise
 */
function generateSuggestions(codeSnippet) {
  const suggestions = [];
  
  const code = String(codeSnippet || '').toLowerCase();
  
  // Detectar problemas comuns
  if (code.includes('eval(')) suggestions.push('⚠️ Evite usar eval() - risco de segurança');
  if (code.match(/while\s*\(\s*true\s*\)/)) suggestions.push('⚠️ Loop infinito detectado');
  if (code.includes('console.log') && code.includes('production')) suggestions.push('⚠️ Remove console.log em produção');
  if (!code.includes('try') && code.includes('error')) suggestions.push('⚠️ Considere adicionar try-catch');
  if (code.includes('TODO') || code.includes('FIXME')) suggestions.push('⚠️ Código com TODOs pendentes');
  if (code.match(/\s{20,}/)) suggestions.push('💡 Reduza indentação/complexidade');
  if (code.length > 1000) suggestions.push('💡 Código muito longo - considere dividir em funções');
  
  return suggestions;
}

module.exports = {
  detectCode,
  analyzeCode,
  detectLanguage,
  formatAnalysis,
  generateSuggestions,
  buildAnalysisPrompt
};
