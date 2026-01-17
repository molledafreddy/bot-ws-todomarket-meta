/**
 * 🛒 SISTEMA DE CARRITO SIMPLE CON MONGODB
 * Integración directa con BuilderBot usando el state existente
 * Versión simplificada para implementación rápida
 */

import { MongoAdapter as Database } from '@builderbot/database-mongo';

// ===== INTERFACES SIMPLIFICADAS =====

export interface ProductoCarrito {
    retailerId: string;
    name: string;
    price: number;
    currency: string;
    categoria: string;
    description?: string;
}

export interface ItemCarrito {
    retailerId: string;
    productName: string;
    price: number;
    quantity: number;
    addedAt: Date;
}

// ===== CONFIGURACIÓN DE CATEGORIZACIÓN =====

export const CATEGORY_KEYWORDS = {
    bebidas: {
        displayName: '🥤 Bebidas y Refrescos',
        emoji: '🥤',
        keywords: ['coca', 'pepsi', 'sprite', 'fanta', 'agua', 'jugo', 'bebida', 'gaseosa', 'refresco']
    },
    panaderia: {
        displayName: '🍞 Panadería y Cereales',
        emoji: '🍞',
        keywords: ['pan', 'hallulla', 'cereal', 'avena', 'galleta', 'tostada']
    },
    lacteos: {
        displayName: '🥛 Lácteos y Huevos',
        emoji: '🥛',
        keywords: ['leche', 'yogurt', 'queso', 'mantequilla', 'huevo']
    },
    abarrotes: {
        displayName: '🌾 Abarrotes',
        emoji: '🌾',
        keywords: ['arroz', 'fideos', 'pasta', 'aceite', 'azúcar', 'sal']
    },
    frutas: {
        displayName: '🍎 Frutas y Verduras',
        emoji: '🍎',
        keywords: ['manzana', 'plátano', 'tomate', 'papa', 'cebolla', 'zanahoria']
    },
    limpieza: {
        displayName: '🧼 Limpieza y Aseo',
        emoji: '🧼',
        keywords: ['detergente', 'champú', 'jabón', 'papel', 'limpiador']
    },
    otros: {
        displayName: '📦 Otros Productos',
        emoji: '📦',
        keywords: []
    }
};

// ===== FUNCIONES PARA OBTENER PRODUCTOS DESDE META API =====

export async function fetchProductsFromMeta(catalogId: string, accessToken: string): Promise<any[]> {
    try {
        console.log('🔄 Obteniendo productos desde Meta API...');
        
        const url = `https://graph.facebook.com/v18.0/${catalogId}/products`;
        const params = new URLSearchParams({
            fields: 'id,name,description,price,currency,retailer_id,availability,brand',
            access_token: accessToken,
            limit: '100'
        });

        const response = await fetch(`${url}?${params}`);
        const data = await response.json();

        if (response.ok && data.data) {
            console.log(`✅ Productos obtenidos: ${data.data.length}`);
            return data.data;
        } else {
            console.error('❌ Error API Meta:', data.error?.message || 'Error desconocido');
            return [];
        }
    } catch (error) {
        console.error('❌ Error obteniendo productos:', error);
        return [];
    }
}

// ===== FUNCIONES DE CATEGORIZACIÓN =====

export function detectCategory(name: string, description?: string): string {
    const text = `${name || ''} ${description || ''}`.toLowerCase();
    
    for (const [categoryKey, categoryData] of Object.entries(CATEGORY_KEYWORDS)) {
        if (categoryKey === 'otros') continue;
        
        const hasMatch = categoryData.keywords.some(keyword => 
            text.includes(keyword.toLowerCase())
        );
        
        if (hasMatch) {
            return categoryKey;
        }
    }
    
    return 'otros';
}

export function transformMetaProduct(metaProduct: any): ProductoCarrito {
    return {
        retailerId: metaProduct.retailer_id || metaProduct.id,
        name: metaProduct.name || 'Producto sin nombre',
        price: parseFloat(metaProduct.price) || 0,
        currency: metaProduct.currency || 'CLP',
        categoria: detectCategory(metaProduct.name, metaProduct.description),
        description: metaProduct.description || null
    };
}

export function groupProductsByCategory(productos: ProductoCarrito[]): Record<string, ProductoCarrito[]> {
    const grouped: Record<string, ProductoCarrito[]> = {};
    
    for (const producto of productos) {
        if (!grouped[producto.categoria]) {
            grouped[producto.categoria] = [];
        }
        grouped[producto.categoria].push(producto);
    }
    
    // Ordenar productos dentro de cada categoría
    for (const categoria in grouped) {
        grouped[categoria].sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return grouped;
}

// ===== FUNCIONES PARA GENERAR LISTAS WHATSAPP =====

export function generateCategoriesList(productsByCategory: Record<string, ProductoCarrito[]>) {
    const activeCategories = Object.entries(productsByCategory)
        .filter(([_, products]) => products.length > 0)
        .map(([categoryKey, products]) => ({
            key: categoryKey,
            data: CATEGORY_KEYWORDS[categoryKey as keyof typeof CATEGORY_KEYWORDS],
            count: products.length
        }))
        .sort((a, b) => b.count - a.count); // Ordenar por cantidad de productos

    if (activeCategories.length === 0) {
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
                    rows: activeCategories.map(category => ({
                        id: `categoria_${category.key}`,
                        title: category.data.displayName,
                        description: `${category.count} productos disponibles`
                    }))
                }]
            }
        }
    };
}

export function generateProductsList(productos: ProductoCarrito[], categoria: string, currentCart: ItemCarrito[] = []) {
    if (productos.length === 0) {
        return null;
    }

    const categoryData = CATEGORY_KEYWORDS[categoria as keyof typeof CATEGORY_KEYWORDS];
    const title = categoryData ? categoryData.displayName : 'Productos';

    // Limitar a 10 productos para no sobrepasar límites de WhatsApp
    const limitedProducts = productos.slice(0, 10);

    // Crear información adicional sobre productos ya en el carrito
    const getCartInfo = (retailerId: string) => {
        const inCart = currentCart.find(item => item.retailerId === retailerId);
        return inCart ? ` (${inCart.quantity} en carrito)` : '';
    };

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
                text: `Selecciona productos para agregar a tu carrito:\n\n💡 *Tip:* Los productos ya en el carrito muestran la cantidad actual`
            },
            footer: {
                text: "TodoMarket - Tu minimarket de confianza"
            },
            action: {
                button: "Seleccionar Productos",
                sections: [
                    {
                        title: "Productos Disponibles",
                        rows: limitedProducts.map(product => ({
                            id: `producto_${product.retailerId}`,
                            title: product.name,
                            description: `$${product.price.toLocaleString()} ${product.currency}${getCartInfo(product.retailerId)} - ${product.description || 'Disponible'}`
                        }))
                    },
                    {
                        title: "Navegación y Carrito",
                        rows: [
                            {
                                id: "ver_carrito",
                                title: "🛒 Ver Mi Carrito",
                                description: `${currentCart.length} productos en carrito`
                            },
                            {
                                id: "volver_categorias",
                                title: "← Volver a Categorías",
                                description: "Ver todas las categorías"
                            }
                        ]
                    }
                ]
            }
        }
    };
}

// ===== FUNCIONES DE GESTIÓN DEL CARRITO (usando state) =====

export function addToCart(currentCart: ItemCarrito[], product: ProductoCarrito, quantity: number = 1): ItemCarrito[] {
    const existingItem = currentCart.find(item => item.retailerId === product.retailerId);
    
    if (existingItem) {
        // Actualizar cantidad si ya existe
        existingItem.quantity += quantity;
        return currentCart;
    } else {
        // Agregar nuevo item
        const newItem: ItemCarrito = {
            retailerId: product.retailerId,
            productName: product.name,
            price: product.price,
            quantity: quantity,
            addedAt: new Date()
        };
        return [...currentCart, newItem];
    }
}

export function removeFromCart(currentCart: ItemCarrito[], retailerId: string): ItemCarrito[] {
    return currentCart.filter(item => item.retailerId !== retailerId);
}

export function clearCart(): ItemCarrito[] {
    return [];
}

export function getCartTotal(cart: ItemCarrito[]): { total: number, itemCount: number } {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    return { total, itemCount };
}

export function generateCartSummary(cart: ItemCarrito[]): string {
    if (cart.length === 0) {
        return '🛒 Tu carrito está vacío\n\nEscribe "1" para ver el catálogo de productos.';
    }

    const { total, itemCount } = getCartTotal(cart);
    
    let summary = ['🛒 *RESUMEN DE TU CARRITO*\n'];
    
    cart.forEach((item, index) => {
        summary.push(`${index + 1}. *${item.productName}*`);
        summary.push(`   Cantidad: ${item.quantity}`);
        summary.push(`   Precio: $${item.price.toLocaleString()} c/u`);
        summary.push(`   Subtotal: $${(item.price * item.quantity).toLocaleString()}`);
        summary.push('');
    });
    
    summary.push(`*📊 TOTAL: $${total.toLocaleString()} CLP*`);
    summary.push(`*📦 Productos: ${itemCount} items*`);
    summary.push('');
    summary.push('💡 *Opciones:*');
    summary.push('• Escribe "confirmar" para finalizar pedido');
    summary.push('• Escribe "vaciar" para vaciar carrito');
    summary.push('• Escribe "1" para seguir comprando');
    
    return summary.join('\n');
}

// ===== FUNCIONES DE BÚSQUEDA =====

export function searchProductsByText(productos: ProductoCarrito[], query: string): ProductoCarrito[] {
    const searchTerm = query.toLowerCase().trim();
    
    return productos
        .filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            product.description?.toLowerCase().includes(searchTerm) ||
            product.categoria.toLowerCase().includes(searchTerm)
        )
        .slice(0, 10); // Limitar resultados
}

// ===== CACHE EN MEMORIA SIMPLE =====

interface ProductCache {
    productos: ProductoCarrito[];
    lastSync: Date;
    ttl: number; // Time to live in minutes
}

let productCache: ProductCache = {
    productos: [],
    lastSync: new Date(0), // Epoch
    ttl: 60 // 60 minutos
};

export function isCacheValid(): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - productCache.lastSync.getTime();
    const minutesDiff = timeDiff / (1000 * 60);
    
    return minutesDiff < productCache.ttl && productCache.productos.length > 0;
}

export function updateProductCache(productos: ProductoCarrito[]): void {
    productCache = {
        productos: productos,
        lastSync: new Date(),
        ttl: 60
    };
    console.log(`✅ Cache actualizado: ${productos.length} productos, válido por ${productCache.ttl} minutos`);
}

export function getProductCache(): ProductoCarrito[] {
    return productCache.productos;
}

// ===== FUNCIÓN PRINCIPAL DE SYNC =====

export async function syncAndGetProducts(catalogId: string, accessToken: string, forceSync: boolean = false): Promise<Record<string, ProductoCarrito[]>> {
    try {
        // Verificar cache si no es sync forzado
        if (!forceSync && isCacheValid()) {
            console.log('💾 Usando productos desde cache...');
            return groupProductsByCategory(getProductCache());
        }

        // Obtener productos frescos desde Meta API
        console.log('🔄 Sincronizando productos desde Meta API...');
        const metaProducts = await fetchProductsFromMeta(catalogId, accessToken);
        
        if (metaProducts.length === 0) {
            console.warn('⚠️ No se obtuvieron productos, usando cache si está disponible');
            return groupProductsByCategory(getProductCache());
        }

        // Transformar productos
        const productos = metaProducts.map(transformMetaProduct);
        
        // Actualizar cache
        updateProductCache(productos);
        
        // Agrupar por categorías
        const groupedProducts = groupProductsByCategory(productos);
        
        console.log(`✅ Sincronización completada: ${productos.length} productos en ${Object.keys(groupedProducts).length} categorías`);
        
        return groupedProducts;
        
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
        
        // Fallback al cache si hay error
        if (getProductCache().length > 0) {
            console.log('🔄 Usando cache como fallback...');
            return groupProductsByCategory(getProductCache());
        }
        
        return {};
    }
}

// ===== FUNCIÓN HELPER PARA BUSCAR PRODUCTO POR RETAILER ID =====

export function findProductByRetailerId(productsByCategory: Record<string, ProductoCarrito[]>, retailerId: string): ProductoCarrito | null {
    for (const productos of Object.values(productsByCategory)) {
        const found = productos.find(p => p.retailerId === retailerId);
        if (found) return found;
    }
    return null;
}
