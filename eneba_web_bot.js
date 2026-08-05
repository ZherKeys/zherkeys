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

        // 2. Aguarda e clica no primeiro resultado relevante
        await page.waitForSelector('a[href*="/item/"]', { timeout: 15000 }).catch(() => null);
        const firstProductLink = await page.$('a[href*="/item/"]');

        if (!firstProductLink) {
            console.error(`[BOT-ENEBA] ❌ Produto "${productTitle}" não encontrado na Eneba.`);
            await browser.close();
            return [];
        }

        const productHref = await page.evaluate(el => el.getAttribute('href'), firstProductLink);
        const fullProductUrl = productHref.startsWith('http') ? productHref : `https://www.eneba.com${productHref}`;
        console.log(`[BOT-ENEBA] ACESSANDO PÁGINA DO PRODUTO: ${fullProductUrl}`);
        await page.goto(fullProductUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // 3. Verifica botão de Compra / Buy Now
        const buyButtonSelector = 'button[type="submit"], button:has-text("Comprar agora"), button:has-text("Buy now")';
        await page.waitForSelector(buyButtonSelector, { timeout: 15000 }).catch(() => null);

        const buyBtn = await page.$(buyButtonSelector);
        if (buyBtn) {
            console.log(`[BOT-ENEBA] Clicando no botão de compra de "${productTitle}"...`);
            await buyBtn.click();
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
