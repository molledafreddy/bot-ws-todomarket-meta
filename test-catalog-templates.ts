/**
 * SCRIPT DE PRUEBA PARA PLANTILLAS DE CATÁLOGO TODOMARKET
 * 
 * Este script te permite probar diferentes formatos de catálogo según Meta
 * sin necesidad de usar el bot completo
 */

import 'dotenv/config';
import { 
    createTodoMarketCatalogTemplate, 
    createTodoMarketInteractiveCatalog,
    validateTemplatePayload,
    validateInteractivePayload 
} from './src/catalog-template';

// Número de prueba (reemplaza con tu número)
const TEST_PHONE = "56936499908";

// Función para simular envío de plantilla Meta
async function testMetaTemplate() {
    console.log('🧪 PROBANDO PLANTILLA META OFICIAL...');
    
    try {
        // Crear payload de plantilla
        const templatePayload = createTodoMarketCatalogTemplate(TEST_PHONE);
        
        // Validar estructura
        const isValid = validateTemplatePayload(templatePayload);
        console.log('✅ Validación:', isValid ? 'VÁLIDA' : 'INVÁLIDA');
        
        // Mostrar payload que se enviaría a Meta API
        console.log('📨 PAYLOAD PARA META API:');
        console.log(JSON.stringify(templatePayload, null, 2));
        
        // Aquí normalmente enviarías a Meta API
        console.log('📡 Para enviar real, usar:');
        console.log(`POST https://graph.facebook.com/v18.0/${process.env.NUMBER_ID}/messages`);
        console.log(`Authorization: Bearer ${process.env.JWT_TOKEN}`);
        
        return templatePayload;
        
    } catch (error) {
        console.error('❌ Error probando plantilla:', error);
    }
}

// Función para probar mensaje interactivo
async function testInteractiveMessage() {
    console.log('\\n🧪 PROBANDO MENSAJE INTERACTIVO...');
    
    try {
        // Crear payload interactivo
        const interactivePayload = createTodoMarketInteractiveCatalog(TEST_PHONE);
        
        // Validar estructura
        const isValid = validateInteractivePayload(interactivePayload);
        console.log('✅ Validación:', isValid ? 'VÁLIDA' : 'INVÁLIDA');
        
        // Mostrar payload
        console.log('📨 PAYLOAD INTERACTIVO:');
        console.log(JSON.stringify(interactivePayload, null, 2));
        
        return interactivePayload;
        
    } catch (error) {
        console.error('❌ Error probando mensaje interactivo:', error);
    }
}

// Función principal de prueba
async function main() {
    console.log('🚀 INICIANDO PRUEBAS DE CATÁLOGO TODOMARKET\\n');
    
    // Verificar variables de entorno
    if (!process.env.NUMBER_ID || !process.env.JWT_TOKEN) {
        console.warn('⚠️ Variables NUMBER_ID o JWT_TOKEN no configuradas');
        console.log('📝 Las pruebas mostrarán solo los payloads sin enviar');
    }
    
    // Probar plantilla Meta
    await testMetaTemplate();
    
    // Probar mensaje interactivo  
    await testInteractiveMessage();
    
    console.log('\\n📋 RESUMEN:');
    console.log('1. Plantilla Meta: Requiere aprobación en Meta Business Manager');
    console.log('2. Mensaje Interactivo: Funciona inmediatamente'); 
    console.log('3. Para activar en bot: Cambiar useMetaTemplate = true en app.ts');
    console.log('\\n📖 Ver PLANTILLAS-CATALOGO-META.md para guía completa');
}

// Ejecutar si es llamado directamente
main().catch(console.error);

export { testMetaTemplate, testInteractiveMessage };
