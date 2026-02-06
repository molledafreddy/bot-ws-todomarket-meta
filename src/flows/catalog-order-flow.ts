import { addKeyword, EVENTS } from '@builderbot/bot';
import { ENABLED_CATALOGS } from '../config/multi-catalog-config';

// Flow para manejar órdenes de catálogos específicos - USAR EVENTS.ORDER
export const flowCatalogOrder = addKeyword([EVENTS.ORDER])
    .addAction(async (ctx, { flowDynamic, globalState, gotoFlow }) => {
        console.log('🛒 === ORDEN DE CATÁLOGO MULTI-CATÁLOGO RECIBIDA ===');
        console.log('📋 Contexto completo:', JSON.stringify(ctx, null, 2));
        
        try {
            // Determinar de qué catálogo viene la orden
            const currentCatalog = await globalState.get('currentCatalog') || 'principal';
            const catalogConfig = ENABLED_CATALOGS[currentCatalog];
            
            // Verificar si hay datos de orden válidos
            if (!ctx?.order && !ctx?.message?.order) {
                console.log('❌ No se encontraron datos de orden en el contexto');
                throw new Error('No se encontraron datos de orden');
            }
            
            const orderData = ctx.order || ctx.message.order;
            const catalogId = orderData.catalog_id;
            const productItems = orderData.product_items || [];
            
            console.log('🏷️ Catalog ID:', catalogId);
            console.log('📦 Productos seleccionados:', productItems);
            console.log('📋 Catálogo actual:', currentCatalog);
            console.log('⚙️ Configuración de catálogo:', catalogConfig);
            
            if (!productItems || productItems.length === 0) {
                throw new Error('No se seleccionaron productos');
            }
            
            // Procesar productos con información del catálogo origen
            const processedProducts = productItems.map((item: any, index: number) => {
                const productName = item.item_name || item.name || `Producto ${index + 1}`;
                const productPrice = item.item_price || item.price || '0';
                const quantity = item.quantity || 1;
                const subtotal = parseFloat(productPrice) * quantity;
                
                return `${index + 1}. **${productName}**\n   💰 $${productPrice} x ${quantity} = $${subtotal.toLocaleString()}`;
            });
            
            // Calcular total
            const totalAmount = productItems.reduce((sum: number, item: any) => {
                const price = parseFloat(item.item_price || item.price || '0');
                const qty = parseInt(item.quantity || '1');
                return sum + (price * qty);
            }, 0);
            
            // Guardar información del pedido multi-catálogo
            const orderInfo = {
                products: productItems,
                catalogId: catalogId,
                sourceCatalog: currentCatalog,
                catalogName: catalogConfig?.name || 'Catálogo desconocido',
                customerPhone: ctx.from,
                customerName: ctx.pushName || ctx.name || 'Cliente',
                totalAmount: totalAmount,
                timestamp: new Date().toISOString(),
                processedProducts: processedProducts
            };
            
            // Obtener pedidos existentes para carrito consolidado
            const existingOrders = await globalState.get('multiCatalogOrders') || [];
            existingOrders.push(orderInfo);
            
            await globalState.update({
                multiCatalogOrders: existingOrders,
                lastOrderInfo: orderInfo,
                currentCatalog: currentCatalog
            });
            
            await flowDynamic([
                `✅ **Productos agregados desde ${catalogConfig?.name || 'catálogo'}**`,
                '',
                `${catalogConfig?.emoji || '📦'} **Productos seleccionados:**`,
                '',
                ...processedProducts,
                '',
                `💰 **Subtotal este catálogo: $${totalAmount.toLocaleString()}**`,
                '',
                '¿Qué quieres hacer ahora?',
                '',
                '1️⃣ 🛍️ Explorar otro catálogo',
                '2️⃣ 🛒 Ver carrito completo',  
                '3️⃣ ✅ Finalizar pedido',
                '',
                '💬 Escribe el número de tu opción'
            ]);
            
        } catch (error: any) {
            console.error('Error procesando orden multi-catálogo:', error);
            await flowDynamic([
                '❌ Error procesando tu selección',
                `🔧 Detalle: ${error.message}`,
                '',
                '💡 Intenta seleccionar productos del catálogo nuevamente',
                '💬 O escribe "menu" para volver al inicio'
            ]);
        }
    })
    .addAction(async (ctx, { flowDynamic, gotoFlow, globalState }) => {
        const userChoice = ctx.body?.trim();
        
        switch (userChoice) {
            case '1':
                // Volver a selección de catálogos
                const { flowCatalogSelection } = await import('./catalog-selection-flow');
                return gotoFlow(flowCatalogSelection);
            case '2':
                // Ver carrito completo
                return gotoFlow(flowViewCart);
            case '3':
                // Finalizar pedido
                return gotoFlow(flowMultiCatalogCheckout);
            default:
                await flowDynamic([
                    '🤔 Opción no válida',
                    '👆 Selecciona 1, 2 o 3'
                ]);
                return;
        }
    });

export const flowViewCart = addKeyword(['carrito', 'cart', 'ver carrito', '2'])
    .addAction(async (ctx, { flowDynamic, globalState }) => {
        try {
            const multiCatalogOrders = await globalState.get('multiCatalogOrders') || [];
            
            if (multiCatalogOrders.length === 0) {
                await flowDynamic([
                    '🛒 **Tu carrito está vacío**',
                    '',
                    '💡 Explora nuestros catálogos y agrega productos',
                    '',
                    '📱 Escribe "menu" para ver opciones'
                ]);
                return;
            }
            
            // Agrupar productos por catálogo
            const ordersByCatalog = multiCatalogOrders.reduce((acc: any, order: any) => {
                const catalogKey = order.sourceCatalog;
                if (!acc[catalogKey]) {
                    acc[catalogKey] = {
                        catalogName: order.catalogName,
                        orders: [],
                        totalAmount: 0
                    };
                }
                acc[catalogKey].orders.push(order);
                acc[catalogKey].totalAmount += order.totalAmount;
                return acc;
            }, {});
            
            // Generar resumen del carrito
            let cartSummary = [
                '🛒 **TU CARRITO MULTI-CATÁLOGO**',
                ''
            ];
            
            let grandTotal = 0;
            let totalProducts = 0;
            
            Object.entries(ordersByCatalog).forEach(([catalogKey, data]: [string, any]) => {
                const catalogConfig = ENABLED_CATALOGS[catalogKey];
                cartSummary.push(`${catalogConfig?.emoji || '📦'} **${data.catalogName}**`);
                
                data.orders.forEach((order: any, orderIndex: number) => {
                    cartSummary.push(`   Pedido ${orderIndex + 1}:`);
                    order.processedProducts.forEach((product: string) => {
                        cartSummary.push(`   ${product}`);
                        totalProducts++;
                    });
                    cartSummary.push('');
                });
                
                cartSummary.push(`   💰 Subtotal ${data.catalogName}: $${data.totalAmount.toLocaleString()}`);
                cartSummary.push('');
                grandTotal += data.totalAmount;
            });
            
            cartSummary.push('─'.repeat(35));
            cartSummary.push(`📦 Total productos: ${totalProducts} items`);
            cartSummary.push(`🛍️ Catálogos usados: ${Object.keys(ordersByCatalog).length} catálogos`);
            cartSummary.push(`💰 **GRAN TOTAL: $${grandTotal.toLocaleString()}**`);
            cartSummary.push('');
            cartSummary.push('[1] 🛍️ Seguir comprando');
            cartSummary.push('[2] ✅ Proceder al checkout');
            cartSummary.push('[3] 🗑️ Vaciar carrito');
            
            await flowDynamic([cartSummary.join('\n')]);
            
        } catch (error: any) {
            console.error('Error obteniendo carrito multi-catálogo:', error);
            await flowDynamic([
                '❌ Error consultando tu carrito',
                '💬 Escribe "menu" para volver al inicio'
            ]);
        }
    })
    .addAction(async (ctx, { flowDynamic, gotoFlow, globalState }) => {
        const userChoice = ctx.body?.trim();
        
        switch (userChoice) {
            case '1':
                // Seguir comprando - volver a catálogos
                const { flowCatalogSelection } = await import('./catalog-selection-flow');
                return gotoFlow(flowCatalogSelection);
            case '2':
                // Proceder al checkout
                return gotoFlow(flowMultiCatalogCheckout);
            case '3':
                // Vaciar carrito
                await globalState.update({ 
                    multiCatalogOrders: [],
                    lastOrderInfo: null,
                    currentCatalog: null
                });
                await flowDynamic([
                    '🗑️ **Carrito vaciado completamente**',
                    '',
                    '💬 Escribe "menu" para volver al inicio'
                ]);
                return;
            default:
                await flowDynamic([
                    '🤔 Opción no válida',
                    '👆 Selecciona 1, 2 o 3'
                ]);
                return;
        }
    });

export const flowMultiCatalogCheckout = addKeyword(['checkout', 'finalizar'])
    .addAction(async (ctx, { flowDynamic, globalState }) => {
        try {
            const multiCatalogOrders = await globalState.get('multiCatalogOrders') || [];
            
            if (multiCatalogOrders.length === 0) {
                await flowDynamic([
                    '❌ No tienes productos en el carrito',
                    '💡 Agrega productos antes de finalizar',
                    '',
                    '📱 Escribe "menu" para ver opciones'
                ]);
                return;
            }
            
            // Preparar resumen final para checkout
            const grandTotal = multiCatalogOrders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
            const totalProducts = multiCatalogOrders.reduce((count: number, order: any) => count + order.products.length, 0);
            const catalogsUsed = [...new Set(multiCatalogOrders.map((order: any) => order.catalogName))];
            
            await flowDynamic([
                '🏁 **RESUMEN FINAL DEL PEDIDO**',
                '',
                `👤 **Cliente:** ${multiCatalogOrders[0]?.customerName}`,
                `📱 **Teléfono:** ${ctx.from}`,
                `📦 **Total productos:** ${totalProducts} items`,
                `🛍️ **Catálogos:** ${catalogsUsed.join(', ')}`,
                `💰 **Total a pagar: $${grandTotal.toLocaleString()}**`,
                '',
                '🚧 **CHECKOUT TEMPORAL**',
                '',
                'Para completar tu pedido:',
                '📞 Llama al +56 9 3649 9908',
                '💬 O confirma aquí escribiendo "CONFIRMAR"',
                '',
                '⏳ Procesaremos tu pedido manualmente'
            ]);
            
            // Guardar para seguimiento
            await globalState.update({
                pendingCheckout: {
                    orders: multiCatalogOrders,
                    customer: {
                        name: multiCatalogOrders[0]?.customerName,
                        phone: ctx.from
                    },
                    totals: {
                        amount: grandTotal,
                        products: totalProducts,
                        catalogs: catalogsUsed
                    },
                    status: 'pending',
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error: any) {
            console.error('Error en checkout multi-catálogo:', error);
            await flowDynamic([
                '❌ Error procesando checkout',
                '📞 Contacta directamente: +56 9 3649 9908'
            ]);
        }
    });