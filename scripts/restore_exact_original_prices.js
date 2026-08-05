const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Extraindo o arquivo de produtos original do Git (commit 15b3ab7)...');

try {
    const rawOriginal = execSync('git show 15b3ab7:data/products_backup.json', { encoding: 'utf-8' });
    let originalProducts = JSON.parse(rawOriginal);

    console.log(`📦 Carregados ${originalProducts.length} produtos originais do histórico do Git.`);

    // Mantém Buddy Simulator 1984 que o usuário pediu para adicionar
    const currentBackupPath = path.join(__dirname, '..', 'data', 'products_backup.json');
    let currentProducts = JSON.parse(fs.readFileSync(currentBackupPath, 'utf-8'));
    const buddyProduct = currentProducts.find(p => p.title.includes('Buddy'));

    // Limpa sufixos dos títulos mantendo 100% dos preços e fotos originais
    let restoredList = originalProducts.map(p => {
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

    if (buddyProduct && !restoredList.some(p => p.title.includes('Buddy'))) {
        restoredList.unshift(buddyProduct);
    }

    fs.writeFileSync(currentBackupPath, JSON.stringify(restoredList, null, 2), 'utf-8');
    console.log('✅ PREÇOS E PRODUTOS RESTAURADOS 100% PARA O ESTADO ORIGINAL!');

    // Imprime os preços para verificação
    restoredList.forEach((p, i) => {
        console.log(`${i+1}. ${p.title} -> R$ ${p.price} (De: ${p.old_price ? 'R$ ' + p.old_price : 'N/A'})`);
    });

} catch (e) {
    console.error('❌ Erro ao restaurar:', e);
}
