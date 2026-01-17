/**
 * 🔧 FLOW UNIFICADO PARA ACCIONES INTERACTIVAS DEL CARRITO
 * Este archivo maneja todas las respuestas a listas interactivas del carrito
 */

import { addKeyword, EVENTS } from '@builderbot/bot';
import { MetaProvider as Provider } from '@builderbot/provider-meta';
import { MongoAdapter as Database } from '@builderbot/database-mongo';
import {
    generateProductsList,
    findProductByRetailerId,
    addToCart,
    removeFromCart
} from './carrito-simple';

// ===== FUNCIÓN HELPER PARA ENVIAR MENSAJES INTERACTIVOS =====
async function sendInteractiveMessage(phoneNumber: string, payload: any): Promise<void> {
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${process.env.NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.JWT_TOKEN}`,
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

        console.log('✅ Lista interactiva enviada exitosamente');
    } catch (error) {
        console.error('❌ Error en sendInteractiveMessage:', error);
        throw error;
    }
}

// ===== FLOW UNIFICADO PARA TODAS LAS ACCIONES INTERACTIVAS =====
export const flowAccionesCarrito = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;
        console.log('🔧 Flow acciones carrito - Input recibido:', userInput);

        try {
            // ===== MANEJAR CATEGORÍAS =====
            if (userInput.startsWith('categoria_')) {
                console.log('📋 Procesando selección de categoría:', userInput);
                const categoria = userInput.replace('categoria_', '');
                const userState = await state.getMyState();
                const productsByCategory = userState?.productsByCategory || {};
                const productos = productsByCategory[categoria] || [];

                if (productos.length === 0) {
                    await provider.sendText(ctx.from, [
                        '❌ *Categoría vacía*',
                        '',
                        `No hay productos disponibles en la categoría: ${categoria}`,
                        '',
                        '📞 Contacta al +56 9 7964 3935 para más información'
                    ].join('\n'));
                    return;
                }

                // Generar y enviar lista de productos
                const productsList = generateProductsList(productos, categoria);
                await sendInteractiveMessage(ctx.from, productsList);
                console.log(`✅ Lista de productos enviada - Categoría: ${categoria} (${productos.length} productos)`);
                return;
            }

            // ===== MANEJAR PRODUCTOS =====
            if (userInput.startsWith('producto_')) {
                console.log('🛍️ Procesando selección de producto:', userInput);
                const productId = userInput.replace('producto_', '');
                const userState = await state.getMyState();
                const productsByCategory = userState?.productsByCategory || {};
                
                // Buscar el producto en todas las categorías
                const producto = findProductByRetailerId(productsByCategory, productId);
                
                if (!producto) {
                    await provider.sendText(ctx.from, [
                        '❌ *Producto no encontrado*',
                        '',
                        'No pudimos encontrar ese producto en el catálogo.',
                        '',
                        '🔄 Intenta nuevamente o contacta al +56 9 7964 3935'
                    ].join('\n'));
                    return;
                }

                // Agregar al carrito
                const carrito = userState?.carrito || [];
                const nuevoCarrito = addToCart(carrito, producto, 1);
                
                await state.update({ 
                    ...userState,
                    carrito: nuevoCarrito 
                });

                await provider.sendText(ctx.from, [
                    '✅ *¡Producto agregado al carrito!*',
                    '',
                    `📦 **${producto.name}**`,
                    '🛒 Cantidad: 1 unidad',
                    '',
                    '🎯 *¿Qué deseas hacer ahora?*',
                    '',
                    '📝 *Comandos disponibles:*',
                    '• `ver_carrito_detallado` - Ver tu carrito completo',
                    '• `seguir_comprando` - Continuar agregando productos',
                    '• `confirmar_pedido` - Finalizar y hacer el pedido',
                    '',
                    '💡 *Tip: Usa los comandos exactos para mejores resultados*'
                ].join('\n'));

                console.log(`✅ Producto agregado al carrito: ${producto.name} (ID: ${productId})`);
                return;
            }

            // ===== MANEJAR GESTIÓN DE PRODUCTOS =====
            if (userInput.startsWith('gestionar_')) {
                console.log('⚙️ Procesando gestión de producto:', userInput);
                const productId = userInput.replace('gestionar_', '');
                
                await provider.sendText(ctx.from, [
                    '⚙️ *Gestión de producto*',
                    '',
                    `Producto ID: ${productId}`,
                    '',
                    '📝 *Opciones disponibles:*',
                    '• `eliminar_${productId}` - Eliminar este producto',
                    '• `ver_carrito_detallado` - Ver carrito completo',
                    '• `seguir_comprando` - Continuar comprando',
                    '',
                    '💡 Reemplaza `${productId}` con el ID real del producto'
                ].join('\n'));
                return;
            }

            // ===== MANEJAR ELIMINACIONES =====
            if (userInput.startsWith('eliminar_')) {
                console.log('🗑️ Procesando eliminación:', userInput);
                const productId = userInput.replace('eliminar_', '');
                const userState = await state.getMyState();
                const carrito = userState?.carrito || [];
                
                const nuevoCarrito = removeFromCart(carrito, productId);
                
                await state.update({ 
                    ...userState,
                    carrito: nuevoCarrito 
                });

                await provider.sendText(ctx.from, [
                    '✅ *Producto eliminado del carrito*',
                    '',
                    'El producto ha sido removido exitosamente.',
                    '',
                    '🎯 *Opciones:*',
                    '• `ver_carrito_detallado` - Ver carrito actualizado',
                    '• `seguir_comprando` - Agregar más productos',
                    '• `confirmar_pedido` - Finalizar compra'
                ].join('\n'));

                console.log(`✅ Producto eliminado del carrito: ${productId}`);
                return;
            }

            // ===== OTRAS ACCIONES =====
            if (userInput === 'back_to_cart') {
                await provider.sendText(ctx.from, [
                    '🔙 *Regresando al carrito*',
                    '',
                    'Usa el comando `ver_carrito_detallado` para ver tu carrito actual'
                ].join('\n'));
                return;
            }

            // ===== ACCIÓN NO RECONOCIDA =====
            console.log('ℹ️ Acción interactiva no reconocida:', userInput);
            
            // No enviar mensaje para acciones no reconocidas del carrito
            // para evitar spam si es de otro sistema

        } catch (error) {
            console.error('❌ Error en flow acciones carrito:', error);
            await provider.sendText(ctx.from, [
                '❌ *Error procesando la acción*',
                '',
                'Hubo un problema procesando tu selección.',
                '',
                '🔄 Intenta nuevamente o contacta al +56 9 7964 3935'
            ].join('\n'));
        }
    });
