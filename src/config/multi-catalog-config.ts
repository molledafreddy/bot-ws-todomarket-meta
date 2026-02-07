import dotenv from 'dotenv';

dotenv.config();

export interface CatalogConfig {
  catalogId: string;
  name: string;
  emoji: string;
  description: string;
  enabled: boolean;
}

// CONFIGURACIÓN FLEXIBLE - USAR CATÁLOGO PRINCIPAL SI NO HAY ESPECÍFICOS
const MAIN_CATALOG_ID = process.env.CATALOG_TODOMARKET_ID || process.env.CATALOG_ID || '';
const BEBIDAS_CATALOG_ID = process.env.CATALOG_BEBIDAS_ID || MAIN_CATALOG_ID;

export const MULTI_CATALOG_CONFIG: Record<string, CatalogConfig> = {
  principal: {
    catalogId: MAIN_CATALOG_ID,
    name: "TodoMarket Completo",
    emoji: "🛍️",
    description: "Catálogo completo con todos los productos",
    enabled: !!MAIN_CATALOG_ID
  },
  bebidas: {
    catalogId: BEBIDAS_CATALOG_ID,
    name: "Bebidas y Refrescos", 
    emoji: "🥤",
    description: "Catálogo especializado en bebidas",
    enabled: !!BEBIDAS_CATALOG_ID
  }
};

export const ENABLED_CATALOGS = Object.entries(MULTI_CATALOG_CONFIG)
  .filter(([_, config]) => config.enabled && config.catalogId)
  .reduce((acc, [key, config]) => {
    acc[key] = config;
    return acc;
  }, {} as Record<string, CatalogConfig>);

// FUNCIÓN FALTANTE: getCatalogConfig
export function getCatalogConfig(): Record<string, CatalogConfig> {
  return ENABLED_CATALOGS;
}

// FUNCIÓN ALTERNATIVA: getCatalogById
export function getCatalogById(catalogId: string): CatalogConfig | null {
  const catalogs = Object.values(ENABLED_CATALOGS);
  return catalogs.find(catalog => catalog.catalogId === catalogId) || null;
}

// FUNCIÓN ALTERNATIVA: getCatalogByKey
export function getCatalogByKey(key: string): CatalogConfig | null {
  return ENABLED_CATALOGS[key] || null;
}

// Validación de configuración MEJORADA
export function validateCatalogConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Verificar que al menos tengamos un catálogo válido
  if (Object.keys(ENABLED_CATALOGS).length === 0) {
    errors.push('No hay catálogos habilitados. Verifica las variables de entorno.');
  }
  
  Object.entries(ENABLED_CATALOGS).forEach(([key, config]) => {
    if (!config.catalogId || config.catalogId.trim() === '') {
      errors.push(`Catálogo ${key}: ID no configurado o vacío`);
    }
    if (!config.name) {
      errors.push(`Catálogo ${key}: Nombre no configurado`);
    }
  });
  
  // Log para debug
  console.log('🔍 DEBUG - Variables de entorno:');
  console.log('   CATALOG_TODOMARKET_ID:', process.env.CATALOG_TODOMARKET_ID || 'undefined');
  console.log('   CATALOG_BEBIDAS_ID:', process.env.CATALOG_BEBIDAS_ID || 'undefined');
  console.log('   CATALOG_ID (fallback):', process.env.CATALOG_ID || 'undefined');
  console.log('📊 Catálogos habilitados:', Object.keys(ENABLED_CATALOGS));
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// REEMPLAZAR la función sendSpecificCatalog existente con esta versión COMPLETA:
export async function sendSpecificCatalog(
  phoneNumber: string, 
  catalogKey: string, 
  provider: any
) {
  const catalog = ENABLED_CATALOGS[catalogKey];
  
  if (!catalog) {
    throw new Error(`Catálogo ${catalogKey} no encontrado o no habilitado`);
  }
  
  const jwtToken = process.env.JWT_TOKEN || provider?.globalVendorArgs?.jwtToken;
  const numberId = process.env.NUMBER_ID || provider?.globalVendorArgs?.numberId;
  
  if (!jwtToken || !numberId) {
    throw new Error('Faltan credenciales JWT_TOKEN o NUMBER_ID');
  }
  
  try {
    console.log(`📤 PASO 1: Consultando productos del catálogo ${catalogKey}`);
    console.log(`🏷️ Catalog ID: ${catalog.catalogId}`);
    
    // 🔍 CONSULTAR PRODUCTOS DEL CATÁLOGO VIA API
    const catalogProductsResponse = await fetch(
      `https://graph.facebook.com/v23.0/${catalog.catalogId}/products?fields=id,name,description,price,retailer_id&limit=50`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    const catalogProductsResult = await catalogProductsResponse.json();
    
    if (!catalogProductsResponse.ok) {
      console.error('❌ Error consultando productos del catálogo:', catalogProductsResult);
      throw new Error(`Error obteniendo productos: ${catalogProductsResult.error?.message}`);
    }
    
    const products = catalogProductsResult.data || [];
    console.log(`✅ Productos encontrados en catálogo ${catalogKey}:`, products.length);
    
    if (products.length === 0) {
      throw new Error(`No se encontraron productos en el catálogo ${catalogKey}`);
    }
    
    // 📋 FILTRAR PRODUCTOS SEGÚN EL CATÁLOGO (OPCIONAL)
    let filteredProducts = products;
    
    if (catalogKey === 'bebidas') {
      // Filtrar solo productos relacionados con bebidas
      const bebidasKeywords = ['coca', 'pepsi', 'sprite', 'fanta', 'agua', 'jugo', 'bebida', 'refresco', 'gaseosa'];
      filteredProducts = products.filter((product: any) => {
        const productName = (product.name || '').toLowerCase();
        const productDescription = (product.description || '').toLowerCase();
        return bebidasKeywords.some(keyword => 
          productName.includes(keyword) || productDescription.includes(keyword)
        );
      });
      
      console.log(`🥤 Productos filtrados para bebidas: ${filteredProducts.length} de ${products.length}`);
    }
    
    // Si no hay productos filtrados, usar todos
    if (filteredProducts.length === 0) {
      console.log('⚠️ No hay productos filtrados, usando todos los disponibles');
      filteredProducts = products;
    }
    
    // 🔧 LIMITAR A MÁXIMO 10 PRODUCTOS (limitación de WhatsApp)
    const maxProducts = 10;
    const selectedProducts = filteredProducts.slice(0, maxProducts);
    
    console.log(`📋 Productos seleccionados para mostrar: ${selectedProducts.length}`);
    selectedProducts.forEach((product: any) => {
      console.log(`  • ${product.name} (ID: ${product.retailer_id || product.id})`);
    });
    
    // ✅ CONSTRUIR PRODUCT_LIST CON PRODUCTOS REALES
    const productListMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "product_list",
        header: {
          type: "text",
          text: `${catalog.emoji} ${catalog.name}`
        },
        body: {
          text: `${catalog.description}\n\n👇 ${selectedProducts.length} productos disponibles en esta categoría`
        },
        footer: {
          text: "Selecciona productos → Agrega al carrito → Finalizar compra"
        },
        action: {
          catalog_id: catalog.catalogId,
          sections: [
            {
              title: catalogKey === 'bebidas' ? "🥤 Bebidas Disponibles" : "🛍️ Productos Disponibles",
              product_items: selectedProducts.map((product: any) => ({
                product_retailer_id: product.retailer_id || product.id
              }))
            }
          ]
        }
      }
    };
    
    console.log(`📤 PASO 2: Enviando product_list con ${selectedProducts.length} productos reales`);
    
    // 📤 ENVIAR PRODUCT_LIST CON PRODUCTOS CONSULTADOS
    const response = await fetch(`https://graph.facebook.com/v23.0/${numberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productListMessage)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error enviando product_list con productos consultados:', result);
      throw new Error(`Error enviando product_list: ${result.error?.message}`);
    }
    
    console.log('✅ Product_list con productos consultados enviado exitosamente:', result);
    return result;
    
  } catch (error1: any) {
    console.log(`🔄 FALLBACK 1: Error en consulta/envío de productos (${error1.message}), intentando catalog_message...`);
    
    // FALLBACK 1: catalog_message genérico
    const catalogMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "catalog_message",
        body: {
          text: `${catalog.emoji} ${catalog.name}\n\n${catalog.description}\n\n👇 Explora todos los productos disponibles`
        },
        footer: {
          text: `Catálogo: ${catalog.name} | Productos completos`
        },
        action: {
          name: "catalog_message"
        }
      }
    };
    
    try {
      console.log('📤 FALLBACK: Enviando catalog_message genérico...');
      
      const response2 = await fetch(`https://graph.facebook.com/v23.0/${numberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(catalogMessage)
      });
      
      const result2 = await response2.json();
      
      if (response2.ok) {
        console.log('✅ Catalog_message fallback enviado exitosamente:', result2);
        
        // Mensaje adicional para clarificar
        const clarificationMessage = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneNumber,
          type: "text",
          text: {
            body: `📋 *Seleccionaste: ${catalog.name}*\n\n${catalog.description}\n\n⚠️ *Nota:* Mostrando catálogo completo. ${catalogKey === 'bebidas' ? 'Busca productos de bebidas y refrescos.' : 'Todos los productos están disponibles.'}\n\n💬 Escribe "menu" para ver otras categorías.`
          }
        };
        
        setTimeout(async () => {
          try {
            await fetch(`https://graph.facebook.com/v23.0/${numberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(clarificationMessage)
            });
            console.log('✅ Mensaje de clarificación enviado');
          } catch (clarError) {
            console.log('⚠️ Error enviando clarificación:', clarError);
          }
        }, 2000);
        
        return result2;
        
      } else {
        console.error('❌ Catalog_message fallback también falló:', result2);
        throw new Error(`Catalog_message failed: ${result2.error?.message}`);
      }
      
    } catch (error2: any) {
      console.log(`📝 FALLBACK 2: Ambos métodos fallaron, enviando lista de texto...`);
      
      // FALLBACK 2: Lista de productos en texto
      const fallbackMessage = [
        `${catalog.emoji} **${catalog.name.toUpperCase()}**`,
        '',
        `📋 ${catalog.description}`,
        '',
        '🚧 **Catálogo interactivo temporalmente no disponible**',
        `Error técnico: ${error1.message}`,
        '',
        '📞 **PRODUCTOS DESTACADOS DISPONIBLES:**'
      ];
      
      // Productos específicos según el catálogo seleccionado
      if (catalogKey === 'principal') {
        fallbackMessage.push(
          '',
          '🛍️ **CATÁLOGO GENERAL - TODAS LAS CATEGORÍAS:**',
          '',
          '🥤 **BEBIDAS:**',
          '• Coca Cola Lata 350ml - $1.900',
          '• Pepsi Lata 350ml - $1.800',
          '• Agua Mineral 1.5L - $1.200',
          '• Sprite Lata 350ml - $1.800',
          '• Fanta Lata 350ml - $1.800',
          '',
          '🍞 **PANADERÍA Y CEREALES:**',
          '• Pan de Molde 500g - $1.600',
          '• Cereales 400g - $3.200',
          '• Galletas Surtidas - $2.400',
          '',
          '🥛 **LÁCTEOS Y HUEVOS:**',
          '• Leche Entera 1L - $1.400',
          '• Huevos x12 - $3.500',
          '• Queso Fresco 250g - $2.800',
          '• Yogurt Natural - $1.800',
          '',
          '🌾 **ABARROTES:**',
          '• Arroz 1kg - $2.800',
          '• Aceite 1L - $4.200',
          '• Azúcar 1kg - $1.800',
          '• Fideos 500g - $1.200',
          '',
          '🍎 **FRUTAS Y VERDURAS:**',
          '• Manzanas x4 - $2.800',
          '• Tomates 1kg - $2.200',
          '• Papas 2kg - $3.500'
        );
      } else if (catalogKey === 'bebidas') {
        fallbackMessage.push(
          '',
          '🥤 **CATÁLOGO ESPECIALIZADO EN BEBIDAS:**',
          '',
          '🥤 **GASEOSAS Y REFRESCOS:**',
          '• Coca Cola Lata 350ml - $1.900',
          '• Pepsi Lata 350ml - $1.800',
          '• Sprite Lata 350ml - $1.800',
          '• Fanta Naranja 350ml - $1.800',
          '• Fanta Uva 350ml - $1.800',
          '',
          '💧 **AGUAS Y NATURALES:**',
          '• Agua Mineral 1.5L - $1.200',
          '• Agua con Gas 1.5L - $1.400',
          '• Agua Saborizada 500ml - $1.600',
          '• Jugo Watts 1L - $2.500',
          '• Jugo Natural 200ml - $1.200',
          '',
          '🫖 **TÉS Y CAFÉS FRÍOS:**',
          '• Té Helado Limón 500ml - $2.200',
          '• Nestea Durazno 1.5L - $2.600',
          '• Café Frío 250ml - $2.800',
          '',
          '⚡ **ENERGÉTICAS Y DEPORTIVAS:**',
          '• Red Bull 250ml - $2.800',
          '• Monster Energy 473ml - $3.200',
          '• Gatorade 500ml - $2.400',
          '• Powerade 500ml - $2.400',
          '',
          '🍺 **PARA ADULTOS (+18):**',
          '• Cerveza Cristal 330ml - $2.200',
          '• Cerveza Escudo 330ml - $2.200'
        );
      }
      
      fallbackMessage.push(
        '',
        '🛒 **HACER PEDIDO POR WhatsApp:**',
        '',
        '✏️ **Formato de pedido:**',
        '"Quiero [producto] [cantidad]"',
        '',
        '📝 **Ejemplos:**',
        catalogKey === 'bebidas' 
          ? '• "Quiero coca cola 3"'
          : '• "Quiero coca cola 2"',
        catalogKey === 'bebidas' 
          ? '• "Quiero agua mineral 2"'
          : '• "Quiero pan molde 1"',
        catalogKey === 'bebidas' 
          ? '• "Quiero red bull 1"'
          : '• "Quiero huevos 1"',
        '',
        '📞 **CONTACTO DIRECTO:**',
        '+56 9 3649 9908',
        '⏰ 2:00 PM - 10:00 PM',
        '',
        '💬 **COMANDOS:**',
        '• "carrito" → Ver pedido',
        '• "menu" → Menú principal',
        catalogKey === 'bebidas' ? '• "principal" → Catálogo completo' : '• "bebidas" → Solo bebidas'
      );
      
      console.log(`📝 Enviando fallback de texto para ${catalogKey}`);
      
      return {
        success: false,
        error: `${error1.message} | ${error2.message}`,
        fallbackMessage: fallbackMessage.join('\n'),
        catalog: catalog.name,
        catalogKey: catalogKey,
        useTextFallback: true
      };
    }
  }
}

// NUEVA FUNCIÓN AUXILIAR: Obtener productos de un catálogo específico
export async function getCatalogProducts(catalogId: string, jwtToken: string, limit: number = 50) {
  try {
    console.log(`🔍 Consultando productos del catálogo ${catalogId}...`);
    
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${catalogId}/products?fields=id,name,description,price,retailer_id,availability&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error consultando productos:', result);
      throw new Error(`Error API: ${result.error?.message || 'Unknown error'}`);
    }
    
    const products = result.data || [];
    console.log(`✅ ${products.length} productos encontrados en catálogo ${catalogId}`);
    
    return products;
    
  } catch (error: any) {
    console.error('❌ Error en getCatalogProducts:', error);
    throw error;
  }
}

// FUNCIÓN AUXILIAR PARA OBTENER CREDENCIALES
export function getMetaCredentials() {
  const jwtToken = process.env.JWT_TOKEN;
  const numberId = process.env.NUMBER_ID;
  const catalogId = process.env.CATALOG_ID;
  
  console.log('🔍 Verificando credenciales Meta:');
  console.log('   JWT_TOKEN:', jwtToken ? `${jwtToken.substring(0, 20)}...` : 'NO CONFIGURADO');
  console.log('   NUMBER_ID:', numberId || 'NO CONFIGURADO');
  console.log('   CATALOG_ID:', catalogId || 'NO CONFIGURADO');
  
  return {
    jwtToken,
    numberId,
    catalogId,
    isComplete: !!(jwtToken && numberId)
  };
}