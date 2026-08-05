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

async function saveStepScreenshot(page, stepName) {
    try {
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

        // 1. Busca produto na Eneba ignorando banners promocionais
        const searchUrl = `https://www.eneba.com/store/all?text=${encodeURIComponent(productTitle)}`;
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
        }, productTitle);

        if (!productHref) {
            writeLog('error', `❌ Produto "${productTitle}" não encontrado na Eneba.`);
            await saveStepScreenshot(page, '01_error_product_not_found');
            await browser.close();
            return [];
        }

        const fullProductUrl = productHref.startsWith('http') ? productHref : `https://www.eneba.com${productHref}`;
        writeLog('info', `[ETAPA 2/6] Acessando página do produto: ${fullProductUrl}`);
        await page.goto(fullProductUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await saveStepScreenshot(page, '02_product_page');

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
                const elements = Array.from(document.querySelectorAll('button, div[role="button"], label, input'));
                const walletEl = elements.find(el => {
                    const txt = (el.innerText || el.textContent || el.value || '').toLowerCase();
                    return txt.includes('eneba wallet') || txt.includes('saldo eneba');
                });
                if (walletEl) {
                    walletEl.click();
                    return { selected: true, text: walletEl.innerText || walletEl.textContent };
                }
                return { selected: false };
            });

            writeLog('info', `Resultado seleção Eneba Wallet:`, walletResult);
            await new Promise(r => setTimeout(r, 2000));

            // Log snippets of payment options and page warnings
            const paymentPageSnippet = await page.evaluate(() => {
                const text = document.body.innerText || '';
                return text.substring(0, 500);
            });
            writeLog('info', `Snippet da página de pagamento:`, paymentPageSnippet);

            // Clica em Continuar / Confirmar Pagamento
            writeLog('info', `Clicando no botão de confirmação 'Continue' / 'Pagar agora'...`);
            const payClicked = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, a'));
                const payBtn = btns.find(b => {
                    const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
                    // Ignora os cards de seleção de método de pagamento (ex: "Pay with your Eneba wallet")
                    if (txt.includes('wallet') || txt.includes('apple pay') || txt.includes('google pay') || txt.includes('credit or debit')) return false;
                    return txt === 'continue' || txt === 'continuar' || txt.includes('proceed') || txt === 'pay now' || txt === 'pagar agora' || b.type === 'submit';
                });
                if (payBtn) {
                    payBtn.click();
                    return { clicked: true, text: (payBtn.innerText || payBtn.textContent || '').trim() };
                }
                return { clicked: false };
            });
            writeLog('info', `Resultado clique pagamento final:`, payClicked);

            await new Promise(r => setTimeout(r, 7000));
            await saveStepScreenshot(page, '04_after_payment_click');
            writeLog('info', `URL 7s após pagamento: ${page.url()}`);
        }

        // 5. Ir para Meus Pedidos na Eneba para Revelar/Resgatar a Key
        writeLog('info', `[ETAPA 5/6] Navegando para Meus Pedidos (https://www.eneba.com/user/purchases)...`);
        await page.goto('https://www.eneba.com/user/purchases', { waitUntil: 'networkidle2', timeout: 45000 });
        await saveStepScreenshot(page, '05_user_purchases');

        // Check if user is logged in on purchases page
        const isLoggedOnPurchases = await page.evaluate(() => {
            const text = document.body.innerText || '';
            const isLogin = location.href.includes('/login') || text.includes('Log in') && !text.includes('My purchases');
            return !isLogin;
        });

        writeLog('info', `Status de login em /user/purchases: ${isLoggedOnPurchases ? 'LOGADO ✅' : 'NÃO LOGADO ⚠️'}`);

        if (!isLoggedOnPurchases) {
            writeLog('error', `❌ Sessão da Eneba não autenticada! Abra o atalho 'ABRIR_LOGIN_ENEBA.bat' no Desktop para conectar a conta Eneba.`);
            await saveStepScreenshot(page, '05_error_not_logged_in');
            await browser.close();
            return [];
        }

        // Clica no primeiro pedido recente para visualizar/revelar a chave
        writeLog('info', `[ETAPA 6/6] Procurando pedido recente e botão 'Display key' / 'Mostrar chave'...`);
        const redeemClicked = await page.evaluate(() => {
            const redeemBtns = Array.from(document.querySelectorAll('button, a'));
            const target = redeemBtns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('display key') || txt.includes('mostrar chave') || txt.includes('redeem') || txt.includes('ver chave') || txt.includes('view key');
            });
            if (target) {
                target.click();
                return { clicked: true, text: target.innerText, href: target.getAttribute('href') };
            }
            return { clicked: false };
        });

        writeLog('info', `Resultado clique para resgatar chave:`, redeemClicked);
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

        // 6. Procura por padrões de CD-Key na página final
        const pageContent = await page.content();
        const keyPattern = /[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}(-[A-Z0-9]{4,5})?/g;
        const matches = pageContent.match(keyPattern);

        // Filtra possíveis falsos positivos de UUID/IDs da Eneba
        if (matches && matches.length > 0) {
            const validKeys = matches.filter(k => !k.includes('ENEBA') && !k.includes('UTF-8') && !k.includes('CHROME'));
            if (validKeys.length > 0) {
                const extractedKeys = Array.from(new Set(validKeys)).slice(0, quantity);
                writeLog('info', `🎉 SUCESSO ABSOLUTO! ${extractedKeys.length} chave(s) obtida(s) pelo robô:`, extractedKeys);
                await browser.close();
                return extractedKeys;
            }
        }

        writeLog('warn', `⚠️ Compra processada, porém nenhuma chave formatada foi encontrada no HTML. Verifique as screenshots em logs/screenshots/`);
        await browser.close();
        return [];

    } catch (err) {
        writeLog('error', `❌ Erro inesperado durante execução do robô: ${err.message || err}`, { stack: err.stack });
        if (browser) await browser.close();
        return [];
    }
}

module.exports = { autoBuyEnebaKeyWeb };
