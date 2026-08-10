/**
 * Script de Teste Oficial do Robô do Site:
 * Executa a função oficial autoBuyEnebaKeyWeb exatamente como o site zherkeys.com executa ao receber um pedido real!
 */
const { autoBuyEnebaKeyWeb } = require('./eneba_web_bot');

async function testProductionBot() {
    console.log("==========================================================================");
    console.log("🚀 DISPARANDO O ROBÔ OFICIAL DO SITE ZHERKEYS.COM (PRODUÇÃO REAL)");
    console.log("==========================================================================");

    const mockSaveLog = (level, message, orderId) => {
        console.log(`[BOT-LOG] [${level.toUpperCase()}] Pedido #${orderId}: ${message}`);
    };

    try {
        // Dispara o robô oficial exatamente como a server.js faz para o pedido #9999
        const keys = await autoBuyEnebaKeyWeb("Random Key", 1, 9999, mockSaveLog);
        console.log("🔑 Chaves retornadas pelo Robô Oficial:", keys);
    } catch (e) {
        console.error("Erro ao executar robô oficial:", e.message);
    } finally {
        console.log("==========================================================================");
        console.log("🏁 FIM DO TESTE DO ROBÔ OFICIAL");
        console.log("==========================================================================");
    }
}

testProductionBot();
