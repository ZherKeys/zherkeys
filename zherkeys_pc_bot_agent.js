/**
 * ZHER KEYS - DAEMON ROBÔ AUTOMÁTICO LOCAL (PC <-> SERVIDOR ZHERKEYS)
 * 
 * Este serviço roda em segundo plano no PC local do dono:
 * 1. Monitora o site ZherKeys (https://zherkeys.com) em tempo real a cada 5 segundos.
 * 2. Quando um cliente faz um pedido que precisa de chave, o robô abre o Chrome no PC.
 * 3. Compra a chave na Eneba usando a internet e o Chrome residencial do seu PC.
 * 4. Envia a chave resgatada de volta para o ZherKeys via API em tempo real!
 */

const { autoBuyEnebaKeyWeb } = require('./eneba_web_bot');
const path = require('path');
const fs = require('fs');

const ZHERKEYS_SITE_URL = process.env.ZHERKEYS_SITE_URL || 'https://zherkeys.com';
const BOT_API_SECRET = process.env.BOT_API_SECRET || 'zherkeys-secret-bot-token-2026';
const POLL_INTERVAL_MS = 5000;

// Trava Anti-Queda: Previne fechamentos inesperados se a internet oscilar
process.on('uncaughtException', (err) => {
    console.error(`[PC-BOT CRASH GUARD] Erro inesperado capturado (mantendo robô ativo): ${err.message || err}`);
});

process.on('unhandledRejection', (reason) => {
    console.error(`[PC-BOT CRASH GUARD] Erro de rede/Promise capturado (mantendo robô ativo):`, reason);
});

let isProcessing = false;

console.log("=========================================================================");
console.log("🚀 AGENTE ROBÔ ZHERKEYS INICIADO NO PC LOCAL");
console.log(`📡 Conectado ao Servidor: ${ZHERKEYS_SITE_URL}`);
console.log(`⏱️ Monitorando pedidos pendentes a cada ${POLL_INTERVAL_MS / 1000} segundos...`);
console.log("=========================================================================");

async function pollAndFulfillOrders() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        // 1. Busca pedidos pendentes na API do ZherKeys
        const apiUrl = `${ZHERKEYS_SITE_URL}/api/bot/pending-orders`;
        const res = await fetch(apiUrl, {
            headers: { 'x-bot-token': BOT_API_SECRET }
        }).catch(err => {
            console.log(`[PC-BOT] Conectando ao servidor ZherKeys (${ZHERKEYS_SITE_URL})...`);
            return null;
        });

        if (!res || !res.ok) {
            isProcessing = false;
            return;
        }

        const data = await res.json().catch(() => ({}));
        const pendingOrders = data.pendingOrders || [];

        if (pendingOrders.length > 0) {
            console.log(`\n🔔 [PC-BOT] ${pendingOrders.length} pedido(s) pendente(s) encontrado(s) no ZherKeys!`);
            
            for (let item of pendingOrders) {
                const targetUrlOrTitle = (item.eneba_url && item.eneba_url.trim() !== '') ? item.eneba_url.trim() : item.title;
                console.log(`🤖 [PC-BOT] Processando Pedido #${item.order_id} - Produto: "${item.title}"`);
                console.log(`🎯 [PC-BOT] Alvo do Robô: ${targetUrlOrTitle}`);

                // Executa a compra autônoma no PC
                const keys = await autoBuyEnebaKeyWeb(targetUrlOrTitle, item.quantity || 1);

                if (keys && keys.length > 0) {
                    const deliveredKey = keys.join(', ');
                    console.log(`🎉 [PC-BOT] Key resgatada com sucesso: ${deliveredKey}`);
                    console.log(`📡 [PC-BOT] Enviando Key para o ZherKeys...`);

                    // 2. Entrega a Key via API para o ZherKeys
                    const fulfillRes = await fetch(`${ZHERKEYS_SITE_URL}/api/bot/fulfill-order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-bot-token': BOT_API_SECRET
                        },
                        body: JSON.stringify({
                            orderId: item.order_id,
                            productId: item.product_id,
                            activationKey: deliveredKey
                        })
                    });

                    const fulfillData = await fulfillRes.json().catch(() => ({}));
                    if (fulfillRes.ok && fulfillData.success) {
                        console.log(`✅ [PC-BOT] Pedido #${item.order_id} atualizado com SUCESSO no ZherKeys! Cliente recebeu a key!\n`);
                    } else {
                        console.error(`❌ [PC-BOT] Falha ao entregar key para o ZherKeys:`, fulfillData);
                    }
                } else {
                    console.warn(`⚠️ [PC-BOT] Não foi possível obter a chave para o Pedido #${item.order_id} nesta tentativa.\n`);
                }
            }
        }

    } catch (err) {
        console.error("[PC-BOT] Erro na verificação do robô local:", err.message || err);
    } finally {
        isProcessing = false;
    }
}

// Inicia o ciclo de polling (Suporta disparo individual ou contínuo)
const isSingleRun = process.argv.includes('--single-run');
if (isSingleRun) {
    pollAndFulfillOrders().then(() => process.exit(0)).catch(() => process.exit(1));
} else {
    setInterval(pollAndFulfillOrders, POLL_INTERVAL_MS);
    pollAndFulfillOrders();
}
