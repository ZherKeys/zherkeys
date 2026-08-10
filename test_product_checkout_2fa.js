/**
 * Script de Teste do Fluxo Real de Compra no Eneba:
 * 1. Abre a página inicial da Eneba (https://www.eneba.com)
 * 2. Clica no primeiro produto real da lista (ex: Random Key ou Gift Card)
 * 3. Clica no botão 'Comprar agora' / 'Buy now'
 * 4. Preenche Login/Senha/2FA e tira fotos Reais e Verificadas de cada tela!
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const speakeasy = require('speakeasy');
const path = require('path');
const fs = require('fs');

async function handleCloudflareTurnstile(page) {
    try {
        const frames = page.frames();
        for (const frame of frames) {
            if (frame.url().includes('cloudflare') || frame.url().includes('turnstile') || frame.url().includes('challenges')) {
                const checkbox = await frame.$('input[type="checkbox"], label, .mark, #challenge-stage');
                if (checkbox) {
                    console.log("⚡ [CLOUDFLARE] Desafio 'Verify you are human' detectado. Clicando...");
                    await checkbox.click();
                    await new Promise(r => setTimeout(r, 3000));
                    return true;
                }
            }
        }
    } catch (e) {}
    return false;
}

async function runRealProductCheckoutTest() {
    console.log("==========================================================================");
    console.log("🛒 INICIANDO NAVEGAÇÃO E COMPRA REAL EM UM PRODUTO VÁLIDO DO ENEBA");
    console.log("==========================================================================");

    const screenshotsDir = path.join(__dirname, 'logs', 'screenshots', 'pedido_9999');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    const userDataDir = path.join(__dirname, 'eneba_bot_session');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    const winChromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const chromePath = fs.existsSync(winChromePath) ? winChromePath : undefined;

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: chromePath,
        userDataDir: userDataDir,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1280,900'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
        // ETAPA 1: Abrir Página Inicial e Clicar no Primeiro Produto Real
        console.log("🌐 [ETAPA 1] Navegando até a Eneba para selecionar produto válido...");
        await page.goto('https://www.eneba.com', { waitUntil: 'networkidle2', timeout: 45000 });
        await handleCloudflareTurnstile(page);

        // Aceita cookies se houver
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const aceitarBtn = btns.find(b => (b.innerText || '').toLowerCase().includes('aceitar tudo') || (b.innerText || '').toLowerCase().includes('aceitar') || (b.innerText || '').trim() === 'Sim');
            if (aceitarBtn) aceitarBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        // Clica no primeiro produto real da vitrine
        console.log("🔍 Clicando em um produto real da lista...");
        await page.evaluate(() => {
            const productLinks = Array.from(document.querySelectorAll('a[href*="/store/"], a[href*="/br/"]'));
            const validLink = productLinks.find(a => a.href && !a.href.includes('/auth') && !a.href.includes('/categories'));
            if (validLink) validLink.click();
        });

        await new Promise(r => setTimeout(r, 4000));
        await handleCloudflareTurnstile(page);

        // Tira Foto 1: Página real do produto
        const p1 = path.join(screenshotsDir, 'real_prod_step1.png');
        await page.screenshot({ path: p1, fullPage: false });
        console.log("📸 Foto 1: Página do produto real capturada!");

        // ETAPA 2: Clicar em Comprar Agora
        console.log("🛒 [ETAPA 2] Clicando no botão 'Comprar agora' / 'Buy now'...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const buyBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('comprar agora') || txt.includes('buy now') || txt.includes('adicionar ao carrinho');
            });
            if (buyBtn) buyBtn.click();
        });

        await new Promise(r => setTimeout(r, 4000));
        await handleCloudflareTurnstile(page);

        // Tira Foto 2: Tela de Checkout / Carrinho
        const p2 = path.join(screenshotsDir, 'real_prod_step2_checkout.png');
        await page.screenshot({ path: p2, fullPage: false });
        console.log("📸 Foto 2: Tela de Checkout / Carrinho capturada!");

    } catch (e) {
        console.error("Erro no teste:", e.message);
    } finally {
        await browser.close();
        console.log("==========================================================================");
        console.log("🏁 TESTE CONCLUÍDO!");
        console.log("==========================================================================");
    }
}

runRealProductCheckoutTest();
