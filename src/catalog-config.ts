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

// VALIDACIÓN MEJORADA
export function validateCatalogConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
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

// FUNCIÓN COMPLETAMENTE REESCRITA CON API DIRECTA
export async function sendSpecificCatalog(
  phoneNumber: string, 
  catalogKey: string, 
  provider: any
) {
  const catalog = ENABLED_CATALOGS[catalogKey];
  
  if (!catalog) {
    throw new Error(`Catálogo ${catalogKey} no encontrado o no habilitado`);
  }
  
  const catalogMessage = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "catalog_message",
      body: {
        text: `${catalog.emoji} ${catalog.name}\n\n${catalog.description}\n\n👇 Explora y selecciona productos`
      },
      footer: {
        text: "Selecciona productos → Continúa comprando otras categorías"
      },
      action: {
        name: "catalog_message",
        parameters: {
          catalog_id: catalog.catalogId
        }
      }
    }
  };
  
  try {
    console.log('📤 Enviando catálogo via API directa:', catalogKey);
    console.log('🏷️ Catalog ID:', catalog.catalogId);
    console.log('📱 Destinatario:', phoneNumber);
    
    const jwtToken = process.env.JWT_TOKEN || provider?.globalVendorArgs?.jwtToken;
    const numberId = process.env.NUMBER_ID || provider?.globalVendorArgs?.numberId;
    
    if (!jwtToken) {
      throw new Error('Falta JWT_TOKEN en variables de entorno');
    }
    
    if (!numberId) {
      throw new Error('Falta NUMBER_ID en variables de entorno');
    }
    
    console.log('🔑 Usando JWT Token:', jwtToken.substring(0, 20) + '...');
    console.log('📞 Usando Number ID:', numberId);
    
    // ENVÍO DIRECTO VIA API REST
    const response = await fetch(`https://graph.facebook.com/v18.0/${numberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(catalogMessage)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error de API Meta:', result);
      throw new Error(`API Error ${response.status}: ${result.error?.message || 'Unknown error'}`);
    }
    
    console.log('✅ Catálogo enviado exitosamente via API:', result);
    return result;
    
  } catch (error: any) {
    console.error('❌ Error enviando catálogo via API:', error);
    
    const fallbackMessage = [
      `${catalog.emoji} **${catalog.name.toUpperCase()}**`,
      '',
      `📋 ${catalog.description}`,
      '',
      '🚧 **Catálogo temporal no disponible**',
      'Motivo: ' + (error.message || 'Error desconocido'),
      '',
      '📞 **Productos disponibles:**',
      '• Coca Cola Lata 350ml - $1.900',
      '• Pepsi Lata 350ml - $1.900',
      '• Jugo Natural 1L - $2.500',
      '• Agua Mineral 1.5L - $1.200',
      '• Pan de Molde 500g - $1.600',
      '• Cereales 400g - $3.200',
      '• Leche Entera 1L - $1.400',
      '• Huevos x12 - $3.200',
      '• Queso Fresco 250g - $2.800',
      '• Manzanas Rojas x4 - $2.800',
      '• Tomates 1kg - $2.200',
      '• Papas 2kg - $3.500',
      '',
      '📞 **Para hacer tu pedido:**',
      'Escribe: "Quiero [producto] cantidad [número]"',
      '',
      'Ejemplo: "Quiero coca cola 2"',
      '',
      '📞 **O llama al:** +56 9 3649 9908',
      '⏰ **Horario:** 2:00 PM - 10:00 PM'
    ].join('\n');
    
    console.log('📝 Enviando mensaje de fallback');
    
    return {
      success: false,
      error: error.message,
      fallbackMessage: fallbackMessage,
      catalog: catalog.name
    };
  }
}

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