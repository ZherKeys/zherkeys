/**
 * Native Chrome Launcher for Eneba Session Initialization
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function initLogin() {
    console.log("=================================================");
    console.log("🌐 ABRINDO CHROME NATIVO DO WINDOWS...");
    console.log("Faça login na janela que abrir e feche quando terminar.");
    console.log("=================================================");

    const userDataDir = path.join(__dirname, 'eneba_bot_session');
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    } else {
        const lockPath = path.join(userDataDir, 'SingletonLock');
        try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch (e) {}
    }

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    if (fs.existsSync(chromePath)) {
        const chromeProcess = spawn(chromePath, [
            `--user-data-dir=${userDataDir}`,
            '--start-maximized',
            'https://my.eneba.com/login'
        ], { detached: true, stdio: 'ignore' });

        chromeProcess.unref();
        console.log("✅ Chrome Nativo aberto com sucesso!");
        console.log("Faça seu login ou 2FA e feche a janela quando terminar.");
    } else {
        console.log("❌ Chrome oficial não encontrado em:", chromePath);
    }
}

initLogin();
