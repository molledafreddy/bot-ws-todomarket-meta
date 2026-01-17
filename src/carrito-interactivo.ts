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

// ===== GENERAR LISTA INTERACTIVA DE PRODUCTOS CON CANTIDADES =====
function generateProductListWithQuantities(products: ProductoCarrito[], categoria: string, currentCart: ItemCarrito[]): any {
    const rows = products.map((product, index) => {
        // Buscar si el producto ya está en el carrito
        const cartItem = currentCart.find(item => item.retailerId === product.retailerId);
        const currentQuantity = cartItem ? cartItem.quantity : 0;
        
        return {
            id: `product_${product.retailerId}`,
            title: `${product.name}`,
            description: `$${product.price.toLocaleString()} - En carrito: ${currentQuantity}`
        };
    });

    // Agregar opciones de gestión del carrito
    rows.push({
        id: 'ver_carrito_detallado',
        title: '🛒 Ver Carrito Completo',
        description: 'Ver y gestionar productos del carrito'
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
                text: "Selecciona un producto para agregarlo al carrito o gestiona tu pedido:"
            },
            footer: {
                text: "TodoMarket - Selecciona una opción"
            },
            action: {
                button: "Ver opciones",
                sections: [
                    {
                        title: "Productos disponibles",
                        rows: rows.slice(0, -2) // Productos sin las opciones del carrito
                    },
                    {
                        title: "Gestión del carrito",
                        rows: rows.slice(-2) // Solo las opciones del carrito
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

// ===== FLOW PRINCIPAL DEL CARRITO CON LISTAS INTERACTIVAS =====

export const flowCarritoInteractivo = addKeyword<Provider, Database>(['carrito_interactivo', 'tienda', 'compras_nuevas'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🛒 === INICIANDO CARRITO INTERACTIVO ===');

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

            // Generar y enviar lista de categorías
            const categoriesList = generateCategoriesList(productsByCategory);
            
            if (!categoriesList) {
                return await provider.sendText(ctx.from,
                    '⚠️ *Catálogo vacío*\n\nContacta al +56 9 7964 3935'
                );
            }

            console.log('✅ Enviando categorías del carrito interactivo...');
            await sendInteractiveMessage(ctx.from, categoriesList);

        } catch (error) {
            console.error('❌ Error en flowCarritoInteractivo:', error);
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
            
            // Generar lista de productos con cantidades visibles
            const productsList = generateProductListWithQuantities(productos, categoria, currentCart);

            console.log(`✅ Enviando ${productos.length} productos de: ${categoria}`);
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

            // Agregar al carrito (o aumentar cantidad si ya existe)
            const existingItem = currentCart.find(item => item.retailerId === retailerId);
            let updatedCart: ItemCarrito[];

            if (existingItem) {
                // Aumentar cantidad
                existingItem.quantity += 1;
                updatedCart = currentCart;
            } else {
                // Agregar nuevo producto
                updatedCart = addToCart(currentCart, product, 1);
            }
            
            await state.update({ cart: updatedCart });

            // Calcular totales
            const { total, itemCount } = getCartTotal(updatedCart);
            const currentQuantity = updatedCart.find(item => item.retailerId === retailerId)?.quantity || 0;

            console.log(`✅ Producto agregado: ${product.name} (${currentQuantity} unidades) - Total: $${total}`);

            // Mostrar confirmación y volver a la lista de productos actualizada
            await provider.sendText(ctx.from, [
                `✅ *¡${product.name} agregado!*`,
                '',
                `📦 Cantidad en carrito: ${currentQuantity}`,
                `💰 Subtotal: $${(product.price * currentQuantity).toLocaleString()}`,
                '',
                `🛒 *Total carrito: $${total.toLocaleString()} (${itemCount} productos)*`
            ].join('\n'));

            // Volver a mostrar la lista de productos actualizada
            const categoria = userState?.currentCategory || '';
            const productos = userState?.currentProducts || [];
            if (productos.length > 0) {
                const productsList = generateProductListWithQuantities(productos, categoria, updatedCart);
                await sendInteractiveMessage(ctx.from, productsList);
            }

        } catch (error) {
            console.error('❌ Error agregando producto:', error);
            await provider.sendText(ctx.from, '❌ Error agregando producto.');
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
