const fs = require('fs');
const path = require('path');
const backupPath = path.join(__dirname, '..', 'data', 'products_backup.json');
const products = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
products.forEach((p, i) => {
    console.log(`${i+1}. ${p.title}`);
});
