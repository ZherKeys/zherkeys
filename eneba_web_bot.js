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
    console.log(`[BOT-ENEBA] 🤖 Iniciando robô de navegação para comprar "${productTitle}"...`);
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
            userDataDir: userDataDir
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 0. Autenticação direta com E-mail e Senha
        const botEmail = process.env.ENEBA_BOT_EMAIL || 'zherkeys@gmail.com';
        const botPassword = process.env.ENEBA_BOT_PASSWORD || 'Caio40028922!';

        try {
            console.log(`[BOT-ENEBA] Verificando login em https://www.eneba.com/login...`);
            await page.goto('https://www.eneba.com/login', { waitUntil: 'networkidle2', timeout: 30000 });

            const emailField = await page.$('input[name="email"], input[type="email"]');
            if (emailField) {
                console.log(`[BOT-ENEBA] Efetuando login automático para (${botEmail})...`);
                await page.type('input[name="email"], input[type="email"]', botEmail, { delay: 40 });
                
                const passField = await page.$('input[name="password"], input[type="password"]');
                if (passField) {
                    await page.type('input[name="password"], input[type="password"]', botPassword, { delay: 40 });
                }

                const submitBtn = await page.$('button[type="submit"]');
                if (submitBtn) {
                    await submitBtn.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null);
                }
            }
        } catch (e) {
            console.warn(`[BOT-ENEBA] Aviso no login inicial (prosseguindo com busca):`, e.message || e);
        }

        // 1. Acessa a Eneba
        const searchUrl = `https://www.eneba.com/store/all?text=${encodeURIComponent(productTitle)}`;
        console.log(`[BOT-ENEBA] NAVEGANDO ATÉ: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // 2. Aguarda e clica no primeiro resultado relevante do catálogo principal
        const itemSelector = 'main a[href*="-key-"], main a[href*="-code-"], main a[href*="/item/"], main a[href*="-steam-"], main a[href*="-xbox-"], main a[data-qa*="product-card"]';
        await page.waitForSelector(itemSelector, { timeout: 15000 }).catch(() => null);

        const productHref = await page.evaluate((title) => {
            const cleanWord = title.toLowerCase().split(' ')[0];
            const links = Array.from(document.querySelectorAll('main a[href*="-key-"], main a[href*="-code-"], main a[href*="/item/"], main a[href*="-steam-"], main a[href*="-xbox-"], main a[data-qa*="product-card"]'));
            const matched = links.find(a => (a.getAttribute('href') || '').toLowerCase().includes(cleanWord)) || links[0];
            return matched ? matched.getAttribute('href') : null;
        }, productTitle);

        if (!productHref) {
            console.error(`[BOT-ENEBA] ❌ Produto "${productTitle}" não encontrado na Eneba.`);
            await browser.close();
            return [];
        }

        const fullProductUrl = productHref.startsWith('http') ? productHref : `https://www.eneba.com${productHref}`;
        console.log(`[BOT-ENEBA] ACESSANDO PÁGINA DO PRODUTO: ${fullProductUrl}`);
        await page.goto(fullProductUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // 3. Verifica e clica no botão de Compra / Buy Now
        console.log(`[BOT-ENEBA] Procurando botão de compra para "${productTitle}"...`);
        const buyBtnClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const targetBtn = buttons.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('comprar') || txt.includes('buy now') || txt.includes('adicionar');
            });
            if (targetBtn) {
                targetBtn.click();
                return true;
            }
            return false;
        });

        if (buyBtnClicked) {
            console.log(`[BOT-ENEBA] Clicou no botão de compra de "${productTitle}"!`);
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
        }

        // 4. Procura por padrão de CD-Key na página final
        const pageContent = await page.content();
        const keyPattern = /[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}(-[A-Z0-9]{4,5})?/g;
        const matches = pageContent.match(keyPattern);

        if (matches && matches.length > 0) {
            const extractedKeys = Array.from(new Set(matches)).slice(0, quantity);
            console.log(`[BOT-ENEBA] 🔑 SUCESSO! ${extractedKeys.length} chave(s) extraída(s) pelo robô:`, extractedKeys);
            await browser.close();
            return extractedKeys;
        }

        console.warn(`[BOT-ENEBA] ⚠️ Compra iniciada, mas nenhuma chave visível automaticamente. Verifique os pedidos na Eneba.`);
        await browser.close();
        return [];

    } catch (err) {
        console.error(`[BOT-ENEBA] ❌ Erro durante automação do robô:`, err.message || err);
        if (browser) await browser.close();
        return [];
    }
}

module.exports = { autoBuyEnebaKeyWeb };
