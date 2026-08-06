const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'zherkeys_checkout_test.log');

function writeLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let dataStr = data ? (typeof data === 'string' ? ` | ${data}` : ` | ${JSON.stringify(data)}`) : '';
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}\n`;
    console.log(logLine.trim());
    try {
        fs.appendFileSync(logFilePath, logLine, 'utf-8');
    } catch (e) {}
}

async function dismissGreenWelcomeBanner(page) {
    try {
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
            const greenWelcomeBtn = elements.find(el => {
                const txt = (el.innerText || el.textContent || '').toLowerCase();
                const cls = (el.className || '').toLowerCase();
                const style = window.getComputedStyle(el);
                const bg = style.backgroundColor || '';
                const isGreen = bg.includes('rgb(34, 197, 94)') || bg.includes('rgb(16, 185, 129)') || bg.includes('rgb(0, 128, 0)') || cls.includes('green') || cls.includes('success');
                const isWelcomeOrCookie = txt.includes('boas-vindas') || txt.includes('boas vindas') || txt.includes('welcome') || txt.includes('aceitar') || txt.includes('entendi') || txt.includes('fechar') || txt.includes('got it');
                return isGreen || isWelcomeOrCookie;
            });
            if (greenWelcomeBtn) {
                greenWelcomeBtn.click();
            }
        });
        await new Promise(r => setTimeout(r, 500));
    } catch (e) {}
}

async function saveScreenshot(page, stepName) {
    try {
        await dismissGreenWelcomeBanner(page);
        const cleanName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const screenPath = path.join(screenshotsDir, `${Date.now()}_zk_${cleanName}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        writeLog('info', `📸 Screenshot salva: ${screenPath}`);
        return screenPath;
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function runZherkeysProduct70Checkout() {
    writeLog('info', '===============================================================');
    writeLog('info', '🛒 TESTE DE COMPRA DIRETO NO SITE ZHERKEYS (PRODUTO ID 70)');
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
        const productUrl = `${baseUrl}/produto/70`;

        // 1. Acessa a página do produto ID 70
        writeLog('info', `[ETAPA 1/4] Navegando até a página do produto ID 70: ${productUrl}`);
        await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await saveScreenshot(page, '01_product_page_70');

        // Captura o título e o preço exibido na página do ZherKeys
        const productDetails = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const price = document.querySelector('.price, [class*="price"], font');
            return {
                title: h1 ? h1.innerText.trim() : 'N/A',
                price: price ? price.innerText.trim() : 'N/A'
            };
        });

        writeLog('info', `Detalhes do produto no site ZherKeys:`, productDetails);

        // 2. Clica no botão de Comprar / Adicionar ao Carrinho no ZherKeys
        writeLog('info', `[ETAPA 2/4] Clicando no botão de compra no ZherKeys...`);
        const buyResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const buyBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('comprar agora') || txt.includes('comprar') || txt.includes('adicionar');
            });
            if (buyBtn) {
                buyBtn.click();
                return { success: true, text: (buyBtn.innerText || buyBtn.textContent).trim() };
            }
            return { success: false };
        });

        writeLog('info', `Resultado clique de compra no ZherKeys:`, buyResult);
        await new Promise(r => setTimeout(r, 3000));
        await saveScreenshot(page, '02_after_buy_click');

        // 3. Acessa a página do Carrinho no ZherKeys
        writeLog('info', `[ETAPA 3/4] Acessando carrinho (${baseUrl}/carrinho.html)...`);
        await page.goto(`${baseUrl}/carrinho.html`, { waitUntil: 'networkidle2', timeout: 30000 });
        await saveScreenshot(page, '03_carrinho_page');

        // Verifica os itens contidos no carrinho
        const cartInfo = await page.evaluate(() => {
            const bodyText = document.body.innerText || '';
            const items = Array.from(document.querySelectorAll('[class*="cart"], table tr, div[class*="item"]')).map(el => (el.innerText || el.textContent || '').trim()).filter(Boolean);
            return {
                textSnippet: bodyText.substring(0, 800),
                isEmpty: bodyText.includes('Seu carrinho está vazio')
            };
        });

        writeLog('info', `Status do Carrinho no ZherKeys:`, { isEmpty: cartInfo.isEmpty });
        writeLog('info', `Conteúdo do Carrinho:`, cartInfo.textSnippet.substring(0, 300));

        // 4. Executa a finalização da compra
        writeLog('info', `[ETAPA 4/4] Verificando botão 'Finalizar Compra' / Métodos de Pagamento...`);
        const checkoutResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const finishBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('finalizar compra') || txt.includes('checkout');
            });
            if (finishBtn) {
                return { found: true, text: (finishBtn.innerText || finishBtn.textContent).trim() };
            }
            return { found: false };
        });

        writeLog('info', `Botão de Checkout no ZherKeys:`, checkoutResult);
        await saveScreenshot(page, '04_final_checkout_ready');

        writeLog('info', '✅ Teste de simulação de compra no ZherKeys concluído!');
        await browser.close();

    } catch (err) {
        writeLog('error', `❌ Erro no teste do produto 70 no ZherKeys: ${err.message}`, { stack: err.stack });
        if (browser) await browser.close();
    }
}

runZherkeysProduct70Checkout();
