/**
 * 🔧 REPARACIÓN DIRECTA DEL CATÁLOGO
 * 
 * Script simplificado para solucionar problemas de catálogo
 */

// Cargar variables de entorno
require('dotenv').config();

console.log('🔧 === REPARACIÓN DIRECTA DEL CATÁLOGO ===');

// Datos de configuración desde variables de entorno
const ACCESS_TOKEN = process.env.JWT_TOKEN;
const PHONE_NUMBER_ID = process.env.NUMBER_ID || "725315067342333";
const BUSINESS_ID = "1349962220108819";

console.log('📋 Configuración:');
console.log(`  - Phone Number ID: ${PHONE_NUMBER_ID}`);
console.log(`  - Business ID: ${BUSINESS_ID}`);
console.log(`  - Token: ${ACCESS_TOKEN.substring(0, 20)}...`);

async function quickCatalogFix() {
    console.log('\n🔧 === SOLUCIÓN DIRECTA ===');
    
    try {
        // 1. Verificar configuración de comercio actual
        console.log('📱 Verificando configuración actual...');
        
        const commerceUrl = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/whatsapp_commerce_settings?access_token=${ACCESS_TOKEN}`;
        
        const commerceResponse = await fetch(commerceUrl);
        
        if (commerceResponse.ok) {
            const commerceData = await commerceResponse.json();
            console.log('✅ Configuración actual:');
            console.log(JSON.stringify(commerceData, null, 2));
            
            if (commerceData.catalog_id) {
                console.log(`✅ YA HAY CATÁLOGO CONECTADO: ${commerceData.catalog_id}`);
                console.log('🔧 El problema puede ser de visibilidad de productos');
                
                // Probar envío de catálogo
                await testCatalogSend();
                return;
            } else {
                console.log('❌ NO HAY CATÁLOGO CONECTADO');
            }
        } else {
            console.log('❌ Error verificando comercio');
            const error = await commerceResponse.text();
            console.log('Error:', error);
        }
        
        // 2. Listar catálogos disponibles
        console.log('\n📋 Listando catálogos disponibles...');
        
        const catalogsUrl = `https://graph.facebook.com/v18.0/${BUSINESS_ID}/owned_product_catalogs?access_token=${ACCESS_TOKEN}&fields=id,name,product_count`;
        
        const catalogsResponse = await fetch(catalogsUrl);
        
        if (catalogsResponse.ok) {
            const catalogsData = await catalogsResponse.json();
            console.log('✅ Catálogos encontrados:');
            
            if (catalogsData.data && catalogsData.data.length > 0) {
                catalogsData.data.forEach((catalog, index) => {
                    console.log(`  ${index + 1}. ${catalog.name} (ID: ${catalog.id}) - ${catalog.product_count || 0} productos`);
                });
                
                // Conectar el primer catálogo
                const firstCatalog = catalogsData.data[0];
                console.log(`\n🔗 Conectando catálogo: ${firstCatalog.name}`);
                
                await connectCatalog(firstCatalog.id);
                
            } else {
                console.log('❌ No hay catálogos disponibles');
                console.log('🔧 Solución: Crear catálogo en Meta Business Manager');
            }
        } else {
            console.log('❌ Error listando catálogos');
            const error = await catalogsResponse.text();
            console.log('Error:', error);
        }
        
    } catch (error) {
        console.log('❌ Error en reparación:', error.message);
    }
}

async function connectCatalog(catalogId) {
    console.log(`\n🔗 Conectando catálogo ${catalogId}...`);
    
    try {
        const connectUrl = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/whatsapp_commerce_settings`;
        
        const connectPayload = {
            catalog_id: catalogId,
            is_catalog_visible: true
        };
        
        const connectResponse = await fetch(connectUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(connectPayload)
        });
        
        if (connectResponse.ok) {
            const result = await connectResponse.json();
            console.log('✅ CATÁLOGO CONECTADO EXITOSAMENTE:');
            console.log(JSON.stringify(result, null, 2));
            
            console.log('\n⏳ Esperando 15 segundos para sincronización...');
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            // Probar envío
            await testCatalogSend();
            
        } else {
            console.log('❌ Error conectando catálogo');
            const error = await connectResponse.text();
            console.log('Error:', error);
        }
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

async function testCatalogSend() {
    console.log('\n📱 === PRUEBA DE ENVÍO DE CATÁLOGO ===');
    
    try {
        const testPayload = {
            messaging_product: "whatsapp",
            to: "56936499908", // Tu número
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🛒 PRUEBA DE CATÁLOGO REPARADO\n\nEste catálogo debería funcionar correctamente ahora.\n\n👇 Presiona para ver productos:"
                },
                footer: {
                    text: "TodoMarket - Catálogo Reparado"
                },
                action: {
                    name: "catalog_message"
                }
            }
        };
        
        const sendUrl = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
        
        const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });
        
        if (sendResponse.ok) {
            const result = await sendResponse.json();
            console.log('✅ MENSAJE DE PRUEBA ENVIADO EXITOSAMENTE');
            console.log(`📱 Message ID: ${result.messages[0].id}`);
            console.log('\n📋 RESULTADO ESPERADO:');
            console.log('  - Revisa tu WhatsApp');
            console.log('  - Deberías ver el catálogo con productos');
            console.log('  - Podrás seleccionar productos');
            console.log('  - Se generarán pedidos automáticamente');
            
        } else {
            console.log('❌ Error enviando mensaje de prueba');
            const error = await sendResponse.text();
            console.log('Error:', error);
        }
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

// Ejecutar reparación
console.log('🚀 Iniciando reparación automática del catálogo...\n');
quickCatalogFix().catch(console.error);
