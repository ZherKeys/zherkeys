const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
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

// Setup Database
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) console.error('Database opening error: ', err);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password_hash TEXT,
        is_verified INTEGER DEFAULT 0,
        verification_token TEXT
    )`);
    // Adiciona colunas para reset de senha (ignora erro se já existirem)
    db.run(`ALTER TABLE users ADD COLUMN reset_token TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN reset_expires INTEGER`, () => {});
});

// Setup Nodemailer (Gmail Real Account)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'zherkeys@gmail.com',
        pass: 'calsnxdgdzhvpgaw' // App Password (sem espaços)
    }
});
console.log('Nodemailer configurado com Gmail: zherkeys@gmail.com');

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

    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
        if (row) {
            return res.status(400).json({ error: 'E-mail já cadastrado.' });
        }
        
        try {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            const token = crypto.randomBytes(20).toString('hex');
            
            db.run('INSERT INTO users (email, password_hash, verification_token) VALUES (?, ?, ?)', [email, hash, token], function(err) {
                if (err) return res.status(500).json({ error: 'Erro no banco de dados' });
                const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
                
                const message = {
                    from: '"ZHER KEYS" <noreply@zherkeys.com>',
                    to: email,
                    subject: 'Verifique seu e-mail na ZHER KEYS',
                    text: `Por favor, clique no link para verificar seu e-mail: ${verifyUrl}`,
                    html: `<div style="background:#020617;color:white;padding:20px;font-family:sans-serif;text-align:center;">
                            <h2>ZHER KEYS SECURE SYSTEM</h2>
                            <p>Confirme sua credencial de acesso clicando no link abaixo:</p>
                            <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;">VERIFICAR ACESSO</a>
                           </div>`
                };
                
                transporter.sendMail(message, (err, info) => {
                    if (err) {
                        console.log('Error occurred. ' + err.message);
                        return res.status(500).json({ error: 'Erro ao enviar e-mail.' });
                    }
                    console.log('\n======================================================');
                    console.log('✅ E-MAIL DE VERIFICAÇÃO ENVIADO PARA: ' + email);
                    console.log('======================================================\n');
                    
                    res.status(200).json({ message: 'verify your email, confery your spam too' });
                });
            });
        } catch(e) {
            res.status(500).json({ error: 'Erro no servidor' });
        }
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    if(!email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (!user) return res.status(400).json({ error: 'Credenciais inválidas.' });
        
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: 'Credenciais inválidas.' });
        
        if (!user.is_verified) return res.status(400).json({ error: 'Sua conta não está ativada. Verifique o e-mail.' });
        
        req.session.userId = user.id;
        res.status(200).json({ message: 'Acesso concedido.', redirect: '/' });
    });
});

app.post('/resend-verification', (req, res) => {
    const { email } = req.body;
    if(!email) return res.status(400).json({ error: 'Informe o e-mail.' });

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (!user) return res.status(400).json({ error: 'Usuário não encontrado.' });
        if (user.is_verified) return res.status(400).json({ error: 'Esta conta já está verificada.' });
        
        const token = require('crypto').randomBytes(20).toString('hex');
        db.run('UPDATE users SET verification_token = ? WHERE email = ?', [token, email], function(err) {
            if (err) return res.status(500).json({ error: 'Erro no banco de dados.' });
            const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
            
            const message = {
                from: '"ZHER KEYS" <noreply@zherkeys.com>',
                to: email,
                subject: 'Reenvio: Verifique seu e-mail na ZHER KEYS',
                text: `Por favor, clique no link para verificar seu e-mail: ${verifyUrl}`,
                html: `<div style="background:#020617;color:white;padding:20px;font-family:sans-serif;text-align:center;">
                        <h2>ZHER KEYS SECURE SYSTEM</h2>
                        <p>Confirme sua credencial de acesso clicando no link abaixo:</p>
                        <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:5px;">VERIFICAR ACESSO</a>
                       </div>`
            };
            
            transporter.sendMail(message, (err, info) => {
                if (err) return res.status(500).json({ error: 'Erro ao reenviar e-mail.' });
                res.status(200).json({ message: 'E-mail de verificação reenviado com sucesso!' });
            });
        });
    });
});

app.get('/verify-email', (req, res) => {
    const { token } = req.query;
    db.run('UPDATE users SET is_verified = 1 WHERE verification_token = ?', [token], function(err) {
        if (err) return res.status(500).send('Erro interno.');
        if (this.changes === 0) return res.status(400).send('<h1>Token inválido ou já verificado.</h1>');
        
        res.send(`
            <body style="background:#020617;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center;background:#0f172a;padding:40px;border-radius:10px;border:1px solid #3B82F6;box-shadow:0 0 20px rgba(59,130,246,0.3);">
                    <h1 style="color:#3B82F6;">ACESSO VERIFICADO</h1>
                    <p>Sua credencial foi ativada com sucesso.</p>
                    <a href="/login.html" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#F43F5E;color:white;text-decoration:none;border-radius:5px;font-weight:bold;">IR PARA O TERMINAL DE LOGIN</a>
                </div>
            </body>
        `);
    });
});

app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if(!email) return res.status(400).json({ error: 'Informe o e-mail.' });
    
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (!user) return res.status(400).json({ error: 'Usuário não encontrado.' });
        
        const token = require('crypto').randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; // 1 hora
        
        db.run('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', [token, expires, user.id], function(err) {
            if (err) return res.status(500).json({ error: 'Erro no banco.' });
            const resetUrl = `${APP_URL}/reset-password.html?token=${token}`;
            
            const message = {
                from: '"ZHER KEYS" <noreply@zherkeys.com>',
                to: email,
                subject: 'Redefinição de Senha - ZHER KEYS',
                html: `<div style="background:#020617;color:white;padding:20px;font-family:sans-serif;text-align:center;">
                        <h2>REDEFINIÇÃO DE CREDENCIAL</h2>
                        <p>Você solicitou a troca da sua senha.</p>
                        <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#F43F5E;color:white;text-decoration:none;border-radius:5px;">CRIAR NOVA SENHA</a>
                       </div>`
            };
            
            transporter.sendMail(message, (err) => {
                if (err) return res.status(500).json({ error: 'Erro ao enviar e-mail.' });
                res.status(200).json({ message: 'E-mail de redefinição enviado! Verifique sua caixa de entrada.' });
            });
        });
    });
});

app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if(!token || !newPassword) return res.status(400).json({ error: 'Dados incompletos.' });
    
    db.get('SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?', [token, Date.now()], async (err, user) => {
        if (!user) return res.status(400).json({ error: 'Token inválido ou expirado.' });
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        
        db.run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?', [hash, user.id], function(err) {
            if (err) return res.status(500).json({ error: 'Erro no banco.' });
            res.status(200).json({ message: 'Senha alterada com sucesso! Faça login.' });
        });
    });
});

app.get('/api/me', requireAuth, (req, res) => {
    db.get('SELECT email FROM users WHERE id = ?', [req.session.userId], (err, row) => {
        if (row) {
            res.json({ email: row.email });
        } else {
            res.status(401).json({ error: 'Não autorizado' });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 ZHER KEYS SECURE SERVER INICIADO!`);
    console.log(`🌐 Acesse o site localmente em: http://localhost:${port}`);
});
