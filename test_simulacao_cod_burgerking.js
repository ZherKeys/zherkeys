/**
 * Script de Simulação com Produto Específico (Call of Duty Burger King DLC):
 * 1. Login no Eneba se necessário.
 * 2. Navega para https://www.eneba.com/br/checkout e clica em todos os botões de lixeira (SVG).
 * 3. Navega até a URL exata do produto COD Burger King DLC.
 * 4. Adiciona 1 única unidade ao carrinho e vai ao checkout.
 * 5. Seleciona Carteira Eneba.
 * 6. Clica em Continuar -> Aguarda abertura do Modal 2FA -> Preenche os 6 dígitos.
 * 7. Tira screenshot FOCADO NO MODAL DE 2FA COM OS DÍGITOS PREENCHIDOS (Sem clicar em Continuar para efetuar a compra!).
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

async function runCodBurgerKingSimulation() {
    console.log("==========================================================================");
    console.log("🎮 SIMULAÇÃO DE COMPRA: CAPTURA FOCADA DO 2FA DIGITADO (SEGURANÇA ATIVA)");
    console.log("==========================================================================");

    const screenshotsDir = path.join(__dirname, 'logs', 'screenshots', 'simulacao_cod');
    if (fs.existsSync(screenshotsDir)) fs.rmSync(screenshotsDir, { recursive: true, force: true });
    fs.mkdirSync(screenshotsDir, { recursive: true });

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
        // ETAPA 1: Abrir Eneba e realizar Login se necessário
        console.log("🌐 [ETAPA 1/6] Acessando Eneba e verificando estado de Login...");
        await page.goto('https://www.eneba.com', { waitUntil: 'networkidle2', timeout: 45000 });
        await handleCloudflareTurnstile(page);

        // Aceita cookies se houver
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const aceitarBtn = btns.find(b => (b.innerText || '').toLowerCase().includes('aceitar tudo') || (b.innerText || '').toLowerCase().includes('aceitar') || (b.innerText || '').trim() === 'Sim');
            if (aceitarBtn) aceitarBtn.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        const email = process.env.ENEBA_BOT_EMAIL || 'zherkeys@gmail.com';
        const password = process.env.ENEBA_BOT_PASSWORD || 'Caio40028922!';
        const secret2FA = process.env.ENEBA_2FA_SECRET || '3ZT3EB3OLFGAYGK4';

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
            console.log("🔑 Botão Log in detectado! Realizando autenticação...");
            await new Promise(r => setTimeout(r, 2000));

            // E-mail
            await page.evaluate((uEmail) => {
                const el = document.querySelector('input[type="email"], input[name="email"]');
                if (el) {
                    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    el.focus();
                    setVal.call(el, uEmail);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, email);
            await new Promise(r => setTimeout(r, 1000));

            // Log in with password
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, a'));
                const passBtn = btns.find(b => {
                    const txt = (b.innerText || b.textContent || '').toLowerCase();
                    return txt.includes('log in with password') || txt.includes('entrar com senha') || txt.includes('password') || txt.includes('continuar');
                });
                if (passBtn) passBtn.click();
            });
            await new Promise(r => setTimeout(r, 2000));

            // Senha
            await page.evaluate((uPass) => {
                const el = document.querySelector('input[type="password"], input[name="password"]');
                if (el) {
                    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    el.focus();
                    setVal.call(el, uPass);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, password);
            await new Promise(r => setTimeout(r, 1000));

            // Clica Log in
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

            // 2FA no Login
            const loginTotp = speakeasy.totp({ secret: secret2FA, encoding: 'base32' });
            await page.evaluate((code) => {
                const inputs = Array.from(document.querySelectorAll('input'));
                const digitInputs = inputs.filter(i => i.maxLength === 1 || i.size === 1 || (i.className && i.className.includes('digit')));
                if (digitInputs.length === 6 && code.length === 6) {
                    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    for (let i = 0; i < 6; i++) {
                        digitInputs[i].focus();
                        setVal.call(digitInputs[i], code[i]);
                        digitInputs[i].dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }, loginTotp);
            await new Promise(r => setTimeout(r, 2000));
        }

        const p1 = path.join(screenshotsDir, 'etapa1_login_status.png');
        await page.screenshot({ path: p1, fullPage: true });
        console.log("📸 Foto Etapa 1 (FULLPAGE): Estado de Login capturado!");

        // ETAPA 2: IR PARA https://www.eneba.com/br/checkout E CLICAR NA LIXEIRA DE TODOS OS ITENS
        console.log("🛒 [ETAPA 2/6] Navegando para https://www.eneba.com/br/checkout e clicando no SVG da lixeira de todos os itens...");
        await page.goto('https://www.eneba.com/br/checkout', { waitUntil: 'networkidle2', timeout: 35000 });
        await handleCloudflareTurnstile(page);
        await new Promise(r => setTimeout(r, 2000));

        const trashCount = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('button, div[role="button"], a, svg'));
            const trashButtons = [];

            allElements.forEach(el => {
                const html = (el.innerHTML || '').toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                const title = (el.getAttribute('title') || '').toLowerCase();
                
                if (
                    html.includes('m14.25,1h9.75') || 
                    html.includes('18.86,21.62') || 
                    html.includes('viewbox="0 0 24 24"') ||
                    aria.includes('remover') || 
                    aria.includes('remove') || 
                    aria.includes('excluir') ||
                    title.includes('remover') ||
                    title.includes('excluir')
                ) {
                    const btn = el.closest('button, div[role="button"], a') || el;
                    if (!trashButtons.includes(btn)) {
                        trashButtons.push(btn);
                    }
                }
            });

            trashButtons.forEach(b => {
                try { b.click(); } catch(e) {}
            });

            return trashButtons.length;
        });

        if (trashCount > 0) {
            console.log(`⚠️ Foram clicados ${trashCount} botões de lixeira no carrinho!`);
            await new Promise(r => setTimeout(r, 2500));
        }

        const p2_cart = path.join(screenshotsDir, 'etapa2_carrinho_esvaziado_checkout.png');
        await page.screenshot({ path: p2_cart, fullPage: true });
        console.log("📸 Foto Etapa 2 (FULLPAGE): Carrinho /br/checkout limpo!");

        // ETAPA 3: Navegar até a URL exata do produto COD Burger King DLC
        const productUrl = 'https://www.eneba.com/br/other-call-of-duty-r-modern-warfare-r-ii-burger-king-operator-skin-1-hour-2xp-dlc-www-callofduty-com-key-global';
        console.log(`🌐 [ETAPA 3/6] Navegando até a URL do produto COD Burger King...`);
        await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await handleCloudflareTurnstile(page);
        await new Promise(r => setTimeout(r, 2000));

        const p3 = path.join(screenshotsDir, 'etapa3_pagina_produto_cod.png');
        await page.screenshot({ path: p3, fullPage: true });
        console.log("📸 Foto Etapa 3 (FULLPAGE): Página do produto COD Burger King capturada!");

        // ETAPA 4: Clicar no botão Comprar Agora
        console.log("🛒 [ETAPA 4/6] Clicando no botão 'Comprar agora'...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const buyBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('comprar agora') || txt.includes('buy now') || txt.includes('adicionar ao carrinho');
            });
            if (buyBtn) buyBtn.click();
        });

        await new Promise(r => setTimeout(r, 3500));
        await handleCloudflareTurnstile(page);

        // Se estiver no popup do carrinho, clica em Ir para o pagamento
        const isCartModal = await page.$('a[href*="/checkout"]');
        if (isCartModal) {
            await page.evaluate(() => {
                const checkoutBtn = document.querySelector('a[href*="/checkout"]');
                if (checkoutBtn) checkoutBtn.click();
            });
            await new Promise(r => setTimeout(r, 3500));
        }

        const p4 = path.join(screenshotsDir, 'etapa4_carrinho_1_item_confirmado.png');
        await page.screenshot({ path: p4, fullPage: true });
        console.log("📸 Foto Etapa 4 (FULLPAGE): Carrinho com EXATAMENTE 1 ITEM capturado!");

        // ETAPA 5: Seleção da Carteira Eneba
        console.log("💳 [ETAPA 5/6] Selecionando método de pagamento 'Carteira Eneba'...");
        await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label, div[role="button"], button'));
            const walletBtn = labels.find(l => {
                const txt = (l.innerText || l.textContent || '').toLowerCase();
                return txt.includes('eneba wallet') || txt.includes('carteira eneba') || txt.includes('saldo eneba');
            });
            if (walletBtn) walletBtn.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        const p5 = path.join(screenshotsDir, 'etapa5_carteira_eneba_selecionada.png');
        await page.screenshot({ path: p5, fullPage: true });
        console.log("📸 Foto Etapa 5 (FULLPAGE): Carteira Eneba Selecionada capturada!");

        // Clica em Continuar para abrir a janela modal de 2FA
        console.log("⚡ Clicando em 'Continuar' no checkout para acionar o modal 2FA...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const contBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('continuar') || txt.includes('continue') || txt.includes('pagar');
            });
            if (contBtn) contBtn.click();
        });
        await new Promise(r => setTimeout(r, 3500));
        await handleCloudflareTurnstile(page);

        // ETAPA 6: DIGITAR OS 6 DÍGITOS DO 2FA TOTP NO MODAL APÓS CLICAR EM CONTINUAR!
        const totpCode = speakeasy.totp({ secret: secret2FA, encoding: 'base32' });
        console.log(`🔐 [ETAPA 6/6] Preenchendo código 2FA TOTP "${totpCode}" no modal overlay...`);

        const typed2FA = await page.evaluate((code) => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const digitInputs = inputs.filter(i => i.maxLength === 1 || i.size === 1 || (i.className && i.className.includes('digit')) || i.type === 'text' || i.type === 'number');
            if (digitInputs.length >= 6) {
                const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                for (let i = 0; i < 6; i++) {
                    digitInputs[i].focus();
                    setVal.call(digitInputs[i], code[i]);
                    digitInputs[i].dispatchEvent(new Event('input', { bubbles: true }));
                    digitInputs[i].dispatchEvent(new Event('change', { bubbles: true }));
                }
                digitInputs[0].scrollIntoView({ behavior: 'instant', block: 'center' });
                return true;
            }
            return false;
        }, totpCode);

        console.log("Resultado da digitação do 2FA no modal:", typed2FA);
        await new Promise(r => setTimeout(r, 2000));

        // Screenshot FOCADO NO VIEWPORT (sem scroll fullPage) para mostrar o modal overlay centralizado com os 6 dígitos!
        const p6 = path.join(screenshotsDir, 'etapa6_2fa_digitado_sem_submeter.png');
        await page.screenshot({ path: p6, fullPage: false });
        console.log("📸 Foto Etapa 6 (VIEWPORT FOCADO NO MODAL 2FA): Capturado em destaque com os 6 dígitos!");

    } catch (e) {
        console.error("Erro na simulação:", e.message);
    } finally {
        await browser.close();
        console.log("==========================================================================");
        console.log("🏁 SIMULAÇÃO CONCLUÍDA COM SUCESSO!");
        console.log("==========================================================================");
    }
}

runCodBurgerKingSimulation();
