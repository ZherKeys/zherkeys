const { autoBuyEnebaKeyWeb } = require('./eneba_web_bot');

async function testCodPurchase() {
    console.log("🎮 TESTANDO AUTOMAÇÃO DO ROBÔ PARA O PRODUTO:");
    console.log("-> Call of Duty: Modern Warfare II - Burger King Operator Skin");

    const keys = await autoBuyEnebaKeyWeb("Call of Duty Modern Warfare II Burger King Operator Skin", 1);
    console.log("RESULTADO DA COMPRA PELO ROBÔ:", keys);
    process.exit(0);
}

testCodPurchase();
