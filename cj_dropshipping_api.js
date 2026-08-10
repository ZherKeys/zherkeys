/**
 * Módulo de Integração CJ Dropshipping API v2.0
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
     * Obter lista de categorias da CJ Dropshipping (1.1 Category List GET)
     * Endpoint: GET https://developers.cjdropshipping.com/api2.0/v1/product/getCategory
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
                console.error('Erro na resposta da API CJ getCategory:', data);
                return this.getFallbackCategories();
            }
        } catch (error) {
            console.error('Falha ao conectar à API da CJ Dropshipping:', error.message);
            return this.getFallbackCategories();
        }
    }

    /**
     * Obter Lista de Produtos V2 (1.2 Product List V2 GET)
     * Endpoint: GET https://developers.cjdropshipping.com/api2.0/v1/product/listV2
     */
    async getProductList({ page = 1, size = 20, keyWord = '', categoryId = '' } = {}) {
        const token = await this.getValidAccessToken();
        if (!token) {
            return this.getFallbackProducts();
        }

        try {
            let url = `${this.baseUrl}/listV2?page=${page}&size=${size}`;
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
            if (data && data.result && data.data) {
                return data.data;
            } else {
                return this.getFallbackProducts();
            }
        } catch (error) {
            console.error('Erro ao buscar lista de produtos CJ:', error.message);
            return this.getFallbackProducts();
        }
    }

    /**
     * Categorias de Exemplo/Fallback para exibição offline
     */
    getFallbackCategories() {
        return [
            {
                categoryFirstName: "Computer & Office",
                categoryFirstList: [
                    {
                        categorySecondName: "Office Electronics",
                        categorySecondList: [
                            { categoryId: "2252588B-72E3-4397-8C92-7D9967161084", categoryName: "Office & School Supplies" }
                        ]
                    }
                ]
            }
        ];
    }

    /**
     * Produtos de Exemplo/Fallback
     */
    getFallbackProducts() {
        return {
            pageSize: 20,
            pageNumber: 1,
            totalRecords: 1,
            totalPages: 1,
            content: [
                {
                    productList: [
                        {
                            id: "04A22450-67F0-4617-A132-E7AE7F8963B0",
                            nameEn: "Personalized Gaming Headset 7.1",
                            sku: "CJNSSYWY01847",
                            sellPrice: "19.99",
                            nowPrice: "14.50",
                            bigImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500"
                        }
                    ]
                }
            ]
        };
    }
}

module.exports = CJDropshippingAPI;
