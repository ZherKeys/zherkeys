const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'data', 'products_backup.json');
let products = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

console.log('🧹 Limpando sufixos e formatação dos títulos de produtos...');

products = products.map(p => {
    let cleanTitle = p.title
        .replace(/\(PC Steam Key Global\)/gi, '')
        .replace(/\(Windows Store Key Global\)/gi, '')
        .replace(/\(PC Steam Account\)/gi, '')
        .replace(/\(PC Steam CD Key\)/gi, '')
        .replace(/\(PC\)\s*Steam\s*Key\s*GLOBAL/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        ...p,
        title: cleanTitle
    };
});

// Remove duplicatas por título
const uniqueProducts = [];
const seenTitles = new Set();

for (let p of products) {
    if (!seenTitles.has(p.title.toLowerCase())) {
        seenTitles.add(p.title.toLowerCase());
        uniqueProducts.push(p);
    }
}

fs.writeFileSync(backupPath, JSON.stringify(uniqueProducts, null, 2), 'utf-8');
console.log(`✅ Salvo em data/products_backup.json (${uniqueProducts.length} produtos únicos e limpos)!`);
