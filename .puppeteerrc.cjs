const { join } = require('path');

/**
 * Configuração de Cache do Puppeteer para Servidores em Nuvem (Render / Railway / VPS)
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
