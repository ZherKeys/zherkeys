const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function debugEnebaCheckout() {
    console.log("🔍 DIAGNOSTICANDO CHECKOUT DA ENEBA PASSO A PASSO...");
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const userDataDir = path.join(__dirname, '..', 'eneba_bot_session');

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        userDataDir,
        headless: false, // Visível para diagnosticar!
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox']
    });

    const page = (await browser.pages())[0] || await browser.newPage();

    // 1. Acessa Eneba Login
    console.log("1. Acessando https://www.eneba.com/login ...");
    await page.goto('https://www.eneba.com/login', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Verifica se ja esta logado
    const isLoggedIn = await page.evaluate(() => {
        return !!document.querySelector('a[href*="/user/"], button[aria-label*="profile"], div[class*="user-menu"]');
    });
    console.log("Status de Login:", isLoggedIn ? "JÁ LOGADO ✅" : "NÃO LOGADO - Efetuando Login 🔑");

    if (!isLoggedIn) {
        await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 }).catch(() => null);
        const emailInput = await page.$('input[name="email"], input[type="email"]');
        if (emailInput) {
            await emailInput.type(process.env.ENEBA_BOT_EMAIL || 'zherkeys@gmail.com');
            const passInput = await page.$('input[name="password"], input[type="password"]');
            if (passInput) {
                await passInput.type(process.env.ENEBA_BOT_PASSWORD || '');
            }
            const submitBtn = await page.$('button[type="submit"]');
            if (submitBtn) {
                await submitBtn.click();
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null);
            }
        }
    }

    // 2. Busca Buddy Simulator 1984
    console.log("2. Buscando produto Buddy Simulator 1984 na Eneba...");
    await page.goto('https://www.eneba.com/store/all?text=Buddy%20Simulator%201984', { waitUntil: 'networkidle2', timeout: 60000 });

    const itemSelector = 'main a[href*="-key-"], main a[href*="-code-"], main a[href*="/item/"], main a[href*="-steam-"], main a[href*="-xbox-"]';
    await page.waitForSelector(itemSelector, { timeout: 15000 }).catch(() => null);

    const productHref = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('main a[href*="-key-"], main a[href*="-code-"], main a[href*="/item/"], main a[href*="-steam-"], main a[href*="-xbox-"]'));
        const matched = links.find(a => (a.getAttribute('href') || '').toLowerCase().includes('buddy')) || links[0];
        return matched ? matched.getAttribute('href') : null;
    });

    if (!productHref) {
        console.error("❌ Produto não encontrado na Eneba.");
        await browser.close();
        return;
    }

    const fullProductUrl = productHref.startsWith('http') ? productHref : `https://www.eneba.com${productHref}`;
    console.log("3. Acessando página do produto:", fullProductUrl);
    await page.goto(fullProductUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // 3. Clica em Comprar Agora
    console.log("4. Clicando no botão de compra...");
    const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const btn = buttons.find(b => {
            const txt = (b.innerText || b.textContent || '').toLowerCase();
            return txt.includes('comprar') || txt.includes('buy now') || txt.includes('adicionar');
        });
        if (btn) {
            btn.click();
            return true;
        }
        return false;
    });

    console.log("Resultado do clique no botão de compra:", clicked);
    await new Promise(r => setTimeout(r, 5000));
    console.log("URL atual pós-clique:", page.url());

    // Tira screenshot de diagnostico
    const screenPath = path.join(__dirname, '..', 'eneba_checkout_debug.png');
    await page.screenshot({ path: screenPath, fullPage: true });
    console.log("📸 Screenshot salva em:", screenPath);

    await browser.close();
    console.log("✅ Diagnóstico concluído!");
}

debugEnebaCheckout();
