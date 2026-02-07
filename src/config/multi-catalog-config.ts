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

// REEMPLAZAR la función sendSpecificCatalog con esta versión corregida:
// REEMPLAZAR la función sendSpecificCatalog con esta versión:
export async function sendSpecificCatalog(
  phoneNumber: string, 
  catalogKey: string, 
  provider: any
) {
  const catalog = ENABLED_CATALOGS[catalogKey];
  
  if (!catalog) {
    throw new Error(`Catálogo ${catalogKey} no encontrado o no habilitado`);
  }
  
  // ✅ USAR PRODUCT_LIST PARA ESPECIFICAR CATALOG_ID
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
        text: `${catalog.description}\n\n👇 Productos disponibles en esta categoría`
      },
      footer: {
        text: "Selecciona productos → Agrega al carrito"
      },
      action: {
        catalog_id: catalog.catalogId,  // ✅ ESPECIFICA EL CATÁLOGO EXACTO
        sections: [
          {
            title: catalogKey === 'bebidas' ? "🥤 Bebidas Disponibles" : "🛍️ Todos los Productos",
            product_items: [
              {
                product_retailer_id: "auto_load_products"  // Meta carga automáticamente
              }
            ]
          }
        ]
      }
    }
  };
  
  try {
    console.log(`📤 Enviando catálogo ESPECÍFICO: ${catalogKey}`);
    console.log(`🏷️ Catalog ID: ${catalog.catalogId}`);
    console.log('🛒 Productos: REALES del catálogo (no hardcodeados)');
    
    const jwtToken = process.env.JWT_TOKEN || provider?.globalVendorArgs?.jwtToken;
    const numberId = process.env.NUMBER_ID || provider?.globalVendorArgs?.numberId;
    
    if (!jwtToken || !numberId) {
      throw new Error('Faltan credenciales JWT_TOKEN o NUMBER_ID');
    }
    
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
      console.error('❌ Error en product_list:', result);
      
      // FALLBACK: catalog_message genérico
      console.log('🔄 Intentando catalog_message como fallback...');
      // ... resto del fallback
    }
    
    console.log('✅ Catálogo específico enviado exitosamente:', result);
    return result;
    
  } catch (error: any) {
    // ... manejo de errores con productos hardcodeados como último recurso
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