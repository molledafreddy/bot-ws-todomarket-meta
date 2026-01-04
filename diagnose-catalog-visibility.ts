#!/usr/bin/env node
/**
 * 🔍 DIAGNÓSTICO AVANZADO DE VISIBILIDAD DEL CATÁLOGO
 * 
 * Este script diagnostica por qué el catálogo se envía exitosamente 
 * pero los productos no son visibles para el usuario final.
 */

// Usar fetch nativo disponible en Node.js moderno

// Configuración desde variables de entorno
const ACCESS_TOKEN = process.env.JWT_TOKEN;
const PHONE_NUMBER_ID = process.env.NUMBER_ID;
const BUSINESS_ID = process.env.BUSINESS_ID || '1349962220108819';
const CATALOG_ID = process.env.CATALOG_ID || '817382327367357';

console.log('🔍 === DIAGNÓSTICO DE VISIBILIDAD DEL CATÁLOGO ===');
console.log('📋 Configuración:');
console.log(`  - Phone Number ID: ${PHONE_NUMBER_ID}`);
console.log(`  - Business ID: ${BUSINESS_ID}`);
console.log(`  - Catalog ID: ${CATALOG_ID}`);
console.log(`  - Token disponible: ${ACCESS_TOKEN ? '✅ Sí' : '❌ No'}`);

async function checkCatalogConnection() {
    console.log('\n🔗 === VERIFICANDO CONEXIÓN CATÁLOGO-WHATSAPP ===');
    
    try {
        // 1. Verificar que el catálogo esté conectado al número de WhatsApp
        const connectionUrl = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/whatsapp_commerce_settings`;
        
        console.log('📡 Consultando configuración de comercio...');
        
        const response = await fetch(connectionUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Configuración de comercio obtenida:');
            console.log(JSON.stringify(data, null, 2));
            
            // Verificar si hay un catálogo conectado
            if (data.catalog_id) {
                console.log(`✅ Catálogo conectado: ${data.catalog_id}`);
                
                if (data.catalog_id === CATALOG_ID) {
                    console.log('✅ El catálogo configurado coincide con el esperado');
                } else {
                    console.log(`⚠️ DISCREPANCIA: Esperado ${CATALOG_ID}, encontrado ${data.catalog_id}`);
                }
            } else {
                console.log('❌ NO HAY CATÁLOGO CONECTADO - Este es probablemente el problema');
            }
            
        } else {
            const errorText = await response.text();
            console.log(`❌ Error consultando comercio: ${response.status}`);
            console.log('📄 Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error verificando conexión:', error.message);
    }
}

async function checkCatalogStatus() {
    console.log('\n📦 === VERIFICANDO ESTADO DEL CATÁLOGO ===');
    
    try {
        // Verificar el estado general del catálogo
        const catalogUrl = `https://graph.facebook.com/v18.0/${CATALOG_ID}`;
        const catalogParams = {
            fields: 'id,name,business,product_count,vertical'
        };
        
        const catalogQueryString = new URLSearchParams({
            ...catalogParams,
            access_token: ACCESS_TOKEN
        }).toString();
        
        const catalogFullUrl = `${catalogUrl}?${catalogQueryString}`;
        
        console.log('📡 Consultando estado del catálogo...');
        
        const response = await fetch(catalogFullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Estado del catálogo:');
            console.log(`  - ID: ${data.id}`);
            console.log(`  - Nombre: ${data.name}`);
            console.log(`  - Vertical: ${data.vertical}`);
            console.log(`  - Productos: ${data.product_count || 'No disponible'}`);
            console.log(`  - Business: ${data.business ? data.business.id : 'No disponible'}`);
            
            if (data.product_count === 0) {
                console.log('❌ PROBLEMA: El catálogo no tiene productos');
            } else {
                console.log(`✅ Catálogo tiene ${data.product_count} productos`);
            }
            
        } else {
            const errorText = await response.text();
            console.log(`❌ Error consultando catálogo: ${response.status}`);
            console.log('📄 Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error verificando catálogo:', error.message);
    }
}

async function checkCatalogProducts() {
    console.log('\n🛒 === VERIFICANDO PRODUCTOS EN EL CATÁLOGO ===');
    
    try {
        const productsUrl = `https://graph.facebook.com/v18.0/${CATALOG_ID}/products`;
        const productsParams = {
            fields: 'id,name,description,price,currency,retailer_id,availability,condition,visibility',
            limit: '10'
        };
        
        const productsQueryString = new URLSearchParams({
            ...productsParams,
            access_token: ACCESS_TOKEN
        }).toString();
        
        const productsFullUrl = `${productsUrl}?${productsQueryString}`;
        
        console.log('📡 Consultando productos del catálogo...');
        
        const response = await fetch(productsFullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                console.log(`✅ Encontrados ${data.data.length} productos:`);
                
                data.data.forEach((product, index) => {
                    console.log(`\n📦 Producto ${index + 1}:`);
                    console.log(`  - ID: ${product.id}`);
                    console.log(`  - Retailer ID: ${product.retailer_id}`);
                    console.log(`  - Nombre: ${product.name}`);
                    console.log(`  - Precio: ${product.price} ${product.currency}`);
                    console.log(`  - Disponibilidad: ${product.availability}`);
                    console.log(`  - Visibilidad: ${product.visibility || 'No especificada'}`);
                    
                    // Verificar problemas comunes
                    if (product.availability !== 'in stock') {
                        console.log('  ⚠️ PROBLEMA: Producto no está "in stock"');
                    }
                    
                    if (product.visibility === 'hidden') {
                        console.log('  ❌ PROBLEMA: Producto está oculto');
                    }
                    
                    if (!product.price || product.price === '0') {
                        console.log('  ⚠️ ADVERTENCIA: Producto sin precio');
                    }
                });
                
            } else {
                console.log('❌ PROBLEMA CRÍTICO: No se encontraron productos en el catálogo');
                console.log('📝 Posibles causas:');
                console.log('  - Los productos no están publicados');
                console.log('  - Los productos están ocultos');
                console.log('  - Problemas de sincronización');
            }
            
        } else {
            const errorText = await response.text();
            console.log(`❌ Error consultando productos: ${response.status}`);
            console.log('📄 Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error verificando productos:', error.message);
    }
}

async function testCatalogMessage() {
    console.log('\n📱 === PROBANDO MENSAJE DE CATÁLOGO ALTERNATIVO ===');
    
    try {
        // Probar con mensaje de catálogo más específico
        const testPayload = {
            messaging_product: "whatsapp",
            to: "56936499908", // Tu número de prueba
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🛒 Catálogo TodoMarket\n\n📦 Productos disponibles para compra inmediata.\n\n👇 Presiona para explorar nuestro catálogo"
                },
                footer: {
                    text: "TodoMarket - Minimarket"
                },
                action: {
                    name: "catalog_message",
                    parameters: {
                        thumbnail_product_retailer_id: "8b9dwc6jus"
                    }
                }
            }
        };
        
        console.log('📡 Enviando mensaje de catálogo de prueba...');
        
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
        } else {
            const errorText = await response.text();
            console.log(`❌ Error enviando mensaje de prueba: ${response.status}`);
            console.log('📄 Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error enviando mensaje de prueba:', error.message);
    }
}

async function checkBusinessVerification() {
    console.log('\n🏢 === VERIFICANDO ESTADO DEL NEGOCIO ===');
    
    try {
        const businessUrl = `https://graph.facebook.com/v18.0/${BUSINESS_ID}`;
        const businessParams = {
            fields: 'id,name,verification_status,permitted_tasks'
        };
        
        const businessQueryString = new URLSearchParams({
            ...businessParams,
            access_token: ACCESS_TOKEN
        }).toString();
        
        const businessFullUrl = `${businessUrl}?${businessQueryString}`;
        
        console.log('📡 Consultando estado del negocio...');
        
        const response = await fetch(businessFullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Estado del negocio:');
            console.log(`  - ID: ${data.id}`);
            console.log(`  - Nombre: ${data.name}`);
            console.log(`  - Estado de verificación: ${data.verification_status || 'No disponible'}`);
            
            if (data.permitted_tasks) {
                console.log('  - Tareas permitidas:');
                data.permitted_tasks.forEach(task => {
                    console.log(`    - ${task}`);
                });
            }
            
            if (data.verification_status !== 'verified') {
                console.log('⚠️ ADVERTENCIA: El negocio no está completamente verificado');
            }
            
        } else {
            const errorText = await response.text();
            console.log(`❌ Error consultando negocio: ${response.status}`);
            console.log('📄 Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error verificando negocio:', error.message);
    }
}

async function generateRecommendations() {
    console.log('\n💡 === RECOMENDACIONES Y SOLUCIONES ===');
    
    console.log('📋 Pasos para resolver problemas de visibilidad:');
    console.log('');
    console.log('1. 🔗 CONEXIÓN DEL CATÁLOGO:');
    console.log('   - Ve a Meta Business Manager');
    console.log('   - Commerce Manager > Catálogos');
    console.log('   - Verifica que el catálogo esté conectado a WhatsApp');
    console.log('   - URL: https://business.facebook.com/commerce/catalogs');
    console.log('');
    console.log('2. 📦 PRODUCTOS:');
    console.log('   - Todos los productos deben estar "in stock"');
    console.log('   - Productos deben tener precios válidos');
    console.log('   - Productos no deben estar ocultos');
    console.log('');
    console.log('3. 🏢 VERIFICACIÓN DEL NEGOCIO:');
    console.log('   - El negocio debe estar verificado en Meta');
    console.log('   - Verifica el estado en Business Manager');
    console.log('');
    console.log('4. 🔄 SINCRONIZACIÓN:');
    console.log('   - Los cambios pueden tardar hasta 24 horas');
    console.log('   - Intenta desconectar y reconectar el catálogo');
    console.log('');
    console.log('5. 📱 PRUEBAS ALTERNATIVAS:');
    console.log('   - Prueba desde diferentes números');
    console.log('   - Verifica en Meta Business Manager que el catálogo aparece');
    console.log('   - Usa el simulador de WhatsApp Business API');
}

async function runFullDiagnosis() {
    console.log('🚀 Iniciando diagnóstico completo...\n');
    
    if (!ACCESS_TOKEN) {
        console.log('❌ ERROR: No se encontró ACCESS_TOKEN');
        return;
    }
    
    await checkCatalogConnection();
    await checkCatalogStatus();
    await checkCatalogProducts();
    await checkBusinessVerification();
    await testCatalogMessage();
    await generateRecommendations();
    
    console.log('\n✅ === DIAGNÓSTICO COMPLETADO ===');
    console.log('📋 Revisa los resultados anteriores para identificar el problema.');
    console.log('📞 Si necesitas ayuda adicional, contacta al soporte de Meta Business.');
}

// Ejecutar diagnóstico si se llama directamente
if (require.main === module) {
    runFullDiagnosis().catch(console.error);
}

module.exports = {
    checkCatalogConnection,
    checkCatalogStatus,
    checkCatalogProducts,
    testCatalogMessage,
    runFullDiagnosis
};
