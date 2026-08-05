const { autoBuyEnebaKeyWeb } = require('../eneba_web_bot');

async function testBuddyAutoStock() {
    console.log("🧪 TESTANDO AUTO-ESTOQUE DO BUDDY SIMULATOR 1984...");
    const result = await autoBuyEnebaKeyWeb("Buddy Simulator 1984", 1);
    console.log("RESULTADO DA COMPRA AUTOMÁTICA:", result);
    process.exit(0);
}

testBuddyAutoStock();
