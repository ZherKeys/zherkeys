/**
 * Script de Sincronização Automática de Produtos CJ Dropshipping -> products_backup.json
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const CJDropshippingAPI = require('./cj_dropshipping_api');

const cjApi = new CJDropshippingAPI();
const jsonPath = path.join(__dirname, 'products_backup.json');

async function autoSyncCJProducts(limit = 20) {
    console.log('🔄 Iniciando Sincronização Automática de Produtos no Zher Store...');

    try {
        const cjData = await cjApi.getProductList({ page: 1, size: limit });

        if (!cjData || !cjData.content || !cjData.content[0] || !cjData.content[0].productList) {
            console.log('⚠️ Nenhum produto retornado da CJ para sincronização.');
            return;
        }

        const products = cjData.content[0].productList;
        console.log(`📦 ${products.length} produtos encontrados. Salvando em products_backup.json...`);

        let currentBackup = [];
        if (fs.existsSync(jsonPath)) {
            try {
                currentBackup = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            } catch (e) {
                currentBackup = [];
            }
        }

        let insertedCount = 0;

        for (const prod of products) {
            const name = prod.nameEn || 'Produto High-Tech Zher';
            const rawUsdPrice = parseFloat(prod.nowPrice || prod.sellPrice || 19.99);
            const realPriceBRL = parseFloat((rawUsdPrice * 5.60 * 1.85).toFixed(2));
            const image = prod.bigImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500';
            const category = prod.oneCategoryName || 'Eletrônicos';
            const desc = prod.description || `Produto importado e certificado. SKU: ${prod.sku || prod.id}`;

            const existingIndex = currentBackup.findIndex(p => p.cj_product_id === prod.id || p.name === name);

            const prodObj = {
                id: prod.id,
                cj_product_id: prod.id,
                name: name,
                price: realPriceBRL,
                image: image,
                description: desc,
                category: category,
                stock: 100,
                countryCode: prod.countryCode || 'BR'
            };

            if (existingIndex > -1) {
                currentBackup[existingIndex] = prodObj;
            } else {
                currentBackup.push(prodObj);
            }

            insertedCount++;
            // Dispara vínculo na CJ
            cjApi.addMyProduct(prod.id);
        }

        fs.writeFileSync(jsonPath, JSON.stringify(currentBackup, null, 2), 'utf8');
        console.log(`✅ Sincronização concluída com sucesso! ${insertedCount} produtos salvos persistentemente em products_backup.json!`);

    } catch (error) {
        console.error('❌ Erro na sincronização:', error.message);
    }
}

if (require.main === module) {
    autoSyncCJProducts(20);
}

module.exports = { autoSyncCJProducts };
