/**
 * 🛒 SISTEMA DE CARRITO ESCALABLE CON MONGODB
 * Gestión completa de productos, categorías y carrito de compras
 * Integración: Meta API + MongoDB + WhatsApp Interactive Lists
 */

import { MongoAdapter as Database } from '@builderbot/database-mongo';

// ===== INTERFACES Y TIPOS =====

export interface ProductoMongo {
    _id?: any;
    metaId: string;
    retailerId: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    brand?: string;
    availability: string;
    
    // Campos de categorización
    categoria: string;
    subcategoria?: string;
    tags: string[];
    
    // Metadatos de sync
    lastSync: Date;
    metaLastUpdate?: Date;
    isActive: boolean;
    source: 'meta_api' | 'manual';
}

export interface CategoriaProducto {
    _id?: any;
    name: string; // "bebidas", "panaderia", etc
    displayName: string; // "🥤 Bebidas y Refrescos"
    emoji: string;
    keywords: string[];
    productCount: number;
    isActive: boolean;
    created: Date;
    updated: Date;
}

export interface ItemCarrito {
    _id?: any;
    userId: string; // teléfono del usuario
    retailerId: string;
    productName: string;
    price: number;
    currency: string;
    quantity: number;
    addedAt: Date;
    sessionId?: string;
}

export interface SyncLog {
    _id?: any;
    syncDate: Date;
    productsFound: number;
    productsUpdated: number;
    categoriesDetected: number;
    errors?: string[];
    duration: number;
    status: 'success' | 'partial' | 'failed';
}

// ===== CONFIGURACIÓN DE CATEGORIZACIÓN INTELIGENTE =====

export const CATEGORY_KEYWORDS = {
    bebidas: {
        displayName: '🥤 Bebidas y Refrescos',
        emoji: '🥤',
        keywords: ['coca', 'pepsi', 'sprite', 'fanta', 'agua', 'jugo', 'bebida', 'gaseosa', 'refresco', 'cerveza', 'vino', 'pisco']
    },
    panaderia: {
        displayName: '🍞 Panadería y Cereales',
        emoji: '🍞',
        keywords: ['pan', 'hallulla', 'marraqueta', 'cereal', 'avena', 'galleta', 'tostada', 'queque', 'torta']
    },
    lacteos: {
        displayName: '🥛 Lácteos y Huevos',
        emoji: '🥛',
        keywords: ['leche', 'yogurt', 'queso', 'mantequilla', 'crema', 'huevo', 'quesillo', 'ricotta']
    },
    abarrotes: {
        displayName: '🌾 Abarrotes',
        emoji: '🌾',
        keywords: ['arroz', 'fideos', 'pasta', 'aceite', 'azúcar', 'sal', 'harina', 'lentejas', 'porotos', 'conserva']
    },
    frutas: {
        displayName: '🍎 Frutas y Verduras',
        emoji: '🍎',
        keywords: ['manzana', 'plátano', 'naranja', 'tomate', 'papa', 'cebolla', 'zanahoria', 'lechuga', 'palta', 'limón']
    },
    limpieza: {
        displayName: '🧼 Limpieza y Aseo',
        emoji: '🧼',
        keywords: ['detergente', 'champú', 'jabón', 'papel', 'limpiador', 'desinfectante', 'escoba', 'trapo']
    },
    otros: {
        displayName: '📦 Otros Productos',
        emoji: '📦',
        keywords: []
    }
};

// ===== CLASE PRINCIPAL: GESTIÓN DE CARRITO =====

export class CarritoManager {
    private db: Database;

    constructor(database: Database) {
        this.db = database;
    }

    // ===== SINCRONIZACIÓN CON META API =====

    async syncProductsFromMeta(catalogId: string, accessToken: string): Promise<SyncLog> {
        const startTime = Date.now();
        const syncLog: Partial<SyncLog> = {
            syncDate: new Date(),
            productsFound: 0,
            productsUpdated: 0,
            categoriesDetected: 0,
            errors: [],
            status: 'success'
        };

        try {
            console.log('🔄 Iniciando sincronización con Meta API...');
            
            // Obtener productos desde Meta API
            const metaProducts = await this.fetchAllMetaProducts(catalogId, accessToken);
            syncLog.productsFound = metaProducts.length;

            console.log(`📦 Productos obtenidos desde Meta: ${metaProducts.length}`);

            // Procesar y categorizar productos
            for (const metaProduct of metaProducts) {
                try {
                    const productMongo = this.transformMetaToMongo(metaProduct);
                    await this.upsertProduct(productMongo);
                    syncLog.productsUpdated!++;
                } catch (error) {
                    console.error('❌ Error procesando producto:', error);
                    syncLog.errors!.push(`Producto ${metaProduct.id}: ${error.message}`);
                }
            }

            // Actualizar categorías
            await this.updateCategories();
            syncLog.categoriesDetected = await this.getActiveCategoriesCount();

            console.log(`✅ Sincronización completada: ${syncLog.productsUpdated} productos actualizados`);
            
        } catch (error) {
            console.error('❌ Error en sincronización:', error);
            syncLog.status = 'failed';
            syncLog.errors!.push(error.message);
        }

        syncLog.duration = Date.now() - startTime;
        
        // Guardar log en MongoDB
        await this.saveSyncLog(syncLog as SyncLog);
        
        return syncLog as SyncLog;
    }

    // Obtener todos los productos desde Meta API (paginado)
    private async fetchAllMetaProducts(catalogId: string, accessToken: string): Promise<any[]> {
        const allProducts: any[] = [];
        let nextUrl: string | null = null;
        
        const baseUrl = `https://graph.facebook.com/v18.0/${catalogId}/products`;
        const fields = 'id,name,description,price,currency,retailer_id,availability,condition,brand';
        
        do {
            const url = nextUrl || `${baseUrl}?fields=${fields}&access_token=${accessToken}&limit=100`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (response.ok && data.data) {
                allProducts.push(...data.data);
                nextUrl = data.paging?.next || null;
            } else {
                throw new Error(`Error API Meta: ${data.error?.message || 'Unknown error'}`);
            }
        } while (nextUrl);
        
        return allProducts;
    }

    // Transformar producto de Meta API a formato MongoDB
    private transformMetaToMongo(metaProduct: any): ProductoMongo {
        const categoria = this.detectCategory(metaProduct.name, metaProduct.description);
        
        return {
            metaId: metaProduct.id,
            retailerId: metaProduct.retailer_id,
            name: metaProduct.name || 'Producto sin nombre',
            description: metaProduct.description || null,
            price: parseFloat(metaProduct.price) || 0,
            currency: metaProduct.currency || 'CLP',
            brand: metaProduct.brand || null,
            availability: metaProduct.availability || 'unknown',
            
            categoria: categoria,
            subcategoria: null,
            tags: this.generateTags(metaProduct.name, metaProduct.description),
            
            lastSync: new Date(),
            metaLastUpdate: new Date(),
            isActive: metaProduct.availability === 'in stock',
            source: 'meta_api'
        };
    }

    // Detectar categoría automáticamente basado en keywords
    private detectCategory(name: string, description?: string): string {
        const text = `${name || ''} ${description || ''}`.toLowerCase();
        
        for (const [categoryKey, categoryData] of Object.entries(CATEGORY_KEYWORDS)) {
            if (categoryKey === 'otros') continue; // Skip "otros" category
            
            const hasMatch = categoryData.keywords.some(keyword => 
                text.includes(keyword.toLowerCase())
            );
            
            if (hasMatch) {
                return categoryKey;
            }
        }
        
        return 'otros'; // Default category
    }

    // Generar tags para búsquedas
    private generateTags(name: string, description?: string): string[] {
        const text = `${name || ''} ${description || ''}`.toLowerCase();
        const words = text.split(/\s+/).filter(word => word.length > 2);
        
        return [...new Set(words)]; // Remove duplicates
    }

    // Upsert producto en MongoDB
    private async upsertProduct(product: ProductoMongo): Promise<void> {
        try {
            // Crear identificador único para el producto
            const uniqueId = `product_${product.retailerId}`;
            await this.db.save({ key: uniqueId, ...product });
        } catch (error) {
            console.error('❌ Error guardando producto:', error);
            throw error;
        }
    }

    // Actualizar contadores de categorías
    private async updateCategories(): Promise<void> {
        for (const [categoryKey, categoryData] of Object.entries(CATEGORY_KEYWORDS)) {
            const productCount = await this.getProductCountByCategory(categoryKey);
            
            const categoryDoc: CategoriaProducto = {
                name: categoryKey,
                displayName: categoryData.displayName,
                emoji: categoryData.emoji,
                keywords: categoryData.keywords,
                productCount: productCount,
                isActive: productCount > 0,
                created: new Date(),
                updated: new Date()
            };

            await this.db.save('product_categories', {
                name: categoryKey
            }, categoryDoc);
        }
    }

    // ===== FUNCIONES DE CONSULTA =====

    // Obtener categorías activas con productos
    async getActiveCategories(): Promise<CategoriaProducto[]> {
        try {
            const categories = await this.db.read('product_categories');
            return categories
                .filter((cat: CategoriaProducto) => cat.isActive && cat.productCount > 0)
                .sort((a: CategoriaProducto, b: CategoriaProducto) => b.productCount - a.productCount);
        } catch (error) {
            console.error('❌ Error obteniendo categorías:', error);
            return [];
        }
    }

    // Obtener productos por categoría
    async getProductsByCategory(categoria: string, limit: number = 10): Promise<ProductoMongo[]> {
        try {
            const products = await this.db.read('products_catalog');
            return products
                .filter((product: ProductoMongo) => 
                    product.categoria === categoria && product.isActive
                )
                .sort((a: ProductoMongo, b: ProductoMongo) => a.name.localeCompare(b.name))
                .slice(0, limit);
        } catch (error) {
            console.error('❌ Error obteniendo productos:', error);
            return [];
        }
    }

    // Buscar productos por texto
    async searchProducts(query: string, limit: number = 10): Promise<ProductoMongo[]> {
        try {
            const products = await this.db.read('products_catalog');
            const searchTerm = query.toLowerCase();
            
            return products
                .filter((product: ProductoMongo) => 
                    product.isActive && (
                        product.name.toLowerCase().includes(searchTerm) ||
                        product.description?.toLowerCase().includes(searchTerm) ||
                        product.tags.some(tag => tag.includes(searchTerm))
                    )
                )
                .slice(0, limit);
        } catch (error) {
            console.error('❌ Error en búsqueda:', error);
            return [];
        }
    }

    // ===== GESTIÓN DEL CARRITO =====

    // Agregar producto al carrito
    async addToCart(userId: string, retailerId: string, quantity: number = 1): Promise<boolean> {
        try {
            // Buscar producto
            const products = await this.db.read('products_catalog');
            const product = products.find((p: ProductoMongo) => p.retailerId === retailerId);
            
            if (!product) {
                throw new Error('Producto no encontrado');
            }

            const cartItem: ItemCarrito = {
                userId: userId,
                retailerId: retailerId,
                productName: product.name,
                price: product.price,
                currency: product.currency,
                quantity: quantity,
                addedAt: new Date()
            };

            await this.db.save('shopping_cart', {
                userId: userId,
                retailerId: retailerId
            }, cartItem);

            console.log(`✅ Producto agregado al carrito: ${product.name} x${quantity}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error agregando al carrito:', error);
            return false;
        }
    }

    // Obtener carrito del usuario
    async getCart(userId: string): Promise<ItemCarrito[]> {
        try {
            const cartItems = await this.db.read('shopping_cart');
            return cartItems
                .filter((item: ItemCarrito) => item.userId === userId)
                .sort((a: ItemCarrito, b: ItemCarrito) => 
                    new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
                );
        } catch (error) {
            console.error('❌ Error obteniendo carrito:', error);
            return [];
        }
    }

    // Vaciar carrito
    async clearCart(userId: string): Promise<void> {
        try {
            const cartItems = await this.db.read('shopping_cart');
            for (const item of cartItems) {
                if (item.userId === userId) {
                    await this.db.delete('shopping_cart', { _id: item._id });
                }
            }
            console.log(`🗑️ Carrito vaciado para usuario: ${userId}`);
        } catch (error) {
            console.error('❌ Error vaciando carrito:', error);
        }
    }

    // Calcular total del carrito
    async getCartTotal(userId: string): Promise<{ total: number, itemCount: number }> {
        const cartItems = await this.getCart(userId);
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        
        return { total, itemCount };
    }

    // ===== FUNCIONES HELPER =====

    private async getProductCountByCategory(categoria: string): Promise<number> {
        try {
            const products = await this.db.read('products_catalog');
            return products.filter((product: ProductoMongo) => 
                product.categoria === categoria && product.isActive
            ).length;
        } catch (error) {
            return 0;
        }
    }

    private async getActiveCategoriesCount(): Promise<number> {
        try {
            const categories = await this.db.read('product_categories');
            return categories.filter((cat: CategoriaProducto) => cat.isActive).length;
        } catch (error) {
            return 0;
        }
    }

    private async saveSyncLog(syncLog: SyncLog): Promise<void> {
        try {
            await this.db.save('catalog_sync_log', {
                syncDate: syncLog.syncDate
            }, syncLog);
        } catch (error) {
            console.error('❌ Error guardando log de sync:', error);
        }
    }
}

// ===== FUNCIONES DE GENERACIÓN DE LISTAS WHATSAPP =====

export function generateCategoriesList(categories: CategoriaProducto[]) {
    if (categories.length === 0) {
        return null;
    }

    return {
        messaging_product: "whatsapp",
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: "🛒 TodoMarket - Catálogo"
            },
            body: {
                text: "¡Bienvenido a nuestro minimarket! 🏪\n\nSelecciona una categoría para ver nuestros productos disponibles:"
            },
            footer: {
                text: "TodoMarket - Tu minimarket de confianza"
            },
            action: {
                button: "Ver Categorías",
                sections: [{
                    title: "📋 Categorías Disponibles",
                    rows: categories.map(category => ({
                        id: `categoria_${category.name}`,
                        title: category.displayName,
                        description: `${category.productCount} productos disponibles`
                    }))
                }]
            }
        }
    };
}

export function generateProductsList(productos: ProductoMongo[], categoria: string) {
    if (productos.length === 0) {
        return null;
    }

    const categoryData = CATEGORY_KEYWORDS[categoria as keyof typeof CATEGORY_KEYWORDS];
    const title = categoryData ? categoryData.displayName : 'Productos';

    return {
        messaging_product: "whatsapp",
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: title
            },
            body: {
                text: `Selecciona los productos que deseas agregar a tu carrito:\n\n💡 *Tip:* Puedes seleccionar múltiples productos`
            },
            footer: {
                text: "TodoMarket - Tu minimarket de confianza"
            },
            action: {
                button: "Seleccionar Productos",
                sections: [
                    {
                        title: "Productos Disponibles",
                        rows: productos.map(product => ({
                            id: `producto_${product.retailerId}`,
                            title: product.name,
                            description: `$${product.price.toLocaleString()} ${product.currency} - ${product.description || 'Disponible'}`
                        }))
                    },
                    {
                        title: "Navegación",
                        rows: [
                            {
                                id: "volver_categorias",
                                title: "← Volver a Categorías",
                                description: "Ver todas las categorías"
                            },
                            {
                                id: "ver_carrito",
                                title: "🛒 Ver Carrito",
                                description: "Revisar productos seleccionados"
                            }
                        ]
                    }
                ]
            }
        }
    };
}
