import 'dotenv/config'
import moment  from "moment";
import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MongoAdapter as Database } from '@builderbot/database-mongo'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import { idleFlow, reset, start, stop, IDLETIME } from './idle-custom'
import { getCatalogConfig, CatalogConfig, ENABLED_CATALOGS, validateCatalogConfig } from './config/multi-catalog-config'
import { flowCatalogSelection } from './flows/catalog-selection-flow';

import { flowCatalogOrder, flowViewCart, flowMultiCatalogCheckout } from './flows/catalog-order-flow';
import { flowWelcome, flowThanks, flowContactSupport, flowHelp } from './flows/additional-flows';

// Validar configuración al iniciar
const configValidation = validateCatalogConfig();
if (!configValidation.valid) {
    console.error('❌ Configuración de catálogos inválida:', configValidation.errors);
    process.exit(1);
}

// Importar fetch para Node.js si no está disponible globalmente
const fetch = globalThis.fetch || require('node-fetch')


// Railway requires PORT as integer
const PORT = parseInt(process.env.PORT || '3008', 10)

// Validate required environment variables
function validateEnvironment() {
    const required = ['JWT_TOKEN', 'NUMBER_ID', 'VERIFY_TOKEN', 'MONGO_DB_URI'];
    const missing = required.filter(key => !process.env[key]);
    
    console.log('🔍 Environment validation:');
    console.log(`  - PORT: ${PORT}`);
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  - TZ: ${process.env.TZ || 'system default'}`);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`  - ${key}`));
        console.error('🚫 Cannot start bot without required configuration');
        
        // In production, we should fail fast
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
        return false;
    }
    
    console.log('✅ All required environment variables are set');
    return true;
}

// Validate environment before starting
validateEnvironment();

// Configure logging for Railway deployment
if (process.env.NODE_ENV === 'production') {
    console.log('🔧 Setting up production logging...');
    
    // Option 1: Try to setup logs directory in /tmp (Railway compatible)
    try {
        const fs = require('fs');
        const path = require('path');
        const logsDir = '/tmp/logs';
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true, mode: 0o777 });
            console.log('📁 Created logs directory:', logsDir);
        }
        
        // Set environment variables to redirect BuilderBot logs
        process.env.LOG_DIR = logsDir;
        process.env.LOG_LEVEL = 'info';
        
        // Change working directory for log files
        process.chdir('/tmp/logs');
        
        console.log('✅ Logging configured for production (using /tmp/logs)');
        
    } catch (logSetupError) {
        console.warn('⚠️ Could not setup file logging, using console only:', logSetupError.message);
        
        // Option 2: Disable file logging completely
        process.env.DISABLE_FILE_LOGGING = 'true';
        process.env.LOG_LEVEL = 'info';
        
        console.log('📺 File logging disabled, using console output only');
    }
}


/**
 * Crea un payload de lista interactiva con categorías de productos
 * @param phoneNumber Número del destinatario
 * @returns Payload para envío directo a Meta API
 */
function createProductList(phoneNumber: string) {
    return {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: "🛍️ TodoMarket - Catálogo"
            },
            body: {
                text: "Selecciona una categoría de productos para ver los artículos disponibles:"
            },
            footer: {
                text: "Selecciona una opción de la lista"
            },
            action: {
                button: "Ver Categorías",
                sections: [
                    {
                        title: "🛒 Categorías Principales",
                        rows: [
                            {
                                id: "categoria_bebidas",
                                title: "🥤 Bebidas",
                                description: "Refrescos, jugos, aguas"
                            },
                            {
                                id: "categoria_panaderia", 
                                title: "🍞 Panadería",
                                description: "Pan, cereales, galletas"
                            },
                            {
                                id: "categoria_lacteos",
                                title: "🥛 Lácteos",
                                description: "Leche, queso, yogurt, huevos"
                            }
                        ]
                    },
                    {
                        title: "🍎 Más Categorías",
                        rows: [
                            {
                                id: "categoria_abarrotes",
                                title: "🌾 Abarrotes", 
                                description: "Arroz, fideos, aceite, azúcar"
                            },
                            {
                                id: "categoria_frutas",
                                title: "🍎 Frutas y Verduras",
                                description: "Frutas frescas y verduras"
                            },
                            {
                                id: "categoria_limpieza",
                                title: "🧼 Limpieza",
                                description: "Detergente, jabón, papel"
                            }
                        ]
                    }
                ]
            }
        }
    };
}


const FlowAgente2 = addKeyword(['Agente', 'AGENTE', 'agente'])
.addAnswer(["*Estamos desviando tu conversacion a nuestro Agente*"], null,
   async(ctx, {provider, endFlow}) => {
    const name = ctx?.pushName;
    const numAgente = ctx?.from;
    const message = `El cliente ${name} con el celular ${numAgente} solicita atencion personalizada`;
    await provider.sendText('56936499908@s.whatsapp.net', message)
    return endFlow('*Gracias*');
   }
);

/**
* Captura una variedad de eventos multimedia que no son permitidos por el bot 
* y envía un mensaje correspondiente según Meta WhatsApp Business API
*/
const flowValidMedia = addKeyword([EVENTS.MEDIA, EVENTS.VOICE_NOTE, EVENTS.LOCATION, EVENTS.DOCUMENT])
.addAction(async(ctx, {gotoFlow, flowDynamic}) => {
    try {
        console.log('📱 === MEDIA NO PERMITIDA DETECTADA ===');
        console.log('📋 Contexto completo:', JSON.stringify(ctx, null, 2));
        console.log('📎 Tipo de mensaje:', ctx.body);
        
        // Según Meta WhatsApp Business API, los tipos de mensaje son:
        // - text, image, audio, video, document, location, contacts, interactive, etc.
        
        let mediaType = 'multimedia';
        let mediaIcon = '📎';
        
        // Detectar tipo específico según Meta API structure
        if (ctx.message) {
            // Para Meta Provider, verificar el tipo en ctx
            if (ctx.body === 'event_media' || ctx.body.includes('image')) {
                mediaType = 'imagen';
                mediaIcon = '🖼️';
            } else if (ctx.body === 'event_voice_note' || ctx.body.includes('audio')) {
                mediaType = 'audio/nota de voz';
                mediaIcon = '🎵';
            } else if (ctx.body === 'event_location' || ctx.body.includes('location')) {
                mediaType = 'ubicación';
                mediaIcon = '📍';
            } else if (ctx.body === 'event_document' || ctx.body.includes('document')) {
                mediaType = 'documento';
                mediaIcon = '📄';
            } else if (ctx.body.includes('video')) {
                mediaType = 'video';
                mediaIcon = '🎥';
            } else if (ctx.body.includes('sticker')) {
                mediaType = 'sticker';
                mediaIcon = '😀';
            }
        }
        
        console.log(`🚫 Tipo de media detectado: ${mediaType} ${mediaIcon}`);
        
        // Enviar mensaje de error personalizado según el tipo
        const errorMessage = [
            `❌ *Contenido no permitido* ${mediaIcon}`,
            '',
            `Lo siento, no puedo procesar mensajes de tipo *${mediaType}*.`,
            '',
            '✅ *Solo se permiten mensajes de texto* para interactuar con el bot.',
            '',
            '💡 Por favor, escriba su consulta en texto o seleccione una opción del menú.',
            '',
            '🔄 *Escriba "hola" para volver al menú principal.*'
        ].join('\n');
        
        await flowDynamic(errorMessage);
        
        // Redirigir al flujo principal después de un breve delay
        setTimeout(async () => {
            console.log('🔄 Redirigiendo a flowPrincipal tras mensaje multimedia');
            return gotoFlow(flowPrincipal);
        }, 2000);
        
    } catch (error) {
        console.error('💥 Error en flowValidMedia:', error);
        console.error('📋 Contexto del error:', JSON.stringify(ctx, null, 2));
        
        // Fallback en caso de error
        await flowDynamic([
            '❌ *Error procesando contenido multimedia*',
            '',
            'Por favor, use solo mensajes de texto.',
            '',
            '🔄 Escriba "hola" para continuar.'
        ].join('\n'));
        
        return gotoFlow(flowPrincipal);
    }
});

/**
* captura El evento que se genera cuando se recibe un pedido proveniente del carrito de compra.
*/
 const flowOrder = addKeyword([EVENTS.ORDER])
 .addAction(async(ctx,{gotoFlow, fallBack, provider, globalState}) => {
    try {
        console.log('🛒 === ORDEN RECIBIDA ===');
        console.log('📦 Contexto completo de la orden:', JSON.stringify(ctx, null, 2));
        
        // Verificar estructura correcta de la orden según Meta API
        if (ctx?.order || ctx?.message?.order) {
            const orderData = ctx.order || ctx.message.order;
            console.log('📋 Datos de la orden:', orderData);
            
            // Según Meta API: order contiene catalog_id y product_items
            const catalogId = orderData.catalog_id;
            const productItems = orderData.product_items || [];
            
            console.log('🏷️ Catalog ID:', catalogId);
            console.log('📦 Productos seleccionados:', productItems);
            
            if (catalogId && productItems.length > 0) {
                // Procesar los productos de la orden con proveedor para obtener detalles
                const processedOrder = await processOrderFromCatalog(productItems, catalogId, provider);
                
                if (processedOrder && processedOrder.length > 0) {
                    // Guardar la orden en el estado global
                    await globalState.update({ 
                        order: processedOrder,
                        catalogId: catalogId,
                        customerPhone: ctx.from,
                        customerName: ctx.pushName || ctx.name
                    });
                    
                    console.log('✅ Orden procesada exitosamente');
                    console.log('🔄 Redirigiendo a flowEndShoppingCart');
                    return gotoFlow(flowEndShoppingCart);
                } else {
                    console.log('❌ No se pudieron procesar los productos');
                    return fallBack("❌ *Error procesando la orden*\n\nNo se pudieron obtener los detalles de los productos seleccionados.");
                }
            } else {
                console.log('❌ Orden incompleta - falta catalog_id o product_items');
                return fallBack("❌ *Orden incompleta*\n\nLa orden no contiene todos los datos necesarios.");
            }
        } else {
            console.log('❌ No se encontró estructura de orden válida');
            return fallBack("❌ *No se recibió información válida*\n\nPara concretar la compra debe seleccionar los productos desde el carrito de compra.");
        }
    } catch (error) {
        console.error('💥 Error en flowOrder:', error);
        return fallBack("❌ *Error procesando la orden*\n\nHubo un problema técnico. Por favor intenta nuevamente.");
    }
});

const flowEndShoppingCart = addKeyword(utils.setEvent('END_SHOPPING_CART'))
.addAction(async (ctx, { globalState, endFlow, fallBack }) => {
    // Verificar que existe una orden procesada
    const orderData = globalState.get('order');
    const catalogId = globalState.get('catalogId');
    
    if (!orderData || !catalogId) {
        console.log('❌ flowEndShoppingCart: No hay orden válida en globalState');
        return endFlow('❌ *Error*\n\nNo se encontró información de pedido válida. Por favor, seleccione productos desde el catálogo nuevamente.');
    }
    
    console.log('✅ flowEndShoppingCart: Orden válida encontrada, solicitando dirección');
    return; // Continuar al siguiente paso
})
.addAnswer([
    'Su Pedido está siendo procesado 🛒', 
    'Para completar su pedido necesitamos los siguientes datos:',
    
])
.addAnswer(
    [
        '📍 *PASO 1: Dirección de entrega*\n',
        'Ingrese su dirección con la siguiente estructura:\n',
        '*Nombre Calle Numeración, Comuna, Dto/Bloque/Lote Referencia*\n',
        '',
        'Ejemplo: Juan Pérez Av. Libertador 123, Santiago, Depto 4B Torre Norte'
    ],
    { capture: true, delay: 3000, idle: 960000 },
    async(ctx, {fallBack, globalState}) => {
        try {
            const userAddress = ctx.body?.trim();

            console.log('📍 Dirección recibida:', userAddress);

            // Validar que se ingresó una dirección válida
            if (!userAddress || userAddress.length < 10) {
                console.log('❌ Dirección inválida recibida');
                return fallBack('❌ *Dirección inválida*\n\nPor favor ingrese una dirección completa con la estructura indicada:\n*Nombre Calle Numeración, Comuna, Depto/Bloque/Lote Referencia*');
            }

            // Guardar dirección en globalState
            await globalState.update({address: userAddress});
            console.log('✅ Dirección guardada correctamente');
            
            // Continuar al siguiente paso automáticamente
            return; // Permitir que el flujo continúe

        } catch (error) {
            console.error('💥 Error procesando dirección:', error);
            return fallBack('❌ *Error técnico*\n\nHubo un problema procesando su dirección. Por favor inténtelo nuevamente.');
        }
    }
)
.addAnswer('✅ *Dirección registrada correctamente*')
.addAnswer(
    [
        '💳 *PASO 2: Método de pago*\n',
        'Seleccione su método de pago preferido:\n',
        '',
        '👉 *1* - Efectivo 💵',
        '👉 *2* - Transferencia bancaria 🏦', 
        '👉 *3* - Punto de venta (POS) 💳',
        '',
        'Escriba solo el *número* de su opción (1, 2 o 3):'
    ],
    { capture: true, delay: 3000, idle: 960000 },
    async(ctx, {endFlow, fallBack, provider, globalState}) => {
        try {
            const name = ctx.pushName || 'Cliente';
            const phone = ctx.from;
            const paymentOption = ctx.body?.trim();

            console.log('💳 Método de pago recibido:', paymentOption);

            // Validar que se ingresó una opción válida (1, 2 o 3)
            if (paymentOption !== '1' && paymentOption !== '2' && paymentOption !== '3') {
                console.log('❌ Método de pago inválido recibido:', paymentOption);
                return fallBack('❌ *Opción inválida*\n\nPor favor ingrese un número válido:\n\n👉 *1* - Efectivo 💵\n👉 *2* - Transferencia bancaria 🏦\n👉 *3* - Punto de venta (POS) 💳');
            }

            // Mapear número a método de pago
            let paymentMethod = '';
            switch (paymentOption) {
                case '1':
                    paymentMethod = 'Efectivo 💵';
                    break;
                case '2':
                    paymentMethod = 'Transferencia bancaria 🏦';
                    break;
                case '3':
                    paymentMethod = 'Punto de venta (POS) 💳';
                    break;
            }

            // Guardar método de pago en globalState
            await globalState.update({paymentMethod: paymentMethod});
            
            // Obtener todos los datos del pedido
            const dataOrder = globalState.get('order');
            const dataAddress = globalState.get('address');
            const dataPaymentMethod = globalState.get('paymentMethod');
            const catalogId = globalState.get('catalogId');
            
            console.log('📦 Datos finales del pedido:');
            console.log('- Orden:', dataOrder);
            console.log('- Dirección:', dataAddress);
            console.log('- Método de pago:', dataPaymentMethod);
            console.log('- Catálogo ID:', catalogId);

            // Verificar que tenemos todos los datos necesarios
            if (!dataOrder || !dataAddress || !dataPaymentMethod) {
                console.log('❌ Datos incompletos en globalState');
                return endFlow('❌ *Error procesando pedido*\n\nFaltan datos del pedido. Por favor inténtelo nuevamente.');
            }

            // Calcular el total del pedido desde dataOrder
            let totalPedido = 0;
            if (Array.isArray(dataOrder)) {
                // Buscar el total en el último elemento del array (si existe)
                const totalLine = dataOrder.find(item => typeof item === 'string' && item.includes('Total a Pagar'));
                if (totalLine) {
                    // Extraer el monto del string "Total a Pagar: $XXX"
                    const totalMatch = totalLine.match(/\$(\d+)/);
                    if (totalMatch) {
                        totalPedido = parseInt(totalMatch[1]);
                    }
                }
            }

            // Enviar notificación al negocio
            await notificationDelivery(dataOrder, dataAddress, dataPaymentMethod, name, phone, provider);
            
            // Limpiar globalState después de procesar
            await globalState.update({ 
                order: null, 
                address: null, 
                paymentMethod: null,
                catalogId: null,
                customerPhone: null,
                customerName: null 
            });

            console.log('✅ Pedido procesado exitosamente y globalState limpiado');
            
            // Mensaje de confirmación personalizado según método de pago
            let paymentInstructions = '';
            if (paymentOption === '2') { // Transferencia
                paymentInstructions = '\n\n💳 *Datos para transferencia:*\nNombre: [TodoMarket]\nBanco: [Santander]\nTipo: [Corriente]\nCuenta: [0-000-7748055-2]\nRUT: [77.210.237-6]\n\n📸 *Importante:* Transfiera luego de confirmar el pedido.';
            } else if (paymentOption === '3') { // POS
                paymentInstructions = '\n\n💳 *Punto de venta disponible*\nNuestro repartidor llevará el equipo POS para procesar su pago con tarjeta.';
            } else { // Efectivo
                paymentInstructions = '\n\n💵 *Pago en efectivo*\nTenga el monto exacto preparado para el repartidor.';
            }
            
            // Formatear el total para mostrar
            const totalDisplay = totalPedido > 0 ? `💰 *Total a pagar:* $${totalPedido.toLocaleString('es-CL')}` : '💡 *Nota:* El total se confirmará al momento de la entrega.';
            
            return endFlow([
                '✅ *¡Pedido confirmado!* 🛒',
                '',
                `💳 *Método de pago:* ${dataPaymentMethod}`,
                totalDisplay,
                '',
                'Gracias por su pedido. En breve nos comunicaremos con usted para coordinar la entrega.',
                paymentInstructions,
                '',
                '📞 También puede contactarnos directamente al: +56 9 3649 9908',
                '',
                '⏰ *Horario de entrega:* Lunes a Domingo 2:00 PM - 10:00 PM'
            ].join('\n'));

        } catch (error) {
            console.error('💥 Error en flowEndShoppingCart:', error);
            return endFlow('❌ *Error técnico*\n\nHubo un problema procesando su pedido. Por favor contacte directamente al +56 9 3649 9908');
        }
    }
);

// ===== FUNCIÓN HELPER PARA ENVIAR LISTAS INTERACTIVAS =====
// async function sendInteractiveMessageDirect(phoneNumber: string, payload: any): Promise<void> {
//     const ACCESS_TOKEN = process.env.JWT_TOKEN!;
//     try {
//         const response = await fetch(`https://graph.facebook.com/v18.0/${process.env.NUMBER_ID}/messages`, {
//             method: 'POST',
//             headers: {
//                 'Authorization': `Bearer ${ACCESS_TOKEN}`,
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({
//                 ...payload,
//                 to: phoneNumber
//             })
//         });

//         if (!response.ok) {
//             const errorData = await response.json();
//             console.error('❌ Error enviando mensaje interactivo:', errorData);
//             throw new Error('Error API Meta');
//         }
        
//         console.log('✅ Lista interactiva enviada exitosamente');
//     } catch (error) {
//         console.error('❌ Error en sendInteractiveMessageDirect:', error);
//         throw error;
//     }
// }

 // const flowPrincipal = addKeyword("welcome")
const flowPrincipal = addKeyword<Provider, Database>(utils.setEvent('welcome'))
 .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow, IDLETIME))
 .addAnswer([
    '🚚 Hola, Bienvenido a *Minimarket TodoMarket* 🛵', 
    '⌛ Horario disponible desde las 2:00 PM hasta las 10:00 PM. ⌛',
    '📝 a través de este canal te ofrecemos los siguientes servicios de compra:'
], { delay: 1000 })
 .addAnswer(
     [
        '*Indica el Número de la opción que desees:*', 
        '👉 #1 Carrito de compra whatsApp', 
        '👉 #2 Conversar con un Agente', 
    ].join('\n'),
    { capture: true, delay: 1000, idle: 900000 },
    async (ctx,{ provider, fallBack, gotoFlow, state, endFlow}) => {
        console.log('ctx.body flowPrincipal', ctx.body)
        const userInput = ctx.body.toLowerCase().trim();
        
        // Opción 1: Catálogo oficial de Meta (ENVÍO DIRECTO)
        if (userInput === '1') {
            stop(ctx)
            console.log('🛒 Usuario seleccionó opción 1 - Catálogo oficial');
            console.log('📋 Enviando catálogo oficial de Meta...');
            
            try {
                // Enviar catálogo oficial directamente
                // await sendCatalog(provider, ctx.from, null, 'main', false);
                const result = await sendCatalogWith30Products(ctx.from, 'principal', provider);
                console.log('✅ Catálogo oficial enviado exitosamente');
            } catch (error) {
                console.error('❌ Error enviando catálogo:', error);
                await provider.sendText(ctx.from,
                    '❌ *Error temporal con el catálogo*\n\nContacta al +56 9 7964 3935'
                );
            }
            return;
        }
   
        // Opción 2: Agente
        if (userInput === '2' || userInput.includes('agente')) {
            stop(ctx)
            console.log('👥 Usuario seleccionó opción 2 - Agente');
            return gotoFlow(FlowAgente2);
        }
        
        // Opción inválida
        console.log('❌ Opción inválida recibida:', ctx.body);
        reset(ctx, gotoFlow, IDLETIME)
        return fallBack("*Opcion no valida*, \nPor favor seleccione una opcion valida:\n👉 #1 Carrito de compra\n👉 #2 Conversar con un Agente");
     }
 );

// const flowPrincipal = addKeyword("welcome")
//     .addAnswer([
//         '🙌 ¡Hola! Bienvenido a TodoMarket',
//         '',
//         'Elige una opción:',
//         '',
//         '1️⃣ 🛍️ Explorar Catálogos',
//         '2️⃣ 🛒 Ver mi carrito', 
//         '3️⃣ 📞 Contactar soporte',
//         '4️⃣ ❓ Ayuda',
//         '',
//         '💡 Escribe el número de tu opción'
//     ])
//     .addAction(async (ctx, { flowDynamic, gotoFlow }) => {
//         const userInput = ctx.body?.trim();
        
//         switch (userInput) {
//             case '1':
//                 return gotoFlow(flowCatalogSelection);
//             case '2':
//                 return gotoFlow(flowViewCart);
//             case '3':
//                 return gotoFlow(flowContactSupport);
//             case '4':
//                 return gotoFlow(flowHelp);
//             default:
//                 await flowDynamic([
//                     '🤔 No entendí tu opción.',
//                     '👆 Por favor selecciona un número del 1 al 4'
//                 ]);
//                 return;
//         }
//     });


/**
 * Función mejorada para enviar catálogos usando configuración centralizada
 * @param provider Proveedor de Meta
 * @param from Número del destinatario
 * @param catalogType Tipo de catálogo ('main', 'offers', 'premium', etc.)
 */
async function sendCatalogByType(provider: any, from: string, catalogType: string) {
    const catalogConfig = getCatalogConfig();
    
    if (!catalogConfig) {
        console.error(`❌ Configuración de catálogo no encontrada para tipo: ${catalogType}`);
        await provider.sendMessage(from, 'Lo siento, ese catálogo no está disponible.');
        return;
    }

    console.log(`🛒 Enviando catálogo tipo '${catalogType}' a: ${from}`);
    
    try {
        // Intentar catálogo nativo de Meta
        const catalogPayload: any = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual", 
            "to": from,
            "type": "interactive",
            "interactive": {
                "type": "catalog_message",
                "body": {
                    "text": catalogConfig.message
                },
                "action": {
                    "name": "catalog_message"
                }
            }
        };

        // Si tiene catalog_id específico, añadirlo
        if (catalogConfig.id) {
            catalogPayload.interactive.action.parameters = {
                "catalog_id": catalogConfig.id
            };
            console.log(`📋 Usando catalog_id específico: ${catalogConfig.id}`);
        } else {
            console.log(`📋 Usando catálogo por defecto del NUMBER_ID`);
        }
        
        const result = await provider.sendMessageMeta(catalogPayload);
        console.log(`✅ Catálogo ${catalogType} enviado exitosamente`);
        return result;
        
    } catch (error: any) {
        console.log(`⚠️ Catálogo nativo falló para ${catalogType}, usando enlace fallback:`, error.message);
        
        // Fallback con enlace específico
        const fallbackUrl = catalogConfig.fallbackUrl || "https://wa.me/c/56979643935"; // ✅ URL CORREGIDA
        const linkPayload = {
            "messaging_product": "whatsapp", 
            "recipient_type": "individual",
            "to": from,
            "type": "text",
            "text": {
                "preview_url": true,
                "body": `${catalogConfig.message}\n\n🔗 Ver catálogo completo:\n${fallbackUrl}`
            }
        };
        
        try {
            const linkResult = await provider.sendMessageMeta(linkPayload);
            console.log(`✅ Enlace de catálogo ${catalogType} enviado`);
            return linkResult;
        } catch (linkError) {
            console.error(`💥 Error en fallback para ${catalogType}:`, linkError);
            await provider.sendMessage(from, `${catalogConfig.title} no disponible temporalmente.`);
        }
    }
}


/**
 * NUEVA FUNCIÓN: Enviar catálogo con 100 productos en MÚLTIPLES MENSAJES
 * ✅ Respeta límite de Meta (30 items por mensaje)
 * ✅ Envía automáticamente múltiples mensajes
 * ✅ Sin duplicados
 */
export async function sendCatalogWith30Products(
  phoneNumber: string,
  catalogKey: string,
  provider: any
) {
  const catalog = ENABLED_CATALOGS[catalogKey];

  if (!catalog) {
    throw new Error(`Catálogo ${catalogKey} no encontrado`);
  }

  const jwtToken = process.env.JWT_TOKEN || provider?.globalVendorArgs?.jwtToken;
  const numberId = process.env.NUMBER_ID || provider?.globalVendorArgs?.numberId;

  if (!jwtToken || !numberId) {
    throw new Error('Faltan credenciales Meta');
  }

  try {
    console.log(`\n📤 PASO 1: Consultando productos del catálogo ${catalogKey}...`);
    
    const productsResponse = await fetch(
      `https://graph.facebook.com/v23.0/${catalog.catalogId}/products?fields=id,name,description,price,currency,retailer_id,category,availability&limit=100`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        }
      }
    );

    const productsData = await productsResponse.json();

    if (!productsResponse.ok) {
      console.error('❌ Error consultando productos:', productsData);
      throw new Error(`Error obteniendo productos: ${productsData.error?.message}`);
    }

    let allProducts = productsData.data || [];
    console.log(`✅ Total de productos encontrados: ${allProducts.length}`);

    if (allProducts.length === 0) {
      throw new Error('No hay productos en el catálogo');
    }

    // 📋 CATEGORIZAR PRODUCTOS
    const organizedByCategory = categorizeProductsCorrectly(allProducts, catalogKey);
    
    console.log(`\n📑 Categorías encontradas: ${Object.keys(organizedByCategory).length}`);
    Object.entries(organizedByCategory).forEach(([category, products]) => {
      console.log(`  • ${category}: ${(products as any[]).length} productos`);
    });

    // 🔧 CREAR TODOS LOS LOTES DE MENSAJES
    const messageLotes = createAllCategorizedSectionLotes(organizedByCategory);
    
    console.log(`\n📤 PASO 2: Preparando ${messageLotes.length} mensaje(s) para envío...`);
    
    let successCount = 0;
    let failureCount = 0;

    // 📤 ENVIAR CADA LOTE EN UN MENSAJE SEPARADO
    for (const lote of messageLotes) {
      console.log(`\n📨 Enviando Lote ${lote.loteNumber}/${messageLotes.length}...`);
      console.log(`   • Items: ${lote.itemsCount}`);
      console.log(`   • Secciones: ${lote.sections.length}`);

      const productListMessage = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "interactive",
        interactive: {
          type: "product_list",
          header: {
            type: "text",
            text: `${catalog.emoji} ${catalog.name} (${lote.loteNumber}/${messageLotes.length})`
          },
          body: {
            text: `${catalog.description}\n\n📦 Parte ${lote.loteNumber} de ${messageLotes.length}\n${lote.itemsCount} productos en esta sección\n\n👇 Selecciona por categoría`
          },
          footer: {
            text: "Agrega al carrito → Finaliza tu compra"
          },
          action: {
            catalog_id: catalog.catalogId,
            sections: lote.sections
          }
        }
      };

      try {
        const response = await fetch(
          `https://graph.facebook.com/v23.0/${numberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(productListMessage)
          }
        );

        const result = await response.json();

        if (!response.ok) {
          console.error(`❌ Error en Lote ${lote.loteNumber}:`, result);
          failureCount++;
          
          // Intentar enviar igualmente para no detener los siguientes
          if (result.error?.error_data?.details) {
            console.error('   Detalle:', result.error.error_data.details);
          }
        } else {
          console.log(`✅ Lote ${lote.loteNumber} enviado exitosamente`);
          successCount++;
          
          // Esperar 500ms entre mensajes para no saturar Meta
          if (lote.loteNumber < messageLotes.length) {
            console.log('⏳ Esperando antes del siguiente mensaje...');
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

      } catch (error) {
        console.error(`❌ Error enviando Lote ${lote.loteNumber}:`, error);
        failureCount++;
      }
    }

    console.log(`\n🎉 ENVÍO COMPLETADO:`);
    console.log(`   ✅ Éxito: ${successCount}/${messageLotes.length} mensajes`);
    console.log(`   ❌ Fallos: ${failureCount}/${messageLotes.length} mensajes`);
    console.log(`   📦 Total de productos: ${allProducts.length}`);

    return {
      success: successCount > 0,
      messagesCount: messageLotes.length,
      successCount,
      productsCount: allProducts.length
    };

  } catch (error: any) {
    console.error('❌ Error general:', error.message);
    return {
      success: false,
      error: error.message,
      fallbackMessage: generateProductListFallback100(catalog, catalogKey)
    };
  }
}

/**
 * INTERFAZ DE TIPO: Define la estructura de categoryPatterns
 */
interface CategoryPattern {
  patterns: RegExp[];
  weight: number;
  exclusions?: string[]; // ✅ OPCIONAL (solo algunas categorías la tienen)
}

/**
 * FUNCIÓN MEJORADA: Categorizar productos con EXCLUSIONES y VALIDACIÓN
 * ✅ Evita falsos positivos (toallitas en snacks)
 * ✅ Consulta categoría real de Meta primero
 * ✅ Lógica de exclusión para productos específicos
 */
function categorizeProductsCorrectly(products: any[], catalogKey: string) {
  const categorized: Record<string, any[]> = {};

  // Mapeo de categorías de Meta a nombres amigables
  const categoryNames: Record<string, string> = {
    'beverages': '🥤 Bebidas y Refrescos',
    'drinks': '🥤 Bebidas',
    'non_alcoholic_beverages': '🥤 Bebidas No Alcohólicas',
    'alcoholic_beverages': '🍺 Bebidas Alcohólicas',
    'water': '💧 Aguas',
    'juice': '🧃 Jugos y Néctar',
    'coffee_tea': '☕ Café y Té',
    'soft_drinks': '🥤 Gaseosas',
    
    'bread_bakery': '🍞 Panadería',
    'bakery': '🍞 Panadería',
    'cereals': '🥣 Cereales',
    'bread': '🍞 Pan',
    
    'dairy': '🥛 Lácteos',
    'milk': '🥛 Leche',
    'yogurt': '🥛 Yogurt',
    'cheese': '🧀 Queso',
    'eggs': '🥚 Huevos',
    
    'pantry': '🌾 Abarrotes',
    'grains': '🌾 Granos',
    'pasta': '🍝 Pastas',
    'rice': '🍚 Arroz',
    'oil': '🫒 Aceites',
    'sugar': '🍬 Azúcares',
    
    'produce': '🍎 Frutas y Verduras',
    'fruits': '🍎 Frutas',
    'vegetables': '🥕 Verduras',
    'fresh_produce': '🥬 Productos Frescos',
    
    'cleaning': '🧼 Limpieza',
    'personal_care': '🧴 Cuidado Personal',
    'household': '🏠 Artículos del Hogar',
    'toiletries': '🪥 Higiene',
    
    'snacks': '🍿 Snacks',
    'candy_chocolate': '🍫 Chocolates y Dulces',
    'frozen': '❄️ Congelados',
    'other': '📦 Otros'
  };

  // 🛑 PALABRAS CLAVE QUE EXCLUYEN DE SNACKS
  const snackExclusions = [
    'toallita', 'toalla', 'papel', 'higiénico', 'higienico',
    'pañal', 'panial', 'servilleta', 'detergente', 'jabón', 'jabon',
    'champú', 'champu', 'pasta dental', 'desinfectante', 'cloro',
    'limpieza', 'aseo', 'higiene', 'personal care',
    'toallón', 'paño', 'esponja', 'trapo'
  ];

  // 🛑 PALABRAS CLAVE QUE EXCLUYEN DE BEBIDAS
  const beverageExclusions = [
    'agua oxigenada', 'oxigenada', 'medicamento', 'suero', 'rehidratante'
  ];

  // ✅ PALABRAS CLAVE ESPECÍFICAS POR CATEGORÍA (mayor precisión)
  const categoryPatterns = {
    '🪥 Higiene': {
      patterns: [
        /\b(toallita|toalla|papel higiénico|pañal|servilleta)\b/i,
        /\b(higiene|aseo|personal care|cuidado personal)\b/i,
        /\b(pasta dental|cepillo de dientes|hilo dental)\b/i,
        /\b(detergente|jabón|champú|acondicionador|shampoo)\b/i,
        /\b(desinfectante|cloro|desinfectante|limpiador)\b/i,
        /\b(pañuelos|kleenex|servilleta)\b/i
      ],
      weight: 1.0
    } as CategoryPattern,
    '🧼 Limpieza': {
      patterns: [
        /\b(detergente|desinfectante|cloro|limpiador|escoba|recogedor)\b/i,
        /\b(limpiar|limpieza|cleaning)\b/i,
        /\b(trapo|paño|esponja|cepillo de limpieza)\b/i,
        /\b(desengrasante|deshollinador)\b/i
      ],
      weight: 0.95
    } as CategoryPattern,
    '🍿 Snacks': {
      patterns: [
        /\b(papas fritas|chips|snack|galletas|galleta|chocolate|dulces|caramelo|golosina|chicle)\b/i,
        /\b(maní|cacahuate|almendras|nueces|frutos secos)\b/i,
        /\b(caramelos|gomitas|gominolas|chicles)\b/i
      ],
      weight: 0.9,
      exclusions: snackExclusions
    } as CategoryPattern,
    '❄️ Congelados': {
      patterns: [
        /\b(congelad|helado|pizza|papas fritas congeladas|frozen)\b/i,
        /\b(comida congelada|alimentos congelados)\b/i
      ],
      weight: 0.85
    } as CategoryPattern,
    '🥤 Bebidas': {
      patterns: [
        /\b(coca|pepsi|sprite|fanta|7up|soda|gaseosa|refresco)\b/i,
        /\b(agua|agua mineral|agua purificada|agua saborizada)\b/i,
        /\b(jugo|néctar|concentrate|watts|ades|nectar)\b/i,
        /\b(café|coffee|café instantáneo|café molido|expreso|capuchino)\b/i,
        /\b(té|tea|matcha|té verde|té rojo|chamomila)\b/i,
        /\b(cerveza|beer|vino|wine|pisco|licor|whisky|ron|vodka)\b/i,
        /\b(energética|energy drink|gatorade|powerade|red bull|monster)\b/i
      ],
      weight: 0.88,
      exclusions: beverageExclusions
    } as CategoryPattern,
    '🍞 Panadería': {
      patterns: [
        /\b(pan|molde|hallulla|baguette|integral|blanco|pan francés)\b/i,
        /\b(cereales|cereal|corn flakes|avena|granola)\b/i,
        /\b(galletas|galleta|cookies|biscocho|bizcocho)\b/i,
        /\b(pan de pasas|pan dulce|pan tostado|pan integral)\b/i
      ],
      weight: 0.87
    } as CategoryPattern,
    '🥛 Lácteos y Huevos': {
      patterns: [
        /\b(leche|lácteo|lacteo|dairy)\b/i,
        /\b(yogurt|yogur|yogurth|queso|mantequilla|crema|nata)\b/i,
        /\b(huevo|huevos|egg|eggs)\b/i,
        /\b(leche condensada|leche evaporada)\b/i
      ],
      weight: 0.89
    } as CategoryPattern,
    '🌾 Abarrotes': {
      patterns: [
        /\b(arroz|fideos|pasta|aceite|azúcar|azucar|sal|harina|abarrote)\b/i,
        /\b(aceite vegetal|aceite de oliva|aceite de girasol)\b/i,
        /\b(lentejas|porotos|frijoles|legumbres)\b/i,
        /\b(atún|enlatados|conserva|vinagre|mayonesa)\b/i
      ],
      weight: 0.86
    } as CategoryPattern,
    '🍎 Frutas y Verduras': {
      patterns: [
        /\b(manzana|plátano|banana|naranja|limón|limon|fresa|fruta)\b/i,
        /\b(tomate|papa|patata|cebolla|ajo|zanahoria|lechuga|brócoli|brocoli|verdura)\b/i,
        /\b(palta|aguacate|piña|durazno|melocotón|sandía|melón|uva|kiwi)\b/i,
        /\b(producto fresco|frutas y verduras|produce)\b/i
      ],
      weight: 0.88
    } as CategoryPattern
  } as Record<string, CategoryPattern>;

  // Procesar cada producto
  products.forEach((product: any) => {
    let category = '📦 Otros'; // Categoría por defecto

    const productName = (product.name || '').toLowerCase();
    const productDesc = (product.description || '').toLowerCase();
    const fullText = `${productName} ${productDesc}`;

    // PRIORIDAD 1: Categoría de Meta (si existe)
    if (product.category) {
      const metaCategory = product.category.toLowerCase().trim();
      
      if (categoryNames[metaCategory]) {
        category = categoryNames[metaCategory];
        
        // Agregar producto y retornar
        if (!categorized[category]) {
          categorized[category] = [];
        }
        categorized[category].push(product);
        return; // ✅ Salir aquí si Meta tiene categoría
      }
    }

    // PRIORIDAD 2: Buscar en patrones específicos
    let bestMatch = { category: '📦 Otros', weight: 0 };

    Object.entries(categoryPatterns).forEach(([catKey, catConfig]) => {
      // ✅ VALIDAR QUE exclusions EXISTA antes de usarla (ahora con tipo)
      if (catConfig.exclusions && catConfig.exclusions.length > 0) {
        const hasExclusion = catConfig.exclusions.some(exclusion =>
          fullText.includes(exclusion)
        );
        
        if (hasExclusion) {
          return; // Pasar a siguiente categoría
        }
      }

      // Verificar patrones
      const matchCount = catConfig.patterns.filter(pattern =>
        pattern.test(fullText)
      ).length;

      if (matchCount > 0) {
        const confidence = (matchCount / catConfig.patterns.length) * catConfig.weight;

        // Usar la categoría con mayor confianza
        if (confidence > bestMatch.weight) {
          bestMatch = { category: catKey, weight: confidence };
        }
      }
    });

    // Asignar mejor coincidencia encontrada
    if (bestMatch.weight > 0) {
      category = bestMatch.category;
    }

    // Agregar producto a su categoría
    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push(product);
  });

  // Ordenar por cantidad de productos (más productos primero)
  const sorted = Object.entries(categorized)
    .sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, any[]>);

  console.log('\n✅ CATEGORIZACIÓN COMPLETADA:');
  Object.entries(sorted).forEach(([category, products]) => {
    console.log(`   ${category}: ${(products as any[]).length} productos`);
  });

  return sorted;
}

/**
 * FUNCIÓN CORREGIDA: Crear secciones SIN EXCEDER 30 ITEMS
 * ✅ Respeta LÍMITE DURO de Meta (máximo 30 items por mensaje)
 * ✅ Retorna array de "lotes" de secciones
 */
function createCategorizedSections(categorizedProducts: Record<string, any[]>) {
  const maxItemsPerMessage = 30;      // ⚠️ LÍMITE DURO DE META
  const maxSectionsPerMessage = 3;    // Meta permite máximo 3 secciones
  const maxItemsPerSection = 10;      // Meta permite máximo 10 items por sección
  
  // Aplanar todos los productos sin repetir
  const allProductsFlat: any[] = [];
  const categoryOrder: string[] = [];

  Object.entries(categorizedProducts).forEach(([categoryName, products]) => {
    categoryOrder.push(categoryName);
    allProductsFlat.push(...(products as any[]));
  });

  console.log(`\n📊 DISTRIBUCIÓN DE PRODUCTOS:`);
  console.log(`   • Total de productos: ${allProductsFlat.length}`);
  console.log(`   • Límite por mensaje: ${maxItemsPerMessage}`);
  console.log(`   • Mensajes necesarios: ${Math.ceil(allProductsFlat.length / maxItemsPerMessage)}`);

  // 🔧 CREAR LOTES DE MENSAJES (cada uno con máximo 30 items)
  const messageLotes = [];
  let currentLoteIndex = 0;
  let itemsInCurrentLote = 0;
  let currentMessageSections = [];
  let currentSection: any = null;
  let itemsInCurrentSection = 0;

  for (const product of allProductsFlat) {
    // Si el lote actual está lleno (30 items), crear nuevo lote
    if (itemsInCurrentLote >= maxItemsPerMessage) {
      console.log(`✅ Lote ${currentLoteIndex + 1} completado: ${itemsInCurrentLote} items`);
      
      messageLotes.push({
        loteNumber: currentLoteIndex + 1,
        sections: currentMessageSections,
        itemsCount: itemsInCurrentLote
      });

      currentLoteIndex++;
      itemsInCurrentLote = 0;
      currentMessageSections = [];
      currentSection = null;
      itemsInCurrentSection = 0;
    }

    // Si la sección actual está llena, crear nueva sección
    if (itemsInCurrentSection >= maxItemsPerSection) {
      currentSection = null;
      itemsInCurrentSection = 0;
    }

    // Si no hay sección actual, crear una
    if (!currentSection) {
      // Si ya alcanzamos máximo de secciones por mensaje, crear nueva
      if (currentMessageSections.length >= maxSectionsPerMessage) {
        console.log(`⚠️ Máximo de ${maxSectionsPerMessage} secciones por mensaje alcanzado`);
        
        messageLotes.push({
          loteNumber: currentLoteIndex + 1,
          sections: currentMessageSections,
          itemsCount: itemsInCurrentLote
        });

        currentLoteIndex++;
        itemsInCurrentLote = 0;
        currentMessageSections = [];
        itemsInCurrentSection = 0;
      }

      // Crear nueva sección
      const categoryForSection = categoryOrder[currentMessageSections.length] || '📦 Productos';
      currentSection = {
        title: categoryForSection.substring(0, 30), // Meta limita a 30 caracteres
        product_items: []
      };
      currentMessageSections.push(currentSection);
      itemsInCurrentSection = 0;
    }

    // Agregar producto a la sección actual
    currentSection.product_items.push({
      product_retailer_id: product.retailer_id || product.id
    });

    itemsInCurrentSection++;
    itemsInCurrentLote++;
  }

  // Agregar el último lote si tiene items
  if (currentMessageSections.length > 0) {
    messageLotes.push({
      loteNumber: currentLoteIndex + 1,
      sections: currentMessageSections,
      itemsCount: itemsInCurrentLote
    });

    console.log(`✅ Lote ${currentLoteIndex + 1} completado: ${itemsInCurrentLote} items`);
  }

  console.log(`\n📤 RESUMEN DE LOTES PARA ENVIAR:`);
  messageLotes.forEach((lote) => {
    console.log(`   • Lote ${lote.loteNumber}: ${lote.itemsCount} items en ${lote.sections.length} secciones`);
    lote.sections.forEach((section: any) => {
      console.log(`     └─ ${section.title}: ${section.product_items.length} items`);
    });
  });

  // Retornar solo el PRIMER lote (para usar en la función actual)
  // Los demás se enviarán en mensajes posteriores
  return messageLotes[0]?.sections || [];
}

/**
 * FUNCIÓN AUXILIAR: Obtener todos los lotes para envío progresivo
 */
function createAllCategorizedSectionLotes(categorizedProducts: Record<string, any[]>) {
  const maxItemsPerMessage = 30;
  const maxSectionsPerMessage = 3;
  const maxItemsPerSection = 10;
  
  const allProductsFlat: any[] = [];
  const categoryOrder: string[] = [];

  Object.entries(categorizedProducts).forEach(([categoryName, products]) => {
    categoryOrder.push(categoryName);
    allProductsFlat.push(...(products as any[]));
  });

  const messageLotes = [];
  let currentLoteIndex = 0;
  let itemsInCurrentLote = 0;
  let currentMessageSections = [];
  let currentSection: any = null;
  let itemsInCurrentSection = 0;

  for (const product of allProductsFlat) {
    if (itemsInCurrentLote >= maxItemsPerMessage) {
      messageLotes.push({
        loteNumber: currentLoteIndex + 1,
        sections: currentMessageSections,
        itemsCount: itemsInCurrentLote
      });

      currentLoteIndex++;
      itemsInCurrentLote = 0;
      currentMessageSections = [];
      currentSection = null;
      itemsInCurrentSection = 0;
    }

    if (itemsInCurrentSection >= maxItemsPerSection) {
      currentSection = null;
      itemsInCurrentSection = 0;
    }

    if (!currentSection) {
      if (currentMessageSections.length >= maxSectionsPerMessage) {
        messageLotes.push({
          loteNumber: currentLoteIndex + 1,
          sections: currentMessageSections,
          itemsCount: itemsInCurrentLote
        });

        currentLoteIndex++;
        itemsInCurrentLote = 0;
        currentMessageSections = [];
        itemsInCurrentSection = 0;
      }

      const categoryForSection = categoryOrder[currentMessageSections.length] || '📦 Productos';
      currentSection = {
        title: categoryForSection.substring(0, 30),
        product_items: []
      };
      currentMessageSections.push(currentSection);
      itemsInCurrentSection = 0;
    }

    currentSection.product_items.push({
      product_retailer_id: product.retailer_id || product.id
    });

    itemsInCurrentSection++;
    itemsInCurrentLote++;
  }

  if (currentMessageSections.length > 0) {
    messageLotes.push({
      loteNumber: currentLoteIndex + 1,
      sections: currentMessageSections,
      itemsCount: itemsInCurrentLote
    });
  }

  return messageLotes;
}

/**
 * FUNCIÓN AUXILIAR: Generar fallback detallado con 100 productos
 */
function generateProductListFallback100(catalog: any, catalogKey: string) {
  const fallback = [
    `${catalog.emoji} **${catalog.name.toUpperCase()}**`,
    '',
    `📋 ${catalog.description}`,
    '',
    '🚧 **Catálogo interactivo temporalmente no disponible**',
    '',
    '📦 **LISTADO DE PRODUCTOS DISPONIBLES:**',
    ''
  ];

  if (catalogKey === 'bebidas') {
    fallback.push(
      '🥤 **GASEOSAS Y REFRESCOS:**',
      '1. Coca Cola Lata 350ml - $1.900',
      '2. Coca Cola Zero 350ml - $1.900',
      '3. Pepsi Lata 350ml - $1.800',
      '4. Pepsi Black 350ml - $1.900',
      '5. Sprite Lata 350ml - $1.800',
      '6. Fanta Naranja 350ml - $1.800',
      '7. Fanta Uva 350ml - $1.800',
      '8. Fanta Piña 350ml - $1.800',
      '9. Seven Up Lata 350ml - $1.800',
      '10. Fanta Fresa 350ml - $1.800',
      '',
      '💧 **AGUAS Y BEBIDAS NATURALES:**',
      '11. Agua Mineral Cachantun 1.5L - $1.200',
      '12. Agua Mineral 5L - $2.200',
      '13. Agua con Gas 1.5L - $1.400',
      '14. Agua Purificada 5L - $2.200',
      '15. Agua Saborizada Limón 500ml - $1.600',
      '16. Agua Saborizada Fresa 500ml - $1.600',
      '17. Agua Saborizada Sandía 500ml - $1.600',
      '18. Jugo Watts Naranja 1L - $2.500',
      '19. Jugo Watts Durazno 1L - $2.500',
      '20. Jugo Watts Piña 1L - $2.500',
      '',
      '🧃 **JUGOS Y NÉCTAR:**',
      '21. Jugo Watts Manzana 1L - $2.500',
      '22. Jugo Concentrado Ades 200ml - $1.200',
      '23. Néctar Andes Manzana 1L - $2.800',
      '24. Néctar Andes Durazno 1L - $2.800',
      '25. Jugo Natural Premium 1L - $3.200',
      '26. Jugo Natural Naranja 1L - $3.500',
      '27. Jugo Natural Kiwi 500ml - $2.800',
      '28. Jugo Natural Pomelo 500ml - $2.800',
      '29. Jugo Natural Zanahoria 500ml - $2.600',
      '30. Bebida de Avena Natura 1L - $3.200',
      '',
      '☕ **CAFÉ Y TÉ:**',
      '31. Café Instantáneo Nescafé 100g - $4.200',
      '32. Café en Grano Oquendo 250g - $5.800',
      '33. Té Lipton 25 bolsas - $2.200',
      '34. Té Helado Limón 500ml - $2.200',
      '35. Nestea Durazno 1.5L - $2.600',
      '36. Café Frío Nescafé 250ml - $2.800',
      '37. Té Verde Lipton 25 bolsas - $2.800',
      '38. Chamomila Naturals 20 bolsas - $1.600',
      '39. Té Rojo Lipton 25 bolsas - $2.800',
      '40. Té de Jengibre Naturals 20 bolsas - $1.800',
      '',
      '⚡ **BEBIDAS ENERGÉTICAS:**',
      '41. Red Bull Original 250ml - $2.800',
      '42. Red Bull Sugar Free 250ml - $2.800',
      '43. Red Bull Manzana 250ml - $2.800',
      '44. Monster Energy 473ml - $3.200',
      '45. Monster Zero 473ml - $3.200',
      '46. Monster Mango 473ml - $3.200',
      '47. Gatorade Naranja 500ml - $2.400',
      '48. Gatorade Tropical 500ml - $2.400',
      '49. Gatorade Uva 500ml - $2.400',
      '50. Powerade Manzana 500ml - $2.400',
      '',
      '🍺 **BEBIDAS ALCOHÓLICAS (+18 AÑOS):**',
      '51. Cerveza Cristal 330ml - $2.200',
      '52. Cerveza Cristal 350ml - $2.400',
      '53. Cerveza Escudo 330ml - $2.200',
      '54. Cerveza Brahma 355ml - $2.400',
      '55. Cerveza Kunstmann 330ml - $3.200',
      '56. Pisco Capel 35° 750ml - $8.900',
      '57. Pisco Alto del Carmen 750ml - $9.200',
      '58. Vino Santa Carolina 750ml - $5.800',
      '59. Vino Concha y Toro 750ml - $5.200',
      '60. Vino Casillero del Diablo 750ml - $6.200'
    );
  } else {
    fallback.push(
      '🥤 **BEBIDAS (10 items):**',
      '1. Coca Cola Lata 350ml - $1.900',
      '2. Pepsi Lata 350ml - $1.800',
      '3. Agua Mineral 1.5L - $1.200',
      '4. Jugo Watts 1L - $2.500',
      '5. Cerveza Cristal 330ml - $2.200',
      '6. Sprite Lata 350ml - $1.800',
      '7. Fanta Naranja 350ml - $1.800',
      '8. Nestea Durazno 1.5L - $2.600',
      '9. Red Bull 250ml - $2.800',
      '10. Té Helado 500ml - $2.200',
      '',
      '🍞 **PANADERÍA Y CEREALES (10 items):**',
      '11. Pan de Molde Bimbo 500g - $1.600',
      '12. Hallullas Caseras x6 - $2.200',
      '13. Pan Pita Árabe x4 - $2.400',
      '14. Cereal Corn Flakes 500g - $4.500',
      '15. Avena Quaker 500g - $3.200',
      '16. Granola Naturals 400g - $4.800',
      '17. Galletas McKay Soda 200g - $1.200',
      '18. Galletas Oreo 154g - $1.800',
      '19. Biscottes Bimbo 200g - $1.600',
      '20. Pan Integral Bimbo 500g - $2.200',
      '',
      '🥛 **LÁCTEOS Y HUEVOS (10 items):**',
      '21. Leche Entera Soprole 1L - $1.400',
      '22. Leche Descremada Soprole 1L - $1.400',
      '23. Yogurt Natural Soprole 150g - $800',
      '24. Queso Gouda Colún 200g - $4.200',
      '25. Queso Mantecoso Colún 250g - $3.800',
      '26. Mantequilla Colún 250g - $3.800',
      '27. Huevos Blancos Docena - $3.500',
      '28. Huevos Rojos Docena - $4.200',
      '29. Crema Ácida Soprole 200ml - $1.800',
      '30. Leche Condensada Lechera 397g - $1.600',
      '',
      '🌾 **ABARROTES (10 items):**',
      '31. Arroz Grado 1 Tucapel 1kg - $2.800',
      '32. Fideos Espagueti Carozzi 500g - $1.900',
      '33. Fideos Pluma Carozzi 500g - $1.900',
      '34. Aceite Vegetal Chef 1L - $3.200',
      '35. Aceite de Oliva Carapelli 500ml - $5.800',
      '36. Azúcar Granulada Iansa 1kg - $2.200',
      '37. Sal de Mesa Lobos 1kg - $800',
      '38. Harina Sin Polvos Selecta 1kg - $1.600',
      '39. Leche Condensada 397g - $1.600',
      '40. Mayonesa Hellmanns 500g - $2.200',
      '',
      '🍎 **FRUTAS Y VERDURAS (10 items):**',
      '41. Plátanos x6 unidades - $2.500',
      '42. Manzanas Rojas x4 - $2.800',
      '43. Manzanas Verdes x4 - $2.800',
      '44. Naranjas x6 - $3.200',
      '45. Tomates 1kg - $2.200',
      '46. Papas Blancas 2kg - $3.500',
      '47. Papas Rojas 2kg - $3.800',
      '48. Cebollas Blancas 1kg - $1.800',
      '49. Zanahorias 500g - $1.200',
      '50. Lechuga Escarola unidad - $1.400',
      '',
      '🧼 **LIMPIEZA Y ASEO (10 items):**',
      '51. Detergente Líquido Popeye 1L - $3.800',
      '52. Detergente Polvo Drive 1kg - $3.200',
      '53. Papel Higiénico Noble x4 - $4.200',
      '54. Jabón Líquido Dove 250ml - $1.600',
      '55. Champú Pantene 400ml - $4.500',
      '56. Acondicionador Pantene 400ml - $4.500',
      '57. Pasta Dental Colgate 100ml - $2.800',
      '58. Cloro Clorinda 1L - $1.200',
      '59. Desinfectante Lysoform 500ml - $2.200',
      '60. Esponja de Baño - $800'
    );
  }

  fallback.push(
    '',
    '🛒 **HACER PEDIDO:**',
    'Escribe: "Quiero [producto] cantidad [número]"',
    '',
    '📞 **CONTACTO DIRECTO:**',
    '+56 9 3649 9908',
    '⏰ 2:00 PM - 10:00 PM'
  );

  return fallback.join('\n');
}



// FUNCIÓN SENDCATALOG CORREGIDA - PREPARADA PARA TOKEN ACTUALIZADO
async function sendCatalog(provider: any, from: any, catalog: any, catalogType: string = 'main', useTemplate: boolean = false) {
    console.log('🛒 === ENVIANDO CATÁLOGO OFICIAL (TOKEN CORREGIDO) ===');
    console.log('📱 Destinatario:', from);
    
    try {
        // ✅ MÉTODO PRINCIPAL: Catálogo oficial de Meta (una vez corregido el token)
        console.log('🔧 Enviando catálogo oficial de Meta...');
        
        const catalogPayload = {
            messaging_product: "whatsapp",
            to: from,
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🛒 TodoMarket - Catálogo Oficial\n\n📦 Explora nuestros productos y agrega al carrito:\n\n👇 Presiona para abrir el catálogo"
                },
                footer: {
                    text: "Selecciona productos → Genera pedido automáticamente"
                },
                action: {
                    name: "catalog_message"
                    // Note: No incluimos catalog_id aquí para usar el por defecto conectado
                }
            }
        };
        
        const accessToken = process.env.JWT_TOKEN;
        const phoneNumberId = process.env.NUMBER_ID;
        
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(catalogPayload)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ CATÁLOGO OFICIAL ENVIADO EXITOSAMENTE:', result.messages[0].id);
            console.log('🛒 Usuario puede seleccionar productos y generar pedidos');
            return true;
            
        } else {
            const errorText = await response.text();
            console.error('❌ Error enviando catálogo oficial:', errorText);
            
            // Verificar si es problema de token
            if (errorText.includes('access token') || errorText.includes('expired')) {
                console.log('🚨 PROBLEMA DE TOKEN DETECTADO');
                console.log('� Solución: Actualizar JWT_TOKEN en variables de entorno');
                
                // Enviar mensaje informativo al usuario
                const tokenErrorMessage = [
                    '⚠️ *Catálogo temporalmente no disponible*',
                    '',
                    'El catálogo está siendo actualizado.',
                    '',
                    '� *Mientras tanto, puedes hacer tu pedido por WhatsApp:*',
                    '"Quiero [producto] cantidad [número]"',
                    '',
                    'O llama al: +56 9 7964 3935',
                    '⏰ Horario: 2:00 PM - 10:00 PM'
                ].join('\n');
                
                const errorPayload = {
                    messaging_product: "whatsapp",
                    to: from,
                    type: "text",
                    text: { body: tokenErrorMessage }
                };
                
                await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(errorPayload)
                });
                
                return false;
            }
            
            throw new Error(`Error catálogo: ${errorText}`);
        }
        
    } catch (error) {
        console.error('💥 Error en catálogo oficial, usando alternativa temporal:', error);
        
        // 🔄 FALLBACK: Lista interactiva temporal (mientras se corrige el token)
        try {
            console.log('🔄 Enviando lista interactiva como alternativa temporal...');
            
            const alternativePayload = createProductList(from);
            const accessToken = process.env.JWT_TOKEN;
            const phoneNumberId = process.env.NUMBER_ID;
            
            const alternativeResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alternativePayload)
            });
            
            if (alternativeResponse.ok) {
                const result = await alternativeResponse.json();
                console.log('✅ LISTA TEMPORAL ENVIADA:', result.messages[0].id);
                console.log('� Esta es una solución temporal hasta corregir el catálogo oficial');
                return true;
            } else {
                console.error('❌ Error en lista temporal');
                throw new Error('Fallo en método alternativo');
            }
            
        } catch (alternativeError) {
            console.error('❌ Error en método alternativo:', alternativeError);
            
            // 📞 ÚLTIMO RECURSO: Mensaje de texto con información de contacto
            const contactMessage = [
                '❌ *Catálogo temporalmente no disponible*',
                '',
                '📞 *Haz tu pedido directamente:*',
                '+56 9 7964 3935',
                '',
                '💬 *O escribe tu pedido aquí:*',
                '"Quiero [producto] cantidad [número]"',
                '',
                '⏰ *Horario:* 2:00 PM - 10:00 PM',
                '',
                '🔧 Estamos solucionando el catálogo'
            ].join('\n');
            
            const contactPayload = {
                messaging_product: "whatsapp",
                to: from,
                type: "text",
                text: { body: contactMessage }
            };
            
            try {
                await fetch(`https://graph.facebook.com/v18.0/${process.env.NUMBER_ID}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.JWT_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(contactPayload)
                });
                
                console.log('✅ Mensaje de contacto directo enviado');
                return true;
                
            } catch (contactError) {
                console.error('❌ Error total en envío:', contactError);
                return false;
            }
        }
    }
}

// 📦 CATÁLOGO DE PRODUCTOS TODOMARKET
// Mapeo de productos reales del minimarket (actualizar con tus productos)
const PRODUCT_CATALOG = {
    // 🥤 IDs REALES DE TU CATÁLOGO (basados en tu ejemplo)
    '51803h3qku': 'Coca Cola Lata 350ml Original',
    'ip1nctw0hq': 'Pan de Molde Integral Bimbo 500g',
    '5snmm6fndt': 'Leche Entera Soprole 1L',
    'ypgstd82t1': 'Arroz Grado 1 Tucapel 1kg',
    
    // 🥤 BEBIDAS Y REFRESCOS
    'bebida_001': 'Pepsi Lata 350ml',
    'bebida_002': 'Sprite Lata 350ml',
    'bebida_003': 'Fanta Naranja 350ml',
    'bebida_004': 'Agua Mineral Cachantun 1.5L',
    'bebida_005': 'Jugo Watts Durazno 1L',
    'bebida_006': 'Néctar Andes Manzana 1L',
    'bebida_007': 'Cerveza Cristal Lata 350ml',
    'bebida_008': 'Pisco Capel 35° 750ml',
    
    // 🍞 PANADERÍA Y CEREALES
    'pan_001': 'Pan Blanco Molde Ideal 500g',
    'pan_002': 'Hallulla Tradicional x6 unidades',
    'pan_003': 'Pan Pita Árabe x4 unidades',
    'pan_004': 'Cereal Corn Flakes Kelloggs 500g',
    'pan_005': 'Avena Quaker 500g',
    'pan_006': 'Galletas McKay Soda 200g',
    
    // 🥛 LÁCTEOS Y HUEVOS
    'lacteo_001': 'Leche Descremada Soprole 1L',
    'lacteo_002': 'Yogurt Natural Soprole 150g',
    'lacteo_003': 'Queso Gouda Colún 200g',
    'lacteo_004': 'Mantequilla Colún 250g',
    'lacteo_005': 'Huevos Blancos Docena',
    'lacteo_006': 'Crema Ácida Soprole 200ml',
    
    // 🌾 ABARROTES Y DESPENSA
    'abarrote_001': 'Fideos Espagueti Carozzi 500g',
    'abarrote_002': 'Aceite Vegetal Chef 1L',
    'abarrote_003': 'Azúcar Granulada Iansa 1kg',
    'abarrote_004': 'Sal de Mesa Lobos 1kg',
    'abarrote_005': 'Harina Sin Polvos Selecta 1kg',
    'abarrote_006': 'Lentejas San Antonio 500g',
    'abarrote_007': 'Porotos Negros Anasac 500g',
    'abarrote_008': 'Atún Desmenuzado Van Camp 160g',
    
    // 🍖 CARNES Y PESCADOS
    'carne_001': 'Pollo Entero Congelado',
    'carne_002': 'Pechuga de Pollo Deshuesada 1kg',
    'carne_003': 'Carne Molida de Vacuno 500g',
    'carne_004': 'Lomo Liso de Cerdo 1kg',
    'pescado_001': 'Salmón Filete Fresco 400g',
    'pescado_002': 'Merluza Entera Congelada',
    
    // 🍎 FRUTAS Y VERDURAS
    'fruta_001': 'Plátanos de Seda x6 unidades',
    'fruta_002': 'Manzanas Rojas Royal Gala x4',
    'fruta_003': 'Naranjas de Ombligo x6',
    'fruta_004': 'Paltas Hass x3 unidades',
    'verdura_001': 'Tomates Redondos 1kg',
    'verdura_002': 'Cebollas Blancas 1kg',
    'verdura_003': 'Papas Blancas 2kg',
    'verdura_004': 'Zanahorias 500g',
    'verdura_005': 'Lechuga Escarola unidad',
    
    // 🧼 LIMPIEZA Y ASEO
    'limpieza_001': 'Detergente Líquido Popeye 1L',
    'limpieza_002': 'Papel Higiénico Noble x4 rollos',
    'limpieza_003': 'Jabón en Polvo Drive 1kg',
    'limpieza_004': 'Cloro Clorinda 1L',
    'limpieza_005': 'Champú Pantene 400ml',
    'limpieza_006': 'Pasta Dental Colgate 100ml',
    
    // 🍫 SNACKS Y DULCES
    'snack_001': 'Papas Fritas Marco Polo 150g',
    'snack_002': 'Chocolate Sahne-Nuss 100g',
    'snack_003': 'Galletas Oreo 154g',
    'snack_004': 'Maní Salado Crocante 200g',
    
    // ❄️ CONGELADOS
    'congelado_001': 'Helado Savory Vainilla 1L',
    'congelado_002': 'Papas Pre-Fritas McCain 1kg',
    'congelado_003': 'Pizza Casera Grande',
    
    // 🔥 OTROS PRODUCTOS POPULARES
    'otros_001': 'Cigarrillos Marlboro Box',
    'otros_002': 'Pilas AA Duracell x4',
    'otros_003': 'Encendedor BIC',
    'otros_004': 'Bolsas Basura Negras x10',
};

// 📊 ESTADÍSTICAS DEL CATÁLOGO
console.log(`📦 Catálogo TodoMarket cargado: ${Object.keys(PRODUCT_CATALOG).length} productos disponibles`);

// Función helper para agregar productos al catálogo dinámicamente
function addProductToCatalog(productId: string, productName: string) {
    (PRODUCT_CATALOG as any)[productId] = productName;
    console.log(`✅ Producto agregado al catálogo: ${productId} -> ${productName}`);
}

// Función helper para obtener todos los productos del catálogo
function getAllProducts() {
    return Object.entries(PRODUCT_CATALOG).map(([id, name]) => ({ id, name }));
}

// Función para debuggear y listar todos los productos disponibles en el catálogo de Meta
async function debugCatalogProducts(catalogId: string, provider: any) {
    try {
        console.log('\n🔍 === DEBUG: LISTANDO PRODUCTOS DEL CATÁLOGO ===');
        console.log('📋 Catalog ID:', catalogId);
        
        const accessToken = provider.jwtToken || process.env.JWT_TOKEN || process.env.JWT_TOKEN_USER;
        
        if (!accessToken) {
            console.log('❌ No se encontró token de acceso');
            return;
        }
        
        const catalogUrl = `https://graph.facebook.com/v22.0/${catalogId}/products`;
        const catalogParams = {
            fields: 'id,name,description,price,currency,retailer_id,availability,condition,brand',
            access_token: accessToken,
            limit: '50' // Limitar para no sobrecargar
        };
        
        const catalogQueryString = new URLSearchParams(catalogParams).toString();
        const catalogFullUrl = `${catalogUrl}?${catalogQueryString}`;
        
        console.log('📡 Consultando catálogo completo...');
        
        // const response = await fetch(catalogFullUrl, {
        //     method: 'GET',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     }
        // });
        
        // if (response.ok) {
        //     const data = await response.json();
        //     console.log('✅ Respuesta exitosa del catálogo');
            
        //     if (data && data.data && Array.isArray(data.data)) {
        //         console.log(`📦 Productos encontrados: ${data.data.length}`);
        //         console.log('\n📋 LISTA DE PRODUCTOS:');
        //         console.log('========================');
                
        //         data.data.forEach((product, index) => {
        //             console.log(`${index + 1}. ID: ${product.id || 'N/A'}`);
        //             console.log(`   Retailer ID: ${product.retailer_id || 'N/A'}`);
        //             console.log(`   Nombre: ${product.name || 'N/A'}`);
        //             console.log(`   Precio: ${product.price || 'N/A'} ${product.currency || ''}`);
        //             console.log(`   Disponibilidad: ${product.availability || 'N/A'}`);
        //             console.log(`   Marca: ${product.brand || 'N/A'}`);
        //             console.log('   ---');
        //         });
                
        //         // Buscar los IDs específicos que estamos probando
        //         const testIds = ['51803h3qku', 'ip1nctw0hq', '5snmm6fndt', 'ypgstd82t1'];
        //         console.log('\n🔍 VERIFICANDO IDs DE PRUEBA:');
        //         console.log('=============================');
                
        //         testIds.forEach(testId => {
        //             const found = data.data.find(p => p.retailer_id === testId || p.id === testId);
        //             if (found) {
        //                 console.log(`✅ ${testId}: ENCONTRADO -> ${found.name}`);
        //             } else {
        //                 console.log(`❌ ${testId}: NO ENCONTRADO`);
        //             }
        //         });
                
        //     } else {
        //         console.log('⚠️ No se encontraron productos en la respuesta');
        //     }
        // } else {
        //     console.log('❌ Error HTTP:', response.status, response.statusText);
        //     const errorText = await response.text();
        //     console.log('📄 Respuesta de error:', errorText);
        // }
        
        console.log('\n=== FIN DEBUG CATÁLOGO ===\n');
        
    } catch (error) {
        console.error('❌ Error debuggeando catálogo:', error);
    }
}

// Función de ejemplo para demostrar el nuevo formato
function demonstrateNewFormat() {
    console.log('\n📋 === EJEMPLO DEL NUEVO FORMATO CON META API ===');
    console.log('📡 Flujo de obtención de datos:');
    console.log('1. 🎯 Prioridad 1: Meta Business API (nombres reales del catálogo)');
    console.log('2. 🔄 Prioridad 2: Catálogo local (fallback)');
    console.log('3. 📝 Prioridad 3: ID como nombre (fallback final)');
    
    console.log('\n📦 Datos de la orden (desde Meta):');
    console.log('catalog_id: 1057244946408276');
    console.log('product_items: [51803h3qku, ip1nctw0hq, ...]');
    
    console.log('\n🔍 Consulta a Meta API:');
    console.log('GET /v22.0/1057244946408276/products?retailer_id=51803h3qku');
    
    console.log('\n✅ Resultado mejorado:');
    console.log('👉 #1 [Nombre Real del Catálogo] | ID: 51803h3qku | Cantidad: 1 | Precio: $1900');
    console.log('👉 #2 [Nombre Real del Catálogo] | ID: ip1nctw0hq | Cantidad: 1 | Precio: $1600');
    
    console.log('\n� Beneficios:');
    console.log('- Nombres reales y actualizados desde Meta');
    console.log('- Sincronización automática con el catálogo');
    console.log('- Fallback robusto si hay problemas de conexión');
    console.log('===============================================\n');
}

// Función para simular respuesta de Meta API (para testing)
function simulateMetaAPIResponse(productId: string) {
    // Simulación de respuestas reales que podrías recibir de Meta
    const mockResponses = {
        '51803h3qku': {
            data: [{
                id: '51803h3qku',
                name: 'Coca Cola Lata 350ml',
                description: 'Bebida gaseosa cola en lata de 350ml',
                price: '1900',
                currency: 'CLP',
                brand: 'Coca Cola',
                availability: 'in stock'
            }]
        },
        'ip1nctw0hq': {
            data: [{
                id: 'ip1nctw0hq',
                name: 'Pan de Molde Integral Bimbo',
                description: 'Pan de molde integral 500g',
                price: '1600',
                currency: 'CLP',
                brand: 'Bimbo'
            }]
        }
    };
    
    return mockResponses[productId as keyof typeof mockResponses] || null;
}

// Función para obtener detalles del producto desde Meta Business API
async function getProductDetailsFromMeta(productId: string, catalogId: string, provider: any) {
    try {
        console.log('🔍 Consultando Meta API para producto:', productId, 'en catálogo:', catalogId);
        
        // Obtener el token de acceso
        const accessToken = process.env.JWT_TOKEN || process.env.JWT_TOKEN_USER;
        if (!accessToken) {
            console.log('⚠️ No se encontró token de acceso para Meta API');
            return null;
        }
        
        // Método 1: Intentar obtener todos los productos del catálogo y filtrar
        try {
            console.log('📡 Método 1: Obteniendo productos del catálogo completo');
            
            const catalogUrl = `https://graph.facebook.com/v23.0/${catalogId}/products`;
            const catalogParams = {
                fields: 'id,name,description,price,currency,retailer_id,availability,condition,brand',
                access_token: accessToken,
                limit: '100' // Limitar para no sobrecargar
            };
            
            const catalogQueryString = new URLSearchParams(catalogParams).toString();
            const catalogFullUrl = `${catalogUrl}?${catalogQueryString}`;
            
            console.log('📡 URL catálogo:', catalogFullUrl.replace(accessToken, '***TOKEN***'));
            
            const catalogResponse = await fetch(catalogFullUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (catalogResponse.ok) {
                const catalogData = await catalogResponse.json();
                console.log('📦 Productos encontrados en catálogo:', catalogData.data ? catalogData.data.length : 0);
                
                if (catalogData && catalogData.data && Array.isArray(catalogData.data)) {
                    // Buscar el producto por retailer_id
                    const product = catalogData.data.find(p => p.retailer_id === productId);
                    
                    if (product) {
                        console.log('✅ Producto encontrado en Meta:', product.name);
                        return {
                            id: productId,
                            name: product.name || `Producto ${productId}`,
                            description: product.description || null,
                            brand: product.brand || null,
                            metaPrice: product.price || null,
                            currency: product.currency || 'CLP',
                            availability: product.availability || null,
                            source: 'meta_api'
                        };
                    } else {
                        console.log('⚠️ Producto con ID', productId, 'no encontrado en el catálogo');
                    }
                }
            } else {
                console.log('❌ Error HTTP en catálogo:', catalogResponse.status, catalogResponse.statusText);
                const errorText = await catalogResponse.text();
                console.log('📄 Respuesta de error:', errorText);
            }
        } catch (catalogError) {
            console.log('❌ Error consultando catálogo completo:', catalogError);
        }
        
        // Método 2: Intentar consultar producto individual (si el método anterior falla)
        // try {
        //     console.log('📡 Método 2: Consultando producto individual');
            
        //     // Buscar si existe un producto con ese retailer_id específico
        //     const productUrl = `https://graph.facebook.com/v22.0/${catalogId}/products`;
        //     const productParams = {
        //         fields: 'id,name,description,price,currency,retailer_id,availability,condition,brand',
        //         access_token: accessToken,
        //         retailer_id: productId
        //     };
            
        //     const productQueryString = new URLSearchParams(productParams).toString();
        //     const productFullUrl = `${productUrl}?${productQueryString}`;
            
        //     console.log('📡 URL producto individual:', productFullUrl.replace(accessToken, '***TOKEN***'));
            
        //     const productResponse = await fetch(productFullUrl, {
        //         method: 'GET',
        //         headers: {
        //             'Content-Type': 'application/json',
        //         }
        //     });
            
        //     if (productResponse.ok) {
        //         const productData = await productResponse.json();
        //         console.log('📦 Respuesta producto individual:', JSON.stringify(productData, null, 2));
                
        //         if (productData && productData.data && Array.isArray(productData.data) && productData.data.length > 0) {
        //             const product = productData.data[0];
        //             console.log('✅ Producto encontrado (método 2):', product.name);
                    
        //             return {
        //                 id: productId,
        //                 name: product.name || `Producto ${productId}`,
        //                 description: product.description || null,
        //                 brand: product.brand || null,
        //                 metaPrice: product.price || null,
        //                 currency: product.currency || 'CLP',
        //                 availability: product.availability || null,
        //                 source: 'meta_api_individual'
        //             };
        //         }
        //     } else {
        //         console.log('❌ Error HTTP producto individual:', productResponse.status, productResponse.statusText);
        //         const errorText = await productResponse.text();
        //         console.log('📄 Respuesta de error:', errorText);
        //     }
        // } catch (individualError) {
        //     console.log('❌ Error consultando producto individual:', individualError);
        // }
        
        console.log('⚠️ Producto no encontrado con ningún método');
        return null;
        
    } catch (error) {
        console.error('❌ Error general consultando Meta Business API:', error);
        if (error instanceof Error) {
            console.error('📋 Detalle del error:', error.message);
        }
        return null;
    }
}

// Función alternativa para obtener productos usando Meta Business API v2
async function getProductDetailsFromMetaAlternative(productId: string, catalogId: string, provider: any) {
    try {
        console.log('🔄 Método alternativo: Consultando Meta Graph API');
        
        const accessToken = provider.jwtToken || process.env.JWT_TOKEN;
        
        if (!accessToken) {
            console.log('⚠️ No se encontró token de acceso');
            return null;
        }
        
        // Método alternativo: Usar la API de Graph directamente
        // Según la documentación, también se puede acceder vía: /{business-id}/owned_product_catalogs
        // try {
        //     console.log('📡 Intentando acceso directo a producto por retailer_id');
            
        //     const directUrl = `https://graph.facebook.com/v22.0/${catalogId}/products/${productId}`;
        //     const directParams = {
        //         fields: 'id,name,description,price,currency,retailer_id,availability,condition,brand',
        //         access_token: accessToken
        //     };
            
        //     const directQueryString = new URLSearchParams(directParams).toString();
        //     const directFullUrl = `${directUrl}?${directQueryString}`;
            
        //     console.log('📡 URL acceso directo:', directFullUrl.replace(accessToken, '***TOKEN***'));
            
        //     // const directResponse = await fetch(directFullUrl, {
        //     //     method: 'GET',
        //     //     headers: {
        //     //         'Content-Type': 'application/json',
        //     //     }
        //     // });
            
        //     // if (directResponse.ok) {
        //     //     const directData = await directResponse.json();
        //     //     console.log('📦 Respuesta acceso directo:', JSON.stringify(directData, null, 2));
                
        //     //     if (directData && directData.id) {
        //     //         console.log('✅ Producto encontrado (acceso directo):', directData.name);
        //     //         return {
        //     //             id: productId,
        //     //             name: directData.name || `Producto ${productId}`,
        //     //             description: directData.description || null,
        //     //             brand: directData.brand || null,
        //     //             metaPrice: directData.price || null,
        //     //             currency: directData.currency || 'CLP',
        //     //             availability: directData.availability || null,
        //     //             source: 'meta_api_direct'
        //     //         };
        //     //     }
        //     // } else {
        //     //     console.log('❌ Error acceso directo:', directResponse.status, directResponse.statusText);
        //     //     const errorText = await directResponse.text();
        //     //     console.log('📄 Error directo:', errorText);
        //     // }
        // } catch (directError) {
        //     console.log('❌ Error en acceso directo:', directError);
        // }
        
        return null;
        
    } catch (error) {
        console.error('❌ Error en método alternativo:', error);
        return null;
    }
}

// Función para obtener detalles del producto (optimizada para permisos disponibles)
async function getProductDetails(productId: string, catalogId: string, provider: any) {
    try {
        console.log('🔍 === INICIO BÚSQUEDA PRODUCTO ===');
        console.log('📋 Product ID:', productId);
        console.log('📋 Catalog ID:', catalogId);
        
        // ⚠️  NOTA: Token actual no tiene permisos catalog_management
        // Saltamos directamente al catálogo local que es más confiable
        
        // Prioridad 1: Verificar en el mapeo local (más rápido y confiable)
        console.log('🎯 Prioridad 1: Consultando catálogo local...');
        const localProductName = PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG];
        
        if (localProductName) {
            console.log('✅ Producto encontrado en catálogo local:', localProductName);
            return {
                id: productId,
                name: localProductName,
                description: null,
                source: 'local_catalog'
            };
        }
        
        // Prioridad 2: Consultar Meta API (REACTIVADO)
        if (catalogId && provider && process.env.ENABLE_META_API === 'true') {
            console.log('🔄 Prioridad 2: Consultando Meta Business API...');
            try {
                const metaProduct = await getProductDetailsFromMeta(productId, catalogId, provider);
                if (metaProduct) {
                    console.log('✅ Producto obtenido desde Meta API:', metaProduct.name);
                    return metaProduct;
                } else {
                    console.log('⚠️ Meta API no retornó datos, usando catálogo local como fallback');
                }
            } catch (apiError) {
                console.error('❌ Error consultando Meta API, usando catálogo local:', apiError.message);
            }
        } else {
            console.log('ℹ️ Meta API deshabilitada o faltan parámetros, usando catálogo local');
        }
        
        // Prioridad 3: Fallback final - usar ID como nombre
        console.log('📝 Prioridad 3: Usando ID como nombre (fallback final)');
        return {
            id: productId,
            name: `Producto ${productId}`,
            description: null,
            source: 'fallback'
        };
        
    } catch (error) {
        console.error('❌ Error general obteniendo detalles del producto:', productId, error);
        return {
            id: productId,
            name: `Producto ${productId}`,
            description: null,
            source: 'error_fallback'
        };
    } finally {
        console.log('🔍 === FIN BÚSQUEDA PRODUCTO ===\n');
    }
}

// Función para procesar órdenes desde el catálogo (según Meta API) - Versión mejorada
async function processOrderFromCatalog(productItems: any[], catalogId: string, provider?: any) {
    const containerProducts: any[] = [];
    containerProducts.push("*Productos Seleccionados desde Catálogo*\n\n");
    
    try {
        let counterGlobal = 1;
        let totalAmount = 0;
        
        console.log('📦 Procesando productos del catálogo:', catalogId);
        
        // Procesar cada producto de la orden con detalles mejorados
        for (const item of productItems) {
            // Según Meta API, cada product_item contiene:
            // - product_retailer_id: ID del producto
            // - quantity: cantidad
            // - item_price: precio (opcional)
            
            const productId = item.product_retailer_id || item.id;
            const quantity = item.quantity || 1;
            const itemPrice = item.item_price || 0;
            
            // Obtener detalles adicionales del producto desde Meta API o catálogo local
            let productName = productId; // Por defecto usar el ID
            // let productInfo = null; // Comentado para evitar warning de lint
            
            // Consulta híbrida: Meta API + Catálogo local como fallback
            console.log('📦 Consultando producto con Meta API habilitada:', productId);
            
            if (provider && catalogId) {
                try {
                    // Prioridad 1: Meta API para obtener datos actuales
                    console.log('� Consultando Meta API...');
                    const productDetails = await getProductDetails(productId, catalogId, provider);
                    
                    if (productDetails && productDetails.source === 'meta_api') {
                        productName = productDetails.name;
                        console.log('✅ Producto obtenido desde Meta API:', productName);
                    } else {
                        // Fallback a catálogo local
                        const localProductName = PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG];
                        if (localProductName) {
                            productName = localProductName;
                            console.log('✅ Producto obtenido desde catálogo local (fallback):', localProductName);
                        } else {
                            console.log('⚠️ Producto no encontrado en ningún catálogo, usando ID:', productId);
                        }
                    }
                } catch (error) {
                    console.log('❌ Error consultando producto, usando catálogo local:', error.message);
                    
                    // Fallback seguro al catálogo local
                    const localProductName = PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG];
                    if (localProductName) {
                        productName = localProductName;
                        console.log('✅ Producto obtenido desde catálogo local (error fallback):', localProductName);
                    }
                }
            } else {
                console.log('ℹ️ Parámetros faltantes para Meta API, usando catálogo local');
                const localProductName = PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG];
                if (localProductName) {
                    productName = localProductName;
                    console.log('✅ Producto encontrado en catálogo local:', localProductName);
                }
            }
            
            // Crear línea de producto con nombre mejorado
            const valueG = `👉 #${counterGlobal} ${productName} | Cantidad: ${quantity} | Precio: $${itemPrice}\n`;
            containerProducts.push(valueG);
            
            // Sumar al total (si hay precio disponible)
            totalAmount += (itemPrice * quantity);
            counterGlobal++;
        }
        
        if (totalAmount > 0) {
            containerProducts.push(`\n💰 Total a Pagar: $${totalAmount}`);
        } else {
            containerProducts.push(`\n💡 *Nota:* Los precios se confirmarán en el siguiente paso.`);
        }
        
        console.log('✅ Productos procesados con detalles:', containerProducts);
        return containerProducts;
        
    } catch (error) {
        console.error('❌ Error procesando productos del catálogo:', error);
        return ["❌ Error procesando los productos seleccionados"];
    }
}

// Función original para compatibilidad (mantenida pero actualizada)
async function processOrder(details: any) {
    const containerProducts: any[] = [];
    containerProducts.push("*Productos Seleccionados*\n\n");
    const TotalAmount = details?.price?.total / 1000 || 0;
    const Products = details?.products || [];

    let counterGlobal = 1

    Products.forEach(element => {
        const valueG =`👉 #:${counterGlobal} Nombre: ${element.name} Cantidad:${element.quantity}  Precio:${(element.price / 1000)}\n`
        containerProducts.push(valueG)
        counterGlobal++;
    });
    containerProducts.push(`\nTotal a Pagar: ${TotalAmount}`)

    console.log('containerProducts dentro de processOrder', containerProducts)
    return containerProducts;
}

async function notificationDelivery(order: any, address: any, paymentMethod: any, name: any, phone: any, provider: any) {
    try {
        const dataMessageGlobal: any[] = [];
        dataMessageGlobal.push(`*🛒 Se registró nuevo pedido con Detalle: 🛒*\n`);
        dataMessageGlobal.push(`*Nombre Cliente:* ${name}\n*Teléfono:* +${phone}\n`);
        dataMessageGlobal.push(`*Dirección:* ${address}\n`);
        dataMessageGlobal.push(`*Método de pago:* ${paymentMethod}\n`);
        dataMessageGlobal.push(`*Productos:*\n${order.join('')}`);
        
        const finalMessage = dataMessageGlobal.join('');
        console.log('📧 Enviando notificación de pedido:', finalMessage);
        
        await provider.sendText('56936499908@s.whatsapp.net', finalMessage);
        console.log('✅ Notificación de pedido enviada exitosamente');
        
    } catch (error) {
        console.error('❌ Error enviando notificación de pedido:', error);
        // No fallar el flujo si hay error enviando la notificación
    }
}

/**
 * Maneja las notificaciones de estado de mensajes
 */
function handleMessageStatus(status: any) {
    const { id, recipient_id, status: messageStatus, timestamp } = status;
    
    switch (messageStatus) {
        case 'sent':
            console.log(`✅ Mensaje ${id} enviado a ${recipient_id}`);
            // Aquí puedes guardar en BD, enviar notificación, etc.
            break;
            
        case 'delivered':
            console.log(`📦 Mensaje ${id} entregado a ${recipient_id}`);
            // Lógica para mensaje entregado
            break;
            
        case 'read':
            console.log(`👀 Mensaje ${id} leído por ${recipient_id}`);
            // Lógica para mensaje leído
            break;
            
        case 'failed':
            console.error(`❌ Mensaje ${id} falló al enviarse a ${recipient_id}`);
            if (status.errors) {
                console.error('Errores:', status.errors);
            }
            break;
            
        default:
            console.log(`📋 Estado desconocido: ${messageStatus} para mensaje ${id}`);
    }
}

  /**
* Declarando flujo principal
*/
const flowDisable = addKeyword("disable")
.addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow, IDLETIME))
.addAnswer([
   '🚚 Hola, Bienvenido a *Minimarket TodoMarket* 🛵', 
   '⌛ Nuestra disponibilidad para atenderte esta desde las 12:00 PM hasta las 10:00 PM. ⌛'
])
.addAnswer(
    [
       'Pero puedes ver nuestras redes sociales y recuerda que en el horario habilitado Empieza tu pedido escribiendo la palabra *Hola*', 
       '👉 #1 Facebook', 
       '👉 #2 Instagram', 
       '👉 #3 TicTok'
    ],
    { capture: true,  delay: 2000, idle: 960000 },
    async (ctx,{ endFlow, fallBack, gotoFlow}) => {
        console.log('🔍 FlowDisable - Opción recibida:', ctx.body);
        console.log('🔍 FlowDisable - Contexto completo:', JSON.stringify(ctx, null, 2));
        
        const userInput = ctx.body.toLowerCase().trim();
        
        // Opción 1: Facebook
        if (userInput === "1" || userInput.includes('facebook')) {
            stop(ctx)
            console.log('📘 Usuario seleccionó Facebook en flowDisable');
            return endFlow('En el siguiente Link tendras la opcion de ver Nuestra Pagina de Facebook\n 🔗 https://www.facebook.com/profile.php?id=61550250449208 \n*Gracias*');
        }
        
        // Opción 2: Instagram (VALIDACIÓN ESPECÍFICA PARA EVITAR CONFLICTO)
        if (userInput === "2" || userInput.includes('instagram')) {
            stop(ctx)
            console.log('📷 Usuario seleccionó Instagram en flowDisable (NO debe ir a FlowAgente2)');
            return endFlow('En el siguiente Link tendras la opcion de ver Nuestra Pagina de Instagram\n 🔗 https://www.instagram.com/todomarket_chile?igsh=c2M4bmVwaG5mNncw \n*Gracias*');
        }
        
        // Opción 3: TikTok
        if (userInput === "3" || userInput.includes('tiktok') || userInput.includes('tik tok')) {
            stop(ctx)
            console.log('🎵 Usuario seleccionó TikTok en flowDisable');
            return endFlow('En el siguiente Link tendras la opcion de ver Nuestro TikTok\n 🔗 https://vm.tiktok.com/ZMjkbTYBg/ \n*Gracias*');
        } 

        // Opción inválida
        console.log('❌ Opción inválida en flowDisable:', ctx.body);
        reset(ctx, gotoFlow, IDLETIME)
        return fallBack("*Opcion no valida*, \nPor favor seleccione una opcion valida:\n👉 #1 Facebook\n👉 #2 Instagram\n👉 #3 TikTok");
    }
)



// const recording = async function (ctx: any, provider: any) {
//     if (provider && provider?.vendor && provider.vendor?.sendPresenceUpdate) {
//         const id = ctx.key.remoteJid
//         await provider.vendor.sendPresenceUpdate('recording', id)
//     }
// }

const flowValidTime = addKeyword<Provider, Database>(EVENTS.WELCOME)
 .addAction(async(ctx, {gotoFlow, provider, state}) => {
     try {
        console.log('� === MENSAJE RECIBIDO ===');
        console.log('📱 De:', ctx.from);
        console.log('📝 Mensaje:', ctx.body);
        console.log('👤 Nombre:', ctx.pushName);
        console.log('🆔 Message ID:', ctx.message_id);
        console.log('🔍 Contexto completo:', JSON.stringify(ctx, null, 2));
        
        console.log('🔄 Paso 1: Iniciando markMessageAsRead...');
        // ✅ HABILITADO - función corregida según documentación oficial
        // if (ctx.message_id) {
        //     try {
        //         await markMessageAsRead(ctx, provider);
        //         console.log('✅ markMessageAsRead exitoso');
        //     } catch (markReadError) {
        //         console.error('❌ Error en markMessageAsRead (continuando flujo):', markReadError);
        //     }
        // } else {
        //     console.log('⚠️ No hay message_id disponible');
        // }
        console.log('🔄 Paso 2: markMessageAsRead completado, continuando flujo...');

        console.log('🔄 Paso 3: Actualizando estado del usuario...');
        // Guardar información del usuario
        await state.update({ 
            name: ctx.pushName || ctx.body,
            phone: ctx.from,
            lastActivity: new Date().toISOString()
        });
        console.log('🔄 Paso 4: Estado actualizado, iniciando validación horario...');

        // Validación de horario
        const horaActual = moment();
        const horario = "01:00-22:00"; // Horario de atención (2:00 PM - 10:00 PM)
        const rangoHorario = horario.split("-");
        const horaInicio = moment(rangoHorario[0], "HH:mm");
        const horaFin = moment(rangoHorario[1], "HH:mm");
        
        console.log(`⏰ Hora actual: ${horaActual.format('HH:mm')} | Horario: ${horario}`);
        console.log('🔄 Paso 5: Verificando horario...');
        
        // Verificar si está en horario de atención
        if (horaActual.isBetween(horaInicio, horaFin)) {
            console.log('✅ Dentro del horario de atención - Redirigiendo a flowPrincipal');
            console.log('🔄 Paso 6A: Ejecutando gotoFlow(flowPrincipal)');
            return gotoFlow(flowPrincipal);
        } else {
            console.log('❌ Fuera del horario de atención - Redirigiendo a flowDisable');
            console.log('🔄 Paso 6B: Ejecutando gotoFlow(flowDisable)');
            return gotoFlow(flowDisable); // Flujo para horario no disponible
        }

    } catch (error) {
        console.error('💥 Error en flowValidTime:', error);
        // En caso de error, redirigir al flujo principal
        return gotoFlow(flowPrincipal);
    }
 });



// 🧪 FLUJO DE PRUEBA PARA DEBUGGING - VERSIÓN SIMPLIFICADA
const flowTest = addKeyword(['test', 'prueba', 'hola', 'hi', 'hello', 'ola'])
.addAnswer('🧪 *TEST: ¡Bot funcionando correctamente!*')
.addAnswer([
    '✅ *Bot TodoMarket está funcionando*',
    '',
    '📋 Respuesta de prueba enviada exitosamente',
    '',
    '🔧 Si ves este mensaje, el bot responde correctamente'
], null, async (ctx) => {
    console.log('🧪 TEST: Mensaje recibido:', ctx.body);
    console.log('🧪 TEST: Usuario:', ctx.from, ctx.pushName);
    console.log('🧪 TEST: Respuesta enviada correctamente');
});

// 🔍 FLUJO DE PRUEBA ESPECÍFICO PARA CATÁLOGO META
const flowTestCatalog = addKeyword(['catalog', 'catalogo', 'meta'])
.addAnswer('🔍 *Probando consulta al catálogo de Meta...*', null, async (ctx, {flowDynamic, provider}) => {
    console.log('🔍 === PRUEBA DE CATÁLOGO META ===');
    
    try {
        // Probar con un ID de producto conocido
        const testProductId = '51803h3qku'; // Coca Cola según tu catálogo
        const catalogId = '1057244946408276'; // Tu catalog ID
        
        console.log('🔄 Probando consulta a Meta API...');
        console.log('📋 Product ID:', testProductId);
        console.log('📋 Catalog ID:', catalogId);
        
        // Llamar directamente a la función de Meta API
        const result = await getProductDetailsFromMeta(testProductId, catalogId, provider);
        
        if (result) {
            await flowDynamic([
                '✅ *Consulta a Meta API exitosa*',
                '',
                `📦 Producto: ${result.name}`,
                `🏷️ ID: ${result.id}`,
                `📋 Fuente: ${result.source}`,
                `💰 Precio: ${result.metaPrice || 'No disponible'}`,
                `💱 Moneda: ${result.currency || 'N/A'}`,
                '',
                '🎉 La consulta al catálogo de Meta está funcionando'
            ].join('\n'));
        } else {
            await flowDynamic([
                '⚠️ *Consulta a Meta API sin resultados*',
                '',
                'La consulta se realizó pero no retornó datos.',
                'Posibles causas:',
                '• El producto no existe en el catálogo',
                '• Permisos insuficientes del token',
                '• Catalog ID incorrecto',
                '',
                '📝 Revisa los logs de la consola para más detalles'
            ].join('\n'));
        }
        
    } catch (error) {
        console.error('❌ Error en prueba de catálogo:', error);
        
        await flowDynamic([
            '❌ *Error en consulta a Meta API*',
            '',
            `🚨 Error: ${error.message}`,
            '',
            'Posibles causas:',
            '• Token de acceso expirado',
            '• Permisos insuficientes',
            '• Problemas de conectividad',
            '• Configuración incorrecta',
            '',
            '📝 Revisa los logs de la consola para más detalles'
        ].join('\n'));
    }
});

// ═══════════════════════════════════════════════════════════════
// 🛒 FLUJO DE CATEGORÍAS DE PRODUCTOS - flowProductCategories
// ═══════════════════════════════════════════════════════════════
// Flow funcional para manejar la navegación por categorías de productos
// ═══════════════════════════════════════════════════════════════

const flowProductCategories = addKeyword(['categoria_bebidas', 'categoria_panaderia', 'categoria_lacteos', 'categoria_abarrotes', 'categoria_frutas', 'categoria_limpieza'])
.addAction(async (ctx, { flowDynamic, provider }) => {
    try {
        console.log('🛒 === MANEJO DE CATEGORÍA DE PRODUCTOS ===');
        console.log('📱 Usuario:', ctx.from);
        console.log('📋 Categoría seleccionada:', ctx.body);
        console.log('📋 Contexto completo:', JSON.stringify(ctx, null, 2));
        
        const categoryId = ctx.body;
        const from = ctx.from;
        
        // 🔧 SOLUCIÓN SIMPLIFICADA: Enviar productos como texto simple
        console.log('🔄 Enviando productos como mensaje de texto...');
        
        let productMessage = '';
        
        switch (categoryId) {
            case 'categoria_bebidas':
                productMessage = [
                    '🥤 *Bebidas y Refrescos*',
                    '',
                    '• Coca Cola Lata 350ml - $1.900',
                    '• Pepsi Lata 350ml - $1.800',
                    '• Sprite Lata 350ml - $1.800',
                    '• Agua Mineral 1.5L - $1.200',
                    '• Jugo Watts Durazno 1L - $2.500',
                    '',
                    '📞 *Para hacer tu pedido escribe:*',
                    '"Quiero 2 coca cola" o "Necesito agua"',
                    '',
                    'O llama al: +56 9 7964 3935'
                ].join('\n');
                break;
                
            case 'categoria_panaderia':
                productMessage = [
                    '🍞 *Panadería y Cereales*',
                    '',
                    '• Pan de Molde 500g - $1.600',
                    '• Hallullas x6 unidades - $2.200',
                    '• Cereal Corn Flakes 500g - $4.500',
                    '• Avena Quaker 500g - $3.200',
                    '',
                    '📞 *Para hacer tu pedido escribe:*',
                    '"Quiero pan de molde" o "Necesito hallullas"',
                    '',
                    'O llama al: +56 9 7964 3935'
                ].join('\n');
                break;
                
            case 'categoria_lacteos':
                productMessage = [
                    '🥛 *Lácteos y Huevos*',
                    '',
                    '• Leche Entera 1L - $1.400',
                    '• Yogurt Natural 150g - $800',
                    '• Queso Gouda 200g - $4.200',
                    '• Huevos Docena - $3.500',
                    '',
                    '📞 *Para hacer tu pedido escribe:*',
                    '"Quiero leche" o "Necesito huevos"',
                    '',
                    'O llama al: +56 9 7964 3935'
                ].join('\n');
                break;
                
            case 'categoria_abarrotes':
                productMessage = [
                    '🌾 *Abarrotes*',
                    '',
                    '• Arroz Grado 1 1kg - $2.800',
                    '• Fideos Espagueti 500g - $1.900',
                    '• Aceite Vegetal 1L - $3.200',
                    '• Azúcar 1kg - $2.200',
                    '',
                    '📞 *Para hacer tu pedido escribe:*',
                    '"Quiero arroz" o "Necesito aceite"',
                    '',
                    'O llama al: +56 9 7964 3935'
                ].join('\n');
                break;
                
            case 'categoria_frutas':
                productMessage = [
                    '🍎 *Frutas y Verduras*',
                    '',
                    '• Plátanos x6 unidades - $2.500',
                    '• Manzanas Rojas x4 - $2.800',
                    '• Tomates 1kg - $2.200',
                    '• Papas 2kg - $3.500',
                    '',
                    '📞 *Para hacer tu pedido escribe:*',
                    '"Quiero plátanos" o "Necesito tomates"',
                    '',
                    'O llama al: +56 9 7964 3935'
                ].join('\n');
                break;
                
            case 'categoria_limpieza':
                productMessage = [
                    '🧼 *Limpieza y Aseo*',
                    '',
                    '• Detergente Líquido 1L - $3.800',
                    '• Papel Higiénico x4 - $4.200',
                    '• Champú 400ml - $4.500',
                    '• Pasta Dental 100ml - $2.800',
                    '',
                    '📞 *Para hacer tu pedido escribe:*',
                    '"Quiero detergente" o "Necesito papel"',
                    '',
                    'O llama al: +56 9 7964 3935'
                ].join('\n');
                break;
                
            default:
                productMessage = [
                    '❌ *Categoría no encontrada*',
                    '',
                    '📱 *Categorías disponibles:*',
                    '• Bebidas y Refrescos 🥤',
                    '• Panadería y Cereales 🍞',
                    '• Lácteos y Huevos 🥛',
                    '• Abarrotes 🌾',
                    '• Frutas y Verduras 🍎',
                    '• Limpieza y Aseo 🧼',
                    '',
                    'Escribe "hola" para ver el catálogo nuevamente'
                ].join('\n');
        }
        
        // Enviar mensaje de texto simple (más confiable)
        await flowDynamic([productMessage]);
        console.log('✅ Productos enviados como texto simple para:', categoryId);
        
    } catch (error) {
        console.error('💥 Error en flowProductCategories:', error);
        
        // Fallback ultra simple
        const fallbackMessage = [
            '❌ *Error mostrando productos*',
            '',
            '📞 *Llama directamente para hacer tu pedido:*',
            '+56 9 7964 3935',
            '',
            '⏰ *Horario:* 2:00 PM - 10:00 PM',
            '',
            'O escribe "hola" para ver el catálogo nuevamente'
        ].join('\n');
        
        await flowDynamic([fallbackMessage]);
    }
});

// 🔄 FLUJO PARA VOLVER A CATEGORÍAS
const flowBackToCategories = addKeyword(['volver_categorias'])
.addAction(async (ctx, { provider }) => {
    try {
        console.log('🔄 Usuario regresando a categorías:', ctx.from);
        
        const from = ctx.from;
        const categoryList = createProductList(from);
        
        const accessToken = process.env.JWT_TOKEN;
        const phoneNumberId = process.env.NUMBER_ID;
        
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryList)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Lista de categorías enviada:', result.messages[0].id);
        }
        
    } catch (error) {
        console.error('💥 Error regresando a categorías:', error);
    }
});


// 🔧 FLUJO GENERAL PARA CAPTURAR RESPUESTAS INTERACTIVAS (NUEVO)
const flowInteractiveResponse = addKeyword([EVENTS.ACTION])
.addAction(async (ctx, { flowDynamic }) => {
    try {
        console.log('📱 === RESPUESTA INTERACTIVA DETECTADA ===');
        console.log('📋 Contexto completo:', JSON.stringify(ctx, null, 2));
        console.log('📱 Body:', ctx.body);
        console.log('📱 From:', ctx.from);
        
        const responseId = ctx.body;
        
        // Verificar si es una selección de categoría
        if (responseId && responseId.startsWith('categoria_')) {
            console.log('🛒 Detectada selección de categoría:', responseId);
            
            let productMessage = '';
            
            switch (responseId) {
                case 'categoria_bebidas':
                    productMessage = [
                        '🥤 *Bebidas y Refrescos - TodoMarket*',
                        '',
                        '• Coca Cola Lata 350ml - $1.900',
                        '• Pepsi Lata 350ml - $1.800', 
                        '• Sprite Lata 350ml - $1.800',
                        '• Agua Mineral 1.5L - $1.200',
                        '• Jugo Watts Durazno 1L - $2.500',
                        '',
                        '📞 *Para hacer tu pedido escribe:*',
                        '"Quiero 2 coca cola" o "Necesito 1 agua"',
                        '',
                        '📞 O llama al: +56 9 7964 3935',
                        '⏰ Horario: 2:00 PM - 10:00 PM'
                    ].join('\n');
                    break;
                    
                case 'categoria_panaderia':
                    productMessage = [
                        '🍞 *Panadería y Cereales - TodoMarket*',
                        '',
                        '• Pan de Molde 500g - $1.600',
                        '• Hallullas x6 unidades - $2.200',
                        '• Cereal Corn Flakes 500g - $4.500',
                        '• Avena Quaker 500g - $3.200',
                        '',
                        '📞 *Para hacer tu pedido escribe:*',
                        '"Quiero pan de molde" o "Necesito hallullas"',
                        '',
                        '📞 O llama al: +56 9 7964 3935',
                        '⏰ Horario: 2:00 PM - 10:00 PM'
                    ].join('\n');
                    break;
                    
                case 'categoria_lacteos':
                    productMessage = [
                        '🥛 *Lácteos y Huevos - TodoMarket*',
                        '',
                        '• Leche Entera 1L - $1.400',
                        '• Yogurt Natural 150g - $800',
                        '• Queso Gouda 200g - $4.200',
                        '• Huevos Docena - $3.500',
                        '',
                        '📞 *Para hacer tu pedido escribe:*',
                        '"Quiero leche" o "Necesito huevos"',
                        '',
                        '📞 O llama al: +56 9 7964 3935',
                        '⏰ Horario: 2:00 PM - 10:00 PM'
                    ].join('\n');
                    break;
                    
                case 'categoria_abarrotes':
                    productMessage = [
                        '🌾 *Abarrotes - TodoMarket*',
                        '',
                        '• Arroz Grado 1 1kg - $2.800',
                        '• Fideos Espagueti 500g - $1.900',
                        '• Aceite Vegetal 1L - $3.200',
                        '• Azúcar 1kg - $2.200',
                        '',
                        '📞 *Para hacer tu pedido escribe:*',
                        '"Quiero arroz" o "Necesito aceite"',
                        '',
                        '📞 O llama al: +56 9 7964 3935',
                        '⏰ Horario: 2:00 PM - 10:00 PM'
                    ].join('\n');
                    break;
                    
                case 'categoria_frutas':
                    productMessage = [
                        '🍎 *Frutas y Verduras - TodoMarket*',
                        '',
                        '• Plátanos x6 unidades - $2.500',
                        '• Manzanas Rojas x4 - $2.800', 
                        '• Tomates 1kg - $2.200',
                        '• Papas 2kg - $3.500',
                        '',
                        '📞 *Para hacer tu pedido escribe:*',
                        '"Quiero plátanos" o "Necesito tomates"',
                        '',
                        '📞 O llama al: +56 9 7964 3935',
                        '⏰ Horario: 2:00 PM - 10:00 PM'
                    ].join('\n');
                    break;
                    
                case 'categoria_limpieza':
                    productMessage = [
                        '🧼 *Limpieza y Aseo - TodoMarket*',
                        '',
                        '• Detergente Líquido 1L - $3.800',
                        '• Papel Higiénico x4 - $4.200',
                        '• Champú 400ml - $4.500',
                        '• Pasta Dental 100ml - $2.800',
                        '',
                        '📞 *Para hacer tu pedido escribe:*',
                        '"Quiero detergente" o "Necesito papel"',
                        '',
                        '📞 O llama al: +56 9 7964 3935',
                        '⏰ Horario: 2:00 PM - 10:00 PM'
                    ].join('\n');
                    break;
                    
                default:
                    productMessage = [
                        '❓ *Selección no reconocida*',
                        '',
                        'Escribe "hola" para ver el catálogo nuevamente',
                        'O llama al: +56 9 7964 3935'
                    ].join('\n');
            }
            
            await flowDynamic([productMessage]);
            console.log('✅ Productos enviados via EVENTS.ACTION para:', responseId);
            
        } else {
            console.log('ℹ️ Respuesta interactiva no es categoría:', responseId);
        }
        
    } catch (error) {
        console.error('💥 Error en flowInteractiveResponse:', error);
        
        const errorMessage = [
            '❌ *Error procesando selección*',
            '',
            'Escribe "hola" para ver el catálogo nuevamente',
            'O llama al: +56 9 7964 3935'
        ].join('\n');
        
        await flowDynamic([errorMessage]);
    }
});

const main = async () => {
    
    
    // Configurar flows: NUEVA ESTRATEGIA CON FLOWS INDIVIDUALES
    const adapterFlow = createFlow([
        // === FLOWS DEL CARRITO - ACTIVACIÓN PROGRESIVA ===
        // FASE 1 - DESACTIVADOS: Funcionalidad del carrito interactivo
        // flowCarritoInteractivo,         // 🛒 Flow principal del carrito (DESACTIVADO)
        // flowActivarCategorias,          // 📋 Activación manual de categorías cuando el catálogo no funciona (DESACTIVADO)
        // flowCategoriasInteractivas,     // 📋 Manejo de selección de categorías
        // flowAgregarProductoInteractivo, // ➕ Agregar productos con botones rápidos
        // flowSeleccionInteractiva,       // 🎯 Sistema completo de selección interactiva
        // flowGestionarProducto,          // ⚙️ Gestión individual de productos
        // flowCambiarCantidadInteractiva, // 🔢 Cambio de cantidades
        // flowEliminarProductoInteractivo,// 🗑️ Eliminación de productos
        // flowAccionesCarrito,            // 🔧 Flow unificado para EVENTS.ACTION
        
        // FASE 2 - DESACTIVADOS: Funciones de gestión del carrito
        // flowVerCarritoInteractivo,      // Ver carrito detallado
        // flowSeguirComprandoInteractivo, // Continuar comprando
        // flowVaciarCarritoInteractivo,   // Vaciar carrito
        
        // FASE 3 - DESACTIVADOS: Finalización de compras  
        // flowConfirmarPedidoInteractivo, // Confirmar pedido
        // flowVolverCarrito,              // Volver al carrito
        // flowFinalizarCompra,            // Finalizar compra
        
        // === FLOWS PRINCIPALES ===
        flowEndShoppingCart,
        flowValidTime,                  // Flujo de validación de horario
        // flowPrincipalInteractivo,       // 🎯 Menú principal CON CARRITO INTEGRADO
        flowPrincipal,                  // 🔄 Menú principal legacy (backup)
        flowDisable,                    // ⚠️ Flujo fuera de horario
        FlowAgente2,                    // Flujo para agente
        flowOrder,                      // Flujo para órdenes
        flowValidMedia,                 // Validación de media
        
        
        // === FLOWS DE COMPATIBILIDAD Y CATEGORÍAS ===
        flowProductCategories,          // 🛒 Manejo de categorías de productos (RESTAURADO)
        // flowInteractiveResponse,        // 🔧 Manejo de respuestas interactivas (BACKUP) - COMENTADO
        // flowBackToCategories,           // 🔄 Flujo para volver a categorías (BACKUP) - COMENTADO
        idleFlow,
        // flowCatalogSelection,
        // flowCatalogOrder,
        // flowViewCart,
        // flowWelcome,
        // flowThanks,
        // flowContactSupport,
        // flowHelp,
    ])
    
    const adapterProvider = createProvider(Provider, {
        jwtToken: process.env.JWT_TOKEN!,
        numberId: process.env.NUMBER_ID!,
        verifyToken: process.env.VERIFY_TOKEN!,
        version: 'v23.0'
    })

    // const adapterProvider = createProvider(Provider, {
    //     jwtToken: 'EAAV7DZBhkJqsBPZCfsV45Rv8k6BzuSuv51aabox7uUI02AtdUriFFOnF6Yb1ZB5ZBqQZAwzOvKYPZC9QpZCNaiPGkNSI6uQIHlVOhqpHjNVT1PANz6uq3lsXQOyRAdDYZCK5Gi572ZAnXPvVvxyGZCW45IWgBAepZBZAxmdf195jRl8f8zwqjZBIzl69CZCSXmsnVhk3tbDzNgIuZBujnlHUfI24K4hPHpANsrVS5MWAB13wJNSxOR14jh6gS8hhj24Eo6WVHQeD1BSwv6wXnWSMloJKUlMXvTf3AZDZD',
    //     numberId: '725315067342333',
    //     verifyToken: 'mi_bot_secreto_2025_xyz789',
    //     version: 'v22.0'
    // })
    // 56 9 7964 3935
    // const adapterDB = new Database({
    //     dbUri: process.env.MONGO_DB_URI!,
    //     dbName: process.env.MONGO_DB_NAME!,
    // })
     const adapterDB = new Database({
        dbUri: process.env.MONGO_DB_URI!,
        dbName: process.env.MONGO_DB_NAME!,
    })

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })



    // Ruta GET para la raíz - necesaria para verificación del webhook
    adapterProvider.server.get('/', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        return res.end('Bot TodoMarket is running! 🤖')
    })

    // Interceptar webhook principal para debugging
    adapterProvider.server.post('/webhook', (req, res, next) => {
        console.log('🔔 === WEBHOOK RECIBIDO ===');
        console.log('📅 Timestamp:', new Date().toISOString());
        console.log('📦 Headers:', JSON.stringify(req.headers, null, 2));
        console.log('📨 Body:', JSON.stringify(req.body, null, 2));
        console.log('🔚 ========================');
        
        // Continuar con el procesamiento normal de BuilderBot
        next();
    });

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    // Webhook handler compatible con BuilderBot y Meta
    // Nota: BuilderBot maneja automáticamente el webhook en /webhook
    // Este es un handler adicional para notificaciones de estado
    adapterProvider.server.post(
        '/webhook-status', 
        (req, res) => {
            try {
                const body = req.body;
                console.log('📞 Webhook de estado recibido:', JSON.stringify(body, null, 2));
                
                // Verificar estructura del webhook de Meta
                if (body.entry && body.entry[0] && body.entry[0].changes) {
                    const changes = body.entry[0].changes[0];
                    
                    if (changes.field === 'messages') {
                        const value = changes.value;
                        
                        // Manejar notificaciones de estado de mensajes
                        if (value.statuses) {
                            value.statuses.forEach((status: any) => {
                                console.log(`� Estado: ${status.status} | Destinatario: ${status.recipient_id} | ID: ${status.id}`);
                                handleMessageStatus(status);
                            });
                        }
                        
                        // Log para mensajes entrantes (BuilderBot los maneja automáticamente)
                        if (value.messages) {
                            console.log('📨 Mensaje entrante procesado por BuilderBot');
                        }
                    }
                }
                
                // Respuesta exitosa requerida por Meta
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ status: 'received' }));
                
            } catch (error) {
                console.error('💥 Error procesando webhook de estado:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        }
    )

    // Start HTTP server with proper port validation for Railway
    console.log(`🚀 Starting server on port: ${PORT}`);
    httpServer(PORT)
}

main()
