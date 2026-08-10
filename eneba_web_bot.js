/**
 * Eneba Web Automation Bot (No-API Auto-Fulfillment Engine)
 * Powered by Puppeteer Stealth + Deep Logging & Screenshots
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

// Ensure log directories exist
const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'eneba_bot.log');

function writeLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let dataStr = '';
    if (data) {
        try {
            dataStr = typeof data === 'string' ? ` | DATA: ${data}` : ` | DATA: ${JSON.stringify(data)}`;
        } catch (e) {
            dataStr = ` | DATA: [Unserializable]`;
        }
    }
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}\n`;
    
    // Print to console
    if (level === 'error') console.error(logLine.trim());
    else if (level === 'warn') console.warn(logLine.trim());
    else console.log(logLine.trim());

    // Append to file
    try {
        fs.appendFileSync(logFilePath, logLine, 'utf-8');
    } catch (err) {
        console.error("Erro ao escrever no arquivo de log do robô:", err);
    }
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

function clearStaleSessionLocks(userDataDir) {
    try {
        const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
        lockFiles.forEach(f => {
            const p = path.join(userDataDir, f);
            if (fs.existsSync(p)) {
                try { fs.unlinkSync(p); } catch (e) {}
            }
        });
    } catch (e) {}
}

async function handleEneba2FAPrompt(page) {
    try {
        const secret = process.env.ENEBA_2FA_SECRET;
        if (!secret) return false;

        const frames = [page, ...page.frames()];
        let foundFrame = null;

        for (let frame of frames) {
            try {
                const is2FA = await frame.evaluate(() => {
                    const text = (document.body.innerText || '').toLowerCase();
                    const inputs = Array.from(document.querySelectorAll('input'));
                    const has2FAInput = inputs.some(i => {
                        const name = (i.name || i.id || i.placeholder || i.autocomplete || '').toLowerCase();
                        return name.includes('code') || name.includes('otp') || name.includes('2fa') || name.includes('token') || name.includes('verification') || name.includes('pin') || name.includes('digit') || i.type === 'number';
                    }) || inputs.length === 6;

                    const matchesText = text.includes('authenticator') || 
                                        text.includes('2-step') || 
                                        text.includes('two-factor') || 
                                        text.includes('verification code') || 
                                        text.includes('security code') ||
                                        text.includes('provide 2fa') ||
                                        text.includes('enter 2fa') ||
                                        text.includes('2fa verification') ||
                                        text.includes('autenticação') ||
                                        text.includes('verificação') ||
                                        text.includes('código de segurança') ||
                                        text.includes('enter the code');
                    return matchesText || (has2FAInput && (text.includes('code') || text.includes('2fa') || text.includes('código')));
                });

                if (is2FA) {
                    foundFrame = frame;
                    break;
                }
            } catch (e) {}
        }

        if (foundFrame) {
            writeLog('info', `🔐 DETECTADA CAIXA 'PROVIDE 2FA VERIFICATION'! Verificando tempo restante do ciclo de 30s...`);

            // GARANTIA ANTI-EXPIRAÇÃO: Se faltarem menos de 4s para os 30s expirarem, aguarda o novo ciclo de 30s completos!
            const nowSec = Math.floor(Date.now() / 1000);
            const secondsLeftInWindow = 30 - (nowSec % 30);
            if (secondsLeftInWindow < 4) {
                const waitTime = secondsLeftInWindow + 1;
                writeLog('info', `⏳ Faltam apenas ${secondsLeftInWindow}s para o ciclo de 30s expirar. Aguardando ${waitTime}s para gerar um código novo com 30s completos de validade...`);
                await new Promise(r => setTimeout(r, waitTime * 1000));
            }

            let code = '';
            try {
                const speakeasy = require('speakeasy');
                code = speakeasy.totp({
                    secret: secret.replace(/\s+/g, '').toUpperCase(),
                    encoding: 'base32'
                });
            } catch (err) {
                const { generate } = require('otplib');
                code = await generate({ secret: secret.replace(/\s+/g, '').toUpperCase() });
            }
            writeLog('info', `🔐 Código 2FA gerado pelo robô com sucesso: ${code}`);

            const typed = await foundFrame.evaluate(async (totpCode) => {
                // Filtra apenas inputs visíveis e ignora barra de busca e elementos do cabeçalho/navegação
                const allInputs = Array.from(document.querySelectorAll('input')).filter(i => {
                    if (i.type === 'hidden') return false;
                    if (i.closest('header, nav, [class*="search"], [class*="header"]')) return false;
                    const style = window.getComputedStyle(i);
                    return style.display !== 'none' && style.visibility !== 'hidden' && i.offsetWidth > 0 && i.offsetHeight > 0;
                });

                // Prioriza inputs dentro de modals/dialogs/overlays de 2FA se existirem
                const modalInputs = allInputs.filter(i => i.closest('[role="dialog"], [class*="modal"], [class*="popup"], [class*="overlay"], [class*="2fa"], [class*="auth"], form'));
                const targetInputs = modalInputs.length > 0 ? modalInputs : allInputs;

                const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

                // Caso 1: 6 inputs individuais (1 dígito cada)
                const digitInputs = targetInputs.filter(i => i.maxLength === 1 || i.getAttribute('inputmode') === 'numeric' || (i.name || i.id || '').toLowerCase().includes('digit'));
                if ((digitInputs.length === 6 || targetInputs.length === 6) && totpCode.length === 6) {
                    const listToFill = digitInputs.length === 6 ? digitInputs : targetInputs;
                    for (let i = 0; i < 6; i++) {
                        listToFill[i].focus();
                        setVal.call(listToFill[i], totpCode[i]);
                        listToFill[i].dispatchEvent(new Event('input', { bubbles: true }));
                        listToFill[i].dispatchEvent(new Event('change', { bubbles: true }));
                        listToFill[i].dispatchEvent(new KeyboardEvent('keyup', { key: totpCode[i], bubbles: true }));
                    }
                    return true;
                }

                // Caso 2: Input único de 6 dígitos específico de 2FA/Código
                const targetInput = targetInputs.find(i => {
                    const name = (i.name || i.id || i.placeholder || i.autocomplete || i.ariaLabel || '').toLowerCase();
                    return name.includes('code') || name.includes('otp') || name.includes('2fa') || name.includes('token') || name.includes('verification') || name.includes('pin') || i.autocomplete === 'one-time-code';
                }) || (targetInputs.length === 1 ? targetInputs[0] : null);

                if (targetInput) {
                    targetInput.focus();
                    setVal.call(targetInput, totpCode);
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    targetInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
                    return true;
                }
                return false;
            }, code);

            if (typed) {
                await new Promise(r => setTimeout(r, 500));
                await page.keyboard.press('Enter');
                
                await foundFrame.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
                    const subBtn = btns.find(b => {
                        const txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                        return txt.includes('verify') || txt.includes('confirm') || txt.includes('submit') || txt.includes('continuar') || txt.includes('enter') || txt.includes('enviar');
                    });
                    if (subBtn) subBtn.click();
                });
                await new Promise(r => setTimeout(r, 3000));
                writeLog('info', `✅ Código 2FA submetido com sucesso pelo robô!`);
                return true;
            }
        }
    } catch (e) {
        writeLog('error', `Falha ao processar 2FA automático: ${e.message}`);
    }
    return false;
}

async function handleCloudflareTurnstile(page) {
    try {
        const frames = page.frames();
        for (const frame of frames) {
            if (frame.url().includes('cloudflare') || frame.url().includes('turnstile') || frame.url().includes('challenges')) {
                const checkbox = await frame.$('input[type="checkbox"], label, .mark, #challenge-stage');
                if (checkbox) {
                    writeLog('info', `⚡ [CLOUDFLARE] Desafio 'Verify you are human' detectado. Clicando no checkbox de verificação...`);
                    await checkbox.click();
                    await new Promise(r => setTimeout(r, 2500));
                    return true;
                }
            }
        }
    } catch (e) {
        writeLog('warn', `Aviso ao tratar Cloudflare Turnstile: ${e.message}`);
    }
    return false;
}

async function ensureEnebaLogin(page, orderId = null, dbSaveFn = null) {
    try {
        await handleCloudflareTurnstile(page);
        const email = process.env.ENEBA_BOT_EMAIL || process.env.ENEBA_EMAIL || 'zherkeys@gmail.com';
        const password = process.env.ENEBA_BOT_PASSWORD || process.env.ENEBA_PASSWORD || 'Caio40028922!';

        // Dispensa banners de cookies se houver
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const aceitarBtn = btns.find(b => (b.innerText || '').toLowerCase().includes('aceitar tudo') || (b.innerText || '').toLowerCase().includes('aceitar') || (b.innerText || '').trim() === 'Sim');
            if (aceitarBtn) aceitarBtn.click();
        });

        // 1. Verifica se existe o botão de Login na página
        const hasLoginBtn = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('a, button, span'));
            const loginBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('log in') || txt.includes('entrar') || txt.includes('registrar-se');
            });
            if (loginBtn) {
                loginBtn.click();
                return true;
            }
            return false;
        });

        if (hasLoginBtn) {
            writeLog('info', `🔑 Botão de Login detectado! Abrindo modal e iniciando autenticação...`);
            await new Promise(r => setTimeout(r, 2000));
            await saveStepScreenshot(page, '01_login_modal_opened', orderId, dbSaveFn);

            // Preenche e-mail
            await page.evaluate((uEmail) => {
                const el = document.querySelector('input[type="email"], input[name="email"], input[id*="email"]');
                if (el) {
                    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    el.focus();
                    setVal.call(el, uEmail);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, email);
            await new Promise(r => setTimeout(r, 1000));
            await saveStepScreenshot(page, '02_email_filled', orderId, dbSaveFn);

            // Clica em "Log in with password"
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, a'));
                const passBtn = btns.find(b => {
                    const txt = (b.innerText || b.textContent || '').toLowerCase();
                    return txt.includes('log in with password') || txt.includes('entrar com senha') || txt.includes('password') || txt.includes('continuar');
                });
                if (passBtn) passBtn.click();
            });
            await new Promise(r => setTimeout(r, 2000));

            // Preenche Senha
            await page.evaluate((uPass) => {
                const el = document.querySelector('input[type="password"], input[name="password"], input[id*="password"]');
                if (el) {
                    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    el.focus();
                    setVal.call(el, uPass);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, password);
            await new Promise(r => setTimeout(r, 1000));
            await saveStepScreenshot(page, '03_password_filled', orderId, dbSaveFn);

            // Clica em Log in
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                const sub = btns.find(b => {
                    const txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                    return txt.includes('log in') || txt.includes('entrar') || txt.includes('sign in');
                });
                if (sub) sub.click();
            });

            await new Promise(r => setTimeout(r, 3000));
            await handleCloudflareTurnstile(page);

            // Processa o 2FA
            await handleEneba2FAPrompt(page);
            await saveStepScreenshot(page, '04_2fa_completed', orderId, dbSaveFn);
            writeLog('info', `✅ Login no Eneba concluído com sucesso com E-mail, Senha e 2FA!`);
        } else {
            writeLog('info', `✅ Sessão ativa detectada (sem botão de Login). Prosseguindo direto para a compra...`);
        }
    } catch (err) {
        writeLog('warn', `Aviso na checagem de login Eneba: ${err.message}`);
    }
}

function cleanOldScreenshots(maxKeep = 25) {
    try {
        if (!fs.existsSync(screenshotsDir)) return;
        const files = fs.readdirSync(screenshotsDir)
            .filter(f => f.endsWith('.png'))
            .map(f => {
                const p = path.join(screenshotsDir, f);
                return { name: f, path: p, time: fs.statSync(p).mtimeMs };
            })
            .sort((a, b) => b.time - a.time);

        if (files.length > maxKeep) {
            const toDelete = files.slice(maxKeep);
            toDelete.forEach(f => {
                try { fs.unlinkSync(f.path); } catch (err) {}
            });
        }
    } catch (e) {}
}

async function saveStepScreenshot(page, stepName, orderId = null, dbSaveFn = null) {
    try {
        cleanOldScreenshots(15);
        await dismissGreenWelcomeBanner(page);
        
        let targetDir = screenshotsDir;
        if (orderId) {
            targetDir = path.join(screenshotsDir, `pedido_${orderId}`);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        }

        const cleanName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const screenPath = path.join(targetDir, `${Date.now()}_${cleanName}.jpg`);
        
        // 📸 Screenshot otimizada JPEG (qualidade 65%)
        const imageBuffer = await page.screenshot({ type: 'jpeg', quality: 65, fullPage: false });
        fs.writeFileSync(screenPath, imageBuffer);
        
        const base64Str = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        const logMsg = `[${new Date().toISOString()}] 📸 Screenshot da etapa "${cleanName}" gerada.`;
        writeLog('info', `📸 Screenshot salva (${orderId ? 'Pedido #' + orderId : 'Geral'}): ${cleanName}`);
        
        // Persiste a imagem DIRETAMENTE no banco de dados
        if (orderId && typeof dbSaveFn === 'function') {
            await dbSaveFn(orderId, cleanName, base64Str, logMsg).catch(() => {});
        } else if (orderId) {
            const siteUrl = process.env.ZHERKEYS_SITE_URL || `http://127.0.0.1:${process.env.PORT || 10000}`;
            fetch(`${siteUrl}/api/bot/save-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: orderId,
                    stepName: cleanName,
                    screenshotBase64: base64Str,
                    logText: logMsg
                })
            }).catch(() => {});
        }
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function autoBuyEnebaKeyWeb(productTitle, quantity = 1, orderId = null, dbSaveFn = null) {
    writeLog('info', `===============================================================`);
    writeLog('info', `🤖 PROCESSANDO AUTO-COMPRA ENEBA ${orderId ? 'PARA O PEDIDO #' + orderId : 'GERAL'}`);
    writeLog('info', `🤖 INICIANDO AUTOMAÇÃO DE COMPRA ENEBA: "${productTitle}" (${quantity} unid)`);
    writeLog('info', `===============================================================`);
    
    let browser = null;
    
    try {
        const userDataDir = path.join(__dirname, 'eneba_bot_session');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        const winChromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync(winChromePath) ? winChromePath : undefined);
        
        writeLog('info', `Lançando navegador Puppeteer Stealth em Nuvem/Local... (Executable: ${chromePath ? chromePath : 'Bundled Chromium'})`);

        clearStaleSessionLocks(userDataDir);
        const lowMemoryFlags = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-default-apps',
            '--mute-audio',
            '--no-default-browser-check',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-component-update',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--disable-sync',
            '--window-size=1280,720',
            '--js-flags="--max-old-space-size=128"'
        ];

        try {
            browser = await puppeteer.launch({
                headless: true,
                executablePath: chromePath,
                userDataDir: userDataDir,
                args: lowMemoryFlags
            });
        } catch (launchErr) {
            if (launchErr.message && launchErr.message.includes('already running')) {
                writeLog('warn', `⚠️ Sessão do Chrome bloqueada detectada. Forçando limpeza de locks e tentando novamente...`);
                clearStaleSessionLocks(userDataDir);
                await new Promise(r => setTimeout(r, 1200));
                browser = await puppeteer.launch({
                    headless: true,
                    executablePath: chromePath,
                    userDataDir: userDataDir,
                    args: lowMemoryFlags
                });
            } else {
                throw launchErr;
            }
        }

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 1. Acessa produto na Eneba (Suporta tanto Link Direto quanto busca por Título)
        const cleanProductTarget = (productTitle || '').trim();
        let fullProductUrl = '';

        if (cleanProductTarget.startsWith('http://') || cleanProductTarget.startsWith('https://') || cleanProductTarget.includes('eneba.com')) {
            fullProductUrl = cleanProductTarget;
            writeLog('info', `[ETAPA 1/6] Link direto detectado! Navegando diretamente para: ${fullProductUrl}`);
            await page.goto(fullProductUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            await saveStepScreenshot(page, '01_direct_product_page', orderId, dbSaveFn);
        } else {
            const searchUrl = `https://www.eneba.com/store/all?text=${encodeURIComponent(cleanProductTarget)}`;
            writeLog('info', `[ETAPA 1/6] Navegando até busca: ${searchUrl}`);
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            await saveStepScreenshot(page, '01_search_page', orderId, dbSaveFn);

            const productHref = await page.evaluate((titleStr) => {
                const titleWords = titleStr.toLowerCase().split(' ').filter(w => w.length > 2);
                const anchors = Array.from(document.querySelectorAll('main a[href], div[class*="catalog"] a[href], div[class*="grid"] a[href]'));
                
                const matched = anchors.find(a => {
                    const href = (a.getAttribute('href') || '').toLowerCase();
                    if (href.includes('surfshark') || href.includes('nordvpn') || href.includes('itm_source=')) return false;
                    const text = (a.innerText || '').toLowerCase();
                    return (href.includes('-key-') || href.includes('-code-') || href.includes('-steam-') || href.includes('/item/')) &&
                           titleWords.some(w => href.includes(w) || text.includes(w));
                });

                return matched ? matched.getAttribute('href') : null;
            }, cleanProductTarget);

            if (!productHref) {
                writeLog('error', `❌ Produto "${cleanProductTarget}" não encontrado na Eneba.`);
                await saveStepScreenshot(page, '01_error_product_not_found', orderId, dbSaveFn);
                await browser.close();
                return [];
            }

            fullProductUrl = productHref.startsWith('http') ? productHref : `https://www.eneba.com${productHref}`;
            writeLog('info', `[ETAPA 2/6] Acessando página do produto: ${fullProductUrl}`);
            await page.goto(fullProductUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            await saveStepScreenshot(page, '02_product_page', orderId, dbSaveFn);
        }

        // Verifica se é necessário fazer login com E-mail + Senha + 2FA
        await ensureEnebaLogin(page, orderId, dbSaveFn);

        // 2. Clica no botão de Compra / Buy Now
        writeLog('info', `[ETAPA 2/6] Procurando e clicando no botão 'Comprar Agora'...`);
        const buyBtnClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const targetBtn = buttons.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('buy now') || txt.includes('comprar agora') || txt.includes('buy with');
            });
            if (targetBtn) {
                targetBtn.click();
                return { success: true, text: targetBtn.innerText };
            }
            return { success: false };
        });

        writeLog('info', `Resultado clique no botão de compra:`, buyBtnClicked);

        if (!buyBtnClicked.success) {
            writeLog('error', `❌ Botão 'Comprar Agora' não encontrado na página do produto.`);
            await saveStepScreenshot(page, '02_error_no_buy_button', orderId, dbSaveFn);
            await browser.close();
            return [];
        }

        await new Promise(r => setTimeout(r, 3000));

        // 3. Etapa do Carrinho / E-mail no Checkout (https://www.eneba.com/checkout)
        if (!page.url().includes('/checkout')) {
            writeLog('info', `[ETAPA 3/6] Redirecionando para checkout (https://www.eneba.com/checkout)...`);
            await page.goto('https://www.eneba.com/checkout', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        }
        
        await saveStepScreenshot(page, '03_checkout_cart', orderId, dbSaveFn);
        writeLog('info', `[ETAPA 3/6] URL atual no checkout: ${page.url()}`);

        // Remove todos os itens antigos acumulados do carrinho mantendo apenas a compra atual com Qty 1
        const removedCount = await page.evaluate(async () => {
            let count = 0;
            const getRemoveBtns = () => Array.from(document.querySelectorAll('button')).filter(b => {
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                return aria.includes('remove item from cart') || aria.includes('remover item');
            });
            
            let btns = getRemoveBtns();
            while (btns.length > 1) {
                btns[0].click();
                count++;
                await new Promise(r => setTimeout(r, 1200));
                btns = getRemoveBtns();
            }

            // Garante que a quantidade do único item restante no carrinho seja reduzida para 1
            const minusBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                const txt = (b.innerText || b.textContent || '').trim();
                return txt === '-' || aria.includes('reduce');
            });
            for (let btn of minusBtns) {
                for (let i = 0; i < 10; i++) {
                    btn.click();
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            return count;
        });

        if (removedCount > 0) {
            writeLog('info', `🧹 Removidos ${removedCount} itens antigos acumulados do carrinho e quantidade reduzida para 1.`);
            await new Promise(r => setTimeout(r, 2000));
        }

        const botEmail = process.env.ENEBA_BOT_EMAIL || 'zherkeys@gmail.com';
        const emailField = await page.$('input[name="email"], input[type="email"]');
        if (emailField) {
            const currentVal = await page.evaluate(el => el.value, emailField);
            if (!currentVal) {
                writeLog('info', `Preenchendo e-mail de entrega (${botEmail})...`);
                await emailField.type(botEmail, { delay: 20 });
            }
        }

        // Clica em 'Proceed to checkout' / 'Continuar para pagamento'
        writeLog('info', `Clicando em 'Proceed to checkout'...`);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const target = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('proceed to checkout') || txt.includes('continuar para pagamento') || txt.includes('proceed to payment');
            });
            if (target) target.click();
        });

        await new Promise(r => setTimeout(r, 4000));
        await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);
        writeLog('info', `[ETAPA 4/6] URL na etapa de pagamento: ${page.url()}`);

        // 4. Etapa de Seleção de Pagamento (https://www.eneba.com/checkout/payment)
        if (page.url().includes('/checkout/payment')) {
            writeLog('info', `[ETAPA 4/6] Selecionando Eneba Wallet (Saldo Eneba)...`);
            
            const walletResult = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('button, div[role="button"], label, input, [class*="option"], [class*="payment"]'));
                const walletEl = elements.find(el => {
                    const txt = (el.innerText || el.textContent || el.value || '').toLowerCase();
                    return txt.includes('eneba wallet') || txt.includes('saldo eneba') || txt.includes('carteira') || txt.includes('pay with your eneba wallet');
                });
                if (walletEl) {
                    walletEl.click();
                    return { selected: true, text: (walletEl.innerText || walletEl.textContent || '').trim() };
                }
                return { selected: false };
            });

            writeLog('info', `Resultado seleção Eneba Wallet:`, walletResult);
            await new Promise(r => setTimeout(r, 2000));

            // Log snippets of payment options and page warnings
            const paymentPageSnippet = await page.evaluate(() => {
                const text = document.body.innerText || '';
                return text.substring(0, 1000);
            });
            writeLog('info', `Snippet da página de pagamento:`, paymentPageSnippet.substring(0, 300));

            if (paymentPageSnippet.includes('Not enough funds') || paymentPageSnippet.includes('The amount is not enough') || paymentPageSnippet.includes('Not enough balance')) {
                writeLog('error', `❌ SALDO INSUFICIENTE NA CARTEIRA ENEBA: O valor total deste jogo ultrapassou o saldo disponível.`);
                await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);
                await browser.close();
                return [];
            }

            // 1. Clica no botão de confirmação inicial 'Continue' / 'Proceed' / 'Pay with Eneba Wallet'
            writeLog('info', `Clicando no botão de confirmação inicial 'Continue'...`);
            const payClicked = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"], [role="button"]'));
                const payBtn = btns.find(b => {
                    if (b.closest('header, nav, [class*="breadcrumb"], [class*="step"]')) return false;
                    const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
                    if (txt === 'payment' || txt === 'cart' || txt.includes('apple pay') || txt.includes('google pay') || txt.includes('credit or debit')) return false;
                    return txt === 'continue' || txt === 'continuar' || txt.includes('proceed') || txt === 'pay now' || txt === 'pagar agora' || txt.includes('pay with') || b.type === 'submit';
                });
                if (payBtn) {
                    payBtn.click();
                    return { clicked: true, text: (payBtn.innerText || payBtn.textContent || '').trim() };
                }
                return { clicked: false };
            });
            writeLog('info', `Resultado clique 1º passo pagamento:`, payClicked);

            await new Promise(r => setTimeout(r, 2500));

            // 2. Se a página continuar em checkout/payment, clica no botão FINAL de confirmação ('Pay with Eneba wallet' / 'Pay now' / 'Confirm')
            if (page.url().includes('/checkout/payment')) {
                writeLog('info', `Procurando botão final de pagamento ('Pay with Eneba wallet' / 'Pay now')...`);
                const finalPayClicked = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"], a'));
                    const finalBtn = btns.find(b => {
                        if (b.closest('header, nav, ul, ol, [class*="step"], [class*="breadcrumb"]')) return false;
                        const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
                        if (txt === 'payment' || txt === 'cart' || txt === 'get your product') return false;
                        if (txt.includes('apple pay') || txt.includes('google pay') || txt.includes('credit or debit')) return false;
                        
                        return txt.includes('pay with') || txt.includes('pay now') || txt.includes('pagar') || txt === 'continue' || txt === 'continuar' || txt.includes('confirm') || b.type === 'submit';
                    });
                    if (finalBtn) {
                        finalBtn.click();
                        return { clicked: true, text: (finalBtn.innerText || finalBtn.textContent || '').trim() };
                    }
                    return { clicked: false };
                });
                writeLog('info', `Resultado clique final 2º passo:`, finalPayClicked);
            }

            // LOOP DE CONFIRMAÇÃO DE PAGAMENTO E MONITORAMENTO DE 2FA (até 30 segundos)
            writeLog('info', `⏳ Monitorando processamento do pagamento e verificação de 2FA por até 30s...`);
            const payStartTime = Date.now();
            let paymentSuccessNavigated = false;

            while (Date.now() - payStartTime < 30000) {
                // Tenta processar prompt de 2FA se surgir na página ou em IFrames
                const handled2FA = await handleEneba2FAPrompt(page);
                if (handled2FA) {
                    writeLog('info', `🔐 2FA submetido com sucesso! Aguardando processamento do pedido...`);
                    await new Promise(r => setTimeout(r, 4000));
                }

                const currentUrl = page.url();
                if (!currentUrl.includes('/checkout/payment') && (currentUrl.includes('/my-keys') || currentUrl.includes('/purchases') || currentUrl.includes('/success') || currentUrl.includes('/order') || currentUrl.includes('/item'))) {
                    writeLog('info', `✅ Pagamento confirmado e redirecionado para: ${currentUrl}`);
                    paymentSuccessNavigated = true;
                    break;
                }

                // Checa se surgiu erro de saldo ou recusa de pagamento
                const pageSnippetText = await page.evaluate(() => (document.body.innerText || '').toLowerCase()).catch(() => '');
                if (pageSnippetText.includes('not enough funds') || pageSnippetText.includes('insufficient balance') || pageSnippetText.includes('payment failed') || pageSnippetText.includes('pagamento recusado')) {
                    writeLog('error', `❌ PAGAMENTO RECUSADO OU SALDO INSUFICIENTE.`);
                    await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);
                    await browser.close();
                    return [];
                }

                await new Promise(r => setTimeout(r, 2000));
            }

            await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);
            writeLog('info', `URL após janela de monitoramento de pagamento: ${page.url()}`);

            // Se permaneceu em /checkout/payment após 30s, tenta navegar para Biblioteca de Chaves para verificar se o faturamento ocorreu
            if (page.url().includes('/checkout/payment') && !paymentSuccessNavigated) {
                writeLog('warn', `⚠️ Permanecido em /checkout/payment após 30s. Redirecionando para Biblioteca de Chaves (/my-keys) para verificar se a compra foi concluída...`);
            }
        }

        // 5. Ir para Biblioteca de Chaves / Meus Pedidos na Eneba (Keys Library)
        writeLog('info', `[ETAPA 5/6] Navegando para Biblioteca de Chaves (https://my.eneba.com/my-keys)...`);
        await page.goto('https://my.eneba.com/my-keys', { waitUntil: 'networkidle2', timeout: 45000 });
        await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);

        // Check if user is logged in on keys library page
        const isLoggedOnPurchases = await page.evaluate(() => {
            const text = document.body.innerText || '';
            const isLogin = location.href.includes('/login') || text.includes('Log in') && !text.includes('My keys') && !text.includes('Purchases');
            return !isLogin;
        });

        writeLog('info', `Status de login em /my-keys: ${isLoggedOnPurchases ? 'LOGADO ✅' : 'NÃO LOGADO ⚠️'}`);

        if (!isLoggedOnPurchases) {
            writeLog('warn', `⚠️ Sessão da Eneba não autenticada! Executando Login Automático pelo Robô (100% Autônomo)...`);
            await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);
            
            const botEmail = process.env.ENEBA_BOT_EMAIL || 'zherkeys@gmail.com';
            const botPass = process.env.ENEBA_BOT_PASSWORD || 'Caio40028922!';

            await page.goto('https://my.eneba.com/login', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
            
            const emailIn = await page.$('input[name="email"], input[type="email"]');
            if (emailIn) {
                await emailIn.click({ clickCount: 3 });
                await emailIn.type(botEmail, { delay: 30 });
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 2500));
            }

            const passIn = await page.$('input[name="password"], input[type="password"]');
            if (passIn) {
                await passIn.click({ clickCount: 3 });
                await passIn.type(botPass, { delay: 30 });
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 4000));
            }

            writeLog('info', `Formulário de login preenchido e submetido.`);
            await handleEneba2FAPrompt(page);
            await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);

            // Retorna para a Biblioteca de Chaves do usuário
            await page.goto('https://my.eneba.com/my-keys', { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null);
            await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);
        }

        // Clica no pedido MAIS RECENTE E NÃO REVELADO que corresponda ao produto comprado
        writeLog('info', `[ETAPA 6/6] Procurando o produto "${productTitle}" mais recente NÃO REVELADO na biblioteca...`);
        const redeemClicked = await page.evaluate((targetTitle) => {
            // Extrai palavras-chave do título do produto para busca precisa no DOM
            const titleWords = targetTitle.toLowerCase()
                .replace(/https?:\/\/[^\s]+/gi, '')
                .replace(/[^a-z0-9\s]/gi, ' ')
                .split(' ')
                .filter(w => w.length > 2 && !['key', 'code', 'dlc', 'global', 'steam', 'xbox', 'pc', 'edition'].includes(w));

            // Seleciona todos os containers de itens da biblioteca de chaves
            const orderCards = Array.from(document.querySelectorAll('main div[class*="card"], main div[class*="item"], main div[class*="row"], main div[class*="purchase"], main li, table tr'));
            
            // Filtra os cards que contêm o título do produto E possuem o botão de revelar a chave ATIVO (NÃO REVELADO)
            const matchingUnrevealedCards = orderCards.filter(card => {
                const cardText = (card.innerText || card.textContent || '').toLowerCase();
                const matchesTitle = titleWords.some(word => cardText.includes(word));
                // Garante que o item possui botão de revelar chave e não foi exibido anteriormente
                const hasDisplayBtn = cardText.includes('display key') || cardText.includes('exibir chave') || cardText.includes('mostrar chave') || cardText.includes('view key') || cardText.includes('get key') || cardText.includes('view code');
                const isAlreadyRevealed = cardText.includes('key revealed') || cardText.includes('chave exibida') || cardText.includes('revealed');
                
                return matchesTitle && hasDisplayBtn && !isAlreadyRevealed;
            });

            // Se não encontrou pendente não revelado, tenta qualquer card correspondente ao produto
            const targetCard = matchingUnrevealedCards.length > 0 ? matchingUnrevealedCards[0] : (
                orderCards.find(card => titleWords.some(w => (card.innerText || card.textContent || '').toLowerCase().includes(w))) || document.body
            );

            // Procura o botão 'Display key' / 'Exibir chave' DENTRO do card específico
            const btns = Array.from(targetCard.querySelectorAll('button, a'));
            const targetBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                const href = (b.getAttribute('href') || '').toLowerCase();
                
                // IGNORA links de resgatar vale-presente / gift card / suporte / header
                if (txt.includes('gift card') || href.includes('gift-card') || href.includes('redeem-gift') || txt.includes('vale-presente')) return false;
                
                return txt.includes('display key') || txt.includes('mostrar chave') || txt.includes('exibir chave') || txt.includes('ver chave') || txt.includes('view key') || txt.includes('get key') || txt.includes('view code');
            });

            if (targetBtn) {
                targetBtn.click();
                return { clicked: true, text: targetBtn.innerText, isUnrevealedMatch: matchingUnrevealedCards.length > 0 };
            }

            // Fallback: Procura qualquer botão de chave não revelado na página
            const allBtns = Array.from(document.querySelectorAll('button, a'));
            const fallbackBtn = allBtns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                const href = (b.getAttribute('href') || '').toLowerCase();
                if (txt.includes('gift card') || href.includes('gift-card') || href.includes('redeem-gift') || txt.includes('vale-presente')) return false;
                return txt.includes('display key') || txt.includes('mostrar chave') || txt.includes('exibir chave') || txt.includes('ver chave') || txt.includes('view key') || txt.includes('get key') || txt.includes('view code');
            });

            if (fallbackBtn) {
                fallbackBtn.click();
                return { clicked: true, text: fallbackBtn.innerText, isUnrevealedMatch: false };
            }

            return { clicked: false };
        }, productTitle);

        writeLog('info', `Resultado clique para resgatar chave do produto:`, redeemClicked);
        
        if (!redeemClicked.clicked) {
            writeLog('error', `❌ Botão de resgatar chave ('Display key') não foi encontrado na página de compras. A compra pode não ter sido concluída.`);
            await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);
            await browser.close();
            return [];
        }

        await new Promise(r => setTimeout(r, 3000));
        await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);

        // Tenta aceitar termos/avisos de região se houver popup
        const confirmClicked = await page.evaluate(() => {
            const confirmBtns = Array.from(document.querySelectorAll('button'));
            const confirm = confirmBtns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('redeem key') || txt.includes('exibir chave') || txt.includes('confirm') || txt.includes('continuar');
            });
            if (confirm) {
                confirm.click();
                return { clicked: true, text: confirm.innerText };
            }
            return { clicked: false };
        });

        writeLog('info', `Resultado clique de confirmação de termos/região:`, confirmClicked);
        await new Promise(r => setTimeout(r, 3000));
        await saveStepScreenshot(page, 'step_screenshot', orderId, dbSaveFn);

        // 6. Procura por CD-Keys no DOM (inputs, textareas, tags <code>, classes key)
        const domKeys = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('input[readonly], input[type="text"], textarea, code, pre, [class*="key"], [class*="code"], [id*="key"]'));
            const values = els.map(el => el.value || el.innerText || el.textContent || '').map(v => v.trim());
            return values.filter(v => v.length >= 8 && v.length <= 45 && !v.toLowerCase().includes('http') && !v.toLowerCase().includes('eneba'));
        });

        const pageContent = await page.content();
        
        // Padrões de CD-Key flexíveis (Steam 5x5, COD 4x3 / 4x4, Xbox 5x5, EA, etc.)
        const keyPatterns = [
            /[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}(-[A-Z0-9]{4,5})?(-[A-Z0-9]{4,5})?/gi, // XXXXX-XXXXX-XXXXX (-XXXXX)
            /[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/gi,                                       // XXXX-XXXX-XXXX (COD / DLCs)
            /[A-Z0-9]{12,25}/gi                                                            // Alfanumérico contínuo (12-25 chars)
        ];

        let foundKeys = [...domKeys];
        for (let pattern of keyPatterns) {
            const matches = pageContent.match(pattern);
            if (matches && matches.length > 0) {
                foundKeys = foundKeys.concat(matches);
            }
        }

        // Filtra falsos positivos de UUIDs, datas, scripts ou termos da Eneba
        const validKeys = Array.from(new Set(foundKeys.map(k => k.trim().toUpperCase()))).filter(k => {
            if (!k || k.length < 8 || k.length > 40) return false;
            if (k.includes('ENEBA') || k.includes('CHROME') || k.includes('UTF-8') || k.includes('MODAL') || k.includes('SCRIPT') || k.includes('GIFT') || k.includes('REDEEM') || k.includes('CARD') || k.includes('TOKEN')) return false;
            // Garante que a chave possui tanto números quanto letras ou hífens
            return /[A-Z]/.test(k) && /[0-9]/.test(k);
        });

        if (validKeys.length > 0) {
            const extractedKeys = validKeys.slice(0, quantity);
            writeLog('info', `🎉 SUCESSO ABSOLUTO! ${extractedKeys.length} chave(s) obtida(s) pelo robô:`, extractedKeys);
            await browser.close();
            return extractedKeys;
        }

        writeLog('warn', `⚠️ Compra processada na Eneba, porém a leitura automática não extraiu os caracteres. Verifique as screenshots em logs/screenshots/`);
        await browser.close();
        return [];

    } catch (err) {
        writeLog('error', `❌ Erro inesperado durante execução do robô: ${err.message || err}`, { stack: err.stack });
        if (browser) await browser.close();
        return [];
    }
}

module.exports = { autoBuyEnebaKeyWeb };
