/**
 * PRUEBA SIN COMPONENTES - MÉTODO META 2026
 * 
 * Para plantillas de catálogo con texto fijo
 */

import 'dotenv/config';

async function testCatalogWithoutComponents() {
    console.log('🚀 PROBANDO CATÁLOGO SIN COMPONENTES (MÉTODO 2026)\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const phoneNumberId = process.env.NUMBER_ID;
    
    // Payload SIN componentes para plantillas de texto fijo
    const payloadWithoutComponents = {
        messaging_product: "whatsapp",
        to: "56936499908",
        type: "template",
        template: {
            name: "ccatalogo_todomarket",
            language: {
                code: "es_CL"
            }
            // NO incluir components para plantillas de texto fijo
        }
    };
    
    console.log('📦 PAYLOAD SIN COMPONENTES:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(JSON.stringify(payloadWithoutComponents, null, 2));
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    try {
        console.log('📨 ENVIANDO MENSAJE SIN COMPONENTES...');
        
        const sendUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        
        const response = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payloadWithoutComponents)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('🎉 ¡ÉXITO COMPLETO! CATÁLOGO ENVIADO');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`✅ Message ID: ${result.messages[0].id}`);
            console.log(`✅ Status: ${result.messages[0].message_status}`);
            console.log(`✅ WAMID: ${result.messages[0].id}`);
            console.log('');
            console.log('📱 VERIFICA TU WHATSAPP:');
            console.log(`   📞 Número: 56936499908`);
            console.log(`   💬 Mensaje: "Catalgo con todos Nuestros productos"`);
            console.log(`   🔗 Botón: "View catalog"`);
            console.log(`   📦 Al presionar debería mostrar los productos`);
            console.log('');
            console.log('🎯 PRÓXIMO PASO:');
            console.log('   ✅ Actualizar meta-templates.ts');
            console.log('   ✅ Desplegar a Railway');
            console.log('   ✅ Probar con usuarios reales');
            
        } else {
            console.log('❌ ERROR PERSISTENTE:');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`Status: ${response.status}`);
            console.log('Respuesta:');
            console.log(JSON.stringify(result, null, 2));
            
            if (result.error && result.error.code) {
                console.log('\n🔍 ANÁLISIS ADICIONAL:');
                
                switch (result.error.code) {
                    case 131008:
                        console.log('💡 Este error indica que Meta cambió los requerimientos');
                        console.log('   Posibles soluciones:');
                        console.log('   1. La plantilla podría necesitar re-aprobación');
                        console.log('   2. Meta podría haber cambiado la API para catálogos');
                        console.log('   3. Podría ser un problema temporal de Meta');
                        break;
                        
                    case 80007:
                        console.log('💡 El catálogo no está conectado a WhatsApp Business');
                        console.log('   Ir a Meta Business Manager y reconectar');
                        break;
                        
                    default:
                        console.log('💡 Error no identificado - revisar documentación Meta');
                }
            }
        }
        
    } catch (error) {
        console.error('💥 Error en envío:', error);
    }
    
    // También probar con método de mensaje interactivo como respaldo
    console.log('\n📱 MÉTODO ALTERNATIVO: MENSAJE INTERACTIVO DE CATÁLOGO...');
    
    const interactivePayload = {
        messaging_product: "whatsapp",
        to: "56936499908",
        type: "interactive",
        interactive: {
            type: "catalog_message",
            body: {
                text: "Explora nuestro catálogo de productos TodoMarket"
            },
            footer: {
                text: "Minimarket TodoMarket"
            },
            action: {
                name: "catalog_message",
                parameters: {
                    thumbnail_product_retailer_id: "26372101062376689" // ID del producto Papas Kryzpo
                }
            }
        }
    };
    
    console.log('📦 PAYLOAD INTERACTIVO:');
    console.log(JSON.stringify(interactivePayload, null, 2));
    
    try {
        const sendUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        
        const altResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(interactivePayload)
        });
        
        const altResult = await altResponse.json();
        
        if (altResponse.ok) {
            console.log('\n✅ MÉTODO ALTERNATIVO EXITOSO:');
            console.log(`Message ID: ${altResult.messages[0].id}`);
        } else {
            console.log('\n❌ Método alternativo también falló:');
            console.log(JSON.stringify(altResult, null, 2));
        }
        
    } catch (error) {
        console.log('💥 Error en método alternativo:', error);
    }
}

testCatalogWithoutComponents().catch(console.error);
