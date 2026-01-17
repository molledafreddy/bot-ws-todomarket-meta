// VERIFICACIÓN ESPECÍFICA DE CONEXIÓN CATÁLOGO-WHATSAPP
require('dotenv').config();

const https = require('https');

const JWT_TOKEN = process.env.JWT_TOKEN;
const PHONE_NUMBER_ID = process.env.NUMBER_ID;
const BUSINESS_ID = "1349962220108819";

function makeGraphAPIRequest(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.facebook.com',
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(response);
                    } else {
                        reject({ statusCode: res.statusCode, response });
                    }
                } catch (error) {
                    reject({ error: 'Invalid JSON response', data, statusCode: res.statusCode });
                }
            });
        });

        req.on('error', (error) => reject({ error: error.message }));
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

async function checkCatalogConnection() {
    console.log('🔍 === DIAGNÓSTICO ESPECÍFICO: CONEXIÓN CATÁLOGO-WHATSAPP ===');
    console.log('📅 Fecha:', new Date().toLocaleString());
    console.log('');

    // 1. Verificar métodos alternativos para obtener configuración de commerce
    console.log('💼 === VERIFICANDO CONFIGURACIÓN DE COMMERCE (MÉTODOS ALTERNATIVOS) ===');
    
    const commerceEndpoints = [
        `/v18.0/${PHONE_NUMBER_ID}?fields=business_verification_status,business_title,account_mode,status`,
        `/v18.0/${BUSINESS_ID}?fields=name,verification_status,business_account_id`,
        `/v18.0/${BUSINESS_ID}/owned_product_catalogs?fields=name,id,product_count,business`
    ];

    for (const endpoint of commerceEndpoints) {
        try {
            const result = await makeGraphAPIRequest(endpoint);
            console.log(`✅ ${endpoint}:`);
            console.log('   ', JSON.stringify(result, null, 2));
        } catch (error) {
            console.log(`❌ ${endpoint}:`);
            console.log('   ', error.response?.error?.message || error.error || 'Unknown error');
        }
        console.log('');
    }

    // 2. Intentar conectar catálogo específico
    console.log('🔗 === INTENTANDO CONECTAR CATÁLOGO ESPECÍFICO ===');
    
    const catalogIds = ['817382327367357', '1057244946408276']; // Los dos principales
    
    for (const catalogId of catalogIds) {
        try {
            console.log(`🔧 Conectando catálogo ${catalogId}...`);
            
            const connectPayload = {
                catalog_id: catalogId,
                is_catalog_visible: true
            };

            const result = await makeGraphAPIRequest(
                `/v18.0/${PHONE_NUMBER_ID}`, 
                'POST', 
                connectPayload
            );
            
            console.log(`✅ Catálogo ${catalogId} conectado:`, result);
            
        } catch (error) {
            console.log(`❌ Error conectando catálogo ${catalogId}:`);
            console.log('   Status:', error.statusCode);
            console.log('   Error:', error.response?.error?.message || error.error);
            console.log('   Detalles:', JSON.stringify(error.response, null, 2));
        }
        console.log('');
    }

    // 3. Verificar configuración específica de WhatsApp Business API
    console.log('📱 === VERIFICANDO CONFIGURACIÓN WHATSAPP BUSINESS API ===');
    
    const wabaEndpoints = [
        `/v18.0/${PHONE_NUMBER_ID}?fields=id,verified_name,display_phone_number,quality_rating,throughput,is_official_business_account`,
        `/v18.0/${PHONE_NUMBER_ID}/message_templates?fields=name,status,category,language`,
    ];

    for (const endpoint of wabaEndpoints) {
        try {
            const result = await makeGraphAPIRequest(endpoint);
            console.log(`✅ ${endpoint}:`);
            console.log('   ', JSON.stringify(result, null, 2));
        } catch (error) {
            console.log(`❌ ${endpoint}:`);
            console.log('   ', error.response?.error?.message || error.error);
        }
        console.log('');
    }

    // 4. Probar diferentes formatos de mensaje de catálogo
    console.log('🧪 === PROBANDO DIFERENTES FORMATOS DE CATÁLOGO ===');
    
    const testFormats = [
        {
            name: "Formato básico (sin catalog_id)",
            payload: {
                messaging_product: "whatsapp",
                to: "+56973649990", // Número de prueba
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    body: { text: "🧪 Catálogo - Formato básico" },
                    action: { name: "catalog_message" }
                }
            }
        },
        {
            name: "Formato con catalog_id específico",
            payload: {
                messaging_product: "whatsapp",
                to: "+56973649990",
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    body: { text: "🧪 Catálogo - Con ID específico" },
                    action: { 
                        name: "catalog_message",
                        parameters: { catalog_id: "817382327367357" }
                    }
                }
            }
        },
        {
            name: "Formato con thumbnail",
            payload: {
                messaging_product: "whatsapp",
                to: "+56973649990",
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    body: { text: "🧪 Catálogo - Con thumbnail" },
                    action: { 
                        name: "catalog_message",
                        parameters: { 
                            thumbnail_product_retailer_id: "papas-kryzpo-001"
                        }
                    }
                }
            }
        }
    ];

    for (const format of testFormats) {
        try {
            console.log(`📤 Probando: ${format.name}`);
            console.log('   Payload:', JSON.stringify(format.payload, null, 2));
            
            const result = await makeGraphAPIRequest(`/v18.0/${PHONE_NUMBER_ID}/messages`, 'POST', format.payload);
            console.log(`✅ Éxito - Message ID: ${result.messages[0].id}`);
            
        } catch (error) {
            console.log(`❌ Error con ${format.name}:`);
            console.log('   Status:', error.statusCode);
            console.log('   Error:', error.response?.error?.message || error.error);
            
            if (error.response?.error?.error_data) {
                console.log('   Detalles:', error.response.error.error_data);
            }
        }
        console.log('');
    }

    // 5. Recomendaciones basadas en resultados
    console.log('🎯 === DIAGNÓSTICO Y RECOMENDACIONES ===');
    console.log('');
    console.log('📋 Basado en el análisis anterior, las posibles causas son:');
    console.log('');
    console.log('1. 🔗 CONEXIÓN CATÁLOGO-WHATSAPP:');
    console.log('   - El catálogo puede no estar conectado específicamente al número');
    console.log('   - Solución: Conectar manualmente en Commerce Manager');
    console.log('');
    console.log('2. 📱 CONFIGURACIÓN WHATSAPP BUSINESS:');
    console.log('   - Verificar que la cuenta esté en modo "BUSINESS" no "STANDARD"');
    console.log('   - Verificar que Commerce esté habilitado');
    console.log('');
    console.log('3. 🛒 FORMATO DEL MENSAJE:');
    console.log('   - Probar diferentes formatos de payload');
    console.log('   - Incluir catalog_id específico puede ser necesario');
    console.log('');
    console.log('4. 📦 ESTADO DE PRODUCTOS:');
    console.log('   - Verificar que productos tengan imágenes válidas (HTTPS)');
    console.log('   - Verificar que estén en stock y publicados');
    console.log('');
    console.log('🔧 PASOS RECOMENDADOS:');
    console.log('1. Ir a Meta Commerce Manager');
    console.log('2. Conectar específicamente el catálogo al número WhatsApp');
    console.log('3. Verificar que todos los productos tengan imágenes HTTPS');
    console.log('4. Probar formato con catalog_id específico');
}

checkCatalogConnection().catch(console.error);
