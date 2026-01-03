/**
 * PLANTILLAS DE CATÁLOGO WHATSAPP BUSINESS - META API
 * 
 * Basado en la documentación oficial de Meta WhatsApp Business API
 * https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-messages
 * 
 * IMPORTANTE: Para usar plantillas de catálogo necesitas:
 * 1. WhatsApp Business API aprobada
 * 2. Catálogo configurado en Meta Business Manager
 * 3. Plantilla de mensaje aprobada por Meta
 */

// ESTRUCTURA OFICIAL DE PLANTILLA DE CATÁLOGO SEGÚN META
export interface CatalogTemplatePayload {
    messaging_product: "whatsapp";
    recipient_type: "individual";
    to: string;
    type: "template";
    template: {
        name: string; // Nombre de tu plantilla aprobada
        language: {
            code: string; // ej: "es_ES", "es_MX"
        };
        components?: TemplateComponent[];
    };
}

export interface TemplateComponent {
    type: "header" | "body" | "button" | "carousel";
    parameters?: TemplateParameter[];
    sub_type?: string;
    index?: string;
    components?: TemplateComponent[];
}

export interface TemplateParameter {
    type: "text" | "currency" | "date_time" | "image" | "document" | "video";
    text?: string;
    currency?: {
        fallback_value: string;
        code: string;
        amount_1000: number;
    };
    image?: {
        link: string;
    };
}

// EJEMPLO DE PLANTILLA DE CATÁLOGO MULTI-PRODUCTO
export const createCatalogTemplate = (
    to: string,
    templateName: string,
    parameters: {
        headerText?: string;
        bodyText?: string;
        catalogId?: string;
    }
): CatalogTemplatePayload => {
    return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "template",
        template: {
            name: templateName, // Debe ser aprobado por Meta ej: "catalog_message"
            language: {
                code: "es_ES"
            },
            components: [
                {
                    type: "header",
                    parameters: [
                        {
                            type: "text",
                            text: parameters.headerText || "🛒 TodoMarket - Catálogo"
                        }
                    ]
                },
                {
                    type: "body",
                    parameters: [
                        {
                            type: "text", 
                            text: parameters.bodyText || "Explora nuestros productos"
                        }
                    ]
                },
                {
                    type: "button",
                    sub_type: "catalog",
                    index: "0",
                    parameters: [
                        {
                            type: "text",
                            text: "Ver Catálogo"
                        }
                    ]
                }
            ]
        }
    };
};

// PLANTILLA DE CATÁLOGO ESPECÍFICA PARA TODOMARKET
export const createTodoMarketCatalogTemplate = (to: string): CatalogTemplatePayload => {
    return createCatalogTemplate(to, "todomarket_catalog", {
        headerText: "🛒 TodoMarket - Minimarket",
        bodyText: "Descubre nuestros productos frescos y de calidad. Horario: 2:00 PM - 10:00 PM"
    });
};

// ALTERNATIVA: MENSAJE INTERACTIVO CON CATÁLOGO (NO PLANTILLA)
export interface InteractiveCatalogMessage {
    messaging_product: "whatsapp";
    recipient_type: "individual";
    to: string;
    type: "interactive";
    interactive: {
        type: "catalog_message";
        body?: {
            text: string;
        };
        header?: {
            type: "text";
            text: string;
        };
        footer?: {
            text: string;
        };
        action: {
            name: "catalog_message";
            parameters: {
                thumbnail_product_retailer_id?: string;
            };
        };
    };
}

// CREAR MENSAJE INTERACTIVO DE CATÁLOGO
export const createInteractiveCatalogMessage = (
    to: string,
    options: {
        headerText?: string;
        bodyText?: string;
        footerText?: string;
        thumbnailProductId?: string;
    }
): InteractiveCatalogMessage => {
    return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
            type: "catalog_message",
            header: options.headerText ? {
                type: "text",
                text: options.headerText
            } : undefined,
            body: {
                text: options.bodyText || "Explora nuestro catálogo de productos"
            },
            footer: options.footerText ? {
                text: options.footerText
            } : undefined,
            action: {
                name: "catalog_message",
                parameters: options.thumbnailProductId ? {
                    thumbnail_product_retailer_id: options.thumbnailProductId
                } : {}
            }
        }
    };
};

// EJEMPLO DE USO PARA TODOMARKET
export const createTodoMarketInteractiveCatalog = (to: string): InteractiveCatalogMessage => {
    return createInteractiveCatalogMessage(to, {
        headerText: "🛒 TodoMarket",
        bodyText: "Minimarket de barrio con productos frescos y de calidad.\n\nHorario de atención:\nLunes a Domingo 2:00 PM - 10:00 PM",
        footerText: "📞 +56 9 3649 9908",
        thumbnailProductId: "51803h3qku" // ID de producto destacado (Coca Cola)
    });
};

// FUNCIONES DE UTILIDAD
export const validateTemplatePayload = (payload: CatalogTemplatePayload): boolean => {
    return !!(
        payload.messaging_product &&
        payload.to &&
        payload.template?.name &&
        payload.template?.language?.code
    );
};

export const validateInteractivePayload = (payload: InteractiveCatalogMessage): boolean => {
    return !!(
        payload.messaging_product &&
        payload.to &&
        payload.interactive?.type === "catalog_message" &&
        payload.interactive?.action?.name === "catalog_message"
    );
};

// CÓDIGOS DE IDIOMA SOPORTADOS
export const LANGUAGE_CODES = {
    SPANISH_SPAIN: "es_ES",
    SPANISH_MEXICO: "es_MX",
    SPANISH_ARGENTINA: "es_AR",
    SPANISH_CHILE: "es_CL",
    ENGLISH_US: "en_US",
    PORTUGUESE_BRAZIL: "pt_BR"
} as const;

// PLANTILLAS COMUNES PARA TODOMARKET
export const TODOMARKET_TEMPLATES = {
    CATALOG_WELCOME: "todomarket_catalog_welcome",
    CATALOG_OFFERS: "todomarket_catalog_offers", 
    CATALOG_NEW_PRODUCTS: "todomarket_catalog_new"
} as const;
