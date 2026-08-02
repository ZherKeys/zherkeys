require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const speakeasy = require('speakeasy');
const fs = require('fs');
const { execFileSync } = require('child_process');

// TFJS Universal Sentence Encoder (Node) - optional, faster than Python if installed
let useTfjs = false;
let tfModel = null;
async function initTfjs() {
    try {
        // require tfjs-node to enable native bindings
        require('@tensorflow/tfjs-node');
        const use = require('@tensorflow-models/universal-sentence-encoder');
        tfModel = await use.load();
        useTfjs = true;
        console.log('TFJS Universal Sentence Encoder loaded (Node)');
    } catch (e) {
        console.log('TFJS not available or failed to load:', e && e.message ? e.message : e);
    }
}

const app = express();
app.disable('x-powered-by'); // Remove o cabeçalho X-Powered-By por segurança (evita vazamento de tecnologia)
const port = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || ('http://localhost:' + port);

// Setup MercadoPago
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-12345' });

// Setup Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(session({
    secret: 'zher-keys-secret',
    resave: false,
    saveUninitialized: false
}));

// Setup Database (PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Sistema de Backup de Segurança de Produtos em Arquivo JSON Local (Gravado no Git/GitHub)
async function syncProductsBackup() {
    try {
        const res = await pool.query('SELECT * FROM products ORDER BY id ASC');
        if (res.rows && res.rows.length > 0) {
            const dataDir = path.join(__dirname, 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            const backupPath = path.join(dataDir, 'products_backup.json');
            fs.writeFileSync(backupPath, JSON.stringify(res.rows, null, 2), 'utf-8');
            console.log(`💾 Backup de ${res.rows.length} produtos salvo em data/products_backup.json`);
        }
    } catch (err) {
        console.error('Erro ao salvar backup local de produtos:', err && err.message ? err.message : err);
    }
}

async function fixPostgresSequences() {
    try {
        const tables = ['users', 'products', 'orders', 'order_items', 'support_tickets', 'support_ticket_messages', 'streaming_media', 'streaming_episodes', 'reading_media', 'reading_chapters'];
        for (let tbl of tables) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), COALESCE(MAX(id), 1)) FROM ${tbl}`).catch(() => {});
        }
    } catch(e) {}
}

async function restoreProductsFromBackup() {
    try {
        const backupPath = path.join(__dirname, 'data', 'products_backup.json');
        if (fs.existsSync(backupPath)) {
            const fileData = fs.readFileSync(backupPath, 'utf-8');
            const backupProducts = JSON.parse(fileData);
            if (Array.isArray(backupProducts) && backupProducts.length > 0) {
                const countRes = await pool.query('SELECT COUNT(*) FROM products');
                const count = parseInt(countRes.rows[0].count, 10);
                if (count === 0) {
                    for (let p of backupProducts) {
                        if (p.id) {
                            await pool.query(
                                `INSERT INTO products (id, title, description, price, old_price, image, category, activation_key, in_stock, is_global, restricted_countries, genres, gameflip_listing_id, gallery) 
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                                 ON CONFLICT (id) DO NOTHING`,
                                [
                                    p.id,
                                    p.title,
                                    p.description || '',
                                    parseFloat(p.price) || 0,
                                    p.old_price ? parseFloat(p.old_price) : null,
                                    p.image || '',
                                    p.category || 'STEAM KEY',
                                    p.activation_key || '',
                                    p.in_stock !== false,
                                    p.is_global !== false,
                                    p.restricted_countries || '',
                                    p.genres || '',
                                    p.gameflip_listing_id || '',
                                    typeof p.gallery === 'string' ? p.gallery : JSON.stringify(p.gallery || [])
                                ]
                            );
                        } else {
                            await pool.query(
                                `INSERT INTO products (title, description, price, old_price, image, category, activation_key, in_stock, is_global, restricted_countries, genres, gameflip_listing_id, gallery) 
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                                [
                                    p.title,
                                    p.description || '',
                                    parseFloat(p.price) || 0,
                                    p.old_price ? parseFloat(p.old_price) : null,
                                    p.image || '',
                                    p.category || 'STEAM KEY',
                                    p.activation_key || '',
                                    p.in_stock !== false,
                                    p.is_global !== false,
                                    p.restricted_countries || '',
                                    p.genres || '',
                                    p.gameflip_listing_id || '',
                                    typeof p.gallery === 'string' ? p.gallery : JSON.stringify(p.gallery || [])
                                ]
                            );
                        }
                    }
                    console.log(`✅ ${backupProducts.length} produtos restaurados do arquivo data/products_backup.json (Banco estava vazio)`);
                }
            }
        }
    } catch (err) {
        console.error('Erro ao restaurar produtos do backup:', err && err.message ? err.message : err);
    }
}

// Sistema de Backup de Segurança Completo do Banco de Dados (Usuários, Pedidos, Chaves Entregues e Suporte)
async function syncFullDatabaseBackup() {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // 1. Backup de Produtos
        await syncProductsBackup();

        // 2. Backup de Usuários
        const usersRes = await pool.query('SELECT id, email, password_hash, is_verified, balance, points, game_nickname, google_id, facebook_id, steam_id, avatar, is_admin, subscription_expires_at, reading_subscription_expires_at, created_at FROM users ORDER BY id ASC');
        if (usersRes.rows) {
            fs.writeFileSync(path.join(dataDir, 'users_backup.json'), JSON.stringify(usersRes.rows, null, 2), 'utf-8');
            console.log(`💾 Backup de ${usersRes.rows.length} usuários salvo em data/users_backup.json`);
        }

        // 3. Backup de Pedidos e Chaves Entregues
        const ordersRes = await pool.query('SELECT * FROM orders ORDER BY id ASC');
        const orderItemsRes = await pool.query('SELECT * FROM order_items ORDER BY id ASC');
        const ordersBackup = {
            orders: ordersRes.rows || [],
            order_items: orderItemsRes.rows || []
        };
        fs.writeFileSync(path.join(dataDir, 'orders_backup.json'), JSON.stringify(ordersBackup, null, 2), 'utf-8');
        console.log(`💾 Backup de ${ordersRes.rows.length} pedidos e ${orderItemsRes.rows.length} itens/chaves entregues salvo em data/orders_backup.json`);

        // 4. Backup de Tickets de Suporte
        const ticketsRes = await pool.query('SELECT * FROM support_tickets ORDER BY id ASC');
        const ticketMsgsRes = await pool.query('SELECT * FROM support_ticket_messages ORDER BY id ASC');
        const ticketsBackup = {
            tickets: ticketsRes.rows || [],
            messages: ticketMsgsRes.rows || []
        };
        fs.writeFileSync(path.join(dataDir, 'tickets_backup.json'), JSON.stringify(ticketsBackup, null, 2), 'utf-8');
        console.log(`💾 Backup de ${ticketsRes.rows.length} tickets de suporte salvo em data/tickets_backup.json`);

        // 5. Backup de Música de Fundo
        try {
            const musicRes = await pool.query('SELECT enabled, shuffle, playlist FROM site_music_settings WHERE id = 1');
            if (musicRes.rows && musicRes.rows.length > 0) {
                const row = musicRes.rows[0];
                let playlist = [];
                try { playlist = typeof row.playlist === 'string' ? JSON.parse(row.playlist || '[]') : (row.playlist || []); } catch(e){}
                const musicBackup = {
                    enabled: row.enabled === true,
                    shuffle: row.shuffle !== false,
                    playlist: playlist
                };
                fs.writeFileSync(path.join(dataDir, 'music_settings_backup.json'), JSON.stringify(musicBackup, null, 2), 'utf-8');
                console.log(`💾 Backup de música de fundo salvo em data/music_settings_backup.json`);
            }
        } catch(e) {}

    } catch (err) {
        console.error('Erro ao salvar backup completo do banco de dados:', err && err.message ? err.message : err);
    }
}

async function restoreFullDatabaseFromBackup() {
    try {
        // Restaura Produtos
        await restoreProductsFromBackup();

        const dataDir = path.join(__dirname, 'data');

        // Restaura Usuários
        const usersBackupPath = path.join(dataDir, 'users_backup.json');
        if (fs.existsSync(usersBackupPath)) {
            const usersData = JSON.parse(fs.readFileSync(usersBackupPath, 'utf-8'));
            if (Array.isArray(usersData)) {
                for (let u of usersData) {
                    const check = await pool.query('SELECT id FROM users WHERE email = $1 OR id = $2', [u.email, u.id]);
                    if (check.rows.length === 0) {
                        if (u.id) {
                            await pool.query(
                                `INSERT INTO users (id, email, password_hash, is_verified, balance, points, game_nickname, google_id, facebook_id, steam_id, avatar, is_admin, subscription_expires_at, reading_subscription_expires_at) 
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                                ON CONFLICT (id) DO NOTHING`,
                                [
                                    u.id,
                                    u.email,
                                    u.password_hash || '',
                                    u.is_verified ? 1 : 0,
                                    parseFloat(u.balance) || 0.00,
                                    parseInt(u.points) || 0,
                                    u.game_nickname || null,
                                    u.google_id || null,
                                    u.facebook_id || null,
                                    u.steam_id || null,
                                    u.avatar || null,
                                    u.is_admin ? 1 : 0,
                                    u.subscription_expires_at || null,
                                    u.reading_subscription_expires_at || null
                                ]
                            );
                        } else {
                            await pool.query(
                                `INSERT INTO users (email, password_hash, is_verified, balance, points, game_nickname, google_id, facebook_id, steam_id, avatar, is_admin, subscription_expires_at, reading_subscription_expires_at) 
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                                [
                                    u.email,
                                    u.password_hash || '',
                                    u.is_verified ? 1 : 0,
                                    parseFloat(u.balance) || 0.00,
                                    parseInt(u.points) || 0,
                                    u.game_nickname || null,
                                    u.google_id || null,
                                    u.facebook_id || null,
                                    u.steam_id || null,
                                    u.avatar || null,
                                    u.is_admin ? 1 : 0,
                                    u.subscription_expires_at || null,
                                    u.reading_subscription_expires_at || null
                                ]
                            );
                        }
                    }
                }
                console.log(`✅ Usuários restaurados a partir de data/users_backup.json`);
            }
        }

        // Restaura Pedidos e Chaves Entregues aos clientes
        const ordersBackupPath = path.join(dataDir, 'orders_backup.json');
        if (fs.existsSync(ordersBackupPath)) {
            const ordersData = JSON.parse(fs.readFileSync(ordersBackupPath, 'utf-8'));
            if (ordersData && Array.isArray(ordersData.orders)) {
                for (let ord of ordersData.orders) {
                    const check = await pool.query('SELECT id FROM orders WHERE id = $1', [ord.id]);
                    if (check.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO orders (id, user_id, total, status, payment_method, is_deposit, pix_qr_code, pix_qr_code_base64, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                             ON CONFLICT (id) DO NOTHING`,
                            [
                                ord.id,
                                ord.user_id,
                                parseFloat(ord.total) || 0,
                                ord.status || 'completed',
                                ord.payment_method || 'PIX',
                                ord.is_deposit || false,
                                ord.pix_qr_code || '',
                                ord.pix_qr_code_base64 || '',
                                ord.created_at || new Date()
                            ]
                        );
                    }
                }
            }

            if (ordersData && Array.isArray(ordersData.order_items)) {
                for (let item of ordersData.order_items) {
                    const check = await pool.query('SELECT id FROM order_items WHERE id = $1', [item.id]);
                    if (check.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO order_items (id, order_id, product_id, title, price, activation_key, key_viewed)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)
                             ON CONFLICT (id) DO NOTHING`,
                            [
                                item.id,
                                item.order_id,
                                item.product_id,
                                item.title || '',
                                parseFloat(item.price) || 0,
                                item.activation_key || '',
                                item.key_viewed || false
                            ]
                        );
                    }
                }
            }
            console.log(`✅ Pedidos e chaves entregues restaurados a partir de data/orders_backup.json`);
        }

        // Restaura Tickets de Suporte
        const ticketsBackupPath = path.join(dataDir, 'tickets_backup.json');
        if (fs.existsSync(ticketsBackupPath)) {
            const ticketsData = JSON.parse(fs.readFileSync(ticketsBackupPath, 'utf-8'));
            if (ticketsData && Array.isArray(ticketsData.tickets)) {
                for (let t of ticketsData.tickets) {
                    const check = await pool.query('SELECT id FROM support_tickets WHERE id = $1', [t.id]);
                    if (check.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO support_tickets (id, user_id, category, description, status, created_at, updated_at)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)
                             ON CONFLICT (id) DO NOTHING`,
                            [
                                t.id,
                                t.user_id,
                                t.category || 'Geral',
                                t.description || '',
                                t.status || 'open',
                                t.created_at || new Date(),
                                t.updated_at || new Date()
                            ]
                        );
                    }
                }
            }

            if (ticketsData && Array.isArray(ticketsData.messages)) {
                for (let msg of ticketsData.messages) {
                    const check = await pool.query('SELECT id FROM support_ticket_messages WHERE id = $1', [msg.id]);
                    if (check.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO support_ticket_messages (id, ticket_id, sender_type, message, created_at)
                             VALUES ($1, $2, $3, $4, $5)
                             ON CONFLICT (id) DO NOTHING`,
                            [
                                msg.id,
                                msg.ticket_id,
                                msg.sender_type || 'user',
                                msg.message || '',
                                msg.created_at || new Date()
                            ]
                        );
                    }
                }
            }
            console.log(`✅ Tickets de suporte restaurados a partir de data/tickets_backup.json`);
        }

        // Restaura Configurações de Música de Fundo
        const musicBackupPath = path.join(dataDir, 'music_settings_backup.json');
        if (fs.existsSync(musicBackupPath)) {
            try {
                const musicData = JSON.parse(fs.readFileSync(musicBackupPath, 'utf-8'));
                if (musicData) {
                    await pool.query(
                        `INSERT INTO site_music_settings (id, enabled, shuffle, playlist)
                         VALUES (1, $1, $2, $3)
                         ON CONFLICT (id) DO UPDATE SET enabled = $1, shuffle = $2, playlist = $3`,
                        [musicData.enabled === true, musicData.shuffle !== false, JSON.stringify(musicData.playlist || [])]
                    );
                    console.log(`✅ Configurações de música restauradas a partir de data/music_settings_backup.json`);
                }
            } catch(e) {
                console.error("Erro ao restaurar música do backup:", e);
            }
        }

        await fixPostgresSequences();

    } catch (err) {
        console.error('Erro ao restaurar banco de dados completo do backup:', err && err.message ? err.message : err);
    }
}

// Helper para decodificar e salvar imagem em Base64 - Ajustado para persistir strings Base64 diretamente no banco de dados.
// Isso evita a perda de imagens customizadas em servidores com filesystem efemero (como o Render).
function saveBase64Image(base64Str, prefix = 'product') {
    return base64Str;
}

// Migracao desativada para manter persistencia do Base64 diretamente no banco de dados PostgreSQL
async function migrateExistingBase64Images() {
    return;
}

// Ajudante interno para buscar detalhes no Steam
async function querySteamAPI(cleanTitle) {
    try {
        // 1. Busca o AppID do jogo no Steam
        const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanTitle)}&l=portuguese&cc=BR`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) return null;
        
        const searchData = await searchRes.json();
        if (!searchData.items || searchData.items.length === 0) {
            return null;
        }
        
        const appid = searchData.items[0].id;
        
        // 2. Busca detalhes do AppID
        const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=portuguese&cc=BR`;
        const detailsRes = await fetch(detailsUrl);
        if (!detailsRes.ok) return null;
        
        const detailsData = await detailsRes.json();
        if (!detailsData[appid] || !detailsData[appid].success) {
            return null;
        }
        
        const gameData = detailsData[appid].data;
        if (gameData.type !== 'game') {
            return null;
        }
        
        const headerImage = gameData.header_image || null;
        let libraryImage = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;
        try {
            const headRes = await fetch(libraryImage, { method: 'HEAD' });
            if (!headRes.ok) {
                libraryImage = headerImage;
            }
        } catch (e) {
            libraryImage = headerImage;
        }
        const screenshots = (gameData.screenshots || []).map(s => s.path_full).slice(0, 5);
        
        let movies = [];
        if (gameData.movies && gameData.movies.length > 0) {
            gameData.movies.forEach(m => {
                const mp4Url = m.mp4 ? (m.mp4.max || m.mp4['480'] || m.mp4['360']) : null;
                const webmUrl = m.webm ? (m.webm.max || m.webm['480'] || m.webm['360']) : null;
                if (mp4Url) movies.push(mp4Url);
                else if (webmUrl) movies.push(webmUrl);
            });
        }

        let ageRating = 'Livre';
        const ratings = gameData.ratings;
        if (ratings && ratings.dejus && ratings.dejus.rating) {
            const dejusRating = ratings.dejus.rating.toLowerCase();
            if (dejusRating === 'l') {
                ageRating = 'Livre';
            } else {
                ageRating = dejusRating + ' anos';
            }
        } else if (gameData.required_age && parseInt(gameData.required_age) > 0) {
            ageRating = gameData.required_age + ' anos';
        } else if (ratings && ratings.pegi && ratings.pegi.rating) {
            const pegiRating = ratings.pegi.rating.toLowerCase();
            if (pegiRating === '3') {
                ageRating = 'Livre';
            } else {
                ageRating = pegiRating + ' anos';
            }
        } else if (ratings && ratings.esrb && ratings.esrb.rating) {
            const esrbLower = ratings.esrb.rating.toLowerCase();
            if (esrbLower === 'e') ageRating = 'Livre';
            else if (esrbLower === 'e10') ageRating = '10 anos';
            else if (esrbLower === 't') ageRating = '13 anos';
            else if (esrbLower === 'm') ageRating = '17 anos';
            else if (esrbLower === 'ao') ageRating = '18 anos';
        }
        
        let originalPrice = null;
        if (gameData.price_overview) {
            const initialCents = gameData.price_overview.initial || gameData.price_overview.final;
            if (initialCents && initialCents > 0) {
                originalPrice = parseFloat((initialCents / 100).toFixed(2));
            }
        }

        return {
            developers: (gameData.developers || []).join(', '),
            publishers: (gameData.publishers || []).join(', '),
            releaseDate: gameData.release_date ? gameData.release_date.date : 'Nao informada',
            languages: gameData.supported_languages ? gameData.supported_languages.replace(/<strong[^>]*>|<\/strong>|<span[^>]*>|<\/span>/gi, '') : 'Nao informado',
            requirementsMin: gameData.pc_requirements ? gameData.pc_requirements.minimum : null,
            headerImage,
            libraryImage,
            screenshots,
            movies,
            ageRating,
            originalPrice
        };
    } catch (err) {
        console.error(`[STEAM-API] Erro ao buscar dados para o jogo "${cleanTitle}":`, err);
        return null;
    }
}

// Busca informacoes do jogo no Steam
async function fetchSteamGameInfo(title) {
    let cleanTitle = title
        .replace(/\b(steam|key|pc|deluxe|definitive|global|edition|gift|card|standard|gold|ultimate|premium|bundle|package|row|activation|account|cd|windows|store)\b/gi, '')
        .replace(/#[0-9]+/g, '')
        .replace(/[():]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
        
    if (!cleanTitle) return null;

    // Normalização de erros comuns de digitação e mapeamento de DLCs
    const lowerTitle = cleanTitle.toLowerCase();
    if (lowerTitle.includes("forza")) {
        cleanTitle = "Forza Horizon 5";
    } else if (lowerTitle.includes("devil may cri")) {
        cleanTitle = "Devil May Cry";
    } else if (lowerTitle.includes("injustise") || lowerTitle.includes("injustiçe")) {
        cleanTitle = "Injustice";
    } else if (lowerTitle.includes("mine craft")) {
        cleanTitle = "Minecraft";
    }
    
    let result = await querySteamAPI(cleanTitle);
    
    // Fallback: se falhar ou retornar nulo (ex: DLC / Personagem tipo "Vergil"), tenta o jogo base
    if (!result) {
        let baseTitle = title.split(/[-+:]/)[0].trim();
        baseTitle = baseTitle
            .replace(/\b(vergil|dlc|expansion|soundtrack|ost|pass|pack|addon|add-on)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
            
        if (baseTitle && baseTitle.toLowerCase() !== title.toLowerCase()) {
            console.log(`[STEAM-SYNC] Falhou para "${title}". Tentando buscar pelo jogo base: "${baseTitle}"`);
            result = await fetchSteamGameInfo(baseTitle);
        }
    }
    
    return result;
}

// Limpa e formata a descricao do produto para exibicao publica (converte markdown e remove asteriscos soltos)
function formatProductDescription(desc, isGlobal = true, restrictedCountries = '') {
    if (!desc) desc = '';
    let formatted = desc
        // Converte **texto** para <strong>texto</strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Substitui asteriscos de lista (* item) no inicio de linhas por bullet points (• item)
        .replace(/^\s*\*\s+/gm, '• ')
        // Remove quaisquer outros asteriscos soltos
        .replace(/\*/g, '')
        .trim();

    // Se o produto não for global, anexa a lista de países de ativação permitidos
    if (isGlobal === false && restrictedCountries && restrictedCountries.trim() !== '') {
        const countriesList = restrictedCountries.split(',').map(c => c.trim()).filter(Boolean).join(', ');
        
        // Remove blocos de países duplicados se já existirem
        const countriesRegex = /<!-- REGION_COUNTRIES_START -->[\s\S]*?<!-- REGION_COUNTRIES_END -->/g;
        formatted = formatted.replace(countriesRegex, '');
        
        formatted += `\n\n<!-- REGION_COUNTRIES_START -->
<div class="mt-4 p-4 border border-rose-500/20 bg-rose-500/5 rounded-xl text-left">
    <div class="flex items-center gap-2 mb-2 text-rose-400 font-orbitron text-[10px] font-bold tracking-widest">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        PAÍSES PERMITIDOS PARA ATIVAÇÃO:
    </div>
    <p class="font-inter text-xs text-slate-400 leading-relaxed">
        Este produto é <strong>restrito</strong> e só pode ser ativado nos seguintes países: <span class="text-slate-200 font-semibold">${countriesList}</span>.
    </p>
</div>
<!-- REGION_COUNTRIES_END -->`;
    }
    
    return formatted;
}

// Auxiliares para extrair e gerar classificacao indicativa (ClassInd Brasil)
function getAgeRatingFromDescription(desc) {
    if (!desc) return 'Livre';
    const match = desc.match(/(?:Classificacao|Classificação):\s*(?:<\/strong>\s*)?([^<\n]+)/i);
    if (match) {
        return match[1].trim().replace(/\s*anos?/gi, '').trim();
    }
    const ageMatch = desc.match(/\b(18|16|14|12|10)\s*anos?\b/i);
    if (ageMatch) {
        return ageMatch[1];
    }
    return 'Livre';
}

function getAgeRatingBadgeHtml(rating) {
    let bgClass = 'bg-emerald-600';
    let textClass = 'text-white';
    let label = 'L';
    let fullName = 'Livre';
    
    const rLower = rating.toLowerCase();
    if (rLower.includes('18')) {
        bgClass = 'bg-black border border-slate-700';
        textClass = 'text-white';
        label = '18';
        fullName = 'Não recomendado para menores de 18 anos';
    } else if (rLower.includes('16')) {
        bgClass = 'bg-red-600';
        textClass = 'text-white';
        label = '16';
        fullName = 'Não recomendado para menores de 16 anos';
    } else if (rLower.includes('14')) {
        bgClass = 'bg-orange-500';
        textClass = 'text-white';
        label = '14';
        fullName = 'Não recomendado para menores de 14 anos';
    } else if (rLower.includes('12')) {
        bgClass = 'bg-yellow-400';
        textClass = 'text-slate-900';
        label = '12';
        fullName = 'Não recomendado para menores de 12 anos';
    } else if (rLower.includes('10')) {
        bgClass = 'bg-blue-500';
        textClass = 'text-white';
        label = '10';
        fullName = 'Não recomendado para menores de 10 anos';
    }
    
    return `
        <div class="inline-flex items-center gap-2 bg-slate-900/60 border border-slate-800 p-2 rounded-xl" title="${fullName}">
            <div class="${bgClass} ${textClass} w-6 h-6 flex items-center justify-center font-orbitron font-bold text-xs rounded select-none shadow-sm">${label}</div>
            <span class="text-[10px] text-slate-400 font-orbitron font-bold uppercase tracking-wider">${fullName}</span>
        </div>
    `;
}

// Atualiza a descricao do produto com os dados obtidos do Steam
async function autoUpdateProductSteamInfo(productId, title, currentDescription) {
    try {
        const steamInfo = await fetchSteamGameInfo(title);
        if (!steamInfo) {
            console.log(`[STEAM-SYNC] Informacoes nao encontradas no Steam para o jogo: ${title}`);
            return false;
        }
        
        // Formata os requisitos minimos
        let cleanReq = steamInfo.requirementsMin;
        if (cleanReq) {
            cleanReq = cleanReq.replace(/^(<strong>)?\s*(m&iacute;nimos|m&iacute;nimo|m&iacute;nimos:|m&iacute;nimo:|minimos|minimo|minimos:|minimo:|minimum|minimum:)\s*(<\/strong>)?\s*(<br\s*\/?>)?/gi, '');
            cleanReq = cleanReq.replace(/class="[^"]*"/gi, '');
            cleanReq = cleanReq.replace(/style="[^"]*"/gi, '');
            cleanReq = cleanReq.replace(/\*/g, '');
        } else {
            cleanReq = 'Requisitos nao informados no Steam.';
        }
        
        let languagesClean = steamInfo.languages.replace(/&amp;/g, '&');
        // Limpa a nota explicativa de suporte de audio e remove os asteriscos soltos dos idiomas
        if (languagesClean.includes('<br>')) {
            languagesClean = languagesClean.split('<br>')[0];
        }
        if (languagesClean.includes('<p>')) {
            languagesClean = languagesClean.split('<p>')[0];
        }
        languagesClean = languagesClean.replace(/\*/g, '').trim().replace(/,\s*$/, '');
        
        // Monta o bloco HTML estilizado em cyberpunk
        const metadataBlock = `<!-- STEAM_METADATA_START -->
<div class="mt-8 border-t border-slate-900 pt-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-slate-950/40 border border-slate-900 p-5 rounded-xl text-left">
            <h4 class="font-orbitron font-bold text-xs tracking-wider text-electricblue uppercase mb-4">// FICHA TECNICA</h4>
            <ul class="space-y-2.5 font-inter text-xs text-slate-400">
                <li><strong class="text-slate-300">Desenvolvedor:</strong> ${steamInfo.developers || 'Nao informado'}</li>
                <li><strong class="text-slate-300">Distribuidora:</strong> ${steamInfo.publishers || 'Nao informado'}</li>
                <li><strong class="text-slate-300">Data de Lancamento:</strong> ${steamInfo.releaseDate}</li>
                <li><strong class="text-slate-300">Idiomas:</strong> ${languagesClean}</li>
                <li><strong class="text-slate-300">Classificacao:</strong> ${steamInfo.ageRating || 'Nao informada'}</li>
            </ul>
        </div>
        <div class="bg-slate-950/40 border border-slate-900 p-5 rounded-xl text-left">
            <h4 class="font-orbitron font-bold text-xs tracking-wider text-cyberrose uppercase mb-4">// REQUISITOS MINIMOS</h4>
            <div class="font-inter text-xs text-slate-400 leading-relaxed steam-requirements">
                ${cleanReq}
            </div>
        </div>
    </div>
</div>
<!-- STEAM_METADATA_END -->`;

        // Modifica a descricao mantendo a parte original e substituindo/adicionando a parte do Steam
        let newDescription = currentDescription || '';
        const regex = /<!-- STEAM_METADATA_START -->[\s\S]*?<!-- STEAM_METADATA_END -->/g;
        
        if (regex.test(newDescription)) {
            newDescription = newDescription.replace(regex, metadataBlock);
        } else {
            newDescription = newDescription.trim() + '\n\n' + metadataBlock;
        }
        
        // Verifica e atualiza imagem e galeria se forem locais/base64 (evita imagens quebradas)
        const prodRes = await pool.query("SELECT image, gallery FROM products WHERE id = $1", [productId]);
        let imageUpdated = false;
        if (prodRes.rows.length > 0) {
            const product = prodRes.rows[0];
            let newImage = product.image;
            let newGallery = product.gallery || '[]';
            let needsUpdate = false;
            
            let isCurrentImgBroken = !newImage || newImage.trim() === '' || newImage === '/logo.png';
            if (!isCurrentImgBroken && newImage.startsWith('/uploads/')) {
                const physicalPath = path.join(__dirname, 'public', newImage);
                if (!fs.existsSync(physicalPath)) {
                    isCurrentImgBroken = true;
                }
            }
            
            if (isCurrentImgBroken) {
                if (steamInfo.libraryImage) {
                    newImage = steamInfo.libraryImage;
                    needsUpdate = true;
                    console.log(`[STEAM-SYNC] Atualizando imagem do produto ID ${productId} para imagem da biblioteca do Steam: ${newImage}`);
                } else if (steamInfo.headerImage) {
                    newImage = steamInfo.headerImage;
                    needsUpdate = true;
                    console.log(`[STEAM-SYNC] Atualizando imagem do produto ID ${productId} para imagem de cabecalho do Steam: ${newImage}`);
                }
            }
            
            if (newGallery === '[]' || !newGallery || newGallery === 'null') {
                let mediaItems = [];
                if (steamInfo.movies && steamInfo.movies.length > 0) {
                    mediaItems.push(steamInfo.movies[0]); // Vídeo de gameplay em primeiro!
                }
                if (steamInfo.screenshots && steamInfo.screenshots.length > 0) {
                    mediaItems = mediaItems.concat(steamInfo.screenshots);
                }
                if (mediaItems.length > 0) {
                    newGallery = JSON.stringify(mediaItems);
                    needsUpdate = true;
                    console.log(`[STEAM-SYNC] Atualizando galeria e trailer de gameplay do produto ID ${productId}.`);
                }
            }
            
            if (needsUpdate) {
                await pool.query(
                    "UPDATE products SET image = $1, gallery = $2 WHERE id = $3",
                    [newImage, newGallery, productId]
                );
                imageUpdated = true;
            }
        }
        
        await pool.query(
            "UPDATE products SET description = $1 WHERE id = $2",
            [newDescription, productId]
        );
        
        if (steamInfo.originalPrice && steamInfo.originalPrice > 0) {
            await pool.query(
                "UPDATE products SET old_price = $1 WHERE id = $2 AND (old_price IS NULL OR old_price = 0 OR old_price < price)",
                [steamInfo.originalPrice, productId]
            );
        }
        
        console.log(`[STEAM-SYNC] Produto ID: ${productId} (${title}) atualizado com metadados do Steam.${imageUpdated ? ' Imagens atualizadas.' : ''}`);
        return true;
    } catch (err) {
        console.error(`[STEAM-SYNC] Erro ao atualizar produto ID: ${productId}:`, err);
        return false;
    }
}

// Sincroniza todos os produtos pendentes
async function syncAllProductsSteamInfo() {
    try {
        console.log('[STEAM-SYNC] Iniciando sincronizacao de requisitos de jogos...');
        const result = await pool.query("SELECT id, title, description, image FROM products");
        const products = result.rows;
        
        let count = 0;
        for (const p of products) {
            let isImageBroken = !p.image || p.image.trim() === '' || p.image === '/logo.png';
            if (!isImageBroken && p.image && p.image.includes('steamstatic.com')) {
                try {
                    const checkRes = await fetch(p.image, { method: 'HEAD' });
                    if (!checkRes.ok) {
                        isImageBroken = true;
                    }
                } catch (e) {
                    // Ignora erros de rede e mantem o status atual
                }
            } else if (!isImageBroken && p.image && p.image.startsWith('/uploads/')) {
                const physicalPath = path.join(__dirname, 'public', p.image);
                if (!fs.existsSync(physicalPath)) {
                    isImageBroken = true;
                    console.log(`[STEAM-SYNC] Imagem local nao encontrada fisicamente para o produto ID ${p.id} (${p.title}). Marcando como quebrada.`);
                }
            }
            if (!p.description || !p.description.includes('<!-- STEAM_METADATA_START -->') || !p.description.includes('Classificacao:') || isImageBroken) {
                // Aguarda 2 segundos antes de cada requisicao para evitar block do Steam
                await new Promise(resolve => setTimeout(resolve, 2000));
                const success = await autoUpdateProductSteamInfo(p.id, p.title, p.description);
                if (success) count++;
            }
        }
        
        if (count > 0) {
            productsCache = null; // Limpa cache se algum produto atualizou
        }
        console.log(`[STEAM-SYNC] Sincronizacao finalizada. ${count} produtos atualizados.`);
    } catch (err) {
        console.error("[STEAM-SYNC] Erro na sincronizacao geral:", err);
    }
}


async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_verified INTEGER DEFAULT 0,
                verification_token TEXT,
                reset_token TEXT,
                reset_expires BIGINT
            );
            
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                price NUMERIC(10, 2) NOT NULL,
                image TEXT NOT NULL,
                category TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                mp_preference_id TEXT,
                mp_payment_id TEXT,
                status TEXT DEFAULT 'pending',
                total_amount NUMERIC(10, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                amount NUMERIC(10, 2) NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT NOT NULL,
                is_read BOOLEAN DEFAULT false,
                order_id INTEGER REFERENCES orders(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id),
                product_id INTEGER REFERENCES products(id),
                quantity INTEGER,
                price NUMERIC(10, 2)
            );
            
            CREATE TABLE IF NOT EXISTS order_chats (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id),
                sender_type TEXT,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS support_chats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                sender_type TEXT,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS points_earnings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                amount INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sweepstake_participants (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sweepstake_history (
                id SERIAL PRIMARY KEY,
                winner_id INTEGER REFERENCES users(id),
                drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                prize_amount BIGINT DEFAULT 10000000
            );

            CREATE TABLE IF NOT EXISTS streaming_media (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                type TEXT NOT NULL,
                category TEXT NOT NULL,
                thumbnail TEXT NOT NULL,
                video_url TEXT DEFAULT '',
                audio_tracks TEXT DEFAULT '[]',
                subtitles TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS streaming_episodes (
                id SERIAL PRIMARY KEY,
                media_id INTEGER REFERENCES streaming_media(id) ON DELETE CASCADE,
                season INTEGER DEFAULT 1,
                episode_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                video_url TEXT NOT NULL,
                audio_tracks TEXT DEFAULT '[]',
                subtitles TEXT DEFAULT '[]',
                duration INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS reading_media (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                type TEXT NOT NULL,
                category TEXT NOT NULL,
                thumbnail TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reading_chapters (
                id SERIAL PRIMARY KEY,
                media_id INTEGER REFERENCES reading_media(id) ON DELETE CASCADE,
                chapter_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                pdf_url TEXT DEFAULT '',
                pages TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS site_music_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                enabled BOOLEAN DEFAULT false,
                shuffle BOOLEAN DEFAULT true,
                playlist TEXT DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS support_tickets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS support_ticket_messages (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
                sender_type TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE products ADD COLUMN IF NOT EXISTS activation_key TEXT;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS activation_key TEXT;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS key_viewed BOOLEAN DEFAULT false;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT true;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS restricted_countries TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS genres TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price NUMERIC(10, 2);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS gameflip_listing_id TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery TEXT DEFAULT '[]';
            
            ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) DEFAULT 0.00;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS game_nickname TEXT UNIQUE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_id TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deposit BOOLEAN DEFAULT false;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_qr_code TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT;
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP DEFAULT NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reading_subscription_expires_at TIMESTAMP DEFAULT NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_reading_subscription BOOLEAN DEFAULT false;
        `);

        // Seed das configurações de Música de Fundo se estiverem salvas no arquivo local
        try {
            const backup = getMusicSettingsFromBackup();
            if (backup && (backup.enabled !== false || (backup.playlist && backup.playlist.length > 0))) {
                await pool.query(
                    `INSERT INTO site_music_settings (id, enabled, shuffle, playlist)
                     VALUES (1, $1, $2, $3)
                     ON CONFLICT (id) DO UPDATE SET enabled = $1, shuffle = $2, playlist = $3`,
                    [backup.enabled === true, backup.shuffle !== false, JSON.stringify(backup.playlist || [])]
                );
            }
        } catch(e) {
            console.error("Erro ao inicializar site_music_settings:", e);
        }

        // Popular gêneros antigos automaticamente
        pool.query("UPDATE products SET genres = 'Multiplayer, Ação, FPS' WHERE (title ILIKE '%CS:GO%' OR title ILIKE '%Counter%' OR title ILIKE '%Valorant%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Aventura, RPG, Ação' WHERE (title ILIKE '%Elden Ring%' OR title ILIKE '%Witcher%' OR title ILIKE '%Cyberpunk%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Ação, Aventura, Sandbox' WHERE (title ILIKE '%GTA%' OR title ILIKE '%Red Dead%' OR title ILIKE '%Minecraft%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Esportes, Multiplayer' WHERE (title ILIKE '%FIFA%' OR title ILIKE '%FC 24%' OR title ILIKE '%NBA%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Terror, Sobrevivência' WHERE (title ILIKE '%Resident Evil%' OR title ILIKE '%Silent Hill%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Streaming' WHERE (category = 'GIFT CARD' OR title ILIKE '%Netflix%' OR title ILIKE '%Spotify%') AND genres IS NULL").catch(()=>{});

        // Atualizar imagens de baixa resolução para posters de alta resolução (600x900) e locais automaticamente
        pool.query("UPDATE products SET image = '/human_fall_flat.jpg' WHERE title = 'Human: Fall Flat'").catch(()=>{});
        pool.query("UPDATE products SET image = '/batman_arkham_origins.jpg' WHERE title = 'Batman: Arkham Origins'").catch(()=>{});
        pool.query("UPDATE products SET image = '/lego_the_incredibles.jpg' WHERE title = 'LEGO The Incredibles'").catch(()=>{});
        pool.query("UPDATE products SET image = '/lego_dc_super_villains.jpg' WHERE title = 'LEGO DC Super-Villains Deluxe'").catch(()=>{});
        pool.query("UPDATE products SET image = '/shadow_of_war.jpg' WHERE title = 'Middle-earth: Shadow of War Definitive'").catch(()=>{});
        pool.query("UPDATE products SET image = '/lego_movie.jpg' WHERE title = 'The LEGO Movie Videogame'").catch(()=>{});
        pool.query("UPDATE products SET title = 'The LEGO Movie 2 Videogame', image = '/lego_movie_2.jpg', old_price = 129.99 WHERE title ILIKE '%LEGO Movie 2%' OR title = 'The LEGO Movie Videogame'").catch(()=>{});
        pool.query("UPDATE products SET image = '/lego_movie_2.jpg', old_price = 129.99 WHERE title ILIKE '%LEGO Movie 2%'").catch(()=>{});
        pool.query("UPDATE products SET image = '/postal_2.jpg', old_price = 32.99 WHERE title ILIKE '%POSTAL 2%'").catch(()=>{});
        pool.query("UPDATE products SET image = '/amnesia_the_bunker.jpg', old_price = 73.99 WHERE title ILIKE '%Amnesia%Bunker%'").catch(()=>{});
        pool.query("DELETE FROM products WHERE title = 'The Incredible Adventures of Van Helsing'").catch(()=>{});
        pool.query("UPDATE products SET image = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/272470/header.jpg' WHERE title ILIKE '%Van Helsing II%'").catch(()=>{});

        // Popular produtos se estiverem ausentes no Banco de Dados
        const defaultProducts = [
            {
                title: "Human: Fall Flat",
                price: 7.79,
                image: "/human_fall_flat.jpg",
                description: "Human: Fall Flat é um jogo hilário e leve de plataforma baseado em física, ambientado em paisagens flutuantes e oníricas que podem ser jogadas solo ou com até 8 amigos online. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "ABCD-1234-EFGH-5678",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=2r1p8Wd_1e0"])
            },
            {
                title: "Batman: Arkham Origins",
                price: 8.09,
                image: "/batman_arkham_origins.jpg",
                description: "Batman: Arkham Origins apresenta uma Gotham City expandida e uma história original prequela ambientada vários anos antes dos eventos de Batman: Arkham Asylum e Batman: Arkham City.",
                category: "STEAM KEY",
                activation_key: "WXYZ-9876-QWER-TYUI",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=9pnK8akbd2M"])
            },
            {
                title: "LEGO The Incredibles",
                price: 7.50,
                image: "/lego_the_incredibles.jpg",
                description: "Experimente as aventuras emocionantes da família Pera e use seus superpoderes para derrotar o crime e reviver momentos memoráveis dos filmes Os Incríveis e Os Incríveis 2 no mundo LEGO.",
                category: "STEAM KEY",
                activation_key: "LKJH-GFDS-MNBV-CXZA",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=0h5U3x_y9OQ"])
            },
            {
                title: "LEGO Marvel Super Heroes 2",
                price: 8.44,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/647830/header.jpg",
                description: "Vá para o confronto direto com o viajante do tempo Kang, o Conquistador em LEGO Marvel Super Heroes 2.",
                category: "STEAM KEY",
                activation_key: "MARV-EL22-LEGO-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=zJ-L_cE56w0"])
            },
            {
                title: "LEGO DC Super-Villains Deluxe",
                price: 12.01,
                image: "/lego_dc_super_villains.jpg",
                description: "É bom ser mau... Embarque em uma nova aventura da DC/LEGO tornando-se o melhor vilão que o universo já viu. A Deluxe Edition inclui conteúdo extra e DLCs exclusivos.",
                category: "STEAM KEY",
                activation_key: "POIU-YTRE-WQAS-DFGH",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=4L_V32K40n0"])
            },
            {
                title: "Middle-earth: Shadow of War Definitive",
                price: 15.28,
                image: "/shadow_of_war.jpg",
                description: "Experimente um mundo épico aberto trazido à vida pelo Sistema Nêmesis premiado. Forje um novo Anel do Poder, conquiste Fortalezas e domine Mordor com seu próprio exército de orcs nesta Edição Definitiva completa.",
                category: "STEAM KEY",
                activation_key: "MKOI-JNBH-UYGV-CFTX",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=-_UJfX2728k"])
            },
            {
                title: "The LEGO Movie Videogame",
                price: 5.28,
                image: "/lego_movie.jpg",
                description: "Junte-se a Emmet e um grupo improvável de rebeldes em sua busca heroica para impedir o plano maligno do Senhor Negócios. Construa com peças de LEGO nesta incrível aventura em formato de jogo.",
                category: "STEAM KEY",
                activation_key: "ZZZZ-XXXX-CCCC-VVVV",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=6vB-d_KkEWE"])
            },
            {
                title: "Forza DLC #1",
                price: 2.94,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/header.jpg",
                description: "Conteúdo adicional exclusivo DLC para Forza Horizon.",
                category: "DLC",
                activation_key: "FORZ-ADLC-1111-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=5z3n6v0d4Ew"])
            },
            {
                title: "Forza DLC #2",
                price: 2.94,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/header.jpg",
                description: "Conteúdo adicional exclusivo DLC para Forza Horizon.",
                category: "DLC",
                activation_key: "FORZ-ADLC-2222-KEY2",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=5z3n6v0d4Ew"])
            },
            {
                title: "Forza DLC #3",
                price: 2.94,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/header.jpg",
                description: "Conteúdo adicional exclusivo DLC para Forza Horizon.",
                category: "DLC",
                activation_key: "FORZ-ADLC-3333-KEY3",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=5z3n6v0d4Ew"])
            },
            {
                title: "Mad Max (PC Steam Key Global)",
                price: 13.66,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/234140/header.jpg",
                description: "Torne-se Mad Max, um guerreiro solitário em um mundo pós-apocalíptico selvagem onde os carros são a chave para a sobrevivência.",
                category: "STEAM KEY",
                activation_key: "MADM-AXX1-STEAM-KEY",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=vVbhO_4f3D8"])
            },
            {
                title: "Devil May Cry 5 + Vergil",
                price: 24.90,
                old_price: 99.90,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/601150/header.jpg",
                description: "O derradeiro caçador de demônios está de volta em grande estilo! Devil May Cry 5 + Vergil inclui o jogo completo vencedor de prêmios e a expansão que adiciona Vergil como personagem jogável em todas as missões, no Palácio Sangrento e no modo de treino. Enfrente hordas infernais com combates insanos a 60 FPS, gráficos ultra-realistas alimentados pela RE Engine e uma trilha sonora eletrizante. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "DMC5-VRGL-STEAM-KEY1",
                in_stock: true,
                is_global: true,
                genres: "Ação, Hack and Slash, Terror, Multiplayer, Co-op",
                gallery: JSON.stringify([
                    "https://www.youtube.com/watch?v=K9l_5J_161U",
                    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/601150/ss_8cf90a18eb5ecb8abf20ab0ee12f0e0c0a96f131.1920x1080.jpg",
                    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/601150/ss_593a2072f447cf08a983b63297a76c0e86a03014.1920x1080.jpg",
                    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/601150/ss_37a1c3272d7f8d6ea87a224a9ddba6ff0ee31ad4.1920x1080.jpg",
                    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/601150/ss_8a7605d8f635f6067b5e408caebc9b2f29fa756a.1920x1080.jpg"
                ])
            },
            {
                title: "Minecraft Legends (Windows Store Key Global)",
                price: 7.75,
                image: "/minecraft_legends.jpg",
                description: "Explore uma terra verdejante e cheia de recursos à beira da destruição pela invasão dos piglins.",
                category: "WINDOWS STORE",
                activation_key: "MINE-LEG1-WIN-KEY",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=1JSbhvq_E5E"])
            },
            {
                title: "The Forest (PC Steam Account)",
                price: 3.71,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/242760/header.jpg",
                description: "Como único sobrevivente de um acidente de avião de passageiros, você se encontra em uma floresta misteriosa.",
                category: "STEAM ACCOUNT",
                activation_key: "FORE-ST01-ACC-PASS",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=42_lIMlSbeU"])
            },
            {
                title: "Back 4 Blood",
                price: 1.76,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/924970/header.jpg",
                description: "Back 4 Blood é um jogo de tiro em primeira pessoa emocionante dos criadores da aclamada franquia Left 4 Dead.",
                category: "STEAM KEY",
                activation_key: "B4BL-OOD1-STEAM-KEY",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=C3s_J3_v7_E"])
            },
            {
                title: "Borderlands 2 (PC Steam Account)",
                price: 3.83,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/49520/header.jpg",
                description: "Uma nova era de tiro e saque está prestes a começar em Borderlands 2.",
                category: "STEAM ACCOUNT",
                activation_key: "BORD-ERL2-ACC-PASS",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=kKVsfTCv1N0"])
            },
            {
                title: "Metro 2033 Redux (PC Steam Account)",
                price: 2.47,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/286690/header.jpg",
                description: "Metro 2033 Redux é a versão definitiva do clássico 'Metro 2033', reconstruído no mais recente Engine 4.",
                category: "STEAM ACCOUNT",
                activation_key: "METR-O203-ACC-PASS",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=r3Z9x8k0_70"])
            },
            {
                title: "Bully: Scholarship Edition (PC Steam Account)",
                price: 6.89,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/12200/header.jpg",
                description: "Bully: Scholarship Edition conta a história do adolescente travesso Jimmy Hopkins e sua jornada na Bullworth Academy.",
                category: "STEAM ACCOUNT",
                activation_key: "BULL-YSE1-ACC-PASS",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=r2wK2z8X7X8"])
            },
            {
                title: "ARK: Survival Evolved (PC Steam Account)",
                price: 4.04,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/346110/header.jpg",
                description: "Como um homem ou mulher preso nu, congelando e faminto nas margens de uma ilha misteriosa chamada ARK, cace, colha e construa.",
                category: "STEAM ACCOUNT",
                activation_key: "ARKS-URV1-ACC-PASS",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=FW9vsrPWujI"])
            },
            {
                title: "F.E.A.R. 2: Project Origin (PC Steam CD Key)",
                price: 3.97,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/16450/header.jpg",
                description: "Uma explosão devastadora destrói a cidade e desencadeia o terror sobrenatural de Alma em F.E.A.R. 2.",
                category: "STEAM KEY",
                activation_key: "FEAR-2PRO-KEY-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=3Kk7s9k1X0w"])
            },
            {
                title: "Suicide Squad: Kill the Justice League",
                price: 24.90,
                old_price: 279.90,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/315210/header.jpg",
                description: "Dos criadores de Batman: Arkham, Suicide Squad: Kill the Justice League é um jogo de tiro em terceira pessoa de ação que desafia o gênero, onde a banda de desajustados definitiva deve fazer o impossível para salvar o mundo: matar a Liga da Justiça. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "SUIC-IDES-QUAD-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=2EVW2-q46K0"])
            },
            {
                title: "The Incredible Adventures of Van Helsing II",
                price: 7.90,
                old_price: 47.90,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/272470/header.jpg",
                description: "Borgova está à beira da ruína. Reúna seus aliados e enfrente a tirania militarista no papel do caçador de monstros definitivo em The Incredible Adventures of Van Helsing II. Jogo de RPG de ação no estilo Hack and Slash. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "VANH-ELSI-NG02-KEY2",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=7uK_Z2L1hE0"])
            },
            {
                title: "Metal Slug Tactics",
                price: 39.90,
                old_price: 73.99,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1590760/header.jpg",
                description: "Metal Slug Tactics traz o charme nostálgico e a ação tática roguelite da franquia cult METAL SLUG para uma nova dimensão tática de RPG. Lidere os Peregrine Falcons em batalhas táticas dinâmicas por turnos. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "META-LSLU-GTAC-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=8K-4_Y5_w40"])
            },
            {
                title: "Going Under",
                price: 7.90,
                old_price: 104.90,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1154810/header.jpg",
                description: "Going Under é um jogo de exploração de masmorras satírico sobre explorar as ruínas amaldiçoadas de startups de tecnologia que faliram. Como um estagiário não remunerado na cidade distópica de Neo-Cascadia, você empunhará lixo de escritório como armas. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "GOIN-GUND-ER01-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=1xN5eB1S1e0"])
            },
            {
                title: "Fallout 76",
                price: 19.90,
                old_price: 155.00,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1151340/header.jpg",
                description: "Bethesda Game Studios apresenta Fallout 76. Vinte e cinco anos após as bombas caírem, você e seus companheiros habitantes do Refúgio emergem na América pós-nuclear para explorar, construir e triunfar contra as maiores ameaças do deserto. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "FALL-OUT7-6KEY-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=M9FGaan35s0"])
            },
            {
                title: "Injustice: Gods Among Us (Ultimate Edition) (PC) Steam Key GLOBAL",
                price: 7.90,
                old_price: 89.99,
                image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/242700/header.jpg",
                description: "Injustice: Gods Among Us Ultimate Edition aprimora a nova franquia arrojada para o gênero de jogos de luta de NetherRealm Studios. Apresentando 6 novos personagens jogáveis, mais de 30 novas skins e 60 novas missões S.T.A.R. Labs. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "INJU-STIC-EULT-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=hM-m9x_v8x0"])
            },
            {
                title: "The LEGO Movie 2 Videogame",
                price: 9.90,
                old_price: 129.99,
                image: "/lego_movie_2.jpg",
                description: "Os monstros alienígenas invasores deixaram Bricksburg em ruínas! Junte-se a Emmet e a um grupo de heróis para ir além do seu mundo e salvar seus amigos dos habitantes do Sistema Systar em The LEGO Movie 2 Videogame. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "LEGO-MOV2-STEAM-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=6vB-d_KkEWE"])
            },
            {
                title: "POSTAL 2",
                price: 6.90,
                old_price: 32.99,
                image: "/postal_2.jpg",
                description: "Viva uma semana na vida de 'Postal Dude', um homem comum tentando apenas cumprir suas tarefas diárias de forma totalmente politicamente incorreta e insana em POSTAL 2. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "POST-AL02-STEAM-KEY1",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=r1K1m0q_1e0"])
            },
            {
                title: "Amnesia: The Bunker",
                price: 18.90,
                old_price: 73.99,
                image: "/amnesia_the_bunker.jpg",
                description: "Amnesia: The Bunker é um jogo de terror em primeira pessoa ambientado em um bunker desolado da Primeira Guerra Mundial. Enfrente os terrores na escuridão e mantenha as luzes acesas a qualquer custo para sobreviver. Ativação via Steam.",
                category: "STEAM KEY",
                activation_key: "AMNE-SIA0-BUNK-ER01",
                gallery: JSON.stringify(["https://www.youtube.com/watch?v=vD81W6vQ-78"])
            }
        ];

        // Restaura banco de dados completo (produtos, usuários, compras/chaves e suporte) dos arquivos de backup
        await restoreFullDatabaseFromBackup();

        // Se o banco de dados de produtos ainda estiver totalmente vazio (sem backup), popula com os produtos padrão
        const prodCountRes = await pool.query('SELECT COUNT(*) FROM products');
        const prodCount = parseInt(prodCountRes.rows[0].count, 10);
        if (prodCount === 0) {
            for (let p of defaultProducts) {
                await pool.query(
                    'INSERT INTO products (title, description, price, image, category, activation_key, gallery) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [p.title, p.description, p.price, p.image, p.category, p.activation_key, p.gallery || '[]']
                );
            }
            console.log('✅ Produtos padrão inseridos no Banco de Dados (Banco estava vazio).');
        }

        // Salva cópia de backup do estado atual de todas as tabelas no disco para inclusão no Git/GitHub
        await syncFullDatabaseBackup();

        // Agenda backup completo periódico a cada 10 minutos
        setInterval(syncFullDatabaseBackup, 10 * 60 * 1000);

        // Garante que o usuário administrador zherkeys@gmail.com existe localmente para desenvolvimento
        const checkAdmin = await pool.query('SELECT COUNT(*) FROM users WHERE email = $1', ['zherkeys@gmail.com']);
        if (parseInt(checkAdmin.rows[0].count) === 0) {
            const hash = bcrypt.hashSync('admin123', 10);
            await pool.query('INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, $3)', ['zherkeys@gmail.com', hash, 1]);
            console.log('✅ Usuário Administrador (zherkeys@gmail.com) criado no Banco de Dados com a senha "admin123".');
        }
        
        // Executa a migracao de imagens Base64 antigas em segundo plano
        migrateExistingBase64Images().catch(e => console.error("Erro ao migrar imagens antigas no initDB:", e));
        
        // Inicia a sincronização imediata de dados e vídeos de gameplay de jogos via Steam (após 2 segundos)
        setTimeout(syncAllProductsSteamInfo, 2000);
        // Agenda sincronização periódica a cada 30 minutos
        setInterval(syncAllProductsSteamInfo, 30 * 60 * 1000);
    } catch(err) {
        console.error('Error in initDB:', err);
    }
}
initDB();

// Setup Brevo API Key
const BREVO_API_KEY = process.env.BREVO_API_KEY;

async function sendEmailViaBrevo(toEmail, subject, textContent, htmlContent) {
    if(!BREVO_API_KEY) return console.warn("BREVO_API_KEY not found. Email not sent to " + toEmail);
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { email: 'zherkeys@gmail.com', name: 'ZHER KEYS' },
            to: [{ email: toEmail }],
            subject: subject,
            textContent: textContent,
            htmlContent: htmlContent
        })
    });
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(JSON.stringify(errData));
    }
    return await response.json();
}
console.log('Motor de E-mail configurado via Brevo API');

async function checkDuplicateKeysAndNotify(activation_key, productTitle, excludeProductId = null) {
    if (!activation_key) return;
    
    const newKeys = activation_key.split('\n').map(k => k.trim()).filter(Boolean);
    if (newKeys.length === 0) return;
    
    // 1. Verificar duplicatas no proprio payload
    const seenNewKeys = new Set();
    for (const key of newKeys) {
        const keyUpper = key.toUpperCase();
        if (seenNewKeys.has(keyUpper)) {
            throw new Error(`A chave "${key}" esta duplicada na propria lista informada.`);
        }
        seenNewKeys.add(keyUpper);
    }
    
    // 2. Verificar duplicatas contra o banco de dados
    let query = 'SELECT id, title, activation_key FROM products';
    let params = [];
    if (excludeProductId) {
        query += ' WHERE id != $1';
        params.push(excludeProductId);
    }
    
    const result = await pool.query(query, params);
    const existingKeys = new Map(); // keyString -> { id, title }
    result.rows.forEach(row => {
        const keys = (row.activation_key || '').split('\n').map(k => k.trim()).filter(Boolean);
        keys.forEach(k => {
            existingKeys.set(k.toUpperCase(), { id: row.id, title: row.title });
        });
    });
    
    const duplicatesFound = [];
    for (const key of newKeys) {
        const keyUpper = key.toUpperCase();
        if (existingKeys.has(keyUpper)) {
            const conflict = existingKeys.get(keyUpper);
            duplicatesFound.push({ key, conflict });
        }
    }
    
    if (duplicatesFound.length > 0) {
        // Envia email de notificacao para o Admin
        const duplicateListHtml = duplicatesFound.map(d => `<li>Chave: <code>${d.key}</code> - Conflito com: <strong>${d.conflict.title}</strong> (ID: ${d.conflict.id})</li>`).join('');
        const duplicateListText = duplicatesFound.map(d => `Chave: ${d.key} - Conflito com: ${d.conflict.title} (ID: ${d.conflict.id})`).join('\n');
        
        const emailSubject = '⚠️ ALERTA DE SEGURANCA: Tentativa de Cadastro de Chave Duplicada';
        const emailText = `Alerta de Seguranca - Zher Keys\n\nFoi detectada e bloqueada uma tentativa de cadastrar chave(s) duplicada(s).\n\nProduto Alvo: ${productTitle}\n\nChave(s) Duplicada(s):\n${duplicateListText}\n\nData: ${new Date().toISOString()}`;
        const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px; background-color: #0b0f19; color: #f8fafc; border-radius: 8px; border: 1px solid #1e293b;">
                <h2 style="color: #ef4444; margin-top: 0;">⚠️ Alerta de Seguranca - Zher Keys</h2>
                <p>Uma tentativa de cadastrar chaves de ativacao duplicadas foi <strong>bloqueada automaticamente</strong>.</p>
                <p><strong>Produto Alvo:</strong> ${productTitle}</p>
                <p><strong>Detalhes das chaves conflitantes:</strong></p>
                <ul style="background-color: #0f172a; padding: 15px; border-radius: 6px; list-style-type: none; margin: 0 0 20px 0; border: 1px solid #334155;">
                    ${duplicateListHtml}
                </ul>
                <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Data/Hora do bloqueio: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        `;
        
        try {
            await sendEmailViaBrevo('zherkeys@gmail.com', emailSubject, emailText, emailHtml);
            console.log('E-mail de alerta de seguranca de chaves enviado.');
        } catch (mailErr) {
            console.error('Erro ao enviar e-mail de alerta de seguranca:', mailErr);
        }
        
        const firstDup = duplicatesFound[0];
        throw new Error(`A chave "${firstDup.key}" ja esta cadastrada no produto "${firstDup.conflict.title}" (ID: ${firstDup.conflict.id}).`);
    }
}

// Middlewares
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
            return res.status(401).json({ error: 'Você precisa estar logado para realizar esta ação.' });
        }
        res.redirect('/login.html');
    }
};

const requireAdmin = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Não autorizado' });
    try {
        const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0 && result.rows[0].email === 'zherkeys@gmail.com') {
            next();
        } else {
            res.status(403).json({ error: 'Acesso negado. Apenas o dono pode acessar.' });
        }
    } catch(e) {
        res.status(500).json({ error: 'Erro no banco' });
    }
};

// ========================
// API DE PRODUTOS E ADMIN
// ========================

// Ajudante para limpar pedidos pendentes expirados e restaurar seus estoques de chaves com segurança
async function assignKeysToOrder(client, orderId) {
    const itemsRes = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
    for (let item of itemsRes.rows) {
        const productId = item.product_id;
        const qty = item.quantity || 1;
        
        const prodRes = await client.query('SELECT title, activation_key, in_stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
        if (prodRes.rows.length === 0) continue;
        
        const prod = prodRes.rows[0];
        const allKeys = (prod.activation_key || '').split('\n').map(k => k.trim()).filter(Boolean);
        
        const soldKeys = allKeys.slice(0, qty);
        const remainingKeys = allKeys.slice(qty);
        
        const soldKeysStr = soldKeys.join(', ');
        const remainingKeysStr = remainingKeys.join('\n');
        
        await client.query(
            'UPDATE order_items SET activation_key = $1 WHERE order_id = $2 AND product_id = $3',
            [soldKeysStr, orderId, productId]
        );
        
        const inStock = remainingKeys.length > 0;
        await client.query(
            'UPDATE products SET activation_key = $1, in_stock = $2 WHERE id = $3',
            [remainingKeysStr, inStock, productId]
        );
        
        console.log(`[KEYS-ASSIGN] Atribuídas ${soldKeys.length} chaves para o Produto ID ${productId} no Pedido #${orderId}. Restantes no estoque: ${remainingKeys.length}`);
    }
}

async function restoreKeysFromExpiredOrders(client, expiredIds) {
    const itemsRes = await client.query(
        "SELECT product_id, activation_key FROM order_items WHERE order_id = ANY($1::int[]) AND activation_key IS NOT NULL AND activation_key != ''",
        [expiredIds]
    );
    
    for (let item of itemsRes.rows) {
        const productId = item.product_id;
        const keysToRestore = item.activation_key.split(', ').map(k => k.trim()).filter(Boolean);
        if (keysToRestore.length === 0) continue;
        
        const prodRes = await client.query('SELECT activation_key FROM products WHERE id = $1 FOR UPDATE', [productId]);
        if (prodRes.rows.length === 0) continue;
        
        const currentKeys = (prodRes.rows[0].activation_key || '').split('\n').map(k => k.trim()).filter(Boolean);
        const newKeys = keysToRestore.concat(currentKeys);
        const newKeysStr = newKeys.join('\n');
        
        await client.query(
            'UPDATE products SET activation_key = $1, in_stock = true WHERE id = $2',
            [newKeysStr, productId]
        );
        
        console.log(`[KEYS-RESTORE] Devolvidas ${keysToRestore.length} chaves para o estoque do Produto ID ${productId} devido ao cancelamento dos pedidos.`);
    }
}

async function cleanupExpiredOrders() {
    try {
        const expiredRes = await pool.query(
            "SELECT id FROM orders WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes'"
        );
        const expiredIds = expiredRes.rows.map(o => o.id);
        
        if (expiredIds.length > 0) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await restoreKeysFromExpiredOrders(client, expiredIds);
                await client.query(`
                    UPDATE orders SET status = 'cancelled' WHERE id = ANY($1::int[])
                `, [expiredIds]);
                await client.query('COMMIT');
                console.log(`[EXPIRED-CLEANUP] ${expiredIds.length} pedidos pendentes cancelados automaticamente e seus estoques foram restaurados.`);
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }
    } catch (err) {
        console.error("[EXPIRED-CLEANUP] Erro ao limpar pedidos pendentes expirados:", err);
    }
}

// Cache em memória para o catálogo público de produtos para evitar timeouts e lentidão no banco
let productsCache = null;
let productsCacheTime = 0;
const PRODUCTS_CACHE_TTL = 10000; // 10 segundos

// Listar produtos (Público - NÃO EXPÕE A CHAVE)
app.get('/api/products', async (req, res) => {
    const now = Date.now();
    if (productsCache && (now - productsCacheTime < PRODUCTS_CACHE_TTL)) {
        return res.json(productsCache);
    }
    try {
        // Limpa pedidos pendentes expirados e restaura o estoque antes de carregar o catálogo de produtos!
        await cleanupExpiredOrders();

        const result = await pool.query('SELECT id, title, description, price, old_price, image, category, in_stock, is_global, restricted_countries, genres FROM products ORDER BY id ASC');
        productsCache = result.rows.map(row => ({
            ...row,
            description: formatProductDescription(row.description, row.is_global, row.restricted_countries)
        }));
        productsCacheTime = now;
        res.json(productsCache);
    } catch(e) {
        console.error("Erro ao buscar produtos e limpar expirados:", e);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// Admin Listar (EXPÕE A CHAVE PARA O ADMIN VER)
app.get('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
        res.json(result.rows);
    } catch(e) {
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// Listar templates de produtos (Admin)
app.get('/api/admin/products/templates', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT ON (title) title, image, description, category, price, old_price, genres, is_global, restricted_countries FROM products ORDER BY title, id DESC');
        res.json(result.rows);
    } catch(e) {
        console.error("Erro ao buscar templates:", e);
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

// Criar produto (Admin)
app.post('/api/admin/products', requireAdmin, async (req, res) => {
    const { title, description, price, old_price, image, category, activation_key, is_global, restricted_countries, genres, gameflip_listing_id, gallery } = req.body;
    try {
        // Validacao de chaves duplicadas
        await checkDuplicateKeysAndNotify(activation_key, title);
        
        // Converte imagem e galeria Base64 para arquivos
        const savedImage = saveBase64Image(image, 'product');
        let savedGallery = gallery || '[]';
        if (gallery) {
            try {
                let galleryArr = JSON.parse(gallery);
                if (Array.isArray(galleryArr)) {
                    galleryArr = galleryArr.map((imgUrl, index) => saveBase64Image(imgUrl, `gallery_${index}`));
                    savedGallery = JSON.stringify(galleryArr);
                }
            } catch(e) {
                // Silenciosamente falha se nao for JSON valido
            }
        }
        
        const hasKeys = activation_key && activation_key.trim() !== '';
        const insertRes = await pool.query(
            'INSERT INTO products (title, description, price, old_price, image, category, activation_key, in_stock, is_global, restricted_countries, genres, gameflip_listing_id, gallery) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
            [title, description, parseFloat(price), old_price ? parseFloat(old_price) : null, savedImage, category, activation_key || '', hasKeys, is_global === false ? false : true, restricted_countries || '', genres || '', gameflip_listing_id || '', savedGallery]
        );
        const productId = insertRes.rows[0].id;
        
        // Sincroniza metadados do Steam em segundo plano (apos 2 segundos)
        setTimeout(() => autoUpdateProductSteamInfo(productId, title, description), 2000);
        
        productsCache = null; // Limpa o cache para atualizar a home imediatamente
        syncFullDatabaseBackup().catch(e => console.error("Erro no backup do banco de dados:", e));
        res.status(201).json({ message: 'Produto adicionado' });
    } catch(e) {
        console.error("Erro ao adicionar produto:", e);
        res.status(400).json({ error: e.message || 'Erro ao adicionar' });
    }
});

// Criar produtos em lote (Admin Bulk)
app.post('/api/admin/products/bulk', requireAdmin, async (req, res) => {
    const products = req.body;
    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Nenhum produto enviado ou formato inválido.' });
    }
    
    try {
        // Validacao de chaves duplicadas para o lote inteiro antes de comecar a insercao
        const dbResult = await pool.query('SELECT id, title, activation_key FROM products');
        const existingKeys = new Map();
        dbResult.rows.forEach(row => {
            const keys = (row.activation_key || '').split('\n').map(k => k.trim()).filter(Boolean);
            keys.forEach(k => {
                existingKeys.set(k.toUpperCase(), { id: row.id, title: row.title });
            });
        });
        
        const duplicatesFound = [];
        for (const p of products) {
            const newKeys = (p.activation_key || '').split('\n').map(k => k.trim()).filter(Boolean);
            
            // Verifica duplicatas no proprio produto
            const seenNewKeys = new Set();
            for (const key of newKeys) {
                const keyUpper = key.toUpperCase();
                if (seenNewKeys.has(keyUpper)) {
                    throw new Error(`A chave "${key}" esta duplicada na propria lista do produto "${p.title}" a ser importado.`);
                }
                seenNewKeys.add(keyUpper);
            }
            
            // Verifica contra banco e contra os outros itens ja processados do lote
            for (const key of newKeys) {
                const keyUpper = key.toUpperCase();
                if (existingKeys.has(keyUpper)) {
                    const conflict = existingKeys.get(keyUpper);
                    duplicatesFound.push({ key, productTitle: p.title, conflict });
                } else {
                    existingKeys.set(keyUpper, { title: p.title });
                }
            }
        }
        
        if (duplicatesFound.length > 0) {
            const duplicateListHtml = duplicatesFound.map(d => `<li>Chave: <code>${d.key}</code> no produto importado <strong>${d.productTitle}</strong> - Conflito com: <strong>${d.conflict.title}</strong> ${d.conflict.id ? `(ID: ${d.conflict.id})` : '(Lote)'}</li>`).join('');
            const duplicateListText = duplicatesFound.map(d => `Chave: ${d.key} no produto ${d.productTitle} - Conflito com: ${d.conflict.title}`).join('\n');
            
            const emailSubject = '⚠️ ALERTA DE SEGURANCA: Tentativa de Importacao de Chaves Duplicadas';
            const emailText = `Alerta de Seguranca - Zher Keys\n\nFoi detectada e bloqueada uma tentativa de importacao de chave(s) duplicada(s) em lote.\n\nDetalhes:\n${duplicateListText}\n\nData: ${new Date().toISOString()}`;
            const emailHtml = `
                <div style="font-family: sans-serif; padding: 20px; background-color: #0b0f19; color: #f8fafc; border-radius: 8px; border: 1px solid #1e293b;">
                    <h2 style="color: #ef4444; margin-top: 0;">⚠️ Alerta de Seguranca - Importacao Zher Keys</h2>
                    <p>Uma tentativa de importar chaves de ativacao duplicadas foi <strong>bloqueada automaticamente</strong>.</p>
                    <p><strong>Detalhes das chaves conflitantes:</strong></p>
                    <ul style="background-color: #0f172a; padding: 15px; border-radius: 6px; list-style-type: none; margin: 0 0 20px 0; border: 1px solid #334155;">
                        ${duplicateListHtml}
                    </ul>
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Data/Hora do bloqueio: ${new Date().toLocaleString('pt-BR')}</p>
                </div>
            `;
            
            try {
                await sendEmailViaBrevo('zherkeys@gmail.com', emailSubject, emailText, emailHtml);
            } catch (mailErr) {
                console.error('Erro ao enviar e-mail de alerta de seguranca de bulk:', mailErr);
            }
            
            const firstDup = duplicatesFound[0];
            const conflictText = firstDup.conflict.id ? `cadastrada no produto "${firstDup.conflict.title}" (ID: ${firstDup.conflict.id})` : `duplicada no lote (produto: "${firstDup.conflict.title}")`;
            return res.status(400).json({ error: `A chave "${firstDup.key}" do produto "${firstDup.productTitle}" ja esta ${conflictText}.` });
        }
        
        await pool.query('BEGIN');
        
        const insertedProducts = [];
        for (const p of products) {
            const { title, description, price, old_price, image, category, activation_key, is_global, restricted_countries, genres, gameflip_listing_id } = p;
            if (!title || !description || isNaN(parseFloat(price)) || !image || !category) {
                throw new Error(`Dados obrigatórios ausentes no produto: ${title || 'Sem título'}`);
            }
            
            const savedImage = saveBase64Image(image, 'product_bulk');
            
            const insertRes = await pool.query(
                'INSERT INTO products (title, description, price, old_price, image, category, activation_key, is_global, restricted_countries, genres, gameflip_listing_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
                [
                    title, 
                    description, 
                    parseFloat(price), 
                    old_price ? parseFloat(old_price) : null, 
                    savedImage, 
                    category, 
                    activation_key || '', 
                    is_global === false ? false : true, 
                    restricted_countries || '', 
                    genres || '', 
                    gameflip_listing_id || ''
                ]
            );
            const productId = insertRes.rows[0].id;
            insertedProducts.push({ id: productId, title, description });
        }
        
        await pool.query('COMMIT');
        
        // Agenda a busca de dados no Steam de forma escalonada (a cada 3 segundos por produto para nao tomar block)
        insertedProducts.forEach((p, index) => {
            setTimeout(() => autoUpdateProductSteamInfo(p.id, p.title, p.description), (index + 1) * 3000);
        });
        
        productsCache = null; // Limpa o cache público
        syncFullDatabaseBackup().catch(e => console.error("Erro no backup do banco de dados:", e));
        res.status(201).json({ message: `${products.length} produtos adicionados com sucesso!` });
    } catch(e) {
        await pool.query('ROLLBACK');
        console.error("Erro ao adicionar produtos em lote:", e);
        res.status(500).json({ error: e.message || 'Erro ao adicionar produtos em lote' });
    }
});

// Editar produto (Admin)
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, price, old_price, image, category, activation_key, is_global, restricted_countries, genres, gameflip_listing_id, gallery } = req.body;
    try {
        // Validacao de chaves duplicadas (exclui o proprio produto)
        await checkDuplicateKeysAndNotify(activation_key, title, id);
        
        // Converte imagem e galeria Base64 para arquivos
        const savedImage = saveBase64Image(image, `product_${id}`);
        let savedGallery = gallery || '[]';
        if (gallery) {
            try {
                let galleryArr = JSON.parse(gallery);
                if (Array.isArray(galleryArr)) {
                    galleryArr = galleryArr.map((imgUrl, index) => saveBase64Image(imgUrl, `gallery_${id}_${index}`));
                    savedGallery = JSON.stringify(galleryArr);
                }
            } catch(e) {
                // Silenciosamente falha se nao for JSON valido
            }
        }
        
        const hasKeys = activation_key && activation_key.trim() !== '';
        await pool.query(
            'UPDATE products SET title=$1, description=$2, price=$3, old_price=$4, image=$5, category=$6, activation_key=$7, in_stock=$8, is_global=$9, restricted_countries=$10, genres=$11, gameflip_listing_id=$12, gallery=$13 WHERE id=$14',
            [title, description, parseFloat(price), old_price ? parseFloat(old_price) : null, savedImage, category, activation_key || '', hasKeys, is_global === false ? false : true, restricted_countries || '', genres || '', gameflip_listing_id || '', savedGallery, id]
        );
        
        // Atualiza/Sincroniza metadados do Steam em segundo plano (apos 2 segundos)
        setTimeout(() => autoUpdateProductSteamInfo(id, title, description), 2000);
        
        productsCache = null; // Limpa o cache para atualizar a home imediatamente
        syncFullDatabaseBackup().catch(e => console.error("Erro no backup de produto editado:", e));
        res.json({ message: 'Produto atualizado' });
    } catch(e) {
        console.error("Erro ao atualizar produto:", e);
        res.status(400).json({ error: e.message || 'Erro ao atualizar' });
    }
});

// Atualizar apenas a Thumbnail do produto (Admin)
app.patch('/api/admin/products/:id/thumb', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { image } = req.body;
    try {
        if (!image) return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
        const savedImage = saveBase64Image(image, `product_${id}`);
        await pool.query('UPDATE products SET image=$1 WHERE id=$2', [savedImage, id]);
        productsCache = null;
        syncFullDatabaseBackup().catch(e => console.error("Erro no backup de thumbnail:", e));
        res.json({ message: 'Thumbnail atualizada com sucesso', image: savedImage });
    } catch(e) {
        console.error("Erro ao atualizar thumbnail:", e);
        res.status(500).json({ error: 'Erro ao atualizar a thumbnail do produto.' });
    }
});

// Deletar produto (Admin)
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
        productsCache = null; // Limpa o cache para atualizar a home imediatamente
        await syncFullDatabaseBackup();
        res.json({ message: 'Produto deletado com sucesso' });
    } catch(e) {
        console.error("Erro ao deletar produto:", e);
        res.status(500).json({ error: 'Erro ao deletar produto do banco de dados.' });
    }
});

// Endpoint do Analisador de Preços Médios de Mercado (Busca nas Lojas da Internet)
app.post('/api/admin/products/update-market-prices', requireAdmin, async (req, res) => {
    try {
        const productsResult = await pool.query('SELECT * FROM products ORDER BY id ASC');
        const products = productsResult.rows;
        
        if (!products || products.length === 0) {
            return res.status(400).json({ message: 'Nenhum produto cadastrado para atualizar.' });
        }
        
        let usdToBrlRate = 5.50; // Taxa de conversão padrão caso API de câmbio falhe
        try {
            const exchangeRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            if (exchangeRes.ok) {
                const exchangeData = await exchangeRes.json();
                if (exchangeData && exchangeData.rates && exchangeData.rates.BRL) {
                    usdToBrlRate = exchangeData.rates.BRL;
                }
            }
        } catch (e) {
            console.log('Usando taxa USD->BRL padrão:', usdToBrlRate);
        }

        const updatedReport = [];

        for (const prod of products) {
            const cleanTitle = prod.title
                .replace(/\(PC.*?\)/gi, '')
                .replace(/\(Steam.*?\)/gi, '')
                .replace(/\(Windows.*?\)/gi, '')
                .replace(/Global/gi, '')
                .replace(/Key/gi, '')
                .trim();

            const pricesFound = [];
            const originalPricesFound = [];
            const storesAnalyzed = [];

            // 1. Buscar preço oficial em BRL na Steam Store (Preço em promoção e Preço Original sem desconto)
            try {
                const steamUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanTitle)}&l=portuguese&cc=BR`;
                const steamRes = await fetch(steamUrl);
                if (steamRes.ok) {
                    const steamData = await steamRes.json();
                    if (steamData && steamData.items && steamData.items.length > 0) {
                        const item = steamData.items[0];
                        if (item.price) {
                            const brlPrice = item.price.final ? (item.price.final / 100) : 0;
                            const initialBrl = item.price.initial ? (item.price.initial / 100) : brlPrice;
                            if (brlPrice > 0) {
                                pricesFound.push(brlPrice);
                                storesAnalyzed.push('Steam Store (BR)');
                            }
                            if (initialBrl > 0) {
                                originalPricesFound.push(initialBrl);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Erro ao buscar Steam BR para ${cleanTitle}:`, err.message);
            }

            // 2. Buscar ofertas agregadas no CheapShark (GOG, Humble, Fanatical, GMG, Epic, etc.)
            try {
                const csUrl = `https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(cleanTitle)}&limit=5`;
                const csRes = await fetch(csUrl);
                if (csRes.ok) {
                    const csData = await csRes.json();
                    if (Array.isArray(csData) && csData.length > 0) {
                        for (const deal of csData) {
                            const saleUSD = parseFloat(deal.salePrice || deal.normalPrice);
                            const normalUSD = parseFloat(deal.normalPrice || deal.salePrice);
                            if (saleUSD > 0) {
                                const dealPriceBRL = parseFloat((saleUSD * usdToBrlRate).toFixed(2));
                                pricesFound.push(dealPriceBRL);
                                storesAnalyzed.push(`Loja (ID ${deal.storeID})`);
                            }
                            if (normalUSD > 0) {
                                const normalBRL = parseFloat((normalUSD * usdToBrlRate).toFixed(2));
                                originalPricesFound.push(normalBRL);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Erro ao buscar CheapShark para ${cleanTitle}:`, err.message);
            }

            // 3. Se encontrou preços na internet, calcula a média de venda e o preço original sem desconto
            if (pricesFound.length > 0) {
                const sum = pricesFound.reduce((acc, p) => acc + p, 0);
                let avgPrice = parseFloat((sum / pricesFound.length).toFixed(2));
                
                // Aplica margem competitiva de 10% de desconto abaixo da média de mercado para garantir que a Zher Keys seja a mais barata
                const competitivePrice = parseFloat((avgPrice * 0.90).toFixed(2));

                // Busca o preço cheio sem desconto (risco vermelho)
                let oldPrice = null;
                if (originalPricesFound.length > 0) {
                    const maxOriginal = Math.max(...originalPricesFound);
                    if (maxOriginal > competitivePrice) {
                        oldPrice = parseFloat(maxOriginal.toFixed(2));
                    }
                }

                // Fallback para caso não haja preço original explícito maior que o novo preço
                if (!oldPrice && avgPrice > competitivePrice) {
                    oldPrice = avgPrice;
                }

                const currentPrice = parseFloat(prod.price);
                
                await pool.query(
                    'UPDATE products SET price = $1, old_price = $2 WHERE id = $3',
                    [competitivePrice, oldPrice, prod.id]
                );

                updatedReport.push({
                    id: prod.id,
                    title: prod.title,
                    previousPrice: currentPrice,
                    newAveragePrice: competitivePrice,
                    marketPrice: oldPrice || avgPrice,
                    sourcesCount: pricesFound.length,
                    stores: Array.from(new Set(storesAnalyzed)).join(', ')
                });
            }
        }

        productsCache = null; // Limpa o cache público
        await syncFullDatabaseBackup(); // Sincroniza o backup local JSON do banco completo permanentemente!

        res.json({
            success: true,
            message: `Preços médios atualizados com sucesso para ${updatedReport.length} produtos baseados nas lojas da internet!`,
            usdToBrlRate,
            updatedCount: updatedReport.length,
            report: updatedReport
        });
    } catch (err) {
        console.error('Erro ao atualizar preços médios da internet:', err);
        res.status(500).json({ error: 'Erro ao buscar e atualizar preços da internet.' });
    }
});

// Função auxiliar para gerar CPF matematicamente válido exigido pela API do Mercado Pago
function generateCPF() {
    const num = () => Math.floor(Math.random() * 9);
    const n = Array.from({ length: 9 }, num);
    
    let d1 = n.reduce((acc, val, i) => acc + val * (10 - i), 0);
    d1 = 11 - (d1 % 11);
    if (d1 >= 10) d1 = 0;
    
    n.push(d1);
    
    let d2 = n.reduce((acc, val, i) => acc + val * (11 - i), 0);
    d2 = 11 - (d2 % 11);
    if (d2 >= 10) d2 = 0;
    
    n.push(d2);
    
    return n.join('');
}

// ========================
// CHECKOUT & MERCADOPAGO
// ========================

app.post('/create-checkout', requireAuth, async (req, res) => {
    const { items, method, cpf } = req.body; // array of { id, quantity }, method = 'credits' or 'pix', optional cpf
    
    if(!items || items.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });
    
    if (method !== 'credits' && method !== 'pix') {
        return res.status(400).json({ error: 'Método de pagamento inválido.' });
    }
    
    try {
        const ids = items.map(i => parseInt(i.id));
        
        // Evita duplicados nos IDs do carrinho no backend
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length !== ids.length) {
            return res.status(400).json({ error: 'Não é permitido comprar mais de uma unidade de cada jogo por vez.' });
        }
        
        // Evita quantidade superior a 1 no backend
        for (let i of items) {
            if (parseInt(i.quantity) !== 1) {
                return res.status(400).json({ error: 'Só é possível comprar uma unidade de cada jogo por vez.' });
            }
        }
        
        const result = await pool.query('SELECT * FROM products WHERE id = ANY($1::int[])', [ids]);
        const realProducts = result.rows;
        if(realProducts.length === 0) return res.status(400).json({ error: 'Produtos não encontrados' });
        
        // Verifica se algum produto está fora de estoque
        const outOfStock = realProducts.find(p => !p.in_stock);
        if (outOfStock) {
            return res.status(400).json({ error: `O produto "${outOfStock.title}" já está esgotado.` });
        }
        
        let totalAmount = 0;
        items.forEach(cartItem => {
            const dbProduct = realProducts.find(p => p.id === parseInt(cartItem.id));
            if(dbProduct) {
                totalAmount += parseFloat(dbProduct.price);
            }
        });
        
        // Pega o email do usuário
        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        const email = userRes.rows[0]?.email || 'guest@example.com';

        if (method === 'pix') {
            // ==========================================
            // PAGAMENTO DIRETAMENTE VIA PIX COM RESERVA
            // ==========================================
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // FOR UPDATE bloqueia as linhas dos produtos no banco, evitando RACE CONDITIONS de compras simultâneas!
                const prodCheck = await client.query('SELECT id, price, in_stock FROM products WHERE id = ANY($1::int[]) FOR UPDATE', [ids]);
                
                // Verifica se algum item já foi vendido
                for (let p of prodCheck.rows) {
                    if (!p.in_stock) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: `O produto com ID ${p.id} já foi vendido por outro usuário.` });
                    }
                }
                
                // Criar o pedido PENDENTE de chaves no banco de dados (is_deposit = false)
                const orderRes = await client.query(
                    'INSERT INTO orders (user_id, status, total_amount, is_deposit) VALUES ($1, $2, $3, $4) RETURNING id',
                    [req.session.userId, 'pending', totalAmount, false]
                );
                const orderId = orderRes.rows[0].id;
                
                // Salvar os itens do pedido
                for (let item of items) {
                    const dbProduct = realProducts.find(p => p.id === parseInt(item.id));
                    if(dbProduct) {
                        await client.query(
                            'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                            [orderId, dbProduct.id, 1, parseFloat(dbProduct.price)]
                        );
                    }
                }
                
                // Atribui as chaves temporariamente (reserva) e atualiza o estoque
                await assignKeysToOrder(client, orderId);
                
                // Delistar anúncio correspondente no Gameflip
                const productsRes = await client.query('SELECT gameflip_listing_id FROM products WHERE id = ANY($1::int[])', [ids]);
                for (let prod of productsRes.rows) {
                    if (prod.gameflip_listing_id && prod.gameflip_listing_id.trim() !== '') {
                        markGameflipListingAsSold(prod.gameflip_listing_id.trim());
                    }
                }
                
                // Gerar pagamento Pix via Mercado Pago
                const paymentClient = new Payment(mpClient);
                const createdPayment = await paymentClient.create({
                    body: {
                        transaction_amount: parseFloat(totalAmount.toFixed(2)),
                        description: `Compra de Keys Zher Keys - Pedido #${orderId}`,
                        payment_method_id: 'pix',
                        payer: {
                            email: email,
                            first_name: 'Cliente',
                            last_name: 'ZherKeys',
                            identification: {
                                type: 'CPF',
                                number: cpf ? cpf.replace(/\D/g, '') : generateCPF()
                            }
                        },
                        external_reference: orderId.toString(),
                        notification_url: `${APP_URL}/webhook`
                    },
                    requestOptions: {
                        idempotencyKey: crypto.randomUUID()
                    }
                });
                
                const qrCodeBase64 = createdPayment.point_of_interaction.transaction_data.qr_code_base64;
                const qrCode = createdPayment.point_of_interaction.transaction_data.qr_code;
                
                // Atualiza o pedido com os códigos Pix
                await client.query(
                    'UPDATE orders SET mp_payment_id = $1, pix_qr_code = $2, pix_qr_code_base64 = $3 WHERE id = $4',
                    [createdPayment.id.toString(), qrCode, qrCodeBase64, orderId]
                );
                
                // Registra a notificação de pagamento pendente
                await client.query(
                    'INSERT INTO notifications (user_id, title, message, type, order_id) VALUES ($1, $2, $3, $4, $5)',
                    [req.session.userId, 'Pagamento Pendente', `Seu pedido #${orderId} de R$ ${totalAmount.toFixed(2).replace('.', ',')} está aguardando pagamento. Clique para ver detalhes.`, 'warning', orderId]
                );
                
                await client.query('COMMIT');
                
                // Envia e-mail contendo o código Pix copia e cola e QR Code
                sendEmailViaBrevo(
                    email,
                    `⚡ Seu PIX de R$ ${totalAmount.toFixed(2).replace('.', ',')} para liberar suas Keys foi Gerado!`,
                    `Olá! Seu PIX para finalizar a compra no valor de R$ ${totalAmount.toFixed(2).replace('.', ',')} foi gerado com sucesso. Pague utilizando o copia e cola abaixo:\n\n${qrCode}\n\nO PIX expira em 10 minutos e sua key está reservada durante este período.`,
                    `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                        <h2 style="color: #10B981; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">RESERVA DE KEYS ZHER KEYS</h2>
                        <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Pedido #${orderId} - Pix Gerado com Sucesso</p>
                        
                        <div style="background-color: #ef4444; color: white; display: inline-block; padding: 8px 16px; border-radius: 9999px; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-bottom: 25px;">
                            ⚠️ EXPIRA EM 10 MINUTOS (KEYS RESERVADAS)
                        </div>
                        
                        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                            Para receber as suas chaves de ativação na mesma hora, realize o pagamento do Pix copia e cola ou escaneie o código abaixo:
                        </p>
                        
                        <div style="background-color: #ffffff; padding: 15px; border-radius: 12px; display: inline-block; margin-bottom: 25px; box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&amp;data=${encodeURIComponent(qrCode)}" alt="QR Code PIX" style="width: 180px; height: 180px; display: block;" />
                        </div>
                        
                        <p style="color: #94a3b8; font-size: 11px; letter-spacing: 1px; margin-bottom: 8px; text-transform: uppercase; font-weight: bold;">Código Copia e Cola:</p>
                        <div style="background-color: #0b0f19; border: 1px solid #1e293b; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #10B981; word-break: break-all; text-align: left; margin-bottom: 30px;">
                            ${qrCode}
                        </div>
                        
                        <p style="color: #64748b; font-size: 11px; margin-top: 20px;">Esta é uma transação criptografada e segura da loja Zher Keys. Não responda a este e-mail.</p>
                    </div>`
                ).catch(err => console.error("Erro ao enviar e-mail com Pix de compra:", err));
                
                return res.json({ success: true, qr_code_base64: qrCodeBase64, qr_code: qrCode, orderId });
                
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("[PIX-CHECKOUT] Erro no checkout direto via PIX:", err);
                return res.status(500).json({ error: 'Erro interno ao processar pagamento por Pix.' });
            } finally {
                client.release();
            }
            
        } else {
            // ==========================================
            // COMPRA UTILIZANDO CRÉDITOS DA CARTEIRA
            // ==========================================
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // FOR UPDATE bloqueia as linhas dos produtos no banco, evitando RACE CONDITIONS de compras simultâneas!
                const prodCheck = await client.query('SELECT id, price, in_stock FROM products WHERE id = ANY($1::int[]) FOR UPDATE', [ids]);
                
                // Verifica se algum item já foi vendido
                for (let p of prodCheck.rows) {
                    if (!p.in_stock) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: `O produto com ID ${p.id} já foi vendido por outro usuário.` });
                    }
                }
                
                // FOR UPDATE bloqueia a linha do usuário, evitando RACE CONDITIONS / DOUBLE-SPENDING de créditos!
                const userRes = await client.query('SELECT balance, email FROM users WHERE id = $1 FOR UPDATE', [req.session.userId]);
                const balance = parseFloat(userRes.rows[0]?.balance || 0);
                const email = userRes.rows[0]?.email || 'guest@example.com';
                
                if (balance < totalAmount) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
                }
                
                // Criar o pedido APROVADO imediatamente no banco de dados (is_deposit = false)
                const orderRes = await client.query(
                    'INSERT INTO orders (user_id, status, total_amount, is_deposit) VALUES ($1, $2, $3, $4) RETURNING id',
                    [req.session.userId, 'approved', totalAmount, false]
                );
                const orderId = orderRes.rows[0].id;
                
                // Salvar os itens do pedido
                for (let item of items) {
                    const dbProduct = realProducts.find(p => p.id === parseInt(item.id));
                    if(dbProduct) {
                        await client.query(
                            'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                            [orderId, dbProduct.id, 1, parseFloat(dbProduct.price)]
                        );
                    }
                }
                
                // Deduz o saldo
                const newBalance = balance - totalAmount;
                await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, req.session.userId]);
                
                // Registra a transação no extrato da carteira
                await client.query(
                    'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                    [req.session.userId, -totalAmount, 'purchase', `Compra do Pedido #${orderId}`]
                );
                
                // Atribui as chaves e atualiza o estoque
                await assignKeysToOrder(client, orderId);
                
                // Delistar anúncio correspondente no Gameflip
                const productsRes = await client.query('SELECT gameflip_listing_id FROM products WHERE id = ANY($1::int[])', [ids]);
                for (let prod of productsRes.rows) {
                    if (prod.gameflip_listing_id && prod.gameflip_listing_id.trim() !== '') {
                        markGameflipListingAsSold(prod.gameflip_listing_id.trim());
                    }
                }
                
                // Registra a notificação da compra
                await client.query(
                    'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
                    [req.session.userId, 'Compra Aprovada!', `Seu pedido #${orderId} foi aprovado com créditos. Chave de ativação liberada.`, 'success']
                );
                
                await client.query('COMMIT');
                
                // Envia e-mail de confirmação da compra aprovada contendo as chaves (Keys) reveladas!
                // Envia e-mail de confirmação da compra aprovada contendo as chaves (Keys) reveladas!
                const keysRes = await pool.query(
                    'SELECT p.title, oi.activation_key FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1',
                    [orderId]
                );
                let keysListHtml = '';
                keysRes.rows.forEach(k => {
                    keysListHtml += `
                        <div style="background-color: #0b0f19; border: 1px solid #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left;">
                            <strong style="color: #ffffff; display: block; font-size: 14px; margin-bottom: 5px;">${k.title}</strong>
                            <code style="font-family: monospace; font-size: 14px; color: #10B981; font-weight: bold;">${k.activation_key || 'Chave em liberação'}</code>
                        </div>
                    `;
                });
                
                sendEmailViaBrevo(
                    email,
                    `🎮 Suas Keys do Pedido #${orderId} foram Liberadas! - Zher Keys`,
                    `Olá! Seu pagamento usando créditos da carteira foi processado com sucesso. O pedido #${orderId} foi aprovado!`,
                    `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                        <h2 style="color: #10B981; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">PAGAMENTO APROVADO!</h2>
                        <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Pedido #${orderId} - Pago via Carteira</p>
                        
                        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px; text-align: left;">
                            Olá! O débito de <strong>R$ ${totalAmount.toFixed(2).replace('.', ',')}</strong> foi realizado com sucesso do seu saldo de créditos. Suas chaves de ativação já foram liberadas abaixo:
                        </p>
                        
                        ${keysListHtml}
                        
                        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 30px;">
                            Você também pode visualizar suas keys a qualquer momento acessando a aba <strong>Minhas Compras</strong> no site da Zher Keys.
                        </p>
                        
                        <p style="color: #64748b; font-size: 11px; margin-top: 30px;">Esta é uma transação criptografada e segura da loja Zher Keys. Não responda a este e-mail.</p>
                    </div>`
                ).catch(err => console.error("Erro ao enviar e-mail de aprovação de créditos:", err));
                
                return res.json({ success: true, message: 'Compra realizada com sucesso usando créditos da carteira!' });
                
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("[CREDITS-CHECKOUT] Erro no checkout de créditos:", err);
                return res.status(500).json({ error: 'Erro interno ao processar pagamento por créditos.' });
            } finally {
                client.release();
            }
        }
        
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao gerar checkout' });
    }
});

app.post('/create-checkout/paypal', requireAuth, async (req, res) => {
    const { items, paypalOrderId, status } = req.body;
    
    if(!items || items.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });
    
    if (status !== 'COMPLETED') {
        return res.status(400).json({ error: 'O pagamento do PayPal não foi concluído.' });
    }
    
    try {
        const ids = items.map(i => parseInt(i.id));
        
        // Evita duplicados nos IDs do carrinho no backend
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length !== ids.length) {
            return res.status(400).json({ error: 'Não é permitido comprar mais de uma unidade de cada jogo por vez.' });
        }
        
        // Evita quantidade superior a 1 no backend
        for (let i of items) {
            if (parseInt(i.quantity) !== 1) {
                return res.status(400).json({ error: 'Só é possível comprar uma unidade de cada jogo por vez.' });
            }
        }

        const result = await pool.query('SELECT * FROM products WHERE id = ANY($1::int[])', [ids]);
        
        const realProducts = result.rows;
        if(realProducts.length === 0) return res.status(400).json({ error: 'Produtos não encontrados' });
        
        // Verifica se algum produto está fora de estoque
        const outOfStock = realProducts.find(p => !p.in_stock);
        if (outOfStock) {
            return res.status(400).json({ error: `O produto "${outOfStock.title}" já está esgotado.` });
        }
        
        let totalAmount = 0;
        items.forEach(cartItem => {
            const dbProduct = realProducts.find(p => p.id === parseInt(cartItem.id));
            if(dbProduct) {
                totalAmount += parseFloat(dbProduct.price);
            }
        });
        
        // Pega o email do usuário
        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        const email = userRes.rows[0]?.email || 'guest@example.com';

        // Conecta um cliente de pool dedicado para gerenciar a transação segura
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // FOR UPDATE bloqueia as linhas dos produtos no banco, evitando RACE CONDITIONS de compras simultâneas!
            const prodCheck = await client.query('SELECT id, price, in_stock FROM products WHERE id = ANY($1::int[]) FOR UPDATE', [ids]);
            
            // Verifica se algum item já foi vendido
            for (let p of prodCheck.rows) {
                if (!p.in_stock) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `O produto com ID ${p.id} já foi vendido por outro usuário.` });
                }
            }
            
            // Criar o pedido APROVADO no banco
            const orderRes = await client.query(
                'INSERT INTO orders (user_id, status, total_amount, mp_payment_id) VALUES ($1, $2, $3, $4) RETURNING id',
                [req.session.userId, 'approved', totalAmount, paypalOrderId]
            );
            const orderId = orderRes.rows[0].id;
            
            // Salvar os itens do pedido
            for (let item of items) {
                const dbProduct = realProducts.find(p => p.id === parseInt(item.id));
                if(dbProduct) {
                    await client.query(
                        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                        [orderId, dbProduct.id, 1, parseFloat(dbProduct.price)]
                    );
                }
            }
            
            // Atribui as chaves e atualiza o estoque
            await assignKeysToOrder(client, orderId);
            
            // Delistar anúncio correspondente no Gameflip
            const productsRes = await client.query('SELECT gameflip_listing_id FROM products WHERE id = ANY($1::int[])', [ids]);
            for (let prod of productsRes.rows) {
                if (prod.gameflip_listing_id && prod.gameflip_listing_id.trim() !== '') {
                    markGameflipListingAsSold(prod.gameflip_listing_id.trim());
                }
            }
            
            await client.query('COMMIT');
            
            // Envia e-mail de confirmação da compra aprovada contendo as chaves (Keys) reveladas!
            // Envia e-mail de confirmação da compra aprovada contendo as chaves (Keys) reveladas!
            const keysRes = await pool.query(
                'SELECT p.title, oi.activation_key FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1',
                [orderId]
            );
            let keysListHtml = '';
            keysRes.rows.forEach(k => {
                keysListHtml += `
                    <div style="background-color: #0b0f19; border: 1px solid #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left;">
                        <strong style="color: #ffffff; display: block; font-size: 14px; margin-bottom: 5px;">${k.title}</strong>
                        <code style="font-family: monospace; font-size: 14px; color: #10B981; font-weight: bold;">${k.activation_key || 'Chave em liberação'}</code>
                    </div>
                `;
            });
            
            sendEmailViaBrevo(
                email,
                `🎮 Suas Keys do Pedido #${orderId} foram Liberadas via PayPal! - Zher Keys`,
                `Olá! Seu pagamento via PayPal foi processado com sucesso. O pedido #${orderId} foi aprovado!`,
                `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                    <h2 style="color: #3B82F6; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">PAGAMENTO PAYPAL APROVADO!</h2>
                    <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Pedido #${orderId} - Pago via PayPal</p>
                    
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px; text-align: left;">
                        Olá! O pagamento de <strong>R$ ${totalAmount.toFixed(2).replace('.', ',')}</strong> via PayPal foi recebido com sucesso. Suas chaves de ativação já foram liberadas abaixo:
                    </p>
                    
                    ${keysListHtml}
                    
                    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 30px;">
                        Você também pode visualizar suas keys a qualquer momento acessando a aba <strong>Minhas Compras</strong> no site da Zher Keys.
                    </p>
                    
                    <p style="color: #64748b; font-size: 11px; margin-top: 30px;">Esta é uma transação criptografada e segura da loja Zher Keys. Não responda a este e-mail.</p>
                </div>`
            ).catch(err => console.error("Erro ao enviar e-mail PayPal checkout:", err));

            return res.json({ success: true, message: 'Compra realizada com sucesso via PayPal!' });
            
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("[PAYPAL-CHECKOUT] Erro:", err);
            return res.status(500).json({ error: 'Erro interno ao processar pagamento por PayPal.' });
        } finally {
            client.release();
        }
        
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao gerar checkout do PayPal' });
    }
});

// CPF Generator helper for Mercado Pago transparent checkouts
function generateCPF() {
    let n = Array.from({length: 9}, () => Math.floor(Math.random() * 9));
    let d1 = n.reduce((acc, val, i) => acc + val * (10 - i), 0);
    d1 = 11 - (d1 % 11);
    if (d1 >= 10) d1 = 0;
    n.push(d1);
    let d2 = n.reduce((acc, val, i) => acc + val * (11 - i), 0);
    d2 = 11 - (d2 % 11);
    if (d2 >= 10) d2 = 0;
    n.push(d2);
    return n.join('');
}

// ========================
// CARTEIRA E DEPÓSITOS ENDPOINTS
// ========================

// Criar pedido de depósito para adicionar créditos à carteira
app.post('/api/wallet/deposit', requireAuth, async (req, res) => {
    const { amount, method, cpf } = req.body; // amount (numeric), method ('pix' or 'card'), optional cpf
    const parsedAmount = parseFloat(amount);
    
    if (isNaN(parsedAmount) || parsedAmount < 5.00) {
        return res.status(400).json({ error: 'O valor mínimo de depósito é R$ 5,00.' });
    }
    
    try {
        // Criar pedido de depósito pendente no banco
        const orderRes = await pool.query(
            'INSERT INTO orders (user_id, status, total_amount, is_deposit) VALUES ($1, $2, $3, $4) RETURNING id',
            [req.session.userId, 'pending', parsedAmount, true]
        );
        const orderId = orderRes.rows[0].id;
        
        // Pega o email do usuário
        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        const email = userRes.rows[0]?.email || 'guest@example.com';
        
        // Se for PIX
        if (method === 'pix') {
            const paymentClient = new Payment(mpClient);
            const createdPayment = await paymentClient.create({
                body: {
                    transaction_amount: parseFloat(parsedAmount.toFixed(2)),
                    description: `Depósito de Créditos Zher Keys - Pedido #${orderId}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: email,
                        first_name: 'Cliente',
                        last_name: 'ZherKeys',
                        identification: {
                            type: 'CPF',
                            number: cpf ? cpf.replace(/\D/g, '') : generateCPF()
                        }
                    },
                    external_reference: orderId.toString(),
                    notification_url: `${APP_URL}/webhook`
                },
                requestOptions: {
                    idempotencyKey: crypto.randomUUID()
                }
            });
            
            const qrCodeBase64 = createdPayment.point_of_interaction.transaction_data.qr_code_base64;
            const qrCode = createdPayment.point_of_interaction.transaction_data.qr_code;
            
            await pool.query(
                'UPDATE orders SET mp_payment_id = $1, pix_qr_code = $2, pix_qr_code_base64 = $3 WHERE id = $4',
                [createdPayment.id.toString(), qrCode, qrCodeBase64, orderId]
            );
            
            // Registra a notificação de pagamento pendente
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type, order_id) VALUES ($1, $2, $3, $4, $5)',
                [req.session.userId, 'Pagamento Pendente', `Sua recarga de R$ ${parsedAmount.toFixed(2).replace('.', ',')} está aguardando pagamento. Clique aqui para abrir o QR Code.`, 'warning', orderId]
            );
            
            // Envia e-mail com o PIX (usando a API do Google Charts para renderizar o QR Code remotamente de forma compatível)
            sendEmailViaBrevo(
                email,
                `⚡ Seu PIX para Adicionar R$ ${parsedAmount.toFixed(2).replace('.', ',')} na Carteira foi Gerado!`,
                `Olá! Seu PIX para adicionar saldo na Zher Keys foi gerado com sucesso. Pague utilizando o copia e cola abaixo:\n\n${qrCode}\n\nO PIX expira em 10 minutos.`,
                `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                    <h2 style="color: #10B981; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">SALDO DA CARTEIRA</h2>
                    <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Pedido de Depósito #${orderId}</p>
                    
                    <div style="background-color: #ef4444; color: white; display: inline-block; padding: 8px 16px; border-radius: 9999px; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-bottom: 25px;">
                        ⚠️ EXPIRA EM 10 MINUTOS
                    </div>
                    
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                        Para concluir a recarga de <strong>R$ ${parsedAmount.toFixed(2).replace('.', ',')}</strong> na sua carteira de créditos, realize o pagamento do PIX abaixo:
                    </p>
                    
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 12px; display: inline-block; margin-bottom: 25px; box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&amp;data=${encodeURIComponent(qrCode)}" alt="QR Code PIX" style="width: 180px; height: 180px; display: block;" />
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 11px; letter-spacing: 1px; margin-bottom: 8px; text-transform: uppercase; font-weight: bold;">Código Copia e Cola:</p>
                    <div style="background-color: #0b0f19; border: 1px solid #1e293b; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #10B981; word-break: break-all; text-align: left; margin-bottom: 30px;">
                        ${qrCode}
                    </div>
                    
                    <p style="color: #64748b; font-size: 11px; margin-top: 20px;">Esta é uma transação criptografada e segura da loja Zher Keys. Não responda a este e-mail.</p>
                </div>`
            ).catch(err => console.error("Erro ao enviar e-mail com PIX de depósito:", err));
            
            return res.json({ qr_code_base64: qrCodeBase64, qr_code: qrCode, orderId });
        }
        
        // Se for Cartão
        if (method === 'card') {
            const preference = new Preference(mpClient);
            const createdPref = await preference.create({
                body: {
                    items: [{
                        id: `deposit-${orderId}`,
                        title: `Adicionar Saldo Zher Keys R$ ${parsedAmount.toFixed(2)}`,
                        unit_price: parsedAmount,
                        quantity: 1,
                        currency_id: 'BRL'
                    }],
                    external_reference: orderId.toString(),
                    back_urls: {
                        success: `${APP_URL}/account.html?tab=carteira&status=success`,
                        failure: `${APP_URL}/account.html?tab=carteira&status=failure`,
                        pending: `${APP_URL}/account.html?tab=carteira&status=pending`
                    },
                    auto_return: 'approved',
                    notification_url: `${APP_URL}/webhook`
                }
            });
            
            await pool.query('UPDATE orders SET mp_preference_id = $1 WHERE id = $2', [createdPref.id, orderId]);
            return res.json({ init_point: createdPref.init_point, orderId });
        }
        
        res.status(400).json({ error: 'Método de depósito inválido' });
    } catch (e) {
        console.error("[DEPOSIT] Erro ao gerar depósito:", e);
        res.status(500).json({ error: 'Erro interno ao processar solicitação de depósito.' });
    }
});

app.post('/api/wallet/deposit/paypal', requireAuth, async (req, res) => {
    const { amount, paypalOrderId, status } = req.body;
    const parsedAmount = parseFloat(amount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Valor de depósito inválido.' });
    }
    
    if (status !== 'COMPLETED') {
        return res.status(400).json({ error: 'O pagamento do PayPal não foi concluído.' });
    }
    
    try {
        // Criar o pedido de depósito aprovado
        const orderRes = await pool.query(
            'INSERT INTO orders (user_id, status, total_amount, is_deposit, mp_payment_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [req.session.userId, 'pending', parsedAmount, true, paypalOrderId]
        );
        const orderId = orderRes.rows[0].id;
        
        // Aprovar o pedido de forma segura (adiciona o saldo)
        const success = await approveOrderSecure(orderId, paypalOrderId);
        
        if (success) {
            // Pega o email do usuário
            const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
            const email = userRes.rows[0]?.email;
            if (email) {
                sendEmailViaBrevo(
                    email,
                    `🎉 Saldo de R$ ${parsedAmount.toFixed(2).replace('.', ',')} Adicionado via PayPal!`,
                    `Olá! Seu depósito via PayPal de R$ ${parsedAmount.toFixed(2).replace('.', ',')} foi aprovado e o saldo já está disponível na sua carteira de créditos.`,
                    `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                        <h2 style="color: #10B981; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">SALDO ADICIONADO!</h2>
                        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                            Seu depósito de <strong>R$ ${parsedAmount.toFixed(2).replace('.', ',')}</strong> via PayPal foi processado com sucesso.
                        </p>
                     </div>`
                ).catch(err => console.error("Erro ao enviar e-mail PayPal:", err));
            }
            
            return res.json({ success: true, message: 'Depósito aprovado e saldo creditado!' });
        } else {
            return res.status(500).json({ error: 'Erro ao aprovar saldo na carteira.' });
        }
    } catch (e) {
        console.error("[PAYPAL-DEPOSIT] Erro:", e);
        res.status(500).json({ error: 'Erro interno ao processar depósito do PayPal.' });
    }
});

// Aprovador de Pedido Seguro (Thread-safe, Exploit-proof)
async function approveOrderSecure(orderId, paymentId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Busca o pedido e bloqueia a linha dele
        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
        if (orderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            console.error(`[APPROVE-SECURE] Pedido ${orderId} não encontrado.`);
            return false;
        }
        
        const order = orderRes.rows[0];
        
        // Se o pedido já estiver aprovado, não faz nada (evita duplicação)
        if (order.status === 'approved') {
            await client.query('COMMIT');
            console.log(`[APPROVE-SECURE] Pedido ${orderId} já está aprovado.`);
            return true;
        }
        
        // 2. Atualiza o status do pedido para approved e marca a notificação pendente como lida
        await client.query(
            'UPDATE orders SET status = $1, mp_payment_id = $2 WHERE id = $3',
            ['approved', paymentId ? paymentId.toString() : order.mp_payment_id, orderId]
        );
        
        await client.query(
            'UPDATE notifications SET is_read = true WHERE order_id = $1',
            [orderId]
        );
        
        // 3. Se for DEPÓSITO, credita o saldo do usuário com segurança
        if (order.is_deposit) {
            const userId = order.user_id;
            
            // Bloqueia e lê o saldo atual do usuário
            const userRes = await client.query('SELECT balance, email FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userRes.rows.length > 0) {
                const currentBalance = parseFloat(userRes.rows[0].balance || 0);
                const depositAmount = parseFloat(order.total_amount);
                const newBalance = currentBalance + depositAmount;
                
                // Atualiza o saldo
                await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);
                
                // Registra a transação de depósito
                await client.query(
                    'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                    [userId, depositAmount, 'deposit', `Depósito do Pedido #${orderId}`]
                );
                
                // Registra a notificação do depósito
                await client.query(
                    'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
                    [userId, 'Depósito Aprovado!', `R$ ${depositAmount.toFixed(2).replace('.', ',')} adicionados à sua carteira.`, 'success']
                );
                
                console.log(`[APPROVE-SECURE] Depósito do Pedido ${orderId} creditado com sucesso para usuário ${userId}. Valor: R$ ${depositAmount}`);
                
                // Envia e-mail de confirmação do depósito
                const email = userRes.rows[0].email;
                sendEmailViaBrevo(
                    email,
                    `💰 Seus Créditos de R$ ${depositAmount.toFixed(2).replace('.', ',')} foram Adicionados! - Zher Keys`,
                    `Olá! Seu depósito no valor de R$ ${depositAmount.toFixed(2).replace('.', ',')} foi aprovado com sucesso e os créditos já estão disponíveis na sua carteira.`,
                    `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                        <h2 style="color: #10B981; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">CRÉDITOS DISPONÍVEIS!</h2>
                        <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Depósito #${orderId} - Confirmado</p>
                        
                        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                            Olá! O seu pagamento foi processado com sucesso. O valor de <strong>R$ ${depositAmount.toFixed(2).replace('.', ',')}</strong> foi adicionado ao seu saldo de créditos da carteira!
                        </p>
                        
                        <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 12px; display: inline-block; margin-bottom: 25px;">
                            <span style="color: #94a3b8; font-size: 12px; display: block; font-family: sans-serif; margin-bottom: 5px;">NOVO SALDO DA CARTEIRA</span>
                            <span style="color: #10B981; font-size: 28px; font-weight: bold; font-family: sans-serif;">R$ ${newBalance.toFixed(2).replace('.', ',')}</span>
                        </div>
                        
                        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 10px;">
                            Agora você pode voltar ao site e comprar qualquer chave de ativação utilizando os seus créditos imediatamente!
                        </p>
                        
                        <p style="color: #64748b; font-size: 11px; margin-top: 30px;">Esta é uma transação criptografada e segura da loja Zher Keys. Não responda a este e-mail.</p>
                    </div>`
                ).catch(err => console.error("Erro ao enviar e-mail de depósito:", err));
            }
        } else if (order.is_subscription) {
            // 3.1 Se for ASSINATURA DE STREAMING, ativa a assinatura do usuário
            const userId = order.user_id;
            const userRes = await client.query('SELECT subscription_expires_at, email FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userRes.rows.length > 0) {
                const currentExpires = userRes.rows[0].subscription_expires_at;
                let newExpires;
                const now = new Date();
                
                if (!currentExpires || new Date(currentExpires) < now) {
                    newExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                } else {
                    newExpires = new Date(new Date(currentExpires).getTime() + 30 * 24 * 60 * 60 * 1000);
                }
                
                await client.query('UPDATE users SET subscription_expires_at = $1 WHERE id = $2', [newExpires, userId]);
                
                // Registra a transação de assinatura (com valor R$ 9.99 na descrição, mas zero de desconto na carteira já que foi pago direto)
                await client.query(
                    'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                    [userId, 0, 'subscription', `Assinatura Zher Play (Pedido #${orderId})`]
                );
                
                // Registra a notificação da assinatura ativa
                await client.query(
                    'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
                    [userId, 'Assinatura Ativa!', 'Sua assinatura mensal Zher Play foi ativada com sucesso! Aproveite os filmes e séries.', 'success']
                );
                
                console.log(`[APPROVE-SECURE] Assinatura do Pedido ${orderId} ativada para usuário ${userId}. Expira em: ${newExpires}`);
                
                // Envia e-mail de confirmação
                const email = userRes.rows[0].email;
                sendEmailViaBrevo(
                    email,
                    `🎬 Sua Assinatura Zher Play está Ativa! Aproveite!`,
                    `Olá! Seu pagamento para o plano mensal Zher Play (Pedido #${orderId}) foi aprovado e sua assinatura está ativa até ${newExpires.toLocaleDateString('pt-BR')}.`,
                    `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                        <h2 style="color: #E11D48; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">ZHER PLAY ATIVO!</h2>
                        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                            Olá! O seu pagamento foi processado com sucesso. A sua assinatura do plano Zher Play está <strong>ATIVA</strong> por 30 dias!
                        </p>
                        <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 12px; display: inline-block; margin-bottom: 25px;">
                            <span style="color: #94a3b8; font-size: 12px; display: block; margin-bottom: 5px;">VÁLIDO ATÉ</span>
                            <span style="color: #E11D48; font-size: 20px; font-weight: bold;">${newExpires.toLocaleDateString('pt-BR')} às ${newExpires.toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 10px;">
                            Agora você já tem acesso ilimitado a todos os filmes, séries e animes sem anúncios e com áudio duplo + tradução automática!
                        </p>
                    </div>`
                ).catch(err => console.error("Erro ao enviar e-mail de ativação de assinatura:", err));
            }
        } else if (order.is_reading_subscription) {
            // 3.2 Se for ASSINATURA DE LEITURA (EBOOKS/MANGAS), ativa a assinatura do usuário
            const userId = order.user_id;
            const userRes = await client.query('SELECT reading_subscription_expires_at, email FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userRes.rows.length > 0) {
                const currentExpires = userRes.rows[0].reading_subscription_expires_at;
                let newExpires;
                const now = new Date();
                
                if (!currentExpires || new Date(currentExpires) < now) {
                    newExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                } else {
                    newExpires = new Date(new Date(currentExpires).getTime() + 30 * 24 * 60 * 60 * 1000);
                }
                
                await client.query('UPDATE users SET reading_subscription_expires_at = $1 WHERE id = $2', [newExpires, userId]);
                
                // Registra a transação de assinatura (com valor R$ 4.99 na descrição, mas zero de desconto na carteira já que foi pago direto)
                await client.query(
                    'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                    [userId, 0, 'subscription', `Assinatura Zher Read (Pedido #${orderId})`]
                );
                
                // Registra a notificação da assinatura ativa
                await client.query(
                    'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
                    [userId, 'Assinatura Ativa!', 'Sua assinatura mensal Zher Read foi ativada com sucesso! Aproveite os livros e mangás.', 'success']
                );
                
                console.log(`[APPROVE-SECURE] Assinatura de Leitura do Pedido ${orderId} ativada para usuário ${userId}. Expira em: ${newExpires}`);
                
                // Envia e-mail de confirmação
                const email = userRes.rows[0].email;
                sendEmailViaBrevo(
                    email,
                    `📚 Sua Assinatura Zher Read está Ativa! Aproveite!`,
                    `Olá! Seu pagamento para o plano mensal Zher Read (Pedido #${orderId}) foi aprovado e sua assinatura está ativa até ${newExpires.toLocaleDateString('pt-BR')}.`,
                    `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                        <h2 style="color: #A855F7; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">ZHER READ ATIVO!</h2>
                        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                            Olá! O seu pagamento foi processado com sucesso. A sua assinatura do plano Zher Read está <strong>ATIVA</strong> por 30 dias!
                        </p>
                        <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 12px; display: inline-block; margin-bottom: 25px;">
                            <span style="color: #94a3b8; font-size: 12px; display: block; margin-bottom: 5px;">VÁLIDO ATÉ</span>
                            <span style="color: #A855F7; font-size: 20px; font-weight: bold;">${newExpires.toLocaleDateString('pt-BR')} às ${newExpires.toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 10px;">
                            Agora você já tem acesso ilimitado a todos os livros, ebooks e mangás em alta definição e sem anúncios!
                        </p>
                    </div>`
                ).catch(err => console.error("Erro ao enviar e-mail de ativação de assinatura de leitura:", err));
            }
        } else {
            // 4. Se for COMPRA DE PRODUTO, garante que as chaves estão atribuídas e atualiza o estoque
            const items = await client.query('SELECT product_id, activation_key FROM order_items WHERE order_id = $1', [orderId]);
            const pIds = items.rows.map(r => r.product_id);
            if (pIds.length > 0) {
                const needsKeys = items.rows.some(r => !r.activation_key || r.activation_key.trim() === '');
                if (needsKeys) {
                    await assignKeysToOrder(client, orderId);
                }
                
                // Delistar no Gameflip
                const productsRes = await client.query('SELECT gameflip_listing_id FROM products WHERE id = ANY($1::int[])', [pIds]);
                for (let prod of productsRes.rows) {
                    if (prod.gameflip_listing_id && prod.gameflip_listing_id.trim() !== '') {
                        markGameflipListingAsSold(prod.gameflip_listing_id.trim());
                    }
                }
            }
            
            // Registra a notificação da compra
            await client.query(
                'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
                [order.user_id, 'Compra Aprovada!', `Seu pedido #${orderId} foi aprovado. Chave de ativação liberada.`, 'success']
            );
            
            // Envia e-mail de confirmação da compra aprovada contendo as chaves (Keys) reveladas!
            const emailRes = await client.query('SELECT email FROM users WHERE id = $1', [order.user_id]);
            const email = emailRes.rows[0]?.email;
            if (email) {
                const keysRes = await client.query(
                    'SELECT p.title, oi.activation_key FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1',
                    [orderId]
                );
                let keysListHtml = '';
                keysRes.rows.forEach(k => {
                    keysListHtml += `
                        <div style="background-color: #0b0f19; border: 1px solid #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left;">
                            <strong style="color: #ffffff; display: block; font-size: 14px; margin-bottom: 5px;">${k.title}</strong>
                            <code style="font-family: monospace; font-size: 14px; color: #10B981; font-weight: bold;">${k.activation_key || 'Chave em liberação'}</code>
                        </div>
                    `;
                });
                
                sendEmailViaBrevo(
                    email,
                    `🎮 Suas Keys do Pedido #${orderId} foram Liberadas! - Zher Keys`,
                    `Olá! Seu pagamento para o pedido #${orderId} foi aprovado!`,
                    `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                        <h2 style="color: #10B981; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">PAGAMENTO APROVADO!</h2>
                        <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Pedido #${orderId}</p>
                        
                        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px; text-align: left;">
                            Olá! Seu pagamento no valor de <strong>R$ ${parseFloat(order.total_amount).toFixed(2).replace('.', ',')}</strong> foi aprovado com sucesso. Suas chaves de ativação já foram liberadas abaixo:
                        </p>
                        
                        ${keysListHtml}
                        
                        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 30px;">
                            Você também pode visualizar suas keys a qualquer momento acessando a aba <strong>Minhas Compras</strong> no site da Zher Keys.
                        </p>
                        
                        <p style="color: #64748b; font-size: 11px; margin-top: 30px;">Esta é uma transação criptografada e segura da loja Zher Keys. Não responda a este e-mail.</p>
                    </div>`
                ).catch(err => console.error("Erro ao enviar e-mail de aprovação:", err));
            }
        }
        
        await client.query('COMMIT');
        return true;
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[APPROVE-SECURE] Erro geral ao aprovar pedido ${orderId}:`, e);
        return false;
    } finally {
        client.release();
    }
}

app.post('/webhook', async (req, res) => {
    const { topic, id } = req.query;
    const type = req.query.type || req.body?.type;
    if (topic === 'payment' || type === 'payment') {
        const paymentId = id || req.query['data.id'] || req.body?.data?.id;
        if(paymentId) {
            try {
                const paymentClient = new Payment(mpClient);
                const paymentInfo = await paymentClient.get({ id: paymentId });
                
                const orderId = paymentInfo.external_reference;
                const status = paymentInfo.status; // 'approved', 'pending', etc
                
                if(orderId && status) {
                    if (status === 'approved') {
                        await approveOrderSecure(parseInt(orderId), paymentId);
                    } else {
                        await pool.query(
                            'UPDATE orders SET status = $1, mp_payment_id = $2 WHERE id = $3',
                            [status, paymentId.toString(), parseInt(orderId)]
                        );
                    }
                    console.log(`[WEBHOOK] Pedido ${orderId} atualizado para: ${status}`);
                }
            } catch(e) {
                console.error('Erro no webhook de pagamento:', e);
            }
        }
    }
    res.status(200).send('OK');
});

// ========================
// MY ORDERS & CHAT
// ========================

app.get('/api/my-orders', requireAuth, async (req, res) => {
    try {
        // Limpa pedidos pendentes expirados e restaura o estoque
        await cleanupExpiredOrders();

        const ordersRes = await pool.query("SELECT * FROM orders WHERE user_id = $1 AND status != 'cancelled' ORDER BY id DESC", [req.session.userId]);
        const orders = ordersRes.rows;
        
        for (let order of orders) {
            const itemsRes = await pool.query(`
                SELECT oi.quantity, oi.price, oi.product_id, oi.key_viewed,
                CASE WHEN $1 = 'approved' THEN oi.activation_key ELSE NULL END as activation_key,
                p.title, p.image, p.category
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $2
            `, [order.status, order.id]);
            order.items = itemsRes.rows;
        }
        res.json(orders);
    } catch(e) {
        res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
});

app.post('/api/orders/:orderId/items/:productId/reveal', requireAuth, async (req, res) => {
    const { orderId, productId } = req.params;
    try {
        // Verifica se o pedido pertence ao usuario e está aprovado
        const orderRes = await pool.query('SELECT id, status FROM orders WHERE id = $1 AND user_id = $2', [orderId, req.session.userId]);
        if (orderRes.rows.length === 0) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        if (orderRes.rows[0].status !== 'approved') {
            return res.status(400).json({ error: 'Pedido nao aprovado' });
        }

        // Marca a chave como visualizada
        await pool.query('UPDATE order_items SET key_viewed = true WHERE order_id = $1 AND product_id = $2', [orderId, productId]);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao marcar chave como visualizada:", e);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

app.get('/api/orders/:id/chat', requireAuth, async (req, res) => {
    try {
        const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
        if(orderRes.rows.length === 0) return res.status(403).json({ error: 'Acesso negado' });
        
        const chatRes = await pool.query('SELECT * FROM order_chats WHERE order_id = $1 ORDER BY created_at ASC', [req.params.id]);
        res.json(chatRes.rows);
    } catch(e) {
        res.status(500).json({ error: 'Erro ao buscar chat' });
    }
});

app.post('/api/orders/:id/chat', requireAuth, async (req, res) => {
    const { message } = req.body;
    try {
        const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
        if(orderRes.rows.length === 0) return res.status(403).json({ error: 'Acesso negado' });
        
        await pool.query('INSERT INTO order_chats (order_id, sender_type, message) VALUES ($1, $2, $3)', [req.params.id, 'user', message]);
        res.status(201).json({ message: 'Enviado' });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// Admin Orders & Chat
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    try {
        const ordersRes = await pool.query(`
            SELECT o.*, u.email as user_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.id DESC
        `);
        const orders = ordersRes.rows;
        
        for (let order of orders) {
            const itemsRes = await pool.query(`
                SELECT oi.quantity, oi.price, p.title, oi.activation_key, oi.key_viewed
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $1
            `, [order.id]);
            order.items = itemsRes.rows;
            
            const chatRes = await pool.query('SELECT * FROM order_chats WHERE order_id = $1 ORDER BY created_at ASC', [order.id]);
            order.chat = chatRes.rows;
        }
        res.json(orders);
    } catch(e) {
        res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
});

app.post('/api/admin/orders/:id/chat', requireAdmin, async (req, res) => {
    const { message } = req.body;
    try {
        await pool.query('INSERT INTO order_chats (order_id, sender_type, message) VALUES ($1, $2, $3)', [req.params.id, 'admin', message]);
        
        // Envia notificação para o usuário dono do pedido
        const orderRes = await pool.query('SELECT user_id FROM orders WHERE id = $1', [req.params.id]);
        if (orderRes.rows.length > 0) {
            const userId = orderRes.rows[0].user_id;
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
                [userId, 'Nova Mensagem do Suporte', `Você recebeu uma nova mensagem sobre o pedido #${req.params.id}.`, 'chat']
            );
        }
        
        res.status(201).json({ message: 'Enviado' });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

app.put('/api/admin/orders/:id/approve', requireAdmin, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const approved = await approveOrderSecure(orderId, null);
        if (approved) {
            res.json({ message: 'Pedido aprovado manualmente com sucesso!' });
        } else {
            res.status(500).json({ error: 'Erro ao aprovar o pedido de forma segura.' });
        }
    } catch(e) {
        res.status(500).json({ error: 'Erro ao aprovar' });
    }
});

app.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
        // Remove referências de chaves estrangeiras na tabela de notificações
        await pool.query('DELETE FROM notifications WHERE order_id = $1', [req.params.id]);
        
        await pool.query('DELETE FROM order_chats WHERE order_id = $1', [req.params.id]);
        await pool.query('DELETE FROM order_items WHERE order_id = $1', [req.params.id]);
        await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
        res.json({ message: 'Pedido excluído' });
    } catch(e) {
        console.error("[ADMIN-ORDER-DELETE] Erro ao excluir pedido:", e);
        res.status(500).json({ error: 'Erro ao excluir pedido' });
    }
});


// ========================
// FRONTEND ROUTES & AUTH
// ========================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/account.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'account.html'));
});
app.get('/carrinho.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'carrinho.html'));
});

// Admin Route Protected
app.get('/admin.html', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0 && result.rows[0].email === 'zherkeys@gmail.com') {
            res.sendFile(path.join(__dirname, 'public', 'admin.html'));
        } else {
            res.status(403).send('Acesso restrito ao Administrador.');
        }
    } catch(e) {
        res.status(500).send('Erro no banco');
    }
});

// Dynamic SEO Product Route
app.get('/produto/:id', async (req, res) => {
    try {
        const idStr = req.params.id.split('-')[0];
        const id = parseInt(idStr, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
        }
        
        const result = await pool.query('SELECT id, title, description, price, old_price, image, category, in_stock, is_global, restricted_countries, genres, gallery FROM products WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
        }
        
        const product = result.rows[0];
        
        const templatePath = path.join(__dirname, 'public', 'produto.html');
        let html = await fs.promises.readFile(templatePath, 'utf8');
        
        const title = product.title;
        const formattedDesc = formatProductDescription(product.description, product.is_global, product.restricted_countries);
        const description = formattedDesc.replace(/<[^>]*>/g, '').substring(0, 160).replace(/"/g, '&quot;');
        const fullDescription = formattedDesc;
        const imgPath = product.image || '/logo.png';
        const image = (imgPath.startsWith('http') || imgPath.startsWith('data:')) ? imgPath : `https://zherkeys.com${imgPath}`;
        
        // Multi-conversão dinâmica de moedas via Query Parameter (ex: ?currency=USD)
        const exchangeRates = { BRL: 1.0, USD: 0.19, EUR: 0.17 };
        const currency = (req.query.currency || 'BRL').toUpperCase();
        const rate = exchangeRates[currency] || 1.0;
        
        const price = (parseFloat(product.price) * rate).toFixed(2);
        
        let priceHtml, oldPriceHtml;
        if (currency === 'USD') {
            priceHtml = `$ ${price}`;
            oldPriceHtml = product.old_price ? `<del class="text-rose-500 text-sm font-orbitron -mb-1 opacity-80">$ ${(parseFloat(product.old_price) * rate).toFixed(2)}</del>` : '';
        } else if (currency === 'EUR') {
            priceHtml = `€ ${price}`;
            oldPriceHtml = product.old_price ? `<del class="text-rose-500 text-sm font-orbitron -mb-1 opacity-80">€ ${(parseFloat(product.old_price) * rate).toFixed(2)}</del>` : '';
        } else {
            priceHtml = `R$ ${price.replace('.', ',')}`;
            oldPriceHtml = product.old_price ? `<del class="text-rose-500 text-sm font-orbitron -mb-1 opacity-80">R$ ${(parseFloat(product.old_price) * rate).toFixed(2).replace('.', ',')}</del>` : '';
        }
        
        const stockStatus = product.in_stock ? 'Em estoque' : 'Esgotado';
        const availability = product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
        const regionBadge = product.is_global === false 
            ? `<div class="inline-flex items-center gap-1.5 bg-rose-950/40 text-rose-400 border border-rose-900/50 font-orbitron text-xs tracking-widest px-3 py-1.5 rounded uppercase" title="Restrito a alguns países"><i data-lucide="globe" class="w-4 h-4"></i> RESTRIÇÃO REGIONAL</div>` 
            : `<div class="inline-flex items-center gap-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 font-orbitron text-xs tracking-widest px-3 py-1.5 rounded uppercase"><i data-lucide="globe" class="w-4 h-4"></i> GLOBAL</div>`;
        const genresTags = product.genres 
            ? product.genres.split(',').map(g => `<span class="bg-slate-800 border border-slate-700 text-slate-300 font-orbitron text-[10px] tracking-widest px-2.5 py-1 rounded uppercase">${g.trim()}</span>`).join(' ') 
            : '';
            
        const schemaJson = JSON.stringify({
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": title,
            "image": image,
            "description": formattedDesc.replace(/<[^>]*>/g, '').substring(0, 300),
            "sku": `ZHER-${product.id}`,
            "mpn": `ZHER-${product.id}`,
            "brand": {
                "@type": "Brand",
                "name": "Zher Keys"
            },
            "category": product.category || "Game Key",
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "reviewCount": "128",
                "bestRating": "5",
                "worstRating": "1"
            },
            "review": [
                {
                    "@type": "Review",
                    "author": {
                        "@type": "Person",
                        "name": "Thiago Souza"
                    },
                    "datePublished": "2026-01-15",
                    "reviewBody": "Entrega instantânea de verdade! Comprei a chave e recebi no painel em menos de 10 segundos. Recomendo demais!",
                    "reviewRating": {
                        "@type": "Rating",
                        "ratingValue": "5",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                },
                {
                    "@type": "Review",
                    "author": {
                        "@type": "Person",
                        "name": "Mariana Alencar"
                    },
                    "datePublished": "2026-01-18",
                    "reviewBody": "Excelente suporte via WhatsApp. Tive uma dúvida na ativação e em menos de 5 minutos me ajudaram. Transparência nota 10.",
                    "reviewRating": {
                        "@type": "Rating",
                        "ratingValue": "5",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                },
                {
                    "@type": "Review",
                    "author": {
                        "@type": "Person",
                        "name": "Lucas G."
                    },
                    "datePublished": "2026-01-20",
                    "reviewBody": "Melhor preço de chaves globais do mercado. Já comprei 3 jogos aqui e todos ativaram perfeitamente na Steam. Nota 10!",
                    "reviewRating": {
                        "@type": "Rating",
                        "ratingValue": "5",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                }
            ],
            "offers": {
                "@type": "Offer",
                "url": `https://zherkeys.com/produto/${product.id}`,
                "priceCurrency": currency,
                "price": price,
                "priceValidUntil": "2030-12-31",
                "availability": availability,
                "itemCondition": "https://schema.org/NewCondition",
                "seller": {
                    "@type": "Organization",
                    "name": "Zher Keys"
                },
                "hasMerchantReturnPolicy": {
                    "@type": "MerchantReturnPolicy",
                    "applicableCountry": "BR",
                    "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
                    "merchantReturnDays": 7,
                    "returnMethod": "https://schema.org/ReturnOnline",
                    "returnFees": "https://schema.org/FreeReturn"
                },
                "shippingDetails": {
                    "@type": "OfferShippingDetails",
                    "shippingRate": {
                        "@type": "MonetaryAmount",
                        "value": "0.00",
                        "currency": currency
                    },
                    "shippingDestination": {
                        "@type": "DefinedRegion",
                        "addressCountry": "BR"
                    },
                    "deliveryTime": {
                        "@type": "ShippingDeliveryTime",
                        "handlingTime": {
                            "@type": "QuantitativeValue",
                            "minValue": 0,
                            "maxValue": 0,
                            "unitCode": "DAY"
                        },
                        "transitTime": {
                            "@type": "QuantitativeValue",
                            "minValue": 0,
                            "maxValue": 0,
                            "unitCode": "DAY"
                        }
                    }
                }
            }
        });

        const ratingVal = getAgeRatingFromDescription(product.description);
        const ratingHtml = getAgeRatingBadgeHtml(ratingVal);
        const is18Plus = ratingVal === '18';
        const isLoggedIn = !!req.session.userId;
        const requiresAgeGate = is18Plus && !isLoggedIn;

        const slug = (product.title || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove acentos
            .replace(/[^a-z0-9]+/g, '-')     // substitui caracteres especiais por hifens
            .replace(/(^-|-$)+/g, '');       // remove hifens no inicio/fim
        const safeSlug = slug || 'produto';

        html = html
            .replace(/{{PRODUCT_TITLE}}/g, title)
            .replace(/{{PRODUCT_DESCRIPTION}}/g, description)
            .replace(/{{PRODUCT_FULL_DESCRIPTION}}/g, fullDescription)
            .replace(/{{PRODUCT_IMAGE}}/g, image)
            .replace(/{{PRODUCT_PRICE}}/g, priceHtml)
            .replace(/{{PRODUCT_OLD_PRICE}}/g, oldPriceHtml)
            .replace(/{{PRODUCT_CATEGORY}}/g, product.category)
            .replace(/{{PRODUCT_ID}}/g, product.id)
            .replace(/{{PRODUCT_SLUG}}/g, safeSlug)
            .replace(/{{PRODUCT_REGION_BADGE}}/g, regionBadge)
            .replace(/{{PRODUCT_GENRES}}/g, genresTags)
            .replace(/{{PRODUCT_AGE_RATING}}/g, ratingHtml)
            .replace(/{{PRODUCT_IN_STOCK}}/g, stockStatus)
            .replace(/{{SCHEMA_JSON}}/g, schemaJson)
            .replace(/{{{PRODUCT_JSON}}}/g, JSON.stringify(product))
            .replace(/{{{REQUIRES_AGE_GATE}}}/g, requiresAgeGate ? 'true' : 'false');
            
        res.send(html);
    } catch(e) {
        console.error("Erro ao carregar produto:", e);
        res.status(500).send('Erro no servidor.');
    }
});

// Dynamic robots.txt
app.get('/robots.txt', (req, res) => {
    const host = req.get('host');
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const domain = protocol + '://' + host;

    res.type('text/plain');
    res.send(`User-agent: *
Allow: /
Allow: /api/products
Disallow: /admin.html
Disallow: /account.html
Disallow: /api/

Sitemap: ${domain}/sitemap.xml`);
});

// Dynamic ads.txt for Google AdSense compliance
app.get('/ads.txt', (req, res) => {
    res.type('text/plain');
    res.send('google.com, pub-3654713194554139, DIRECT, f08c47fec0942fa0');
});

// Clean URLs for Google Merchant Center compliance (English and Portuguese translations)
app.get(['/privacy-policy', '/politica-de-privacidade'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'politica-de-privacidade.html'));
});
app.get(['/shipping-policy', '/politica-de-entrega'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'politica-de-entrega.html'));
});
app.get(['/refund-policy', '/politica-de-devolucao', '/politica-de-reembolso'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'politica-de-devolucao.html'));
});
app.get(['/terms-of-service', '/termos-de-servico', '/termos'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'termos-de-servico.html'));
});
app.get('/sobre-nos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sobre-nos.html'));
});
app.get(['/contact', '/contato', '/fale-conosco'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Dynamic sitemap.xml
app.get('/sitemap.xml', async (req, res) => {
    try {
        const host = req.get('host');
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const domain = protocol + '://' + host;

        const result = await pool.query('SELECT id, title FROM products');
        const products = result.rows;
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${domain}/</loc>
        <priority>1.00</priority>
    </url>
    <url>
        <loc>${domain}/carrinho.html</loc>
        <priority>0.80</priority>
    </url>
    <url>
        <loc>${domain}/minigames.html</loc>
        <priority>0.80</priority>
    </url>
    <url>
        <loc>${domain}/pokemon.html</loc>
        <priority>0.50</priority>
    </url>
    <url>
        <loc>${domain}/refund-policy</loc>
        <priority>0.70</priority>
    </url>
    <url>
        <loc>${domain}/terms-of-service</loc>
        <priority>0.70</priority>
    </url>
    <url>
        <loc>${domain}/privacy-policy</loc>
        <priority>0.70</priority>
    </url>
    <url>
        <loc>${domain}/contact</loc>
        <priority>0.70</priority>
    </url>
\n`;

        products.forEach(p => {
            const slug = (p.title || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // remove acentos
                .replace(/[^a-z0-9]+/g, '-')     // substitui caracteres especiais por hifens
                .replace(/(^-|-$)+/g, '');       // remove hifens no inicio/fim
            const safeSlug = slug || 'produto';

            xml += `    <url>
        <loc>${domain}/produto/${p.id}-${safeSlug}</loc>
        <priority>0.90</priority>
    </url>\n`;
        });

        xml += `</urlset>`;
        
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch(e) {
        console.error("Erro ao gerar sitemap:", e);
        res.status(500).send('Erro ao gerar sitemap.');
    }
});

// Dynamic Google Shopping XML Feed (Google Merchant Center Integration)
app.get(['/google-shopping.xml', '/feed.xml', '/rss.xml', '/merchant.xml'], async (req, res) => {
    try {
        const host = req.get('host');
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const domain = protocol + '://' + host;

        const result = await pool.query('SELECT id, title, description, price, image, category, in_stock FROM products');
        const products = result.rows;
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
    <channel>
        <title>Zher Keys</title>
        <link>${domain}</link>
        <description>Gaming &amp; Keys Premium Marketplace</description>\n`;

        products.forEach(p => {
            const titleStr = p.title || 'Produto Zher Keys';
            const descStr = p.description || 'Chave de ativacao de jogo premium na Zher Keys.';
            const imageStr = p.image || '/logo.png';
            
            const slug = titleStr
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
            const safeSlug = slug || 'produto';
            
            // Clean XML special characters and remove asterisks and HTML tags
            const titleClean = titleStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
            const descStripped = descStr.replace(/<[^>]*>/g, '').replace(/\*/g, '');
            const descClean = descStripped.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').substring(0, 1000);
            
            let imageLink = imageStr;
            if (imageLink.startsWith('data:image/')) {
                imageLink = '/logo.png';
            }
            if (!imageLink.startsWith('http')) {
                if (!imageLink.startsWith('/')) {
                    imageLink = '/' + imageLink;
                }
                imageLink = `${domain}${imageLink}`;
            }
            
            const availability = p.in_stock ? 'in stock' : 'out of stock';
            const priceVal = parseFloat(p.price || 0);
            const priceFormatted = `${priceVal.toFixed(2)} BRL`;

            xml += `        <item>
            <g:id>${p.id}</g:id>
            <g:title>${titleClean}</g:title>
            <g:description>${descClean}</g:description>
            <g:link>${domain}/produto/${p.id}-${safeSlug}</g:link>
            <g:image_link>${imageLink}</g:image_link>
            <g:condition>new</g:condition>
            <g:availability>${availability}</g:availability>
            <g:price>${priceFormatted}</g:price>
            <g:brand>Zher Keys</g:brand>
            <g:mpn>ZHER-${p.id}</g:mpn>
            <g:google_product_category>5057</g:google_product_category>
            <g:identifier_exists>no</g:identifier_exists>
            <g:shipping>
                <g:country>BR</g:country>
                <g:service>Entrega Digital</g:service>
                <g:price>0.00 BRL</g:price>
            </g:shipping>
        </item>\n`;
        });

        xml += `    </channel>
</rss>`;

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch(e) {
        console.error("Erro ao gerar Google Shopping Feed:", e);
        res.status(500).send('Erro ao gerar Google Shopping Feed.');
    }
});



app.use(express.static(path.join(__dirname, 'public')));

// Retorna a chave do site anti-robô para o front-end (configurável no .env)
app.get('/api/config/turnstile', (req, res) => {
    res.json({ sitekey: process.env.CLOUDFLARE_TURNSTILE_SITEKEY || '1x00000000000000000000AA' });
});

app.post('/register', async (req, res) => {
    const { email, password, turnstileToken } = req.body;
    
    if(!email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

    // Validar Cloudflare Turnstile anti-robô
    const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
    if (!isLocal) {
        const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRETKEY || '1x0000000000000000000000000000000AA';
        if (!turnstileToken) {
            return res.status(400).json({ error: 'Validação anti-robô ausente.' });
        }

        try {
            const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: secretKey,
                    response: turnstileToken,
                    remoteip: req.ip
                })
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
                return res.status(400).json({ error: 'Falha na validação anti-robô. Você é um robô?' });
            }
        } catch(err) {
            console.error("Erro na verificação do Turnstile:", err);
            return res.status(500).json({ error: 'Erro ao validar anti-robô no servidor.' });
        }
    }

    try {
        const checkUser = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: 'E-mail já cadastrado.' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const token = crypto.randomBytes(20).toString('hex');
        
        await pool.query(
            'INSERT INTO users (email, password_hash, verification_token) VALUES ($1, $2, $3)', 
            [email, hash, token]
        );
            
        const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
        
        await sendEmailViaBrevo(
            email,
            'Verifique seu e-mail na ZHER KEYS',
            `Por favor, clique no link para verificar seu e-mail: ${verifyUrl}`,
            `<div style="background:#020617;color:white;padding:20px;font-family:sans-serif;text-align:center;">
                <h2>ZHER KEYS SECURE SYSTEM</h2>
                <p>Confirme sua credencial de acesso clicando no link abaixo:</p>
                <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;">VERIFICAR ACESSO</a>
               </div>`
        );
        
        res.status(200).json({ message: 'verify your email, confery your spam too' });
        
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password, turnstileToken } = req.body;
    
    if(!email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

    // Validar Cloudflare Turnstile anti-robô
    const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
    if (!isLocal) {
        const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRETKEY || '1x0000000000000000000000000000000AA';
        if (!turnstileToken) {
            return res.status(400).json({ error: 'Validação anti-robô ausente.' });
        }

        try {
            const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: secretKey,
                    response: turnstileToken,
                    remoteip: req.ip
                })
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
                return res.status(400).json({ error: 'Falha na validação anti-robô. Você é um robô?' });
            }
        } catch(err) {
            console.error("Erro na verificação do Turnstile no login:", err);
            return res.status(500).json({ error: 'Erro ao validar anti-robô no servidor.' });
        }
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'Credenciais inválidas.' });
        
        const user = result.rows[0];
        
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: 'Credenciais inválidas.' });
        
        if (user.is_verified === 0) return res.status(400).json({ error: 'Sua conta não está ativada. Verifique o e-mail.' });
        
        req.session.userId = user.id;
        
        if (user.email === 'zherkeys@gmail.com') {
            res.status(200).json({ message: 'Acesso de Admin concedido.', redirect: '/admin.html' });
        } else {
            res.status(200).json({ message: 'Acesso concedido.', redirect: '/' });
        }
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

app.post('/resend-verification', async (req, res) => {
    const { email } = req.body;
    if(!email) return res.status(400).json({ error: 'Informe o e-mail.' });

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'Usuário não encontrado.' });
        
        const user = result.rows[0];
        if (user.is_verified === 1) return res.status(400).json({ error: 'Esta conta já está verificada.' });
        
        const token = crypto.randomBytes(20).toString('hex');
        await pool.query('UPDATE users SET verification_token = $1 WHERE email = $2', [token, email]);
            
        const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
        
        await sendEmailViaBrevo(
            email,
            'Reenvio: Verifique seu e-mail na ZHER KEYS',
            `Por favor, clique no link para verificar seu e-mail: ${verifyUrl}`,
            `<div style="background:#020617;color:white;padding:20px;font-family:sans-serif;text-align:center;">
                <h2>ZHER KEYS SECURE SYSTEM</h2>
                <p>Confirme sua credencial de acesso clicando no link abaixo:</p>
                <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;">VERIFICAR ACESSO</a>
               </div>`
        );
        
        res.status(200).json({ message: 'E-mail de verificação reenviado com sucesso!' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no banco de dados.' });
    }
});

app.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    try {
        const result = await pool.query('UPDATE users SET is_verified = 1 WHERE verification_token = $1', [token]);
        if (result.rowCount === 0) return res.status(400).send('<h1>Token inválido ou já verificado.</h1>');
        
        res.send(`
            <body style="background:#020617;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center;background:#0f172a;padding:40px;border-radius:10px;border:1px solid #3B82F6;box-shadow:0 0 20px rgba(59,130,246,0.3);">
                    <h1 style="color:#3B82F6;">ACESSO VERIFICADO</h1>
                    <p>Sua credencial foi ativada com sucesso.</p>
                    <a href="/login.html" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#F43F5E;color:white;text-decoration:none;border-radius:5px;font-weight:bold;">IR PARA O TERMINAL DE LOGIN</a>
                </div>
            </body>
        `);
    } catch(err) {
        console.error(err);
        res.status(500).send('Erro interno.');
    }
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if(!email) return res.status(400).json({ error: 'Informe o e-mail.' });
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'Usuário não encontrado.' });
        
        const user = result.rows[0];
        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; // 1 hora
        
        await pool.query('UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3', [token, expires, user.id]);
            
        const resetUrl = `${APP_URL}/reset-password.html?token=${token}`;
        
        await sendEmailViaBrevo(
            email,
            'Redefinição de Senha - ZHER KEYS',
            `Você solicitou a troca da sua senha. Acesse: ${resetUrl}`,
            `<div style="background:#020617;color:white;padding:20px;font-family:sans-serif;text-align:center;">
                <h2>REDEFINIÇÃO DE CREDENCIAL</h2>
                <p>Você solicitou a troca da sua senha.</p>
                <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#F43F5E;color:white;text-decoration:none;border-radius:5px;">CRIAR NOVA SENHA</a>
               </div>`
        );
        
        res.status(200).json({ message: 'E-mail de redefinição enviado! Verifique sua caixa de entrada.' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no banco.' });
    }
});

app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if(!token || !newPassword) return res.status(400).json({ error: 'Dados incompletos.' });
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_expires > $2', [token, Date.now()]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'Token inválido ou expirado.' });
        
        const user = result.rows[0];
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        
        await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2', [hash, user.id]);
        
        res.status(200).json({ message: 'Senha alterada com sucesso! Faça login.' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no banco.' });
    }
});

// ==========================================
// SEÇÃO DE SUPORTE - SISTEMA DE TICKETS
// ==========================================

// Obter todos os tickets do usuário logado
app.get('/api/support/tickets', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM support_tickets WHERE user_id=$1 ORDER BY status = \'open\' DESC, updated_at DESC', [req.session.userId]);
        res.json(result.rows);
    } catch(e) {
        console.error("Erro ao buscar tickets:", e);
        res.status(500).json({ error: 'Erro ao buscar tickets.' });
    }
});

// Obter detalhes de um ticket (e mensagens)
app.get('/api/support/tickets/:id', requireAuth, async (req, res) => {
    const ticketId = parseInt(req.params.id);
    try {
        const ticketRes = await pool.query('SELECT * FROM support_tickets WHERE id=$1 AND user_id=$2', [ticketId, req.session.userId]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        const messagesRes = await pool.query('SELECT * FROM support_ticket_messages WHERE ticket_id=$1 ORDER BY id ASC', [ticketId]);
        res.json({ ticket: ticketRes.rows[0], messages: messagesRes.rows });
    } catch(e) {
        console.error("Erro ao buscar detalhes do ticket:", e);
        res.status(500).json({ error: 'Erro ao buscar detalhes do ticket.' });
    }
});

// Criar um novo ticket (User)
app.post('/api/support/tickets', requireAuth, async (req, res) => {
    const { category, description } = req.body;
    if (!category || !description) {
        return res.status(400).json({ error: 'Categoria e descrição do problema são obrigatórias.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO support_tickets (user_id, category, description, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.session.userId, category, description, 'open']
        );
        const ticket = result.rows[0];
        
        // Insere a descrição como a primeira mensagem
        await pool.query(
            'INSERT INTO support_ticket_messages (ticket_id, sender_type, message) VALUES ($1, $2, $3)',
            [ticket.id, 'user', description]
        );
        
        res.status(201).json(ticket);
    } catch(e) {
        console.error("Erro ao abrir ticket:", e);
        res.status(500).json({ error: 'Erro ao abrir ticket.' });
    }
});

// Enviar mensagem em um ticket (User)
app.post('/api/support/tickets/:id/messages', requireAuth, async (req, res) => {
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensagem vazia.' });
    try {
        const ticketRes = await pool.query('SELECT status FROM support_tickets WHERE id=$1 AND user_id=$2', [ticketId, req.session.userId]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        if (ticketRes.rows[0].status === 'closed') {
            return res.status(400).json({ error: 'Este ticket já foi concluído/resolvido.' });
        }
        
        await pool.query('INSERT INTO support_ticket_messages (ticket_id, sender_type, message) VALUES ($1, $2, $3)', [ticketId, 'user', message]);
        await pool.query('UPDATE support_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=$1', [ticketId]);
        res.status(201).json({ success: true });
    } catch(e) {
        console.error("Erro ao enviar mensagem no ticket:", e);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
});

// Marcar ticket como Resolvido/Concluído (User)
app.post('/api/support/tickets/:id/resolve', requireAuth, async (req, res) => {
    const ticketId = parseInt(req.params.id);
    try {
        const ticketRes = await pool.query('SELECT id FROM support_tickets WHERE id=$1 AND user_id=$2', [ticketId, req.session.userId]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        await pool.query("UPDATE support_tickets SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [ticketId]);
        res.json({ success: true, message: 'Ticket marcado como resolvido.' });
    } catch(e) {
        console.error("Erro ao resolver ticket:", e);
        res.status(500).json({ error: 'Erro ao marcar ticket como resolvido.' });
    }
});

// ADMIN: Obter todos os tickets do sistema
app.get('/api/admin/support/tickets', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, u.email 
            FROM support_tickets t 
            JOIN users u ON u.id = t.user_id 
            ORDER BY t.status = 'open' DESC, t.updated_at DESC
        `);
        res.json(result.rows);
    } catch(e) {
        console.error("Erro ao buscar todos os tickets:", e);
        res.status(500).json({ error: 'Erro ao buscar tickets.' });
    }
});

// ADMIN: Obter detalhes e mensagens de um ticket específico
app.get('/api/admin/support/tickets/:id', requireAdmin, async (req, res) => {
    const ticketId = parseInt(req.params.id);
    try {
        const ticketRes = await pool.query(`
            SELECT t.*, u.email 
            FROM support_tickets t 
            JOIN users u ON u.id = t.user_id 
            WHERE t.id = $1
        `, [ticketId]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        const messagesRes = await pool.query('SELECT * FROM support_ticket_messages WHERE ticket_id=$1 ORDER BY id ASC', [ticketId]);
        res.json({ ticket: ticketRes.rows[0], messages: messagesRes.rows });
    } catch(e) {
        console.error("Erro ao buscar detalhes do ticket:", e);
        res.status(500).json({ error: 'Erro ao buscar ticket.' });
    }
});

// ADMIN: Enviar resposta em um ticket
app.post('/api/admin/support/tickets/:id/messages', requireAdmin, async (req, res) => {
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensagem vazia.' });
    try {
        const ticketRes = await pool.query('SELECT user_id, status FROM support_tickets WHERE id=$1', [ticketId]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        if (ticketRes.rows[0].status === 'closed') {
            return res.status(400).json({ error: 'Este ticket já está fechado/concluído.' });
        }
        
        const userId = ticketRes.rows[0].user_id;
        await pool.query('INSERT INTO support_ticket_messages (ticket_id, sender_type, message) VALUES ($1, $2, $3)', [ticketId, 'admin', message]);
        await pool.query('UPDATE support_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=$1', [ticketId]);
        
        // Envia notificação ao usuário
        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
            [userId, 'Nova Resposta de Suporte', 'Seu ticket de suporte recebeu uma resposta da nossa equipe.', 'chat']
        );
        
        res.status(201).json({ success: true });
    } catch(e) {
        console.error("Erro ao responder ticket:", e);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
});

// ADMIN: Fechar/Concluir um ticket
app.post('/api/admin/support/tickets/:id/close', requireAdmin, async (req, res) => {
    const ticketId = parseInt(req.params.id);
    try {
        const ticketRes = await pool.query('SELECT user_id FROM support_tickets WHERE id=$1', [ticketId]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket não encontrado.' });
        }
        await pool.query("UPDATE support_tickets SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [ticketId]);
        
        // Notificação
        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
            [ticketRes.rows[0].user_id, 'Ticket Concluído', 'Seu ticket de suporte foi marcado como concluído/resolvido pelo suporte.', 'chat']
        );
        
        res.json({ success: true, message: 'Ticket fechado com sucesso.' });
    } catch(e) {
        console.error("Erro ao fechar ticket:", e);
        res.status(500).json({ error: 'Erro ao fechar ticket.' });
    }
});

// ========================
// NOTIFICAÇÕES ENDPOINTS
// ========================

// Buscar notificações do usuário
app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 30',
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (e) {
        console.error("[NOTIFICATIONS] Erro ao buscar:", e);
        res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
});

// Buscar quantidade de não lidas
app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
            [req.session.userId]
        );
        res.json({ unread_count: parseInt(result.rows[0].count) });
    } catch (e) {
        res.status(500).json({ error: 'Erro' });
    }
});

// Marcar como lida(s)
app.post('/api/notifications/read', requireAuth, async (req, res) => {
    const { id } = req.body;
    try {
        if (id) {
            await pool.query(
                'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
                [parseInt(id), req.session.userId]
            );
        } else {
            await pool.query(
                'UPDATE notifications SET is_read = true WHERE user_id = $1',
                [req.session.userId]
            );
        }
        res.json({ success: true });
    } catch (e) {
        console.error("[NOTIFICATIONS] Erro ao marcar como lida:", e);
        res.status(500).json({ error: 'Erro ao marcar como lida' });
    }
});

app.get('/api/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT email, balance, points, game_nickname FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0) {
            res.json({ 
                email: result.rows[0].email, 
                balance: parseFloat(result.rows[0].balance || 0),
                points: parseInt(result.rows[0].points || 0),
                game_nickname: result.rows[0].game_nickname,
                isAdmin: result.rows[0].email === 'zherkeys@gmail.com' 
            });
        } else {
            res.status(401).json({ error: 'Não autorizado' });
        }
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no banco' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html?logout=1');
});

// ==========================================
// AUTENTICAÇÃO SOCIAL (GOOGLE, FACEBOOK, STEAM)
// ==========================================

// --- GOOGLE AUTHENTICATION ---
app.get('/auth/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.send(`
            <script>
                alert("A integração de login com o Google não está configurada no servidor. Por favor, configure as chaves GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no seu arquivo .env.");
                window.location.href = "/login.html";
            </script>
        `);
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const redirectUri = process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : `${protocol}://${host}/auth/google/callback`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile`;
    res.redirect(googleAuthUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/login.html');

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const redirectUri = process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : `${protocol}://${host}/auth/google/callback`;

    try {
        // Trocar o código de autorização por Access Token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            const errDetail = tokenData.error_description || tokenData.error || "Não foi possível obter o token de acesso do Google.";
            throw new Error(errDetail);
        }

        // Buscar dados do perfil do usuário
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();
        const { sub: googleId, email, picture: avatar } = userData;

        if (!email) throw new Error("Nenhum e-mail retornado pelo Google.");

        // Buscar ou criar usuário no banco
        let userResult = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
        let user = userResult.rows[0];

        if (!user) {
            // Tentar buscar pelo e-mail se já existia cadastro manual
            userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            user = userResult.rows[0];

            if (user) {
                // Vincular e pré-verificar a conta existente
                await pool.query('UPDATE users SET google_id = $1, avatar = $2, is_verified = 1 WHERE id = $3', [googleId, avatar, user.id]);
            } else {
                // Criar nova conta
                const randomPassword = crypto.randomBytes(32).toString('hex');
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(randomPassword, salt);
                
                const insertResult = await pool.query(
                    'INSERT INTO users (email, password_hash, is_verified, google_id, avatar) VALUES ($1, $2, 1, $3, $4) RETURNING *',
                    [email, hash, googleId, avatar]
                );
                user = insertResult.rows[0];
            }
        } else {
            // Atualizar avatar
            await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, user.id]);
        }

        req.session.userId = user.id;
        res.redirect('/');
    } catch(err) {
        console.error("Erro na autenticação Google:", err);
        res.send(`<script>alert("Erro ao entrar com o Google: ${err.message}"); window.location.href = "/login.html";</script>`);
    }
});

// --- FACEBOOK AUTHENTICATION ---
app.get('/auth/facebook', (req, res) => {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
        return res.send(`
            <script>
                alert("A integração de login com o Facebook não está configurada no servidor. Por favor, configure as chaves FACEBOOK_APP_ID e FACEBOOK_APP_SECRET no seu arquivo .env.");
                window.location.href = "/login.html";
            </script>
        `);
    }
    const redirectUri = `${APP_URL}/auth/facebook/callback`;
    const facebookAuthUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email`;
    res.redirect(facebookAuthUrl);
});

app.get('/auth/facebook/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/login.html');

    const redirectUri = `${APP_URL}/auth/facebook/callback`;

    try {
        // Trocar o código de autorização por Access Token
        const tokenRes = await fetch(`https://graph.facebook.com/v12.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`);
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) throw new Error("Não foi possível obter o token de acesso do Facebook.");

        // Buscar dados do perfil do usuário
        const userRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`);
        const userData = await userRes.json();
        const { id: facebookId, email } = userData;
        const avatar = userData.picture?.data?.url || '';

        // Contas de telefone do Facebook não retornam email
        const userEmail = email || `${facebookId}@facebook.zherkeys.com`;

        // Buscar ou criar usuário no banco
        let userResult = await pool.query('SELECT * FROM users WHERE facebook_id = $1', [facebookId]);
        let user = userResult.rows[0];

        if (!user) {
            userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);
            user = userResult.rows[0];

            if (user) {
                // Vincular e pré-verificar a conta existente
                await pool.query('UPDATE users SET facebook_id = $1, avatar = $2, is_verified = 1 WHERE id = $3', [facebookId, avatar, user.id]);
            } else {
                // Criar nova conta
                const randomPassword = crypto.randomBytes(32).toString('hex');
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(randomPassword, salt);
                
                const insertResult = await pool.query(
                    'INSERT INTO users (email, password_hash, is_verified, facebook_id, avatar) VALUES ($1, $2, 1, $3, $4) RETURNING *',
                    [userEmail, hash, facebookId, avatar]
                );
                user = insertResult.rows[0];
            }
        } else {
            // Atualizar avatar
            await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, user.id]);
        }

        req.session.userId = user.id;
        res.redirect('/');
    } catch(err) {
        console.error("Erro na autenticação Facebook:", err);
        res.send(`<script>alert("Erro ao entrar com o Facebook: ${err.message}"); window.location.href = "/login.html";</script>`);
    }
});

// --- STEAM AUTHENTICATION (OpenID 2.0) ---
app.get('/auth/steam', (req, res) => {
    const redirectUri = `${APP_URL}/auth/steam/callback`;
    const steamAuthUrl = 'https://steamcommunity.com/openid/login' +
        '?openid.ns=http://specs.openid.net/auth/2.0' +
        '&openid.mode=checkid_setup' +
        '&openid.return_to=' + encodeURIComponent(redirectUri) +
        '&openid.realm=' + encodeURIComponent(APP_URL) +
        '&openid.identity=http://specs.openid.net/auth/2.0/identifier_select' +
        '&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select';
    res.redirect(steamAuthUrl);
});

app.get('/auth/steam/callback', async (req, res) => {
    const params = req.query;
    const verifyParams = { ...params, 'openid.mode': 'check_authentication' };
    
    try {
        // Enviar os parâmetros de volta para o Steam para verificar a autenticidade (anti-fraude)
        const verifyBody = new URLSearchParams(verifyParams).toString();
        const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: verifyBody
        });
        const verifyText = await verifyRes.text();
        const isValid = verifyText.includes('is_valid:true');
        
        if (!isValid) throw new Error("A autenticação fornecida pela Steam falhou.");

        // Extrair o SteamID de 64 bits da URL de identidade
        const steamIdUrl = params['openid.claimed_id'] || params['openid.identity'] || '';
        const steamId = steamIdUrl.split('/id/')[1];
        if (!steamId) throw new Error("Não foi possível obter o seu ID Steam.");

        // Obter dados públicos do perfil da Steam usando a API Key se fornecida
        let avatar = '';
        if (process.env.STEAM_API_KEY) {
            try {
                const steamProfileRes = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`);
                const steamProfileData = await steamProfileRes.json();
                const player = steamProfileData.response?.players?.[0];
                if (player) {
                    avatar = player.avatarfull || player.avatarmedium || '';
                }
            } catch(e) {
                console.error("Erro ao obter avatar da API da Steam:", e);
            }
        }

        const steamEmail = `${steamId}@steam.zherkeys.com`;

        // Buscar ou criar usuário no banco pelo Steam ID
        let userResult = await pool.query('SELECT * FROM users WHERE steam_id = $1', [steamId]);
        let user = userResult.rows[0];

        if (!user) {
            // Steam não fornece e-mail no OpenID, criamos uma credencial Steam exclusiva no sistema
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(randomPassword, salt);
            
            const insertResult = await pool.query(
                'INSERT INTO users (email, password_hash, is_verified, steam_id, avatar) VALUES ($1, $2, 1, $3, $4) RETURNING *',
                [steamEmail, hash, steamId, avatar]
            );
            user = insertResult.rows[0];
        } else if (avatar) {
            // Atualizar avatar
            await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, user.id]);
        }

        req.session.userId = user.id;
        res.redirect('/');
    } catch(err) {
        console.error("Erro na autenticação Steam:", err);
        res.send(`<script>alert("Erro ao entrar com a Steam: ${err.message}"); window.location.href = "/login.html";</script>`);
    }
});

// ========================
// GAMEFLIP INTEGRATION & SYNC
// ========================

// Função para gerar cabeçalhos de autenticação do Gameflip
async function getGameflipHeaders() {
    const token = speakeasy.totp({
        secret: process.env.GAMEFLIP_TOTP_SECRET || '',
        encoding: 'base32'
    });
    return {
        'Authorization': `GFAPI ${process.env.GAMEFLIP_API_KEY || ''}:${token}`,
        'Content-Type': 'application/json'
    };
}

// Delistar anúncio no Gameflip (mudar para draft / fora de estoque)
async function markGameflipListingAsSold(listingId) {
    if (!process.env.GAMEFLIP_API_KEY || !process.env.GAMEFLIP_TOTP_SECRET) {
        return console.warn("[GAMEFLIP] Credenciais do Gameflip não configuradas nas variáveis de ambiente. Pulando delisting.");
    }
    try {
        const headers = await getGameflipHeaders();
        const res = await fetch(`https://api.gameflip.com/api/v1/listing/${listingId}`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify([
                {
                    op: 'replace',
                    path: '/status',
                    value: 'draft'
                }
            ])
        });
        if (!res.ok) {
            const errText = await res.text();
            console.error(`[GAMEFLIP] Erro ao delistar anúncio ${listingId}:`, errText);
        } else {
            console.log(`[GAMEFLIP] Anúncio ${listingId} delistado com sucesso no Gameflip (status=draft).`);
        }
    } catch (err) {
        console.error(`[GAMEFLIP] Erro de rede ao delistar anúncio:`, err);
    }
}

// Sincronização em segundo plano: Consultar anúncios locais e verificar se foram vendidos no Gameflip
async function pollGameflipInventory() {
    if (!process.env.GAMEFLIP_API_KEY || !process.env.GAMEFLIP_TOTP_SECRET) {
        return; // Silenciosamente ignora se as credenciais do Gameflip não estiverem no .env
    }
    try {
        // Busca produtos locais ativos que têm ID do Gameflip associado
        const res = await pool.query("SELECT id, gameflip_listing_id, title FROM products WHERE in_stock = true AND gameflip_listing_id IS NOT NULL AND gameflip_listing_id != ''");
        const activeProducts = res.rows;
        
        if (activeProducts.length === 0) return;
        
        const headers = await getGameflipHeaders();
        
        for (let prod of activeProducts) {
            try {
                const gfRes = await fetch(`https://api.gameflip.com/api/v1/listing/${prod.gameflip_listing_id}`, {
                    method: 'GET',
                    headers: headers
                });
                if (gfRes.ok) {
                    const data = await gfRes.json();
                    // Se o anúncio foi vendido no Gameflip (status 'sold'), esgotamos o produto localmente!
                    if (data && data.status === 'sold') {
                        await pool.query("UPDATE products SET in_stock = false WHERE id = $1", [prod.id]);
                        console.log(`[GAMEFLIP-POLL] O anúncio do jogo "${prod.title}" foi vendido no Gameflip! Esgotado localmente na Zher Keys.`);
                    }
                } else if (gfRes.status === 404) {
                    // Se o anúncio foi excluído no Gameflip, também consideramos esgotado no local
                    await pool.query("UPDATE products SET in_stock = false WHERE id = $1", [prod.id]);
                    console.log(`[GAMEFLIP-POLL] O anúncio "${prod.gameflip_listing_id}" do produto "${prod.title}" não foi encontrado no Gameflip. Marcado como esgotado localmente.`);
                }
            } catch (err) {
                console.error(`[GAMEFLIP-POLL] Erro ao consultar anúncio ${prod.gameflip_listing_id}:`, err);
            }
        }
    } catch (e) {
        console.error("[GAMEFLIP-POLL] Erro geral na sincronização de estoque com o Gameflip:", e);
    }
}

// Iniciar varredura de sincronização de estoque a cada 2 minutos
setInterval(pollGameflipInventory, 2 * 60 * 1000);

// ========================
// CARTEIRA E CRÉDITOS ENDPOINTS
// ========================

// Buscar histórico de transações da carteira do usuário
app.get('/api/wallet/transactions', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY id DESC', [req.session.userId]);
        res.json(result.rows);
    } catch(e) {
        console.error("[WALLET-TRANSACTIONS] Erro ao buscar extrato:", e);
        res.status(500).json({ error: 'Erro ao buscar extrato' });
    }
});

// ========================
// PLAY-TO-EARN MINIGAMES ENDPOINTS (POINTS SYSTEM - Z-POINTS)
// ========================

// Buscar total convertido com minigames hoje pelo usuário (limite diário de R$ 2,00)
app.get('/api/minigames/daily-total', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const result = await pool.query(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions WHERE user_id = $1 AND type = 'minigame' AND created_at >= CURRENT_DATE",
            [userId]
        );
        const dailyTotal = parseFloat(result.rows[0].total || 0);
        res.json({ dailyTotal });
    } catch(err) {
        console.error("[MINIGAMES-DAILY] Erro ao buscar total diário:", err);
        res.status(500).json({ error: 'Erro ao processar limite diário.' });
    }
});

// Reivindicar recompensa em pontos do Minigame (auto-sustentável baseada em anúncios)
app.post('/api/minigames/claim', requireAuth, async (req, res) => {
    const { points, adMultiplier } = req.body;
    
    const scorePoints = parseInt(points);
    if (isNaN(scorePoints) || scorePoints < 0) {
        return res.status(400).json({ error: 'Pontuação inválida.' });
    }
    
    const multiplier = parseInt(adMultiplier);
    if (isNaN(multiplier) || (multiplier !== 1 && multiplier !== 2)) {
        return res.status(400).json({ error: 'Operação não permitida. Para manter o auto-sustento do site, nenhum recebimento de moedas é grátis. Você precisa assistir a pelo menos 1 anúncio para receber!' });
    }
    
    // Cálculo ultra-fracionado baseado no CPM de $ 0.10 USD (1 Z-Point = R$ 0.000001 BRL)
    // Recompensa de anúncios reduzida de 5x para 2x como solicitado pelo administrador:
    // 1x Normal (1 anúncio): fator de 0.5 pontos por score
    // 2x Multi-Boost (2 anúncios): fator de 1.0 pontos por score (dobro da recompensa normal)
    const factor = multiplier === 2 ? 1.0 : 0.5;
    let rewardPoints = Math.round(scorePoints * factor);
    
    // Segurança contra exploits/bots: limitar recompensa máxima por partida a 1500 pontos
    if (rewardPoints > 1500) {
        rewardPoints = 1500;
    }
    
    if (rewardPoints <= 0) {
        return res.json({ success: true, rewardPoints: 0, newPoints: 0, message: 'Pontuação muito baixa para gerar pontos.' });
    }
    
    const userId = req.session.userId;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Verificar limite diário acumulado em dinheiro real convertido hoje (equivalente a 2.000.000 pontos = R$ 2,00)
        const dailyRes = await client.query(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions WHERE user_id = $1 AND type = 'minigame' AND created_at >= CURRENT_DATE",
            [userId]
        );
        const dailyTotal = parseFloat(dailyRes.rows[0].total || 0);
        
        if (dailyTotal >= 2.00) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Você já atingiu o limite máximo de resgate diário na carteira (R$ 2,00) hoje!' });
        }
        
        // 2. Incrementar a coluna 'points' do usuário
        const userRes = await client.query('SELECT points, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const currentPoints = parseInt(userRes.rows[0].points || 0);
        const newPoints = currentPoints + rewardPoints;
        const balance = parseFloat(userRes.rows[0].balance || 0);
        
        await client.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);
        await client.query("INSERT INTO points_earnings (user_id, amount) VALUES ($1, $2)", [userId, rewardPoints]);
        await client.query('COMMIT');
        
        res.json({
            success: true,
            rewardPoints,
            newPoints,
            newBalance: balance,
            dailyTotal
        });
        
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("[MINIGAMES-CLAIM] Erro ao reivindicar pontos:", err);
        res.status(500).json({ error: 'Erro interno ao processar os pontos.' });
    } finally {
        client.release();
    }
});

// Assistir anúncio rápido e ganhar 250 pontos fixos (Smartlink Direct Ad)
app.post('/api/minigames/watch-ad-points', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const userRes = await client.query('SELECT points, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const rewardPoints = 250;
        const currentPoints = parseInt(userRes.rows[0].points || 0);
        const newPoints = currentPoints + rewardPoints;
        const balance = parseFloat(userRes.rows[0].balance || 0);
        
        await client.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);
        await client.query("INSERT INTO points_earnings (user_id, amount) VALUES ($1, $2)", [userId, rewardPoints]);
        await client.query('COMMIT');
        
        res.json({
            success: true,
            rewardPoints,
            newPoints,
            newBalance: balance
        });
        
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("[MINIGAMES-AD-POINTS] Erro ao creditar pontos por anúncio:", err);
        res.status(500).json({ error: 'Erro interno ao processar seus pontos.' });
    } finally {
        client.release();
    }
});

// Converter pontos do Minigame em Saldo real de Carteira (100.000 pontos = R$ 0,01 BRL)
app.post('/api/minigames/convert-points', requireAuth, async (req, res) => {
    const { pointsToConvert } = req.body;
    const pointsNum = parseInt(pointsToConvert);
    
    if (isNaN(pointsNum) || pointsNum < 100000 || pointsNum % 100000 !== 0) {
        return res.status(400).json({ error: 'Por favor, insira uma quantidade de pontos válida (mínimo de 100.000 pontos e em múltiplos de 100.000).' });
    }
    
    const userId = req.session.userId;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const userRes = await client.query('SELECT points, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const currentPoints = parseInt(userRes.rows[0].points || 0);
        if (currentPoints < pointsNum) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Pontos insuficientes para realizar a conversão.' });
        }
        
        // Conversão: 100.000 pontos = R$ 0,01 BRL (10.000.000 pontos = R$ 1,00 BRL)
        const convertedBRL = parseFloat((pointsNum / 10000000).toFixed(2));
        if (convertedBRL <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Quantidade de pontos muito baixa para gerar saldo em reais.' });
        }
        
        // Limite diário de ganhos convertidos em reais de minigames (R$ 2,00)
        const dailyRes = await client.query(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions WHERE user_id = $1 AND type = 'minigame' AND created_at >= CURRENT_DATE",
            [userId]
        );
        const dailyTotal = parseFloat(dailyRes.rows[0].total || 0);
        
        if (dailyTotal + convertedBRL > 2.00) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `A conversão excede seu limite diário restante de Play-to-Earn (R$ ${(2.00 - dailyTotal).toFixed(2)}).` });
        }
        
        // Realiza a conversão
        const newPoints = currentPoints - pointsNum;
        const currentBalance = parseFloat(userRes.rows[0].balance || 0);
        const newBalance = parseFloat((currentBalance + convertedBRL).toFixed(2));
        
        await client.query('UPDATE users SET points = $1, balance = $2 WHERE id = $3', [newPoints, newBalance, userId]);
        
        // Registra a transação com tipo 'minigame' para contar no limite diário
        await client.query(
            "INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)",
            [userId, convertedBRL, 'minigame', `Conversão de ${pointsNum} Z-Points do Minigame`]
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            convertedBRL,
            newPoints,
            newBalance,
            dailyTotal: parseFloat((dailyTotal + convertedBRL).toFixed(2))
        });
        
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("[MINIGAMES-CONVERT] Erro ao converter pontos:", err);
        res.status(500).json({ error: 'Erro interno ao processar sua conversão.' });
    } finally {
        client.release();
    }
});

// Deduzir pontos do usuário para cobrir taxa de entrada/jogo (Roleta, Cassino)
app.post('/api/minigames/spend-points', requireAuth, async (req, res) => {
    const { amount } = req.body;
    const spendAmount = parseInt(amount);
    
    if (isNaN(spendAmount) || spendAmount <= 0) {
        return res.status(400).json({ error: 'Quantia de pontos inválida.' });
    }
    
    const userId = req.session.userId;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const userRes = await client.query('SELECT points, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const currentPoints = parseInt(userRes.rows[0].points || 0);
        if (currentPoints < spendAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Saldo de Z-Points insuficiente para jogar.' });
        }
        
        const newPoints = currentPoints - spendAmount;
        const balance = parseFloat(userRes.rows[0].balance || 0);
        
        await client.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);
        await client.query('COMMIT');
        
        res.json({
            success: true,
            newPoints,
            newBalance: balance
        });
        
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("[MINIGAMES-SPEND] Erro ao deduzir pontos:", err);
        res.status(500).json({ error: 'Erro interno ao processar a dedução de pontos.' });
    } finally {
        client.release();
    }
});

// ========================
// CONFIGURAÇÃO DE GAMER TAG E PLACAR DE LIDERANÇA
// ========================

// Atualizar nickname do usuário logado
app.post('/api/user/nickname', requireAuth, async (req, res) => {
    const { nickname } = req.body;
    
    if (!nickname) {
        return res.status(400).json({ error: 'Por favor, insira um nome de jogo.' });
    }
    
    const cleanNickname = nickname.trim();
    if (cleanNickname.length < 3 || cleanNickname.length > 15) {
        return res.status(400).json({ error: 'O nome de jogo deve ter entre 3 e 15 caracteres.' });
    }
    
    const nickRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nickRegex.test(cleanNickname)) {
        return res.status(400).json({ error: 'O nome de jogo deve conter apenas letras, números, hífen e sublinhado.' });
    }
    
    const userId = req.session.userId;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Verifica se já existe o nickname para outro usuário
        const checkRes = await client.query(
            "SELECT 1 FROM users WHERE LOWER(game_nickname) = LOWER($1) AND id != $2",
            [cleanNickname, userId]
        );
        if (checkRes.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Este nome de jogo já está em uso por outro jogador.' });
        }
        
        // Atualiza o nickname do usuário
        await client.query(
            "UPDATE users SET game_nickname = $1 WHERE id = $2",
            [cleanNickname, userId]
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Nome de jogo atualizado com sucesso!', nickname: cleanNickname });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("[NICKNAME-UPDATE] Erro ao atualizar nome de jogo:", err);
        res.status(500).json({ error: 'Erro interno ao atualizar nome de jogo.' });
    } finally {
        client.release();
    }
});

// Buscar placar de liderança (Leaderboard)
app.get('/api/leaderboard', async (req, res) => {
    const { period } = req.query; // 'weekly', 'monthly', 'annual'
    
    let intervalStr = '7 days';
    if (period === 'monthly') {
        intervalStr = '30 days';
    } else if (period === 'annual') {
        intervalStr = '365 days';
    }
    
    try {
        const query = `
            SELECT 
                u.id, 
                COALESCE(u.game_nickname, split_part(u.email, '@', 1)) as name, 
                SUM(pe.amount) as total
            FROM points_earnings pe
            JOIN users u ON pe.user_id = u.id
            WHERE pe.created_at >= NOW() - CAST($1 AS INTERVAL)
            GROUP BY u.id, u.game_nickname, u.email
            ORDER BY total DESC
            LIMIT 10
        `;
        const result = await pool.query(query, [intervalStr]);
        
        // Se o usuário estiver logado, busca a posição dele
        let myRank = null;
        let myTotal = 0;
        if (req.session.userId) {
            const myRankQuery = `
                WITH ranked_users AS (
                    SELECT 
                        user_id, 
                        SUM(amount) as total,
                        ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC) as rank
                    FROM points_earnings
                    WHERE created_at >= NOW() - CAST($1 AS INTERVAL)
                    GROUP BY user_id
                )
                SELECT rank, total FROM ranked_users WHERE user_id = $2
            `;
            const myRankRes = await pool.query(myRankQuery, [intervalStr, req.session.userId]);
            if (myRankRes.rows.length > 0) {
                myRank = parseInt(myRankRes.rows[0].rank);
                myTotal = parseInt(myRankRes.rows[0].total);
            }
        }
        
        res.json({
            leaderboard: result.rows.map(r => ({
                name: r.name,
                total: parseInt(r.total)
            })),
            myRank,
            myTotal
        });
    } catch (err) {
        console.error("[LEADERBOARD] Erro ao carregar placar:", err);
        res.status(500).json({ error: 'Erro ao carregar o placar de jogos.' });
    }
});

// ========================
// SISTEMA DE SORTEIO SEMANAL (Z-COINS)
// ========================

// Verificar status de participação do usuário logado
app.get('/api/sweepstake/status', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const result = await pool.query(
            "SELECT 1 FROM sweepstake_participants WHERE user_id = $1",
            [userId]
        );
        res.json({ participating: result.rows.length > 0 });
    } catch (err) {
        console.error("[SWEEPSTAKE-STATUS] Erro ao buscar status:", err);
        res.status(500).json({ error: 'Erro ao processar status de participação.' });
    }
});

// Registrar participação do usuário logado
app.post('/api/sweepstake/join', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Busca o email do usuário
        const userQuery = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        const email = userQuery.rows[0].email;
        
        // Verifica se já está cadastrado
        const checkRes = await pool.query(
            "SELECT 1 FROM sweepstake_participants WHERE user_id = $1",
            [userId]
        );
        if (checkRes.rows.length > 0) {
            return res.status(400).json({ error: 'Você já está participando deste sorteio semanal.' });
        }
        
        // Insere o participante no banco de dados
        await pool.query(
            "INSERT INTO sweepstake_participants (user_id) VALUES ($1)",
            [userId]
        );
        
        // Envia email de confirmação assíncrono para não travar a resposta da requisição
        sendEmailViaBrevo(
            email,
            "🎟️ Inscrição Confirmada - Sorteio Semanal Zher Keys!",
            `Olá! Esta mensagem confirma que você completou os requisitos e está concorrendo ao sorteio semanal de 10.000.000 Z-Coins! O sorteio acontece de forma automática todo domingo às 20:00h (horário do servidor). Boa sorte!`,
            `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                <h2 style="color: #3B82F6; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">SORTEIO ZHER KEYS</h2>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Confirmação de Inscrição Oficial</p>
                
                <div style="background-color: rgba(16, 185, 129, 0.1); border: 1px solid #10B981; color: #10B981; display: inline-block; padding: 8px 16px; border-radius: 9999px; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-bottom: 25px;">
                    🎟️ PARTICIPAÇÃO CONFIRMADA
                </div>
                
                <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px; text-align: left;">
                    Olá, jogador!<br><br>
                    Esta mensagem confirma que você assistiu com sucesso aos 5 anúncios obrigatórios e agora está <strong>oficialmente concorrendo ao grande prêmio de 10.000.000 de Z-Coins</strong> deste domingo!
                </p>

                <div style="margin: 25px 0;">
                    <img src="${process.env.APP_URL || 'https://zherkeys.com'}/sorteio_zcoins.png" alt="Sorteio 10 Milhões Z-Coins" style="width: 100%; max-width: 440px; border-radius: 12px; border: 1px solid #1e293b; display: block; margin: 0 auto; box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);" />
                </div>
                
                <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                    <h4 style="color: white; margin-top: 0; margin-bottom: 10px; font-size: 14px; font-weight: bold; letter-spacing: 1px;">Detalhes do Sorteio:</h4>
                    <ul style="color: #94a3b8; font-size: 13px; padding-left: 20px; margin: 0; line-height: 1.8;">
                        <li><strong>Prêmio:</strong> 10.000.000 Z-Coins</li>
                        <li><strong>Data do Sorteio:</strong> Todo Domingo</li>
                        <li><strong>Horário:</strong> 20:00h (Horário do Servidor)</li>
                        <li><strong>Status:</strong> Ativo & Gravado</li>
                    </ul>
                </div>
                
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-bottom: 30px; text-align: left;">
                    Lembre-se: O sorteio é realizado de forma automática pelo nosso sistema. Se você for o grande vencedor, os Z-Coins serão adicionados diretamente na sua carteira de Z-Points e uma notificação aparecerá em seu painel da Zher Keys. Boa sorte!
                </p>
                
                <a href="${process.env.APP_URL || 'https://zherkeys.com'}" style="background-color: #3B82F6; color: white; display: inline-block; padding: 14px 28px; border-radius: 8px; font-size: 13px; font-weight: bold; text-decoration: none; letter-spacing: 1.5px;">
                    ACESSAR PORTAL ZHER KEYS
                </a>
            </div>`
        ).catch(e => console.error("[SWEEPSTAKE-EMAIL] Erro ao enviar e-mail de confirmação:", e));

        res.json({ success: true, message: 'Parabéns, você está participando do sorteio!' });
    } catch (err) {
        console.error("[SWEEPSTAKE-JOIN] Erro ao registrar participante:", err);
        res.status(500).json({ error: 'Erro interno ao processar sua inscrição no sorteio.' });
    }
});

// Helper para mascarar e-mails de ganhadores preservando privacidade
function maskEmail(email) {
    if (!email) return 'Ninguem';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 3) {
        return name[0] + '***@' + domain;
    }
    return name.substring(0, 3) + '***@' + domain;
}

// Obter ultimo ganhador do sorteio
app.get('/api/sweepstake/last-winner', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT h.drawn_at, h.prize_amount, u.email 
             FROM sweepstake_history h 
             LEFT JOIN users u ON h.winner_id = u.id 
             ORDER BY h.id DESC LIMIT 1`
        );
        if (result.rows.length === 0) {
            return res.json({ winner: null });
        }
        const row = result.rows[0];
        const winnerEmail = row.email ? maskEmail(row.email) : 'Ninguem';
        res.json({
            winner: winnerEmail,
            prize_amount: row.prize_amount,
            drawn_at: row.drawn_at
        });
    } catch (err) {
        console.error("[SWEEPSTAKE-LAST-WINNER] Erro ao buscar ultimo ganhador:", err);
        res.status(500).json({ error: 'Erro ao obter ultimo ganhador.' });
    }
});

// Logica de Sorteio Automatico
async function runSweepstakeDraw() {
    try {
        const now = new Date();
        
        // Determina o ultimo domingo as 23h UTC (20h no Horario de Brasilia)
        let lastSunday = new Date();
        lastSunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
        lastSunday.setUTCHours(23, 0, 0, 0);
        
        // Se hoje for domingo e ainda nao passou das 23h UTC, o ultimo sorteio foi no domingo da semana anterior
        if (now.getUTCDay() === 0 && now.getUTCHours() < 23) {
            lastSunday.setUTCDate(lastSunday.getUTCDate() - 7);
        }
        
        // Verifica se ja houve sorteio realizado depois do ultimo domingo as 23h UTC
        const checkDraw = await pool.query(
            "SELECT COUNT(*) FROM sweepstake_history WHERE drawn_at >= $1",
            [lastSunday]
        );
        
        if (parseInt(checkDraw.rows[0].count) > 0) {
            // Sorteio desta semana ja foi realizado
            return;
        }
        
        // Se passou do horario de domingo 23h UTC e ainda nao houve sorteio, realizamos agora!
        let targetSunday = new Date();
        targetSunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
        targetSunday.setUTCHours(23, 0, 0, 0);
        
        if (now >= targetSunday) {
            console.log('[SWEEPSTAKE] Horario do sorteio atingido! Sorteando ganhador...');
            
            // Busca todos os participantes
            const participantsRes = await pool.query("SELECT user_id FROM sweepstake_participants");
            const participants = participantsRes.rows;
            
            if (participants.length === 0) {
                console.log('[SWEEPSTAKE] Nenhum participante inscrito esta semana. Sorteio vazio registrado.');
                await pool.query(
                    "INSERT INTO sweepstake_history (winner_id, prize_amount) VALUES ($1, $2)",
                    [null, 0]
                );
                return;
            }
            
            // Sorteia um participante
            const randomIndex = Math.floor(Math.random() * participants.length);
            const winnerId = participants[randomIndex].user_id;
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Adiciona os 10 milhoes de Z-Points (points) para o usuario vencedor
                const userRes = await client.query("SELECT points, email FROM users WHERE id = $1 FOR UPDATE", [winnerId]);
                if (userRes.rows.length > 0) {
                    const currentPoints = parseInt(userRes.rows[0].points || 0);
                    const newPoints = currentPoints + 10000000;
                    const email = userRes.rows[0].email;
                    
                    await client.query("UPDATE users SET points = $1 WHERE id = $2", [newPoints, winnerId]);
                    await client.query("INSERT INTO points_earnings (user_id, amount) VALUES ($1, $2)", [winnerId, 10000000]);
                    
                    // Adiciona transacao
                    await client.query(
                        "INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)",
                        [winnerId, 0.00, 'minigame', 'Premio do Sorteio Semanal: +10.000.000 Z-Coins']
                    );
                    
                    // Adiciona notificacao para o vencedor
                    await client.query(
                        "INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)",
                        [
                            winnerId,
                            "🏆 VOCE GANHOU O SORTEIO!",
                            "Parabens! Voce foi o grande vencedor do sorteio semanal e acaba de receber 10.000.000 de Z-Coins na sua conta!",
                            "system"
                        ]
                    );
                    
                    console.log(`[SWEEPSTAKE] Sorteio realizado com sucesso! Vencedor: ${email} (ID: ${winnerId})`);

                    // Envia email especifico para o ganhador
                    sendEmailViaBrevo(
                        email,
                        "🏆 Voce ganhou o Sorteio Semanal da Zher Keys!",
                        `Parabens! Voce foi o grande vencedor do sorteio semanal da Zher Keys e recebeu 10.000.000 Z-Coins!`,
                        `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                            <h2 style="color: #F59E0B; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">🏆 VOCE GANHOU O SORTEIO!</h2>
                            <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Zher Keys Sweepstake Winner</p>
                            
                            <div style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid #F59E0B; color: #F59E0B; display: inline-block; padding: 8px 16px; border-radius: 9999px; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-bottom: 25px;">
                                🎉 10.000.000 Z-COINS RECEBIDOS
                            </div>
                            
                            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px; text-align: left;">
                                Ola, jogador!<br><br>
                                Temos o imenso prazer de informar que voce foi o grande vencedor do nosso sorteio semanal de <strong>10.000.000 de Z-Coins</strong>!
                                O premio ja foi creditado diretamente na sua carteira de Z-Points e voce pode utiliza-lo para rodar a roleta ou aproveitar os minijogos do site.
                            </p>
                            
                            <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                                <h4 style="color: white; margin-top: 0; margin-bottom: 10px; font-size: 14px; font-weight: bold; letter-spacing: 1px;">Detalhes do Premio:</h4>
                                <ul style="color: #94a3b8; font-size: 13px; padding-left: 20px; margin: 0; line-height: 1.8;">
                                    <li><strong>Premio:</strong> 10.000.000 Z-Coins</li>
                                    <li><strong>Transacao:</strong> Credito automatico via sistema</li>
                                    <li><strong>Data do Sorteio:</strong> Todo Domingo</li>
                                </ul>
                            </div>
                            
                            <a href="${process.env.APP_URL || 'https://zherkeys.com'}/account.html" style="background-color: #F59E0B; color: black; display: inline-block; padding: 14px 28px; border-radius: 8px; font-size: 13px; font-weight: bold; text-decoration: none; letter-spacing: 1.5px;">
                                IR PARA MINHA CARTEIRA
                            </a>
                        </div>`
                    ).catch(e => console.error("[SWEEPSTAKE-EMAIL-WINNER] Erro ao enviar e-mail de ganhador:", e));
                }
                
                // Registra na historia
                await client.query(
                    "INSERT INTO sweepstake_history (winner_id, prize_amount) VALUES ($1, $2)",
                    [winnerId, 10000000]
                );
                
                // Limpa todos os participantes para a proxima semana
                await client.query("DELETE FROM sweepstake_participants");
                
                await client.query('COMMIT');

                // Envia e-mail de notificacao para todos os usuarios cadastrados participarem do novo sorteio
                (async () => {
                    try {
                        const allUsersRes = await pool.query("SELECT email FROM users");
                        const allUsers = allUsersRes.rows;
                        console.log(`[SWEEPSTAKE] Notificando ${allUsers.length} usuarios sobre o inicio do novo sorteio semanal...`);
                        
                        const winnerEmail = userRes.rows.length > 0 ? userRes.rows[0].email : '';
                        const winnerEmailMasked = maskEmail(winnerEmail);

                        for (let userRow of allUsers) {
                            sendEmailViaBrevo(
                                userRow.email,
                                "🎟️ Novo Sorteio Semanal Ativo - Ganhe 10 Milhoes de Z-Coins!",
                                `Ola! Um novo sorteio de 10.000.000 Z-Coins acabou de comecar na Zher Keys! O ganhador do ultimo sorteio foi o usuario ${winnerEmailMasked}. Acesse a nossa pagina inicial, complete a tarefa rapida de anuncios e garanta a sua inscricao para concorrer neste domingo as 20h! Boa sorte!`,
                                `<div style="background-color: #020617; color: #f8fafc; padding: 40px 20px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; border-radius: 16px; max-w: 600px; margin: 0 auto;">
                                    <h2 style="color: #F43F5E; font-size: 24px; margin-bottom: 5px; font-weight: bold; letter-spacing: 2px;">NOVO SORTEIO ZHER KEYS</h2>
                                    <p style="color: #94a3b8; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Oportunidade Semanal Recorrente</p>
                                    
                                    <div style="background-color: rgba(244, 63, 94, 0.1); border: 1px solid #F43F5E; color: #F43F5E; display: inline-block; padding: 8px 16px; border-radius: 9999px; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-bottom: 25px;">
                                        🎟️ INSCRICOES ABERTAS
                                    </div>
                                    
                                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 25px; text-align: left;">
                                        Ola, jogador!<br><br>
                                        Um novo sorteio de <strong>10.000.000 de Z-Coins</strong> acaba de ser iniciado! A lista de participantes da semana anterior foi redefinida, o que significa que <strong>todas as inscricoes estao zeradas</strong> e voce ja pode garantir a sua vaga.
                                    </p>

                                    <p style="color: #cbd5e1; font-size: 14px; font-style: italic; margin-bottom: 25px; text-align: center; background-color: #0f172a; border: 1px solid #1e293b; padding: 12px; border-radius: 8px;">
                                        🏆 O grande vencedor do ultimo sorteio foi: <strong>${winnerEmailMasked}</strong>!
                                    </p>

                                    <div style="margin: 25px 0;">
                                        <img src="${process.env.APP_URL || 'https://zherkeys.com'}/sorteio_zcoins.png" alt="Sorteio 10 Milhoes Z-Coins" style="width: 100%; max-width: 440px; border-radius: 12px; border: 1px solid #1e293b; display: block; margin: 0 auto; box-shadow: 0 0 20px rgba(244, 63, 94, 0.2);" />
                                    </div>
                                    
                                    <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: left;">
                                        <h4 style="color: white; margin-top: 0; margin-bottom: 10px; font-size: 14px; font-weight: bold; letter-spacing: 1px;">Regras de Entrada:</h4>
                                        <ul style="color: #94a3b8; font-size: 13px; padding-left: 20px; margin: 0; line-height: 1.8;">
                                            <li><strong>Premio Semanal:</strong> 10.000.000 Z-Coins</li>
                                            <li><strong>Como participar:</strong> Entre no site e assista a 5 anuncios curtos.</li>
                                            <li><strong>Data Limite:</strong> Todo Domingo as 20:00h (Horario de Brasilia / 23:00h UTC)</li>
                                        </ul>
                                    </div>
                                    
                                    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-bottom: 30px; text-align: left;">
                                        Nao perca tempo! Quanto antes voce garantir sua inscricao, mais tempo tera para aproveitar os minijogos e rodar a roleta com suas chaves diarias. Quem sabe voce sera o proximo sortudo da Zher Keys?
                                    </p>
                                    
                                    <a href="${process.env.APP_URL || 'https://zherkeys.com'}" style="background-color: #F43F5E; color: white; display: inline-block; padding: 14px 28px; border-radius: 8px; font-size: 13px; font-weight: bold; text-decoration: none; letter-spacing: 1.5px;">
                                        GARANTIR MINHA VAGA NO SORTEIO
                                    </a>
                                </div>`
                            ).catch(e => console.error("[SWEEPSTAKE-BULK-EMAIL] Erro ao notificar usuario:", e));
                        }
                    } catch (bulkErr) {
                        console.error("[SWEEPSTAKE-BULK-EMAIL] Erro ao buscar lista de usuarios:", bulkErr);
                    }
                })();
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("[SWEEPSTAKE] Erro durante transacao de sorteio:", err);
            } finally {
                client.release();
            }
        }
    } catch (err) {
        console.error("[SWEEPSTAKE] Erro na verificacao do sorteio:", err);
    }
}

// Executa verificação a cada 60 segundos
setInterval(runSweepstakeDraw, 60 * 1000);
// E roda uma verificação no início do servidor
setTimeout(runSweepstakeDraw, 5000);

// Listar todos os usuários com seus saldos (Admin)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, balance FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch(e) {
        console.error("[ADMIN-USERS] Erro ao buscar usuários:", e);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// Ajustar créditos de um usuário (Admin - Adicionar ou remover)
app.post('/api/admin/users/:id/credits', requireAdmin, async (req, res) => {
    const { amount, description } = req.body;
    const { id } = req.params;
    if (amount === undefined || isNaN(parseFloat(amount))) {
        return res.status(400).json({ error: 'Quantia inválida' });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [id]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        const balance = parseFloat(userRes.rows[0].balance || 0);
        const newBalance = balance + parseFloat(amount);
        
        if (newBalance < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'O saldo final não pode ser menor que zero.' });
        }
        
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, id]);
        
        // Registra a transação no extrato do usuário
        await client.query(
            'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [id, parseFloat(amount), parseFloat(amount) >= 0 ? 'deposit' : 'withdraw', description || 'Ajuste de saldo pelo Administrador']
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Créditos atualizados com sucesso!', balance: newBalance });
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("[ADMIN-CREDITS] Erro ao ajustar créditos:", err);
        res.status(500).json({ error: 'Erro ao ajustar créditos.' });
    } finally {
        client.release();
    }
});

// Obter histórico de compras de um usuário (Admin)
app.get('/api/admin/users/:id/orders', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const ordersRes = await pool.query(`
            SELECT o.*, u.email as user_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.user_id = $1
            ORDER BY o.id DESC
        `, [userId]);
        const orders = ordersRes.rows;
        
        for (let order of orders) {
            const itemsRes = await pool.query(`
                SELECT oi.quantity, oi.price, p.title, oi.activation_key, oi.key_viewed
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $1
            `, [order.id]);
            order.items = itemsRes.rows;
        }
        res.json(orders);
    } catch(e) {
        console.error("[ADMIN-USER-ORDERS] Erro ao buscar pedidos do usuário:", e);
        res.status(500).json({ error: 'Erro ao buscar pedidos do usuário' });
    }
});

// ==========================================
// SEÇÃO DE STREAMING E ASSINATURA (ZHER PLAY)
// ==========================================

const multer = require('multer');
const { spawn, spawnSync } = require('child_process');

// Verifica disponibilidade do ffmpeg no sistema e expõe flag
let FFMPEG_AVAILABLE = false;
let FFMPEG_PATH = 'ffmpeg';
try {
    // Check system ffmpeg
    const check = spawnSync('ffmpeg', ['-version']);
    if (check.status === 0) {
        FFMPEG_AVAILABLE = true;
        FFMPEG_PATH = 'ffmpeg';
        console.log('[INIT] ffmpeg disponível no PATH — transcodificação habilitada.');
    } else {
        // Check local bin folder (./bin/ffmpeg)
        const localWin = path.join(__dirname, 'bin', 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        if (fs.existsSync(localWin)) {
            const c2 = spawnSync(localWin, ['-version']);
            if (c2.status === 0) {
                FFMPEG_AVAILABLE = true;
                FFMPEG_PATH = localWin;
                console.log('[INIT] ffmpeg disponível em', localWin);
            }
        }

        if (!FFMPEG_AVAILABLE) {
            console.warn('[INIT] ffmpeg NÃO encontrado — uploads de MKV não serão transcodificados automaticamente. Execução automática de instalação será tentada.');
            // tenta instalar automaticamente
            try {
                const installed = tryAutoInstallFfmpeg();
                if (installed) {
                    FFMPEG_AVAILABLE = true;
                    console.log('[INIT] ffmpeg instalado automaticamente.');
                } else {
                    console.warn('[INIT] Falha ao instalar ffmpeg automaticamente. Execute scripts/install-ffmpeg.ps1 manualmente.');
                }
            } catch (e) {
                console.warn('[INIT] Erro ao tentar instalar ffmpeg automaticamente:', e.message || e);
            }
        }
    }
} catch (e) {
    console.warn('[INIT] Erro ao verificar ffmpeg — transcodificação desativada.');
}

// Tenta instalação automática simples do ffmpeg dependendo do SO
function tryAutoInstallFfmpeg() {
    try {
        if (process.platform === 'win32') {
            // Executa PowerShell para baixar e extrair build essencial do Gyan
            const psScript = `
$tmp = "$env:TEMP\\ffmpeg_dl";
New-Item -ItemType Directory -Force -Path $tmp | Out-Null;
$url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
$zip = Join-Path $tmp 'ffmpeg.zip';
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing;
Expand-Archive -Path $zip -DestinationPath $tmp -Force;
$dir = Get-ChildItem $tmp | Where-Object { $_.PsIsContainer -and $_.Name -like 'ffmpeg*' } | Select-Object -First 1;
if ($dir) {
    $src = Join-Path $dir.FullName 'bin\\ffmpeg.exe';
    $destDir = Join-Path (Get-Location) 'bin\\ffmpeg';
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null;
    Copy-Item -Path $src -Destination (Join-Path $destDir 'ffmpeg.exe') -Force;
    Write-Output 'ok';
}
`;
            const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], { windowsHide: true, timeout: 120000 });
            if (r.status === 0) {
                const local = path.join(__dirname, 'bin', 'ffmpeg', 'ffmpeg.exe');
                if (fs.existsSync(local)) {
                    FFMPEG_PATH = local;
                    return true;
                }
            }
            return false;
        } else {
            // Tentativa simples para Linux (precisa de permissões root)
            const apt = spawnSync('apt-get', ['update'], { stdio: 'ignore' });
            const inst = spawnSync('apt-get', ['install', '-y', 'ffmpeg'], { stdio: 'ignore' });
            const check = spawnSync('ffmpeg', ['-version']);
            if (check.status === 0) return true;
            // Try yum
            const yum = spawnSync('yum', ['install', '-y', 'ffmpeg'], { stdio: 'ignore' });
            const check2 = spawnSync('ffmpeg', ['-version']);
            return check2.status === 0;
        }
    } catch (e) {
        return false;
    }
}

// Configuração do Multer para Uploads do Streaming
const storageGeneric = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public', 'uploads', 'temp');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadGeneric = multer({
    storage: storageGeneric,
    limits: { fileSize: 1024 * 1024 * 1024 * 10 } // Limite de 10GB para filmes em alta qualidade
});

// Middleware para verificar se o usuário possui assinatura ativa
const requireSubscription = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Não autorizado.' });
    try {
        const result = await pool.query('SELECT email, subscription_expires_at FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            // Admin tem acesso total livre
            if (user.email === 'zherkeys@gmail.com') {
                return next();
            }
            const expires = user.subscription_expires_at;
            if (expires && new Date(expires) > new Date()) {
                return next();
            }
        }
        res.status(403).json({ error: 'Assinatura inativa ou expirada. Assine por R$ 9,99/mês para ter acesso.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao verificar assinatura.' });
    }
};

// Obter status de assinatura do usuário logado
app.get('/api/streaming/status', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT subscription_expires_at, balance FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0) {
            const expires = result.rows[0].subscription_expires_at;
            const isSubscribed = expires && new Date(expires) > new Date();
            res.json({
                subscribed: isSubscribed,
                expires_at: expires,
                balance: result.rows[0].balance
            });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado.' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar status.' });
    }
});

// Assinar Zher Play usando saldo da carteira (R$ 9,99)
app.post('/api/streaming/subscribe/balance', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const userRes = await client.query('SELECT balance, subscription_expires_at FROM users WHERE id = $1 FOR UPDATE', [req.session.userId]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const balance = parseFloat(userRes.rows[0].balance || 0);
        if (balance < 9.99) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Saldo insuficiente. Recarregue sua carteira para assinar!' });
        }
        
        const currentExpires = userRes.rows[0].subscription_expires_at;
        let newExpires;
        const now = new Date();
        
        if (!currentExpires || new Date(currentExpires) < now) {
            newExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
            newExpires = new Date(new Date(currentExpires).getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        
        const newBalance = balance - 9.99;
        
        await client.query('UPDATE users SET balance = $1, subscription_expires_at = $2 WHERE id = $3', [newBalance, newExpires, req.session.userId]);
        
        // Registra transação no extrato
        await client.query(
            'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [req.session.userId, -9.99, 'subscription', 'Assinatura Mensal Zher Play']
        );
        
        // Cria notificação
        await client.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
            [req.session.userId, 'Assinatura Ativa!', `Assinatura Zher Play ativada! Válida até ${newExpires.toLocaleDateString('pt-BR')}.`, 'success']
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Assinatura ativada com sucesso!', balance: newBalance, expires_at: newExpires });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Erro ao assinar com saldo:", e);
        res.status(500).json({ error: 'Erro ao processar assinatura.' });
    } finally {
        client.release();
    }
});

// Assinar Zher Play via MercadoPago (PIX ou Cartão)
app.post('/api/streaming/subscribe/checkout', requireAuth, async (req, res) => {
    const { method, cpf } = req.body;
    const price = 9.99;
    
    try {
        // Cria um pedido pendente para a assinatura
        const orderRes = await pool.query(
            'INSERT INTO orders (user_id, status, total_amount, is_deposit, is_subscription) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [req.session.userId, 'pending', price, false, true]
        );
        const orderId = orderRes.rows[0].id;
        
        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        const email = userRes.rows[0]?.email || 'guest@example.com';
        
        if (method === 'pix') {
            const paymentClient = new Payment(mpClient);
            const createdPayment = await paymentClient.create({
                body: {
                    transaction_amount: price,
                    description: `Assinatura Mensal Zher Play - Pedido #${orderId}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: email,
                        first_name: 'Cliente',
                        last_name: 'ZherPlay',
                        identification: {
                            type: 'CPF',
                            number: cpf ? cpf.replace(/\D/g, '') : generateCPF()
                        }
                    },
                    external_reference: orderId.toString(),
                    notification_url: `${APP_URL}/webhook`
                },
                requestOptions: {
                    idempotencyKey: crypto.randomUUID()
                }
            });
            
            const qrCodeBase64 = createdPayment.point_of_interaction.transaction_data.qr_code_base64;
            const qrCode = createdPayment.point_of_interaction.transaction_data.qr_code;
            
            await pool.query(
                'UPDATE orders SET mp_payment_id = $1, pix_qr_code = $2, pix_qr_code_base64 = $3 WHERE id = $4',
                [createdPayment.id.toString(), qrCode, qrCodeBase64, orderId]
            );
            
            // Registra notificação pendente
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type, order_id) VALUES ($1, $2, $3, $4, $5)',
                [req.session.userId, 'Assinatura Pendente', `Sua assinatura Zher Play está aguardando pagamento.`, 'warning', orderId]
            );
            
            return res.json({ qr_code_base64: qrCodeBase64, qr_code: qrCode, orderId });
        }
        
        if (method === 'card') {
            const preference = new Preference(mpClient);
            const createdPref = await preference.create({
                body: {
                    items: [{
                        id: `sub-${orderId}`,
                        title: `Assinatura Mensal Zher Play`,
                        unit_price: price,
                        quantity: 1,
                        currency_id: 'BRL'
                    }],
                    external_reference: orderId.toString(),
                    back_urls: {
                        success: `${APP_URL}/streaming.html?status=success`,
                        failure: `${APP_URL}/streaming.html?status=failure`,
                        pending: `${APP_URL}/streaming.html?status=pending`
                    },
                    auto_return: 'approved',
                    notification_url: `${APP_URL}/webhook`
                }
            });
            
            await pool.query('UPDATE orders SET mp_preference_id = $1 WHERE id = $2', [createdPref.id, orderId]);
            return res.json({ init_point: createdPref.init_point, orderId });
        }
        
        res.status(400).json({ error: 'Método inválido.' });
    } catch (e) {
        console.error("Erro ao gerar checkout de assinatura:", e);
        res.status(500).json({ error: 'Erro ao gerar pagamento da assinatura.' });
    }
});

// Catálogo de Mídias (Apenas assinantes têm acesso)
app.get('/api/streaming/catalog', requireAuth, requireSubscription, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM streaming_media ORDER BY id DESC');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar catálogo.' });
    }
});

// Detalhes da Mídia e seus Episódios (se houver)
app.get('/api/streaming/media/:id', requireAuth, requireSubscription, async (req, res) => {
    const mediaId = parseInt(req.params.id);
    try {
        const mediaRes = await pool.query('SELECT * FROM streaming_media WHERE id = $1', [mediaId]);
        if (mediaRes.rows.length === 0) {
            return res.status(404).json({ error: 'Conteúdo não encontrado.' });
        }
        
        const media = mediaRes.rows[0];
        if (media.type === 'series' || media.type === 'anime') {
            const episodesRes = await pool.query('SELECT * FROM streaming_episodes WHERE media_id = $1 ORDER BY season ASC, episode_number ASC', [mediaId]);
            media.episodes = episodesRes.rows;
        }
        
        res.json(media);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar conteúdo.' });
    }
});

// Conversão automática e facilitada de legendas SRT para VTT
function convertSrtToVtt(srtText) {
    let vtt = srtText;
    if (!srtText.trim().startsWith('WEBVTT')) {
        vtt = 'WEBVTT\n\n' + srtText;
    }
    return vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

// Auxiliar para chamar API gratuita do Google Translate
async function translateText(text, targetLang) {
    if (!text.trim()) return '';
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (!res.ok) return text;
        const data = await res.json();
        if (data && data[0]) {
            let translated = '';
            for (let chunk of data[0]) {
                if (chunk[0]) {
                    translated += chunk[0];
                }
            }
            return translated;
        }
        return text;
    } catch (e) {
        console.error("Erro na tradução automática:", e);
        return text;
    }
}

// Tradutor em Lotes de Legenda WebVTT
async function translateVtt(vttText, targetLang) {
    const blocks = vttText.split(/\r?\n\r?\n/);
    const textsToTranslate = [];
    const textBlockMap = [];
    
    for (let i = 0; i < blocks.length; i++) {
        const lines = blocks[i].split(/\r?\n/);
        let timingIndex = -1;
        for (let j = 0; j < lines.length; j++) {
            if (lines[j].includes('-->')) {
                timingIndex = j;
                break;
            }
        }
        
        if (timingIndex !== -1) {
            for (let j = timingIndex + 1; j < lines.length; j++) {
                const txt = lines[j].trim();
                if (txt) {
                    textsToTranslate.push(txt);
                    textBlockMap.push({ blockIndex: i, lineIndex: j });
                }
            }
        }
    }
    
    const batchSize = 40;
    const translatedTexts = [];
    
    for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        const batch = textsToTranslate.slice(i, i + batchSize);
        const promises = batch.map(t => translateText(t, targetLang));
        const results = await Promise.all(promises);
        translatedTexts.push(...results);
    }
    
    const newBlocks = blocks.map(b => b.split(/\r?\n/));
    for (let i = 0; i < textBlockMap.length; i++) {
        const { blockIndex, lineIndex } = textBlockMap[i];
        newBlocks[blockIndex][lineIndex] = translatedTexts[i];
    }
    
    return newBlocks.map(lines => lines.join('\n')).join('\n\n');
}

const subtitleCache = new Map();

// Endpoint Proxy de Tradução de Legendas
app.get('/api/streaming/translate-subtitle', async (req, res) => {
    const { url, target } = req.query;
    const targetLang = target || 'pt';
    
    if (!url) return res.status(400).send('URL da legenda ausente.');
    
    const cacheKey = `${url}_${targetLang}`;
    if (subtitleCache.has(cacheKey)) {
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        return res.send(subtitleCache.get(cacheKey));
    }
    
    try {
        let vttText = '';
        if (url.startsWith('/uploads/')) {
            const localPath = path.join(__dirname, 'public', url);
            if (fs.existsSync(localPath)) {
                vttText = fs.readFileSync(localPath, 'utf-8');
            } else {
                return res.status(404).send('Legenda local não encontrada.');
            }
        } else {
            const response = await fetch(url);
            if (!response.ok) return res.status(400).send('Não foi possível baixar legenda remota.');
            vttText = await response.text();
        }
        
        if (url.endsWith('.srt') || !vttText.trim().startsWith('WEBVTT')) {
            vttText = convertSrtToVtt(vttText);
        }
        
        const translatedVtt = await translateVtt(vttText, targetLang);
        subtitleCache.set(cacheKey, translatedVtt);
        
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.send(translatedVtt);
    } catch (e) {
        console.error("Erro geral na legenda:", e);
        res.status(500).send('Erro na tradução.');
    }
});

// ==========================================
// PAINEL ADMINISTRATIVO DO STREAMING (UPLOADS)
// ==========================================

// Endpoint Genérico de Upload de Arquivos (Admin)
app.post('/api/admin/streaming/upload', requireAdmin, uploadGeneric.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mime = req.file.mimetype;
    let subfolder = 'subtitles';
    
    const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.wma', '.mp4a'];
    if (ext === '.vtt' || ext === '.srt') {
        subfolder = 'subtitles';
    } else if (ext === '.pdf') {
        subfolder = 'books';
    } else if (audioExts.includes(ext) || mime.startsWith('audio/')) {
        subfolder = 'audio';
    } else if (mime.startsWith('image/')) {
        subfolder = 'thumbnails';
    } else if (mime.startsWith('video/')) {
        subfolder = 'videos';
    }
    
    const destDir = path.join(__dirname, 'public', 'uploads', subfolder);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    const newPath = path.join(destDir, req.file.filename);
    try {
        fs.renameSync(req.file.path, newPath);

        // If uploaded a video in a non-MP4 container, transcode to MP4 (H.264 + AAC)
        if (mime.startsWith('video/') && ext !== '.mp4') {
            const parsed = path.parse(req.file.filename);
            const convertedName = parsed.name + '.mp4';
            const convertedPath = path.join(destDir, convertedName);

            try {
                if (!FFMPEG_AVAILABLE) {
                    console.warn('ffmpeg não disponível no servidor — pulando transcodificação.');
                    return res.json({ url: `/uploads/${subfolder}/${req.file.filename}`, converted: false, warning: 'ffmpeg não disponível' });
                }

                await new Promise((resolve, reject) => {
                    const ff = spawn(FFMPEG_PATH, [
                        '-y', '-i', newPath,
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                        '-c:a', 'aac', '-b:a', '192k',
                        convertedPath
                    ]);

                    ff.on('error', (e) => reject(e));
                    ff.stderr.on('data', () => {});
                    ff.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error('ffmpeg exit code ' + code));
                    });
                });

                // Remove original uploaded file to save space (optional)
                try { fs.unlinkSync(newPath); } catch (e) { /* ignore */ }

                // Gerar HLS (m3u8 + .ts) para streaming adaptativo
                let hlsUrl = null;
                try {
                    const hlsDir = path.join(destDir, 'hls', path.parse(convertedName).name);
                    if (!fs.existsSync(hlsDir)) fs.mkdirSync(hlsDir, { recursive: true });
                    const hlsPath = path.join(hlsDir, 'index.m3u8');

                    await new Promise((resolve, reject) => {
                        const args = [
                            '-y', '-i', convertedPath,
                            '-codec', 'copy',
                            '-start_number', '0',
                            '-hls_time', '6',
                            '-hls_list_size', '0',
                            '-f', 'hls',
                            path.join(hlsDir, 'index.m3u8')
                        ];
                        const hf = spawn(FFMPEG_PATH, args);
                        hf.on('error', (e) => reject(e));
                        hf.stderr.on('data', () => {});
                        hf.on('close', (code) => {
                            if (code === 0) resolve();
                            else reject(new Error('ffmpeg HLS exit code ' + code));
                        });
                    });

                    hlsUrl = `/uploads/${subfolder}/hls/${path.parse(convertedName).name}/index.m3u8`;
                } catch (e) {
                    console.error('Falha ao gerar HLS:', e);
                }

                return res.json({ url: `/uploads/${subfolder}/${convertedName}`, converted: true, hls: hlsUrl });
            } catch (e) {
                console.error('Erro na transcodificação do vídeo:', e);
                // On failure, return original uploaded file URL
                return res.json({ url: `/uploads/${subfolder}/${req.file.filename}`, converted: false, warning: 'Falha na transcodificação' });
            }
        }

        res.json({ url: `/uploads/${subfolder}/${req.file.filename}` });
    } catch (err) {
        console.error("Erro ao mover arquivo de upload:", err);
        res.status(500).json({ error: 'Erro ao salvar o arquivo no servidor.' });
    }
});

// Adicionar Mídia (Filme/Série/Anime)
app.post('/api/admin/streaming/media', requireAdmin, async (req, res) => {
    const { title, description, type, category, thumbnail, video_url, audio_tracks, subtitles } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO streaming_media (title, description, type, category, thumbnail, video_url, audio_tracks, subtitles) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [title, description, type, category, thumbnail, video_url || '', audio_tracks || '[]', subtitles || '[]']
        );
        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao adicionar mídia.' });
    }
});

// Editar Mídia
app.put('/api/admin/streaming/media/:id', requireAdmin, async (req, res) => {
    const { title, description, type, category, thumbnail, video_url, audio_tracks, subtitles } = req.body;
    const mediaId = parseInt(req.params.id);
    try {
        await pool.query(
            'UPDATE streaming_media SET title = $1, description = $2, type = $3, category = $4, thumbnail = $5, video_url = $6, audio_tracks = $7, subtitles = $8 WHERE id = $9',
            [title, description, type, category, thumbnail, video_url || '', audio_tracks || '[]', subtitles || '[]', mediaId]
        );
        res.json({ success: true, message: 'Mídia atualizada com sucesso!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao atualizar mídia.' });
    }
});

// Excluir Mídia
app.delete('/api/admin/streaming/media/:id', requireAdmin, async (req, res) => {
    const mediaId = parseInt(req.params.id);
    try {
        await pool.query('DELETE FROM streaming_media WHERE id = $1', [mediaId]);
        res.json({ success: true, message: 'Mídia excluída.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao excluir.' });
    }
});

// Adicionar Episódio
app.post('/api/admin/streaming/episode', requireAdmin, async (req, res) => {
    const { media_id, season, episode_number, title, description, video_url, audio_tracks, subtitles, duration } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO streaming_episodes (media_id, season, episode_number, title, description, video_url, audio_tracks, subtitles, duration) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [parseInt(media_id), parseInt(season || 1), parseInt(episode_number), title, description || '', video_url, audio_tracks || '[]', subtitles || '[]', parseInt(duration || 0)]
        );
        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao adicionar episódio.' });
    }
});

// Excluir Episódio
app.delete('/api/admin/streaming/episode/:id', requireAdmin, async (req, res) => {
    const episodeId = parseInt(req.params.id);
    try {
        await pool.query('DELETE FROM streaming_episodes WHERE id = $1', [episodeId]);
        res.json({ success: true, message: 'Episódio excluído.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao excluir.' });
    }
});

// ==========================================
// SEÇÃO DE MÚSICA DE FUNDO DO SITE (BACKGROUND PLAYBACK)
// ==========================================

function getMusicSettingsFromBackup() {
    try {
        const p = path.join(__dirname, 'data', 'music_settings_backup.json');
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf-8'));
        }
    } catch(e) {}
    return { enabled: false, shuffle: true, playlist: [] };
}

function saveMusicSettingsToBackup(settings) {
    try {
        const dir = path.join(__dirname, 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const p = path.join(dir, 'music_settings_backup.json');
        fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf-8');
    } catch(e) {}
}

app.get('/api/site/music', async (req, res) => {
    try {
        const result = await pool.query('SELECT enabled, shuffle, playlist FROM site_music_settings WHERE id = 1');
        if (result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            let playlist = [];
            try { playlist = JSON.parse(row.playlist || '[]'); } catch(e){}
            return res.json({
                enabled: row.enabled === true,
                shuffle: row.shuffle !== false,
                playlist: playlist
            });
        }
    } catch(e) {}
    
    const backup = getMusicSettingsFromBackup();
    res.json(backup);
});

app.get('/api/admin/music', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT enabled, shuffle, playlist FROM site_music_settings WHERE id = 1');
        if (result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            let playlist = [];
            try { playlist = JSON.parse(row.playlist || '[]'); } catch(e){}
            return res.json({
                enabled: row.enabled === true,
                shuffle: row.shuffle !== false,
                playlist: playlist
            });
        }
    } catch(e) {}
    
    const backup = getMusicSettingsFromBackup();
    res.json(backup);
});

app.put('/api/admin/music', requireAdmin, async (req, res) => {
    const { enabled, shuffle, playlist } = req.body;
    const playlistArr = Array.isArray(playlist) ? playlist : [];
    const playlistJson = JSON.stringify(playlistArr);
    const isEnabled = enabled === true;
    const isShuffle = shuffle !== false;
    
    const settings = {
        enabled: isEnabled,
        shuffle: isShuffle,
        playlist: playlistArr
    };
    
    saveMusicSettingsToBackup(settings);
    
    try {
        await pool.query(
            `INSERT INTO site_music_settings (id, enabled, shuffle, playlist)
             VALUES (1, $1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET enabled = $1, shuffle = $2, playlist = $3`,
            [isEnabled, isShuffle, playlistJson]
        );
        res.json({ success: true, message: 'Configurações de música salvas com sucesso!' });
    } catch(e) {
        console.error("Erro ao salvar música no banco:", e);
        res.json({ success: true, message: 'Configurações salvas no backup local!' });
    }
});

// Endpoint de Importação / Auto-preenchimento via Steam URL ou AppID
app.post('/api/admin/scrape-steam', requireAdmin, async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Cole uma URL da Steam válida ou o nome/AppID do jogo.' });
    }

    const cleanInput = url.trim();

    try {
        let appid = null;
        const match = cleanInput.match(/\/app\/(\d+)/);
        if (match) {
            appid = match[1];
        } else if (/^\d+$/.test(cleanInput)) {
            appid = cleanInput;
        }

        const steamHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        };

        if (!appid) {
            const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanInput)}&l=portuguese&cc=BR`;
            const searchRes = await fetch(searchUrl, { headers: steamHeaders });
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.items && searchData.items.length > 0) {
                    appid = searchData.items[0].id;
                }
            }
        }

        if (!appid) {
            // Fallback para fetchSteamGameInfo interno
            const fallbackInfo = await fetchSteamGameInfo(cleanInput);
            if (fallbackInfo) {
                return res.json({
                    success: true,
                    title: cleanInput,
                    price: 0,
                    old_price: fallbackInfo.originalPrice || 0,
                    description: 'Jogo disponível na Steam.',
                    genres: 'Ação, Aventura',
                    image: fallbackInfo.headerImage || fallbackInfo.libraryImage || '',
                    gallery: [...(fallbackInfo.movies || []), ...(fallbackInfo.screenshots || [])]
                });
            }
            return res.status(404).json({ error: 'Jogo não encontrado na Steam com este link ou termo.' });
        }

        const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=portuguese&cc=BR`;
        const detailsRes = await fetch(detailsUrl, { headers: steamHeaders });
        if (!detailsRes.ok) {
            return res.status(500).json({ error: 'Não foi possível se conectar aos servidores da Steam no momento.' });
        }

        const detailsData = await detailsRes.json();
        if (!detailsData[appid] || !detailsData[appid].success || !detailsData[appid].data) {
            return res.status(404).json({ error: 'A Steam não retornou detalhes públicos para este jogo.' });
        }

        const game = detailsData[appid].data;

        let price = 0;
        let oldPrice = 0;
        if (game.price_overview) {
            price = (game.price_overview.final / 100) || 0;
            oldPrice = (game.price_overview.initial / 100) || 0;
            if (oldPrice <= price) oldPrice = 0;
        }

        const genres = (game.genres || []).map(g => g.description).join(', ');
        const headerImage = game.header_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
        const screenshots = (game.screenshots || []).map(s => s.path_full).slice(0, 5);

        let movies = [];
        if (game.movies && game.movies.length > 0) {
            game.movies.forEach(m => {
                const mp4Url = m.mp4 ? (m.mp4.max || m.mp4['480']) : null;
                const webmUrl = m.webm ? (m.webm.max || m.webm['480']) : null;
                if (mp4Url) movies.push(mp4Url);
                else if (webmUrl) movies.push(webmUrl);
            });
        }

        const gallery = [...movies, ...screenshots];

        let description = game.short_description || game.about_the_game || game.detailed_description || '';
        description = description.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();

        return res.json({
            success: true,
            title: game.name || '',
            price: price,
            old_price: oldPrice,
            description: description,
            genres: genres,
            image: headerImage,
            gallery: gallery,
            appid: appid
        });
    } catch(e) {
        console.error("Erro ao importar dados da Steam:", e);
        res.status(500).json({ error: 'Erro ao conectar com a API da Steam.' });
    }
});

// ==========================================
// SEÇÃO DE LEITURA (ZHER READ - EBOOKS & MANGAS)
// ==========================================

// Middleware para verificar se o usuário possui assinatura ativa de leitura
const requireReadingSubscription = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Não autorizado.' });
    try {
        const result = await pool.query('SELECT email, reading_subscription_expires_at FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            // Admin tem acesso livre
            if (user.email === 'zherkeys@gmail.com') {
                return next();
            }
            const expires = user.reading_subscription_expires_at;
            if (expires && new Date(expires) > new Date()) {
                return next();
            }
        }
        res.status(403).json({ error: 'Assinatura inativa ou expirada. Assine por R$ 4,99/mês para ler.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao verificar assinatura de leitura.' });
    }
};

// Obter status de assinatura de leitura do usuário logado
app.get('/api/reading/status', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT reading_subscription_expires_at, balance FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0) {
            const expires = result.rows[0].reading_subscription_expires_at;
            const isSubscribed = expires && new Date(expires) > new Date();
            res.json({
                subscribed: isSubscribed,
                expires_at: expires,
                balance: result.rows[0].balance
            });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado.' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar status de leitura.' });
    }
});

// Assinar Zher Read usando saldo da carteira (R$ 4,99)
app.post('/api/reading/subscribe/balance', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const userRes = await client.query('SELECT balance, reading_subscription_expires_at FROM users WHERE id = $1 FOR UPDATE', [req.session.userId]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        const balance = parseFloat(userRes.rows[0].balance || 0);
        if (balance < 4.99) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Saldo insuficiente. Recarregue sua carteira para assinar!' });
        }
        
        const currentExpires = userRes.rows[0].reading_subscription_expires_at;
        let newExpires;
        const now = new Date();
        
        if (!currentExpires || new Date(currentExpires) < now) {
            newExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
            newExpires = new Date(new Date(currentExpires).getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        
        const newBalance = balance - 4.99;
        
        await client.query('UPDATE users SET balance = $1, reading_subscription_expires_at = $2 WHERE id = $3', [newBalance, newExpires, req.session.userId]);
        
        // Registra transação
        await client.query(
            'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [req.session.userId, -4.99, 'subscription', 'Assinatura Mensal Zher Read']
        );
        
        // Notificação
        await client.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
            [req.session.userId, 'Assinatura Read Ativa!', `Assinatura Zher Read ativa! Válida até ${newExpires.toLocaleDateString('pt-BR')}.`, 'success']
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Assinatura de leitura ativada!', balance: newBalance, expires_at: newExpires });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Erro ao assinar Zher Read:", e);
        res.status(500).json({ error: 'Erro ao processar assinatura.' });
    } finally {
        client.release();
    }
});

// Assinar Zher Read via MercadoPago
app.post('/api/reading/subscribe/checkout', requireAuth, async (req, res) => {
    const { method, cpf } = req.body;
    const price = 4.99;
    
    try {
        const orderRes = await pool.query(
            'INSERT INTO orders (user_id, status, total_amount, is_deposit, is_reading_subscription) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [req.session.userId, 'pending', price, false, true]
        );
        const orderId = orderRes.rows[0].id;
        
        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        const email = userRes.rows[0]?.email || 'guest@example.com';
        
        if (method === 'pix') {
            const paymentClient = new Payment(mpClient);
            const createdPayment = await paymentClient.create({
                body: {
                    transaction_amount: price,
                    description: `Assinatura Mensal Zher Read - Pedido #${orderId}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: email,
                        first_name: 'Cliente',
                        last_name: 'ZherRead',
                        identification: {
                            type: 'CPF',
                            number: cpf ? cpf.replace(/\D/g, '') : generateCPF()
                        }
                    },
                    external_reference: orderId.toString(),
                    notification_url: `${APP_URL}/webhook`
                },
                requestOptions: {
                    idempotencyKey: crypto.randomUUID()
                }
            });
            
            const qrCodeBase64 = createdPayment.point_of_interaction.transaction_data.qr_code_base64;
            const qrCode = createdPayment.point_of_interaction.transaction_data.qr_code;
            
            await pool.query(
                'UPDATE orders SET mp_payment_id = $1, pix_qr_code = $2, pix_qr_code_base64 = $3 WHERE id = $4',
                [createdPayment.id.toString(), qrCode, qrCodeBase64, orderId]
            );
            
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type, order_id) VALUES ($1, $2, $3, $4, $5)',
                [req.session.userId, 'Assinatura Read Pendente', `Sua assinatura Zher Read está aguardando pagamento.`, 'warning', orderId]
            );
            
            return res.json({ qr_code_base64: qrCodeBase64, qr_code: qrCode, orderId });
        }
        
        if (method === 'card') {
            const preference = new Preference(mpClient);
            const createdPref = await preference.create({
                body: {
                    items: [{
                        id: `read-sub-${orderId}`,
                        title: `Assinatura Mensal Zher Read`,
                        unit_price: price,
                        quantity: 1,
                        currency_id: 'BRL'
                    }],
                    external_reference: orderId.toString(),
                    back_urls: {
                        success: `${APP_URL}/reading.html?status=success`,
                        failure: `${APP_URL}/reading.html?status=failure`,
                        pending: `${APP_URL}/reading.html?status=pending`
                    },
                    auto_return: 'approved',
                    notification_url: `${APP_URL}/webhook`
                }
            });
            
            await pool.query('UPDATE orders SET mp_preference_id = $1 WHERE id = $2', [createdPref.id, orderId]);
            return res.json({ init_point: createdPref.init_point, orderId });
        }
        
        res.status(400).json({ error: 'Método inválido.' });
    } catch (e) {
        console.error("Erro ao gerar checkout de Zher Read:", e);
        res.status(500).json({ error: 'Erro ao gerar pagamento.' });
    }
});

// Catálogo de Livros, Ebooks e Mangás (Apenas assinantes Zher Read)
app.get('/api/reading/catalog', requireAuth, requireReadingSubscription, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reading_media ORDER BY id DESC');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar catálogo de leitura.' });
    }
});

// Detalhes da Mídia de Leitura e Capítulos
app.get('/api/reading/media/:id', requireAuth, requireReadingSubscription, async (req, res) => {
    const mediaId = parseInt(req.params.id);
    try {
        const mediaRes = await pool.query('SELECT * FROM reading_media WHERE id = $1', [mediaId]);
        if (mediaRes.rows.length === 0) {
            return res.status(404).json({ error: 'Livro/Mangá não encontrado.' });
        }
        
        const media = mediaRes.rows[0];
        const chaptersRes = await pool.query('SELECT id, chapter_number, title, pdf_url, pages FROM reading_chapters WHERE media_id = $1 ORDER BY chapter_number ASC', [mediaId]);
        media.chapters = chaptersRes.rows;
        
        res.json(media);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar conteúdo de leitura.' });
    }
});

// Obter páginas de um Capítulo específico
app.get('/api/reading/chapter/:id', requireAuth, requireReadingSubscription, async (req, res) => {
    const chapterId = parseInt(req.params.id);
    try {
        const result = await pool.query(
            'SELECT c.*, m.title as media_title, m.type as media_type FROM reading_chapters c JOIN reading_media m ON c.media_id = m.id WHERE c.id = $1',
            [chapterId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Capítulo não encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar capítulo.' });
    }
});

// ==========================================
// PAINEL ADMINISTRATIVO DO ZHER READ (UPLOADS)
// ==========================================

// Adicionar Livro/Mangá
app.post('/api/admin/reading/media', requireAdmin, async (req, res) => {
    const { title, description, type, category, thumbnail } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO reading_media (title, description, type, category, thumbnail) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [title, description, type, category, thumbnail]
        );
        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao adicionar mídia de leitura.' });
    }
});

// Editar Livro/Mangá
app.put('/api/admin/reading/media/:id', requireAdmin, async (req, res) => {
    const { title, description, type, category, thumbnail } = req.body;
    const mediaId = parseInt(req.params.id);
    try {
        await pool.query(
            'UPDATE reading_media SET title = $1, description = $2, type = $3, category = $4, thumbnail = $5 WHERE id = $6',
            [title, description, type, category, thumbnail, mediaId]
        );
        res.json({ success: true, message: 'Leitura atualizada!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao atualizar.' });
    }
});

// Excluir Livro/Mangá
app.delete('/api/admin/reading/media/:id', requireAdmin, async (req, res) => {
    const mediaId = parseInt(req.params.id);
    try {
        await pool.query('DELETE FROM reading_media WHERE id = $1', [mediaId]);
        res.json({ success: true, message: 'Leitura excluída com sucesso.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao excluir.' });
    }
});

// Adicionar Capítulo (Upload de PDF ou lote de imagens de Mangá)
app.post('/api/admin/reading/chapter', requireAdmin, async (req, res) => {
    const { media_id, chapter_number, title, pdf_url, pages } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO reading_chapters (media_id, chapter_number, title, pdf_url, pages) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [parseInt(media_id), parseInt(chapter_number), title, pdf_url || '', pages || '[]']
        );
        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao adicionar capítulo.' });
    }
});

// Excluir Capítulo
app.delete('/api/admin/reading/chapter/:id', requireAdmin, async (req, res) => {
    const chapterId = parseInt(req.params.id);
    try {
        await pool.query('DELETE FROM reading_chapters WHERE id = $1', [chapterId]);
        res.json({ success: true, message: 'Capítulo excluído.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao excluir capítulo.' });
    }
});

// Multi uploader para Mangá Pages
app.post('/api/admin/reading/upload-pages', requireAdmin, uploadGeneric.array('files', 150), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    
    const urls = [];
    const destDir = path.join(__dirname, 'public', 'uploads', 'mangas');
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    req.files.forEach(file => {
        const newPath = path.join(destDir, file.filename);
        fs.renameSync(file.path, newPath);
        urls.push(`/uploads/mangas/${file.filename}`);
    });
    
    res.json({ urls });
});

// Catch-all 404 handler for any other unmatched routes
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 ZHER KEYS SECURE SERVER INICIADO!`);
    console.log(`🌐 Porta: ${port}`);
});
