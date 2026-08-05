/**
 * Script de Inicialização da Sessão do Robô Eneba (Login Único com Google/Eneba)
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

async function initLogin() {
    console.log("=================================================");
    console.log("🌐 ABRINDO CHROME OFICIAL PARA LOGIN NA ENEBA...");
    console.log("Por favor, faça login com a sua conta na janela que abrir.");
    console.log("Assim que concluir o login, feche a janela do navegador.");
    console.log("=================================================");

    const userDataDir = path.join(__dirname, 'eneba_bot_session');
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
        userDataDir: userDataDir,
        args: [
            '--no-sandbox',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-features=CalculateNativeWinOcclusion,IsolateOrigins,site-per-process',
            '--start-maximized'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto('https://my.eneba.com/login', { waitUntil: 'networkidle2' });

    browser.on('disconnected', () => {
        console.log("✅ SESSÃO SALVA COM SUCESSO!");
        console.log("O robô agora usará o seu login salvo automaticamente nas compras do site!");
        process.exit(0);
    });
}

initLogin();
