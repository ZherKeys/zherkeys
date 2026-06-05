const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Caminho do banco de memória do bot
const ZHER_DATA_DIR = path.join(__dirname, 'data');
const ZHER_KNOWLEDGE_FILE = path.join(ZHER_DATA_DIR, 'zhertalk_knowledge.json');

// Arquivos que contêm as novas habilidades e documentações
const arquivosParaAprender = [
    'FASE_4_COMPLETA.md',
    'chatbot/CODEGEN_README.md',
    'chatbot/MEMORY_GUIDE.md',
    'chatbot/FINAL_SUMMARY.md',
    'chatbot/core/codeAnalyzer.js',
    'chatbot/core/codeMemory.js'
];

async function transferir() {
    console.log('🧠 Iniciando transferência de conhecimento para o ZherTalk...\n');
    
    let kb = [];
    if (fs.existsSync(ZHER_KNOWLEDGE_FILE)) {
        kb = JSON.parse(fs.readFileSync(ZHER_KNOWLEDGE_FILE, 'utf8'));
    }

    let adicionados = 0;

    for (const arquivo of arquivosParaAprender) {
        const caminhoCompleto = path.join(__dirname, arquivo);
        
        if (fs.existsSync(caminhoCompleto)) {
            const conteudo = fs.readFileSync(caminhoCompleto, 'utf8');
            const titulo = `Documentação do Sistema: ${path.basename(arquivo)}`;
            
            // Verifica se o bot já tem esse conhecimento
            const jaExiste = kb.some(item => item.query === titulo);
            
            if (!jaExiste) {
                kb.unshift({ id: crypto.randomUUID(), query: titulo, content: conteudo, created_at: Date.now(), learned_via: 'script_transferencia' });
                console.log(`✅ Conhecimento absorvido: ${arquivo}`);
                adicionados++;
            } else {
                console.log(`⚠️ Já conhecia: ${arquivo}`);
            }
        } else {
            console.log(`❌ Arquivo não encontrado: ${arquivo}`);
        }
    }

    if (adicionados > 0) {
        fs.writeFileSync(ZHER_KNOWLEDGE_FILE, JSON.stringify(kb, null, 2), 'utf8');
        console.log(`\n🎉 Sucesso! ${adicionados} arquivos foram injetados no cérebro do ZherTalk.`);
    } else {
        console.log('\nNenhum conhecimento novo precisou ser transferido.');
    }
}

transferir();
