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
    await provider.sendText('56936499908@s.whatsapp.net', message);
    await provider.sendText('56953941370@s.whatsapp.net', message);
    return endFlow('*Gracias*');
   }
);

// ════════════════════════════════════════════════════════════════════
// 🎯 NUEVA ESTRATEGIA: CATÁLOGOS CON SELECCIÓN DE CATEGORÍAS
// ════════════════════════════════════════════════════════════════════


/**
 * FLUJO PARA MANEJAR SELECCIÓN DE CATEGORÍAS
 * ✅ Integrado directamente en la cadena de flujos
 */
const flowCategorySelection = addKeyword(utils.setEvent('CATEGORY_SELECTION'))
  .addAction(async (ctx, { globalState, flowDynamic, fallBack, provider, gotoFlow }) => {
    const userPhone = ctx.from;
    const userInput = ctx.body?.trim();

    console.log(`\n🎯 === FLUJO SELECCIÓN DE CATEGORÍA ===`);
    console.log(`📱 Usuario: ${userPhone}`);
    console.log(`✍️  Input: ${userInput}`);

    try {
      // ✅ OBTENER CATEGORÍAS DEL USUARIO
      const userCategoriesKey = `categories_${userPhone}`;
      const categories = globalState.get(userCategoriesKey);

      if (!categories || categories.length === 0) {
        console.log(`❌ No hay categorías registradas para ${userPhone}`);
        return fallBack('❌ Error: No se encontraron categorías. Por favor intenta nuevamente escribiendo "hola".');
      }

      console.log(`📂 Categorías disponibles: ${categories.length}`);

      // ✅ VALIDAR ENTRADA
      const categoryIndex = parseInt(userInput) - 1;

      if (isNaN(categoryIndex) || categoryIndex < 0 || categoryIndex >= categories.length) {
        console.log(`❌ Selección inválida: ${userInput}`);
        
        const validOptions = categories.map((cat, idx) => `${idx + 1}️⃣ ${cat}`).join('\n');
        return fallBack(
          `❌ *Opción inválida*\n\nPor favor selecciona una opción válida:\n\n${validOptions}\n\nEscribe solo el número`
        );
      }

      const selectedCategory = categories[categoryIndex];
      console.log(`✅ Categoría seleccionada: ${selectedCategory}`);

      // ✅ MOSTRAR MENSAJE DE CARGA
      await flowDynamic(`⏳ Cargando categoría: *${selectedCategory}*...\n\n(Aguarda un momento)`);

      // ✅ PEQUEÑA PAUSA
      await new Promise(resolve => setTimeout(resolve, 1500));

      // ✅ ENVIAR CATEGORÍA SELECCIONADA
      const result = await sendSpecificCategoryAsProductList(
        userPhone,
        selectedCategory,
        provider,
        globalState
      );

      if (!result.success) {
        console.error(`❌ Error enviando categoría:`, result.error);
        return fallBack(`❌ Error al cargar la categoría. Por favor intenta nuevamente.`);
      }

      console.log(`✅ Categoría enviada exitosamente`);
      
      // ✅ DESPUÉS DE ENVIAR CATEGORÍA, IR A FLUJO DE CONTINUACIÓN
      return gotoFlow(flowContinueOrCheckout);

    } catch (error: any) {
      console.error(`💥 Error en flowCategorySelection:`, error.message);
      return fallBack(`❌ Error procesando tu selección. Por favor intenta nuevamente.`);
    }
  });

/**
 * FUNCIÓN 1: Listar todas las categorías disponibles (dinámicamente)
 * ✅ Obtiene productos de Meta API
 * ✅ Categoriza usando palabras clave (como categorizeProductsCorrectly)
 * ✅ Envía menú interactivo con categorías
 * ✅ Guarda datos en globalState con namespace de usuario
 */
async function listAvailableCategoriesAndSendMenu(
  phoneNumber: string,
  catalogKey: string,
  provider: any,
  globalState: any
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
    console.log(`\n📂 === LISTANDO CATEGORÍAS DINÁMICAMENTE ===`);
    console.log(`📱 Usuario: ${phoneNumber}`);
    console.log(`🏪 Catálogo: ${catalogKey}`);

    // ✅ PASO 1: OBTENER TODOS LOS PRODUCTOS
    console.log(`📤 Descargando productos del catálogo...`);
    
    let allProducts: any[] = [];
    let nextCursor: string | null = null;

    do {
      let productUrl = `https://graph.facebook.com/v23.0/${catalog.catalogId}/products?fields=id,name,description,price,currency,retailer_id,category,availability,condition,brand&limit=100`;
      
      if (nextCursor) {
        productUrl += `&after=${nextCursor}`;
      }

      const productsResponse = await fetch(productUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        }
      });

      const productsData = await productsResponse.json();

      if (!productsResponse.ok) {
        throw new Error(`Error obteniendo productos: ${productsData.error?.message}`);
      }

      const pageProducts = productsData.data || [];
      allProducts = allProducts.concat(pageProducts);

      const pagingInfo = productsData.paging;
      nextCursor = (pagingInfo && pagingInfo.cursors && pagingInfo.cursors.after) ? pagingInfo.cursors.after : null;

    } while (nextCursor !== null);

    console.log(`✅ Total de productos descargados: ${allProducts.length}`);

    // ✅ PASO 2: CATEGORIZAR PRODUCTOS (USANDO TU FUNCIÓN EXISTENTE)
    console.log(`📂 Categorizando productos dinámicamente...`);
    const organizedByCategory = categorizeProductsCorrectly(allProducts, catalogKey);
    
    // ✅ PASO 3: EXTRAER NOMBRES DE CATEGORÍAS (SIN EMOJIS PARA EL MENÚ)
    const categoryNames = Object.keys(organizedByCategory)
      .filter(cat => organizedByCategory[cat].length > 0)
      .sort();

    console.log(`\n📋 Categorías encontradas: ${categoryNames.length}`);
    categoryNames.forEach((cat, idx) => {
      const itemCount = organizedByCategory[cat].length;
      console.log(`   ${idx + 1}. ${cat} (${itemCount} productos)`);
    });

    // ✅ PASO 4: GUARDAR EN GLOBALSTATE (NAMESPACE POR USUARIO)
    const userCategoriesKey = `categories_${phoneNumber}`;
    const userCatalogDataKey = `catalogData_${phoneNumber}`;
    const userSelectedCategoriesKey = `selectedCategories_${phoneNumber}`;
    const userCatalogKeyKey = `catalogKey_${phoneNumber}`;
    
    await globalState.update({
      [userCategoriesKey]: categoryNames,
      [userCatalogDataKey]: organizedByCategory,
      [userSelectedCategoriesKey]: [],
      [userCatalogKeyKey]: catalogKey
    });

    console.log(`💾 Datos guardados en globalState para ${phoneNumber}`);

    // ✅ PASO 5: CREAR MENSAJE CON LISTA DE CATEGORÍAS
    const categoryMenuMessage = [
      `📂 *CATEGORÍAS DISPONIBLES EN ${catalog.name.toUpperCase()}*\n`,
      `Tenemos ${categoryNames.length} categorías para ti:\n`,
      '',
      ...categoryNames.map((cat, idx) => {
        const itemCount = organizedByCategory[cat].length;
        const catWithoutEmoji = cat.replace(/[^\w\s]/g, '').trim();
        return `${idx + 1}️⃣ *${catWithoutEmoji}* (${itemCount} productos)`;
      }),
      '',
      `👉 Escribe el *número* de la categoría que deseas ver`,
      `Ejemplo: escribe "1" para ver la primera categoría\n`,
      '💡 Podrás mezclar productos de diferentes categorías en tu carrito'
    ].join('\n');

    console.log(`\n📤 Enviando menú de categorías a ${phoneNumber}...`);
    
    await provider.sendText(phoneNumber, categoryMenuMessage);

    console.log(`✅ Menú de categorías enviado exitosamente`);

    return {
      success: true,
      categoriesCount: categoryNames.length,
      categories: categoryNames
    };

  } catch (error: any) {
    console.error('❌ Error listando categorías:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * FUNCIÓN 2: Enviar categoría específica como product_list
 * ✅ Extrae productos de la categoría seleccionada
 * ✅ Respeta límite de 30 items de Meta
 * ✅ Divide categorías grandes automáticamente
 */
async function sendSpecificCategoryAsProductList(
  phoneNumber: string,
  categoryName: string,
  provider: any,
  globalState: any
) {
  const jwtToken = process.env.JWT_TOKEN || provider?.globalVendorArgs?.jwtToken;
  const numberId = process.env.NUMBER_ID || provider?.globalVendorArgs?.numberId;

  if (!jwtToken || !numberId) {
    throw new Error('Faltan credenciales Meta');
  }

  try {
    console.log(`\n🎯 === ENVIANDO CATEGORÍA ESPECÍFICA ===`);
    console.log(`📱 Usuario: ${phoneNumber}`);
    console.log(`📂 Categoría: ${categoryName}`);

    // ✅ OBTENER DATOS DE GLOBALSTATE
    const userCatalogDataKey = `catalogData_${phoneNumber}`;
    const userCatalogKeyKey = `catalogKey_${phoneNumber}`;
    const allCategoriesData = globalState.get(userCatalogDataKey);
    const catalogKey = globalState.get(userCatalogKeyKey) || 'principal';
    const catalog = ENABLED_CATALOGS[catalogKey];

    if (!allCategoriesData || !allCategoriesData[categoryName]) {
      throw new Error(`Categoría ${categoryName} no encontrada`);
    }

    const categoryProducts = allCategoriesData[categoryName];
    console.log(`📦 Total de productos en categoría: ${categoryProducts.length}`);

    // ✅ DIVIDIR EN SECCIONES SI HAY MÁS DE 30 ITEMS
    const maxItemsPerSection = 30;
    const sections: any[] = [];
    
    for (let i = 0; i < categoryProducts.length; i += maxItemsPerSection) {
      const sectionProducts = categoryProducts.slice(i, i + maxItemsPerSection);
      const sectionNumber = Math.floor(i / maxItemsPerSection) + 1;
      const totalSections = Math.ceil(categoryProducts.length / maxItemsPerSection);

      // Sanitizar título (sin emojis, máximo 30 caracteres)
      let sectionTitle = categoryName.replace(/[^\w\s]/g, '').trim();
      
      if (totalSections > 1) {
        sectionTitle = `${sectionTitle} ${sectionNumber}`;
      }

      sectionTitle = sectionTitle.substring(0, 30).trim();

      sections.push({
        title: sectionTitle,
        product_items: sectionProducts.map(product => ({
          product_retailer_id: product.retailer_id || product.id
        }))
      });

      console.log(`✅ Sección "${sectionTitle}": ${sectionProducts.length} items`);
    }

    // ✅ CREAR PAYLOAD DEL MENSAJE
    const categoryNameClean = categoryName.replace(/[^\w\s]/g, '').trim();
    
    const productListMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "product_list",
        header: {
          type: "text",
          text: `${catalog.emoji} ${categoryNameClean}`
        },
        body: {
          text: `Explora los ${categoryProducts.length} productos disponibles en ${categoryNameClean}.\n\nAñade los que te interesan al carrito 🛒`
        },
        footer: {
          text: "Selecciona productos • Agrega al carrito"
        },
        action: {
          catalog_id: catalog.catalogId,
          sections: sections
        }
      }
    };

    console.log(`📋 Payload preparado: ${sections.length} sección(es), ${categoryProducts.length} items totales`);

    // ✅ ENVIAR MENSAJE
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
      console.error(`❌ Error enviando categoría:`, result);
      throw new Error(`Error Meta API: ${result.error?.message}`);
    }

    console.log(`✅ Categoría "${categoryName}" enviada exitosamente`);

    // ✅ GUARDAR CATEGORÍA COMO VISTA
    const userSelectedCategoriesKey = `selectedCategories_${phoneNumber}`;
    const selectedCategories = globalState.get(userSelectedCategoriesKey) || [];
    
    if (!selectedCategories.includes(categoryName)) {
      selectedCategories.push(categoryName);
      await globalState.update({
        [userSelectedCategoriesKey]: selectedCategories
      });
    }

    return {
      success: true,
      categoryName,
      itemsCount: categoryProducts.length,
      sectionsCount: sections.length
    };

  } catch (error: any) {
    console.error('❌ Error enviando categoría:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * FLUJO 4: Consultar si desea ver otra categoría o culminar pedido - CORREGIDO
 * ✅ Se dispara después de que usuario interactúa con product_list
 * ✅ Da opción de seguir comprando o proceder al pago
 * ✅ CORREGIDO: Usa provider correcto
 */
const flowContinueOrCheckout = addKeyword(utils.setEvent('CONTINUE_OR_CHECKOUT'))
  .addAnswer(
    [
      '✅ *¿Qué deseas hacer?*\n',
      '👉 *1* - Ver otra categoría',
      '👉 *2* - Finalizar mi pedido y pagar',
      '',
      'Escribe solo el número (1 o 2)'
    ],
    { capture: true, delay: 1000, idle: 960000 },
    async (ctx, { state, globalState, flowDynamic, fallBack, gotoFlow, provider }) => {
      // ✅ AGREGADO: provider en destructuring
      const userPhone = ctx.from;
      const userInput = ctx.body?.trim();

      console.log(`\n🛒 === FLUJO CONTINUAR O FINALIZAR ===`);
      console.log(`📱 Usuario: ${userPhone}`);
      console.log(`🎯 Opción: ${userInput}`);

      try {
        // ✅ OPCIÓN 1: VER OTRA CATEGORÍA
        if (userInput === '1') {
          console.log(`👉 Usuario seleccionó: Ver otra categoría`);

          const userCategoriesKey = `categories_${userPhone}`;
          const userSelectedCategoriesKey = `selectedCategories_${userPhone}`;
          
          const categories = globalState.get(userCategoriesKey) || [];
          const selectedCategories = globalState.get(userSelectedCategoriesKey) || [];
          const unviewedCategories = categories.filter(cat => !selectedCategories.includes(cat));

          if (unviewedCategories.length === 0) {
            console.log(`🔄 Todas las categorías han sido vistas, reiniciando`);
            await globalState.update({
              [`selectedCategories_${userPhone}`]: []
            });

            const allCategoriesMenu = [
              '📂 *CATEGORÍAS DISPONIBLES*\n',
              ...categories.map((cat, idx) => `${idx + 1}️⃣ *${cat}`),
              '',
              '👉 Escribe el número de la categoría que deseas ver'
            ].join('\n');

            await flowDynamic(allCategoriesMenu);
          } else {
            const unviewedMenu = [
              '📂 *CATEGORÍAS DISPONIBLES*\n',
              ...unviewedCategories.map((cat, idx) => `${idx + 1}️⃣ *${cat}`),
              '',
              '👉 Escribe el número de la categoría que deseas ver'
            ].join('\n');

            await flowDynamic(unviewedMenu);
          }

          return;
        }

        // ✅ OPCIÓN 2: FINALIZAR PEDIDO
        if (userInput === '2') {
          console.log(`✅ Usuario seleccionó: Finalizar pedido`);
          return gotoFlow(flowEndShoppingCart);
        }

        // ❌ OPCIÓN INVÁLIDA
        console.log(`❌ Opción inválida: ${userInput}`);
        return fallBack('❌ Opción inválida. Por favor escribe 1 o 2.');

      } catch (error: any) {
        console.error(`💥 Error en flowContinueOrCheckout:`, error.message);
        return fallBack(`❌ Error. Por favor intenta nuevamente.`);
      }
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

const flowOrder = addKeyword([EVENTS.ORDER])
 .addAction(async(ctx,{gotoFlow, fallBack, provider, globalState}) => {
    const userPhone = ctx.from;  // 🔑 CLAVE ÚNICA
    
    try {
        console.log(`🛒 === ORDEN RECIBIDA DE ${userPhone} ===`);
        console.log('📦 Contexto completo de la orden:', JSON.stringify(ctx, null, 2));
        
        // ✅ VERIFICAR ESTRUCTURA CORRECTA DE LA ORDEN
        if (ctx?.order || ctx?.message?.order) {
            const orderData = ctx.order || ctx.message.order;
            console.log('📋 Datos de la orden:', orderData);
            
            // Según Meta API: order contiene catalog_id y product_items
            const catalogId = orderData.catalog_id;
            const productItems = orderData.product_items || [];
            
            console.log(`🏷️ Catalog ID: ${catalogId}`);
            console.log(`📦 Productos seleccionados: ${productItems.length}`);
            
            if (catalogId && productItems.length > 0) {
                // ✅ PROCESAR LOS PRODUCTOS DE LA ORDEN
                const processedOrder = await processOrderFromCatalog(productItems, catalogId, provider);
                
                if (processedOrder && processedOrder.length > 0) {
                    // ✅ GUARDAR LA ORDEN CON NAMESPACE DEL USUARIO
                    console.log(`💾 Guardando orden para usuario ${userPhone}...`);
                    
                    await globalState.update({ 
                        [`order_${userPhone}`]: processedOrder,
                        [`catalogId_${userPhone}`]: catalogId,
                        [`customerPhone_${userPhone}`]: userPhone,
                        [`customerName_${userPhone}`]: ctx.pushName || ctx.name,
                        [`orderTimestamp_${userPhone}`]: new Date().toISOString()
                    });
                    
                    console.log(`✅ Orden guardada exitosamente para usuario ${userPhone}`);
                    console.log(`🔄 Redirigiendo a flowEndShoppingCart`);
                    
                    return gotoFlow(flowEndShoppingCart);
                } else {
                    console.log('❌ No se pudieron procesar los productos');
                    
                    const errorMessage = "❌ *Error procesando la orden*\n\nNo se pudieron obtener los detalles de los productos seleccionados.";
                    console.log(`📤 Enviando error a ${userPhone}`);
                    
                    return fallBack(errorMessage);
                }
            } else {
                console.log('❌ Orden incompleta - falta catalog_id o product_items');
                
                const errorMessage = "❌ *Orden incompleta*\n\nLa orden no contiene todos los datos necesarios.";
                console.log(`📤 Enviando error a ${userPhone}`);
                
                return fallBack(errorMessage);
            }
        } else {
            console.log('❌ No se encontró estructura de orden válida');
            
            const errorMessage = "❌ *No se recibió información válida*\n\nPara concretar la compra debe seleccionar los productos desde el carrito de compra.";
            console.log(`📤 Enviando error a ${userPhone}`);
            
            return fallBack(errorMessage);
        }
    } catch (error) {
        console.error(`💥 Error en flowOrder para ${userPhone}:`, error);
        
        const errorMessage = "❌ *Error procesando la orden*\n\nHubo un problema técnico. Por favor intenta nuevamente.";
        console.log(`📤 Enviando error a ${userPhone}`);
        
        return fallBack(errorMessage);
    }
});


const flowEndShoppingCart = addKeyword(utils.setEvent('END_SHOPPING_CART'))
.addAction(async (ctx, { globalState, endFlow, flowDynamic }) => {
    const userPhone = ctx.from;  // 🔑 CLAVE ÚNICA
    
    console.log(`🛒 === FLUJO DE PAGO - USUARIO ${userPhone} ===`);
    console.log(`📱 Iniciando validación de orden...`);
    
    // ✅ LEER DATOS SOLO DE ESTE USUARIO
    const orderKey = `order_${userPhone}`;
    const addressKey = `address_${userPhone}`;
    const paymentKey = `payment_${userPhone}`;
    const hashKey = `hash_${userPhone}`;
    
    const orderData = globalState.get(orderKey);
    const previousAddress = globalState.get(addressKey);
    const previousPaymentMethod = globalState.get(paymentKey);
    const currentOrderHash = JSON.stringify(orderData);
    const lastOrderHash = globalState.get(hashKey);
    
    console.log(`📦 Datos de ${userPhone}:`);
    console.log(`   - Orden: ${orderData ? 'Presente' : 'Ausente'}`);
    console.log(`   - Dirección previa: ${previousAddress || 'Ausente'}`);
    console.log(`   - Método pago previo: ${previousPaymentMethod || 'Ausente'}`);
    
    // ⛔ VALIDACIÓN: ¿Existe una orden válida?
    if (!orderData || !Array.isArray(orderData) || orderData.length === 0) {
        console.log(`❌ flowEndShoppingCart: No hay orden válida para ${userPhone}`);
        
        const errorMessage = '❌ *Error*\n\nNo se encontró información de pedido válida. Por favor, seleccione productos desde el catálogo nuevamente.';
        console.log(`📤 Enviando error a ${userPhone}`);
        
        return endFlow(errorMessage);
    }
    
    // ✅ DETECTAR SI ES UNA NUEVA ITERACIÓN
    const isNewOrder = currentOrderHash !== lastOrderHash;
    
    if (isNewOrder) {
        console.log(`🆕 NUEVA ORDEN DETECTADA para usuario ${userPhone}`);
        console.log(`   - Hash anterior: ${lastOrderHash ? 'Presente' : 'Ausente'}`);
        console.log(`   - Hash actual: ${currentOrderHash.substring(0, 50)}...`);
        
        // ✅ LIMPIAR SOLO DATOS DE ESTE USUARIO
        console.log(`🧹 Limpiando datos previos de ${userPhone}...`);
        await globalState.update({
            [addressKey]: null,
            [paymentKey]: null,
            [hashKey]: currentOrderHash
        });
        
        console.log(`✅ Datos limpios para nueva orden de ${userPhone}`);
    } else {
        console.log(`♻️ ORDEN ANTERIOR detectada para usuario ${userPhone}`);
    }
    
    console.log(`✅ Validación completada, continuando con datos de entrega`);
    return;
})
.addAnswer(
    [
        '✅ *PASO 1: Dirección de entrega*\n',
        'Ingrese su dirección completa:\n',
        '*Nombre Calle Numeración, Comuna, Depto*\n',
        '',
        'Ejemplo: Juan Pérez Av. Libertador 123, Santiago, Depto 4B',
    ],
    { capture: true, delay: 1500, idle: 960000 },
    async(ctx, { fallBack, globalState, flowDynamic }) => {
        const userPhone = ctx.from;  // 🔑 CLAVE ÚNICA
        const userAddress = ctx.body?.trim();
        
        const orderKey = `order_${userPhone}`;
        const addressKey = `address_${userPhone}`;
        
        console.log(`📍 === CAPTURA DE DIRECCIÓN - USUARIO ${userPhone} ===`);
        console.log(`📍 Dirección recibida: "${userAddress}"`);
        console.log(`📝 Longitud: ${userAddress?.length} caracteres`);

        try {
            // ✅ VALIDACIÓN 1: ¿Está vacío?
            if (!userAddress) {
                console.log(`❌ Dirección vacía para ${userPhone}`);
                
                const errorMessage = '❌ *Campo requerido*\n\nPor favor ingrese una dirección válida.';
                console.log(`📤 Enviando error a ${userPhone}`);
                
                return fallBack(errorMessage);
            }

            // ✅ VALIDACIÓN 2: ¿Es demasiado corta?
            if (userAddress.length < 10) {
                console.log(`❌ Dirección demasiado corta para ${userPhone}: ${userAddress.length} caracteres`);
                
                const errorMessage = '❌ *Dirección incompleta*\n\n' +
                    'Por favor ingrese una dirección completa con:\n' +
                    '• Calle y número\n' +
                    '• Comuna\n' +
                    '• Depto/Bloque (si aplica)\n\n' +
                    'Ejemplo: Av. Libertador 123, Santiago, Depto 4B';
                
                console.log(`📤 Enviando error a ${userPhone}`);
                
                return fallBack(errorMessage);
            }

            // ✅ GUARDADO DE DIRECCIÓN - SOLO PARA ESTE USUARIO
            console.log(`💾 Guardando dirección para usuario ${userPhone}...`);
            await globalState.update({ [addressKey]: userAddress });
            console.log(`✅ Dirección guardada exitosamente para ${userPhone}`);

            return;
        } catch (error) {
            console.error(`💥 Error procesando dirección para ${userPhone}:`, error);
            
            const errorMessage = '❌ *Error técnico*\n\nHubo un problema procesando tu dirección. Por favor inténtelo nuevamente.';
            console.log(`📤 Enviando error a ${userPhone}`);
            
            return fallBack(errorMessage);
        }
    }
)
.addAnswer(
    [
        '💳 *PASO 2: Método de pago*\n',
        'Selecciona tu método de pago preferido:\n',
        '',
        '👉 *1* - Efectivo 💵',
        '👉 *2* - Transferencia bancaria 🏦', 
        '👉 *3* - Punto de venta (POS) 💳',
        '',
        'Escribe solo el *número* de tu opción (1, 2 o 3):'
    ],
    { capture: true, delay: 1500, idle: 960000 },
    async(ctx, { endFlow, fallBack, provider, globalState }) => {
        const userPhone = ctx.from;  // 🔑 CLAVE ÚNICA
        const paymentOption = ctx.body?.trim();
        const name = ctx.pushName || 'Cliente';
        
        const orderKey = `order_${userPhone}`;
        const addressKey = `address_${userPhone}`;
        const paymentKey = `payment_${userPhone}`;
        const catalogKey = `catalogId_${userPhone}`;
        const hashKey = `hash_${userPhone}`;
        const customerNameKey = `customerName_${userPhone}`;
        const orderTimestampKey = `orderTimestamp_${userPhone}`;

        console.log(`💳 === CAPTURA DE PAGO - USUARIO ${userPhone} ===`);
        console.log(`💳 Opción recibida: "${paymentOption}"`);

        try {
            // ✅ VALIDACIÓN: Opción válida
            if (!paymentOption || (paymentOption !== '1' && paymentOption !== '2' && paymentOption !== '3')) {
                console.log(`❌ Opción de pago inválida para ${userPhone}: "${paymentOption}"`);
                
                const errorMessage = '❌ *Opción inválida*\n\n' +
                    'Por favor selecciona una opción válida:\n\n' +
                    '👉 *1* - Efectivo 💵\n' +
                    '👉 *2* - Transferencia bancaria 🏦\n' +
                    '👉 *3* - Punto de venta (POS) 💳';
                
                console.log(`📤 Enviando error a ${userPhone}`);
                
                return fallBack(errorMessage);
            }

            // ✅ MAPEAR OPCIÓN A NOMBRE
            let paymentMethod = '';
            let paymentInstructions = '';
            
            switch (paymentOption) {
                case '1':
                    paymentMethod = 'Efectivo 💵';
                    paymentInstructions = '\n\n💵 *Pago en efectivo*\n El Agente le confirmara el Monto a cancelar.';
                    break;
                case '2':
                    paymentMethod = 'Transferencia bancaria 🏦';
                    paymentInstructions = '\n\n🏦 *Datos para transferencia:*\nNombre: TodoMarket\nBanco: Santander\nTipo: Corriente\nCuenta: 0-000-7748055-2\nRUT: 77.210.237-6\n\n📸 *Importante:* Transfiera luego de confirmar el pedido.';
                    break;
                case '3':
                    paymentMethod = 'Punto de venta (POS) 💳';
                    paymentInstructions = '\n\n💳 *Punto de venta disponible*\nNuestro repartidor llevará el equipo POS para procesar su pago con tarjeta.';
                    break;
            }

            // ✅ GUARDAR MÉTODO DE PAGO - SOLO PARA ESTE USUARIO
            console.log(`💾 Guardando método de pago "${paymentMethod}" para usuario ${userPhone}...`);
            await globalState.update({ [paymentKey]: paymentMethod });
            console.log(`✅ Método de pago guardado para ${userPhone}`);

            // ✅ OBTENER TODOS LOS DATOS FINALES - SOLO DE ESTE USUARIO
            console.log(`📦 Recuperando datos finales de ${userPhone}...`);
            
            const dataOrder = globalState.get(orderKey);
            const dataAddress = globalState.get(addressKey);
            const dataPaymentMethod = globalState.get(paymentKey);
            const catalogId = globalState.get(catalogKey);
            
            console.log(`📊 DATOS FINALES DEL PEDIDO - ${userPhone}:`);
            console.log(`   - Orden: ${dataOrder ? `${dataOrder.length} items` : 'Ausente'}`);
            console.log(`   - Dirección: ${dataAddress || 'Ausente'}`);
            console.log(`   - Método de pago: ${dataPaymentMethod || 'Ausente'}`);
            console.log(`   - Catálogo ID: ${catalogId || 'Ausente'}`);

            // ⛔ VALIDACIÓN FINAL: Todos los datos están presentes
            if (!dataOrder || !dataAddress || !dataPaymentMethod) {
                console.log(`❌ Datos incompletos en globalState para ${userPhone}`);
                
                const errorMessage = '❌ *Error procesando pedido*\n\n' +
                    'Faltaron datos del pedido. Por favor inténtelo nuevamente.\n\n' +
                    'Escribe "hola" para volver al menú principal.';
                
                console.log(`📤 Enviando error a ${userPhone}`);
                
                return endFlow(errorMessage);
            }

            // ✅ CALCULAR TOTAL
            let totalPedido = 0;
            if (Array.isArray(dataOrder)) {
                const totalLine = dataOrder.find(item => 
                    typeof item === 'string' && item.includes('Total a Pagar')
                );
                if (totalLine) {
                    const totalMatch = totalLine.match(/\$(\d+)/);
                    if (totalMatch) {
                        totalPedido = parseInt(totalMatch[1]);
                    }
                }
            }
            
            console.log(`💰 Total del pedido: $${totalPedido}`);

            // ✅ ENVIAR NOTIFICACIÓN AL NEGOCIO
            console.log(`📧 Enviando notificación de pedido para ${userPhone}...`);
            await notificationDelivery(dataOrder, dataAddress, dataPaymentMethod, name, userPhone, provider);
            console.log(`✅ Notificación enviada`);

            // ✅ LIMPIAR GLOBALSTATE - SOLO DATOS DE ESTE USUARIO
            console.log(`🧹 Limpiando estado SOLO del usuario ${userPhone}...`);
            await globalState.update({ 
                [orderKey]: null,
                [addressKey]: null,
                [paymentKey]: null,
                [catalogKey]: null,
                [hashKey]: null,
                [customerNameKey]: null,
                [orderTimestampKey]: null
            });
            
            console.log(`✅ Estado limpiado AISLADAMENTE para ${userPhone}`);
            console.log(`⚠️  IMPORTANTE: Otros clientes NO fueron afectados`);

            // ✅ FORMATEAR TOTAL
            const totalDisplay = totalPedido > 0 
                ? `💰 *Total a pagar:* $${totalPedido.toLocaleString('es-CL')}` 
                : '💡 *Nota:* El total se confirmará al momento de la entrega.';

            // ✅ MENSAJE DE CONFIRMACIÓN FINAL
            const confirmationMessage = [
                '✅ *¡Pedido confirmado!* 🛒',
                '',
                `💳 *Método de pago:* ${dataPaymentMethod}`,
                totalDisplay,
                '',
                'Gracias por su pedido. En breve nos comunicaremos con usted para coordinar la entrega.',
                'Si desea otro producto, se lo indica al agente.',
                paymentInstructions,
                '',
                '📞 También puede contactarnos directamente al: +56 9 3649 9908',
                '',
                '⏰ *Horario de entrega:* Lunes a Domingo 1:00 PM - 10:00 PM',
                '',
                '🔄 Escribe "hola" para hacer otro pedido.'
            ].join('\n');

            console.log(`✅ Pedido procesado exitosamente para ${userPhone}`);
            console.log(`📤 Enviando confirmación final...`);
            
            return endFlow(confirmationMessage);

        } catch (error) {
            console.error(`💥 Error en método de pago para ${userPhone}:`, error);
            
            const errorMessage = '❌ *Error técnico*\n\n' +
                'Hubo un problema procesando su pedido.\n\n' +
                'Por favor contacte directamente al +56 9 3649 9908\n\n' +
                'Escribe "hola" para volver al menú';
            
            console.log(`📤 Enviando error a ${userPhone}`);
            
            return endFlow(errorMessage);
        }
    }
);

const flowPrincipal = addKeyword<Provider, Database>(utils.setEvent('welcome'))
 .addAction(async (ctx, { gotoFlow, state }) => {
     const userPhone = ctx.from;  // 🔑 OBTENER CLAVE ÚNICA DEL USUARIO
     
     console.log(`📊 === FLOWPRINCIPAL.addAction() ===`);
     console.log(`📱 Usuario: ${userPhone}`);
     
     // ✅ LEER DATOS DEL USUARIO SI EXISTEN (opcional, para uso futuro)
     const userData = state.get(`user_${userPhone}`);
     console.log(`👤 Datos del usuario:`, userData);
     
     return start(ctx, gotoFlow, IDLETIME);
 })
 .addAnswer([
    '🚚 Hola, Bienvenido a *Minimarket TodoMarket* 🛵', 
    '⌛ Horario disponible desde las 1:00 PM hasta las 10:00 PM. ⌛',
    '📝 a través de este canal te ofrecemos los siguientes servicios de compra:'
], { delay: 1000 })
 .addAnswer(
     [
        '*Indica el Número de la opción que desees:*', 
        '👉 #1 Catalogos de compra', 
        '👉 #2 Conversar con un Agente', 
    ].join('\n'),
    { capture: true, delay: 1000, idle: 900000 },
    async (ctx,{ provider, fallBack, gotoFlow, state, endFlow, globalState}) => {
        const userPhone = ctx.from;  // 🔑 CLAVE ÚNICA
        console.log(`📱 === FLOWPRINCIPAL.addAnswer() ===`);
        console.log(`👤 Usuario: ${userPhone}`);
        console.log(`💬 Opción seleccionada: ${ctx.body}`);
        
        const userInput = ctx.body.toLowerCase().trim();
        
        // ✅ OPCIÓN 1: CATÁLOGO OFICIAL DE META (ENVÍO DIRECTO)
        if (userInput === '1') {
            stop(ctx);
            
            console.log(`🛒 Usuario ${userPhone} seleccionó opción 1 - Catálogo oficial`);
            console.log(`📋 Iniciando envío de catálogos...`);
            
            try {
                // ✅ MOSTRAR MENSAJE INFORMATIVO ANTES DE ENVIAR EL CATÁLOGO
                console.log(`📤 Enviando mensaje informativo a ${userPhone}...`);
                const userCatalogKeyKey = `catalogKey_${userPhone}`;
                await globalState.update({
                    [userCatalogKeyKey]: 'principal'
                });

                await provider.sendText(ctx.from, [
                    '📦 *CÓMO USAR NUESTROS CATÁLOGOS:*\n',
                    '🔹 Recibirás varios mensajes con catálogos\n',
                    '🔹 Cada catálogo contiene DIFERENTES CATEGORÍAS\n',
                    '🔹 Puedes mezclar productos de todos los catálogos\n',
                    '🔹 En cada catalogo te muestra la opcion de enviar el pedido, lo cual culminara con la seleccion de productos\n\n',
                    '📋 *PASOS:*\n',
                    '1️⃣ Abre cada catálogo\n',
                    '2️⃣ Selecciona productos de diferentes categorías\n',
                    '3️⃣ Agrega al carrito desde cualquier catálogo\n',
                    '4️⃣ Culmina el pedido desde cualquiera de los catálogos\n\n',
                    '💡 *TIP:* Puedes seguir agregando productos de catálogos anteriores\n\n',
                    '👇 Abriendo catálogos... espera un momento'
                ].join(''));
                
                console.log(`✅ Mensaje informativo enviado a ${userPhone}`);
                
                // ✅ PEQUEÑA PAUSA PARA QUE LEA EL MENSAJE
                console.log(`⏳ Esperando 1 segundo antes de enviar catálogos...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // ✅ ENVIAR CATÁLOGO OFICIAL DIRECTAMENTE
                console.log(`📤 Enviando catálogo oficial a ${userPhone}...`);
                // const result = await sendCatalogWith30Products(ctx.from, 'principal', provider);

                const result = await listAvailableCategoriesAndSendMenu(
                    userPhone,
                    'principal',
                    provider,
                    globalState
                );

                return; // ✅ FINALIZAR FLUJO CORRECTAMENTE
                
            } catch (error) {
                console.error(`❌ Error enviando catálogo a ${userPhone}:`, error);
                
                // ✅ FALLBACK: ENVIAR MENSAJE DE ERROR
                const errorMessage = [
                    '❌ *Error temporal con el catálogo*\n\n',
                    '📞 Por favor contacta al: +56 9 3649 9908\n',
                    '⏰ Horario: 2:00 PM - 10:00 PM\n\n',
                    'O escribe "hola" para intentar nuevamente'
                ].join('');
                
                try {
                    await provider.sendText(ctx.from, errorMessage);
                    console.log(`✅ Mensaje de error enviado a ${userPhone}`);
                } catch (sendError) {
                    console.error(`❌ Error enviando mensaje de error a ${userPhone}:`, sendError);
                }
                
                return endFlow(errorMessage);
            }
        }
   
        // ✅ OPCIÓN 2: AGENTE
        if (userInput === '2' || userInput.includes('agente')) {
            stop(ctx);
            
            console.log(`👥 Usuario ${userPhone} seleccionó opción 2 - Agente`);
            console.log(`🔄 Redirigiendo a FlowAgente2...`);
            
            return gotoFlow(FlowAgente2);
        }
        
        // ❌ OPCIÓN INVÁLIDA
        console.log(`❌ Opción inválida recibida de ${userPhone}: "${ctx.body}"`);
        
        reset(ctx, gotoFlow, IDLETIME);
        
        const invalidMessage = [
            "*Opcion no valida*\n\n",
            "Por favor seleccione una opcion valida:\n",
            "👉 #1 Catalogos de compra\n",
            "👉 #2 Conversar con un Agente"
        ].join('');
        
        console.log(`📤 Enviando mensaje de opción inválida a ${userPhone}...`);
        
        return fallBack(invalidMessage);
     }
 );

 /**
 * INTERFAZ DE TIPO: Define la estructura de categoryPatterns
 */
interface CategoryPattern {
  patterns: RegExp[];
  weight: number;
  exclusions?: string[]; // ✅ OPCIONAL (solo algunas categorías la tienen)
}

/**
 * FUNCIÓN MEJORADA v9: Categorizar SOLO por NAME + DESCRIPTION
 * ✅ Versión simplificada y más robusta
 * ✅ Sin depender del campo "category" de Meta (que está vacío)
 * ✅ Mapeo automático a categorías o fallback a "📦 Otros"
 * ✅ CADA PRODUCTO SE ASIGNA A UNA SOLA CATEGORÍA (SIN DUPLICADOS)
 */
function categorizeProductsCorrectly(products: any[], catalogKey: string) {
  const categorized: Record<string, any[]> = {};
  const processedIds = new Set<string>(); // Evitar duplicados absolutos

  const categoryKeywords: Record<string, string[]> = {
    '🥤 Bebidas': [
      'bebida', 'refresco', 'gaseosa', 'agua', 'jugo', 'soda', 'doritos',
      'cerveza', 'vino', 'pisco', 'café', 'espresso', 'capuchino',
      'té', 'energética', 'monster', 'red bull', 'coca', 'pepsi',
      'sprite', 'fanta', 'nestea', 'watts', 'néctar', 'lipton', 'postobon'
    ],
    '🍿 Snacks': [
      'snack', 'papas fritas', 'chocolate', 'galleta', 'takis', 'kryzpo', 'chips', 'chocolate', 'dulce', 'caramelo',
      'golosina', 'chicle', 'maní', 'cacahuate', 'nueces', 'almendras','pinguino', 'pirulin',
      'galleta dulce', 'frutos secos', 'turrón', 'malva', 'alfajor', 'galletita'
    ],
    
    '🍞 Panadería': [
      'pan', 'cereal', 'avena', 'hallulla', 'bimbo', 'molde', 'fajitas',
      'pan integral', 'pan blanco', 'pan francés', 'panadería', 'biscocho',
      'bizcocho', 'tostadas', 'catalinas'
    ],

    '🥛 Lácteos': [
      'leche', 'yogurt', 'Gauda', 'margarina', 'queso', 'huevo', 'mantequilla', 'crema', 'lácteo',
      'soprole', 'colún', 'dairy', 'yogur', 'requesón', 'quesillo',
      'leche descremada', 'leche entera', 'manteca'
    ],

    '🌾 Abarrotes': [
      'arroz', 'fideos', 'pasta', 'zucaritas', 'aceite', 'azúcar', 'sal', 'harina',
      'lentejas', 'porotos', 'atún', 'enlatados', 'conserva', 'vinagre','ketchup',
      'mayonesa', 'condimento', 'abarrote', 'legumbres', 'garbanzos','mostaza',
      'espagueti', 'espirales', 'azucar'
    ],

    '🍎 Frutas y Verduras': [
      'fruta', 'verdura', 'manzana', 'plátano', 'banana', 'naranja',
      'limón', 'fresa', 'piña', 'durazno', 'uva', 'pera', 'kiwi',
      'tomate', 'cebolla', 'ajo', 'zanahoria', 'lechuga', 'brócoli',
      'espinaca', 'acelga', 'repollo', 'papa a granel', 'patata'
    ],

    '🥩 Carnes y Cecinas': [
      'carne', 'pollo', 'pechuga', 'acaramelado', 'vianesa', 'muslo', 'ala', 'jamón', 'tocino',
      'panceta', 'paté', 'embutido', 'chorizo', 'salchicha', 'mortadela',
      'longaniza', 'ternera', 'cerdo', 'carne molida', 'filete',
      'costilla', 'pescado', 'salmón', 'trucha', 'merluza'
    ],

    '🧼 Limpieza y Higiene': [
      'detergente', 'jabón', 'jabon', 'Baño', 'preservativo', 'ambientador', 'nova', 'champú', 'pasta dental', 'papel higiénico',
      'aseo', 'higiene', 'cloro', 'limpieza', 'desinfectante', 'limpiador','suavizante', 'shampoo', 'confort',
      'escoba', 'recogedor', 'trapo', 'paño', 'esponja', 'cepillo','lavalozas', 'bolsa', 'acondicionador',
      'toallita', 'toalla', 'pañal', 'servilleta', 'kleenex', 'pañuelos',
      'poet'
    ],

    '❄️ Congelados': [
      'congelado', 'helado', 'frozen', 'pizza', 'papas pre fritas',
      'papas congeladas', 'comida congelada', 'alimento congelado',
      'nuggets', 'empanadas'
    ]
  };

  // 🔍 PROCESAR CADA PRODUCTO
  products.forEach((product: any, index: number) => {
    const productId = product.id || product.retailer_id;
    
    // ⛔ SALTAR SI YA FUE PROCESADO
    if (processedIds.has(productId)) {
      return;
    }
    processedIds.add(productId);

    const productName = (product.name || '').toLowerCase().trim();
    const productDesc = (product.description || '').toLowerCase().trim();
    const fullText = `${productName} ${productDesc}`;
    
    let assignedCategory = '📦 Otros'; // Fallback por defecto
    let foundMatch = false;

    // console.log(`\n📦 PRODUCTO ${index + 1}: "${product.name}"`);
    // if (productDesc) {
    //   console.log(`   📝 Descripción: "${productDesc}"`);
    // }

    // ⚠️ ITERACIÓN SECUENCIAL: Primera coincidencia gana
    for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
      // Verificar si ALGUNA palabra clave coincide en el texto completo
      const matchedKeywords = keywords.filter(keyword => {
        const keywordLower = keyword.toLowerCase();
        return fullText.includes(keywordLower);
      });

      // Si hay coincidencias, asignar a esta categoría y salir
      if (matchedKeywords.length > 0) {
        assignedCategory = categoryName;
        foundMatch = true;
        // console.log(`   ✅ ASIGNADO: ${categoryName}`);
        // console.log(`   💡 Palabras clave encontradas: ${matchedKeywords.join(', ')}`);
        break; // ✅ SALIR INMEDIATAMENTE EN LA PRIMERA COINCIDENCIA
      }
    }

    // Agregar producto a su categoría (UNA SOLA VEZ)
    if (!categorized[assignedCategory]) {
      categorized[assignedCategory] = [];
    }
    categorized[assignedCategory].push(product);
  });
  
  let totalProducts = 0;
  Object.entries(categorized).forEach(([category, categoryProducts]) => {
    const count = (categoryProducts as any[]).length;
    totalProducts += count;
  });
  
  return categorized;
}

/**
 * GARANTÍAS:
 * ✅ Máximo 30 items por mensaje
 * ✅ Combina múltiples categorías en el MISMO mensaje
 * ✅ Si una categoría > 10 items, se divide con sufijos: "Snack 1", "Snack 2"
 * ✅ Últimos items de una categoría se usan para llenar el siguiente mensaje
 * ✅ Sin pérdida de productos
 * ✅ Distribución inteligente y eficiente
 */
function createAllCategorizedSectionLotes(categorizedProducts: Record<string, any[]>) {
  const maxItemsPerMessage = 30;
  const maxItemsPerSection = 10;

  console.log(`\n${'═'.repeat(70)}`);
  console.log('📊 CREANDO LOTES DE MENSAJES - v11 GREEDY PACKING');
  console.log(`${'═'.repeat(70)}`);

  // PASO 1: Preparar categorías
  const categoryArray = Object.entries(categorizedProducts)
    .filter(([_, items]) => (items as any[]).length > 0)
    .map(([name, items]) => ({
      name,
      items: items as any[],
      itemCount: (items as any[]).length,
      itemsProcessed: 0 // ✅ Track de items ya procesados
    }));

  console.log(`📂 Categorías con productos: ${categoryArray.length}`);

  // PASO 2: Ordenar categorías (mayor cantidad primero, "Otros" al final)
  categoryArray.sort((a, b) => {
    const aIsOtros = a.name.includes('📦');
    const bIsOtros = b.name.includes('📦');
    
    if (aIsOtros && !bIsOtros) return 1;
    if (!aIsOtros && bIsOtros) return -1;
    return b.itemCount - a.itemCount;
  });

  // PASO 3: Crear estructura para lotes
  const messageLotes: any[] = [];
  let currentLote = {
    loteNumber: 1,
    sections: [] as any[],
    itemsCount: 0,
    categoriesInLote: new Set<string>()
  };

  console.log(`\n📋 Procesando categorías con algoritmo GREEDY PACKING...\n`);

  // ✅ ALGORITMO PRINCIPAL: Llenar cada mensaje hasta 30 items
  let categoryIndex = 0;

  while (categoryIndex < categoryArray.length) {
    const category = categoryArray[categoryIndex];
    const categoryName = category.name;
    const itemsRemainingInCategory = category.itemCount - category.itemsProcessed;

    console.log(`\n📦 CATEGORÍA "${categoryName}": ${category.itemsProcessed}/${category.itemCount} items procesados`);

    // Si ya procesó todos los items, pasar a la siguiente
    if (itemsRemainingInCategory <= 0) {
      console.log(`   ✅ Categoría completada, pasando a la siguiente`);
      categoryIndex++;
      continue;
    }

    // ✅ CALCULAR CUÁNTOS ITEMS CABEN EN EL LOTE ACTUAL
    const spaceInCurrentLote = maxItemsPerMessage - currentLote.itemsCount;
    
    // Si no hay espacio Y hay contenido, guardar lote y crear uno nuevo
    if (spaceInCurrentLote <= 0 && currentLote.sections.length > 0) {
      console.log(`   💾 Lote ${currentLote.loteNumber} lleno (${currentLote.itemsCount} items), guardando`);
      messageLotes.push(currentLote);

      currentLote = {
        loteNumber: messageLotes.length + 1,
        sections: [],
        itemsCount: 0,
        categoriesInLote: new Set<string>()
      };

      console.log(`   📝 Nuevo Lote ${currentLote.loteNumber} creado`);
      continue; // Reintentar SIN incrementar categoryIndex
    }

    // ✅ CREAR SECCIÓN DE ESTA CATEGORÍA
    // Calcular cuántos items tomar: mínimo entre (espacio disponible, items restantes, 10)
    const itemsToTake = Math.min(
      maxItemsPerSection,
      itemsRemainingInCategory,
      spaceInCurrentLote || maxItemsPerSection
    );

    // Si aún no caben ni 1 item, crear nuevo lote
    if (itemsToTake <= 0) {
      if (currentLote.sections.length > 0) {
        console.log(`   💾 Guardando lote lleno`);
        messageLotes.push(currentLote);
      }

      currentLote = {
        loteNumber: messageLotes.length + 1,
        sections: [],
        itemsCount: 0,
        categoriesInLote: new Set<string>()
      };

      console.log(`   📝 Nuevo Lote ${currentLote.loteNumber} creado`);
      continue;
    }

    // ✅ OBTENER ITEMS PARA ESTA SECCIÓN
    const itemsForSection = category.items.slice(
      category.itemsProcessed,
      category.itemsProcessed + itemsToTake
    );

    // ✅ CREAR TÍTULO CON SUFIJO NUMERADO
    const sectionNumber = Math.floor(category.itemsProcessed / maxItemsPerSection) + 1;
    let sectionTitle: string;

    if (category.itemCount > maxItemsPerSection) {
      // Más de 10 items: agregar sufijo
      sectionTitle = `${categoryName} ${sectionNumber}`;
    } else {
      // 10 o menos: sin sufijo
      sectionTitle = categoryName;
    }

    // ✅ CREAR SECCIÓN
    const section = {
      title: sectionTitle.substring(0, 30),
      product_items: itemsForSection.map(item => ({
        product_retailer_id: item.retailer_id || item.id
      }))
    };

    currentLote.sections.push(section);
    currentLote.itemsCount += itemsForSection.length;
    currentLote.categoriesInLote.add(categoryName); // ✅ Marcar categoría (se puede repetir)

    console.log(`   ✅ Sección "${sectionTitle}": ${itemsForSection.length} items`);
    console.log(`      Total en Lote ${currentLote.loteNumber}: ${currentLote.itemsCount}/${maxItemsPerMessage}`);

    // ✅ ACTUALIZAR ITEMS PROCESADOS
    category.itemsProcessed += itemsToTake;

    // ✅ Si el lote está lleno (30 items), guardarlo
    if (currentLote.itemsCount >= maxItemsPerMessage) {
      console.log(`   💾 Lote ${currentLote.loteNumber} completo (${currentLote.itemsCount} items), guardando`);
      messageLotes.push(currentLote);

      currentLote = {
        loteNumber: messageLotes.length + 1,
        sections: [],
        itemsCount: 0,
        categoriesInLote: new Set<string>()
      };

      console.log(`   📝 Nuevo Lote ${currentLote.loteNumber} creado`);
    }
  }

  // ✅ GUARDAR ÚLTIMO LOTE SI TIENE CONTENIDO
  if (currentLote.sections.length > 0) {
    messageLotes.push(currentLote);
    console.log(`\n💾 Lote ${currentLote.loteNumber} guardado: ${currentLote.itemsCount} items`);
  }

  // ═════════════════════════════════════════════════════════════════
  // 📊 RESUMEN FINAL
  // ═════════════════════════════════════════════════════════════════

  console.log(`\n${'═'.repeat(70)}`);
  console.log('📤 RESUMEN FINAL DE LOTES');
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n📊 Total de mensajes: ${messageLotes.length}\n`);

  let totalItems = 0;
  const categoriesUsed = new Set<string>();

  messageLotes.forEach((lote: any) => {
    console.log(`\n📨 Lote ${lote.loteNumber}:`);
    console.log(`   📦 Items: ${lote.itemsCount}/${maxItemsPerMessage}`);
    console.log(`   📋 Secciones: ${lote.sections.length}`);

    // Extraer categorías únicas (sin sufijos numéricos)
    const uniqueCategoriesInLote = new Set<string>();
    for (const cat of lote.categoriesInLote) {
      const baseCategoryName = (cat as string).replace(/\s+\d+$/, '');
      uniqueCategoriesInLote.add(baseCategoryName);
    }

    const categoriesString = Array.from(uniqueCategoriesInLote).sort().join(', ');
    console.log(`   🏷️  Categorías: ${categoriesString}`);

    // Listar secciones
    lote.sections.forEach((section: any, idx: number) => {
      console.log(`     ${idx + 1}. ${section.title}: ${section.product_items.length} items`);
    });

    totalItems += lote.itemsCount;
  });

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 TOTALES FINALES:`);
  console.log(`   • Mensajes: ${messageLotes.length}`);
  console.log(`   • Items totales: ${totalItems}`);
  console.log(`   • Categorías únicas procesadas: ${categoryArray.length}`);
  console.log(`${'═'.repeat(70)}\n`);

  return messageLotes;
}

/**
 * FUNCIÓN MEJORADA v13.1: Obtiene TODOS los productos del catálogo con paginación
 * ✅ Soporta catálogos con 100+ productos
 * ✅ Implementa paginación automática
 * ✅ Agrupa en mensajes de máximo 120 items
 * ✅ CORREGIDO: Validación segura de títulos de sección
 * ✅ Compatible con Meta Graph API v23.0
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
    
    // ✅ SOLUCIÓN: Implementar paginación para obtener todos los productos
    let allProducts: any[] = [];
    let nextCursor: string | null = null;
    let pageNumber = 1;
    const maxProductsPerPage = 100; // Límite máximo de Meta

    // ✅ LOOP DE PAGINACIÓN: Obtener todas las páginas
    do {
      console.log(`\n📑 PÁGINA ${pageNumber}:`);
      
      // Construir URL con cursor de paginación
      let productUrl = `https://graph.facebook.com/v23.0/${catalog.catalogId}/products?fields=id,name,description,price,currency,retailer_id,category,availability,condition,brand&limit=${maxProductsPerPage}`;
      
      // Si hay cursor, agregarlo para la siguiente página
      if (nextCursor) {
        productUrl += `&after=${nextCursor}`;
        console.log(`🔗 Usando cursor: ${nextCursor.substring(0, 30)}...`);
      }

      console.log(`🌐 URL: ${productUrl.replace(jwtToken, '***TOKEN***')}`);

      const productsResponse = await fetch(
        productUrl,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
          }
        }
      );

      const productsData = await productsResponse.json();

      if (!productsResponse.ok) {
        throw new Error(`Error obteniendo productos página ${pageNumber}: ${productsData.error?.message}`);
      }

      const pageProducts = productsData.data || [];
      
      // ✅ AGREGAR PRODUCTOS DE ESTA PÁGINA AL TOTAL
      allProducts = allProducts.concat(pageProducts);
      console.log(`✅ Productos en página ${pageNumber}: ${pageProducts.length}`);
      console.log(`📊 Total acumulado: ${allProducts.length} productos`);

      // ✅ VERIFICAR SI HAY MÁS PÁGINAS
      const pagingInfo = productsData.paging;
      
      if (pagingInfo && pagingInfo.cursors && pagingInfo.cursors.after) {
        nextCursor = pagingInfo.cursors.after;
        console.log(`➡️  Hay más productos, siguiente cursor disponible`);
        pageNumber++;
      } else {
        nextCursor = null;
        console.log(`✅ No hay más páginas`);
        pageNumber++;
      }

    } while (nextCursor !== null); // ✅ Continuar mientras haya más páginas

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ DESCARGA COMPLETA DE CATÁLOGO`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`📦 Total de productos descargados: ${allProducts.length}`);
    console.log(`📄 Páginas consultadas: ${pageNumber - 1}`);
    console.log(`${'═'.repeat(70)}\n`);

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

      // ✅ EXTRAER CATEGORÍAS ÚNICAS Y CREAR DESCRIPCIÓN
      const categoriesInLote = Array.from(lote.categoriesInLote) as string[];
      
      // Crear string de categorías sin números (eliminar " 1", " 2", " 3", etc.)
      const uniqueCategories = new Set<string>();
      
      categoriesInLote.forEach((cat: string) => {
        // Remover sufijo numérico si existe
        const baseCategoryName = cat.replace(/\s+\d+$/, ''); // Elimina " 1", " 2", " 3", etc.
        uniqueCategories.add(baseCategoryName);
      });

      // Convertir Set a array y ordenar
      const uniqueCategoriesArray = Array.from(uniqueCategories).sort();
      let categoriesDescription = uniqueCategoriesArray.join(', ');

      console.log(`🏷️  Categorías únicas en Lote ${lote.loteNumber}: ${categoriesDescription}`);

      // ✅ VALIDAR Y LIMITAR LONGITUD DEL HEADER (MAX 60 CARACTERES)
      const headerTemplate = `${catalog.emoji} ${catalog.name} (${lote.loteNumber}/${messageLotes.length})`;
      let headerText = headerTemplate;

      console.log(`📏 Longitud header: ${headerText.length} caracteres (Límite: 60)`);

      if (headerText.length > 60) {
        console.log(`⚠️  Header demasiado largo (${headerText.length}), truncando...`);
        
        const maxCatalogNameLength = 35;
        const truncatedName = catalog.name.substring(0, maxCatalogNameLength);
        headerText = `${catalog.emoji} ${truncatedName} (${lote.loteNumber}/${messageLotes.length})`;
        
        if (headerText.length > 60) {
          headerText = `${catalog.emoji} Catálogo (${lote.loteNumber}/${messageLotes.length})`;
        }
        
        console.log(`✅ Header ajustado: "${headerText}" (${headerText.length} caracteres)`);
      }

      // ✅ NUEVO BODY MEJORADO - VALIDADO PARA META
      let bodyText = '';
      
      if (lote.loteNumber === 1 && messageLotes.length > 1) {
        // PRIMER CATÁLOGO - Incluir instrucciones
        bodyText = `${lote.itemsCount} productos disponibles\n\n` +
                   `📂 Categorías:\n${categoriesDescription}\n\n` +
                   `ℹ️ USAR CATÁLOGOS:\n` +
                   `1️⃣ Abre este catálogo\n` +
                   `2️⃣ Ve los siguientes (${messageLotes.length - 1} más)\n` +
                   `3️⃣ Selecciona productos\n` +
                   `4️⃣ Envía pedido desde cualquiera\n\n`;
      } else if (lote.loteNumber === messageLotes.length) {
        // ÚLTIMO CATÁLOGO - Incluir instrucción de envío de pedido
        bodyText = `${lote.itemsCount} productos disponibles\n\n` +
                   `📂 Categorías:\n${categoriesDescription}\n\n` +
                   `✅ FINALIZAR COMPRA:\n` +
                   `Presiona "Generar pedido" para completar tu compra de los ${messageLotes.length} catálogos.\n\n`;
      } else {
        // CATÁLOGOS INTERMEDIOS
        bodyText = `${lote.itemsCount} productos disponibles\n\n` +
                   `📂 Categorías:\n${categoriesDescription}\n\n` +
                   `➡️ Continúa con los siguientes catálogos\n\n`;
      }

      // ✅ VALIDAR LONGITUD DEL BODY (MAX 1024 CARACTERES)
      if (bodyText.length > 1024) {
        console.log(`⚠️  Body demasiado largo (${bodyText.length}), truncando...`);
        bodyText = bodyText.substring(0, 1020) + '...';
        console.log(`✅ Body ajustado: ${bodyText.length} caracteres`);
      }

      // ✅ CONSTRUCCIÓN DEL MENSAJE CON VALIDACIONES - VERSIÓN CORREGIDA
      const productListMessage = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "interactive",
        interactive: {
          type: "product_list",
          header: {
            type: "text",
            text: headerText
          },
          body: {
            text: bodyText
          },
          footer: {
            text: "Agrega al carrito. Finaliza tu compra"
          },
          action: {
            catalog_id: catalog.catalogId,
            sections: lote.sections.map((section: any, index: number) => {
              // ✅ VALIDACIÓN SEGURA: Verificar que title exista
              let safeTitle = section.sectionTitle || section.title || `Section ${index + 1}`;
              
              // ✅ SANITIZAR: Remover emojis y caracteres especiales
              safeTitle = safeTitle
                .replace(/[^\w\s\-]/g, '')  // Remover caracteres especiales
                .substring(0, 30)            // Limitar a 30 caracteres
                .trim();
              
              // ✅ VALIDAR QUE NO ESTÉ VACÍO
              if (!safeTitle || safeTitle.length === 0) {
                safeTitle = `Products ${index + 1}`;
              }
              
              console.log(`✅ Sección sanitizada: "${safeTitle}" (${section.items?.length || section.product_items?.length || 0} items)`);
              
              return {
                title: safeTitle,
                product_items: (section.items || section.product_items || []).map((item: any) => ({
                  product_retailer_id: String(item.product_retailer_id || item.id || item.retailer_id).trim()
                }))
              };
            })
          }
        }
      };

      console.log(`📋 Payload preparado:`);
      console.log(`   Header: "${productListMessage.interactive.header.text}" (${headerText.length}/60)`);
      console.log(`   Body: ${bodyText.length} caracteres (Máx: 1024)`);
      console.log(`   Secciones: ${productListMessage.interactive.action.sections.length}`);
      console.log(`   Total items: ${productListMessage.interactive.action.sections.reduce((sum: number, s: any) => sum + (s.product_items?.length || 0), 0)}`);

      try {
        // ✅ ESPERA MÁS LARGA ENTRE MENSAJES (Meta requiere 1-2 segundos)
        if (lote.loteNumber > 1) {
          console.log(`⏳ Esperando 2 segundos antes de enviar Lote ${lote.loteNumber}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

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
          
          // Análisis detallado de errores
          if (result.error?.code === 131000) {
            console.error(`   🚨 ERROR #131000: "Something went wrong"`);
            console.error(`   📋 Detalles: ${result.error?.error_data?.details || 'No especificado'}`);
            
            // Intentar envío alternativo sin caracteres especiales
            if (result.error?.error_data?.details?.includes('section')) {
              console.log(`   🔄 Intentando con secciones simplificadas...`);
              
              const simplifiedSections = productListMessage.interactive.action.sections.map((section: any, idx: number) => ({
                title: section.title
                  .replace(/\W/g, '') // Remover TODOS los caracteres especiales
                  .substring(0, 20)
                  .trim() || `Products${idx + 1}`,
                product_items: section.product_items
              }));

              productListMessage.interactive.action.sections = simplifiedSections;
              
              const retryResponse = await fetch(
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

              const retryResult = await retryResponse.json();
              
              if (retryResponse.ok) {
                console.log(`✅ Reintento exitoso - Lote ${lote.loteNumber} enviado`);
                successCount++;
              } else {
                console.error(`❌ Reintento también falló:`, retryResult);
              }
            }
          } else if (result.error?.error_data?.details) {
            console.error('   Detalle:', result.error.error_data.details);
          }
        } else {
          console.log(`✅ Lote ${lote.loteNumber} enviado exitosamente`);
          console.log(`   📂 Contiene: ${categoriesDescription}`);
          console.log(`   📏 Header: "${headerText}" (${headerText.length}/60 caracteres)`);
          successCount++;
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
      productsCount: allProducts.length,
      pagesQueried: pageNumber - 1
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
        await provider.sendText('56953941370@s.whatsapp.net', finalMessage);
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
        const userPhone = ctx.from;  // 🔑 CLAVE ÚNICA
        
        console.log('🔐 === REGISTRANDO USUARIO ===');
        console.log('📱 UserPhone (clave única):', userPhone);
        console.log('👤 Nombre:', ctx.pushName);
        
        // ✅ GUARDAR DATOS DEL USUARIO CON NAMESPACE
        await state.update({ 
            [`user_${userPhone}`]: {
                name: ctx.pushName || ctx.body,
                phone: userPhone,
                lastActivity: new Date().toISOString(),
                joinedAt: new Date().toISOString(),
                sessionId: `session_${userPhone}_${Date.now()}`
            }
        });
        
        console.log(`✅ Usuario registrado: user_${userPhone}`);
        
        // Validación de horario...
        const horaActual = moment();
        const horario = "01:00-00:00";
        const rangoHorario = horario.split("-");
        const horaInicio = moment(rangoHorario[0], "HH:mm");
        const horaFin = moment(rangoHorario[1], "HH:mm");
        
        if (horaActual.isBetween(horaInicio, horaFin)) {
            console.log(`✅ Usuario ${userPhone} dentro de horario`);
            return gotoFlow(flowPrincipal);
        } else {
            console.log(`⚠️ Usuario ${userPhone} fuera de horario`);
            return gotoFlow(flowPrincipal);  // O flowDisable
        }

    } catch (error) {
        console.error('💥 Error en flowValidTime:', error);
        return gotoFlow(flowPrincipal);
    }
 });

const main = async () => {
    
    
    // Configurar flows: NUEVA ESTRATEGIA CON FLOWS INDIVIDUALES
    const adapterFlow = createFlow([
        flowEndShoppingCart,
        flowValidTime,                  // Flujo de validación de horario
        flowPrincipal,                  // 🔄 Menú principal legacy (backup)
        flowDisable,                    // ⚠️ Flujo fuera de horario
        FlowAgente2,                    // Flujo para agente
        flowOrder,                      // Flujo para órdenes
        flowValidMedia,                 // Validación de media
        // flowSelectCategory,        // ✅ NUEVO
        flowCategorySelection,
        flowContinueOrCheckout,    // ✅ NUEVO
        idleFlow
    ])
    
    const adapterProvider = createProvider(Provider, {
        jwtToken: process.env.JWT_TOKEN!,
        numberId: process.env.NUMBER_ID!,
        verifyToken: process.env.VERIFY_TOKEN!,
        version: 'v23.0'
    })

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
