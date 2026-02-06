import dotenv from 'dotenv';

dotenv.config();

export interface CatalogConfig {
  catalogId: string;
  name: string;
  emoji: string;
  description: string;
  enabled: boolean;
}

export const MULTI_CATALOG_CONFIG: Record<string, CatalogConfig> = {
  principal: {
    catalogId: process.env.CATALOG_TODOMARKET_ID!,
    name: "TodoMarket Completo",
    emoji: "🛍️",
    description: "Catálogo completo con todos los productos",
    enabled: true
  },
  bebidas: {
    catalogId: process.env.CATALOG_BEBIDAS_ID!,
    name: "Bebidas y Refrescos", 
    emoji: "🥤",
    description: "Catálogo especializado en bebidas",
    enabled: true
  }
};

export const ENABLED_CATALOGS = Object.entries(MULTI_CATALOG_CONFIG)
  .filter(([_, config]) => config.enabled)
  .reduce((acc, [key, config]) => {
    acc[key] = config;
    return acc;
  }, {} as Record<string, CatalogConfig>);

// Validación de configuración
export function validateCatalogConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  Object.entries(ENABLED_CATALOGS).forEach(([key, config]) => {
    if (!config.catalogId) {
      errors.push(`Catálogo ${key}: ID no configurado`);
    }
    if (!config.name) {
      errors.push(`Catálogo ${key}: Nombre no configurado`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Función para enviar catálogo específico
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
  
  return await provider.sendMessage(phoneNumber, catalogMessage);
}