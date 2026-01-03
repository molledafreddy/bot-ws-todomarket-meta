/**
 * CONFIGURACIÓN DE PLANTILLAS APROBADAS DE META PARA TODOMARKET
 * 
 * Esta configuración contiene las plantillas oficiales aprobadas por Meta
 * para el envío de catálogos de WhatsApp Business
 */

// ID de tu plantilla aprobada (obtenido de la detección)
export const CATALOG_TEMPLATE_NAME = "ccatalogo_todomarket";
export const TEMPLATE_ID = "1845275256134045";
export const BUSINESS_ID = "1349962220108819";

// Configuración de plantillas aprobadas
export interface ApprovedTemplate {
    name: string;
    id: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    language: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED';
    components: TemplateComponent[];
}

export interface TemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'MEDIA' | 'LOCATION';
    text?: string;
    parameters?: TemplateParameter[];
    buttons?: TemplateButton[];
}

export interface TemplateParameter {
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
}

export interface TemplateButton {
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'CATALOG';
    text: string;
    url?: string;
    phone_number?: string;
}

// Plantillas aprobadas para TodoMarket
export const TODOMARKET_TEMPLATES: Record<string, ApprovedTemplate> = {
    // Plantilla principal de catálogo (nombre real detectado)
    catalog_main: {
        name: CATALOG_TEMPLATE_NAME, // ccatalogo_todomarket (detectado)
        id: TEMPLATE_ID,
        category: 'MARKETING', // Detectado como MARKETING
        language: 'es_CL', // Detectado es_CL
        status: 'APPROVED',
        components: [
            {
                type: 'BODY',
                text: 'Catalgo con todos Nuestros productos', // Texto real de la plantilla
                parameters: []
            },
            {
                type: 'FOOTER', 
                text: 'Minimarket TodoMarket', // Footer real de la plantilla
                parameters: []
            },
            {
                type: 'BUTTONS',
                buttons: [
                    {
                        type: 'CATALOG',
                        text: 'View catalog' // Texto real del botón
                    }
                ]
            }
        ]
    }
};

// Función para obtener el payload correcto de la plantilla
export function getApprovedTemplatePayload(templateKey: string, to: string, parameters?: Record<string, string>): any {
    const template = TODOMARKET_TEMPLATES[templateKey];
    
    if (!template) {
        throw new Error(`Plantilla no encontrada: ${templateKey}`);
    }

    const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
            name: template.name,
            language: {
                code: template.language
            },
            components: []
        }
    };

    // Construir componentes con parámetros
    template.components.forEach(component => {
        if (component.type === 'HEADER' && component.parameters) {
            payload.template.components.push({
                type: "header",
                parameters: component.parameters.map(param => ({
                    type: param.type,
                    text: parameters?.[param.text || ''] || param.text
                }))
            });
        }
        
        if (component.type === 'BODY' && component.parameters) {
            payload.template.components.push({
                type: "body", 
                parameters: component.parameters.map(param => ({
                    type: param.type,
                    text: parameters?.[param.text || ''] || param.text
                }))
            });
        }
    });

    return payload;
}

// Función para verificar el estado de la plantilla
export async function checkTemplateStatus(templateName: string, accessToken: string): Promise<boolean> {
    try {
        console.log(`🔍 Verificando estado de plantilla: ${templateName}`);
        
        const url = `https://graph.facebook.com/v18.0/${BUSINESS_ID}/message_templates`;
        const params = new URLSearchParams({
            name: templateName,
            access_token: accessToken
        });

        const response = await fetch(`${url}?${params}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const template = data.data[0];
                console.log(`✅ Plantilla encontrada:`, {
                    name: template.name,
                    status: template.status,
                    category: template.category,
                    language: template.language
                });
                
                return template.status === 'APPROVED';
            } else {
                console.log(`❌ Plantilla ${templateName} no encontrada`);
                return false;
            }
        } else {
            console.error(`❌ Error verificando plantilla:`, response.status, await response.text());
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Error en verificación de plantilla:`, error);
        return false;
    }
}

// Lista de nombres posibles de plantillas (para probar)
export const POSSIBLE_TEMPLATE_NAMES = [
    'catalog_todomarket',
    'todomarket_catalog', 
    'catalog_template',
    'minimarket_catalog',
    'todomarket_productos',
    'catalog_productos'
];

// Función para auto-detectar el nombre correcto de la plantilla
export async function detectTemplateNameFromMeta(accessToken: string): Promise<string | null> {
    console.log('🔍 Auto-detectando nombre de plantilla desde Meta...');
    
    for (const templateName of POSSIBLE_TEMPLATE_NAMES) {
        const isApproved = await checkTemplateStatus(templateName, accessToken);
        if (isApproved) {
            console.log(`✅ Plantilla detectada: ${templateName}`);
            return templateName;
        }
    }
    
    console.log('❌ No se pudo detectar plantilla aprobada');
    return null;
}

// Función para obtener todas las plantillas del negocio
export async function getAllBusinessTemplates(accessToken: string): Promise<any[]> {
    try {
        console.log('📋 Obteniendo todas las plantillas del negocio...');
        
        const url = `https://graph.facebook.com/v18.0/${BUSINESS_ID}/message_templates`;
        const params = new URLSearchParams({
            fields: 'name,status,category,language,id',
            access_token: accessToken,
            limit: '50'
        });

        const response = await fetch(`${url}?${params}`);
        
        if (response.ok) {
            const data = await response.json();
            
            console.log(`📋 Plantillas encontradas: ${data.data?.length || 0}`);
            
            if (data.data && data.data.length > 0) {
                data.data.forEach((template: any, index: number) => {
                    console.log(`${index + 1}. ${template.name} (${template.status}) - ${template.category} - ${template.language}`);
                });
            }
            
            return data.data || [];
        } else {
            console.error('❌ Error obteniendo plantillas:', response.status, await response.text());
            return [];
        }
        
    } catch (error) {
        console.error('❌ Error en getAllBusinessTemplates:', error);
        return [];
    }
}

// Configuración por defecto para TodoMarket
export const DEFAULT_TEMPLATE_CONFIG = {
    businessName: 'TodoMarket',
    schedule: 'Lunes a Domingo 2:00 PM - 10:00 PM',
    contact: '+56 9 3649 9908',
    catalogUrl: 'https://wa.me/c/725315067342333'
};
