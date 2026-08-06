const { autoBuyEnebaKeyWeb } = require('./eneba_web_bot');

async function runExactTitleTest() {
    const productTitle = "Call of Duty: Modern Warfare II - Burger King Operator Skin + 1 Hour 2XP";
    console.log("===============================================================");
    console.log(`🤖 EXECUÇÃO DO TESTE DO ROBÔ COM NOME EXATO:`);
    console.log(`-> "${productTitle}"`);
    console.log("===============================================================");

    const resultKeys = await autoBuyEnebaKeyWeb(productTitle, 1);
    console.log("CHAVES RETORNADAS PELO ROBÔ:", resultKeys);
    process.exit(0);
}

runExactTitleTest();
