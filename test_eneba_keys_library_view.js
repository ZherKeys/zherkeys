const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'test_keys_library_view.log');

function writeLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let dataStr = data ? (typeof data === 'string' ? ` | ${data}` : ` | ${JSON.stringify(data)}`) : '';
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}\n`;
    console.log(logLine.trim());
    try {
        fs.appendFileSync(logFilePath, logLine, 'utf-8');
    } catch (e) {}
}

async function saveScreenshot(page, stepName) {
    try {
        const cleanName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const screenPath = path.join(screenshotsDir, `${Date.now()}_test_${cleanName}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        writeLog('info', `📸 Screenshot salva: ${screenPath}`);
        return screenPath;
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function runTestKeysLibraryView() {
    writeLog('info', '===============================================================');
    writeLog('info', '🔑 TESTE DE NAVEGAÇÃO E SCREENSHOT DA BIBLIOTECA DE CHAVES ENEBA');
    writeLog('info', '===============================================================');

    let browser = null;
    try {
        const userDataDir = path.join(__dirname, 'eneba_bot_session');
        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const hasCustomChrome = fs.existsSync(chromePath);

        browser = await puppeteer.launch({
            headless: true,
            executablePath: hasCustomChrome ? chromePath : undefined,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 1. Navega diretamente para a Biblioteca de Chaves (/my-keys)
        const myKeysUrl = 'https://my.eneba.com/my-keys';
        writeLog('info', `[ETAPA 1/2] Navegando para a Biblioteca de Chaves: ${myKeysUrl}`);
        await page.goto(myKeysUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await new Promise(r => setTimeout(r, 2000));
        
        const img1 = await saveScreenshot(page, '07_my_keys_library_success');
        writeLog('info', `Screenshot da Biblioteca de Chaves: ${img1}`);

        // 2. Navega para o Histórico de Compras (/purchases)
        const purchasesUrl = 'https://my.eneba.com/purchases';
        writeLog('info', `[ETAPA 2/2] Navegando para o Histórico de Compras: ${purchasesUrl}`);
        await page.goto(purchasesUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null);
        await new Promise(r => setTimeout(r, 2000));
        
        const img2 = await saveScreenshot(page, '08_purchases_history_success');
        writeLog('info', `Screenshot do Histórico de Compras: ${img2}`);

        writeLog('info', '✅ TESTE DA BIBLIOTECA DE CHAVES CONCLUÍDO COM SUCESSO!');
        await browser.close();

    } catch (err) {
        writeLog('error', `❌ Erro no teste de visualização da biblioteca: ${err.message}`, { stack: err.stack });
        if (browser) await browser.close();
    }
}

runTestKeysLibraryView();
