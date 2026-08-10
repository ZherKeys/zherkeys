const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'test_no_2fa_submit.log');

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

async function runTestWithout2FASubmit() {
    writeLog('info', '===============================================================');
    writeLog('info', '🧪 INICIANDO TESTE DE CHECKOUT ENEBA (SEM SUBMETER 2FA / SEM COMPRAR)');
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

        // ETAPA 1: Acessa o produto
        const productUrl = 'https://www.eneba.com/other-call-of-duty-r-modern-warfare-r-ii-burger-king-operator-skin-1-hour-2xp-dlc-www-callofduty-com-key-global';
        writeLog('info', `[ETAPA 1/5] Acessando página do produto: ${productUrl}`);
        await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        const img1 = await saveScreenshot(page, '01_product_page');

        // ETAPA 2: Clica em Comprar Agora
        writeLog('info', `[ETAPA 2/5] Clicando no botão 'Buy now' / 'Comprar agora'...`);
        const buyBtnClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const targetBtn = buttons.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('buy now') || txt.includes('comprar agora');
            });
            if (targetBtn) {
                targetBtn.click();
                return { success: true, text: targetBtn.innerText };
            }
            return { success: false };
        });
        writeLog('info', `Resultado do clique de compra:`, buyBtnClicked);
        await new Promise(r => setTimeout(r, 3000));
        const img2 = await saveScreenshot(page, '02_cart_checkout');

        // ETAPA 3: Acessa checkout se não tiver redirecionado
        if (!page.url().includes('/checkout')) {
            await page.goto('https://www.eneba.com/checkout', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        }
        writeLog('info', `[ETAPA 3/5] URL no Checkout: ${page.url()}`);

        // Preenche e-mail se necessário e clica em Proceed to Checkout
        writeLog('info', `Clicando em 'Proceed to checkout'...`);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const target = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('proceed to checkout') || txt.includes('continuar para pagamento');
            });
            if (target) target.click();
        });
        await new Promise(r => setTimeout(r, 4000));
        const img3 = await saveScreenshot(page, '03_payment_step');

        // ETAPA 4: Seleção do Método de Pagamento
        if (page.url().includes('/checkout/payment')) {
            writeLog('info', `[ETAPA 4/5] Selecionando Eneba Wallet...`);
            const walletResult = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('button, div[role="button"], label, input, [class*="option"], [class*="payment"]'));
                const walletEl = elements.find(el => {
                    const txt = (el.innerText || el.textContent || el.value || '').toLowerCase();
                    return txt.includes('eneba wallet') || txt.includes('saldo eneba');
                });
                if (walletEl) {
                    walletEl.click();
                    return { selected: true, text: (walletEl.innerText || walletEl.textContent || '').trim() };
                }
                return { selected: false };
            });
            writeLog('info', `Resultado Eneba Wallet:`, walletResult);
            await new Promise(r => setTimeout(r, 2000));
            const img4 = await saveScreenshot(page, '04_eneba_wallet_selected');

            // ETAPA 5: Clica no botão Continue (SEM PREENCHER/SUBMETER O 2FA)
            writeLog('info', `[ETAPA 5/5] Clicando no botão 'Continue' para abrir a tela/modal de confirmação de 2FA...`);
            const continueResult = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"], [role="button"]'));
                const payBtn = btns.find(b => {
                    if (b.closest('header, nav, [class*="breadcrumb"], [class*="step"]')) return false;
                    const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
                    if (txt === 'payment' || txt === 'cart' || txt.includes('apple pay') || txt.includes('google pay') || txt.includes('credit or debit')) return false;
                    return txt === 'continue' || txt === 'continuar' || txt.includes('proceed') || txt === 'pay now' || txt.includes('pay with') || b.type === 'submit';
                });
                if (payBtn) {
                    payBtn.click();
                    return { clicked: true, text: (payBtn.innerText || payBtn.textContent || '').trim() };
                }
                return { clicked: false };
            });
            writeLog('info', `Resultado clique Continue:`, continueResult);

            await new Promise(r => setTimeout(r, 4000));

            // Captura screenshot da tela de 2FA / Confirmação sem submeter o código
            writeLog('info', `🛑 PARANDO AQUI! Screenshot da tela de 2FA / checkout sem enviar o código (NENHUMA COMPRA FOI REALIZADA):`);
            const img5 = await saveScreenshot(page, '05_2fa_prompt_reached_NO_SUBMIT');
        }

        writeLog('info', '✅ TESTE CONCLUÍDO COM SUCESSO E COMPRA PRESERVADA (Nenhum 2FA foi enviado)!');
        await browser.close();

    } catch (err) {
        writeLog('error', `❌ Erro no teste de checkout: ${err.message}`, { stack: err.stack });
        if (browser) await browser.close();
    }
}

runTestWithout2FASubmit();
