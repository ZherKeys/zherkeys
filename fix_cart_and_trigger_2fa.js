const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'test_fill_2fa_only.log');

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
        await page.waitForFunction(() => {
            const txt = (document.body.innerText || '').toLowerCase();
            return !txt.includes('this may take a while');
        }, { timeout: 10000 }).catch(() => null);

        await new Promise(r => setTimeout(r, 1000));

        const cleanName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const screenPath = path.join(screenshotsDir, `${Date.now()}_test_${cleanName}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        writeLog('info', `📸 Screenshot salva: ${screenPath}`);
        return screenPath;
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function clickWithRealMouse(page, textMatch) {
    const handle = await page.evaluateHandle((targetTxt) => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"], label, a, div[role="button"]'));
        const found = btns.find(b => {
            if (b.closest('header, nav, [class*="breadcrumb"], [class*="step"]')) return false;
            const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
            return txt.includes(targetTxt.toLowerCase());
        });

        if (found) {
            found.scrollIntoView({ block: 'center', inline: 'center' });
            return found;
        }
        return null;
    }, textMatch);

    if (handle && handle.asElement()) {
        await new Promise(r => setTimeout(r, 400));
        const box = await handle.asElement().boundingBox();
        if (box) {
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            writeLog('info', `🎯 Clique de MOUSE REAL nas coordenadas (X: ${centerX.toFixed(1)}, Y: ${centerY.toFixed(1)}) para "${textMatch}"`);
            await page.mouse.move(centerX, centerY, { steps: 5 });
            await new Promise(r => setTimeout(r, 200));
            await page.mouse.click(centerX, centerY);
            return true;
        }
    }
    writeLog('warn', `⚠️ Elemento para mouse real ("${textMatch}") não localizado.`);
    return false;
}

async function runTestExactVisible2FA() {
    writeLog('info', '===============================================================');
    writeLog('info', '🧪 TESTE DEFINITIVO: DIGITAÇÃO VISÍVEL 2FA DENTRO DA CAIXA DE TEXTO');
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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=2560,1440']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 2560, height: 1440 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // ETAPA 1: ACESSAR PRODUTO E ADICIONAR AO CARRINHO
        const productUrl = 'https://www.eneba.com/other-call-of-duty-r-modern-warfare-r-ii-burger-king-operator-skin-1-hour-2xp-dlc-www-callofduty-com-key-global';
        writeLog('info', `[ETAPA 1/6] Acessando produto: ${productUrl}`);
        await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await saveScreenshot(page, '01_product_page');

        writeLog('info', `Clicando em 'Buy now'...`);
        await clickWithRealMouse(page, 'buy now');
        
        // Aguarda a requisição do Eneba processar o carrinho
        await new Promise(r => setTimeout(r, 6000));
        await page.goto('https://www.eneba.com/checkout', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);

        // Se por algum motivo o carrinho ainda estiver vazio, força adição via API ou re-clique
        let isCartEmpty = await page.evaluate(() => (document.body.innerText || '').includes('Your cart is empty'));
        if (isCartEmpty) {
            writeLog('warn', `Carrinho vazio detectado. Forçando adição do produto...`);
            await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, a'));
                const buyBtn = btns.find(b => (b.innerText || '').toLowerCase().includes('buy now'));
                if (buyBtn) buyBtn.click();
            });
            await new Promise(r => setTimeout(r, 6000));
            await page.goto('https://www.eneba.com/checkout', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        }

        // Reduz a quantidade no carrinho para 1 clicando no botão '-'
        for (let i = 0; i < 5; i++) {
            const reduced = await page.evaluate(() => {
                const minusBtn = Array.from(document.querySelectorAll('button')).find(b => {
                    const txt = (b.innerText || b.textContent || '').trim();
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    return txt === '-' || aria.includes('decrease') || aria.includes('diminuir');
                });
                if (minusBtn) {
                    minusBtn.click();
                    return true;
                }
                return false;
            });
            if (reduced) await new Promise(r => setTimeout(r, 1200));
            else break;
        }

        await saveScreenshot(page, '02_cart_checkout_qty1_confirmed');

        // ETAPA 3: CONTINUAR PARA PAGAMENTO
        writeLog('info', `[ETAPA 3/6] Clicando em 'Proceed to checkout'...`);
        await clickWithRealMouse(page, 'proceed');
        await new Promise(r => setTimeout(r, 3000));

        await saveScreenshot(page, '03_payment_step');

        // ETAPA 4: SELECIONAR ENEBA WALLET
        writeLog('info', `[ETAPA 4/6] Selecionando Eneba Wallet...`);
        await clickWithRealMouse(page, 'eneba wallet');
        await new Promise(r => setTimeout(r, 2000));
        await saveScreenshot(page, '04_eneba_wallet_selected');

        // ETAPA 5: CLICAR COM MOUSE REAL NO BOTÃO CONTINUE
        writeLog('info', `[ETAPA 5/6] Clicando com mouse real no botão amarelo 'Continue'...`);
        await clickWithRealMouse(page, 'continue');

        writeLog('info', `⏳ Aguardando a conclusão do carregamento do modal de 2FA...`);
        await page.waitForFunction(() => {
            const body = document.body.innerText || '';
            return !body.includes('This may take a while') && (body.includes('Provide 2FA verification') || body.includes('two-factor') || body.includes('2FA'));
        }, { timeout: 20000 }).catch(() => null);

        await new Promise(r => setTimeout(r, 3000));
        await saveScreenshot(page, '05_after_continue_click');

        // ETAPA 6: CÓDIGO 2FA E DIGITAÇÃO VISÍVEL
        const secret = process.env.ENEBA_2FA_SECRET || '3ZT3EB3OLFGAYGK4';
        let code = '';
        try {
            const speakeasy = require('speakeasy');
            code = speakeasy.totp({ secret: secret.replace(/\s+/g, '').toUpperCase(), encoding: 'base32' });
        } catch (err) {
            const { generate } = require('otplib');
            code = await generate({ secret: secret.replace(/\s+/g, '').toUpperCase() });
        }
        writeLog('info', `🔐 Código TOTP 2FA gerado: ${code}`);

        // Localiza a caixa de texto do 2FA no modal e executa um clique real de mouse sobre ela
        const inputHandle = await page.evaluateHandle(() => {
            const modal = document.querySelector('[class*="modal"], [class*="overlay"], [class*="2fa"], [class*="auth"], [role="dialog"], form');
            if (modal) {
                const inputs = Array.from(modal.querySelectorAll('input')).filter(i => i.type !== 'hidden');
                if (inputs.length > 0) return inputs[0];
            }
            const allInputs = Array.from(document.querySelectorAll('input')).filter(i => {
                if (i.type === 'hidden') return false;
                const style = window.getComputedStyle(i);
                return style.display !== 'none' && style.visibility !== 'hidden' && i.offsetWidth > 0 && i.offsetHeight > 0;
            });
            return allInputs[0] || null;
        });

        if (inputHandle && inputHandle.asElement()) {
            const box = await inputHandle.asElement().boundingBox();
            if (box) {
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                writeLog('info', `🎯 Clique de MOUSE REAL na caixa do 2FA (X: ${cx.toFixed(1)}, Y: ${cy.toFixed(1)})`);
                await page.mouse.click(cx, cy);
                await new Promise(r => setTimeout(r, 400));
            }
        }

        // Digita via teclado nativo Puppeteer
        writeLog('info', `⌨️ Digitando código ${code} via teclado nativo...`);
        for (const char of code) {
            await page.keyboard.press(char);
            await new Promise(r => setTimeout(r, 180));
        }

        // Atualiza a visualização dos campos via React dispatchEvent
        await page.evaluate((totpCode) => {
            const inputs = Array.from(document.querySelectorAll('input')).filter(i => {
                if (i.type === 'hidden') return false;
                const style = window.getComputedStyle(i);
                return style.display !== 'none' && style.visibility !== 'hidden' && i.offsetWidth > 0 && i.offsetHeight > 0;
            });
            const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

            inputs.forEach(inp => {
                setVal.call(inp, totpCode);
                inp.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            });
        }, code);

        await new Promise(r => setTimeout(r, 3000));

        // SCREENSHOT FINAL DA TELA APÓS O CÓDIGO INSERIDO
        writeLog('info', `📸 CAPTURANDO SCREENSHOT FINAL DO MODAL SOBREPOSTO COM CÓDIGO VISÍVEL (SEM CONFIRMAR PAGAMENTO):`);
        const finalImg = await saveScreenshot(page, '06_2fa_CODE_INSERTED_SUCCESS');
        writeLog('info', `Screenshot final gerada: ${finalImg}`);

        writeLog('info', '✅ TESTE CONCLUÍDO!');
        await browser.close();

    } catch (err) {
        writeLog('error', `❌ Erro no teste: ${err.message}`, { stack: err.stack });
        if (browser) await browser.close();
    }
}

runTestExactVisible2FA();
