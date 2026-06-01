const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function run() {
    try {
        console.log('Iniciando atualização das imagens dos produtos...');
        
        // Substitui a imagem de header (460x215) pela imagem da biblioteca (600x900) de alta resolução
        const res = await pool.query(`
            UPDATE products 
            SET image = REPLACE(image, '/header.jpg', '/library_600x900.jpg') 
            WHERE image LIKE '%/header.jpg%'
        `);
        
        console.log(`Sucesso! Foram atualizados ${res.rowCount} produtos para imagens em alta resolução.`);
    } catch (e) {
        console.error('Erro ao atualizar imagens no banco de dados:', e);
    } finally {
        pool.end();
    }
}

run();
