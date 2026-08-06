const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

async function testAutoLogin() {
    console.log("===============================================================");
    console.log("🤖 TESTANDO LOGIN 100% AUTOMÁTICO DO ROBÔ NA ENEBA...");
    console.log("===============================================================");

    const userDataDir = path.join(__dirname, 'eneba_bot_session');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
        userDataDir: userDataDir,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log("1. Acessando https://my.eneba.com/login...");
    await page.goto('https://my.eneba.com/login', { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null);

    const botEmail = process.env.ENEBA_BOT_EMAIL || 'zherkeys@gmail.com';
    const botPass = process.env.ENEBA_BOT_PASSWORD || 'Caio40028922!';

    console.log(`2. Preenchendo credenciais (${botEmail})...`);
    const autoLoginResult = await page.evaluate(async (emailStr, passStr) => {
        const emailIn = document.querySelector('input[name="email"], input[type="email"]');
        const passIn = document.querySelector('input[name="password"], input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"], form button');

        if (emailIn && passIn) {
            emailIn.value = emailStr;
            passIn.value = passStr;
            emailIn.dispatchEvent(new Event('input', { bubbles: true }));
            passIn.dispatchEvent(new Event('input', { bubbles: true }));
            if (submitBtn) {
                submitBtn.click();
                return { success: true, text: submitBtn.innerText || submitBtn.textContent };
            }
        }
        return { success: false };
    }, botEmail, botPass);

    console.log("Resultado do envio do formulário de login:", autoLoginResult);
    await new Promise(r => setTimeout(r, 6000));

    const screenPath = path.join(screenshotsDir, `${Date.now()}_test_auto_login_result.png`);
    await page.screenshot({ path: screenPath, fullPage: true });
    console.log(`📸 Screenshot de resultado salva em: ${screenPath}`);

    const currentUrl = page.url();
    console.log(`3. URL atual pós-login: ${currentUrl}`);

    const isLogged = !currentUrl.includes('/login');
    console.log(`4. Status final de login autônomo: ${isLogged ? '✅ SUCESSO! LOGADO AUTOMATICAMENTE' : '⚠️ REQUER VERIFICAÇÃO'}`);

    await browser.close();
    process.exit(0);
}

testAutoLogin();
