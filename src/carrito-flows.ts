/**
 * 🛒 FLOWS DEL SISTEMA DE CARRITO ESCALABLE
 * Integración con BuilderBot para el sistema de carrito temporal
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

// ===== FLOW PRINCIPAL DEL CARRITO =====

export const flowCarritoMenu = addKeyword<Provider, Database>(['carrito_menu', 'catalogo_productos'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🛒 === INICIANDO CARRITO DE COMPRAS ===');
        console.log('👤 Usuario:', ctx.from, ctx.pushName);

        try {
            // Sincronizar productos desde Meta API
            const productsByCategory = await syncAndGetProducts(CATALOG_ID, ACCESS_TOKEN);
            
            if (Object.keys(productsByCategory).length === 0) {
                return await provider.sendText(ctx.from, 
                    '❌ *Error temporal*\n\nNo pudimos cargar el catálogo en este momento.\n\nPor favor intenta nuevamente en unos minutos o contacta al +56 9 7964 3935'
                );
            }

            // Guardar productos en el state para uso posterior
            await state.update({ 
                productsByCategory,
                lastSync: new Date().toISOString()
            });

            // Generar lista de categorías
            const categoriesList = generateCategoriesList(productsByCategory);
            
            if (!categoriesList) {
                return await provider.sendText(ctx.from,
                    '⚠️ *Catálogo temporalmente vacío*\n\nEstamos actualizando nuestro inventario.\n\nContacta directamente al +56 9 7964 3935'
                );
            }

            console.log('✅ Enviando lista de categorías...');
            // Enviar mensaje interactivo usando la API directa
            await sendInteractiveMessage(ctx.from, categoriesList);

        } catch (error) {
            console.error('❌ Error en flowCarritoMenu:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nHubo un problema cargando el catálogo.\n\nContacta al +56 9 7964 3935 para hacer tu pedido directamente.'
            );
        }
    });

// ===== FLOW PARA MANEJAR SELECCIÓN DE CATEGORÍAS =====

export const flowCategoriaSeleccion = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider, gotoFlow }) => {
        const userInput = ctx.body;

        // Verificar si es selección de categoría
        if (!userInput.startsWith('categoria_')) {
            return; // No es una categoría, que otros flows manejen
        }

        console.log('📋 === CATEGORÍA SELECCIONADA ===');
        console.log('Categoría:', userInput);
        console.log('Usuario:', ctx.from);

        try {
            const categoria = userInput.replace('categoria_', '');
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};

            const productos = productsByCategory[categoria] || [];

            if (productos.length === 0) {
                return await provider.sendText(ctx.from,
                    '⚠️ *Categoría vacía*\n\nEsta categoría no tiene productos disponibles en este momento.\n\nEscribe "1" para ver otras categorías.'
                );
            }

            // Guardar categoría actual en el state
            await state.update({ 
                currentCategory: categoria,
                currentProducts: productos
            });

            // Generar lista de productos (incluyendo info del carrito)
            const userState2 = await state.getMyState();
            const currentCart: ItemCarrito[] = userState2?.cart || [];
            const productsList = generateProductsList(productos, categoria, currentCart);

            if (!productsList) {
                return await provider.sendText(ctx.from,
                    '⚠️ *Error generando lista*\n\nEscribe "1" para reintentar o contacta al +56 9 7964 3935'
                );
            }

            console.log(`✅ Enviando ${productos.length} productos de categoría: ${categoria}`);
            await sendInteractiveMessage(ctx.from, productsList);

        } catch (error) {
            console.error('❌ Error en flowCategoriaSeleccion:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nProblema cargando productos.\n\nEscribe "1" para reintentar.'
            );
        }
    });

// ===== FLOW PARA MANEJAR SELECCIÓN DE PRODUCTOS =====

export const flowProductoSeleccion = addKeyword<Provider, Database>(EVENTS.ACTION)
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body;

        // Verificar si es selección de producto
        if (!userInput.startsWith('producto_')) {
            return; // No es un producto
        }

        console.log('🛍️ === PRODUCTO SELECCIONADO ===');
        console.log('Producto:', userInput);
        console.log('Usuario:', ctx.from);

        try {
            const retailerId = userInput.replace('producto_', '');
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};
            const currentCart: ItemCarrito[] = userState?.cart || [];

            // Buscar el producto
            const product = findProductByRetailerId(productsByCategory, retailerId);

            if (!product) {
                return await provider.sendText(ctx.from,
                    '❌ *Producto no encontrado*\n\nEl producto seleccionado ya no está disponible.\n\nEscribe "1" para ver el catálogo actualizado.'
                );
            }

            // Agregar al carrito
            const updatedCart = addToCart(currentCart, product, 1);
            
            // Actualizar state
            await state.update({ cart: updatedCart });

            // Calcular totales
            const { total, itemCount } = getCartTotal(updatedCart);

            console.log(`✅ Producto agregado: ${product.name} - Total carrito: $${total}`);

            // Respuesta de confirmación con opciones del carrito
            await provider.sendText(ctx.from, [
                `✅ *Producto agregado al carrito*`,
                '',
                `🛍️ *${product.name}*`,
                `💰 Precio: $${product.price.toLocaleString()} ${product.currency}`,
                '',
                `🛒 *Estado del carrito:*`,
                `� Total productos: ${itemCount} items`,
                `💰 Total a pagar: $${total.toLocaleString()} CLP`,
                '',
                `💡 *¿Qué deseas hacer ahora?*`,
                '',
                `📋 *Opciones disponibles:*`,
                `• Escribe "ver carrito" para revisar tu carrito`,
                `• Escribe "seguir comprando" para más productos`,
                `• Escribe "confirmar pedido" para finalizar`,
                `• Escribe "vaciar carrito" para empezar de nuevo`
            ].join('\n'));

        } catch (error) {
            console.error('❌ Error en flowProductoSeleccion:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nNo se pudo agregar el producto al carrito.\n\nIntenta nuevamente o contacta al +56 9 7964 3935'
            );
        }
    });

// ===== FLOW PARA VOLVER A CATEGORÍAS =====

export const flowVolverCategorias = addKeyword<Provider, Database>(['volver_categorias'])
    .addAction(async (ctx, { state, provider, gotoFlow }) => {
        console.log('🔄 === VOLVER A CATEGORÍAS ===');
        
        try {
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};

            if (Object.keys(productsByCategory).length === 0) {
                return gotoFlow(flowCarritoMenu);
            }

            // Generar lista de categorías
            const categoriesList = generateCategoriesList(productsByCategory);
            
            if (categoriesList) {
                await sendInteractiveMessage(ctx.from, categoriesList);
            } else {
                return gotoFlow(flowCarritoMenu);
            }

        } catch (error) {
            console.error('❌ Error en flowVolverCategorias:', error);
            return gotoFlow(flowCarritoMenu);
        }
    });

// ===== FLOW PARA VER CARRITO DETALLADO =====

export const flowVerCarrito = addKeyword<Provider, Database>(['ver_carrito', 'carrito', 'ver carrito', 'mi carrito'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🛒 === VER CARRITO DETALLADO ===');
        
        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from, [
                    '🛒 *Tu carrito está vacío*',
                    '',
                    'No tienes productos en tu carrito aún.',
                    '',
                    '💡 *Para agregar productos:*',
                    '• Escribe "1" para ver el catálogo',
                    '• Selecciona una categoría',
                    '• Elige los productos que desees'
                ].join('\n'));
            }

            // Generar resumen detallado del carrito
            const { total, itemCount } = getCartTotal(currentCart);
            
            let cartDetails = [
                '🛒 *TU CARRITO DE COMPRAS*',
                '═══════════════════════════',
                ''
            ];
            
            currentCart.forEach((item, index) => {
                cartDetails.push(`${index + 1}. *${item.productName}*`);
                cartDetails.push(`   💰 Precio: $${item.price.toLocaleString()} c/u`);
                cartDetails.push(`   📦 Cantidad: ${item.quantity} unidad(es)`);
                cartDetails.push(`   💵 Subtotal: $${(item.price * item.quantity).toLocaleString()}`);
                cartDetails.push(`   🆔 ID: ${item.retailerId}`);
                cartDetails.push('');
            });
            
            cartDetails.push('═══════════════════════════');
            cartDetails.push(`📊 *RESUMEN TOTAL:*`);
            cartDetails.push(`📦 Total productos: ${itemCount} items`);
            cartDetails.push(`💰 *TOTAL A PAGAR: $${total.toLocaleString()} CLP*`);
            cartDetails.push('');
            cartDetails.push('🎛️ *OPCIONES DEL CARRITO:*');
            cartDetails.push('');
            cartDetails.push('📝 *Gestionar carrito:*');
            cartDetails.push('• "eliminar [número]" - Quitar producto');
            cartDetails.push('• "cantidad [número] [nueva cantidad]" - Cambiar cantidad');
            cartDetails.push('• "vaciar carrito" - Vaciar todo');
            cartDetails.push('');
            cartDetails.push('🛍️ *Continuar comprando:*');
            cartDetails.push('• "seguir comprando" - Volver al catálogo');
            cartDetails.push('• "1" - Ver categorías');
            cartDetails.push('');
            cartDetails.push('✅ *Finalizar:*');
            cartDetails.push('• "confirmar pedido" - Proceder al checkout');

            await provider.sendText(ctx.from, cartDetails.join('\n'));

        } catch (error) {
            console.error('❌ Error en flowVerCarrito:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nNo se pudo mostrar el carrito.\n\nEscribe "1" para reintentar.'
            );
        }
    });

// ===== FLOW PARA ELIMINAR PRODUCTO ESPECÍFICO DEL CARRITO =====

export const flowEliminarProducto = addKeyword<Provider, Database>(['eliminar'])
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body.toLowerCase().trim();
        
        // Extraer número del comando "eliminar 1", "eliminar 2", etc.
        const match = userInput.match(/eliminar\s+(\d+)/);
        
        if (!match) {
            return await provider.sendText(ctx.from, [
                '❓ *Comando de eliminación*',
                '',
                'Para eliminar un producto específico:',
                '• "eliminar 1" - Eliminar primer producto',
                '• "eliminar 2" - Eliminar segundo producto',
                '',
                'Escribe "ver carrito" para ver la lista numerada.'
            ].join('\n'));
        }

        const itemNumber = parseInt(match[1]);
        
        console.log(`🗑️ === ELIMINAR PRODUCTO ${itemNumber} ===`);
        
        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from,
                    '🛒 *Carrito vacío*\n\nNo tienes productos para eliminar.\n\nEscribe "1" para ver el catálogo.'
                );
            }

            if (itemNumber < 1 || itemNumber > currentCart.length) {
                return await provider.sendText(ctx.from,
                    `❌ *Número inválido*\n\nTienes ${currentCart.length} productos en tu carrito.\n\nEscribe un número entre 1 y ${currentCart.length}.`
                );
            }

            // Obtener el producto a eliminar (array index = itemNumber - 1)
            const productToRemove = currentCart[itemNumber - 1];
            
            // Eliminar el producto
            const updatedCart = currentCart.filter((_, index) => index !== (itemNumber - 1));
            
            // Actualizar state
            await state.update({ cart: updatedCart });

            // Calcular nuevos totales
            const { total, itemCount } = getCartTotal(updatedCart);

            await provider.sendText(ctx.from, [
                `🗑️ *Producto eliminado*`,
                '',
                `❌ Eliminado: *${productToRemove.productName}*`,
                `💰 Valor eliminado: $${(productToRemove.price * productToRemove.quantity).toLocaleString()}`,
                '',
                `🛒 *Carrito actualizado:*`,
                `📦 Productos restantes: ${itemCount} items`,
                `💰 Nuevo total: $${total.toLocaleString()} CLP`,
                '',
                `💡 *Opciones:*`,
                `• "ver carrito" - Ver carrito actualizado`,
                `• "seguir comprando" - Agregar más productos`,
                `• "confirmar pedido" - Finalizar compra`
            ].join('\n'));

        } catch (error) {
            console.error('❌ Error en flowEliminarProducto:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nNo se pudo eliminar el producto.\n\nIntenta nuevamente.'
            );
        }
    });

// ===== FLOW PARA CAMBIAR CANTIDAD DE PRODUCTO =====

export const flowCambiarCantidad = addKeyword<Provider, Database>(['cantidad'])
    .addAction(async (ctx, { state, provider }) => {
        const userInput = ctx.body.toLowerCase().trim();
        
        // Extraer número y cantidad del comando "cantidad 1 3", "cantidad 2 5", etc.
        const match = userInput.match(/cantidad\s+(\d+)\s+(\d+)/);
        
        if (!match) {
            return await provider.sendText(ctx.from, [
                '❓ *Comando de cantidad*',
                '',
                'Para cambiar la cantidad de un producto:',
                '• "cantidad 1 3" - Cambiar producto 1 a 3 unidades',
                '• "cantidad 2 5" - Cambiar producto 2 a 5 unidades',
                '',
                'Escribe "ver carrito" para ver la lista numerada.'
            ].join('\n'));
        }

        const itemNumber = parseInt(match[1]);
        const newQuantity = parseInt(match[2]);
        
        if (newQuantity < 1) {
            return await provider.sendText(ctx.from,
                '❌ *Cantidad inválida*\n\nLa cantidad debe ser mayor a 0.\n\nSi quieres eliminar el producto, usa "eliminar [número]".'
            );
        }

        console.log(`📦 === CAMBIAR CANTIDAD PRODUCTO ${itemNumber} a ${newQuantity} ===`);
        
        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from,
                    '🛒 *Carrito vacío*\n\nNo tienes productos para modificar.\n\nEscribe "1" para ver el catálogo.'
                );
            }

            if (itemNumber < 1 || itemNumber > currentCart.length) {
                return await provider.sendText(ctx.from,
                    `❌ *Número inválido*\n\nTienes ${currentCart.length} productos en tu carrito.\n\nEscribe un número entre 1 y ${currentCart.length}.`
                );
            }

            // Actualizar la cantidad del producto
            const updatedCart = [...currentCart];
            const oldQuantity = updatedCart[itemNumber - 1].quantity;
            updatedCart[itemNumber - 1].quantity = newQuantity;
            
            // Actualizar state
            await state.update({ cart: updatedCart });

            // Calcular nuevos totales
            const { total, itemCount } = getCartTotal(updatedCart);
            const product = updatedCart[itemNumber - 1];

            await provider.sendText(ctx.from, [
                `📦 *Cantidad actualizada*`,
                '',
                `🛍️ *${product.productName}*`,
                `📊 Cantidad anterior: ${oldQuantity}`,
                `📦 Cantidad nueva: ${newQuantity}`,
                `💰 Nuevo subtotal: $${(product.price * newQuantity).toLocaleString()}`,
                '',
                `🛒 *Carrito actualizado:*`,
                `📦 Total productos: ${itemCount} items`,
                `💰 Total a pagar: $${total.toLocaleString()} CLP`,
                '',
                `💡 *Opciones:*`,
                `• "ver carrito" - Ver carrito completo`,
                `• "seguir comprando" - Agregar más productos`,
                `• "confirmar pedido" - Finalizar compra`
            ].join('\n'));

        } catch (error) {
            console.error('❌ Error en flowCambiarCantidad:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nNo se pudo cambiar la cantidad.\n\nIntenta nuevamente.'
            );
        }
    });

// ===== FLOW PARA SEGUIR COMPRANDO =====

export const flowSeguirComprando = addKeyword<Provider, Database>(['seguir comprando', 'seguir', 'continuar comprando', 'mas productos'])
    .addAction(async (ctx, { state, provider, gotoFlow }) => {
        console.log('🛍️ === SEGUIR COMPRANDO ===');
        
        try {
            const userState = await state.getMyState();
            const productsByCategory = userState?.productsByCategory || {};

            if (Object.keys(productsByCategory).length === 0) {
                return gotoFlow(flowCarritoMenu);
            }

            // Generar lista de categorías
            const categoriesList = generateCategoriesList(productsByCategory);
            
            if (!categoriesList) {
                return gotoFlow(flowCarritoMenu);
            }

            await provider.sendText(ctx.from, [
                '🛍️ *Continuar comprando*',
                '',
                'Selecciona una categoría para agregar más productos a tu carrito:'
            ].join('\n'));

            await sendInteractiveMessage(ctx.from, categoriesList);

        } catch (error) {
            console.error('❌ Error en flowSeguirComprando:', error);
            return gotoFlow(flowCarritoMenu);
        }
    });

export const flowVaciarCarrito = addKeyword<Provider, Database>(['vaciar', 'limpiar carrito', 'vaciar carrito'])
    .addAction(async (ctx, { state, provider }) => {
        console.log('🗑️ === VACIAR CARRITO ===');
        
        try {
            await state.update({ cart: clearCart() });
            
            await provider.sendText(ctx.from, [
                '🗑️ *Carrito vaciado*',
                '',
                'Tu carrito ha sido vaciado completamente.',
                '',
                '💡 Escribe "1" para volver al catálogo de productos.'
            ].join('\n'));

        } catch (error) {
            console.error('❌ Error en flowVaciarCarrito:', error);
            await provider.sendText(ctx.from, '❌ Error vaciando el carrito.');
        }
    });

// ===== FLOW PARA CONFIRMAR PEDIDO =====

export const flowConfirmarPedido = addKeyword<Provider, Database>(['confirmar', 'confirmar pedido', 'finalizar'])
    .addAction(async (ctx, { state, provider, gotoFlow }) => {
        console.log('✅ === CONFIRMAR PEDIDO ===');
        
        try {
            const userState = await state.getMyState();
            const currentCart: ItemCarrito[] = userState?.cart || [];

            if (currentCart.length === 0) {
                return await provider.sendText(ctx.from,
                    '🛒 *Carrito vacío*\n\nNo tienes productos en tu carrito.\n\nEscribe "1" para ver el catálogo.'
                );
            }

            const { total, itemCount } = getCartTotal(currentCart);

            // Generar resumen del pedido
            let pedidoSummary = ['📋 *CONFIRMACIÓN DE PEDIDO*\n'];
            
            pedidoSummary.push('🛍️ *Productos seleccionados:*');
            currentCart.forEach((item, index) => {
                pedidoSummary.push(`${index + 1}. ${item.productName}`);
                pedidoSummary.push(`   Cantidad: ${item.quantity} x $${item.price.toLocaleString()}`);
                pedidoSummary.push(`   Subtotal: $${(item.price * item.quantity).toLocaleString()}`);
            });
            
            pedidoSummary.push('');
            pedidoSummary.push(`💰 *TOTAL: $${total.toLocaleString()} CLP*`);
            pedidoSummary.push(`📦 *Total items: ${itemCount}*`);
            pedidoSummary.push('');
            pedidoSummary.push('📞 *Para completar tu pedido:*');
            pedidoSummary.push('Contacta al +56 9 7964 3935');
            pedidoSummary.push('');
            pedidoSummary.push('⏰ *Horario de atención:*');
            pedidoSummary.push('2:00 PM - 10:00 PM');

            await provider.sendText(ctx.from, pedidoSummary.join('\n'));

            // Limpiar carrito después de confirmar
            await state.update({ cart: clearCart() });

            console.log(`✅ Pedido confirmado - Usuario: ${ctx.from} - Total: $${total}`);

        } catch (error) {
            console.error('❌ Error en flowConfirmarPedido:', error);
            await provider.sendText(ctx.from,
                '❌ *Error técnico*\n\nNo se pudo procesar tu pedido.\n\nContacta directamente al +56 9 7964 3935'
            );
        }
    });

// ===== FLOW PARA BÚSQUEDA DE PRODUCTOS =====

export const flowBuscarProductos = addKeyword<Provider, Database>(['buscar', 'busco', 'quiero', 'necesito'])
    .addAction(async (ctx, { state, provider }) => {
        const query = ctx.body.toLowerCase()
            .replace(/^(buscar|busco|quiero|necesito)\s*/i, '')
            .trim();

        if (query.length < 2) {
            return await provider.sendText(ctx.from,
                '🔍 *Búsqueda*\n\nEscribe: "buscar [producto]"\n\nEjemplo: "buscar coca cola"'
            );
        }

        console.log(`🔍 === BÚSQUEDA: "${query}" ===`);

        try {
            const userState = await state.getMyState();
            let productsByCategory = userState?.productsByCategory || {};

            // Si no hay productos en cache, sincronizar
            if (Object.keys(productsByCategory).length === 0) {
                productsByCategory = await syncAndGetProducts(CATALOG_ID, ACCESS_TOKEN);
                await state.update({ productsByCategory });
            }

            // Buscar productos
            const allProducts = Object.values(productsByCategory).flat() as ProductoCarrito[];
            const results = allProducts.filter(product => 
                product.name.toLowerCase().includes(query) ||
                product.description?.toLowerCase().includes(query) ||
                product.categoria.toLowerCase().includes(query)
            ).slice(0, 8); // Limitar resultados

            if (results.length === 0) {
                return await provider.sendText(ctx.from, [
                    `🔍 *Sin resultados para: "${query}"*`,
                    '',
                    'No encontramos productos que coincidan.',
                    '',
                    '💡 *Sugerencias:*',
                    '• Intenta con palabras más generales',
                    '• Escribe "1" para ver todas las categorías',
                    '• Contacta al +56 9 7964 3935'
                ].join('\n'));
            }

            // Mostrar resultados
            let response = [`🔍 *Resultados para: "${query}"*\n`];
            
            results.forEach((product, index) => {
                response.push(`${index + 1}. *${product.name}*`);
                response.push(`   💰 $${product.price.toLocaleString()} ${product.currency}`);
                response.push(`   📂 ${product.categoria.charAt(0).toUpperCase() + product.categoria.slice(1)}`);
                if (product.description) {
                    response.push(`   📝 ${product.description}`);
                }
                response.push('');
            });

            response.push('💡 *Para agregar al carrito:*');
            response.push('Escribe "1" y navega por categorías');

            await provider.sendText(ctx.from, response.join('\n'));

        } catch (error) {
            console.error('❌ Error en búsqueda:', error);
            await provider.sendText(ctx.from,
                '❌ *Error en búsqueda*\n\nIntenta nuevamente o escribe "1" para ver el catálogo.'
            );
        }
    });

// ===== EXPORTAR TODOS LOS FLOWS =====

export const carritoFlows = [
    flowCarritoMenu,
    flowCategoriaSeleccion,
    flowProductoSeleccion,
    flowVolverCategorias,
    flowVerCarrito,
    flowEliminarProducto,
    flowCambiarCantidad,
    flowSeguirComprando,
    flowVaciarCarrito,
    flowConfirmarPedido,
    flowBuscarProductos
];
