const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function run() {
    try {
        console.log('Iniciando atualização de gêneros...');
        
        await pool.query("UPDATE products SET genres = 'Multiplayer, Ação, FPS' WHERE title ILIKE '%CS:GO%' OR title ILIKE '%Counter%' OR title ILIKE '%Valorant%'");
        await pool.query("UPDATE products SET genres = 'Aventura, RPG, Ação' WHERE title ILIKE '%Elden Ring%' OR title ILIKE '%Witcher%' OR title ILIKE '%Cyberpunk%'");
        await pool.query("UPDATE products SET genres = 'Ação, Aventura, Sandbox' WHERE title ILIKE '%GTA%' OR title ILIKE '%Red Dead%' OR title ILIKE '%Minecraft%'");
        await pool.query("UPDATE products SET genres = 'Esportes, Multiplayer' WHERE title ILIKE '%FIFA%' OR title ILIKE '%FC 24%' OR title ILIKE '%NBA%'");
        await pool.query("UPDATE products SET genres = 'Terror, Sobrevivência' WHERE title ILIKE '%Resident Evil%' OR title ILIKE '%Silent Hill%'");
        await pool.query("UPDATE products SET genres = 'Estratégia' WHERE title ILIKE '%Age of Empires%' OR title ILIKE '%Civilization%'");
        await pool.query("UPDATE products SET genres = 'Streaming' WHERE category = 'GIFT CARD' OR title ILIKE '%Netflix%' OR title ILIKE '%Spotify%' OR title ILIKE '%Crunchyroll%'");
        
        console.log('Gêneros atualizados com sucesso no banco de dados!');
    } catch (e) {
        console.error('Erro ao atualizar gêneros:', e);
    } finally {
        pool.end();
    }
}

run();
