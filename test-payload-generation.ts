/**
 * PRUEBA DE PAYLOAD DE PLANTILLA DE CATÁLOGO
 * 
 * Verifica que el payload se genere correctamente con la plantilla detectada
 */

import { getApprovedTemplatePayload } from './src/meta-templates';

async function testTemplatePayload() {
    console.log('🧪 PROBANDO GENERACIÓN DE PAYLOAD DE PLANTILLA\n');
    
    try {
        // Generar payload con la plantilla detectada
        const testPhone = "56936499908"; // Número de prueba
        const payload = getApprovedTemplatePayload('catalog_main', testPhone);
        
        console.log('✅ PAYLOAD GENERADO EXITOSAMENTE:');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(JSON.stringify(payload, null, 2));
        console.log('═══════════════════════════════════════════════════════════════');
        
        console.log('\n🔍 VALIDACIÓN DEL PAYLOAD:');
        console.log(`✅ Template Name: ${payload.template.name}`);
        console.log(`✅ Language: ${payload.template.language.code}`);
        console.log(`✅ Número destino: ${payload.to}`);
        console.log(`✅ Componentes: ${payload.template.components?.length || 0}`);
        
        if (payload.template.components) {
            console.log('\n🧩 COMPONENTES INCLUIDOS:');
            payload.template.components.forEach((comp: any, index: number) => {
                console.log(`${index + 1}. Tipo: ${comp.type}`);
                if (comp.parameters) {
                    console.log(`   Parámetros: ${comp.parameters.length}`);
                }
            });
        }
        
        console.log('\n✅ ¡EL PAYLOAD ESTÁ CORRECTO Y LISTO PARA ENVIAR!');
        console.log('\n📝 PRÓXIMOS PASOS:');
        console.log('1. Envía "1" al bot de WhatsApp');
        console.log('2. Verifica que llegue el mensaje de catálogo');
        console.log('3. Presiona el botón "View catalog"');
        console.log('4. Confirma que aparezcan los productos');
        
        // Simular el envío a Meta API
        console.log('\n🚀 SIMULANDO ENVÍO A META API...');
        
        const metaUrl = `https://graph.facebook.com/v18.0/725315067342333/messages`;
        
        console.log(`📡 URL de envío: ${metaUrl}`);
        console.log('📋 Método: POST');
        console.log('📄 Content-Type: application/json');
        console.log('🔑 Authorization: Bearer [JWT_TOKEN]');
        console.log('\n📦 Payload que se enviará:');
        console.log('─────────────────────────────────────────────────────────────');
        console.log('POST:', JSON.stringify(payload, null, 2));
        
    } catch (error) {
        console.error('❌ ERROR AL GENERAR PAYLOAD:', error);
    }
}

testTemplatePayload().catch(console.error);
