/**
 * 🛒 CARRITO CON LISTAS INTERACTIVAS
 * Sistema visual para gestionar productos y cantidades directamente en listas
 */

import { addKeyword, EVENTS } from '@builderbot/bot';
import { MetaProvider as Provider } from '@builderbot/provider-meta';
import { MongoAdapter as Database } from '@builderbot/database-mongo';
import {
    syncAndGetProducts,
    generateCategoriesList,
    generateProductsList,
    findProductByRetailerId,
    addToCart,
    removeFromCart,
    clearCart,
    getCartTotal,
    generateCartSummary,
    ItemCarrito,
    ProductoCarrito
} from './carrito-simple';

// ===== CONFIGURACIÓN =====
const CATALOG_ID = '1057244946408276';
const ACCESS_TOKEN = process.env.JWT_TOKEN!;

// ===== FUNCIÓN HELPER PARA ENVIAR MENSAJES INTERACTIVOS =====
async function sendInteractiveMessage(phoneNumber: string, payload: any): Promise<void> {
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${process.env.NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...payload,
                to: phoneNumber
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Error enviando mensaje interactivo:', errorData);
            throw new Error('Error API Meta');
        }
    } catch (error) {
        console.error('❌ Error en sendInteractiveMessage:', error);
        throw error;
    }
}

// ===== GENERAR LISTA INTERACTIVA DE PRODUCTOS CON CARRITO VISIBLE =====
function generateProductsListWithCart(products: ProductoCarrito[], categoria: string, currentCart: ItemCarrito[]): any {
    const { total, itemCount } = getCartTotal(currentCart);
    
    const rows = products.map((product, index) => {
        const cartItem = currentCart.find(item => item.retailerId === product.retailerId);
        const currentQuantity = cartItem ? cartItem.quantity : 0;
        
        return {
            id: `select_${product.retailerId}`,
            title: `${product.name}`,
            description: `$${product.price.toLocaleString()} - En carrito: ${currentQuantity} | Tocar para seleccionar`
        };
    });

    // Agregar resumen del carrito en la lista
    if (itemCount > 0) {
        rows.push({
            id: 'view_cart_summary',
            title: `🛒 Ver Carrito (${itemCount} productos)`,
            description: `Total: $${total.toLocaleString()} - Gestionar carrito`
        });
    }

    // Agregar opciones de navegación
    rows.push({
        id: 'back_to_categories',
        title: '⬅️ Volver a Categorías',
        description: 'Seleccionar otra categoría'
    });

    rows.push({
        id: 'finalize_purchase',
        title: '✅ Finalizar Compra',
        description: 'Continuar con el pedido'
    });

    return {
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: `🛍️ ${categoria.toUpperCase()}`
            },
            body: {
                text: itemCount > 0 
                    ? `Productos disponibles:\n\n🛒 Carrito actual: ${itemCount} productos - $${total.toLocaleString()}\n\nSelecciona un producto para agregarlo:`
                    : "Selecciona productos para agregar al carrito:"
            },
            footer: {
                text: "TodoMarket - Carrito Interactivo"
            },
            action: {
                button: "Ver opciones",
                sections: [
                    {
                        title: "Productos disponibles",
                        rows: rows.slice(0, products.length)
                    },
                    {
                        title: "Opciones",
                        rows: rows.slice(products.length)
                    }
                ]
            }
        }
    };
}

// ===== GENERAR SELECTOR DE CANTIDAD PARA PRODUCTO =====
function generateQuantitySelector(product: ProductoCarrito, currentQuantity: number = 0): any {
    const quantities = [1, 2, 3, 4, 5, 10];
    
    const rows = quantities.map(qty => ({
        id: `add_qty_${product.retailerId}_${qty}`,
        title: `Agregar ${qty} unidad${qty > 1 ? 'es' : ''}`,
        description: qty === 1 ? 'Cantidad básica' : `${qty} productos al carrito`
    }));

    // Si ya tiene productos, agregar opción para eliminar
    if (currentQuantity > 0) {
        rows.push({
            id: `remove_all_${product.retailerId}`,
            title: '🗑️ Quitar del carrito',
            description: `Eliminar ${currentQuantity} unidad${currentQuantity > 1 ? 'es' : ''}`
        });
    }

    // Agregar opción para volver
    rows.push({
        id: 'back_to_products',
        title: '⬅️ Volver a productos',
        description: 'Regresar a la lista de productos'
    });

    return {
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: `📦 ${product.name}`
            },
            body: {
                text: `💰 Precio: $${product.price.toLocaleString()}\n🛒 En carrito: ${currentQuantity} unidades\n\n¿Cuántas unidades quieres agregar?`
            },
            footer: {
                text: "TodoMarket - Seleccionar cantidad"
            },
            action: {
                button: "Seleccionar cantidad",
                sections: [
                    {
                        title: "Agregar al carrito",
                        rows: rows.slice(0, -2)
                    },
                    {
                        title: "Opciones",
                        rows: rows.slice(-2)
                    }
                ]
            }
        }
    };
}

// ===== GENERAR RESUMEN DETALLADO DEL CARRITO =====
function generateCartDetailView(currentCart: ItemCarrito[]): any {
    if (currentCart.length === 0) {
        return {
            type: "interactive",
            interactive: {
                type: "list",
                header: {
                    type: "text",
                    text: "🛒 Carrito Vacío"
                },
                body: {
                    text: "Tu carrito está vacío.\n\n¡Agrega algunos productos para comenzar!"
                },
                footer: {
                    text: "TodoMarket"
                },
                action: {
                    button: "Ver opciones",
                    sections: [
                        {
                            title: "Opciones",
                            rows: [
                                {
                                    id: 'back_to_categories',
                                    title: '🛍️ Ver Productos',
                                    description: 'Explorar categorías y productos'
                                }
                            ]
                        }
                    ]
                }
            }
        };
    }

    const { total, itemCount } = getCartTotal(currentCart);
    
    // Crear filas para cada producto en el carrito
    const productRows = currentCart.map((item, index) => {
        const subtotal = item.price * item.quantity;
        return {
            id: `edit_cart_item_${index}`,
            title: `${item.productName}`,
            description: `${item.quantity} x $${item.price.toLocaleString()} = $${subtotal.toLocaleString()}`
        };
    });

    // Opciones del carrito
    const actionRows = [
        {
            id: 'continue_shopping',
            title: '🛍️ Seguir Comprando',
            description: 'Agregar más productos al carrito'
        },
        {
            id: 'clear_cart',
            title: '🗑️ Vaciar Carrito',
            description: 'Eliminar todos los productos'
        },
        {
            id: 'checkout_order',
            title: '✅ Confirmar Pedido',
            description: `Finalizar compra - Total: $${total.toLocaleString()}`
        }
    ];

    return {
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: `🛒 Tu Carrito - ${itemCount} productos`
            },
            body: {
                text: `Resumen de tu pedido:\n\n💰 Total: $${total.toLocaleString()}\n\nSelecciona un producto para editarlo o elige una acción:`
            },
            footer: {
                text: "TodoMarket - Gestión del carrito"
            },
            action: {
                button: "Gestionar carrito",
                sections: [
                    {
                        title: "Productos en tu carrito",
                        rows: productRows
                    },
                    {
                        title: "Acciones del carrito",
                        rows: actionRows
                    }
                ]
            }
        }
    };
}

// ===== GENERAR LISTA INTERACTIVA DEL CARRITO CON OPCIONES DE CANTIDAD =====
function generateCartManagementList(currentCart: ItemCarrito[]): any {
    if (currentCart.length === 0) {
        return {
            type: "interactive",
            interactive: {
                type: "list",
                header: {
                    type: "text",
                    text: "🛒 Carrito Vacío"
                },
                body: {
                    text: "Tu carrito está vacío. ¡Agrega algunos productos!"
                },
                footer: {
                    text: "TodoMarket"
                },
                action: {
                    button: "Ver opciones",
                    sections: [
                        {
                            title: "Opciones",
                            rows: [
                                {
                                    id: 'seguir_comprando',
                                    title: '🛍️ Seguir Comprando',
                                    description: 'Volver al catálogo de productos'
                                }
                            ]
                        }
                    ]
                }
            }
        };
    }

    const { total } = getCartTotal(currentCart);
    
    // Crear filas para cada producto con opciones de cantidad
    const productRows = currentCart.map((item, index) => {
        const subtotal = item.price * item.quantity;
        return {
            id: `manage_${index}`,
            title: `${item.productName}`,
            description: `${item.quantity} x $${item.price.toLocaleString()} = $${subtotal.toLocaleString()}`
        };
    });

    // Opciones generales del carrito
    const generalRows = [
        {
            id: 'seguir_comprando',
            title: '🛍️ Seguir Comprando',
            description: 'Agregar más productos al carrito'
        },
        {
            id: 'vaciar_carrito',
            title: '🗑️ Vaciar Carrito',
            description: 'Eliminar todos los productos'
        },
        {
            id: 'confirmar_pedido',
            title: '✅ Confirmar Pedido',
            description: `Total: $${total.toLocaleString()} - Finalizar compra`
        }
    ];

    return {
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: `🛒 Tu Carrito - $${total.toLocaleString()}`
            },
            body: {
                text: `Tienes ${currentCart.length} productos en tu carrito.\n\nSelecciona un producto para cambiar cantidad o eliminar:`
            },
            footer: {
                text: "TodoMarket - Gestión del carrito"
            },
            action: {
                button: "Gestionar carrito",
                sections: [
                    {
                        title: "Productos en tu carrito",
                        rows: productRows
                    },
                    {
                        title: "Opciones del carrito",
                        rows: generalRows
                    }
                ]
            }
        }
    };
}

// ===== GENERAR LISTA DE OPCIONES DE CANTIDAD PARA UN PRODUCTO =====
function generateQuantityOptions(productName: string, currentQuantity: number, index: number): any {
    const quantityOptions = [
        { quantity: 1, action: 'set' },
        { quantity: 2, action: 'set' },
        { quantity: 3, action: 'set' },
        { quantity: 5, action: 'set' },
        { quantity: 10, action: 'set' }
    ];

    const rows = quantityOptions.map(option => ({
        id: `quantity_${index}_${option.quantity}`,
        title: `${option.quantity} unidades`,
        description: option.quantity === currentQuantity ? 'Cantidad actual' : `Cambiar a ${option.quantity}`
    }));

    // Agregar opción para eliminar
    rows.push({
        id: `remove_${index}`,
        title: '🗑️ Eliminar producto',
        description: 'Quitar este producto del carrito'
    });

    // Agregar opción para volver
    rows.push({
        id: 'back_to_cart',
        title: '↩️ Volver al carrito',
        description: 'Regresar a la gestión del carrito'
    });

    return {
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: `📦 Gestionar: ${productName}`
            },
            body: {
                text: `Cantidad actual: ${currentQuantity} unidades\n\nSelecciona la nueva cantidad o elimina el producto:`
            },
            footer: {
                text: "TodoMarket - Cantidad del producto"
            },
            action: {
                button: "Seleccionar",
                sections: [
                    {
                        title: "Cambiar cantidad",
                        rows: rows.slice(0, -2) // Opciones de cantidad
                    },
                    {
                        title: "Acciones",
                        rows: rows.slice(-2) // Eliminar y volver
                    }
                ]
            }
        }
    };
}

// ===== GENERAR BOTONES RÁPIDOS PARA CANTIDADES =====
function generateQuickActionButtons(product: ProductoCarrito, currentQuantity: number): any {
    const { name, price, retailerId } = product;
    
    return {
        type: "interactive",
        interactive: {
            type: "button",
            header: {
                type: "text",
                text: `📦 ${name}`
            },
            body: {
                text: `💰 Precio: $${price.toLocaleString()}\n🛒 En carrito: ${currentQuantity} unidades\n\n¿Qué quieres hacer?`
            },
            footer: {
                text: "TodoMarket - Acciones rápidas"
            },
            action: {
                buttons: [
                    {
                        type: "reply",
                        reply: {
                            id: `quick_add_1_${retailerId}`,
                            title: "➕ Agregar 1"
                        }
                    },
                    {
                        type: "reply", 
                        reply: {
                            id: `quick_remove_1_${retailerId}`,
                            title: "➖ Quitar 1"
                        }
                    },
                    {
                        type: "reply",
                        reply: {
                            id: `set_quantity_${retailerId}`,
                            title: "🔢 Cantidad específica"
                        }
                    }
                ]
            }
        }
    };
}

// ===== GENERAR LISTA HÍBRIDA DE PRODUCTOS CON ACCIONES RÁPIDAS =====
function generateHybridProductsList(products: ProductoCarrito[], categoria: string, currentCart: ItemCarrito[]): any {
    const rows = products.map((product, index) => {
        const cartItem = currentCart.find(item => item.retailerId === product.retailerId);
        const currentQuantity = cartItem ? cartItem.quantity : 0;
        
        return {
            id: `hybrid_${product.retailerId}`,
            title: `${product.name}`,
            description: `$${product.price.toLocaleString()} | En carrito: ${currentQuantity} | Toca para acciones rápidas`
        };
    });

    // Agregar opciones de gestión del carrito mejoradas
    rows.push({
        id: 'ver_carrito_detallado',
        title: '🛒 Ver Carrito Completo',
        description: 'Gestionar todos los productos del carrito'
    });

    rows.push({
        id: 'finalizar_compra',
        title: '✅ Finalizar Compra',
        description: 'Confirmar pedido y proceder al pago'
    });

    return {
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: `🛍️ ${categoria.toUpperCase()}`
            },
            body: {
                text: "Selecciona un producto para acciones rápidas (+1, -1, cantidad específica) o gestiona tu carrito:"
            },
            footer: {
                text: "TodoMarket - Acciones rápidas disponibles"
            },
            action: {
                button: "Ver opciones",
                sections: [
                    {
                        title: "Productos disponibles",
                        rows: rows.slice(0, -2)
                    },
                    {
                        title: "Gestión del carrito",
                        rows: rows.slice(-2)
                    }
                ]
            }
        }
    };
}

// ===== FUNCIÓN PARA FEEDBACK DINÁMICO =====
async function sendCartFeedback(phoneNumber: string, action: string, productName: string, quantity: number, cartTotal: number): Promise<void> {
    const feedbackMessages = {
        add: `✅ *Agregado al carrito*\n\n📦 ${productName}\n🔢 Cantidad: ${quantity}\n💰 Total carrito: $${cartTotal.toLocaleString()}`,
        remove: `➖ *Quitado del carrito*\n\n📦 ${productName}\n🔢 Nueva cantidad: ${quantity}\n💰 Total carrito: $${cartTotal.toLocaleString()}`,
        set: `🔢 *Cantidad actualizada*\n\n📦 ${productName}\n🔢 Nueva cantidad: ${quantity}\n💰 Total carrito: $${cartTotal.toLocaleString()}`,
        delete: `🗑️ *Producto eliminado*\n\n📦 ${productName} removido del carrito\n💰 Total carrito: $${cartTotal.toLocaleString()}`
    };

    const message = feedbackMessages[action] || `🛒 Carrito actualizado - Total: $${cartTotal.toLocaleString()}`;
    
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${process.env.NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "text",
                text: {
                    body: message
                }
            })
        });

        if (!response.ok) {
            console.error('❌ Error enviando feedback:', await response.json());
        }
    } catch (error) {
        console.error('❌ Error en sendCartFeedback:', error);
    }
}

// ===== FLOW PRINCIPAL DEL CARRITO CON LISTAS INTERACTIVAS =====

export const flowCarritoInteractivo = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAction(async (ctx, { state, provider }) => {
        console.log('🛒 === INICIANDO CARRITO INTERACTIVO ===');

        try {
            // ✅ PASO 1: ENVIAR CATÁLOGO OFICIAL DE WHATSAPP PRIMERO
            console.log('📋 Enviando catálogo oficial de WhatsApp...');
            
            const catalogPayload = {
                messaging_product: "whatsapp",
                to: ctx.from,
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    body: {
                        text: "🛒 *TodoMarket - Catálogo Oficial*\n\n📦 Explora nuestros productos y agrega al carrito:\n\n👇 Presiona para abrir el catálogo"
                    },
                    footer: {
                        text: "Selecciona productos → Genera pedido automáticamente"
                    },
                    action: {
                        name: "catalog_message"
                        // Note: No incluimos catalog_id para usar el catálogo por defecto
                    }
                }
            };

            const accessToken = process.env.JWT_TOKEN;
            const phoneNumberId = process.env.NUMBER_ID;
            
            const catalogResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(catalogPayload)
            });

            if (catalogResponse.ok) {
                const result = await catalogResponse.json();
                console.log('✅ CATÁLOGO OFICIAL ENVIADO:', result.messages[0].id);
                
                // ✅ PASO 2: Enviar mensaje de seguimiento para navegación alternativa
                setTimeout(async () => {
                    await provider.sendText(ctx.from, 
                        '📱 *¿Problemas para ver el catálogo?*\n\nTambién puedes navegar por categorías usando el sistema interactivo:\n\n👇 Responde "categorias" para ver las opciones'
                    );
                }, 2000);
                
            } else {
                const errorData = await catalogResponse.json();
                console.error('❌ Error enviando catálogo oficial:', errorData);
                
                // Si falla el catálogo, usar el sistema de categorías como fallback
                throw new Error('Catálogo oficial no disponible');
            }

        } catch (error) {
            console.error('❌ Error con catálogo oficial, usando sistema de categorías:', error);
            
            // ✅ FALLBACK: Sistema de categorías interactivas
            try {
                // Sincronizar productos desde Meta API
                const productsByCategory = await syncAndGetProducts(CATALOG_ID, ACCESS_TOKEN);
                
                if (Object.keys(productsByCategory).length === 0) {
                    return await provider.sendText(ctx.from, 
                        '❌ *Error temporal*\n\nNo pudimos cargar el catálogo.\nIntenta en unos minutos o contacta al +56 9 7964 3935'
                    );
                }

                // Guardar productos en el state
                await state.update({ 
                    productsByCategory,
                    lastSync: new Date().toISOString()
                });

                // Generar y enviar lista de categorías como alternativa
                const categoriesList = generateCategoriesList(productsByCategory);
                
                if (!categoriesList) {
                    return await provider.sendText(ctx.from,
                        '⚠️ *Catálogo vacío*\n\nContacta al +56 9 7964 3935'
                    );
                }

                await provider.sendText(ctx.from,
                    '🛒 *Navegación por categorías*\n\nComo alternativa, puedes explorar nuestros productos por categorías:'
                );

                console.log('✅ Enviando categorías del carrito interactivo...');
                await sendInteractiveMessage(ctx.from, categoriesList);

            } catch (fallbackError) {
                console.error('❌ Error en fallback de categorías:', fallbackError);
                await provider.sendText(ctx.from,
                    '❌ *Error técnico*\n\nContacta al +56 9 7964 3935'
                );
            }
        }
    });

// ===== FLOW PARA ACTIVAR CATEGORÍAS CUANDO EL CATÁLOGO NO FUNCIONA =====

export const flowActivarCategorias = addKeyword<Provider, Database>(['categorias', 'categorías', 'categoria', 'categoría', 'menu', 'productos'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('📋 Usuario solicita navegación por categorías...');

        try {
            // Sincronizar productos desde Meta API
            const productsByCategory = await syncAndGetProducts(CATALOG_ID, ACCESS_TOKEN);
            
            if (Object.keys(productsByCategory).length === 0) {
                return await provider.sendText(ctx.from, 
                    '❌ *Error temporal*\n\nNo pudimos cargar las categorías.\nIntenta en unos minutos o contacta al +56 9 7964 3935'
                );
            }

            // Guardar productos en el state
            await state.update({ 
                productsByCategory,
                lastSync: new Date().toISOString(),
                navigationType: 'categories' // Indicar que está usando navegación por categorías
            });

            // Generar y enviar lista de categorías
            const categoriesList = generateCategoriesList(productsByCategory);
            
            if (!categoriesList) {
                return await provider.sendText(ctx.from,
                    '⚠️ *Categorías vacías*\n\nContacta al +56 9 7964 3935'
                );
            }

            await provider.sendText(ctx.from,
                '🛒 *Sistema de navegación por categorías*\n\nSelecciona una categoría para ver los productos disponibles:'
            );

            console.log('✅ Enviando categorías por solicitud del usuario...');
            await sendInteractiveMessage(ctx.from, categoriesList);

        } catch (error) {
            console.error('❌ Error activando categorías:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nContacta al +56 9 7964 3935'
            );
        }
    });

// ===== FLOW PARA MANEJAR CATEGORÍAS CON LISTAS MEJORADAS =====

export const flowCategoriasInteractivas = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;

        if (!userInput.startsWith('categoria_')) {
            return; // No es una categoría
        }

        console.log('📋 Categoría seleccionada:', userInput);

        try {
            const categoria = userInput.replace('categoria_', '');
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};
            const productos = productsByCategory[categoria] || [];

            if (productos.length === 0) {
                return await provider.sendText(ctx.from,
                    '⚠️ *Categoría vacía*\n\nSelecciona otra categoría del menú anterior.'
                );
            }

            // Guardar categoría actual
            await state.update({ 
                currentCategory: categoria,
                currentProducts: productos
            });

            // Obtener carrito actual
            const currentCart: ItemCarrito[] = userState?.cart || [];
            
            // Enviar mensaje de estado del carrito si tiene productos
            const { total, itemCount } = getCartTotal(currentCart);
            if (itemCount > 0) {
                await provider.sendText(ctx.from, [
                    `🛒 *Estado del Carrito*`,
                    '',
                    `📦 Productos: ${itemCount}`,
                    `💰 Total: $${total.toLocaleString()}`,
                    '',
                    `📋 Explorando: ${categoria.toUpperCase()}`,
                    'Selecciona productos para agregar:'
                ].join('\n'));
            }

            // Generar lista de productos con carrito visible
            const productsList = generateProductsListWithCart(productos, categoria, currentCart);

            console.log(`✅ Enviando ${productos.length} productos de: ${categoria} con carrito visible`);
            await sendInteractiveMessage(ctx.from, productsList);

        } catch (error) {
            console.error('❌ Error en flowCategoriasInteractivas:', error);
            await provider.sendText(ctx.from, '❌ Error. Intenta nuevamente.');
        }
    });

// ===== FLOW PARA AGREGAR PRODUCTOS DESDE LA LISTA =====

export const flowAgregarProductoInteractivo = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;

        // === MANEJO DE BOTONES RÁPIDOS ===
        if (userInput.startsWith('quick_add_1_') || userInput.startsWith('quick_remove_1_') || userInput.startsWith('hybrid_')) {
            console.log('� Acción rápida detectada:', userInput);

            try {
                const userState = await state.getMyState();
                const productsByCategory = userState?.productsByCategory || {};
                const currentCart: ItemCarrito[] = userState?.cart || [];

                let retailerId = '';
                let action = '';

                if (userInput.startsWith('quick_add_1_')) {
                    retailerId = userInput.replace('quick_add_1_', '');
                    action = 'add';
                } else if (userInput.startsWith('quick_remove_1_')) {
                    retailerId = userInput.replace('quick_remove_1_', '');
                    action = 'remove';
                } else if (userInput.startsWith('hybrid_')) {
                    retailerId = userInput.replace('hybrid_', '');
                    action = 'buttons'; // Mostrar botones rápidos
                }

                // Buscar el producto
                const product = findProductByRetailerId(productsByCategory, retailerId);
                if (!product) {
                    return await provider.sendText(ctx.from, '❌ Producto no disponible.');
                }

                const existingItem = currentCart.find(item => item.retailerId === retailerId);
                let updatedCart: ItemCarrito[] = currentCart;
                let currentQuantity = existingItem ? existingItem.quantity : 0;

                if (action === 'buttons') {
                    // Mostrar botones rápidos
                    const quickButtons = generateQuickActionButtons(product, currentQuantity);
                    await sendInteractiveMessage(ctx.from, quickButtons);
                    return;
                } else if (action === 'add') {
                    // Agregar 1 unidad
                    if (existingItem) {
                        existingItem.quantity += 1;
                        currentQuantity = existingItem.quantity;
                    } else {
                        updatedCart = addToCart(currentCart, product, 1);
                        currentQuantity = 1;
                    }
                } else if (action === 'remove') {
                    // Quitar 1 unidad
                    if (existingItem && existingItem.quantity > 1) {
                        existingItem.quantity -= 1;
                        currentQuantity = existingItem.quantity;
                    } else if (existingItem && existingItem.quantity === 1) {
                        updatedCart = removeFromCart(currentCart, retailerId);
                        currentQuantity = 0;
                    } else {
                        return await provider.sendText(ctx.from, '❌ El producto no está en el carrito.');
                    }
                }

                // Actualizar carrito
                await state.update({ cart: updatedCart });

                // Enviar feedback dinámico
                const { total } = getCartTotal(updatedCart);
                await sendCartFeedback(ctx.from, action, product.name, currentQuantity, total);

                return;
            } catch (error) {
                console.error('❌ Error en acción rápida:', error);
                return await provider.sendText(ctx.from, '❌ Error procesando acción. Intenta de nuevo.');
            }
        }

        // === MANEJO TRADICIONAL DE PRODUCTOS ===
        if (!userInput.startsWith('product_')) {
            return; // No es un producto
        }

        console.log('🛍️ Producto seleccionado:', userInput);

        try {
            const retailerId = userInput.replace('product_', '');
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};
            const currentCart: ItemCarrito[] = userState?.cart || [];

            // Buscar el producto
            const product = findProductByRetailerId(productsByCategory, retailerId);
            if (!product) {
                return await provider.sendText(ctx.from, '❌ Producto no disponible.');
            }

            const existingItem = currentCart.find(item => item.retailerId === retailerId);
            const currentQuantity = existingItem ? existingItem.quantity : 0;

            // Mostrar botones rápidos en lugar de agregar directamente
            const quickButtons = generateQuickActionButtons(product, currentQuantity);
            await sendInteractiveMessage(ctx.from, quickButtons);

        } catch (error) {
            console.error('❌ Error en flowAgregarProductoInteractivo:', error);
            await provider.sendText(ctx.from, '❌ Error agregando producto. Intenta de nuevo.');
        }
    });

// ===== FLOW PARA VER CARRITO DETALLADO CON LISTA INTERACTIVA =====

export const flowVerCarritoInteractivo = addKeyword<Provider, Database>(['ver_carrito_detallado'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🔍 Ver carrito interactivo solicitado');

        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            // Generar lista interactiva del carrito
            const cartList = generateCartManagementList(currentCart);
            await sendInteractiveMessage(ctx.from, cartList);

        } catch (error) {
            console.error('❌ Error ver carrito interactivo:', error);
            await provider.sendText(ctx.from, '❌ Error mostrando carrito.');
        }
    });

// ===== FLOW PARA GESTIONAR PRODUCTOS INDIVIDUALES DEL CARRITO =====

export const flowGestionarProducto = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;

        if (!userInput.startsWith('manage_')) {
            return; // No es gestión de producto
        }

        console.log('⚙️ Gestionando producto:', userInput);

        try {
            const index = parseInt(userInput.replace('manage_', ''));
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (index < 0 || index >= currentCart.length) {
                return await provider.sendText(ctx.from, '❌ Producto no encontrado.');
            }

            const product = currentCart[index];
            
            // Generar lista de opciones de cantidad
            const quantityList = generateQuantityOptions(product.productName, product.quantity, index);
            await sendInteractiveMessage(ctx.from, quantityList);

        } catch (error) {
            console.error('❌ Error gestionando producto:', error);
            await provider.sendText(ctx.from, '❌ Error gestionando producto.');
        }
    });

// ===== FLOW PARA CAMBIAR CANTIDADES DESDE LA LISTA =====

export const flowCambiarCantidadInteractiva = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;

        // === MANEJO DE CANTIDAD ESPECÍFICA ===
        if (userInput.startsWith('set_quantity_')) {
            console.log('🔢 Solicitando cantidad específica:', userInput);

            try {
                const retailerId = userInput.replace('set_quantity_', '');
                const userState = await state.getMyState();
                const productsByCategory = userState?.productsByCategory || {};
                const currentCart: ItemCarrito[] = userState?.cart || [];

                // Buscar el producto
                const product = findProductByRetailerId(productsByCategory, retailerId);
                if (!product) {
                    return await provider.sendText(ctx.from, '❌ Producto no disponible.');
                }

                const existingItem = currentCart.find(item => item.retailerId === retailerId);
                const currentQuantity = existingItem ? existingItem.quantity : 0;

                // Mostrar opciones de cantidad específica
                const quantityList = generateQuantityOptions(product.name, currentQuantity, -1); // Usar -1 para indicar que es cantidad específica
                await sendInteractiveMessage(ctx.from, quantityList);

                return;
            } catch (error) {
                console.error('❌ Error en cantidad específica:', error);
                return await provider.sendText(ctx.from, '❌ Error procesando cantidad. Intenta de nuevo.');
            }
        }

        // === MANEJO TRADICIONAL DE CANTIDADES ===
        if (!userInput.startsWith('quantity_')) {
            return; // No es cambio de cantidad
        }

        console.log('📝 Cambiando cantidad:', userInput);

        try {
            // Extraer índice y nueva cantidad: quantity_index_newQuantity
            const parts = userInput.split('_');
            if (parts.length !== 3) return;

            const index = parseInt(parts[1]);
            const newQuantity = parseInt(parts[2]);

            const userState = await state.getMyState();
            let currentCart: ItemCarrito[] = userState?.cart || [];

            if (index < 0 || index >= currentCart.length) {
                return await provider.sendText(ctx.from, '❌ Producto no encontrado.');
            }

            // Actualizar cantidad
            const product = currentCart[index];
            const oldQuantity = product.quantity;
            currentCart[index].quantity = newQuantity;
            
            await state.update({ cart: currentCart });

            const { total } = getCartTotal(currentCart);
            const newSubtotal = product.price * newQuantity;

            await provider.sendText(ctx.from, [
                `✅ *Cantidad actualizada*`,
                '',
                `📦 ${product.productName}`,
                `🔄 ${oldQuantity} → ${newQuantity} unidades`,
                `💵 Nuevo subtotal: $${newSubtotal.toLocaleString()}`,
                '',
                `🛒 *Total carrito: $${total.toLocaleString()}*`
            ].join('\n'));

            // Volver a mostrar el carrito
            const cartList = generateCartManagementList(currentCart);
            await sendInteractiveMessage(ctx.from, cartList);

        } catch (error) {
            console.error('❌ Error cambiando cantidad:', error);
            await provider.sendText(ctx.from, '❌ Error cambiando cantidad.');
        }
    });

// ===== FLOW PARA ELIMINAR PRODUCTOS DESDE LA LISTA =====

export const flowEliminarProductoInteractivo = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;

        if (!userInput.startsWith('remove_')) {
            return; // No es eliminación
        }

        console.log('🗑️ Eliminando producto:', userInput);

        try {
            const index = parseInt(userInput.replace('remove_', ''));
            const userState = await state.getMyState();
            let currentCart: ItemCarrito[] = userState?.cart || [];

            if (index < 0 || index >= currentCart.length) {
                return await provider.sendText(ctx.from, '❌ Producto no encontrado.');
            }

            // Eliminar producto
            const productToRemove = currentCart[index];
            currentCart = currentCart.filter((_, i) => i !== index);
            
            await state.update({ cart: currentCart });

            const { total } = getCartTotal(currentCart);

            await provider.sendText(ctx.from, [
                `🗑️ *Producto eliminado*`,
                '',
                `❌ ${productToRemove.productName}`,
                `🔢 Cantidad eliminada: ${productToRemove.quantity}`,
                '',
                `🛒 *Nuevo total: $${total.toLocaleString()}*`
            ].join('\n'));

            // Volver a mostrar el carrito actualizado
            const cartList = generateCartManagementList(currentCart);
            await sendInteractiveMessage(ctx.from, cartList);

        } catch (error) {
            console.error('❌ Error eliminando producto:', error);
            await provider.sendText(ctx.from, '❌ Error eliminando producto.');
        }
    });

// ===== FLOWS PARA ACCIONES GENERALES DEL CARRITO =====

export const flowSeguirComprandoInteractivo = addKeyword<Provider, Database>(['seguir_comprando'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🔄 Seguir comprando desde carrito interactivo');

        try {
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};

            // Mostrar categorías de nuevo
            const categoriesList = generateCategoriesList(productsByCategory);
            
            await provider.sendText(ctx.from, '🔄 *Continuando compras...*');
            
            if (categoriesList) {
                await sendInteractiveMessage(ctx.from, categoriesList);
            }

        } catch (error) {
            console.error('❌ Error seguir comprando:', error);
            await provider.sendText(ctx.from, '❌ Error. Intenta nuevamente.');
        }
    });

export const flowVaciarCarritoInteractivo = addKeyword<Provider, Database>(['vaciar_carrito'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🗑️ Vaciando carrito desde lista');

        try {
            await state.update({ cart: [] });

            await provider.sendText(ctx.from, [
                '🗑️ *Carrito vaciado*',
                '',
                'Todos los productos han sido eliminados.',
                '',
                '¿Deseas seguir comprando?'
            ].join('\n'));

            // Mostrar categorías
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};
            const categoriesList = generateCategoriesList(productsByCategory);
            
            if (categoriesList) {
                await sendInteractiveMessage(ctx.from, categoriesList);
            }

        } catch (error) {
            console.error('❌ Error vaciando carrito:', error);
            await provider.sendText(ctx.from, '❌ Error vaciando carrito.');
        }
    });

export const flowConfirmarPedidoInteractivo = addKeyword<Provider, Database>(['confirmar_pedido'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('✅ Confirmación de pedido desde carrito interactivo');

        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from, '🛒 *Carrito vacío*\n\nAgrega productos antes de confirmar.');
            }

            const { total, itemCount } = getCartTotal(currentCart);

            // Generar resumen de pedido
            let pedidoResumen = [
                '✅ *RESUMEN DE TU PEDIDO*',
                '═══════════════════════════',
                ''
            ];

            currentCart.forEach((item, index) => {
                const subtotal = item.price * item.quantity;
                pedidoResumen.push(`${index + 1}. *${item.productName}*`);
                pedidoResumen.push(`   📦 ${item.quantity} unidades × $${item.price.toLocaleString()}`);
                pedidoResumen.push(`   💵 Subtotal: $${subtotal.toLocaleString()}`);
                pedidoResumen.push('');
            });

            pedidoResumen.push('═══════════════════════════');
            pedidoResumen.push(`💰 *TOTAL A PAGAR: $${total.toLocaleString()} CLP*`);
            pedidoResumen.push(`📦 *${itemCount} productos en total*`);
            pedidoResumen.push('');
            pedidoResumen.push('📞 *Para finalizar tu pedido:*');
            pedidoResumen.push('Contacta directamente al:');
            pedidoResumen.push('*+56 9 7964 3935*');
            pedidoResumen.push('');
            pedidoResumen.push('🚚 *Horario de entrega:*');
            pedidoResumen.push('2:00 PM - 10:00 PM');
            pedidoResumen.push('');
            pedidoResumen.push('✅ *¡Gracias por tu compra!*');

            await provider.sendText(ctx.from, pedidoResumen.join('\n'));

            // Limpiar carrito después de confirmar
            await state.update({ cart: [] });

        } catch (error) {
            console.error('❌ Error confirmando pedido:', error);
            await provider.sendText(ctx.from, '❌ Error procesando pedido.');
        }
    });

export const flowVolverCarrito = addKeyword<Provider, Database>(['back_to_cart'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('↩️ Volviendo al carrito');

        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            const cartList = generateCartManagementList(currentCart);
            await sendInteractiveMessage(ctx.from, cartList);

        } catch (error) {
            console.error('❌ Error volviendo al carrito:', error);
            await provider.sendText(ctx.from, '❌ Error.');
        }
    });

export const flowFinalizarCompra = addKeyword<Provider, Database>(['finalizar_compra'])
    .addAction(async (ctx, { state, provider, gotoFlow }) => {
        console.log('🏁 Finalizando compra desde productos');

        // Redirigir al flow de confirmar pedido
        return gotoFlow(flowConfirmarPedidoInteractivo);
    });

// ===== EXPORTAR TODOS LOS FLOWS INTERACTIVOS =====

// ===== EXPORTAR FLOWS PRINCIPALES (SIN CONFLICTOS EVENTS.ACTION) =====

export const carritoFlowsInteractivos = [
    flowCarritoInteractivo,               // Flow principal
    flowVerCarritoInteractivo,           // Ver carrito con lista interactiva
    flowSeguirComprandoInteractivo,      // Continuar comprando
    flowVaciarCarritoInteractivo,        // Vaciar carrito
    flowConfirmarPedidoInteractivo,      // Confirmar pedido
    flowVolverCarrito,                   // Volver al carrito
    flowFinalizarCompra                  // Finalizar compra
    // NOTA: Los flows con EVENTS.ACTION se movieron a carrito-acciones.ts
];

// ===== NUEVO FLOW MEJORADO PARA SELECCIÓN INTERACTIVA =====
export const flowSeleccionInteractiva = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;

        console.log('🛍️ === PROCESANDO SELECCIÓN INTERACTIVA ===');
        console.log('📱 Input recibido:', userInput);

        try {
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};
            const currentCart: ItemCarrito[] = userState?.cart || [];

            // === MANEJAR SELECCIÓN DE PRODUCTO ===
            if (userInput.startsWith('select_')) {
                const retailerId = userInput.replace('select_', '');
                console.log('📦 Producto seleccionado:', retailerId);

                // Buscar el producto
                const product = findProductByRetailerId(productsByCategory, retailerId);
                if (!product) {
                    return await provider.sendText(ctx.from, '❌ Producto no disponible.');
                }

                // Obtener cantidad actual en carrito
                const existingItem = currentCart.find(item => item.retailerId === retailerId);
                const currentQuantity = existingItem ? existingItem.quantity : 0;

                // Mostrar selector de cantidad
                const quantitySelector = generateQuantitySelector(product, currentQuantity);
                await sendInteractiveMessage(ctx.from, quantitySelector);
                return;
            }

            // === MANEJAR AGREGAR CANTIDAD ===
            if (userInput.startsWith('add_qty_')) {
                const parts = userInput.split('_');
                if (parts.length !== 4) return;

                const retailerId = parts[2];
                const quantity = parseInt(parts[3]);
                
                console.log(`📦 Agregando ${quantity} unidades del producto:`, retailerId);

                // Buscar el producto
                const product = findProductByRetailerId(productsByCategory, retailerId);
                if (!product) {
                    return await provider.sendText(ctx.from, '❌ Producto no disponible.');
                }

                // Agregar al carrito
                let updatedCart = [...currentCart];
                const existingItem = updatedCart.find(item => item.retailerId === retailerId);

                if (existingItem) {
                    existingItem.quantity += quantity;
                } else {
                    updatedCart = addToCart(currentCart, product, quantity);
                }

                await state.update({ cart: updatedCart });

                // Calcular totales
                const { total, itemCount } = getCartTotal(updatedCart);
                const newQuantity = updatedCart.find(item => item.retailerId === retailerId)?.quantity || 0;

                // Enviar confirmación con estado del carrito
                await provider.sendText(ctx.from, [
                    `✅ *Producto agregado al carrito*`,
                    '',
                    `📦 ${product.name}`,
                    `🔢 Cantidad agregada: ${quantity}`,
                    `📊 Total en carrito: ${newQuantity} unidades`,
                    `💰 Subtotal: $${(product.price * newQuantity).toLocaleString()}`,
                    '',
                    `🛒 *Carrito Total: ${itemCount} productos - $${total.toLocaleString()}*`,
                    '',
                    '👇 *¿Qué quieres hacer ahora?*'
                ].join('\n'));

                // Volver a mostrar productos de la categoría actual con carrito actualizado
                const categoria = userState?.currentCategory || '';
                const productos = userState?.currentProducts || [];
                
                if (productos.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa breve
                    const productsList = generateProductsListWithCart(productos, categoria, updatedCart);
                    await sendInteractiveMessage(ctx.from, productsList);
                }
                return;
            }

            // === MANEJAR OTRAS ACCIONES ===
            if (userInput.startsWith('remove_all_')) {
                const retailerId = userInput.replace('remove_all_', '');
                console.log('🗑️ Eliminando producto del carrito:', retailerId);

                const productName = currentCart.find(item => item.retailerId === retailerId)?.productName || 'Producto';
                const updatedCart = removeFromCart(currentCart, retailerId);
                
                await state.update({ cart: updatedCart });

                const { total, itemCount } = getCartTotal(updatedCart);

                await provider.sendText(ctx.from, [
                    `🗑️ *Producto eliminado del carrito*`,
                    '',
                    `📦 ${productName}`,
                    '',
                    `🛒 *Carrito: ${itemCount} productos - $${total.toLocaleString()}*`
                ].join('\n'));

                // Volver a mostrar productos
                const categoria = userState?.currentCategory || '';
                const productos = userState?.currentProducts || [];
                
                if (productos.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const productsList = generateProductsListWithCart(productos, categoria, updatedCart);
                    await sendInteractiveMessage(ctx.from, productsList);
                }
                return;
            }

            if (userInput === 'back_to_products') {
                const categoria = userState?.currentCategory || '';
                const productos = userState?.currentProducts || [];
                
                if (productos.length > 0) {
                    const productsList = generateProductsListWithCart(productos, categoria, currentCart);
                    await sendInteractiveMessage(ctx.from, productsList);
                }
                return;
            }

            if (userInput === 'view_cart_summary') {
                const cartView = generateCartDetailView(currentCart);
                await sendInteractiveMessage(ctx.from, cartView);
                return;
            }

            if (userInput === 'back_to_categories') {
                const categoriesList = generateCategoriesList(productsByCategory);
                if (categoriesList) {
                    await sendInteractiveMessage(ctx.from, categoriesList);
                }
                return;
            }

            if (userInput === 'finalize_purchase' || userInput === 'checkout_order') {
                if (currentCart.length === 0) {
                    return await provider.sendText(ctx.from, '❌ Tu carrito está vacío. Agrega productos antes de finalizar la compra.');
                }

                console.log('✅ Iniciando proceso de checkout');
                
                const { total, itemCount } = getCartTotal(currentCart);
                const orderSummary = generateCartSummary(currentCart);

                await provider.sendText(ctx.from, [
                    '🛒 *Resumen de tu pedido*',
                    '',
                    orderSummary,
                    '',
                    `📦 Total de productos: ${itemCount}`,
                    `💰 Total a pagar: $${total.toLocaleString()}`,
                    '',
                    '📍 *Siguiente paso: Dirección de entrega*',
                    '',
                    'Ingresa tu dirección completa:'
                ].join('\n'));

                return;
            }

        } catch (error) {
            console.error('❌ Error en flowSeleccionInteractiva:', error);
            await provider.sendText(ctx.from, '❌ Error procesando selección. Intenta de nuevo.');
        }
    });
