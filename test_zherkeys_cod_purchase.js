const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'zherkeys_cod_purchase.log');

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
        const screenPath = path.join(screenshotsDir, `${Date.now()}_cod_${cleanName}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        writeLog('info', `📸 Screenshot salva: ${screenPath}`);
        return screenPath;
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function runZherkeysCodPurchaseTest() {
    writeLog('info', '===============================================================');
    writeLog('info', '🎮 TESTE DE COMPRA COM LOGIN NO SITE ZHERKEYS: Call of Duty DLC');
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

        // 1. Tenta fazer login na conta ZherKeys
        writeLog('info', `[ETAPA 1/6] Acessando página de login no ZherKeys (${baseUrl}/login)...`);
        await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        await saveScreenshot(page, '01_login_page');

        // Preenche credenciais se houver formulário
        const loginSubmitted = await page.evaluate(async () => {
            const emailInput = document.querySelector('input[type="email"], input[name="email"]');
            const passInput = document.querySelector('input[type="password"], input[name="password"]');
            const submitBtn = document.querySelector('button[type="submit"], form button');

            if (emailInput && passInput) {
                emailInput.value = 'zherkeys@gmail.com';
                passInput.value = 'admin123';
                if (submitBtn) {
                    submitBtn.click();
                    return { success: true, email: emailInput.value };
                }
            }
            return { success: false };
        });

        writeLog('info', `Status do envio do formulário de login:`, loginSubmitted);
        await new Promise(r => setTimeout(r, 3000));
        await saveScreenshot(page, '01_after_login');

        // 2. Procura o produto Call of Duty®: Modern Warfare® II - Burger King Operator Skin...
        const productName = 'Call of Duty®: Modern Warfare® II - Burger King Operator Skin + 1 Hour 2XP (DLC) www.callofduty.com Key GLOBAL';
        writeLog('info', `[ETAPA 2/6] Buscando produto "${productName}" no ZherKeys...`);

        await page.goto(`${baseUrl}/store?search=${encodeURIComponent('Call of Duty')}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        await saveScreenshot(page, '02_search_cod_results');

        // Identifica o card do produto de Call of Duty
        const productTarget = await page.evaluate((targetTitle) => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            const match = anchors.find(a => {
                const txt = (a.innerText || a.textContent || '').toLowerCase();
                const href = (a.getAttribute('href') || '').toLowerCase();
                return txt.includes('burger king') || txt.includes('modern warfare') || txt.includes('call of duty') || href.includes('burger-king') || href.includes('call-of-duty');
            });
            if (match) {
                return { href: match.getAttribute('href'), text: (match.innerText || match.textContent).trim() };
            }
            const anyProduct = anchors.find(a => a.getAttribute('href') && a.getAttribute('href').includes('/produto/'));
            return anyProduct ? { href: anyProduct.getAttribute('href'), text: (anyProduct.innerText || anyProduct.textContent).trim() } : null;
        }, productName);

        writeLog('info', `Resultado busca de produto no ZherKeys:`, productTarget);

        if (productTarget && productTarget.href) {
            const productUrl = productTarget.href.startsWith('http') ? productTarget.href : `${baseUrl}${productTarget.href.startsWith('/') ? '' : '/'}${productTarget.href}`;
            writeLog('info', `[ETAPA 3/6] Acessando página do produto Call of Duty: ${productUrl}`);
            await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await saveScreenshot(page, '03_cod_product_page');
        } else {
            writeLog('warn', `⚠️ Produto Call of Duty Burger King não listado diretamente, acessando página principal do catálogo...`);
        }

        // 3. Adiciona ao Carrinho / Clica em Comprar
        writeLog('info', `[ETAPA 4/6] Clicando no botão 'Comprar Agora'...`);
        const buyClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const target = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('comprar') || txt.includes('adicionar ao carrinho') || txt.includes('buy now');
            });
            if (target) {
                target.click();
                return { success: true, text: (target.innerText || target.textContent).trim() };
            }
            return { success: false };
        });

        writeLog('info', `Resultado clique de compra no ZherKeys:`, buyClicked);
        await new Promise(r => setTimeout(r, 3000));
        await saveScreenshot(page, '04_cod_cart_page');

        // 4. Acessa o Carrinho / Checkout
        writeLog('info', `[ETAPA 5/6] Navegando para o checkout (${baseUrl}/carrinho.html)...`);
        await page.goto(`${baseUrl}/carrinho.html`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        await saveScreenshot(page, '05_cod_checkout');

        // Tenta finalizar compra (Selecionando Saldo da Carteira ou PIX Direct)
        writeLog('info', `[ETAPA 6/6] Tentando acionar botão de 'Finalizar Compra' no ZherKeys...`);
        const checkoutFinish = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const finishBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('finalizar compra') || txt.includes('checkout') || txt.includes('pagar');
            });
            if (finishBtn) {
                finishBtn.click();
                return { success: true, text: (finishBtn.innerText || finishBtn.textContent).trim() };
            }
            return { success: false };
        });

        writeLog('info', `Resultado finalização checkout ZherKeys:`, checkoutFinish);
        await new Promise(r => setTimeout(r, 5000));
        await saveScreenshot(page, '06_order_processed_result');

        const finalPageSnippet = await page.evaluate(() => (document.body.innerText || '').substring(0, 1000));
        writeLog('info', `Snippet final pós-compra ZherKeys:`, finalPageSnippet.substring(0, 400));

        writeLog('info', '✅ Teste de compra com login no ZherKeys finalizado!');
        await browser.close();

    } catch (err) {
        writeLog('error', `❌ Erro durante o teste de compra do COD no ZherKeys: ${err.message}`, { stack: err.stack });
        if (browser) await browser.close();
    }
}

runZherkeysCodPurchaseTest();
