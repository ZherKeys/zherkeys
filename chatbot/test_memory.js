#!/usr/bin/env node

/**
 * TESTE DO SISTEMA DE MEMÓRIA DO BOT
 * 
 * Testa:
 * 1. Geração de código com memória
 * 2. Detecção de código similar
 * 3. Comandos de memória
 */

const http = require('http');

async function chat(userId, message) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ userId, message });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  console.log('🧠 TESTE DO SISTEMA DE MEMÓRIA\n');
  console.log('═'.repeat(70));

  const userId = 'test-memory-' + Date.now();
  
  const tests = [
    {
      name: '1️⃣ Gerar primeiro jogo',
      msg: 'crie um jogo type racer em javascript'
    },
    {
      name: '2️⃣ Responder: complexidade',
      msg: 'simples'
    },
    {
      name: '3️⃣ Responder: features',
      msg: 'singleplayer, competição local'
    },
    {
      name: '4️⃣ Responder: framework',
      msg: 'vanilla sem frameworks'
    },
    {
      name: '5️⃣ Ver estatísticas',
      msg: '/memoria'
    },
    {
      name: '6️⃣ Listar códigos',
      msg: '/codigos'
    },
    {
      name: '7️⃣ Gerar jogo similar (deve detectar memória)',
      msg: 'faça um jogo tipo racing em javascript'
    },
    {
      name: '8️⃣ Rejeitar memória e gerar novo',
      msg: 'não'
    },
    {
      name: '9️⃣ Ver memória atualizada',
      msg: '/memoria'
    }
  ];

  for (const test of tests) {
    console.log(`\n${test.name}`);
    console.log('-'.repeat(70));
    console.log(`📝 Mensagem: "${test.msg}"`);

    try {
      const response = await chat(userId, test.msg);
      const reply = response.reply || response;
      
      // Truncar resposta longa
      const preview = reply.length > 300 ? 
        reply.substring(0, 300) + '\n... (truncado)' : 
        reply;
      
      console.log(`\n✅ Resposta:\n${preview}\n`);
      
      // Aguardar entre mensagens
      await sleep(2000);
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✨ TESTE CONCLUÍDO!\n');
  console.log('📊 Comandos úteis:');
  console.log('  /memoria     → Ver estatísticas');
  console.log('  /codigos     → Listar códigos gerados');
  console.log('  /buscar TYPE → Buscar por tipo\n');
}

runTests().catch(console.error);
