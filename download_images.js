const fs = require('fs');
const path = require('path');

const imagesToDownload = [
    {
        name: 'human_fall_flat.jpg',
        url: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/477160/library_600x900.jpg'
    },
    {
        name: 'batman_arkham_origins.jpg',
        url: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/209000/library_600x900.jpg'
    },
    {
        name: 'lego_the_incredibles.jpg',
        url: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/818320/library_600x900.jpg'
    },
    {
        name: 'lego_dc_super_villains.jpg',
        url: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/829110/library_600x900.jpg'
    },
    {
        name: 'shadow_of_war.jpg',
        url: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/356190/library_600x900.jpg'
    },
    {
        name: 'lego_movie.jpg',
        url: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/267530/library_600x900.jpg'
    }
];

async function download(url, dest) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ao baixar ${url}: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(dest, buffer);
    console.log(`✓ Baixado com sucesso: ${path.basename(dest)}`);
}

async function run() {
    const publicDir = path.join(__dirname, 'public');
    
    // Garante que o diretório public existe
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    console.log('Iniciando o download das imagens dos jogos para o servidor local...');
    
    for (const img of imagesToDownload) {
        const dest = path.join(publicDir, img.name);
        try {
            await download(img.url, dest);
        } catch (err) {
            console.error(`Falha ao baixar ${img.name}:`, err.message);
        }
    }
    
    console.log('Processo de download concluído!');
}

run();
