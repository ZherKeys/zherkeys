/**
 * Integração com Ollama local
 * Faz requisições para gerar código usando modelos rodando localmente
 */

const http = require('http');

const OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'mistral';
const MODELS = ['mistral', 'neural-chat', 'dolphin-mixtral', 'codellama'];

/**
 * Faz requisição para Ollama
 */
function callOllama(prompt, model = DEFAULT_MODEL) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: model,
      prompt: prompt,
      stream: false,
      temperature: 0.7,
      num_predict: 2048
    });

    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response.response || '');
        } catch (e) {
          reject(new Error(`Erro ao parsear resposta Ollama: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Ollama desconectado: ${error.message}`));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Verifica se Ollama está rodando
 */
async function isOllamaAvailable() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/tags',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.end();
  });
}

/**
 * Gera código baseado em contexto
 */
async function generateCode(prompt, model = DEFAULT_MODEL) {
  try {
    const isAvailable = await isOllamaAvailable();
    
    if (!isAvailable) {
      return {
        success: false,
        error: '❌ Ollama não está rodando. Abra outro terminal e execute: `ollama serve`'
      };
    }

    const response = await callOllama(prompt, model);
    
    if (!response) {
      return {
        success: false,
        error: 'Ollama retornou resposta vazia'
      };
    }

    return {
      success: true,
      code: response,
      model: model
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Gera código simples para testes
 */
async function generateCodeWithFallback(prompt, model = DEFAULT_MODEL) {
  const result = await generateCode(prompt, model);
  
  if (!result.success) {
    // Fallback: gera template básico se Ollama não estiver disponível
    return {
      success: false,
      error: result.error,
      template: generateCodeTemplate(prompt)
    };
  }
  
  return result;
}

/**
 * Gera template básico de código (fallback)
 */
function generateCodeTemplate(prompt) {
  return `
# TEMPLATE - Ollama não está disponível
# Para usar: inicie Ollama em outro terminal com "ollama serve"

# Requisição original: ${prompt}

# Estrutura básica:
# 1. Instale as dependências necessárias
# 2. Configure conforme sua necessidade
# 3. Teste e adapte o código

# Exemplo simples em Python:
def hello_world():
    print("Seu código aqui!")

if __name__ == "__main__":
    hello_world()
`;
}

/**
 * Cria um prompt otimizado para geração de código
 */
function createCodegenPrompt(description, context) {
  return `
## Tarefa: Gerar código
**O que fazer:** ${description}

**Contexto:**
${Object.entries(context).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

**Requisitos:**
1. Código limpo, bem comentado e funcional
2. Pronto para executar
3. Com tratamento de erros básico
4. Se for código web: HTML, CSS e JS separados
5. Se for API: estrutura adequada com exemplos

**Formato:**
Comece com \`\`\`[linguagem]
Termine com \`\`\`

Gere o código agora:
`;
}

module.exports = {
  callOllama,
  generateCode,
  generateCodeWithFallback,
  isOllamaAvailable,
  createCodegenPrompt,
  DEFAULT_MODEL,
  MODELS
};
