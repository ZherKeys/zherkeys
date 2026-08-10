const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

async function debugPaymentButton() {
    console.log("🔍 Debugging Eneba payment page buttons...");
    const userDataDir = path.join(__dirname, 'eneba_bot_session');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
        userDataDir: userDataDir,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        console.log("🌐 Navigating to https://www.eneba.com/checkout/payment...");
        await page.goto('https://www.eneba.com/checkout/payment', { waitUntil: 'networkidle2', timeout: 30000 });

        const pageElements = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('button, a, input, [role="button"], div, span'));
            const clickable = allElements.filter(el => {
                const txt = (el.innerText || el.textContent || el.value || '').trim();
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') return false;
                const clsStr = String(el.className || '');
                const isYellow = style.backgroundColor.includes('255, 204') || style.backgroundColor.includes('234, 179') || style.backgroundColor.includes('yellow') || clsStr.includes('yellow') || clsStr.includes('btn') || clsStr.includes('button');
                return txt.toLowerCase() === 'continue' || txt.toLowerCase() === 'continuar' || txt.toLowerCase().includes('proceed') || (isYellow && txt.length > 0 && txt.length < 30);
            });

            return clickable.map(el => {
                const rect = el.getBoundingClientRect();
                return {
                    tagName: el.tagName,
                    type: el.type || '',
                    text: (el.innerText || el.textContent || el.value || '').trim().substring(0, 50),
                    className: String(el.className || '').substring(0, 100),
                    id: el.id || '',
                    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    bgColor: window.getComputedStyle(el).backgroundColor
                };
            });
        });

        console.log("📌 Found interactive buttons on payment page:", JSON.stringify(pageElements, null, 2));

    } catch (e) {
        console.error("❌ Error debugging buttons:", e.message);
    } finally {
        await browser.close();
    }
}

debugPaymentButton();
