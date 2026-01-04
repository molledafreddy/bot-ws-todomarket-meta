#!/usr/bin/env node
/**
 * 🔍 DIAGNÓSTICO COMPLETO DEL CATÁLOGO META
 * 
 * Script para identificar y solucionar problemas de catálogo
 */

// Cargar variables de entorno
require('dotenv').config();

console.log('🔍 === DIAGNÓSTICO COMPLETO DEL CATÁLOGO ===');

// Configuración
const ACCESS_TOKEN = process.env.JWT_TOKEN;
const PHONE_NUMBER_ID = process.env.NUMBER_ID;
const BUSINESS_ID = process.env.BUSINESS_ID || '1349962220108819';

console.log('📋 Configuración detectada:');
console.log(`  - Access Token: ${ACCESS_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
console.log(`  - Phone Number ID: ${PHONE_NUMBER_ID || '❌ Faltante'}`);
console.log(`  - Business ID: ${BUSINESS_ID}`);

if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.log('❌ Faltan variables de entorno críticas');
    console.log('🔧 Verifica que .env tenga JWT_TOKEN y NUMBER_ID');
    process.exit(1);
}

async function step1_verifyWhatsAppBusiness() {
    console.log('\n📱 === PASO 1: VERIFICAR WHATSAPP BUSINESS ===');
    
    try {
        const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}`;
        const params = new URLSearchParams({
            fields: 'id,verified_name,display_phone_number,quality_rating,messaging_limit_tier',
            access_token: ACCESS_TOKEN
        });
        
        const response = await fetch(`${url}?${params}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ WhatsApp Business verificado:');
            console.log(`  - ID: ${data.id}`);
            console.log(`  - Nombre: ${data.verified_name}`);
            console.log(`  - Teléfono: ${data.display_phone_number}`);
            console.log(`  - Calidad: ${data.quality_rating}`);
            console.log(`  - Límite: ${data.messaging_limit_tier}`);
            return true;
        } else {
            console.log('❌ Error verificando WhatsApp Business');
            const error = await response.text();
            console.log('Error:', error);
            return false;
        }
    } catch (error) {
        console.log('❌ Error en verificación:', error.message);
        return false;
    }
}

async function step2_checkCommerceSettings() {
    console.log('\n🛒 === PASO 2: VERIFICAR CONFIGURACIÓN DE COMERCIO ===');
    
    try {
        const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/whatsapp_commerce_settings`;
        const params = new URLSearchParams({
            access_token: ACCESS_TOKEN
        });
        
        const response = await fetch(`${url}?${params}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Configuración de comercio:');
            console.log(JSON.stringify(data, null, 2));
            
            if (data.catalog_id) {
                console.log(`✅ Catálogo conectado: ${data.catalog_id}`);
                return data.catalog_id;
            } else {
                console.log('❌ NO HAY CATÁLOGO CONECTADO - ESTE ES EL PROBLEMA');
                console.log('🔧 Solución: Conectar catálogo en Meta Business Manager');
                return null;
            }
        } else {
            console.log('❌ Error obteniendo configuración de comercio');
            const error = await response.text();
            console.log('Error:', error);
            return null;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return null;
    }
}

async function step3_listBusinessCatalogs() {
    console.log('\n📋 === PASO 3: LISTAR CATÁLOGOS DISPONIBLES ===');
    
    try {
        const url = `https://graph.facebook.com/v18.0/${BUSINESS_ID}/owned_product_catalogs`;
        const params = new URLSearchParams({
            access_token: ACCESS_TOKEN,
            fields: 'id,name,product_count,vertical'
        });
        
        const response = await fetch(`${url}?${params}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Catálogos disponibles:');
            
            if (data.data && data.data.length > 0) {
                data.data.forEach((catalog, index) => {
                    console.log(`\n📦 Catálogo ${index + 1}:`);
                    console.log(`  - ID: ${catalog.id}`);
                    console.log(`  - Nombre: ${catalog.name}`);
                    console.log(`  - Productos: ${catalog.product_count || 'No disponible'}`);
                    console.log(`  - Vertical: ${catalog.vertical}`);
                });
                
                return data.data;
            } else {
                console.log('❌ No se encontraron catálogos');
                return [];
            }
        } else {
            console.log('❌ Error listando catálogos');
            const error = await response.text();
            console.log('Error:', error);
            return [];
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return [];
    }
}

async function step4_connectCatalogToWhatsApp(catalogId) {
    console.log(`\n🔗 === PASO 4: CONECTAR CATÁLOGO ${catalogId} A WHATSAPP ===`);
    
    try {
        const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/whatsapp_commerce_settings`;
        
        const payload = {
            catalog_id: catalogId,
            is_catalog_visible: true
        };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Catálogo conectado exitosamente:');
            console.log(JSON.stringify(result, null, 2));
            return true;
        } else {
            console.log('❌ Error conectando catálogo');
            const error = await response.text();
            console.log('Error:', error);
            return false;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return false;
    }
}

async function step5_testCatalogMessage() {
    console.log('\n📱 === PASO 5: PROBAR MENSAJE DE CATÁLOGO ===');
    
    try {
        const testPayload = {
            messaging_product: "whatsapp",
            to: "56936499908", // Tu número de prueba
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🛒 Prueba de catálogo corregido\n\nEste catálogo debería funcionar ahora:"
                },
                footer: {
                    text: "TodoMarket - Test"
                },
                action: {
                    name: "catalog_message"
                }
            }
        };
        
        const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Mensaje de prueba enviado exitosamente');
            console.log(`📱 Message ID: ${result.messages[0].id}`);
            console.log('📋 Revisa WhatsApp para ver si el catálogo se muestra correctamente');
            return true;
        } else {
            const error = await response.text();
            console.log('❌ Error enviando mensaje de prueba');
            console.log('Error:', error);
            return false;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return false;
    }
}

async function runDiagnosisAndFix() {
    console.log('🚀 Iniciando diagnóstico y reparación del catálogo...\n');
    
    // Paso 1: Verificar WhatsApp Business
    const step1 = await step1_verifyWhatsAppBusiness();
    if (!step1) {
        console.log('\n❌ FALLO EN PASO 1 - No se puede continuar');
        return;
    }
    
    // Paso 2: Verificar configuración de comercio
    const currentCatalogId = await step2_checkCommerceSettings();
    
    // Paso 3: Listar catálogos disponibles
    const availableCatalogs = await step3_listBusinessCatalogs();
    
    if (availableCatalogs.length === 0) {
        console.log('\n❌ No hay catálogos disponibles');
        console.log('🔧 Solución: Crear un catálogo en Meta Business Manager');
        console.log('🔗 URL: https://business.facebook.com/commerce/catalogs');
        return;
    }
    
    // Si no hay catálogo conectado, conectar el primero disponible
    if (!currentCatalogId && availableCatalogs.length > 0) {
        console.log('\n🔧 Conectando catálogo automáticamente...');
        const catalogToConnect = availableCatalogs[0].id;
        const step4 = await step4_connectCatalogToWhatsApp(catalogToConnect);
        
        if (step4) {
            console.log(`✅ Catálogo ${catalogToConnect} conectado exitosamente`);
            
            // Esperar un momento para que la configuración se propague
            console.log('⏳ Esperando 10 segundos para sincronización...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Probar mensaje de catálogo
            await step5_testCatalogMessage();
        }
    } else if (currentCatalogId) {
        console.log(`\nℹ️ Ya hay un catálogo conectado: ${currentCatalogId}`);
        console.log('🔄 Probando mensaje de catálogo directamente...');
        await step5_testCatalogMessage();
    }
    
    console.log('\n✅ === DIAGNÓSTICO COMPLETADO ===');
    console.log('📋 Revisa los resultados anteriores');
    console.log('📱 Si enviamos un mensaje de prueba, revisa tu WhatsApp');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runDiagnosisAndFix().catch(console.error);
}

module.exports = {
    step1_verifyWhatsAppBusiness,
    step2_checkCommerceSettings,
    step3_listBusinessCatalogs,
    step4_connectCatalogToWhatsApp,
    step5_testCatalogMessage,
    runDiagnosisAndFix
};
