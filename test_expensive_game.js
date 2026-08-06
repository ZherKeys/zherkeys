const { autoBuyEnebaKeyWeb } = require('./eneba_web_bot');

async function runTest() {
    console.log("🧪 INICIANDO TESTE DE COMPRA NA ENEBA PARA UM JOGO CARO...");
    // Testando com 'Elden Ring' (jogo de valor elevado)
    const keys = await autoBuyEnebaKeyWeb('Elden Ring', 1);
    console.log("RESULTADO DO TESTE DE COMPRA:", keys);
    process.exit(0);
}

runTest();
