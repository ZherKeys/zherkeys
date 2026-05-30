const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const port = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || ('http://localhost:' + port);

// Setup MercadoPago
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-12345' });

// Setup Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
        `);

        // Popular produtos iniciais se estiver vazio
        const checkProducts = await pool.query('SELECT COUNT(*) FROM products');
        if (parseInt(checkProducts.rows[0].count) === 0) {
            const defaultProducts = [
                {
                    title: "Human: Fall Flat",
                    price: 7.79,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/477160/header.jpg",
                    description: "Human: Fall Flat é um jogo hilário e leve de plataforma baseado em física, ambientado em paisagens flutuantes e oníricas que podem ser jogadas solo ou com até 8 amigos online. Ativação via Steam.",
                    category: "STEAM KEY"
                },
                {
                    title: "Batman: Arkham Origins",
                    price: 8.09,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/209000/header.jpg",
                    description: "Batman: Arkham Origins apresenta uma Gotham City expandida e uma história original prequela ambientada vários anos antes dos eventos de Batman: Arkham Asylum e Batman: Arkham City.",
                    category: "STEAM KEY"
                },
                {
                    title: "LEGO The Incredibles",
                    price: 7.50,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/818320/header.jpg",
                    description: "Experimente as aventuras emocionantes da família Pera e use seus superpoderes para derrotar o crime e reviver momentos memoráveis dos filmes Os Incríveis e Os Incríveis 2 no mundo LEGO.",
                    category: "STEAM KEY"
                },
                {
                    title: "LEGO DC Super-Villains Deluxe",
                    price: 12.01,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/829110/header.jpg",
                    description: "É bom ser mau... Embarque em uma nova aventura da DC/LEGO tornando-se o melhor vilão que o universo já viu. A Deluxe Edition inclui conteúdo extra e DLCs exclusivos.",
                    category: "STEAM KEY"
                },
                {
                    title: "Middle-earth: Shadow of War Definitive",
                    price: 15.28,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/356190/header.jpg",
                    description: "Experimente um mundo épico aberto trazido à vida pelo Sistema Nêmesis premiado. Forje um novo Anel do Poder, conquiste Fortalezas e domine Mordor com seu próprio exército de orcs nesta Edição Definitiva completa.",
                    category: "STEAM KEY"
                },
                {
                    title: "The LEGO Movie Videogame",
                    price: 5.28,
                    image: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/267530/header.jpg",
                    description: "Junte-se a Emmet e um grupo improvável de rebeldes em sua busca heroica para impedir o plano maligno do Senhor Negócios. Construa com peças de LEGO nesta incrível aventura em formato de jogo.",
                    category: "STEAM KEY"
                }
            ];
            
            for (let p of defaultProducts) {
                await pool.query('INSERT INTO products (title, description, price, image, category) VALUES ($1, $2, $3, $4, $5)', [p.title, p.description, p.price, p.image, p.category]);
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

// Listar produtos (Público)
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
        res.json(result.rows);
    } catch(e) {
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// Criar produto (Admin)
app.post('/api/admin/products', requireAdmin, async (req, res) => {
    const { title, description, price, image, category } = req.body;
    try {
        await pool.query(
            'INSERT INTO products (title, description, price, image, category) VALUES ($1, $2, $3, $4, $5)',
            [title, description, parseFloat(price), image, category]
        );
        res.status(201).json({ message: 'Produto adicionado' });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao adicionar' });
    }
});

// Editar produto (Admin)
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, price, image, category } = req.body;
    try {
        await pool.query(
            'UPDATE products SET title=$1, description=$2, price=$3, image=$4, category=$5 WHERE id=$6',
            [title, description, parseFloat(price), image, category, id]
        );
        res.json({ message: 'Produto atualizado' });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

// Deletar produto (Admin)
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
        res.json({ message: 'Produto deletado' });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao deletar' });
    }
});

// ========================
// CHECKOUT & MERCADOPAGO
// ========================

app.post('/create-checkout', requireAuth, async (req, res) => {
    const { items } = req.body; // array of { id, quantity }
    
    if(!items || items.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });
    
    try {
        // Consultar banco para obter os preços REAIS para evitar fraudes
        const ids = items.map(i => parseInt(i.id));
        const result = await pool.query('SELECT * FROM products WHERE id = ANY($1::int[])', [ids]);
        
        const realProducts = result.rows;
        if(realProducts.length === 0) return res.status(400).json({ error: 'Produtos não encontrados' });
        
        let totalAmount = 0;
        const preferenceItems = [];
        
        items.forEach(cartItem => {
            const dbProduct = realProducts.find(p => p.id === parseInt(cartItem.id));
            if(dbProduct) {
                totalAmount += parseFloat(dbProduct.price) * cartItem.quantity;
                preferenceItems.push({
                    id: dbProduct.id.toString(),
                    title: dbProduct.title,
                    unit_price: parseFloat(dbProduct.price),
                    quantity: cartItem.quantity,
                    currency_id: 'BRL',
                    picture_url: dbProduct.image
                });
            }
        });
        
        if(preferenceItems.length === 0) return res.status(400).json({ error: 'Erro nos itens do carrinho' });
        
        // Criar Preferência no MercadoPago
        const preference = new Preference(mpClient);
        const createdPref = await preference.create({
            body: {
                items: preferenceItems,
                back_urls: {
                    success: `${APP_URL}/carrinho.html?status=success`,
                    failure: `${APP_URL}/carrinho.html?status=failure`,
                    pending: `${APP_URL}/carrinho.html?status=pending`
                },
                auto_return: 'approved',
                notification_url: `${APP_URL}/webhook`
            }
        });
        
        // Salvar pedido pendente no banco
        await pool.query(
            'INSERT INTO orders (user_id, mp_preference_id, total_amount) VALUES ($1, $2, $3)',
            [req.session.userId, createdPref.id, totalAmount]
        );
        
        // Retornar a URL de pagamento
        res.json({ init_point: createdPref.init_point });
        
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao gerar checkout' });
    }
});

app.post('/webhook', async (req, res) => {
    const { topic, id } = req.query;
    if (topic === 'payment' || req.query.type === 'payment') {
        try {
            console.log(`[WEBHOOK] Pagamento recebido! ID: ${id}`);
        } catch(e) {
            console.error('Erro no webhook:', e);
        }
    }
    res.status(200).send('OK');
});

// ========================
// FRONTEND ROUTES & AUTH
// ========================

app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/account.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'account.html'));
});
app.get('/carrinho.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'carrinho.html'));
});

// Admin Route Protected
app.get('/admin.html', requireAuth, async (req, res, next) => {
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

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    
    if(!email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

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
        
        console.log('\n======================================================');
        console.log('✅ E-MAIL DE VERIFICAÇÃO ENVIADO VIA BREVO PARA: ' + email);
        console.log('======================================================\n');
        
        res.status(200).json({ message: 'verify your email, confery your spam too' });
        
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if(!email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

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

app.get('/api/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length > 0) {
            res.json({ email: result.rows[0].email, isAdmin: result.rows[0].email === 'zherkeys@gmail.com' });
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
    res.redirect('/login.html');
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 ZHER KEYS SECURE SERVER INICIADO!`);
    console.log(`🌐 Porta: ${port}`);
});
