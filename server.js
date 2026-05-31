require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const speakeasy = require('speakeasy');

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
            
            ALTER TABLE products ADD COLUMN IF NOT EXISTS activation_key TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT true;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS restricted_countries TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS genres TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price NUMERIC(10, 2);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS gameflip_listing_id TEXT;
            
            ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) DEFAULT 0.00;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_id TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deposit BOOLEAN DEFAULT false;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_qr_code TEXT;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT;
            
            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                amount NUMERIC(10, 2) NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
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
        `);

        // Popular gêneros antigos automaticamente
        pool.query("UPDATE products SET genres = 'Multiplayer, Ação, FPS' WHERE (title ILIKE '%CS:GO%' OR title ILIKE '%Counter%' OR title ILIKE '%Valorant%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Aventura, RPG, Ação' WHERE (title ILIKE '%Elden Ring%' OR title ILIKE '%Witcher%' OR title ILIKE '%Cyberpunk%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Ação, Aventura, Sandbox' WHERE (title ILIKE '%GTA%' OR title ILIKE '%Red Dead%' OR title ILIKE '%Minecraft%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Esportes, Multiplayer' WHERE (title ILIKE '%FIFA%' OR title ILIKE '%FC 24%' OR title ILIKE '%NBA%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Terror, Sobrevivência' WHERE (title ILIKE '%Resident Evil%' OR title ILIKE '%Silent Hill%') AND genres IS NULL").catch(()=>{});
        pool.query("UPDATE products SET genres = 'Streaming' WHERE (category = 'GIFT CARD' OR title ILIKE '%Netflix%' OR title ILIKE '%Spotify%') AND genres IS NULL").catch(()=>{});

        // Popular produtos iniciais se estiver vazio
        const checkProducts = await pool.query('SELECT COUNT(*) FROM products');
        if (parseInt(checkProducts.rows[0].count) === 0) {
            const defaultProducts = [
                {
                    title: "Human: Fall Flat",
                    price: 7.79,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/477160/header.jpg",
                    description: "Human: Fall Flat é um jogo hilário e leve de plataforma baseado em física, ambientado em paisagens flutuantes e oníricas que podem ser jogadas solo ou com até 8 amigos online. Ativação via Steam.",
                    category: "STEAM KEY",
                    activation_key: "ABCD-1234-EFGH-5678"
                },
                {
                    title: "Batman: Arkham Origins",
                    price: 8.09,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/209000/header.jpg",
                    description: "Batman: Arkham Origins apresenta uma Gotham City expandida e uma história original prequela ambientada vários anos antes dos eventos de Batman: Arkham Asylum e Batman: Arkham City.",
                    category: "STEAM KEY",
                    activation_key: "WXYZ-9876-QWER-TYUI"
                },
                {
                    title: "LEGO The Incredibles",
                    price: 7.50,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/818320/header.jpg",
                    description: "Experimente as aventuras emocionantes da família Pera e use seus superpoderes para derrotar o crime e reviver momentos memoráveis dos filmes Os Incríveis e Os Incríveis 2 no mundo LEGO.",
                    category: "STEAM KEY",
                    activation_key: "LKJH-GFDS-MNBV-CXZA"
                },
                {
                    title: "LEGO DC Super-Villains Deluxe",
                    price: 12.01,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/829110/header.jpg",
                    description: "É bom ser mau... Embarque em uma nova aventura da DC/LEGO tornando-se o melhor vilão que o universo já viu. A Deluxe Edition inclui conteúdo extra e DLCs exclusivos.",
                    category: "STEAM KEY",
                    activation_key: "POIU-YTRE-WQAS-DFGH"
                },
                {
                    title: "Middle-earth: Shadow of War Definitive",
                    price: 15.28,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/356190/header.jpg",
                    description: "Experimente um mundo épico aberto trazido à vida pelo Sistema Nêmesis premiado. Forje um novo Anel do Poder, conquiste Fortalezas e domine Mordor com seu próprio exército de orcs nesta Edição Definitiva completa.",
                    category: "STEAM KEY",
                    activation_key: "MKOI-JNBH-UYGV-CFTX"
                },
                {
                    title: "The LEGO Movie Videogame",
                    price: 5.28,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/267530/header.jpg",
                    description: "Junte-se a Emmet e um grupo improvável de rebeldes em sua busca heroica para impedir o plano maligno do Senhor Negócios. Construa com peças de LEGO nesta incrível aventura em formato de jogo.",
                    category: "STEAM KEY",
                    activation_key: "ZZZZ-XXXX-CCCC-VVVV"
                }
            ];
            
            for (let p of defaultProducts) {
                await pool.query('INSERT INTO products (title, description, price, image, category, activation_key) VALUES ($1, $2, $3, $4, $5, $6)', [p.title, p.description, p.price, p.image, p.category, p.activation_key]);
            }
            console.log('✅ Produtos iniciais transferidos para o Banco de Dados.');
        }
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

// Middlewares
const requireAuth = (req, res, next) => {
    if (req.session.userId) next();
    else res.redirect('/login.html');
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
        const result = await pool.query('SELECT id, title, description, price, old_price, image, category, in_stock, is_global, restricted_countries, genres FROM products ORDER BY id ASC');
        productsCache = result.rows;
        productsCacheTime = now;
        res.json(productsCache);
    } catch(e) {
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

// Criar produto (Admin)
app.post('/api/admin/products', requireAdmin, async (req, res) => {
    const { title, description, price, old_price, image, category, activation_key, is_global, restricted_countries, genres, gameflip_listing_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO products (title, description, price, old_price, image, category, activation_key, is_global, restricted_countries, genres, gameflip_listing_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [title, description, parseFloat(price), old_price ? parseFloat(old_price) : null, image, category, activation_key || '', is_global === false ? false : true, restricted_countries || '', genres || '', gameflip_listing_id || '']
        );
        productsCache = null; // Limpa o cache para atualizar a home imediatamente
        res.status(201).json({ message: 'Produto adicionado' });
    } catch(e) {
        console.error("Erro ao adicionar produto:", e);
        res.status(500).json({ error: 'Erro ao adicionar' });
    }
});

// Editar produto (Admin)
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, price, old_price, image, category, activation_key, is_global, restricted_countries, genres, gameflip_listing_id } = req.body;
    try {
        await pool.query(
            'UPDATE products SET title=$1, description=$2, price=$3, old_price=$4, image=$5, category=$6, activation_key=$7, in_stock=true, is_global=$8, restricted_countries=$9, genres=$10, gameflip_listing_id=$11 WHERE id=$12',
            [title, description, parseFloat(price), old_price ? parseFloat(old_price) : null, image, category, activation_key || '', is_global === false ? false : true, restricted_countries || '', genres || '', gameflip_listing_id || '', id]
        );
        productsCache = null; // Limpa o cache para atualizar a home imediatamente
        res.json({ message: 'Produto atualizado e retornado ao estoque' });
    } catch(e) {
        console.error("Erro ao atualizar produto:", e);
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

// Deletar produto (Admin)
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
        productsCache = null; // Limpa o cache para atualizar a home imediatamente
        res.json({ message: 'Produto deletado' });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao deletar' });
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
    const { items, method } = req.body; // array of { id, quantity }, method = 'credits'
    
    if(!items || items.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });
    
    if (method !== 'credits') {
        return res.status(400).json({ error: 'Este site permite compras apenas utilizando créditos da carteira.' });
    }
    
    try {
        const ids = items.map(i => parseInt(i.id));
        const result = await pool.query('SELECT * FROM products WHERE id = ANY($1::int[])', [ids]);
        
        const realProducts = result.rows;
        if(realProducts.length === 0) return res.status(400).json({ error: 'Produtos não encontrados' });
        
        // Verifica se algum produto está fora de estoque
        const outOfStock = realProducts.find(p => !p.in_stock);
        if (outOfStock) {
            return res.status(400).json({ error: `O produto "${outOfStock.title}" já está esgotado.` });
        }
        
        let totalAmount = 0;
        const preferenceItems = [];
        
        items.forEach(cartItem => {
            const dbProduct = realProducts.find(p => p.id === parseInt(cartItem.id));
            if(dbProduct) {
                const qty = Math.max(1, parseInt(cartItem.quantity)); // Segurança: garante quantidade positiva >= 1
                totalAmount += parseFloat(dbProduct.price) * qty;
                preferenceItems.push({
                    id: dbProduct.id.toString(),
                    title: dbProduct.title,
                    unit_price: parseFloat(dbProduct.price),
                    quantity: qty,
                    currency_id: 'BRL',
                    picture_url: dbProduct.image
                });
            }
        });
        
        if(preferenceItems.length === 0) return res.status(400).json({ error: 'Erro nos itens do carrinho' });
        
        // Criar o pedido PENDENTE no banco para gerar ID
        const orderRes = await pool.query(
            'INSERT INTO orders (user_id, status, total_amount) VALUES ($1, $2, $3) RETURNING id',
            [req.session.userId, 'pending', totalAmount]
        );
        const orderId = orderRes.rows[0].id;
        
        // Salvar os itens do pedido
        for (let item of items) {
            const dbProduct = realProducts.find(p => p.id === parseInt(item.id));
            if(dbProduct) {
                const qty = Math.max(1, parseInt(item.quantity));
                await pool.query(
                    'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                    [orderId, dbProduct.id, qty, parseFloat(dbProduct.price)]
                );
            }
        }

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
            
            // FOR UPDATE bloqueia a linha do usuário, evitando RACE CONDITIONS / DOUBLE-SPENDING de créditos!
            const userRes = await client.query('SELECT balance, email FROM users WHERE id = $1 FOR UPDATE', [req.session.userId]);
            const balance = parseFloat(userRes.rows[0]?.balance || 0);
            const email = userRes.rows[0]?.email || 'guest@example.com';
            
            if (balance < totalAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
            }
            
            // Deduz o saldo
            const newBalance = balance - totalAmount;
            await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, req.session.userId]);
            
            // Registra a transação no extrato da carteira
            await client.query(
                'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                [req.session.userId, -totalAmount, 'purchase', `Compra do Pedido #${orderId}`]
            );
            
            // Aprova o pedido imediatamente no banco
            await client.query("UPDATE orders SET status = 'approved' WHERE id = $1", [orderId]);
            
            // Atualiza o estoque local do produto (marca como fora de estoque)
            await client.query('UPDATE products SET in_stock = false WHERE id = ANY($1::int[])', [ids]);
            
            // Delistar anúncio correspondente no Gameflip
            const productsRes = await client.query('SELECT gameflip_listing_id FROM products WHERE id = ANY($1::int[])', [ids]);
            for (let prod of productsRes.rows) {
                if (prod.gameflip_listing_id && prod.gameflip_listing_id.trim() !== '') {
                    markGameflipListingAsSold(prod.gameflip_listing_id.trim());
                }
            }
            
            await client.query('COMMIT');
            
            // Envia e-mail de confirmação da compra aprovada contendo as chaves (Keys) reveladas!
            const keysRes = await pool.query('SELECT title, activation_key FROM products WHERE id = ANY($1::int[])', [ids]);
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
                const qty = Math.max(1, parseInt(cartItem.quantity));
                totalAmount += parseFloat(dbProduct.price) * qty;
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
                    const qty = Math.max(1, parseInt(item.quantity));
                    await client.query(
                        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                        [orderId, dbProduct.id, qty, parseFloat(dbProduct.price)]
                    );
                }
            }
            
            // Atualiza o estoque local do produto (marca como fora de estoque)
            await client.query('UPDATE products SET in_stock = false WHERE id = ANY($1::int[])', [ids]);
            
            // Delistar anúncio correspondente no Gameflip
            const productsRes = await client.query('SELECT gameflip_listing_id FROM products WHERE id = ANY($1::int[])', [ids]);
            for (let prod of productsRes.rows) {
                if (prod.gameflip_listing_id && prod.gameflip_listing_id.trim() !== '') {
                    markGameflipListingAsSold(prod.gameflip_listing_id.trim());
                }
            }
            
            await client.query('COMMIT');
            
            // Envia e-mail de confirmação da compra aprovada contendo as chaves (Keys) reveladas!
            const keysRes = await pool.query('SELECT title, activation_key FROM products WHERE id = ANY($1::int[])', [ids]);
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
        
        // 2. Atualiza o status do pedido para approved
        await client.query(
            'UPDATE orders SET status = $1, mp_payment_id = $2 WHERE id = $3',
            ['approved', paymentId ? paymentId.toString() : order.mp_payment_id, orderId]
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
        } else {
            // 4. Se for COMPRA DE PRODUTO, atualiza estoque e delista no Gameflip
            const items = await client.query('SELECT product_id FROM order_items WHERE order_id = $1', [orderId]);
            const pIds = items.rows.map(r => r.product_id);
            if (pIds.length > 0) {
                // Bloqueia e marca como fora de estoque
                await client.query('UPDATE products SET in_stock = false WHERE id = ANY($1::int[])', [pIds]);
                
                // Delistar no Gameflip
                const productsRes = await client.query('SELECT gameflip_listing_id FROM products WHERE id = ANY($1::int[])', [pIds]);
                for (let prod of productsRes.rows) {
                    if (prod.gameflip_listing_id && prod.gameflip_listing_id.trim() !== '') {
                        markGameflipListingAsSold(prod.gameflip_listing_id.trim());
                    }
                }
            }
            
            // Envia e-mail de confirmação da compra aprovada contendo as chaves (Keys) reveladas!
            const emailRes = await client.query('SELECT email FROM users WHERE id = $1', [order.user_id]);
            const email = emailRes.rows[0]?.email;
            if (email) {
                const keysRes = await client.query('SELECT title, activation_key FROM products WHERE id = ANY($1::int[])', [pIds]);
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
        // Cancelar pedidos pendentes com mais de 10 minutos
        await pool.query("UPDATE orders SET status = 'cancelled' WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes'");

        const ordersRes = await pool.query("SELECT * FROM orders WHERE user_id = $1 AND status != 'cancelled' ORDER BY id DESC", [req.session.userId]);
        const orders = ordersRes.rows;
        
        for (let order of orders) {
            const itemsRes = await pool.query(`
                SELECT oi.quantity, oi.price, p.title, p.image, p.category, 
                CASE WHEN $1 = 'approved' THEN p.activation_key ELSE NULL END as activation_key
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
                SELECT oi.quantity, oi.price, p.title
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
        await pool.query('DELETE FROM order_chats WHERE order_id = $1', [req.params.id]);
        await pool.query('DELETE FROM order_items WHERE order_id = $1', [req.params.id]);
        await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
        res.json({ message: 'Pedido excluído' });
    } catch(e) {
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

app.use(express.static(path.join(__dirname, 'public')));

// Retorna a chave do site anti-robô para o front-end (configurável no .env)
app.get('/api/config/turnstile', (req, res) => {
    res.json({ sitekey: process.env.CLOUDFLARE_TURNSTILE_SITEKEY || '1x00000000000000000000AA' });
});

app.post('/register', async (req, res) => {
    const { email, password, turnstileToken } = req.body;
    
    if(!email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

    // Validar Cloudflare Turnstile anti-robô
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

// ========================
// SUPORTE CHAT GLOBAL
// ========================

app.get('/api/support', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM support_chats WHERE user_id=$1 ORDER BY id ASC', [req.session.userId]);
        res.json(result.rows);
    } catch(e) {
        res.status(500).json({ error: 'Erro ao buscar chat' });
    }
});

app.post('/api/support', requireAuth, async (req, res) => {
    const { message } = req.body;
    if(!message) return res.status(400).json({ error: 'Mensagem vazia' });
    try {
        await pool.query('INSERT INTO support_chats (user_id, sender_type, message) VALUES ($1, $2, $3)', [req.session.userId, 'user', message]);
        res.status(201).json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

app.get('/api/admin/support', requireAdmin, async (req, res) => {
    try {
        const usersRes = await pool.query(`
            SELECT DISTINCT u.id as user_id, u.email 
            FROM support_chats s
            JOIN users u ON u.id = s.user_id
        `);
        const result = [];
        for (const u of usersRes.rows) {
            const chatRes = await pool.query('SELECT * FROM support_chats WHERE user_id=$1 ORDER BY id ASC', [u.user_id]);
            result.push({
                user_id: u.user_id,
                email: u.email,
                chat: chatRes.rows
            });
        }
        res.json(result);
    } catch(e) {
        res.status(500).json({ error: 'Erro ao buscar suportes' });
    }
});

app.post('/api/admin/support/:userId', requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const { message } = req.body;
    if(!message) return res.status(400).json({ error: 'Mensagem vazia' });
    try {
        await pool.query('INSERT INTO support_chats (user_id, sender_type, message) VALUES ($1, $2, $3)', [userId, 'admin', message]);
        res.status(201).json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

app.get('/api/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT email, balance FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0) {
            res.json({ 
                email: result.rows[0].email, 
                balance: parseFloat(result.rows[0].balance || 0),
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
    const redirectUri = `${APP_URL}/auth/google/callback`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile`;
    res.redirect(googleAuthUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/login.html');

    const redirectUri = `${APP_URL}/auth/google/callback`;

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
        if (!tokenData.access_token) throw new Error("Não foi possível obter o token de acesso do Google.");

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

// Start Server
app.listen(port, () => {
    console.log(`🚀 ZHER KEYS SECURE SERVER INICIADO!`);
    console.log(`🌐 Porta: ${port}`);
});
