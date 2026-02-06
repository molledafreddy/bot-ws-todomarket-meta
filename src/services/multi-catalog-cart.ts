/**
 * SERVICIO MULTI-CATÁLOGO PARA CARRITO DE COMPRAS
 * Gestión centralizada de productos desde múltiples catálogos
 */

export interface CartItem {
    id: string;
    name: string;
    quantity: number;
    price?: number;
    catalogId?: string;
    retailerId?: string;
}

export interface Cart {
    items: CartItem[];
    total: number;
    catalogIds: string[];
}

// Servicio básico del carrito multi-catálogo
export class MultiCatalogCartService {
    private static instance: MultiCatalogCartService;
    private carts: Map<string, Cart> = new Map();

    static getInstance(): MultiCatalogCartService {
        if (!MultiCatalogCartService.instance) {
            MultiCatalogCartService.instance = new MultiCatalogCartService();
        }
        return MultiCatalogCartService.instance;
    }

    // Obtener carrito por usuario
    getCart(userId: string): Cart {
        if (!this.carts.has(userId)) {
            this.carts.set(userId, {
                items: [],
                total: 0,
                catalogIds: []
            });
        }
        return this.carts.get(userId)!;
    }

    // Agregar item al carrito
    addItem(userId: string, item: CartItem): Cart {
        const cart = this.getCart(userId);
        
        // Verificar si el item ya existe
        const existingItemIndex = cart.items.findIndex(i => i.id === item.id);
        
        if (existingItemIndex >= 0) {
            // Actualizar cantidad
            cart.items[existingItemIndex].quantity += item.quantity;
        } else {
            // Agregar nuevo item
            cart.items.push(item);
            
            // Agregar catalog ID si no existe
            if (item.catalogId && !cart.catalogIds.includes(item.catalogId)) {
                cart.catalogIds.push(item.catalogId);
            }
        }

        // Recalcular total
        cart.total = this.calculateTotal(cart);
        
        return cart;
    }

    // Remover item del carrito
    removeItem(userId: string, itemId: string): Cart {
        const cart = this.getCart(userId);
        cart.items = cart.items.filter(item => item.id !== itemId);
        cart.total = this.calculateTotal(cart);
        
        // Actualizar catalog IDs
        const usedCatalogIds = [...new Set(cart.items.map(item => item.catalogId).filter(Boolean))];
        cart.catalogIds = usedCatalogIds as string[];
        
        return cart;
    }

    // Limpiar carrito
    clearCart(userId: string): Cart {
        this.carts.set(userId, {
            items: [],
            total: 0,
            catalogIds: []
        });
        return this.getCart(userId);
    }

    // Calcular total del carrito
    private calculateTotal(cart: Cart): number {
        return cart.items.reduce((total, item) => {
            return total + (item.price || 0) * item.quantity;
        }, 0);
    }

    // Obtener resumen del carrito
    getCartSummary(userId: string): string {
        const cart = this.getCart(userId);
        
        if (cart.items.length === 0) {
            return '🛒 *Tu carrito está vacío*';
        }

        let summary = ['🛒 *Tu Carrito*', ''];
        
        cart.items.forEach((item, index) => {
            const itemTotal = (item.price || 0) * item.quantity;
            summary.push(`${index + 1}. ${item.name}`);
            summary.push(`   Cantidad: ${item.quantity} | $${itemTotal.toLocaleString()}`);
            summary.push('');
        });

        summary.push(`💰 *Total: $${cart.total.toLocaleString()}*`);
        summary.push(`📦 *Items: ${cart.items.length}*`);
        
        if (cart.catalogIds.length > 1) {
            summary.push(`🏪 *Catálogos: ${cart.catalogIds.length}*`);
        }

        return summary.join('\n');
    }
}

// Exportar instancia singleton
export const multiCatalogCart = MultiCatalogCartService.getInstance();

// Funciones de conveniencia
export const addToCart = (userId: string, item: CartItem) => 
    multiCatalogCart.addItem(userId, item);

export const removeFromCart = (userId: string, itemId: string) => 
    multiCatalogCart.removeItem(userId, itemId);

export const getCartSummary = (userId: string) => 
    multiCatalogCart.getCartSummary(userId);

export const clearUserCart = (userId: string) => 
    multiCatalogCart.clearCart(userId);