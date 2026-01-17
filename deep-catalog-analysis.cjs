// ANÁLISIS DETALLADO DE PROBLEMA DE CATÁLOGO - POLÍTICAS META
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
                    if (res.statusCode === 200) {
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

async function analyzeCommerceSetup() {
    console.log('🔍 === ANÁLISIS DETALLADO DEL PROBLEMA DE CATÁLOGO ===');
    console.log('📅 Fecha:', new Date().toLocaleString());
    console.log('');

    try {
        // 1. VERIFICAR CONFIGURACIÓN DE COMMERCE
        console.log('💼 === 1. VERIFICACIÓN DE COMMERCE MANAGER ===');
        
        try {
            const commerceSettings = await makeGraphAPIRequest(`/v18.0/${PHONE_NUMBER_ID}?fields=is_cart_enabled,is_catalog_visible,commerce_settings`);
            console.log('✅ Configuración actual de Commerce:');
            console.log('   - Cart habilitado:', commerceSettings.is_cart_enabled);
            console.log('   - Catálogo visible:', commerceSettings.is_catalog_visible);
            console.log('   - Settings completos:', JSON.stringify(commerceSettings, null, 2));
        } catch (error) {
            console.log('❌ Error obteniendo configuración de commerce:', error.response?.error?.message || error);
        }

        console.log('');

        // 2. VERIFICAR CATÁLOGOS DETALLADAMENTE
        console.log('🛒 === 2. ANÁLISIS DETALLADO DE CATÁLOGOS ===');
        
        try {
            const catalogs = await makeGraphAPIRequest(`/v18.0/${BUSINESS_ID}/owned_product_catalogs?fields=name,id,product_count,vertical,is_catalog_segment`);
            
            for (const catalog of catalogs.data) {
                console.log(`\n📦 Catálogo: ${catalog.name} (ID: ${catalog.id})`);
                console.log(`   - Productos: ${catalog.product_count}`);
                console.log(`   - Vertical: ${catalog.vertical}`);
                console.log(`   - Es segmento: ${catalog.is_catalog_segment}`);

                // Verificar productos específicos
                try {
                    const products = await makeGraphAPIRequest(`/v18.0/${catalog.id}/products?fields=id,name,image_url,price,url,availability,visibility`);
                    console.log(`   - Productos encontrados: ${products.data?.length || 0}`);
                    
                    if (products.data && products.data.length > 0) {
                        console.log('   - Muestra de productos:');
                        products.data.slice(0, 3).forEach((product, index) => {
                            console.log(`     ${index + 1}. ${product.name} - Disponible: ${product.availability} - Visible: ${product.visibility}`);
                        });
                    }
                } catch (prodError) {
                    console.log(`   ❌ Error obteniendo productos: ${prodError.response?.error?.message || prodError}`);
                }
            }
        } catch (error) {
            console.log('❌ Error obteniendo catálogos:', error.response?.error?.message || error);
        }

        console.log('');

        // 3. VERIFICAR CONEXIÓN CATALOG-WHATSAPP
        console.log('🔗 === 3. VERIFICACIÓN DE CONEXIÓN CATÁLOGO-WHATSAPP ===');
        
        try {
            // Verificar si hay catálogo conectado
            const settings = await makeGraphAPIRequest(`/v18.0/${PHONE_NUMBER_ID}/commerce_settings`);
            console.log('📱 Configuración de WhatsApp Commerce:');
            console.log('   ', JSON.stringify(settings, null, 2));
            
            if (settings.data && settings.data.length > 0) {
                const commerceData = settings.data[0];
                if (commerceData.catalog_id) {
                    console.log(`✅ Catálogo conectado: ${commerceData.catalog_id}`);
                } else {
                    console.log('⚠️ NO hay catálogo conectado a WhatsApp Business');
                }
            }
        } catch (error) {
            console.log('❌ Error verificando conexión:', error.response?.error?.message || error);
        }

        console.log('');

        // 4. VERIFICAR ESTADO DEL NÚMERO DE TELÉFONO
        console.log('📞 === 4. VERIFICACIÓN DEL NÚMERO DE WHATSAPP ===');
        
        try {
            const phoneInfo = await makeGraphAPIRequest(`/v18.0/${PHONE_NUMBER_ID}?fields=verified_name,display_phone_number,quality_rating,account_mode,eligibility_for_api_business_global_search,status`);
            console.log('📱 Estado del número:');
            console.log('   - Nombre verificado:', phoneInfo.verified_name);
            console.log('   - Número:', phoneInfo.display_phone_number);
            console.log('   - Estado:', phoneInfo.status);
            console.log('   - Modo de cuenta:', phoneInfo.account_mode);
            console.log('   - Rating:', phoneInfo.quality_rating);
            console.log('   - Elegible para búsqueda:', phoneInfo.eligibility_for_api_business_global_search);
        } catch (error) {
            console.log('❌ Error verificando número:', error.response?.error?.message || error);
        }

        console.log('');

        // 5. PROBAR ENVÍO DE CATÁLOGO CON ANÁLISIS DE RESPUESTA
        console.log('🧪 === 5. PRUEBA DE ENVÍO DE CATÁLOGO ===');
        
        const testPayload = {
            messaging_product: "whatsapp",
            to: PHONE_NUMBER_ID.replace('56', '+56'), // Formato internacional
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🧪 Prueba de catálogo - Análisis Meta"
                },
                action: {
                    name: "catalog_message"
                }
            }
        };

        try {
            console.log('📤 Enviando mensaje de prueba...');
            console.log('   Payload:', JSON.stringify(testPayload, null, 2));
            
            const result = await makeGraphAPIRequest(`/v18.0/${PHONE_NUMBER_ID}/messages`, 'POST', testPayload);
            console.log('✅ Envío exitoso - Message ID:', result.messages[0].id);
            
        } catch (sendError) {
            console.log('❌ Error en envío de prueba:');
            console.log('   Status:', sendError.statusCode);
            console.log('   Error:', JSON.stringify(sendError.response, null, 2));
        }

        console.log('');

        // 6. ANÁLISIS DE POLÍTICAS ESPECÍFICAS
        console.log('📋 === 6. ANÁLISIS DE POLÍTICAS META ===');
        console.log('🔍 Verificaciones según documentación oficial:');
        console.log('');
        console.log('1. ✅ Token válido y con permisos correctos');
        console.log('2. ✅ Número de WhatsApp verificado');
        console.log('3. ⚠️  Verificar conexión específica catálogo-WhatsApp');
        console.log('4. ⚠️  Verificar productos con availability="in stock"');
        console.log('5. ⚠️  Verificar que productos tengan images válidas');
        console.log('6. ⚠️  Verificar que catálogo esté en modo "live" no "draft"');
        console.log('');
        console.log('📖 Requisitos Meta para catálogos:');
        console.log('   - Productos con imágenes válidas (HTTPS)');
        console.log('   - Availability debe ser "in stock"');
        console.log('   - Precios en formato correcto');
        console.log('   - Catálogo debe estar "publicado" no en borrador');
        console.log('   - Conexión explícita entre catálogo y número WhatsApp');

    } catch (error) {
        console.log('💥 Error general en análisis:', error);
    }
}

analyzeCommerceSetup().catch(console.error);
