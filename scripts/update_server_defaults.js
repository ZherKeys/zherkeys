const fs = require('fs');

const gameplayMap = {
    'Human: Fall Flat': 'https://www.youtube.com/watch?v=2r1p8Wd_1e0',
    'Batman: Arkham Origins': 'https://www.youtube.com/watch?v=9pnK8akbd2M',
    'LEGO The Incredibles': 'https://www.youtube.com/watch?v=0h5U3x_y9OQ',
    'LEGO Marvel Super Heroes 2': 'https://www.youtube.com/watch?v=zJ-L_cE56w0',
    'LEGO DC Super-Villains Deluxe': 'https://www.youtube.com/watch?v=4L_V32K40n0',
    'Middle-earth: Shadow of War Definitive': 'https://www.youtube.com/watch?v=-_UJfX2728k',
    'The LEGO Movie Videogame': 'https://www.youtube.com/watch?v=6vB-d_KkEWE',
    'The LEGO Movie 2 Videogame': 'https://www.youtube.com/watch?v=6vB-d_KkEWE',
    'Forza DLC #1': 'https://www.youtube.com/watch?v=5z3n6v0d4Ew',
    'Forza DLC #2': 'https://www.youtube.com/watch?v=5z3n6v0d4Ew',
    'Forza DLC #3': 'https://www.youtube.com/watch?v=5z3n6v0d4Ew',
    'Mad Max (PC Steam Key Global)': 'https://www.youtube.com/watch?v=vVbhO_4f3D8',
    'Minecraft Legends (Windows Store Key Global)': 'https://www.youtube.com/watch?v=1JSbhvq_E5E',
    'The Forest (PC Steam Account)': 'https://www.youtube.com/watch?v=42_lIMlSbeU',
    'Back 4 Blood': 'https://www.youtube.com/watch?v=C3s_J3_v7_E',
    'Borderlands 2 (PC Steam Account)': 'https://www.youtube.com/watch?v=kKVsfTCv1N0',
    'Metro 2033 Redux (PC Steam Account)': 'https://www.youtube.com/watch?v=r3Z9x8k0_70',
    'Bully: Scholarship Edition (PC Steam Account)': 'https://www.youtube.com/watch?v=r2wK2z8X7X8',
    'ARK: Survival Evolved (PC Steam Account)': 'https://www.youtube.com/watch?v=FW9vsrPWujI',
    'F.E.A.R. 2: Project Origin (PC Steam CD Key)': 'https://www.youtube.com/watch?v=3Kk7s9k1X0w',
    'Suicide Squad: Kill the Justice League': 'https://www.youtube.com/watch?v=2EVW2-q46K0',
    'The Incredible Adventures of Van Helsing II': 'https://www.youtube.com/watch?v=7uK_Z2L1hE0',
    'Metal Slug Tactics': 'https://www.youtube.com/watch?v=8K-4_Y5_w40',
    'Going Under': 'https://www.youtube.com/watch?v=1xN5eB1S1e0',
    'Fallout 76': 'https://www.youtube.com/watch?v=M9FGaan35s0',
    'Injustice: Gods Among Us (Ultimate Edition) (PC) Steam Key GLOBAL': 'https://www.youtube.com/watch?v=hM-m9x_v8x0',
    'POSTAL 2': 'https://www.youtube.com/watch?v=r1K1m0q_1e0',
    'Amnesia: The Bunker': 'https://www.youtube.com/watch?v=vD81W6vQ-78'
};

let code = fs.readFileSync('server.js', 'utf8');

for (let title in gameplayMap) {
    const url = gameplayMap[title];
    const escapedTitle = title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(title:\\s*["']${escapedTitle}["'],[\\s\\S]*?activation_key:\\s*["'][^"']+["'])(?!,[\\s\\S]*?gallery:)`, 'g');
    code = code.replace(regex, `$1,\n                gallery: JSON.stringify(["${url}"])`);
}

fs.writeFileSync('server.js', code, 'utf8');
console.log('✅ server.js defaultProducts atualizado com sucesso!');
