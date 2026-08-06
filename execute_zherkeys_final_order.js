const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'zherkeys_order_execution.log');

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
        const screenPath = path.join(screenshotsDir, `${Date.now()}_final_${cleanName}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        writeLog('info', `📸 Screenshot salva: ${screenPath}`);
        return screenPath;
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function executeZherkeysOrder() {
    writeLog('info', '===============================================================');
    writeLog('info', '🚀 FINALIZANDO PEDIDO DO CALL OF DUTY DLC NO SITE ZHERKEYS');
    writeLog('info', '===============================================================');

    let browser = null;
    try {
        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const hasCustomChrome = fs.existsSync(chromePath);

        browser = await puppeteer.launch({
            headless: true,
            executablePath: hasCustomChrome ? chromePath : undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const baseUrl = 'https://zherkeys.com';

        // 1. Acessa o produto 70
        writeLog('info', `[ETAPA 1/5] Acessando produto 70: ${baseUrl}/produto/70`);
        await page.goto(`${baseUrl}/produto/70`, { waitUntil: 'networkidle2', timeout: 30000 });
        await saveScreenshot(page, '01_product_page');

        // 2. Adiciona ao carrinho
        writeLog('info', `[ETAPA 2/5] Clicando em ADICIONAR ao carrinho...`);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const buyBtn = btns.find(b => (b.innerText || b.textContent || '').toLowerCase().includes('adicionar'));
            if (buyBtn) buyBtn.click();
        });
        await new Promise(r => setTimeout(r, 2500));

        // 3. Acessa o carrinho
        writeLog('info', `[ETAPA 3/5] Navegando para o carrinho (${baseUrl}/carrinho.html)...`);
        await page.goto(`${baseUrl}/carrinho.html`, { waitUntil: 'networkidle2', timeout: 30000 });
        await saveScreenshot(page, '02_cart_page');

        // 4. Clica em FINALIZAR COMPRA
        writeLog('info', `[ETAPA 4/5] Clicando no botão 'FINALIZAR COMPRA'...`);
        const finishResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const finishBtn = btns.find(b => (b.innerText || b.textContent || '').toLowerCase().includes('finalizar compra'));
            if (finishBtn) {
                finishBtn.click();
                return { clicked: true, text: finishBtn.innerText || finishBtn.textContent };
            }
            return { clicked: false };
        });

        writeLog('info', `Resultado clique em 'FINALIZAR COMPRA':`, finishResult);
        await new Promise(r => setTimeout(r, 8000));
        await saveScreenshot(page, '03_after_checkout_click');

        // Captura resposta na tela / modal / alerta pós-clique
        const orderSnippet = await page.evaluate(() => (document.body.innerText || '').substring(0, 1200));
        writeLog('info', `Conteúdo pós-finalização no ZherKeys:`, orderSnippet.substring(0, 400));

        // 5. Navega para a página de Meus Pedidos / Minha Conta
        writeLog('info', `[ETAPA 5/5] Verificando entrega da key no painel (/account.html)...`);
        await page.goto(`${baseUrl}/account.html`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        await saveScreenshot(page, '04_account_orders');

        const accountSnippet = await page.evaluate(() => (document.body.innerText || '').substring(0, 1200));
        writeLog('info', `Conteúdo do Painel da Conta ZherKeys:`, accountSnippet.substring(0, 400));

        writeLog('info', '✅ Processo de finalização do pedido e verificação no painel concluído!');
        await browser.close();

    } catch (err) {
        writeLog('error', `❌ Erro na finalização do pedido no ZherKeys: ${err.message}`, { stack: err.stack });
        if (browser) await browser.close();
    }
}

executeZherkeysOrder();
