const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const path = require('path');
const fs = require('fs');

async function checkLoginStatus() {
    console.log("🔍 Verificando sessão salva em eneba_bot_session...");
    
    const userDataDir = path.join(__dirname, 'eneba_bot_session');
    if (!fs.existsSync(userDataDir)) {
        console.log("❌ A pasta 'eneba_bot_session' ainda não foi criada!");
        process.exit(1);
    }

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
        userDataDir: userDataDir,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        console.log("🌐 Acessando https://my.eneba.com/purchases...");
        await page.goto('https://my.eneba.com/purchases', { waitUntil: 'networkidle2', timeout: 30000 });

        const currentUrl = page.url();
        const pageText = await page.evaluate(() => document.body.innerText || '');
        const isLoginRedirect = currentUrl.includes('/login');

        const screenPath = path.join(__dirname, 'logs', 'screenshots', 'login_check_status.png');
        await page.screenshot({ path: screenPath, fullPage: true });

        console.log("\n=======================================================");
        console.log(`URL Atual: ${currentUrl}`);
        if (!isLoginRedirect) {
            console.log("✅ SESSÃO ATIVA! Você ESTÁ LOGADO na Eneba!");
        } else {
            console.log("❌ SESSÃO INATIVA ou EXPIRADA! Você NÃO está logado (redirecionado para login).");
        }
        console.log("=======================================================\n");

    } catch (err) {
        console.error("❌ Erro ao verificar login:", err.message);
    } finally {
        await browser.close();
    }
}

checkLoginStatus();
