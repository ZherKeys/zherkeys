/**
 * Script de Sincronização Automática de Produtos CJ Dropshipping -> Banco de Dados ZherKeys
 * E vinculação direta no painel oficial "Meus Produtos" da sua conta na CJ Dropshipping.
 */

require('dotenv').config();
const { Pool } = require('pg');
const CJDropshippingAPI = require('./cj_dropshipping_api');

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: 'localhost', port: 5432, user: 'postgres', database: 'zherkeys' };

const pool = new Pool(poolConfig);
const cjApi = new CJDropshippingAPI();

async function autoSyncCJProducts(limit = 20) {
    console.log('🔄 Iniciando Sincronização Automática de Produtos da CJ Dropshipping...');

    try {
        const cjData = await cjApi.getProductList({ page: 1, size: limit });

        if (!cjData || !cjData.content || !cjData.content[0] || !cjData.content[0].productList) {
            console.log('⚠️ Nenhum produto retornado da CJ para sincronização.');
            return;
        }

        const products = cjData.content[0].productList;
        console.log(`📦 ${products.length} produtos encontrados na CJ. Vinculando à sua conta CJ e inserindo no banco...`);

        let insertedCount = 0;

        for (const prod of products) {
            const name = prod.nameEn || 'Produto CJ Dropshipping';
            const price = parseFloat(prod.nowPrice || prod.sellPrice || 19.99);
            const image = prod.bigImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500';
            const sku = prod.sku || prod.spu || prod.id;
            const category = prod.oneCategoryName || 'Eletrônicos';

            // 1. Vincula automaticamente à lista "Meus Produtos" na sua conta oficial da CJ
            await cjApi.addMyProduct(prod.id);

            // 2. Insere/Atualiza no banco de dados local da ZherKeys
            const queryText = `
                INSERT INTO products (name, price, image, description, category, stock, cj_product_id)
                VALUES ($1, $2, $3, $4, $5, 100, $6)
                ON CONFLICT (cj_product_id) DO UPDATE 
                SET price = EXCLUDED.price, image = EXCLUDED.image, name = EXCLUDED.name
            `;

            try {
                await pool.query(queryText, [name, price, image, prod.description || `SKU: ${sku}`, category, prod.id]);
                insertedCount++;
            } catch (err) {
                try {
                    await pool.query(
                        `INSERT INTO products (name, price, image, description, category, stock) VALUES ($1, $2, $3, $4, $5, 100)`,
                        [name, price, image, prod.description || `SKU: ${sku}`, category]
                    );
                    insertedCount++;
                } catch (e) {
                    console.warn(`Aviso ao salvar produto "${name}":`, e.message);
                }
            }
        }

        console.log(`✅ Sincronização concluída! ${insertedCount} produtos vinculados à sua conta CJ e salvos no banco!`);
    } catch (error) {
        console.error('❌ Erro na sincronização de produtos CJ:', error.message);
    }
}

if (require.main === module) {
    autoSyncCJProducts(10).then(() => pool.end());
}

module.exports = { autoSyncCJProducts };
