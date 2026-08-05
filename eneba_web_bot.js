/**
 * Eneba Web Automation Bot (No-API Auto-Fulfillment Engine)
 * Powered by Puppeteer Stealth
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

async function autoBuyEnebaKeyWeb(productTitle, quantity = 1) {
    console.log(`[BOT-ENEBA] 🤖 Iniciando robô de navegação para comprar "${productTitle}" (${quantity} unid)...`);
    let browser = null;
    
    try {
        const userDataDir = path.join(__dirname, 'eneba_bot_session');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

        browser = await puppeteer.launch({
            headless: true, // Execute em segundo plano
            executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 1. Busca produto na Eneba ignorando banners promocionais
        const searchUrl = `https://www.eneba.com/store/all?text=${encodeURIComponent(productTitle)}`;
        console.log(`[BOT-ENEBA] NAVEGANDO ATÉ BUSCA: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });

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
            console.error(`[BOT-ENEBA] ❌ Produto "${productTitle}" não encontrado na Eneba.`);
            await browser.close();
            return [];
        }

        const fullProductUrl = productHref.startsWith('http') ? productHref : `https://www.eneba.com${productHref}`;
        console.log(`[BOT-ENEBA] ACESSANDO PÁGINA DO PRODUTO: ${fullProductUrl}`);
        await page.goto(fullProductUrl, { waitUntil: 'networkidle2', timeout: 45000 });

        // 2. Clica no botão de Compra / Buy Now
        console.log(`[BOT-ENEBA] Clicando no botão de compra...`);
        const buyBtnClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const targetBtn = buttons.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('buy now') || txt.includes('comprar agora') || txt.includes('buy with');
            });
            if (targetBtn) {
                targetBtn.click();
                return true;
            }
            return false;
        });

        if (!buyBtnClicked) {
            console.error(`[BOT-ENEBA] ❌ Botão 'Comprar Agora' não encontrado na página.`);
            await browser.close();
            return [];
        }

        await new Promise(r => setTimeout(r, 3000));

        // 3. Etapa do Carrinho / E-mail no Checkout (https://www.eneba.com/checkout)
        if (!page.url().includes('/checkout')) {
            console.log(`[BOT-ENEBA] Redirecionando para https://www.eneba.com/checkout...`);
            await page.goto('https://www.eneba.com/checkout', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        }

        const botEmail = process.env.ENEBA_BOT_EMAIL || 'zherkeys@gmail.com';
        const emailField = await page.$('input[name="email"], input[type="email"]');
        if (emailField) {
            const currentVal = await page.evaluate(el => el.value, emailField);
            if (!currentVal) {
                console.log(`[BOT-ENEBA] Preenchendo e-mail de entrega (${botEmail})...`);
                await emailField.type(botEmail, { delay: 20 });
            }
        }

        // Clica em 'Proceed to checkout' / 'Continuar para pagamento'
        console.log(`[BOT-ENEBA] Avançando para etapa de pagamento...`);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const target = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('proceed to checkout') || txt.includes('continuar para pagamento') || txt.includes('proceed to payment');
            });
            if (target) target.click();
        });

        await new Promise(r => setTimeout(r, 4000));

        // 4. Etapa de Seleção de Pagamento (https://www.eneba.com/checkout/payment)
        if (page.url().includes('/checkout/payment')) {
            console.log(`[BOT-ENEBA] Selecionando Eneba Wallet (Saldo Eneba)...`);
            
            const walletSelected = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('button, div[role="button"], label, input'));
                const walletEl = elements.find(el => {
                    const txt = (el.innerText || el.textContent || el.value || '').toLowerCase();
                    return txt.includes('eneba wallet') || txt.includes('saldo eneba');
                });
                if (walletEl) {
                    walletEl.click();
                    return true;
                }
                return false;
            });

            console.log(`[BOT-ENEBA] Eneba Wallet selecionada: ${walletSelected}`);
            await new Promise(r => setTimeout(r, 2000));

            // Clica em Continuar / Confirmar Pagamento
            console.log(`[BOT-ENEBA] Efetuando pagamento final com o saldo...`);
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const payBtn = btns.find(b => {
                    const txt = (b.innerText || b.textContent || '').toLowerCase();
                    return txt.includes('continue') || txt.includes('pay') || txt.includes('pagar') || txt.includes('confirmar');
                });
                if (payBtn) payBtn.click();
            });

            await new Promise(r => setTimeout(r, 6000));
        }

        // 5. Ir para Meus Pedidos na Eneba para Revelar/Resgatar a Key
        console.log(`[BOT-ENEBA] Navegando para Meus Pedidos (https://www.eneba.com/user/purchases)...`);
        await page.goto('https://www.eneba.com/user/purchases', { waitUntil: 'networkidle2', timeout: 45000 });

        // Clica no primeiro pedido recente para visualizar/revelar a chave
        await page.evaluate(() => {
            const redeemBtns = Array.from(document.querySelectorAll('button, a'));
            const target = redeemBtns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('display key') || txt.includes('mostrar chave') || txt.includes('redeem') || txt.includes('ver chave') || txt.includes('view key');
            });
            if (target) target.click();
        });

        await new Promise(r => setTimeout(r, 3000));

        // Tenta aceitar termos/avisos de região se houver popup
        await page.evaluate(() => {
            const confirmBtns = Array.from(document.querySelectorAll('button'));
            const confirm = confirmBtns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('redeem key') || txt.includes('exibir chave') || txt.includes('confirm') || txt.includes('continuar');
            });
            if (confirm) confirm.click();
        });

        await new Promise(r => setTimeout(r, 3000));

        // 6. Procura por padrões de CD-Key na página final
        const pageContent = await page.content();
        const keyPattern = /[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}(-[A-Z0-9]{4,5})?/g;
        const matches = pageContent.match(keyPattern);

        // Filtra possíveis falsos positivos de UUID/IDs da Eneba
        if (matches && matches.length > 0) {
            const validKeys = matches.filter(k => !k.includes('ENEBA') && !k.includes('UTF-8'));
            if (validKeys.length > 0) {
                const extractedKeys = Array.from(new Set(validKeys)).slice(0, quantity);
                console.log(`[BOT-ENEBA] 🔑 SUCESSO ABSOLUTO! ${extractedKeys.length} chave(s) obtida(s):`, extractedKeys);
                await browser.close();
                return extractedKeys;
            }
        }

        // Tira screenshot de depuração caso a chave não esteja visível imediatamente
        const debugPic = path.join(__dirname, 'eneba_checkout_debug.png');
        await page.screenshot({ path: debugPic, fullPage: true });
        console.warn(`[BOT-ENEBA] ⚠️ Compra processada. Screenshot salva em eneba_checkout_debug.png`);

        await browser.close();
        return [];

    } catch (err) {
        console.error(`[BOT-ENEBA] ❌ Erro durante automação do robô:`, err.message || err);
        if (browser) await browser.close();
        return [];
    }
}

module.exports = { autoBuyEnebaKeyWeb };
