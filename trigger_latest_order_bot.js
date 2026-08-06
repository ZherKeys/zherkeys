require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: 'localhost', port: 5432, user: 'postgres', database: 'zherkeys' };

const pool = new Pool(poolConfig);

async function checkLatestOrder() {
    try {
        console.log("🔍 Buscando o último pedido no banco de dados...");
        const res = await pool.query('SELECT id, user_id, status, total_amount, created_at FROM orders ORDER BY id DESC LIMIT 5');
        console.log("Últimos pedidos encontrados no banco:", res.rows);

        if (res.rows.length > 0) {
            const latestId = res.rows[0].id;
            console.log(`📦 Verificando os itens do pedido #${latestId}...`);
            const itemsRes = await pool.query('SELECT oi.product_id, oi.activation_key, p.title, p.eneba_url FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1', [latestId]);
            console.log("Itens do pedido:", itemsRes.rows);
        }
    } catch (err) {
        console.error("Erro ao verificar banco de dados:", err.message);
    } finally {
        await pool.end();
    }
}

checkLatestOrder();
