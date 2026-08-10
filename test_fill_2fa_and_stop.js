/**
 * Script de Teste Completo: Garante window.scrollTo(0,0) e fullPage: true 
 * para capturar a página inteira com o modal de login e 2FA 100% visível e perfeito!
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
                    console.log("⚡ [CLOUDFLARE] Desafio 'Verify you are human' detectado. Clicando no checkbox...");
                    await checkbox.click();
                    await new Promise(r => setTimeout(r, 3000));
                    return true;
                }
            }
        }
    } catch (e) {}
    return false;
}

async function runAllLoginSteps() {
    console.log("==========================================================================");
    console.log("🤖 EXECUÇÃO PASSO A PASSO COMPLETA (FULLPAGE GARANTIDO)");
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
            '--window-size=1920,1080'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        // ETAPA 1: Abrir Eneba e clicar em Log in
        console.log("🌐 [ETAPA 1] Navegando até a página inicial...");
        await page.goto('https://www.eneba.com', { waitUntil: 'networkidle2', timeout: 45000 });
        await handleCloudflareTurnstile(page);

        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('a, button, span'));
            const loginBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('log in') || txt.includes('entrar') || txt.includes('registrar-se');
            });
            if (loginBtn) loginBtn.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        // Aceita cookies se houver
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const aceitarBtn = btns.find(b => (b.innerText || '').toLowerCase().includes('aceitar tudo') || (b.innerText || '').toLowerCase().includes('aceitar') || (b.innerText || '').trim() === 'Sim');
            if (aceitarBtn) aceitarBtn.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // ETAPA 2: Preencher E-mail
        const email = process.env.ENEBA_BOT_EMAIL || 'zherkeys@gmail.com';
        console.log(`📧 [ETAPA 2] Preenchendo e-mail: ${email}`);
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

        // Rola até o topo e tira Foto Etapa 2 (fullPage: true)
        await page.evaluate(() => window.scrollTo(0, 0));
        const p2 = path.join(screenshotsDir, 'step2_email_filled.png');
        await page.screenshot({ path: p2, fullPage: true });
        console.log("📸 Screenshot Etapa 2 (E-mail preenchido - FULLPAGE) salva!");

        // Clica no botão "Log in with password" ou "Continuar" para expor o campo de Senha!
        console.log("👉 Clicando no botão 'Log in with password' para abrir campo de senha...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const passModeBtn = btns.find(b => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.includes('log in with password') || txt.includes('entrar com senha') || txt.includes('password') || txt.includes('continuar');
            });
            if (passModeBtn) passModeBtn.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        // ETAPA 3: Preencher Senha
        const password = process.env.ENEBA_BOT_PASSWORD || 'Caio40028922!';
        console.log("🔑 [ETAPA 3] Preenchendo Senha...");
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

        // Rola até o topo e tira Foto Etapa 3 (fullPage: true)
        await page.evaluate(() => window.scrollTo(0, 0));
        const p3 = path.join(screenshotsDir, 'step3_password_filled.png');
        await page.screenshot({ path: p3, fullPage: true });
        console.log("📸 Screenshot Etapa 3 (Senha preenchida - FULLPAGE) salva!");

        // Clica no botão Entrar / Log in
        console.log("👉 Clicando no botão 'Log in' para acionar o 2FA...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const sub = btns.find(b => {
                const txt = (b.innerText || b.textContent || b.value || '').toLowerCase();
                return txt.includes('log in') || txt.includes('entrar') || txt.includes('sign in');
            });
            if (sub) sub.click();
        });

        console.log("⏳ Aguardando e resolvendo Cloudflare se necessário...");
        await new Promise(r => setTimeout(r, 3000));
        await handleCloudflareTurnstile(page);
        await new Promise(r => setTimeout(r, 3000));

        // ETAPA 4: Digitar 2FA
        const secret2FA = process.env.ENEBA_2FA_SECRET || '3ZT3EB3OLFGAYGK4';
        const totpCode = speakeasy.totp({ secret: secret2FA, encoding: 'base32' });
        console.log(`🔐 [ETAPA 4] Código 2FA gerado: "${totpCode}". Digitando nos campos...`);

        await page.evaluate((code) => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const digitInputs = inputs.filter(i => i.maxLength === 1 || i.size === 1 || (i.className && i.className.includes('digit')));
            
            if (digitInputs.length === 6 && code.length === 6) {
                const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                for (let i = 0; i < 6; i++) {
                    digitInputs[i].focus();
                    setVal.call(digitInputs[i], code[i]);
                    digitInputs[i].dispatchEvent(new Event('input', { bubbles: true }));
                    digitInputs[i].dispatchEvent(new Event('change', { bubbles: true }));
                }
                return true;
            }

            const codeInput = inputs.find(i => {
                const name = (i.name || i.id || i.placeholder || '').toLowerCase();
                return name.includes('code') || name.includes('otp') || name.includes('2fa');
            });

            if (codeInput) {
                const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                codeInput.focus();
                setVal.call(codeInput, code);
                codeInput.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            return false;
        }, totpCode);

        await new Promise(r => setTimeout(r, 1500));

        // Rola até o topo e tira Foto Etapa 4 (fullPage: true)
        await page.evaluate(() => window.scrollTo(0, 0));
        const p4 = path.join(screenshotsDir, 'step4_2fa_code_inserted.png');
        await page.screenshot({ path: p4, fullPage: true });
        console.log("📸 Screenshot Etapa 4 (2FA digitado - FULLPAGE) salva!");

    } catch (e) {
        console.error("Erro na execução:", e.message);
    } finally {
        await browser.close();
        console.log("🏁 Execução passo a passo finalizada.");
    }
}

runAllLoginSteps();
