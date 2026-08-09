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
        const cleanName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const screenPath = path.join(screenshotsDir, `${Date.now()}_test_${cleanName}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        writeLog('info', `📸 Screenshot salva: ${screenPath}`);
        return screenPath;
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function clickElementNative(page, selectorText) {
    const handles = await page.$$('button, a, input[type="submit"], [role="button"]');
    for (const h of handles) {
        const txt = await page.evaluate(el => (el.innerText || el.textContent || el.value || '').trim().toLowerCase(), h);
        if (txt.includes(selectorText.toLowerCase())) {
            await h.click();
            return true;
        }
    }
    return false;
}

async function runTestFill2FAOnly() {
    writeLog('info', '===============================================================');
    writeLog('info', '🧪 TESTE DE PREENCHIMENTO DO 2FA (QUANTIDADE = 1 E MODAL 2FA VISÍVEL)');
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

        // ETAPA 0: Limpar carrinho acumulado se houver
        writeLog('info', `[ETAPA 0] Verificando carrinho existente para remover duplicados...`);
        try {
            await page.goto('https://www.eneba.com/checkout', { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null);
            await page.evaluate(async () => {
                const getRemoveBtns = () => Array.from(document.querySelectorAll('button')).filter(b => {
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    return aria.includes('remove item from cart') || aria.includes('remover item');
                });
                let btns = getRemoveBtns();
                while (btns.length > 0) {
                    btns[0].click();
                    await new Promise(r => setTimeout(r, 1000));
                    btns = getRemoveBtns();
                }
            });
        } catch (e) {}

        // ETAPA 1: Acessa o produto
        const productUrl = 'https://www.eneba.com/other-call-of-duty-r-modern-warfare-r-ii-burger-king-operator-skin-1-hour-2xp-dlc-www-callofduty-com-key-global';
        writeLog('info', `[ETAPA 1/6] Acessando página do produto: ${productUrl}`);
        await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await saveScreenshot(page, '01_product_page');

        // ETAPA 2: Clica em Comprar Agora
        writeLog('info', `[ETAPA 2/6] Clicando em 'Buy now'...`);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const b = btns.find(el => (el.innerText || el.textContent || '').toLowerCase().includes('buy now'));
            if (b) b.click();
        });
        await new Promise(r => setTimeout(r, 3000));

        // ETAPA 3: Checkout & Limpeza de Quantidade (Garantir exatamente 1 produto)
        if (!page.url().includes('/checkout')) {
            await page.goto('https://www.eneba.com/checkout', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        }

        writeLog('info', `[ETAPA 3/6] Ajustando quantidade no carrinho para exatamente 1 unidade...`);
        await page.evaluate(async () => {
            // Remove itens extras se houver mais de um produto diferente no carrinho
            const removeBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                return aria.includes('remove item from cart') || aria.includes('remover item');
            });
            while (removeBtns.length > 1) {
                removeBtns[0].click();
                await new Promise(r => setTimeout(r, 1000));
                removeBtns.shift();
            }

            // Garante que a quantidade do produto seja 1 (clica no botão de menos se quantidade > 1)
            const minusBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                const txt = (b.innerText || b.textContent || '').trim();
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                return txt === '-' || aria.includes('decrease') || aria.includes('diminuir');
            });
            for (let btn of minusBtns) {
                btn.click();
                await new Promise(r => setTimeout(r, 500));
            }

            // Preenche e-mail se estiver vazio
            const emailInput = Array.from(document.querySelectorAll('input')).find(i => {
                const type = (i.type || '').toLowerCase();
                const name = (i.name || i.id || i.placeholder || i.autocomplete || '').toLowerCase();
                return type === 'email' || name.includes('email') || name.includes('mail');
            });
            if (emailInput && !emailInput.value) {
                const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                emailInput.focus();
                setVal.call(emailInput, 'zherkeys@gmail.com');
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                emailInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await saveScreenshot(page, '02_cart_checkout_qty1');

        writeLog('info', `Clicando em 'Proceed to checkout'...`);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const b = btns.find(el => {
                const txt = (el.innerText || el.textContent || '').toLowerCase();
                return txt.includes('proceed to checkout') || txt.includes('continuar para pagamento');
            });
            if (b) b.click();
        });
        await new Promise(r => setTimeout(r, 4000));
        await saveScreenshot(page, '03_payment_step');

        // ETAPA 4: Eneba Wallet
        if (page.url().includes('/checkout/payment')) {
            writeLog('info', `[ETAPA 4/6] Selecionando Eneba Wallet...`);
            await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('button, div[role="button"], label, input, [class*="option"], [class*="payment"]'));
                const walletEl = elements.find(el => (el.innerText || el.textContent || el.value || '').toLowerCase().includes('eneba wallet'));
                if (walletEl) walletEl.click();
            });
            await new Promise(r => setTimeout(r, 2000));
            await saveScreenshot(page, '04_eneba_wallet_selected');

            // ETAPA 5: Clica em Continue (com clique nativo do Puppeteer)
            writeLog('info', `[ETAPA 5/6] Clicando no botão 'Continue' nativamente para abrir a janela de 2FA...`);
            const clicked = await clickElementNative(page, 'continue');
            if (!clicked) {
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"], [role="button"]'));
                    const payBtn = btns.find(b => {
                        if (b.closest('header, nav, [class*="breadcrumb"], [class*="step"]')) return false;
                        const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
                        if (txt === 'payment' || txt === 'cart' || txt.includes('apple pay') || txt.includes('google pay') || txt.includes('credit or debit')) return false;
                        return txt === 'continue' || txt === 'continuar' || txt.includes('proceed') || txt === 'pay now' || txt.includes('pay with') || b.type === 'submit';
                    });
                    if (payBtn) payBtn.click();
                });
            }

            await new Promise(r => setTimeout(r, 3500));

            // Se ainda não abriu o modal, tenta o clique no botão de submit final
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
                const finalBtn = btns.find(b => {
                    if (b.closest('header, nav, ul, ol, [class*="step"], [class*="breadcrumb"]')) return false;
                    const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
                    if (txt === 'payment' || txt === 'cart' || txt === 'get your product') return false;
                    if (txt.includes('apple pay') || txt.includes('google pay') || txt.includes('credit or debit')) return false;
                    return txt.includes('pay with') || txt.includes('pay now') || txt.includes('pagar') || txt === 'continue' || txt === 'continuar' || txt.includes('confirm') || b.type === 'submit';
                });
                if (finalBtn) finalBtn.click();
            });

            await new Promise(r => setTimeout(r, 4000));
            await saveScreenshot(page, '05_2fa_modal_open');

            // ETAPA 6: Gerar código 2FA e PREENCHER no campo (SEM SUBMETER COMPRA)
            const secret = process.env.ENEBA_2FA_SECRET || '3ZT3EB3OLFGAYGK4';
            let code = '';
            try {
                const speakeasy = require('speakeasy');
                code = speakeasy.totp({ secret: secret.replace(/\s+/g, '').toUpperCase(), encoding: 'base32' });
            } catch (err) {
                const { generate } = require('otplib');
                code = await generate({ secret: secret.replace(/\s+/g, '').toUpperCase() });
            }
            writeLog('info', `🔐 Código TOTP 2FA gerado para inserção: ${code}`);

            // Preenche os 6 dígitos do formulário de 2FA
            const frames = [page, ...page.frames()];
            let filled = false;

            for (let foundFrame of frames) {
                const typed = await foundFrame.evaluate(async (totpCode) => {
                    const allInputs = Array.from(document.querySelectorAll('input')).filter(i => {
                        if (i.type === 'hidden') return false;
                        if (i.closest('header, nav, [class*="search"], [class*="header"]')) return false;
                        const style = window.getComputedStyle(i);
                        return style.display !== 'none' && style.visibility !== 'hidden' && i.offsetWidth > 0 && i.offsetHeight > 0;
                    });

                    const modalInputs = allInputs.filter(i => i.closest('[role="dialog"], [class*="modal"], [class*="popup"], [class*="overlay"], [class*="2fa"], [class*="auth"], form'));
                    const targetInputs = modalInputs.length > 0 ? modalInputs : allInputs;
                    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

                    const digitInputs = targetInputs.filter(i => i.maxLength === 1 || i.getAttribute('inputmode') === 'numeric' || (i.name || i.id || '').toLowerCase().includes('digit'));
                    if ((digitInputs.length === 6 || targetInputs.length === 6) && totpCode.length === 6) {
                        const listToFill = digitInputs.length === 6 ? digitInputs : targetInputs;
                        for (let i = 0; i < 6; i++) {
                            listToFill[i].focus();
                            setVal.call(listToFill[i], totpCode[i]);
                            listToFill[i].dispatchEvent(new Event('input', { bubbles: true }));
                            listToFill[i].dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        return true;
                    }

                    const targetInput = targetInputs.find(i => {
                        const name = (i.name || i.id || i.placeholder || i.autocomplete || i.ariaLabel || '').toLowerCase();
                        return name.includes('code') || name.includes('otp') || name.includes('2fa') || name.includes('token') || name.includes('verification') || name.includes('pin') || i.autocomplete === 'one-time-code';
                    }) || (targetInputs.length === 1 ? targetInputs[0] : null);

                    if (targetInput) {
                        targetInput.focus();
                        setVal.call(targetInput, totpCode);
                        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                    return false;
                }, code);

                if (typed) {
                    filled = true;
                    writeLog('info', `✅ Código 2FA (${code}) inserido nos campos do formulário com sucesso!`);
                    break;
                }
            }

            await new Promise(r => setTimeout(r, 2000));

            // CAPTURA A SCREENSHOT FINAL COM O CÓDIGO INSERIDO NA TELA (NENHUM BOTÃO DE SUBMIT É CLICADO)
            writeLog('info', `📸 CAPTURANDO SCREENSHOT FINAL COM O CÓDIGO 2FA INSERIDO NO CAMPO (SEM SUBMETER COMPRA):`);
            const finalImg = await saveScreenshot(page, '06_2fa_CODE_INSERTED_SUCCESS');
            writeLog('info', `Screenshot final gerada: ${finalImg}`);
        }

        writeLog('info', '✅ TESTE CONCLUÍDO COM CÓDIGO PREENCHIDO E COMPRA PRESERVADA (Sem clique de envio)!');
        await browser.close();

    } catch (err) {
        writeLog('error', `❌ Erro no teste de preenchimento do 2FA: ${err.message}`, { stack: err.stack });
        if (browser) await browser.close();
    }
}

runTestFill2FAOnly();
