const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

files.forEach(f => {
    const fullPath = path.join(publicDir, f);
    let content = fs.readFileSync(fullPath, 'utf-8');
    if (content.includes('`n')) {
        console.log('✅ Corrigindo sintaxe em:', f);
        content = content.split('`n').join('\n');
        fs.writeFileSync(fullPath, content, 'utf-8');
    }
});

console.log('🎉 Todos os arquivos HTML corrigidos 100%!');
