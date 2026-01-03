// ✅ CONFIGURACIÓN CORRECTA DE NÚMEROS WHATSAPP BUSINESS
// Resumen de la diferencia entre Application ID y Phone Number

/*
🆔 APPLICATION ID (NUMBER_ID): 725315067342333
- Uso: Para envío de mensajes vía Meta Graph API
- Endpoint: /v18.0/{APPLICATION_ID}/messages
- Variable: process.env.NUMBER_ID
- Donde se usa: Todas las llamadas a la API de Meta

📞 PHONE NUMBER: 56979643935 (mostrado como +56 9 7964 3935)  
- Uso: Para enlaces públicos del catálogo
- Formato: https://wa.me/c/{PHONE_NUMBER}
- Donde se usa: Enlaces de catálogo para usuarios finales

CONFIGURACIÓN ACTUAL:
✅ API calls → 725315067342333 (APPLICATION_ID)
✅ Enlaces públicos → 56979643935 (PHONE_NUMBER)
*/

export const WHATSAPP_BUSINESS_CONFIG = {
    // Para API de Meta (envío de mensajes)
    applicationId: '725315067342333',
    
    // Para enlaces públicos de catálogo
    phoneNumber: '56979643935',
    displayNumber: '+56 9 7964 3935',
    
    // Business information
    businessName: 'Minimarket Todomarket',
    businessId: '1349962220108819',
    
    // Template information
    templateName: 'ccatalogo_todomarket',
    templateId: '1845275256134045'
};

// Función para generar URL de catálogo
export function getCatalogUrl(): string {
    return `https://wa.me/c/${WHATSAPP_BUSINESS_CONFIG.phoneNumber}`;
}

// Función para validar configuración
export function validateWhatsAppConfig(): boolean {
    const { applicationId, phoneNumber, businessId, templateName } = WHATSAPP_BUSINESS_CONFIG;
    
    const isValid = !!(applicationId && phoneNumber && businessId && templateName);
    
    console.log('🔍 Validación configuración WhatsApp Business:');
    console.log(`  - Application ID: ${applicationId ? '✅' : '❌'}`);
    console.log(`  - Phone Number: ${phoneNumber ? '✅' : '❌'}`);
    console.log(`  - Business ID: ${businessId ? '✅' : '❌'}`);
    console.log(`  - Template Name: ${templateName ? '✅' : '❌'}`);
    console.log(`  - Configuración válida: ${isValid ? '✅' : '❌'}`);
    
    return isValid;
}

export default WHATSAPP_BUSINESS_CONFIG;
