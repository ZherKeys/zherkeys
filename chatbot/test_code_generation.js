#!/usr/bin/env node

/**
 * TESTE DO CHATBOT COM GERAÇÃO DE CÓDIGO
 * 
 * Antes de rodar isso, certifique-se de:
 * 1. Ollama rodando: ollama serve (em outro terminal)
 * 2. Servidor do chatbot rodando: npm start (em outro terminal)
 */

const http = require('http');

// Função para fazer requisição ao chatbot
async function chatWithBot(userId, message) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ userId, message });

    const options = {
      hostname: 'localhost',
      port: 3001, // Ajuste se seu servidor está em outra porta
      path: '/api/chat',
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
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Erro ao parsear: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Teste
async function runTests() {
  console.log('🚀 INICIANDO TESTES DO CHATBOT COM IA\n');
  console.log('═'.repeat(60));

  const userId = 'teste-' + Date.now();
  
  const tests = [
    {
      name: '1️⃣ Criar um jogo tipo Agar.io',
      message: 'crie um jogo agar.io em javascript'
    },
    {
      name: '2️⃣ Perguntas de contexto',
      message: 'médio' // Responde à primeira pergunta
    },
    {
      name: '3️⃣ Mais contexto',
      message: 'Phaser.js ou Babylon.js' // Segunda pergunta
    },
    {
      name: '4️⃣ Criar uma API em Python',
      message: 'crie uma api rest em python'
    },
    {
      name: '5️⃣ Criar um site',
      message: 'faça um site de portfólio'
    }
  ];

  for (const test of tests) {
    console.log(`\n${test.name}`);
    console.log('-'.repeat(60));
    console.log(`📝 Mensagem: "${test.message}"`);

    try {
      const response = await chatWithBot(userId, test.message);
      console.log(`✅ Resposta:\n${response.reply}\n`);
      
      // Aguarda um pouco entre mensagens
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✨ TESTES CONCLUÍDOS!\n');
}

runTests().catch(console.error);
