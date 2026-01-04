/**
 * PRUEBA FINAL DE ENVÍO DE CATÁLOGO CON PAYLOAD CORREGIDO
 */

import { getApprovedTemplatePayload } from './src/meta-templates';
import 'dotenv/config';

async function testFinalCatalogSend() {
    console.log('🚀 PRUEBA FINAL DE CATÁLOGO - PAYLOAD CORREGIDO\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const phoneNumberId = process.env.NUMBER_ID;
    const testNumber = "56936499908"; // Número de prueba
    
    try {
        // Generar payload corregido
        const payload = getApprovedTemplatePayload('catalog_main', testNumber, {
            tienda_nombre: 'TodoMarket'
        });
        
        console.log('✅ PAYLOAD CORREGIDO GENERADO:');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(JSON.stringify(payload, null, 2));
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        // Intentar envío real
        console.log('📨 ENVIANDO MENSAJE DE PRUEBA...');
        
        const sendUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        
        const response = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('🎉 ¡MENSAJE DE CATÁLOGO ENVIADO EXITOSAMENTE!');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`✅ Message ID: ${result.messages[0].id}`);
            console.log(`✅ Status: ${result.messages[0].message_status}`);
            console.log('');
            console.log('📱 VERIFICA TU WHATSAPP:');
            console.log(`   Deberías recibir el mensaje en: ${testNumber}`);
            console.log(`   El mensaje incluirá un botón "View catalog"`);
            console.log(`   Al presionarlo deberías ver los productos`);
            console.log('');
            console.log('🎯 Si funciona en el número de prueba:');
            console.log('   ✅ El problema está resuelto');
            console.log('   ✅ Ahora funciona con números reales');
            console.log('   ✅ Despliega los cambios a Railway');
            
        } else {
            console.log('❌ ERROR EN EL ENVÍO:');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`Status: ${response.status}`);
            console.log('Respuesta completa:');
            console.log(JSON.stringify(result, null, 2));
            
            // Analizar el error
            if (result.error) {
                console.log('\n🔍 ANÁLISIS DEL ERROR:');
                console.log(`Código: ${result.error.code}`);
                console.log(`Tipo: ${result.error.type}`);
                console.log(`Mensaje: ${result.error.message}`);
                
                if (result.error.error_data) {
                    console.log('Detalles adicionales:');
                    console.log(JSON.stringify(result.error.error_data, null, 2));
                }
                
                // Sugerencias específicas
                switch (result.error.code) {
                    case 131008:
                        console.log('\n💡 SOLUCIÓN: El error de parámetros faltantes debería estar resuelto');
                        console.log('   - Verificar que el payload tenga todos los componentes');
                        break;
                    case 131056:
                        console.log('\n💡 SOLUCIÓN: Problema con la plantilla');
                        console.log('   - Verificar que la plantilla esté APROBADA en Meta Business Manager');
                        break;
                    case 132000:
                        console.log('\n💡 SOLUCIÓN: Número no válido');
                        console.log('   - Usar un número real de Chile (+56...)');
                        break;
                }
            }
        }
        
    } catch (error) {
        console.error('💥 Error en la prueba final:', error);
    }
}

testFinalCatalogSend().catch(console.error);
