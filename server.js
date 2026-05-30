const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || ('http://localhost:' + port);

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

pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        reset_token TEXT,
        reset_expires BIGINT
    );
`).catch(err => console.error('Error creating table:', err));

// Setup Brevo API Key
const BREVO_API_KEY = process.env.BREVO_API_KEY;

async function sendEmailViaBrevo(toEmail, subject, textContent, htmlContent) {
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

// Auth Middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login.html');
    }
};

// Serve specific static files that require Auth first
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

// Serve other static files (css, js, login.html) without auth
app.use(express.static(path.join(__dirname, 'public')));

// Routes
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
        res.status(200).json({ message: 'Acesso concedido.', redirect: '/' });
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
            res.json({ email: result.rows[0].email });
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
