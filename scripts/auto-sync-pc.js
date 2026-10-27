/**
 * ZHER KEYS - SINCRONIZADOR AUTOMÁTICO (SITE AO VIVO <-> GITHUB <-> PC LOCAL)
 * Mantém os arquivos locais do PC e do GitHub sempre sincronizados com o site em produção,
 * impedindo que um commit feito pelo PC local sobrescreva novos usuários, saldos de carteira,
 * Z-Points, pedidos, keys ou produtos cadastrados no site.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DESKTOP_BACKUP_PATH = 'C:\\Users\\convidado 1\\Desktop\\BACKUP_ZHERKEYS_COMPLETO.json';
const LIVE_URL = process.env.APP_URL || 'https://zherkeys.com';
const BOT_TOKEN = process.env.BOT_API_SECRET || 'zherkeys-secret-bot-token-2026';

function runGit(cmd) {
    try {
        return execSync(cmd, { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
    } catch (e) {
        return null;
    }
}

function readJsonSafe(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {}
    return fallback;
}

function writeJsonIfChanged(filePath, dataObj) {
    try {
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        const newStr = JSON.stringify(dataObj, null, 2);
        if (fs.existsSync(filePath)) {
            const oldStr = fs.readFileSync(filePath, 'utf8');
            // Ignora diferenças apenas de timestamp de topo (updated_at / backup_date)
            const normalize = (s) => s.replace(/"(updated_at|backup_date)"\s*:\s*"[^"]*"/g, '"$1":""').replace(/\r\n/g, '\n');
            if (normalize(oldStr) === normalize(newStr)) {
                return false;
            }
        }
        fs.writeFileSync(filePath, newStr, 'utf8');
        return true;
    } catch (e) {
        console.error(`[AUTO-SYNC] Erro ao salvar ${filePath}:`, e.message);
        return false;
    }
}

// 1. Sincroniza do GitHub (origin/main) para o PC Local sem perder alterações locais
function syncFromGitHub() {
    try {
        runGit('git fetch origin main');
        const behindCountStr = runGit('git rev-list HEAD..origin/main --count');
        const behindCount = parseInt(behindCountStr || '0', 10);
        if (behindCount > 0) {
            console.log(`🔄 [AUTO-SYNC] Detectadas ${behindCount} nova(s) atualização(ões) no GitHub! Sincronizando PC local...`);
            const pullOut = runGit('git pull --rebase --autostash origin main');
            if (pullOut !== null) {
                console.log(`✅ [AUTO-SYNC] PC local atualizado com sucesso a partir do GitHub!`);
                return true;
            }
        }
    } catch (e) {
        console.warn('[AUTO-SYNC] Aviso ao verificar GitHub:', e.message);
    }
    return false;
}

function mergeById(localArr = [], remoteArr = []) {
    const map = new Map();
    for (const item of localArr) {
        if (item && item.id !== undefined) map.set(String(item.id), { ...item });
    }
    for (const item of remoteArr) {
        if (item && item.id !== undefined) {
            const key = String(item.id);
            const prev = map.get(key) || {};
            map.set(key, { ...prev, ...item });
        }
    }
    return [...map.values()].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
}

function mergeUsers(localUsers = [], remoteUsers = []) {
    const byEmail = new Map();
    for (const u of localUsers) {
        if (!u || !u.email) continue;
        byEmail.set(String(u.email).toLowerCase(), { ...u });
    }
    for (const ru of remoteUsers) {
        if (!ru || !ru.email) continue;
        const key = String(ru.email).toLowerCase();
        const lu = byEmail.get(key);
        if (!lu) {
            byEmail.set(key, { ...ru });
        } else {
            byEmail.set(key, {
                ...lu,
                ...ru,
                id: ru.id || lu.id,
                password_hash: ru.password_hash || lu.password_hash || '',
                is_verified: (ru.is_verified || lu.is_verified) ? 1 : 0,
                // Usa o saldo/pontos atualizados do servidor ao vivo (ou preserva local se o servidor acabou de reiniciar zerado)
                balance: (parseFloat(ru.balance) || 0) > 0 ? parseFloat(ru.balance) : (parseFloat(lu.balance) || 0),
                points: (parseInt(ru.points, 10) || 0) > 0 ? parseInt(ru.points, 10) : (parseInt(lu.points, 10) || 0),
                game_nickname: ru.game_nickname || lu.game_nickname || null,
                google_id: ru.google_id || lu.google_id || null,
                facebook_id: ru.facebook_id || lu.facebook_id || null,
                steam_id: ru.steam_id || lu.steam_id || null,
                avatar: ru.avatar || lu.avatar || null,
                is_admin: (ru.is_admin || lu.is_admin) ? 1 : 0,
                subscription_expires_at: ru.subscription_expires_at || lu.subscription_expires_at || null,
                reading_subscription_expires_at: ru.reading_subscription_expires_at || lu.reading_subscription_expires_at || null
            });
        }
    }
    return [...byEmail.values()].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
}

function mergeProducts(localProds = [], remoteProds = []) {
    if (!Array.isArray(remoteProds) || remoteProds.length === 0) return localProds;
    const localById = new Map();
    const localByTitle = new Map();
    for (const p of localProds) {
        if (!p) continue;
        if (p.id !== undefined) localById.set(String(p.id), p);
        if (p.title) localByTitle.set(String(p.title).toLowerCase(), p);
    }

    const merged = remoteProds.map((rp, idx) => {
        const lp = localById.get(String(rp.id)) || localByTitle.get(String(rp.title || '').toLowerCase()) || {};
        return {
            ...lp,
            ...rp,
            activation_key: (rp.activation_key && String(rp.activation_key).trim() !== '')
                ? rp.activation_key
                : (lp.activation_key || ''),
            eneba_url: rp.eneba_url || lp.eneba_url || '',
            auto_stock_provider: rp.auto_stock_provider || lp.auto_stock_provider || 'eneba',
            display_order: rp.display_order !== undefined ? rp.display_order : (lp.display_order !== undefined ? lp.display_order : idx)
        };
    });

    // Preserva qualquer produto local que não estava na lista remota apenas se a lista remota estava incompleta
    return merged;
}

// 2. Sincroniza do Site Ao Vivo (https://zherkeys.com) para os arquivos locais do PC
async function syncFromLiveSite() {
    let anyChanged = false;
    try {
        const res = await fetch(`${LIVE_URL}/api/bot/live-backup-sync`, {
            headers: { 'x-bot-token': BOT_TOKEN },
            signal: AbortSignal.timeout(12000)
        });

        if (res.ok) {
            const live = await res.json();
            if (live && live.success) {
                const localUsers = readJsonSafe(path.join(DATA_DIR, 'users_backup.json'), []);
                const localProds = readJsonSafe(path.join(DATA_DIR, 'products_backup.json'), []);
                const localOrders = readJsonSafe(path.join(DATA_DIR, 'orders_backup.json'), { orders: [], order_items: [] });
                const localTickets = readJsonSafe(path.join(DATA_DIR, 'tickets_backup.json'), { tickets: [], messages: [] });
                const localWp = readJsonSafe(path.join(DATA_DIR, 'wallets_points_backup.json'), {
                    users_wallets_and_points: [],
                    wallet_transactions: [],
                    points_earnings: [],
                    sweepstake_participants: [],
                    sweepstake_history: []
                });

                const mergedUsers = mergeUsers(localUsers, live.users || []);
                const mergedProds = mergeProducts(localProds, live.products || []);
                const mergedOrders = {
                    orders: mergeById(localOrders.orders || [], (live.orders && live.orders.orders) || []),
                    order_items: mergeById(localOrders.order_items || [], (live.orders && live.orders.order_items) || [])
                };
                const mergedTickets = {
                    tickets: mergeById(localTickets.tickets || [], (live.tickets && live.tickets.tickets) || []),
                    messages: mergeById(localTickets.messages || [], (live.tickets && live.tickets.messages) || [])
                };
                const liveWp = live.wallets_and_points || {};
                const mergedWp = {
                    updated_at: new Date().toISOString(),
                    users_wallets_and_points: mergedUsers.map(u => ({
                        id: u.id,
                        email: u.email,
                        balance: parseFloat(u.balance) || 0,
                        points: parseInt(u.points, 10) || 0,
                        game_nickname: u.game_nickname || null,
                        subscription_expires_at: u.subscription_expires_at || null,
                        reading_subscription_expires_at: u.reading_subscription_expires_at || null
                    })),
                    wallet_transactions: mergeById(localWp.wallet_transactions || [], liveWp.wallet_transactions || []),
                    points_earnings: mergeById(localWp.points_earnings || [], liveWp.points_earnings || []),
                    sweepstake_participants: mergeById(localWp.sweepstake_participants || [], liveWp.sweepstake_participants || []),
                    sweepstake_history: mergeById(localWp.sweepstake_history || [], liveWp.sweepstake_history || [])
                };

                if (writeJsonIfChanged(path.join(DATA_DIR, 'users_backup.json'), mergedUsers)) anyChanged = true;
                if (writeJsonIfChanged(path.join(DATA_DIR, 'products_backup.json'), mergedProds)) anyChanged = true;
                if (writeJsonIfChanged(path.join(DATA_DIR, 'orders_backup.json'), mergedOrders)) anyChanged = true;
                if (writeJsonIfChanged(path.join(DATA_DIR, 'tickets_backup.json'), mergedTickets)) anyChanged = true;
                if (writeJsonIfChanged(path.join(DATA_DIR, 'wallets_points_backup.json'), mergedWp)) anyChanged = true;

                if (anyChanged) {
                    const master = {
                        backup_date: new Date().toISOString(),
                        users_count: mergedUsers.length,
                        products_count: mergedProds.length,
                        users: mergedUsers,
                        wallets_and_points: mergedWp,
                        products: mergedProds,
                        orders: mergedOrders,
                        tickets: mergedTickets
                    };
                    writeJsonIfChanged(path.join(DATA_DIR, 'full_system_backup.json'), master);
                    writeJsonIfChanged(DESKTOP_BACKUP_PATH, master);
                    console.log(`💾 [AUTO-SYNC] Dados ao vivo do site (${mergedUsers.length} usuários, ${mergedProds.length} produtos) sincronizados com o PC local!`);
                }
            }
        }
    } catch (e) {
        // Ignora silenciosamente se offline ou durante deploy do Render
    }
    return anyChanged;
}

let wasOffline = false;
let isSyncRunning = false;

async function checkInternetConnection() {
    try {
        const res = await fetch(`${LIVE_URL}/api/bot/live-backup-sync`, {
            method: 'HEAD',
            headers: { 'x-bot-token': BOT_TOKEN },
            signal: AbortSignal.timeout(5000)
        });
        return res.status > 0;
    } catch (e) {
        try {
            const gh = await fetch('https://api.github.com', { method: 'HEAD', signal: AbortSignal.timeout(4000) });
            return gh.status > 0;
        } catch (err) {
            return false;
        }
    }
}

async function runSyncCycle({ stageChanges = false, autoPushData = false } = {}) {
    if (isSyncRunning) return;
    isSyncRunning = true;
    try {
        const online = await checkInternetConnection();
        if (!online) {
            if (!wasOffline) {
                console.log('⚠️ [AUTO-SYNC] Sem conexão com a internet no momento. Aguardando internet voltar para sincronizar imediatamente...');
            }
            wasOffline = true;
            return;
        }

        if (wasOffline) {
            console.log('🌐 [AUTO-SYNC] Internet detectada! Sincronizando imediatamente novidades do Site e do GitHub com o PC...');
            wasOffline = false;
        }

        syncFromGitHub();
        const dataChanged = await syncFromLiveSite();

        if (stageChanges) {
            runGit('git add data/');
        }

        if (autoPushData && dataChanged) {
            // Verifica se apenas arquivos dentro de data/ foram modificados para fazer push automático seguro
            const statusOut = runGit('git status --porcelain') || '';
            const lines = statusOut.split('\n').map(l => l.trim()).filter(Boolean);
            const onlyDataModified = lines.length > 0 && lines.every(l => l.includes('data/'));
            if (onlyDataModified) {
                runGit('git add data/');
                const committed = runGit('git commit -m "chore(backup): sincronizacao automatica de usuarios, carteiras e produtos"');
                if (committed !== null) {
                    runGit('git pull --rebase --autostash origin main');
                    runGit('git push origin main');
                    console.log('🚀 [AUTO-SYNC] Novos dados do site salvos automaticamente no GitHub e no PC local!');
                }
            }
        }
    } finally {
        isSyncRunning = false;
    }
}

const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon');
const isStage = args.includes('--stage');

if (isDaemon) {
    console.log('🛡️ [AUTO-SYNC] Monitor de Sincronização Automática Zher Keys iniciado em segundo plano...');
    runSyncCycle({ autoPushData: true });
    // Verifica a cada 15 segundos: se estava sem internet e reconectou, sincroniza no mesmo instante!
    let tickCount = 0;
    setInterval(() => {
        tickCount++;
        if (wasOffline || tickCount % 3 === 0) {
            runSyncCycle({ autoPushData: true });
        }
    }, 15 * 1000);
} else {
    runSyncCycle({ stageChanges: isStage, autoPushData: false }).then(() => {
        process.exit(0);
    });
}
