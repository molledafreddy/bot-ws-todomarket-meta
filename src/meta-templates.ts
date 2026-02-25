/**
 * 🎯 GESTOR DE PLANTILLAS DE META WHATSAPP
 * Maneja la detección, configuración y envío de plantillas aprobadas
 */

import fetch from 'node-fetch';

// ═════════════════════════════════════════════════════════════════
// 📋 CONFIGURACIÓN
// ═════════════════════════════════════════════════════════════════

export const BUSINESS_ID = process.env.BUSINESS_ID || '1057244946408276';
export const TEMPLATE_ID = process.env.TEMPLATE_ID || 'your_template_id';
export const TEMPLATE_NAME = process.env.TEMPLATE_NAME || 'todomarket_catalog';

// ═════════════════════════════════════════════════════════════════
// 🔍 INTERFACES Y TIPOS
// ═════════════════════════════════════════════════════════════════

export interface MetaTemplate {
  id: string;
  name: string;
  status: 'PENDING_DELETION' | 'APPROVED' | 'REJECTED' | 'DISABLED' | 'PENDING';
  category: string;
  language: string;
  components: TemplateComponent[];
  created_timestamp?: number;
  quality_score?: string;
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  parameters?: any[];
}

export interface TemplateResponse {
  data: MetaTemplate[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

// ═════════════════════════════════════════════════════════════════
// 🔐 FUNCIONES DE VALIDACIÓN
// ═════════════════════════════════════════════════════════════════

/**
 * Validar que el token sea válido
 */
export async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.instagram.com/me?access_token=${accessToken}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      console.error('❌ Token inválido o expirado');
      return false;
    }

    console.log('✅ Token válido');
    return true;

  } catch (error) {
    console.error('❌ Error validando token:', error);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
// 📥 FUNCIONES PARA OBTENER PLANTILLAS
// ═════════════════════════════════════════════════════════════════

/**
 * Obtener todas las plantillas del negocio
 */
export async function getAllBusinessTemplates(accessToken: string): Promise<MetaTemplate[]> {
  try {
    const url = `https://graph.facebook.com/v18.0/${BUSINESS_ID}/message_templates`;
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,status,category,language,components,created_timestamp,quality_score',
      limit: '100'
    });

    const fullUrl = `${url}?${params.toString()}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Error ${response.status}: ${error.error?.message || 'Unknown error'}`);
    }

    const data: TemplateResponse = await response.json() as any;
    return data.data || [];

  } catch (error: any) {
    console.error('❌ Error obteniendo plantillas:', error.message);
    throw error;
  }
}

/**
 * Obtener una plantilla específica por ID
 */
export async function getTemplateById(
  accessToken: string,
  templateId: string
): Promise<MetaTemplate | null> {
  try {
    const url = `https://graph.facebook.com/v18.0/${templateId}`;
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,status,category,language,components,created_timestamp,quality_score'
    });

    const fullUrl = `${url}?${params.toString()}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`❌ Plantilla ${templateId} no encontrada`);
      return null;
    }

    const template: MetaTemplate = await response.json() as any;
    return template;

  } catch (error: any) {
    console.error('❌ Error obteniendo plantilla:', error.message);
    return null;
  }
}

/**
 * Obtener una plantilla por nombre
 */
export async function getTemplateByName(
  accessToken: string,
  templateName: string
): Promise<MetaTemplate | null> {
  try {
    const templates = await getAllBusinessTemplates(accessToken);
    const template = templates.find(t => t.name.toLowerCase() === templateName.toLowerCase());
    return template || null;

  } catch (error: any) {
    console.error('❌ Error buscando plantilla por nombre:', error.message);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
// 🔍 FUNCIONES DE DETECCIÓN
// ═════════════════════════════════════════════════════════════════

/**
 * Auto-detectar la plantilla de catálogo aprobada
 */
export async function detectTemplateNameFromMeta(accessToken: string): Promise<string | null> {
  try {
    const templates = await getAllBusinessTemplates(accessToken);

    // Filtrar plantillas aprobadas de catálogo
    const catalogTemplates = templates.filter(t =>
      t.status === 'APPROVED' &&
      (t.name.toLowerCase().includes('catalog') ||
       t.name.toLowerCase().includes('catalogo') ||
       t.name.toLowerCase().includes('todomarket') ||
       t.name.toLowerCase().includes('producto') ||
       t.name.toLowerCase().includes('menu'))
    );

    if (catalogTemplates.length > 0) {
      return catalogTemplates[0].name;
    }

    // Si no hay específica de catálogo, devolver la primera aprobada
    const approvedTemplates = templates.filter(t => t.status === 'APPROVED');
    if (approvedTemplates.length > 0) {
      return approvedTemplates[0].name;
    }

    return null;

  } catch (error: any) {
    console.error('❌ Error en auto-detección:', error.message);
    return null;
  }
}

/**
 * Verificar el estado de una plantilla
 */
export async function checkTemplateStatus(
  accessToken: string,
  templateName: string
): Promise<string | null> {
  try {
    const template = await getTemplateByName(accessToken, templateName);

    if (!template) {
      return null;
    }

    return template.status;

  } catch (error: any) {
    console.error('❌ Error verificando estado:', error.message);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
// 📊 FUNCIONES DE CREACIÓN DE PLANTILLAS
// ═════════════════════════════════════════════════════════════════

/**
 * Crear una nueva plantilla de catálogo
 */
export async function createCatalogTemplate(
  accessToken: string,
  templateName: string,
  language: string = 'es_CL'
): Promise<MetaTemplate | null> {
  try {
    const url = `https://graph.facebook.com/v18.0/${BUSINESS_ID}/message_templates`;

    const payload = {
      name: templateName,
      language,
      category: 'MARKETING',
      components: [
        {
          type: 'BODY',
          text: 'Catálogo de {{1}} - {{2}} productos disponibles'
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'QUICK_REPLY',
              text: 'Ver Más'
            },
            {
              type: 'QUICK_REPLY',
              text: 'Ordenar'
            }
          ]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        ...payload,
        access_token: accessToken
      })
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Error ${response.status}: ${error.error?.message || 'Unknown error'}`);
    }

    const template: MetaTemplate = await response.json() as any;
    console.log(`✅ Plantilla "${templateName}" creada correctamente`);
    return template;

  } catch (error: any) {
    console.error('❌ Error creando plantilla:', error.message);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
// 📨 FUNCIONES PARA ENVIAR MENSAJES CON PLANTILLA
// ═════════════════════════════════════════════════════════════════

/**
 * Enviar un mensaje usando una plantilla
 */
export async function sendTemplateMessage(
  accessToken: string,
  phoneNumberId: string,
  recipientPhone: string,
  templateName: string,
  parameters?: string[]
): Promise<boolean> {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'es_CL'
        }
      }
    };

    // Agregar parámetros si existen
    if (parameters && parameters.length > 0) {
      (body.template as any).components = [
        {
          type: 'body',
          parameters: parameters.map(p => ({ type: 'text', text: p }))
        }
      ];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Error ${response.status}: ${error.error?.message || 'Unknown error'}`);
    }

    console.log(`✅ Mensaje enviado a ${recipientPhone}`);
    return true;

  } catch (error: any) {
    console.error('❌ Error enviando mensaje:', error.message);
    return false;
  }
}

/**
 * Enviar catálogo con plantilla
 */
export async function sendCatalogWithTemplate(
  accessToken: string,
  phoneNumberId: string,
  recipientPhone: string,
  catalogId: string,
  templateName: string
): Promise<boolean> {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'es_CL'
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: 'TodoMarket'
              }
            ]
          },
          {
            type: 'button',
            sub_type: 'catalog',
            index: 0,
            parameters: [
              {
                type: 'action',
                action: 'view_catalog',
                thumbnail_product_retailer_id: catalogId
              }
            ]
          }
        ]
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Error ${response.status}: ${error.error?.message || 'Unknown error'}`);
    }

    console.log(`✅ Catálogo enviado a ${recipientPhone}`);
    return true;

  } catch (error: any) {
    console.error('❌ Error enviando catálogo:', error.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
// 📋 FUNCIONES AUXILIARES
// ═════════════════════════════════════════════════════════════════

/**
 * Obtener información detallada de una plantilla
 */
export async function getTemplateDetails(
  accessToken: string,
  templateName: string
): Promise<void> {
  try {
    const template = await getTemplateByName(accessToken, templateName);

    if (!template) {
      console.log(`❌ Plantilla "${templateName}" no encontrada`);
      return;
    }

    console.log('\n📋 DETALLES DE LA PLANTILLA:');
    console.log(`  ID: ${template.id}`);
    console.log(`  Nombre: ${template.name}`);
    console.log(`  Estado: ${template.status}`);
    console.log(`  Categoría: ${template.category}`);
    console.log(`  Idioma: ${template.language}`);
    console.log(`  Componentes: ${template.components?.length || 0}`);

    if (template.components) {
      console.log('\n  Componentes:');
      template.components.forEach((comp, idx) => {
        console.log(`    ${idx + 1}. ${comp.type}`);
        if (comp.text) console.log(`       Texto: ${comp.text}`);
        if (comp.format) console.log(`       Formato: ${comp.format}`);
      });
    }

    if (template.quality_score) {
      console.log(`\n  Puntuación de Calidad: ${template.quality_score}`);
    }

  } catch (error: any) {
    console.error('❌ Error obteniendo detalles:', error.message);
  }
}

/**
 * Listar todas las plantillas con su estado
 */
export async function listAllTemplates(accessToken: string): Promise<void> {
  try {
    const templates = await getAllBusinessTemplates(accessToken);

    console.log('\n📋 TODAS LAS PLANTILLAS:');
    console.log(`Total: ${templates.length}\n`);

    // Agrupar por estado
    const byStatus: Record<string, MetaTemplate[]> = {};

    templates.forEach(template => {
      if (!byStatus[template.status]) {
        byStatus[template.status] = [];
      }
      byStatus[template.status].push(template);
    });

    // Mostrar agrupadas
    Object.entries(byStatus).forEach(([status, templates]) => {
      console.log(`\n${status}:`);
      templates.forEach(template => {
        const icon = status === 'APPROVED' ? '✅' : status === 'PENDING' ? '⏳' : '❌';
        console.log(`  ${icon} ${template.name} (${template.language})`);
      });
    });

  } catch (error: any) {
    console.error('❌ Error listando plantillas:', error.message);
  }
}

// ═════════════════════════════════════════════════════════════════
// 📤 EXPORT POR DEFECTO
// ═════════════════════════════════════════════════════════════════

export default {
  validateAccessToken,
  getAllBusinessTemplates,
  getTemplateById,
  getTemplateByName,
  detectTemplateNameFromMeta,
  checkTemplateStatus,
  createCatalogTemplate,
  sendTemplateMessage,
  sendCatalogWithTemplate,
  getTemplateDetails,
  listAllTemplates
};