const { autoBuyEnebaKeyWeb } = require('./eneba_web_bot');

async function runTest() {
    console.log("🧪 TESTANDO O ROBÔ DA ENEBA EM TEMPO REAL...");
    const keys = await autoBuyEnebaKeyWeb('Grand Theft Auto V', 1);
    console.log("RESULTADO DO TESTE:", keys);
    process.exit(0);
}

runTest();
