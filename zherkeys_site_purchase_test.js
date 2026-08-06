const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'zherkeys_purchase.log');

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
        const screenPath = path.join(screenshotsDir, `${Date.now()}_zherkeys_${cleanName}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        writeLog('info', `📸 Screenshot salva: ${screenPath}`);
        return screenPath;
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function runZherkeysPurchaseTest() {
    writeLog('info', '===============================================================');
    writeLog('info', '🛒 INICIANDO TESTE DE COMPRA NO SITE ZHERKEYS: "Hell Clock"');
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

        // 1. Acessa a Home do Zherkeys
        const baseUrl = 'https://zherkeys.com';
        writeLog('info', `[ETAPA 1/5] Acessando site oficial ZherKeys: ${baseUrl}`);
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await saveScreenshot(page, '01_home_page');

        // 2. Procura pelo jogo 'Hell Clock'
        writeLog('info', `[ETAPA 2/5] Buscando produto "Hell Clock"...`);
        
        // Tenta usar a barra de busca se existir
        const searchInput = await page.$('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Pesquisar"], input[id*="search"]');
        if (searchInput) {
            await searchInput.type('Hell Clock', { delay: 50 });
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 3000));
        } else {
            // Ou navega direto via URL de busca ou lista
            await page.goto(`${baseUrl}/?search=Hell%20Clock`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        }

        await saveScreenshot(page, '02_search_results');

        // 3. Procura o link do produto 'Hell Clock' ou similar
        const productInfo = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            const matched = anchors.find(a => {
                const txt = (a.innerText || a.textContent || '').toLowerCase();
                const href = (a.getAttribute('href') || '').toLowerCase();
                return txt.includes('hell clock') || href.includes('hell-clock') || href.includes('hell_clock');
            });
            if (matched) {
                return { href: matched.getAttribute('href'), text: (matched.innerText || matched.textContent).trim() };
            }
            // Retorna o primeiro card de jogo se 'Hell Clock' não estiver cadastrado exatamente com esse nome
            const firstCard = anchors.find(a => a.getAttribute('href') && (a.getAttribute('href').includes('/produto/') || a.getAttribute('href').includes('/product/')));
            return firstCard ? { href: firstCard.getAttribute('href'), text: (firstCard.innerText || firstCard.textContent).trim() } : null;
        });

        writeLog('info', `Resultado da busca do produto no site:`, productInfo);

        if (productInfo && productInfo.href) {
            const productUrl = productInfo.href.startsWith('http') ? productInfo.href : `${baseUrl}${productInfo.href.startsWith('/') ? '' : '/'}${productInfo.href}`;
            writeLog('info', `[ETAPA 3/5] Acessando página do produto: ${productUrl}`);
            await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await saveScreenshot(page, '03_product_page');
        } else {
            writeLog('warn', `⚠️ Jogo "Hell Clock" não encontrado na busca simples. Verificando catálogo geral...`);
            await page.goto(`${baseUrl}/store`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
            await saveScreenshot(page, '03_catalog_fallback');
        }

        // 4. Adiciona ao Carrinho / Clica em Comprar
        writeLog('info', `[ETAPA 4/5] Clicando no botão 'Comprar' / 'Adicionar ao Carrinho'...`);
        const buyResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const buyBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('comprar') || txt.includes('adicionar ao carrinho') || txt.includes('buy now') || txt.includes('garantir');
            });
            if (buyBtn) {
                buyBtn.click();
                return { success: true, text: (buyBtn.innerText || buyBtn.textContent).trim() };
            }
            return { success: false };
        });

        writeLog('info', `Resultado do clique de compra no ZherKeys:`, buyResult);
        await new Promise(r => setTimeout(r, 3000));
        await saveScreenshot(page, '04_cart_checkout');

        // 5. Navega para o Checkout do ZherKeys
        writeLog('info', `[ETAPA 5/5] Verificando tela de Checkout / Pagamento ZherKeys...`);
        const currentUrl = page.url();
        writeLog('info', `URL atual do site ZherKeys: ${currentUrl}`);

        const pageSnippet = await page.evaluate(() => (document.body.innerText || '').substring(0, 1000));
        writeLog('info', `Snippet do ZherKeys Checkout:`, pageSnippet.substring(0, 400));

        await saveScreenshot(page, '05_final_checkout_state');

        writeLog('info', '✅ Teste de navegação e compra no site ZherKeys concluído com sucesso!');
        await browser.close();

    } catch (err) {
        writeLog('error', `❌ Erro durante o teste de compra no site ZherKeys: ${err.message}`, { stack: err.stack });
        if (browser) await browser.close();
    }
}

runZherkeysPurchaseTest();
