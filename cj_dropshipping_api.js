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
     * Obter Lista de Produtos V2 com descrições (1.2 Product List V2 GET)
     */
    async getProductList({ page = 1, size = 20, keyWord = '', categoryId = '' } = {}) {
        const token = await this.getValidAccessToken();
        if (!token) {
            return this.getFallbackProducts();
        }

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
     * Obter Detalhes Completos do Produto (1.5 Product Details GET)
     */
    async getProductDetails(pid) {
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
     * Adicionar Produto à Lista Oficial "Meus Produtos" na Conta CJ (1.6 Add to My Product POST)
     * Endpoint: POST https://developers.cjdropshipping.com/api2.0/v1/product/addMyProduct
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
                console.warn(`Aviso ao adicionar produto ${pid} na CJ:`, data.message);
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erro na chamada addMyProduct CJ:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obter Lista de Produtos Cadastrados em "Meus Produtos" na CJ (1.7 My Product List GET)
     * Endpoint: GET https://developers.cjdropshipping.com/api2.0/v1/product/myProductList
     */
    async getMyProductList({ page = 1, size = 20 } = {}) {
        const token = await this.getValidAccessToken();
        if (!token) return null;

        try {
            const url = `${this.baseUrl}/myProductList?page=${page}&size=${size}`;
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
            console.error('Erro ao buscar MyProductList CJ:', error.message);
            return null;
        }
    }

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
                            bigImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
                            description: "Fone de ouvido gamer de alta fidelidade com microfone com cancelamento de ruído e leds RGB."
                        }
                    ]
                }
            ]
        };
    }
}

module.exports = CJDropshippingAPI;
