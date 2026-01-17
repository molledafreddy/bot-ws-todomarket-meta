/**
 * 🛒 CARRITO DE COMPRAS SIMPLIFICADO Y FUNCIONAL
 * Sistema directo y fácil de usar para TodoMarket
 */

import { addKeyword, EVENTS } from '@builderbot/bot';
import { MetaProvider as Provider } from '@builderbot/provider-meta';
import { MongoAdapter as Database } from '@builderbot/database-mongo';

// Importar funciones del carrito existentes
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

// ===== FUNCIÓN PARA MOSTRAR MENÚ DEL CARRITO =====
function getCarritoMenu(): string {
    return [
        '═══════════════════════════',
        '🎛️ *MENÚ DEL CARRITO*',
        '═══════════════════════════',
        '',
        '📋 *COMANDOS DISPONIBLES:*',
        '',
        '🔍 Escribe: *ver carrito*',
        '   → Ver todos los productos agregados',
        '',
        '🗑️ Escribe: *eliminar 1* (o 2, 3, etc.)',
        '   → Quitar producto específico',
        '',
        '📝 Escribe: *cantidad 1 5* (producto 1, 5 unidades)',
        '   → Cambiar cantidades',
        '',
        '🛍️ Escribe: *seguir comprando*',
        '   → Volver al catálogo',
        '',
        '✅ Escribe: *confirmar pedido*',
        '   → Finalizar compra',
        '',
        '🔄 Escribe: *vaciar carrito*',
        '   → Empezar de nuevo',
        '',
        '💡 *¡Usa exactamente estos comandos!*'
    ].join('\n');
}

// ===== FLOW PRINCIPAL DEL CARRITO SIMPLIFICADO =====

export const flowCarritoSimple = addKeyword<Provider, Database>(['carrito_simple', 'compras'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🛒 === INICIANDO CARRITO SIMPLE ===');

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

            console.log('✅ Enviando categorías del carrito simple...');
            await sendInteractiveMessage(ctx.from, categoriesList);

        } catch (error) {
            console.error('❌ Error en flowCarritoSimple:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nContacta al +56 9 7964 3935'
            );
        }
    });

// ===== FLOW PARA CATEGORÍAS =====

export const flowCategorias = addKeyword<Provider, Database>(EVENTS.ACTION)
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
                    '⚠️ *Categoría vacía*\n\nEscribe *seguir comprando* para ver otras categorías.'
                );
            }

            // Guardar productos actuales
            await state.update({ 
                currentCategory: categoria,
                currentProducts: productos
            });

            // Generar lista de productos con info del carrito
            const userState2 = await state.getMyState();
            const currentCart: ItemCarrito[] = userState2?.cart || [];
            const productsList = generateProductsList(productos, categoria, currentCart);

            console.log(`✅ Enviando ${productos.length} productos de: ${categoria}`);
            await sendInteractiveMessage(ctx.from, productsList);

        } catch (error) {
            console.error('❌ Error en flowCategorias:', error);
            await provider.sendText(ctx.from, '❌ Error. Escribe *seguir comprando*');
        }
    });

// ===== FLOW PARA AGREGAR PRODUCTOS =====

export const flowAgregarProducto = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;

        if (!userInput.startsWith('producto_')) {
            return; // No es un producto
        }

        console.log('🛍️ Producto seleccionado:', userInput);

        try {
            const retailerId = userInput.replace('producto_', '');
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};
            const currentCart: ItemCarrito[] = userState?.cart || [];

            // Buscar el producto
            const product = findProductByRetailerId(productsByCategory, retailerId);
            if (!product) {
                return await provider.sendText(ctx.from, '❌ Producto no disponible.\nEscribe *seguir comprando*');
            }

            // Agregar al carrito
            const updatedCart = addToCart(currentCart, product, 1);
            await state.update({ cart: updatedCart });

            // Calcular totales
            const { total, itemCount } = getCartTotal(updatedCart);

            console.log(`✅ Producto agregado: ${product.name} - Total: $${total}`);

            // Mensaje de confirmación con menú claro
            await provider.sendText(ctx.from, [
                `✅ *¡Producto agregado exitosamente!*`,
                '',
                `🛍️ *${product.name}*`,
                `💰 $${product.price.toLocaleString()} ${product.currency}`,
                '',
                `🛒 *Tu carrito: ${itemCount} productos - $${total.toLocaleString()}*`,
                '',
                getCarritoMenu()
            ].join('\n'));

        } catch (error) {
            console.error('❌ Error agregando producto:', error);
            await provider.sendText(ctx.from, '❌ Error. Escribe *seguir comprando*');
        }
    });

// ===== FLOW PARA VER CARRITO =====

export const flowVerCarrito = addKeyword<Provider, Database>(['ver carrito', 'carrito', 'mi carrito'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🔍 Ver carrito solicitado');

        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from, [
                    '🛒 *Tu carrito está vacío*',
                    '',
                    'Escribe *seguir comprando* para agregar productos.',
                    '',
                    getCarritoMenu()
                ].join('\n'));
            }

            // Mostrar productos del carrito
            const { total, itemCount } = getCartTotal(currentCart);
            
            let carritoDetalle = [
                '🛒 *TU CARRITO DE COMPRAS*',
                '═══════════════════════════',
                ''
            ];
            
            currentCart.forEach((item, index) => {
                carritoDetalle.push(`${index + 1}. *${item.productName}*`);
                carritoDetalle.push(`   💰 $${item.price.toLocaleString()} c/u`);
                carritoDetalle.push(`   📦 ${item.quantity} unidad(es)`);
                carritoDetalle.push(`   💵 Subtotal: $${(item.price * item.quantity).toLocaleString()}`);
                carritoDetalle.push('');
            });
            
            carritoDetalle.push('═══════════════════════════');
            carritoDetalle.push(`💰 *TOTAL: $${total.toLocaleString()} CLP*`);
            carritoDetalle.push(`📦 *${itemCount} productos*`);
            carritoDetalle.push('');
            carritoDetalle.push(getCarritoMenu());

            await provider.sendText(ctx.from, carritoDetalle.join('\n'));

        } catch (error) {
            console.error('❌ Error ver carrito:', error);
            await provider.sendText(ctx.from, '❌ Error mostrando carrito.');
        }
    });

// ===== FLOW PARA ELIMINAR PRODUCTOS =====

export const flowEliminarProducto = addKeyword<Provider, Database>(['eliminar'])
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body.toLowerCase().trim();
        const match = userInput.match(/eliminar\s+(\d+)/);
        
        if (!match) {
            return await provider.sendText(ctx.from, [
                '❓ *Uso correcto:*',
                '',
                'Para eliminar: *eliminar 1* (primer producto)',
                'Para eliminar: *eliminar 2* (segundo producto)',
                '',
                'Escribe *ver carrito* para ver la lista numerada.'
            ].join('\n'));
        }

        const itemNumber = parseInt(match[1]);
        console.log(`🗑️ Eliminando producto ${itemNumber}`);

        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from, 
                    '🛒 *Carrito vacío*\n\nEscribe *seguir comprando* para agregar productos.'
                );
            }

            if (itemNumber < 1 || itemNumber > currentCart.length) {
                return await provider.sendText(ctx.from,
                    `❌ *Número inválido*\n\nTienes ${currentCart.length} productos.\nEscribe *ver carrito* para ver la lista.`
                );
            }

            // Eliminar producto por índice
            const productToRemove = currentCart[itemNumber - 1];
            const updatedCart = currentCart.filter((_, index) => index !== (itemNumber - 1));
            await state.update({ cart: updatedCart });

            const { total } = getCartTotal(updatedCart);

            await provider.sendText(ctx.from, [
                `🗑️ *Producto eliminado*`,
                '',
                `❌ ${productToRemove.productName}`,
                '',
                `🛒 *Nuevo total: $${total.toLocaleString()}*`,
                '',
                getCarritoMenu()
            ].join('\n'));

        } catch (error) {
            console.error('❌ Error eliminando producto:', error);
            await provider.sendText(ctx.from, '❌ Error eliminando producto.');
        }
    });

// ===== FLOW PARA CAMBIAR CANTIDADES =====

export const flowCantidad = addKeyword<Provider, Database>(['cantidad'])
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body.toLowerCase().trim();
        const match = userInput.match(/cantidad\s+(\d+)\s+(\d+)/);
        
        if (!match) {
            return await provider.sendText(ctx.from, [
                '❓ *Uso correcto:*',
                '',
                '*cantidad 1 5* → Producto 1, cambiar a 5 unidades',
                '*cantidad 2 3* → Producto 2, cambiar a 3 unidades',
                '',
                'Escribe *ver carrito* para ver productos numerados.'
            ].join('\n'));
        }

        const itemNumber = parseInt(match[1]);
        const newQuantity = parseInt(match[2]);

        if (newQuantity < 1 || newQuantity > 10) {
            return await provider.sendText(ctx.from, '❌ Cantidad debe ser entre 1 y 10.');
        }

        console.log(`📝 Cambiando cantidad: producto ${itemNumber} → ${newQuantity}`);

        try {
            const userState = await state.getMyState();
            let currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from, '🛒 Carrito vacío.');
            }

            if (itemNumber < 1 || itemNumber > currentCart.length) {
                return await provider.sendText(ctx.from, `❌ Producto ${itemNumber} no existe.`);
            }

            // Actualizar cantidad
            currentCart[itemNumber - 1].quantity = newQuantity;
            await state.update({ cart: currentCart });

            const { total } = getCartTotal(currentCart);
            const product = currentCart[itemNumber - 1];

            await provider.sendText(ctx.from, [
                `📦 *Cantidad actualizada*`,
                '',
                `✏️ ${product.productName}`,
                `📦 Nueva cantidad: ${newQuantity} unidades`,
                `💵 Nuevo subtotal: $${(product.price * newQuantity).toLocaleString()}`,
                '',
                `🛒 *Total carrito: $${total.toLocaleString()}*`,
                '',
                getCarritoMenu()
            ].join('\n'));

        } catch (error) {
            console.error('❌ Error cambiando cantidad:', error);
            await provider.sendText(ctx.from, '❌ Error cambiando cantidad.');
        }
    });

// ===== FLOW PARA SEGUIR COMPRANDO =====

export const flowSeguirComprando = addKeyword<Provider, Database>(['seguir comprando', 'seguir', 'continuar'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🔄 Seguir comprando solicitado');

        try {
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};

            if (Object.keys(productsByCategory).length === 0) {
                // Recargar catálogo si no hay productos
                const products = await syncAndGetProducts(CATALOG_ID, ACCESS_TOKEN);
                await state.update({ productsByCategory: products });
            }

            // Mostrar categorías de nuevo
            const categoriesList = generateCategoriesList(productsByCategory);
            
            await provider.sendText(ctx.from, 
                '🔄 *Continuando compras...*\n\nSelecciona una categoría:'
            );
            
            if (categoriesList) {
                await sendInteractiveMessage(ctx.from, categoriesList);
            }

        } catch (error) {
            console.error('❌ Error seguir comprando:', error);
            await provider.sendText(ctx.from, '❌ Error. Intenta nuevamente.');
        }
    });

// ===== FLOW PARA VACIAR CARRITO =====

export const flowVaciarCarrito = addKeyword<Provider, Database>(['vaciar carrito', 'vaciar'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🗑️ Vaciando carrito');

        try {
            await state.update({ cart: [] });

            await provider.sendText(ctx.from, [
                '🗑️ *Carrito vaciado*',
                '',
                'Tu carrito está ahora vacío.',
                '',
                'Escribe *seguir comprando* para agregar productos.'
            ].join('\n'));

        } catch (error) {
            console.error('❌ Error vaciando carrito:', error);
            await provider.sendText(ctx.from, '❌ Error vaciando carrito.');
        }
    });

// ===== FLOW PARA CONFIRMAR PEDIDO =====

export const flowConfirmarPedido = addKeyword<Provider, Database>(['confirmar pedido', 'confirmar', 'finalizar'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('✅ Confirmación de pedido solicitada');

        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from, 
                    '🛒 *Carrito vacío*\n\nEscribe *seguir comprando* para agregar productos.'
                );
            }

            const { total, itemCount } = getCartTotal(currentCart);

            // Generar resumen de pedido
            let pedidoResumen = [
                '✅ *CONFIRMACIÓN DE PEDIDO*',
                '═══════════════════════════',
                ''
            ];

            currentCart.forEach((item, index) => {
                pedidoResumen.push(`${index + 1}. ${item.productName}`);
                pedidoResumen.push(`   📦 ${item.quantity} x $${item.price.toLocaleString()}`);
                pedidoResumen.push('');
            });

            pedidoResumen.push('═══════════════════════════');
            pedidoResumen.push(`💰 *TOTAL: $${total.toLocaleString()} CLP*`);
            pedidoResumen.push(`📦 *${itemCount} productos*`);
            pedidoResumen.push('');
            pedidoResumen.push('📞 *Para finalizar tu pedido:*');
            pedidoResumen.push('Contacta directamente al:');
            pedidoResumen.push('*+56 9 7964 3935*');
            pedidoResumen.push('');
            pedidoResumen.push('🚚 *Horario de entrega:*');
            pedidoResumen.push('2:00 PM - 10:00 PM');

            await provider.sendText(ctx.from, pedidoResumen.join('\n'));

            // Limpiar carrito después de confirmar
            await state.update({ cart: [] });

        } catch (error) {
            console.error('❌ Error confirmando pedido:', error);
            await provider.sendText(ctx.from, '❌ Error procesando pedido.');
        }
    });

// ===== EXPORTAR TODOS LOS FLOWS SIMPLIFICADOS =====

export const carritoFlowsSimple = [
    flowCarritoSimple,      // Flow principal
    flowCategorias,         // Manejo de categorías
    flowAgregarProducto,    // Agregar productos
    flowVerCarrito,         // Ver carrito detallado
    flowEliminarProducto,   // Eliminar productos específicos
    flowCantidad,           // Cambiar cantidades
    flowSeguirComprando,    // Continuar comprando
    flowVaciarCarrito,      // Vaciar carrito
    flowConfirmarPedido     // Confirmar pedido
];
