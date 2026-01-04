/**
 * PRUEBA RÁPIDA DEL CATÁLOGO CORREGIDO
 * 
 * Usa el método que confirmamos que funciona
 */

import 'dotenv/config';

async function quickCatalogTest() {
    console.log('🧪 PRUEBA RÁPIDA DEL CATÁLOGO CORREGIDO\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const phoneNumberId = process.env.NUMBER_ID;
    const testNumber = "56936499908"; // Número de prueba
    
    try {
        // Usar el método exacto que funcionó en el diagnóstico
        const catalogPayload = {
            messaging_product: "whatsapp",
            to: testNumber,
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🛒 TodoMarket - Minimarket\n\n📦 Productos disponibles:\n• Papas Kryzpo - $2.400\n• Queso Llanero - $10.500\n\n👇 Presiona para ver el catálogo completo"
                },
                footer: {
                    text: "Minimarket TodoMarket"
                },
                action: {
                    name: "catalog_message",
                    parameters: {
                        thumbnail_product_retailer_id: "8b9dwc6jus" // Producto confirmado
                    }
                }
            }
        };
        
        console.log('📨 Enviando catálogo corregido...');
        
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(catalogPayload)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('🎉 ¡CATÁLOGO ENVIADO EXITOSAMENTE!');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`✅ Message ID: ${result.messages[0].id}`);
            console.log(`✅ WAMID: ${result.messages[0].id}`);
            console.log('');
            console.log('📱 VERIFICA TU WHATSAPP:');
            console.log(`   📞 Número: ${testNumber}`);
            console.log(`   💬 Deberías ver el mensaje con botón del catálogo`);
            console.log(`   🔗 Al presionar "Ver catálogo" deberías ver los productos`);
            console.log('');
            console.log('✅ ¡EL PROBLEMA ESTÁ RESUELTO!');
            console.log('');
            console.log('🚀 PRÓXIMOS PASOS:');
            console.log('1. Probar con tu número real');
            console.log('2. Actualizar el código en app.ts con este método');
            console.log('3. Desplegar a Railway');
            console.log('4. Confirmar que funciona en producción');
            
        } else {
            console.log('❌ ERROR EN ENVÍO:');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`Status: ${response.status}`);
            console.log('Respuesta:', JSON.stringify(result, null, 2));
        }
        
    } catch (error) {
        console.error('💥 Error en prueba rápida:', error);
    }
}

quickCatalogTest().catch(console.error);
