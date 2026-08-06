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

async function handleEneba2FAPrompt(page) {
    try {
        const secret = process.env.ENEBA_2FA_SECRET;
        if (!secret) return false;

        const is2FA = await page.evaluate(() => {
            const text = (document.body.innerText || '').toLowerCase();
            const inputs = Array.from(document.querySelectorAll('input'));
            const has2FAInput = inputs.some(i => {
                const name = (i.name || i.id || i.placeholder || '').toLowerCase();
                return name.includes('code') || name.includes('otp') || name.includes('2fa') || name.includes('token') || name.includes('verification');
            });
            return (text.includes('authenticator') || text.includes('2-step') || text.includes('two-factor') || text.includes('verification code') || text.includes('security code')) && has2FAInput;
        });

        if (is2FA) {
            writeLog('info', `🔐 DETECTADA TELA DE 2FA (GOOGLE AUTHENTICATOR)! Gerando código de 6 dígitos...`);
            const { generate } = require('otplib');
            const code = await generate({ secret: secret.replace(/\s+/g, '').toUpperCase() });
            writeLog('info', `🔐 Código 2FA gerado pelo robô: ${code}`);

            const typed = await page.evaluate(async (totpCode) => {
                const inputs = Array.from(document.querySelectorAll('input'));
                const targetInput = inputs.find(i => {
                    const name = (i.name || i.id || i.placeholder || i.type || '').toLowerCase();
                    return name.includes('code') || name.includes('otp') || name.includes('2fa') || name.includes('token') || name.includes('verification') || i.type === 'number' || i.type === 'text';
                });
                if (targetInput) {
                    targetInput.focus();
                    targetInput.value = totpCode;
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            }, code);

            if (typed) {
                await new Promise(r => setTimeout(r, 500));
                await page.keyboard.press('Enter');
                
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
                    const subBtn = btns.find(b => {
                        const txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                        return txt.includes('verify') || txt.includes('confirm') || txt.includes('submit') || txt.includes('continuar') || txt.includes('enter');
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

async function saveStepScreenshot(page, stepName) {
    try {
        await dismissGreenWelcomeBanner(page);
        const cleanName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const screenPath = path.join(screenshotsDir, `${Date.now()}_${cleanName}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        writeLog('info', `📸 Screenshot salva: ${screenPath}`);
        
        // Save latest screenshot as well
        const latestPath = path.join(__dirname, 'eneba_checkout_debug.png');
        await page.screenshot({ path: latestPath, fullPage: true });
    } catch (e) {
        writeLog('warn', `Falha ao salvar screenshot (${stepName}): ${e.message}`);
    }
}

async function autoBuyEnebaKeyWeb(productTitle, quantity = 1) {
    writeLog('info', `===============================================================`);
    writeLog('info', `🤖 INICIANDO AUTOMAÇÃO DE COMPRA ENEBA: "${productTitle}" (${quantity} unid)`);
    writeLog('info', `===============================================================`);
    
    let browser = null;
    
    try {
        const userDataDir = path.join(__dirname, 'eneba_bot_session');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const hasCustomChrome = fs.existsSync(chromePath);
        
        writeLog('info', `Lançando navegador Puppeteer Stealth... (Executable: ${hasCustomChrome ? 'Chrome Oficial' : 'Bundled Chromium'})`);

        browser = await puppeteer.launch({
            headless: true, // Execute em segundo plano
            executablePath: hasCustomChrome ? chromePath : undefined,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
        });

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
            await saveStepScreenshot(page, '01_direct_product_page');
        } else {
            const searchUrl = `https://www.eneba.com/store/all?text=${encodeURIComponent(cleanProductTarget)}`;
            writeLog('info', `[ETAPA 1/6] Navegando até busca: ${searchUrl}`);
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            await saveStepScreenshot(page, '01_search_page');

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
                await saveStepScreenshot(page, '01_error_product_not_found');
                await browser.close();
                return [];
            }

            fullProductUrl = productHref.startsWith('http') ? productHref : `https://www.eneba.com${productHref}`;
            writeLog('info', `[ETAPA 2/6] Acessando página do produto: ${fullProductUrl}`);
            await page.goto(fullProductUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            await saveStepScreenshot(page, '02_product_page');
        }

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
            await saveStepScreenshot(page, '02_error_no_buy_button');
            await browser.close();
            return [];
        }

        await new Promise(r => setTimeout(r, 3000));

        // 3. Etapa do Carrinho / E-mail no Checkout (https://www.eneba.com/checkout)
        if (!page.url().includes('/checkout')) {
            writeLog('info', `[ETAPA 3/6] Redirecionando para checkout (https://www.eneba.com/checkout)...`);
            await page.goto('https://www.eneba.com/checkout', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        }
        
        await saveStepScreenshot(page, '03_checkout_cart');
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
        await saveStepScreenshot(page, '04_checkout_payment_step');
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
                await saveStepScreenshot(page, '04_error_insufficient_eneba_funds');
                await browser.close();
                return [];
            }

            // 1. Clica no botão de confirmação inicial 'Continue' / 'Proceed'
            writeLog('info', `Clicando no botão de confirmação inicial 'Continue'...`);
            const payClicked = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
                const payBtn = btns.find(b => {
                    const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
                    if (txt.includes('apple pay') || txt.includes('google pay') || txt.includes('credit or debit')) return false;
                    return txt === 'continue' || txt === 'continuar' || txt.includes('proceed') || txt === 'pay now' || txt === 'pagar agora' || b.type === 'submit';
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
                writeLog('info', `Procurando botão final de pagamento de 2º passo ('Pay now' / 'Confirm')...`);
                const finalPayClicked = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
                    const finalBtn = btns.find(b => {
                        const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
                        return txt.includes('pay') || txt.includes('pagar') || txt.includes('confirm') || txt.includes('submit') || txt.includes('continue');
                    });
                    if (finalBtn) {
                        finalBtn.click();
                        return { clicked: true, text: (finalBtn.innerText || finalBtn.textContent || '').trim() };
                    }
                    return { clicked: false };
                });
                writeLog('info', `Resultado clique final 2º passo:`, finalPayClicked);
            }

            await handleEneba2FAPrompt(page);

            await new Promise(r => setTimeout(r, 6000));
            await saveStepScreenshot(page, '04_after_payment_click');
            writeLog('info', `URL 6s após pagamento: ${page.url()}`);

            // VERIFICAÇÃO RIGOROSA: Se o pagamento não foi processado ou a página continuou em checkout/payment, CANCELA!
            if (page.url().includes('/checkout/payment')) {
                writeLog('error', `❌ FALHA NO PAGAMENTO: O robô não conseguiu confirmar o pagamento na Eneba. A compra NÃO foi realizada.`);
                await saveStepScreenshot(page, '04_error_payment_failed');
                await browser.close();
                return [];
            }
        }

        // 5. Ir para Biblioteca de Chaves / Meus Pedidos na Eneba (Keys Library)
        writeLog('info', `[ETAPA 5/6] Navegando para Biblioteca de Chaves (https://my.eneba.com/my-keys)...`);
        await page.goto('https://my.eneba.com/my-keys', { waitUntil: 'networkidle2', timeout: 45000 });
        await saveStepScreenshot(page, '05_user_keys_library');

        // Check if user is logged in on keys library page
        const isLoggedOnPurchases = await page.evaluate(() => {
            const text = document.body.innerText || '';
            const isLogin = location.href.includes('/login') || text.includes('Log in') && !text.includes('My keys') && !text.includes('Purchases');
            return !isLogin;
        });

        writeLog('info', `Status de login em /my-keys: ${isLoggedOnPurchases ? 'LOGADO ✅' : 'NÃO LOGADO ⚠️'}`);

        if (!isLoggedOnPurchases) {
            writeLog('warn', `⚠️ Sessão da Eneba não autenticada! Executando Login Automático pelo Robô (100% Autônomo)...`);
            await saveStepScreenshot(page, '05_attempting_auto_login');
            
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
            await saveStepScreenshot(page, '05_after_auto_login_attempt');

            // Retorna para a Biblioteca de Chaves do usuário
            await page.goto('https://my.eneba.com/my-keys', { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null);
            await saveStepScreenshot(page, '05_user_keys_library_after_login');
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
            await saveStepScreenshot(page, '06_error_no_display_key_button');
            await browser.close();
            return [];
        }

        await new Promise(r => setTimeout(r, 3000));
        await saveStepScreenshot(page, '06_key_display_modal');

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
        await saveStepScreenshot(page, '06_final_key_revealed');

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
