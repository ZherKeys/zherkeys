/**
 * Módulo de Integração CJ Dropshipping API v2.0 & Produtos Nacionais Brasil
 * Documentação: https://developers.cjdropshipping.com/en/api/api2/api/product.html#_1-1-category-list-get
 */

const httpFetch = globalThis.fetch || require('node-fetch');

class CJDropshippingAPI {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.CJ_ACCESS_TOKEN;
        this.accessToken = null;
        this.baseUrl = 'https://developers.cjdropshipping.com/api2.0/v1/product';
        this.authUrl = 'https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken';
    }

    /**
     * Obtém ou renova o Access Token usando a API Key
     */
    async getValidAccessToken() {
        if (this.accessToken) return this.accessToken;

        if (!this.apiKey) {
            console.warn('⚠️ CJ_ACCESS_TOKEN não configurado no .env.');
            return null;
        }

        try {
            const response = await httpFetch(this.authUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: this.apiKey })
            });

            const data = await response.json();
            if (data && data.result && data.data && data.data.accessToken) {
                this.accessToken = data.data.accessToken;
                console.log('✅ Token da CJ Dropshipping autenticado com sucesso!');
                return this.accessToken;
            } else {
                console.error('❌ Erro na autenticação CJ:', data);
                return null;
            }
        } catch (error) {
            console.error('❌ Falha na chamada getAccessToken CJ:', error.message);
            return null;
        }
    }

    /**
     * Obter lista de categorias da CJ Dropshipping
     */
    async getCategoryList() {
        const token = await this.getValidAccessToken();
        if (!token) {
            return this.getFallbackCategories();
        }

        try {
            const response = await httpFetch(`${this.baseUrl}/getCategory`, {
                method: 'GET',
                headers: {
                    'CJ-Access-Token': token,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data && data.result && data.data) {
                return data.data;
            } else {
                return this.getFallbackCategories();
            }
        } catch (error) {
            console.error('Falha ao conectar à API da CJ Dropshipping:', error.message);
            return this.getFallbackCategories();
        }
    }

    /**
     * Obter Lista de Produtos V2 mesclando com Catálogo Nacional Brasil
     */
    async getProductList({ page = 1, size = 20, keyWord = '', categoryId = '' } = {}) {
        const token = await this.getValidAccessToken();
        let cjProducts = [];

        if (token) {
            try {
                let url = `${this.baseUrl}/listV2?page=${page}&size=${size}&features=enable_description,enable_category`;
                if (keyWord) url += `&keyWord=${encodeURIComponent(keyWord)}`;
                if (categoryId) url += `&categoryId=${encodeURIComponent(categoryId)}`;

                const response = await httpFetch(url, {
                    method: 'GET',
                    headers: {
                        'CJ-Access-Token': token,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                if (data && data.result && data.data && data.data.content && data.data.content[0] && data.data.content[0].productList) {
                    cjProducts = data.data.content[0].productList;
                }
            } catch (error) {
                console.error('Erro ao buscar lista de produtos CJ:', error.message);
            }
        }

        const nationalProducts = this.getBrazilianNationalProducts();

        // Mescla produtos internacionais CJ com produtos nacionais do Brasil
        const mergedList = [...nationalProducts, ...cjProducts];

        return {
            pageSize: size,
            pageNumber: page,
            totalRecords: mergedList.length,
            totalPages: Math.ceil(mergedList.length / size),
            content: [
                {
                    productList: mergedList
                }
            ]
        };
    }

    /**
     * Obter Detalhes Completos do Produto
     */
    async getProductDetails(pid) {
        // Verifica se é produto nacional do Brasil
        const national = this.getBrazilianNationalProducts().find(p => p.id === pid);
        if (national) return national;

        const token = await this.getValidAccessToken();
        if (!token) return null;

        try {
            const url = `${this.baseUrl}/query?pid=${encodeURIComponent(pid)}`;
            const response = await httpFetch(url, {
                method: 'GET',
                headers: {
                    'CJ-Access-Token': token,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data && data.result && data.data) {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Erro ao buscar detalhes do produto CJ:', error.message);
            return null;
        }
    }

    /**
     * Adicionar Produto à Lista Oficial "Meus Produtos" na CJ
     */
    async addMyProduct(pid) {
        const token = await this.getValidAccessToken();
        if (!token) return { success: false, message: "Token ausente" };

        try {
            const url = `${this.baseUrl}/addMyProduct`;
            const response = await httpFetch(url, {
                method: 'POST',
                headers: {
                    'CJ-Access-Token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pid })
            });

            const data = await response.json();
            if (data && data.result) {
                console.log(`✅ Produto ${pid} adicionado à lista "Meus Produtos" na conta CJ!`);
                return { success: true, data: data.data };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erro na chamada addMyProduct CJ:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Catálogo Especial de Produtos Nacionais com Estoque no Brasil (Envio em 24h)
     */
    getBrazilianNationalProducts() {
        return [
            {
                id: "BR-PROD-001",
                nameEn: "Fone Bluetooth Nitro Sound Pro (Estoque SP)",
                sku: "BR-NITRO-01",
                sellPrice: "26.70", // Em dólares base -> R$ 149,90 convertido
                nowPrice: "26.70",
                bigImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
                countryCode: "BR",
                oneCategoryName: "Eletrônicos Nacionais",
                description: "Fone de Ouvido Bluetooth sem fio de altíssima qualidade com isolamento acústico, grave reforçado e bateria de 30h. Envio rápido direto de São Paulo SP."
            },
            {
                id: "BR-PROD-002",
                nameEn: "Smartwatch Amoled Pro Brasil (Pronta Entrega)",
                sku: "BR-SMART-02",
                sellPrice: "42.80", // -> R$ 239,90
                nowPrice: "42.80",
                bigImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
                countryCode: "BR",
                oneCategoryName: "Smartwatches Brasil",
                description: "Smartwatch com tela Amoled HD, medição de oxigênio, batimentos cardíacos, notificações de WhatsApp e pulseira em liga metálica. Envio nacional expresso."
            },
            {
                id: "BR-PROD-003",
                nameEn: "Caixa de Som Wave Bass 30W RGB (Estoque BR)",
                sku: "BR-SOUND-03",
                sellPrice: "33.90", // -> R$ 189,90
                nowPrice: "33.90",
                bigImage: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500",
                countryCode: "BR",
                oneCategoryName: "Áudio Nacional",
                description: "Caixa de som Bluetooth à prova d'água IPX7 com luzes RGB dinâmicas e subwoofers duplos de 30W. Pronta entrega com nota fiscal."
            },
            {
                id: "BR-PROD-004",
                nameEn: "Controle Gamer Wireless Multiplataforma (Estoque SP)",
                sku: "BR-GAME-04",
                sellPrice: "32.10", // -> R$ 179,90
                nowPrice: "32.10",
                bigImage: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=500",
                countryCode: "BR",
                oneCategoryName: "Gaming Brasil",
                description: "Gamepad sem fio compatível com PC, Android, iOS e Consoles. Gatilhos analógicos magnéticos e bateria de longa duração. Estoque nacional."
            },
            {
                id: "BR-PROD-005",
                nameEn: "Câmera de Segurança Wi-Fi 360 HD (Pronta Entrega)",
                sku: "BR-CAM-05",
                sellPrice: "23.20", // -> R$ 129,90
                nowPrice: "23.20",
                bigImage: "https://images.unsplash.com/photo-1557862921-37829c790f19?w=500",
                countryCode: "BR",
                oneCategoryName: "Segurança Brasil",
                description: "Câmera de vigilância inteligente Wi-Fi com visão noturna, sensor de movimento infravermelho e áudio bidirecional. Envio imediato."
            },
            {
                id: "BR-PROD-006",
                nameEn: "Teclado Mecânico RGB Switch Blue ABNT2 (Estoque BR)",
                sku: "BR-KB-06",
                sellPrice: "39.20", // -> R$ 219,90
                nowPrice: "39.20",
                bigImage: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500",
                countryCode: "BR",
                oneCategoryName: "Periféricos Brasil",
                description: "Teclado mecânico gamer padrão brasileiro ABNT2 com iluminação RGB customizável e switches azuis de resposta tátil rápida. Estoque em SP."
            }
        ];
    }

    getFallbackCategories() {
        return [
            { categoryFirstName: "Eletrônicos Nacionais" },
            { categoryFirstName: "Smartwatches Brasil" },
            { categoryFirstName: "Áudio Nacional" },
            { categoryFirstName: "Gaming Brasil" },
            { categoryFirstName: "Periféricos Brasil" }
        ];
    }

    getFallbackProducts() {
        return {
            pageSize: 20,
            pageNumber: 1,
            totalRecords: 6,
            totalPages: 1,
            content: [
                {
                    productList: this.getBrazilianNationalProducts()
                }
            ]
        };
    }
}

module.exports = CJDropshippingAPI;
