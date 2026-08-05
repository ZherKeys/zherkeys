require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function addBuddySim() {
    try {
        const title = 'Buddy Simulator 1984';
        const description = 'Buddy Simulator 1984 é uma experiência única de terror psicológico, aventura e nostalgia retrô dos anos 80. Interaja com uma IA criada para ser sua melhor amiga enquanto joga minijogos de texto, puzzles intrigantes e explora um mundo que evolui de formas perturbadoras e surpreendentes.';
        const price = 24.90;
        const oldPrice = 34.90;
        const image = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1269950/header.jpg';
        const category = 'STEAM KEY';
        const isGlobal = true;
        const restrictedCountries = JSON.stringify([]);
        const genres = JSON.stringify(['Indie', 'Terror Psicológico', 'Aventura', 'Puzzle', 'Retro']);
        const galleryArr = [
            'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1269950/ss_e1546944e876bc4aa2d5d836ea42a12bd0cfbfcd.1920x1080.jpg',
            'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1269950/ss_8c17b5f25a072fae5e6e87f581d6f1bfd8299c85.1920x1080.jpg',
            'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1269950/ss_81e9f1a26d1c81ef462b5d496a77d54b41b9d4f5.1920x1080.jpg',
            'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1269950/ss_e613b5bf934b9d03375b48dfa64be3ed9ffb2ec5.1920x1080.jpg'
        ];
        const gallery = JSON.stringify(galleryArr);
        const activationKey = 'BUDDY-1984-STEAM-KEY-001';

        const check = await pool.query('SELECT id FROM products WHERE title = $1', [title]);
        let productId;
        if (check.rows.length === 0) {
            const res = await pool.query(
                `INSERT INTO products (title, description, price, old_price, image, category, in_stock, is_global, restricted_countries, genres, gallery, activation_key, display_order)
                VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11, 1) RETURNING id`,
                [title, description, price, oldPrice, image, category, isGlobal, restrictedCountries, genres, gallery, activationKey]
            );
            productId = res.rows[0].id;
            console.log('✅ Jogo Buddy Simulator 1984 inserido no PostgreSQL! ID:', productId);
        } else {
            productId = check.rows[0].id;
            await pool.query(
                `UPDATE products SET description=$1, price=$2, old_price=$3, image=$4, category=$5, in_stock=true, is_global=$6, restricted_countries=$7, genres=$8, gallery=$9, activation_key=$10 WHERE id=$11`,
                [description, price, oldPrice, image, category, isGlobal, restrictedCountries, genres, gallery, activationKey, productId]
            );
            console.log('✅ Jogo Buddy Simulator 1984 atualizado no PostgreSQL! ID:', productId);
        }

        // Sincroniza o arquivo JSON de backup em data/products_backup.json
        const backupPath = path.join(__dirname, '..', 'data', 'products_backup.json');
        let productsData = [];
        if (fs.existsSync(backupPath)) {
            try {
                productsData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
            } catch(e) { productsData = []; }
        }

        const newProductObj = {
            id: productId,
            title,
            description,
            price,
            old_price: oldPrice,
            image,
            category,
            activation_key: activationKey,
            in_stock: true,
            is_global: isGlobal,
            restricted_countries: restrictedCountries,
            genres,
            gallery
        };

        const existingIdx = productsData.findIndex(p => p.title === title || p.id === productId);
        if (existingIdx >= 0) {
            productsData[existingIdx] = newProductObj;
        } else {
            productsData.unshift(newProductObj);
        }

        fs.writeFileSync(backupPath, JSON.stringify(productsData, null, 2), 'utf-8');
        console.log('💾 Backup sincronizado em data/products_backup.json!');

        await pool.end();
        process.exit(0);
    } catch(e) {
        console.error('❌ Erro:', e);
        process.exit(1);
    }
}

addBuddySim();
