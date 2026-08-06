const fs = require('fs');
const path = require('path');

console.log("===============================================================");
console.log("🔍 AUDITORIA E VERIFICAÇÃO DE MUDANÇAS NO PROJETO ZHERKEYS");
console.log("===============================================================");

// 1. Verifica eneba_web_bot.js
const enebaBotPath = path.join(__dirname, 'eneba_web_bot.js');
const enebaBotContent = fs.existsSync(enebaBotPath) ? fs.readFileSync(enebaBotPath, 'utf-8') : '';

const hasDirectUrlSupport = enebaBotContent.includes("Link direto do produto Eneba fornecido") || enebaBotContent.includes("startsWith('http')");
const hasGreenWelcomeDismiss = enebaBotContent.includes("dismissGreenWelcomeBanner");

console.log(`1. eneba_web_bot.js:`);
console.log(`   - Suporte a Link Direto da Eneba: ${hasDirectUrlSupport ? '✅ PRESENTE' : '❌ AUSENTE'}`);
console.log(`   - Botão Verde de Boas-Vindas (Auto-Dismiss): ${hasGreenWelcomeDismiss ? '✅ PRESENTE' : '❌ AUSENTE'}`);

// 2. Verifica simulate_zherkeys_cart_checkout.js
const cartCheckoutPath = path.join(__dirname, 'simulate_zherkeys_cart_checkout.js');
const cartContent = fs.existsSync(cartCheckoutPath) ? fs.readFileSync(cartCheckoutPath, 'utf-8') : '';
const hasCartGreenDismiss = cartContent.includes("dismissGreenWelcomeBanner");

console.log(`2. simulate_zherkeys_cart_checkout.js:`);
console.log(`   - Botão Verde de Boas-Vindas antes da Screenshot: ${hasCartGreenDismiss ? '✅ PRESENTE' : '❌ AUSENTE'}`);

// 3. Verifica public/admin.html
const adminPath = path.join(__dirname, 'public', 'admin.html');
const adminContent = fs.existsSync(adminPath) ? fs.readFileSync(adminPath, 'utf-8') : '';
const hasEnebaUrlInput = adminContent.includes('prod-eneba-url') && adminContent.includes('LINK DIRETO DO ANÚNCIO NA ENEBA');

console.log(`3. public/admin.html:`);
console.log(`   - Campo de Link Direto da Eneba no Formulário Admin: ${hasEnebaUrlInput ? '✅ PRESENTE' : '❌ AUSENTE'}`);

// 4. Verifica server.js
const serverPath = path.join(__dirname, 'server.js');
const serverContent = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf-8') : '';
const hasEnebaColumn = serverContent.includes('autoBuyEnebaKeyWeb');

console.log(`4. server.js:`);
console.log(`   - Suporte ao eneba_url e Disparo do Robô no Backend: ${hasEnebaColumn ? '✅ PRESENTE' : '❌ AUSENTE'}`);

console.log("===============================================================");
console.log("🎉 AUDITORIA CONCLUÍDA!");
console.log("===============================================================");
