/**
 * SCRIPT PARA DETECTAR PLANTILLA APROBADA DE META
 * 
 * Este script te ayuda a encontrar el nombre exacto de tu plantilla aprobada
 * y verificar que esté configurada correctamente
 */

import 'dotenv/config';
import { 
    detectTemplateNameFromMeta, 
    getAllBusinessTemplates,
    checkTemplateStatus,
    BUSINESS_ID,
    TEMPLATE_ID 
} from './src/meta-templates';

async function detectAndTestTemplate() {
    console.log('🚀 INICIANDO DETECCIÓN DE PLANTILLA META\n');
    
    // Verificar variables de entorno
    const accessToken = process.env.JWT_TOKEN;
    const phoneNumberId = process.env.NUMBER_ID;
    
    if (!accessToken) {
        console.error('❌ JWT_TOKEN no configurado en variables de entorno');
        return;
    }
    
    if (!phoneNumberId) {
        console.error('❌ NUMBER_ID no configurado en variables de entorno');
        return;
    }
    
    console.log('✅ Variables de entorno configuradas:');
    console.log(`📋 Business ID: ${BUSINESS_ID}`);
    console.log(`📋 Template ID: ${TEMPLATE_ID}`);
    console.log(`📋 Phone Number ID: ${phoneNumberId}`);
    console.log(`📋 Access Token: ${accessToken.substring(0, 20)}...`);
    console.log('');
    
    try {
        // Paso 1: Obtener todas las plantillas del negocio
        console.log('📋 PASO 1: Obteniendo todas las plantillas del negocio...');
        const allTemplates = await getAllBusinessTemplates(accessToken);
        
        if (allTemplates.length === 0) {
            console.log('⚠️ No se encontraron plantillas en el negocio');
            console.log('💡 Asegúrate de que:');
            console.log('  - El token tenga permisos whatsapp_business_messaging');
            console.log('  - El BUSINESS_ID sea correcto');
            console.log('  - Tengas plantillas creadas en Meta Business Manager');
            return;
        }
        
        // Paso 2: Buscar plantillas aprobadas relacionadas con catálogo
        console.log('\n🔍 PASO 2: Buscando plantillas de catálogo aprobadas...');
        const catalogTemplates = allTemplates.filter(template => 
            template.status === 'APPROVED' && 
            (template.name.toLowerCase().includes('catalog') ||
             template.name.toLowerCase().includes('catalogo') ||
             template.name.toLowerCase().includes('todomarket') ||
             template.name.toLowerCase().includes('producto'))
        );
        
        if (catalogTemplates.length > 0) {
            console.log(`✅ Encontradas ${catalogTemplates.length} plantillas de catálogo aprobadas:`);
            catalogTemplates.forEach((template, index) => {
                console.log(`${index + 1}. Nombre: "${template.name}"`);
                console.log(`   ID: ${template.id}`);
                console.log(`   Estado: ${template.status}`);
                console.log(`   Categoría: ${template.category}`);
                console.log(`   Idioma: ${template.language}`);
                console.log('   ---');
            });
            
            // Recomendar la primera plantilla encontrada
            const recommendedTemplate = catalogTemplates[0];
            console.log(`💡 RECOMENDACIÓN: Usar la plantilla "${recommendedTemplate.name}"`);
            console.log(`📝 Actualizar en meta-templates.ts el campo "name" con: "${recommendedTemplate.name}"`);
            
        } else {
            console.log('❌ No se encontraron plantillas de catálogo aprobadas');
            console.log('📋 Plantillas disponibles:');
            allTemplates.forEach((template, index) => {
                console.log(`${index + 1}. ${template.name} (${template.status})`);
            });
        }
        
        // Paso 3: Auto-detectar plantilla
        console.log('\n🤖 PASO 3: Intentando auto-detectar plantilla...');
        const detectedTemplate = await detectTemplateNameFromMeta(accessToken);
        
        if (detectedTemplate) {
            console.log(`🎯 Plantilla detectada automáticamente: "${detectedTemplate}"`);
        } else {
            console.log('⚠️ No se pudo auto-detectar la plantilla');
        }
        
        // Paso 4: Generar payload de ejemplo
        if (catalogTemplates.length > 0) {
            console.log('\n📨 PASO 4: Ejemplo de payload para Meta API...');
            
            const examplePayload = {
                messaging_product: "whatsapp",
                to: "56936499908", // Número de ejemplo
                type: "template",
                template: {
                    name: catalogTemplates[0].name, // Usar la primera plantilla encontrada
                    language: {
                        code: catalogTemplates[0].language || "es_CL"
                    },
                    components: [
                        {
                            type: "header",
                            parameters: [
                                {
                                    type: "text",
                                    text: "TodoMarket"
                                }
                            ]
                        },
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: "Minimarket de barrio"
                                }
                            ]
                        }
                    ]
                }
            };
            
            console.log('📝 Payload de ejemplo:');
            console.log(JSON.stringify(examplePayload, null, 2));
            
            console.log('\n🔧 Para usar este payload en el bot:');
            console.log(`1. Actualizar meta-templates.ts con el nombre: "${catalogTemplates[0].name}"`);
            console.log('2. Compilar el proyecto: npm run build');
            console.log('3. Desplegar los cambios');
            console.log('4. Probar enviando "1" al bot');
        }
        
    } catch (error) {
        console.error('💥 Error en la detección:', error);
        
        if (error.message.includes('403')) {
            console.log('\n💡 Error 403 - Permisos insuficientes:');
            console.log('- Verifica que el token tenga permisos whatsapp_business_messaging');
            console.log('- Verifica que el BUSINESS_ID sea correcto');
            console.log('- Regenera el token si es necesario');
        }
    }
}

// Ejecutar detección
detectAndTestTemplate().catch(console.error);
